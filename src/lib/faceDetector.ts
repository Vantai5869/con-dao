import * as faceapi from '@vladmandic/face-api';

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FacePoint {
  x: number;
  y: number;
}

export interface FaceKeypoints {
  rightEye: FacePoint;
  leftEye: FacePoint;
  mouth: FacePoint;
}

export interface FaceDetection {
  box: FaceBox;
  confidence: number;
  /** Video-native pixel coordinates, or null if landmarks weren't returned for this detection. */
  keypoints: FaceKeypoints | null;
}

// EXPERIMENTAL (branch: experiment/faceapi-lite): swapped MediaPipe's tasks-vision FaceDetector
// for @vladmandic/face-api (TensorFlow.js + WebGL) to cut the model-loading payload — MediaPipe's
// generic vision-task WASM runtime alone is ~11.7MB uncompressed, dwarfing the actual face model
// (229KB); face-api's tiny detector + tiny landmark model together are under 300KB, and its
// TF.js+WebGL "engine" runs on the GPU instead of shipping a multi-megabyte WASM binary — so the
// whole thing is small without needing any server-side gzip config. See public/faceapi/ for the
// vendored model files (tiny_face_detector + face_landmark_68_tiny, downloaded from the
// vladmandic/face-api repo's own model/ folder).
const MODEL_URL = '/faceapi';

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

async function initFaceDetector(): Promise<void> {
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
}

export async function loadFaceDetector(): Promise<void> {
  if (modelsLoaded) return;
  if (!loadingPromise) {
    // On failure, clear the cached promise so the next call (e.g. a user-triggered retry)
    // starts a fresh attempt instead of re-awaiting the same rejected promise forever.
    loadingPromise = initFaceDetector()
      .then(() => {
        modelsLoaded = true;
      })
      .catch((err) => {
        loadingPromise = null;
        throw err;
      });
  }
  await loadingPromise;
}

const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });

/**
 * Returns the highest-confidence face detected in the current video frame, in video-native pixel
 * coordinates. Unlike MediaPipe's synchronous `detectForVideo`, TensorFlow.js inference is
 * inherently async (WebGL readback) — callers already run their detection loop from an async
 * interval callback (see FaceScannerScreen.tsx), so this only required adding an `await` there.
 */
export async function detectFace(video: HTMLVideoElement): Promise<FaceDetection | null> {
  if (!modelsLoaded) {
    throw new Error('Face detector chưa được load. Gọi loadFaceDetector() trước.');
  }

  const result = await faceapi.detectSingleFace(video, DETECTOR_OPTIONS).withFaceLandmarks(true);
  if (!result) return null;

  const { box, score } = result.detection;
  const keypoints: FaceKeypoints = {
    rightEye: averagePoint(result.landmarks.getRightEye()),
    leftEye: averagePoint(result.landmarks.getLeftEye()),
    mouth: averagePoint(result.landmarks.getMouth()),
  };

  return {
    box: { x: box.x, y: box.y, width: box.width, height: box.height },
    confidence: score,
    keypoints,
  };
}

function averagePoint(points: faceapi.Point[]): FacePoint {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

const EYE_SAMPLE_RATIO = 0.09; // half-width of the eye sample box, as a fraction of the eye-to-eye distance
const MASK_SAMPLE_RATIO = 0.16; // half-width of the mouth sample box, as a fraction of the eye-to-eye distance
// Deliberately conservative (fewer false positives over fewer misses): this only gates
// *automatic* capture, and the manual capture button always bypasses it, so a missed
// detection just means the user taps the shutter themselves instead of a hard block.
const GLASSES_DARKNESS_DELTA = 48; // forehead-vs-eye luminance gap (0-255) past which we call it sunglasses
const MASK_UNIFORMITY_THRESHOLD = 8; // mouth-region luminance std-dev below which we call it a mask (bare lips/teeth have more texture)

export interface OcclusionResult {
  sunglasses: boolean;
  mask: boolean;
}

/**
 * Rough, purely-heuristic check for whether the eyes look covered by dark sunglasses or the
 * mouth by a face mask, using pixel samples around the detector's keypoints. This is not real
 * segmentation — it compares brightness/uniformity against a nearby patch of bare skin, so it
 * can be fooled by unusual lighting or skin tone. Good enough to nudge someone to take glasses
 * off; not a substitute for a real liveness/PPE-detection model.
 */
export function assessOcclusion(video: HTMLVideoElement, keypoints: FaceKeypoints): OcclusionResult {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { sunglasses: false, mask: false };
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const eyeDistance = Math.hypot(keypoints.leftEye.x - keypoints.rightEye.x, keypoints.leftEye.y - keypoints.rightEye.y) || 1;
  const eyeHalf = eyeDistance * EYE_SAMPLE_RATIO;
  const maskHalf = eyeDistance * MASK_SAMPLE_RATIO;

  const midEye = {
    x: (keypoints.rightEye.x + keypoints.leftEye.x) / 2,
    y: (keypoints.rightEye.y + keypoints.leftEye.y) / 2,
  };
  // Forehead reference: same horizontal center as the eyes, shifted up by ~0.6x the eye spacing.
  const forehead = { x: midEye.x, y: midEye.y - eyeDistance * 0.6 };

  const rightEyeLum = sampleLuminance(ctx, keypoints.rightEye, eyeHalf, canvas.width, canvas.height);
  const leftEyeLum = sampleLuminance(ctx, keypoints.leftEye, eyeHalf, canvas.width, canvas.height);
  const foreheadLum = sampleLuminance(ctx, forehead, eyeHalf, canvas.width, canvas.height);
  const avgEyeLum = ((rightEyeLum?.mean ?? 0) + (leftEyeLum?.mean ?? 0)) / 2;

  const sunglasses = rightEyeLum != null && leftEyeLum != null && foreheadLum != null && foreheadLum.mean - avgEyeLum > GLASSES_DARKNESS_DELTA;

  const mouthStats = sampleLuminance(ctx, keypoints.mouth, maskHalf, canvas.width, canvas.height);
  const mask = mouthStats != null && mouthStats.stdDev < MASK_UNIFORMITY_THRESHOLD;

  return { sunglasses, mask };
}

function sampleLuminance(
  ctx: CanvasRenderingContext2D,
  center: FacePoint,
  half: number,
  maxWidth: number,
  maxHeight: number,
): { mean: number; stdDev: number } | null {
  const x = Math.max(0, Math.round(center.x - half));
  const y = Math.max(0, Math.round(center.y - half));
  const w = Math.min(maxWidth - x, Math.round(half * 2));
  const h = Math.min(maxHeight - y, Math.round(half * 2));
  if (w < 2 || h < 2) return null;

  const { data } = ctx.getImageData(x, y, w, h);
  const luminances: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    luminances.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  const mean = luminances.reduce((sum, v) => sum + v, 0) / luminances.length;
  const variance = luminances.reduce((sum, v) => sum + (v - mean) ** 2, 0) / luminances.length;
  return { mean, stdDev: Math.sqrt(variance) };
}
