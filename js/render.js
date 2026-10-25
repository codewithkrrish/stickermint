/* StickerMint — js/render.js
   The single render path. app.js builds ONE sticker object and passes it
   here unchanged; the harness passes the same shape to a fake context.
   This is deliberate: the BGone failure was a field-name mismatch
   between the object a producer stored and the object a consumer read.
   Here there is only one shape, defined below, and nothing else reads
   crop/border/caption fields.

   Sticker shape:
     {
       crop: { x, y, width, height },   // source pixels
       mode: 'free' | 'square' | 'rounded',
       radiusPx: number,                // output px, 0 unless rounded
       border: { enabled: boolean, width: number },
       shadow: boolean,
       caption: { text, size, color, stroke, position, x, y }
     }
   The canvas passed in must already be 512 x 512. */

import { STICKER_SIZE, captionAnchor, cropForMode, cropToPixels, radiusForSlider } from './geometry.js';

/* Pure sticker builder: the ONE place a sticker object is assembled.
   app.js calls this, and the harness calls this with the same input
   shape, so a field-name drift between producer and renderer cannot
   hide until a live test. Input:
     { cropBox, sourceWidth, sourceHeight, mode, radiusSlider,
       borderEnabled, borderWidth, shadow, caption } */
export function buildSticker(input) {
  const crop = cropToPixels(
    cropForMode(input.cropBox, input.mode, input.sourceWidth, input.sourceHeight),
    input.sourceWidth,
    input.sourceHeight,
  );
  return {
    crop,
    mode: input.mode,
    radiusPx: input.mode === 'rounded' ? radiusForSlider(input.radiusSlider) : 0,
    border: { enabled: input.borderEnabled, width: input.borderWidth },
    shadow: input.shadow,
    caption: {
      text: input.caption.text,
      size: input.caption.size,
      color: input.caption.color,
      stroke: input.caption.stroke,
      position: input.caption.position,
      x: input.caption.x,
      y: input.caption.y,
    },
  };
}

/* Trace a rounded rect as a subpath without starting a new path, so
   renderSticker can combine outer + inner outlines into one evenodd
   fill (the border ring). See the ring-fill note in renderSticker. */
export function traceRoundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  traceRoundRect(ctx, x, y, w, h, r);
}

export function renderSticker(ctx, sticker, source) {
  const S = STICKER_SIZE;
  const inset = sticker.border.enabled ? sticker.border.width : 0;
  const radius = sticker.mode === 'rounded' ? sticker.radiusPx : 0;

  ctx.clearRect(0, 0, S, S);
  ctx.save();

  // White border, drawn as a RING (outer outline minus inner outline,
  // evenodd fill) — not a solid plate. A solid plate used to sit under
  // the photo, so erased (transparent) pixels still showed white and
  // the erase assist looked like it did nothing, in both preview and
  // export. The ring is visually identical for opaque photos (the only
  // white that ever showed was the margin), but erased areas now stay
  // genuinely transparent. Shadow, when on, belongs to this ring only,
  // not to the caption text.
  if (sticker.shadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
  }
  ctx.beginPath();
  traceRoundRect(ctx, 0, 0, S, S, radius);
  traceRoundRect(ctx, inset, inset, S - inset * 2, S - inset * 2, Math.max(0, radius - inset));
  ctx.fillStyle = '#ffffff';
  ctx.fill('evenodd');
  ctx.shadowColor = 'rgba(0, 0, 0, 0)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Photo clipped inside the border plate.
  ctx.save();
  roundRectPath(ctx, inset, inset, S - inset * 2, S - inset * 2, Math.max(0, radius - inset));
  ctx.clip();
  ctx.drawImage(
    source,
    sticker.crop.x, sticker.crop.y, sticker.crop.width, sticker.crop.height,
    inset, inset, S - inset * 2, S - inset * 2,
  );
  ctx.restore();

  // Caption, drawn last so it sits on top of the photo.
  const text = (sticker.caption.text || '').trim();
  if (text) {
    const anchor = captionAnchor(sticker.caption);
    ctx.font = `700 ${sticker.caption.size}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const px = anchor.x * S;
    const py = anchor.y * S;
    if (sticker.caption.stroke) {
      ctx.lineWidth = Math.max(2, Math.round(sticker.caption.size / 10));
      ctx.strokeStyle = '#0B0B0F';
      ctx.strokeText(text, px, py);
    }
    ctx.fillStyle = sticker.caption.color;
    ctx.fillText(text, px, py);
  }

  ctx.restore();
  return ctx;
}

/* Built-in sample photo, drawn at runtime so the repo ships no images.
   A simple landscape: sky, sun, hills, foreground. */
export function drawSamplePhoto(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#7FB4E8');
  gradient.addColorStop(1, '#E8F1FA');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.beginPath();
  ctx.arc(width * 0.72, height * 0.26, width * 0.13, 0, Math.PI * 2);
  ctx.fillStyle = '#F5C542';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(width * 0.25, height * 0.78, width * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = '#3E7D4E';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(width * 0.85, height * 0.85, width * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = '#2F6B3E';
  ctx.fill();
  ctx.fillStyle = '#0B0B0F';
  ctx.font = `700 ${Math.round(width * 0.09)}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HELLO', width * 0.5, height * 0.42);
}
