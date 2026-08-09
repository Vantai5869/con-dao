import { FilesetResolver, FaceDetector, type BoundingBox } from '@mediapipe/tasks-vision';

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

// BlazeFace's fixed keypoint order: right eye, left eye, nose tip, mouth center, right ear, left ear.
export interface FaceKeypoints {
  rightEye: FacePoint;
  leftEye: FacePoint;
  mouth: FacePoint;
}

export interface FaceDetection {
  box: FaceBox;
  confidence: number;
  /** Video-native pixel coordinates, or null if the model didn't return keypoints for this detection. */
  keypoints: FaceKeypoints | null;
}

// WASM runtime + model are loaded from CDN at runtime rather than bundled —
// unlike @techstark/opencv-js (which inlines its WASM into one huge JS file),
// this package has a clean ESM entry and keeps WASM/model as separate assets,
// so this doesn't repeat the earlier opencv.js dev-bundle size problem.
const WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

let detector: FaceDetector | null = null;
let loadingPromise: Promise<FaceDetector> | null = null;

async function initFaceDetector(): Promise<FaceDetector> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
  return FaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL },
    runningMode: 'VIDEO',
  });
}

export async function loadFaceDetector(): Promise<void> {
  if (detector) return;
  if (!loadingPromise) {
    loadingPromise = initFaceDetector();
  }
  detector = await loadingPromise;
}

/** Returns the highest-confidence face detected in the current video frame, in video-native pixel coordinates. */
export function detectFace(video: HTMLVideoElement): FaceDetection | null {
  if (!detector) {
    throw new Error('Face detector chưa được load. Gọi loadFaceDetector() trước.');
  }

  const result = detector.detectForVideo(video, performance.now());
  if (result.detections.length === 0) return null;

  let best = result.detections[0];
  for (const detection of result.detections) {
    if ((detection.categories[0]?.score ?? 0) > (best.categories[0]?.score ?? 0)) {
      best = detection;
    }
  }

  const boundingBox: BoundingBox | undefined = best.boundingBox;
  if (!boundingBox) return null;

  const [rightEye, leftEye, , mouth] = best.keypoints;
  const keypoints: FaceKeypoints | null =
    rightEye && leftEye && mouth
      ? {
          rightEye: { x: rightEye.x * video.videoWidth, y: rightEye.y * video.videoHeight },
          leftEye: { x: leftEye.x * video.videoWidth, y: leftEye.y * video.videoHeight },
          mouth: { x: mouth.x * video.videoWidth, y: mouth.y * video.videoHeight },
        }
      : null;

  return {
    box: { x: boundingBox.originX, y: boundingBox.originY, width: boundingBox.width, height: boundingBox.height },
    confidence: best.categories[0]?.score ?? 0,
    keypoints,
  };
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
