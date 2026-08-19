// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CV = any;

// Served as a static file (copied from node_modules/@techstark/opencv-js/dist/opencv.js) and
// loaded via <script> instead of `import`. A bundler `import` would inline this 13MB UMD file
// (WASM included as base64) straight into the DocumentVerifyScreen JS chunk — this way it's a
// separate, independently cacheable request. (faceDetector.ts used to mirror this approach for
// MediaPipe's WASM; on this branch it's a plain `import` of @vladmandic/face-api instead, since
// that library's TF.js+WebGL runtime doesn't have OpenCV's 13MB-single-file problem.)
// Version-tagged so a long-lived Cache-Control on the server can't strand a client on a stale
// copy — bump this (matching the @techstark/opencv-js version) whenever the vendored file changes.
//
// A client-side "fetch the .gz, decompress via DecompressionStream, run as inline script" variant
// was tried here to cut the transfer without needing server-side gzip, but caused a blank/crashed
// screen on real-device testing (13MB as one inline <script> textContent is a lot of synchronous
// main-thread work — mobile Safari in particular can kill the tab under that memory pressure).
// Reverted in favor of the plain <script src> load below; use gzip_static on the server instead
// (see public/opencv/opencv.js.gz, already vendored) to get the same size cut safely.
const OPENCV_VERSION = '5.0.0-release.1';
const OPENCV_SCRIPT_URL = `/opencv/opencv.js?v=${OPENCV_VERSION}`;

let cv: CV | null = null;
let loadingPromise: Promise<CV> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không thể tải OpenCV.'));
    document.head.appendChild(script);
  });
}

async function resolveCv(): Promise<CV> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (!w.cv) {
    await loadScript(OPENCV_SCRIPT_URL);
  }
  const mod = w.cv as CV;
  if (mod instanceof Promise) return mod;
  if (mod.Mat) return mod;
  return new Promise((resolve) => {
    mod.onRuntimeInitialized = () => resolve(mod);
  });
}

export async function loadOpenCv(): Promise<void> {
  if (cv) return;
  if (!loadingPromise) {
    // On failure, clear the cached promise so the next call (e.g. a user-triggered retry)
    // starts a fresh attempt instead of re-awaiting the same rejected promise forever.
    loadingPromise = resolveCv().catch((err) => {
      loadingPromise = null;
      throw err;
    });
  }
  cv = await loadingPromise;
}

export function getCv(): CV {
  if (!cv) {
    throw new Error('OpenCV chưa được load. Gọi loadOpenCv() trước.');
  }
  return cv;
}
