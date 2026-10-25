/* StickerMint — js/pixels.js
   Pure pixel work on RGBA arrays ({ data, width, height } shaped like
   ImageData). No DOM, no canvas, no network. The erase assist mirrors
   BGone's colour-key idea: only colour connected to the photo edges is
   removed, so a matching colour inside the subject survives. */

export function colorDistance(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export function parseHex(hex) {
  const clean = String(hex).replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/* Erase-by-colour assist.
   pixels: { data: Uint8ClampedArray, width, height }
   options: { color: [r, g, b], tolerance: 0..441 }
   Returns a NEW array; the input is never mutated.
   A pixel is a candidate when it is within tolerance of the picked
   colour. Only candidates connected to an edge through other candidates
   are erased (alpha -> 0). Interior candidates keep their alpha. */
export function eraseByColor(pixels, options) {
  const { width, height, data } = pixels;
  const [pr, pg, pb] = options.color;
  const tolerance = options.tolerance;
  const out = new Uint8ClampedArray(data);
  const candidate = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (colorDistance(data[i], data[i + 1], data[i + 2], pr, pg, pb) <= tolerance) {
        candidate[y * width + x] = 1;
      }
    }
  }
  // Flood-fill from every edge pixel through candidates.
  const stack = [];
  const seen = new Uint8Array(width * height);
  const push = (x, y) => {
    const idx = y * width + x;
    if (candidate[idx] && !seen[idx]) {
      seen[idx] = 1;
      stack.push(idx);
    }
  };
  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length > 0) {
    const idx = stack.pop();
    const x = idx % width;
    const y = Math.floor(idx / width);
    out[idx * 4 + 3] = 0;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }
  return out;
}

/* Count fully transparent pixels in an RGBA array. */
export function countTransparent(data) {
  let n = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] === 0) n += 1;
  }
  return n;
}

/* Zero the alpha outside a rounded rectangle (radius in pixels).
   Returns a NEW array; the input is never mutated. Used by the harness
   to prove the rounded mode's mask; the live renderer clips with a
   canvas path instead, which is the same geometry. */
export function applyRoundedMask(pixels, radius) {
  const { width, height, data } = pixels;
  const out = new Uint8ClampedArray(data);
  const r = Math.min(radius, width / 2, height / 2);
  const corners = [
    { cx: r, cy: r },
    { cx: width - 1 - r, cy: r },
    { cx: r, cy: height - 1 - r },
    { cx: width - 1 - r, cy: height - 1 - r },
  ];
  const inside = (x, y) => {
    if (x >= r && x < width - r) return true;
    if (y >= r && y < height - r) return true;
    for (const c of corners) {
      const dx = x - c.cx;
      const dy = y - c.cy;
      if (dx * dx + dy * dy <= r * r) return true;
    }
    return false;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!inside(x, y)) out[(y * width + x) * 4 + 3] = 0;
    }
  }
  return out;
}
