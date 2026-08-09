export interface Point {
  x: number;
  y: number;
}

/** Draws the current video frame onto a canvas, optionally downscaled so its longest edge is `maxLongEdge`. */
export function drawVideoFrameToCanvas(video: HTMLVideoElement, maxLongEdge?: number): HTMLCanvasElement {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  let outW = vw;
  let outH = vh;

  if (maxLongEdge && Math.max(vw, vh) > maxLongEdge) {
    const scale = maxLongEdge / Math.max(vw, vh);
    outW = Math.round(vw * scale);
    outH = Math.round(vh * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0, outW, outH);
  return canvas;
}

/** Uniformly rescales points (e.g. from a downscaled detection canvas back to native video pixels). */
export function scalePoints(points: Point[], scale: number): Point[] {
  return points.map((p) => ({ x: p.x * scale, y: p.y * scale }));
}

/** Rescales then translates points — e.g. mapping a cropped-region canvas's local points back into full video-native coordinates. */
export function scaleAndOffsetPoints(points: Point[], scale: number, offsetX: number, offsetY: number): Point[] {
  return points.map((p) => ({ x: p.x * scale + offsetX, y: p.y * scale + offsetY }));
}

export interface SourceRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * `video` is displayed with object-fit: cover inside `containerEl`. This computes
 * the native-pixel rectangle of `video` that corresponds to `guideEl`'s on-screen
 * position, so detection can be constrained to just that region instead of the
 * whole (possibly cluttered) camera frame.
 */
export function computeSourceRect(video: HTMLVideoElement, containerEl: HTMLElement, guideEl: HTMLElement): SourceRect {
  const containerRect = containerEl.getBoundingClientRect();
  const guideRect = guideEl.getBoundingClientRect();

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const cw = containerRect.width;
  const ch = containerRect.height;

  // CSS px per native video px under object-fit: cover.
  const k = Math.max(cw / vw, ch / vh);
  const cropX = (vw * k - cw) / 2;
  const cropY = (vh * k - ch) / 2;

  const guideRelX = guideRect.left - containerRect.left;
  const guideRelY = guideRect.top - containerRect.top;

  const sx = (guideRelX + cropX) / k;
  const sy = (guideRelY + cropY) / k;
  const sw = guideRect.width / k;
  const sh = guideRect.height / k;

  return {
    sx: Math.max(0, sx),
    sy: Math.max(0, sy),
    sw: Math.min(sw, vw - Math.max(0, sx)),
    sh: Math.min(sh, vh - Math.max(0, sy)),
  };
}

/** Draws just `rect` of the video frame onto a canvas, optionally downscaled so its longest edge is `maxLongEdge`. */
export function drawRegionToCanvas(video: HTMLVideoElement, rect: SourceRect, maxLongEdge?: number): HTMLCanvasElement {
  let outW = rect.sw;
  let outH = rect.sh;

  if (maxLongEdge && Math.max(outW, outH) > maxLongEdge) {
    const scale = maxLongEdge / Math.max(outW, outH);
    outW = Math.round(outW * scale);
    outH = Math.round(outH * scale);
  } else {
    outW = Math.round(outW);
    outH = Math.round(outH);
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  canvas.getContext('2d')!.drawImage(video, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, outW, outH);
  return canvas;
}

/**
 * `video` is displayed with object-fit: cover inside `containerEl`. This maps a
 * point in native video pixel coordinates to CSS px relative to containerEl's
 * top-left, so a detected quad (in video pixel space) can be drawn as an
 * overlay polygon on top of the displayed video.
 */
export function videoPointToContainerPoint(video: HTMLVideoElement, containerEl: HTMLElement, point: Point): Point {
  const containerRect = containerEl.getBoundingClientRect();
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const cw = containerRect.width;
  const ch = containerRect.height;

  // CSS px per native video px under object-fit: cover.
  const scale = Math.max(cw / vw, ch / vh);
  const cropX = (vw * scale - cw) / 2;
  const cropY = (vh * scale - ch) / 2;

  return {
    x: point.x * scale - cropX,
    y: point.y * scale - cropY,
  };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Pulls each point in `factor` (0..1) towards the quad's centroid — a small safety margin so a slightly loose detection doesn't leak background/shadow into the final crop. */
export function shrinkQuad(points: Point[], factor: number): Point[] {
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return points.map((p) => ({
    x: cx + (p.x - cx) * (1 - factor),
    y: cy + (p.y - cy) * (1 - factor),
  }));
}

export function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Không thể xuất ảnh từ canvas.'))),
      'image/jpeg',
      quality,
    );
  });
}
