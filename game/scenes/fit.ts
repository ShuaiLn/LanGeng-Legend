/**
 * Contain-fit: the largest size that fits `srcW x srcH` inside `boxW x boxH` without changing its
 * aspect ratio. `x`/`y` place that rectangle centred inside the box (offsets from the box's
 * top-left), so art is never cropped or stretched. Pure so it can be unit tested.
 */
export interface FitResult {
  width: number;
  height: number;
  x: number;
  y: number;
}

export function fitContain(srcW: number, srcH: number, boxW: number, boxH: number): FitResult {
  if (srcW <= 0 || srcH <= 0 || boxW <= 0 || boxH <= 0) return { width: 0, height: 0, x: 0, y: 0 };
  const scale = Math.min(boxW / srcW, boxH / srcH);
  const width = srcW * scale;
  const height = srcH * scale;
  return { width, height, x: (boxW - width) / 2, y: (boxH - height) / 2 };
}
