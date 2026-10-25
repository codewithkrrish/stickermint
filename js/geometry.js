/* StickerMint — js/geometry.js
   Pure crop / caption / pack maths. No DOM, no canvas, no network, so
   every function here runs in plain Node and is covered by the harness.
   All crop boxes are stored as fractions of the source image (0..1),
   and converted to source pixels only at render time. */

export const STICKER_SIZE = 512;
export const MAX_PACK = 30;

export function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

/* Full-frame default crop box. */
export function defaultCrop() {
  return { x: 0, y: 0, w: 1, h: 1 };
}

/* Enforce a crop mode on a fractional box.
   - free: box as-is (clamped inside the frame).
   - square: largest centred square that fits inside the box, in source
     pixel terms, so it stays square even on a non-square photo.
   - rounded: same geometry as free; only the corner radius changes. */
export function cropForMode(box, mode, sourceWidth, sourceHeight) {
  const b = {
    x: clamp01(box.x),
    y: clamp01(box.y),
    w: clamp01(box.w),
    h: clamp01(box.h),
  };
  if (b.x + b.w > 1) b.w = 1 - b.x;
  if (b.y + b.h > 1) b.h = 1 - b.y;
  if (mode === 'square') {
    const pxW = b.w * sourceWidth;
    const pxH = b.h * sourceHeight;
    const side = Math.min(pxW, pxH);
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    b.w = side / sourceWidth;
    b.h = side / sourceHeight;
    b.x = clamp01(cx - b.w / 2);
    b.y = clamp01(cy - b.h / 2);
    if (b.x + b.w > 1) b.x = 1 - b.w;
    if (b.y + b.h > 1) b.y = 1 - b.h;
  }
  return b;
}

/* Fractional box -> source-pixel rect. This is the single conversion the
   renderer uses; app.js never computes pixel rects itself. */
export function cropToPixels(box, sourceWidth, sourceHeight) {
  return {
    x: Math.round(box.x * sourceWidth),
    y: Math.round(box.y * sourceHeight),
    width: Math.max(1, Math.round(box.w * sourceWidth)),
    height: Math.max(1, Math.round(box.h * sourceHeight)),
  };
}

/* Corner radius in output pixels from the 0..100 slider value.
   Radius is a fraction of half the shorter output side, so 100 is a
   full circle on a square sticker. */
export function radiusForSlider(sliderValue) {
  return Math.round((sliderValue / 100) * (STICKER_SIZE / 2));
}

/* Caption anchor as fractions of the 512 output.
   Presets are fixed; 'custom' uses the stored x/y fractions. */
export function captionAnchor(caption) {
  if (caption.position === 'top') return { x: 0.5, y: 0.12 };
  if (caption.position === 'center') return { x: 0.5, y: 0.5 };
  if (caption.position === 'custom') {
    return { x: clamp01(caption.x ?? 0.5), y: clamp01(caption.y ?? 0.12) };
  }
  return { x: 0.5, y: 0.88 }; // bottom (default)
}

/* Pack rules, shared by app.js and the harness. */
export function canAddToPack(packSize) {
  return packSize < MAX_PACK;
}

export function moveInPack(pack, fromIndex, toIndex) {
  if (fromIndex < 0 || fromIndex >= pack.length) return pack;
  if (toIndex < 0 || toIndex >= pack.length) return pack;
  const next = pack.slice();
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}
