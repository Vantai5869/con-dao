import cvModule from '@techstark/opencv-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CV = any;

let cv: CV | null = null;
let loadingPromise: Promise<CV> | null = null;

async function resolveCv(): Promise<CV> {
  const mod = cvModule as CV;
  if (mod instanceof Promise) return mod;
  if (mod.Mat) return mod;
  return new Promise((resolve) => {
    mod.onRuntimeInitialized = () => resolve(mod);
  });
}

export async function loadOpenCv(): Promise<void> {
  if (cv) return;
  if (!loadingPromise) {
    loadingPromise = resolveCv();
  }
  cv = await loadingPromise;
}

export function getCv(): CV {
  if (!cv) {
    throw new Error('OpenCV chưa được load. Gọi loadOpenCv() trước.');
  }
  return cv;
}
