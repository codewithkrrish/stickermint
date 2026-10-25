/* StickerMint — js/app.js
   UI wiring only. Crop maths lives in geometry.js, pixel work in
   pixels.js, and the sticker object is assembled by buildSticker in
   render.js — app.js never hand-builds a sticker object, so the shape
   the renderer receives is exactly the shape the harness tests. */

import { defaultCrop, cropForMode, canAddToPack, moveInPack, STICKER_SIZE, MAX_PACK } from './geometry.js';
import { eraseByColor } from './pixels.js';
import { renderSticker, buildSticker, drawSamplePhoto } from './render.js';

const $ = (id) => document.getElementById(id);

const els = {
  dropzone: $('dropzone'),
  fileInput: $('fileInput'),
  sampleBtn: $('sampleBtn'),
  cropCanvas: $('cropCanvas'),
  cropHint: $('cropHint'),
  modeFree: $('modeFree'),
  modeSquare: $('modeSquare'),
  modeRounded: $('modeRounded'),
  radiusRow: $('radiusRow'),
  radiusRange: $('radiusRange'),
  radiusValue: $('radiusValue'),
  borderToggle: $('borderToggle'),
  borderRange: $('borderRange'),
  borderValue: $('borderValue'),
  shadowToggle: $('shadowToggle'),
  captionText: $('captionText'),
  captionSize: $('captionSize'),
  captionSizeValue: $('captionSizeValue'),
  captionColor: $('captionColor'),
  captionStroke: $('captionStroke'),
  captionPosition: $('captionPosition'),
  eraseToggle: $('eraseToggle'),
  eraseTolerance: $('eraseTolerance'),
  eraseToleranceValue: $('eraseToleranceValue'),
  eraseSwatch: $('eraseSwatch'),
  eraseLabel: $('eraseLabel'),
  clearEraseBtn: $('clearEraseBtn'),
  previewCanvas: $('previewCanvas'),
  statusText: $('statusText'),
  downloadBtn: $('downloadBtn'),
  addToPackBtn: $('addToPackBtn'),
  packGrid: $('packGrid'),
  packCount: $('packCount'),
  packEmpty: $('packEmpty'),
  downloadZipBtn: $('downloadZipBtn'),
  clearPackBtn: $('clearPackBtn'),
  toastRegion: $('toastRegion'),
};

const state = {
  originalCanvas: null,
  sourceCanvas: null,
  sourceWidth: 0,
  sourceHeight: 0,
  cropBox: defaultCrop(),
  mode: 'free',
  erase: { enabled: false, color: null, tolerance: 40 },
  captionCustom: { x: 0.5, y: 0.12 },
  pack: [],
  packSeq: 0,
};

function toast(message) {
  if (!els.toastRegion) return;
  const el = document.createElement('p');
  el.className = 'toast';
  el.textContent = message;
  els.toastRegion.appendChild(el);
  window.setTimeout(() => el.remove(), 4000);
}

function currentInput() {
  return {
    cropBox: state.cropBox,
    sourceWidth: state.sourceWidth,
    sourceHeight: state.sourceHeight,
    mode: state.mode,
    radiusSlider: Number(els.radiusRange.value),
    borderEnabled: els.borderToggle.checked,
    borderWidth: Number(els.borderRange.value),
    shadow: els.shadowToggle.checked,
    caption: {
      text: els.captionText.value,
      size: Number(els.captionSize.value),
      color: els.captionColor.value,
      stroke: els.captionStroke.checked,
      position: els.captionPosition.value,
      x: state.captionCustom.x,
      y: state.captionCustom.y,
    },
  };
}

function renderPreview() {
  if (!state.sourceCanvas) return;
  const ctx = els.previewCanvas.getContext('2d');
  if (!ctx) return;
  renderSticker(ctx, buildSticker(currentInput()), state.sourceCanvas);
  els.statusText.textContent =
    `Source ${state.sourceWidth} x ${state.sourceHeight}  ·  Output ${STICKER_SIZE} x ${STICKER_SIZE} WebP  ·  Pack ${state.pack.length}/${MAX_PACK}`;
}

/* ---- source handling ---- */

function setSource(canvas) {
  state.originalCanvas = canvas;
  state.sourceWidth = canvas.width;
  state.sourceHeight = canvas.height;
  state.cropBox = defaultCrop();
  state.erase.enabled = false;
  state.erase.color = null;
  rebuildSource();
  drawCropCanvas();
  renderPreview();
  toast('Photo loaded. Drag the crop box, then add it to your pack.');
}

function rebuildSource() {
  if (!state.originalCanvas) return;
  if (!state.erase.enabled || !state.erase.color) {
    state.sourceCanvas = state.originalCanvas;
    return;
  }
  const canvas = document.createElement('canvas');
  canvas.width = state.originalCanvas.width;
  canvas.height = state.originalCanvas.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(state.originalCanvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const erased = eraseByColor(
    { data: imageData.data, width: canvas.width, height: canvas.height },
    { color: state.erase.color, tolerance: state.erase.tolerance },
  );
  imageData.data.set(erased);
  ctx.putImageData(imageData, 0, 0);
  state.sourceCanvas = canvas;
}

function loadImageFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    toast('That file is not an image. Try a JPG, PNG or WebP photo.');
    return;
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    setSource(canvas);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    toast('Could not read that image. Try a different file.');
  };
  img.src = url;
}

function loadSample() {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  drawSamplePhoto(canvas.getContext('2d'), 800, 600);
  setSource(canvas);
}

/* ---- crop canvas ---- */

function displayRect() {
  const cw = els.cropCanvas.width;
  const ch = els.cropCanvas.height;
  const scale = Math.min(cw / state.sourceWidth, ch / state.sourceHeight);
  const w = state.sourceWidth * scale;
  const h = state.sourceHeight * scale;
  return { x: (cw - w) / 2, y: (ch - h) / 2, w, h, scale };
}

function drawCropCanvas() {
  const ctx = els.cropCanvas.getContext('2d');
  if (!ctx || !state.sourceCanvas) return;
  const cw = els.cropCanvas.width;
  const ch = els.cropCanvas.height;
  ctx.clearRect(0, 0, cw, ch);
  const d = displayRect();
  ctx.drawImage(state.sourceCanvas, d.x, d.y, d.w, d.h);
  // Dim outside the crop box, then outline the box and its handles.
  const bx = d.x + state.cropBox.x * d.w;
  const by = d.y + state.cropBox.y * d.h;
  const bw = state.cropBox.w * d.w;
  const bh = state.cropBox.h * d.h;
  ctx.fillStyle = 'rgba(11, 11, 15, 0.55)';
  ctx.fillRect(d.x, d.y, d.w, by - d.y);
  ctx.fillRect(d.x, by + bh, d.w, d.y + d.h - (by + bh));
  ctx.fillRect(d.x, by, bx - d.x, bh);
  ctx.fillRect(bx + bw, by, d.x + d.w - (bx + bw), bh);
  ctx.strokeStyle = '#E5484D';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#E5484D';
  const handles = [
    [bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh],
  ];
  for (const [hx, hy] of handles) {
    ctx.beginPath();
    ctx.arc(hx, hy, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function canvasPoint(event) {
  const rect = els.cropCanvas.getBoundingClientRect();
  const px = (event.clientX - rect.left) * (els.cropCanvas.width / rect.width);
  const py = (event.clientY - rect.top) * (els.cropCanvas.height / rect.height);
  return { px, py };
}

function hitTest(px, py) {
  const d = displayRect();
  const bx = d.x + state.cropBox.x * d.w;
  const by = d.y + state.cropBox.y * d.h;
  const bw = state.cropBox.w * d.w;
  const bh = state.cropBox.h * d.h;
  const corners = [
    ['nw', bx, by], ['ne', bx + bw, by], ['sw', bx, by + bh], ['se', bx + bw, by + bh],
  ];
  for (const [name, hx, hy] of corners) {
    if (Math.abs(px - hx) <= 12 && Math.abs(py - hy) <= 12) return name;
  }
  if (px >= bx && px <= bx + bw && py >= by && py <= by + bh) return 'move';
  return null;
}

let drag = null;
let downPos = null;

els.cropCanvas.addEventListener('pointerdown', (event) => {
  if (!state.sourceCanvas) return;
  const { px, py } = canvasPoint(event);
  downPos = { px, py };
  const hit = hitTest(px, py);
  if (!hit) return;
  drag = { kind: hit, startBox: { ...state.cropBox }, px, py };
  els.cropCanvas.setPointerCapture(event.pointerId);
});

els.cropCanvas.addEventListener('pointermove', (event) => {
  if (!drag || !state.sourceCanvas) return;
  const { px, py } = canvasPoint(event);
  const d = displayRect();
  const dx = (px - drag.px) / d.w;
  const dy = (py - drag.py) / d.h;
  const box = { ...drag.startBox };
  if (drag.kind === 'move') {
    box.x = Math.min(1 - box.w, Math.max(0, box.x + dx));
    box.y = Math.min(1 - box.h, Math.max(0, box.y + dy));
  } else {
    // Resize from the opposite corner, which stays fixed.
    if (drag.kind.includes('e')) box.w = Math.max(0.05, drag.startBox.w + dx);
    else box.w = Math.max(0.05, drag.startBox.w - dx);
    if (drag.kind.includes('s')) box.h = Math.max(0.05, drag.startBox.h + dy);
    else box.h = Math.max(0.05, drag.startBox.h - dy);
    if (drag.kind.includes('w')) box.x = drag.startBox.x + drag.startBox.w - box.w;
    if (drag.kind.includes('n')) box.y = drag.startBox.y + drag.startBox.h - box.h;
    if (box.x < 0) { box.w += box.x; box.x = 0; }
    if (box.y < 0) { box.h += box.y; box.y = 0; }
    if (box.x + box.w > 1) box.w = 1 - box.x;
    if (box.y + box.h > 1) box.h = 1 - box.y;
  }
  state.cropBox = cropForMode(box, state.mode, state.sourceWidth, state.sourceHeight);
  drawCropCanvas();
  renderPreview();
});

els.cropCanvas.addEventListener('pointerup', (event) => {
  const start = downPos;
  drag = null;
  downPos = null;
  if (!state.sourceCanvas || !start) return;
  const { px, py } = canvasPoint(event);
  // A click (not a drag) picks the colour under the cursor for the
  // erase assist, wherever on the photo it lands. A real drag that
  // moved the crop box never picks a colour.
  if (Math.abs(px - start.px) < 5 && Math.abs(py - start.py) < 5) {
    pickEraseColor(px, py);
  }
});

function pickEraseColor(px, py) {
  const d = displayRect();
  const sx = Math.floor((px - d.x) / d.scale);
  const sy = Math.floor((py - d.y) / d.scale);
  if (sx < 0 || sy < 0 || sx >= state.sourceWidth || sy >= state.sourceHeight) return;
  const ctx = state.originalCanvas.getContext('2d');
  const pixel = ctx.getImageData(sx, sy, 1, 1).data;
  state.erase.color = [pixel[0], pixel[1], pixel[2]];
  state.erase.enabled = true;
  els.eraseToggle.checked = true;
  const hex = `#${[pixel[0], pixel[1], pixel[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  els.eraseSwatch.style.background = hex;
  els.eraseLabel.textContent = `Picked ${hex} — drag tolerance to widen the match.`;
  rebuildSource();
  drawCropCanvas();
  renderPreview();
}

/* ---- caption drag on the preview ---- */

let captionDrag = false;
els.previewCanvas.addEventListener('pointerdown', (event) => {
  if (!state.sourceCanvas) return;
  captionDrag = true;
  els.previewCanvas.setPointerCapture(event.pointerId);
  moveCaption(event);
});
els.previewCanvas.addEventListener('pointermove', (event) => {
  if (captionDrag) moveCaption(event);
});
els.previewCanvas.addEventListener('pointerup', () => { captionDrag = false; });
function moveCaption(event) {
  const rect = els.previewCanvas.getBoundingClientRect();
  const fx = (event.clientX - rect.left) / rect.width;
  const fy = (event.clientY - rect.top) / rect.height;
  state.captionCustom.x = Math.min(0.95, Math.max(0.05, fx));
  state.captionCustom.y = Math.min(0.95, Math.max(0.05, fy));
  els.captionPosition.value = 'custom';
  renderPreview();
}

/* ---- controls ---- */

function setMode(mode) {
  state.mode = mode;
  for (const [btn, name] of [[els.modeFree, 'free'], [els.modeSquare, 'square'], [els.modeRounded, 'rounded']]) {
    btn.classList.toggle('active', name === mode);
    btn.setAttribute('aria-pressed', String(name === mode));
  }
  els.radiusRow.hidden = mode !== 'rounded';
  state.cropBox = cropForMode(state.cropBox, mode, state.sourceWidth || 1, state.sourceHeight || 1);
  drawCropCanvas();
  renderPreview();
}
els.modeFree.addEventListener('click', () => setMode('free'));
els.modeSquare.addEventListener('click', () => setMode('square'));
els.modeRounded.addEventListener('click', () => setMode('rounded'));

function bindLabel(range, label, suffix, onChange) {
  const update = () => {
    label.textContent = `${range.value}${suffix}`;
    if (onChange) onChange();
  };
  range.addEventListener('input', update);
  update();
}
bindLabel(els.radiusRange, els.radiusValue, '', () => renderPreview());
bindLabel(els.borderRange, els.borderValue, ' px', () => renderPreview());
bindLabel(els.captionSize, els.captionSizeValue, ' px', () => renderPreview());
bindLabel(els.eraseTolerance, els.eraseToleranceValue, '', () => {
  state.erase.tolerance = Number(els.eraseTolerance.value);
  if (state.erase.enabled) {
    rebuildSource();
    drawCropCanvas();
    renderPreview();
  }
});
els.borderToggle.addEventListener('change', renderPreview);
els.shadowToggle.addEventListener('change', renderPreview);
els.captionText.addEventListener('input', renderPreview);
els.captionColor.addEventListener('input', renderPreview);
els.captionStroke.addEventListener('change', renderPreview);
els.captionPosition.addEventListener('change', renderPreview);
els.eraseToggle.addEventListener('change', () => {
  state.erase.enabled = els.eraseToggle.checked;
  if (state.erase.enabled && !state.erase.color) {
    els.eraseLabel.textContent = 'Click anywhere on the photo to pick the colour to erase.';
  }
  rebuildSource();
  drawCropCanvas();
  renderPreview();
});
els.clearEraseBtn.addEventListener('click', () => {
  state.erase.enabled = false;
  state.erase.color = null;
  els.eraseToggle.checked = false;
  els.eraseLabel.textContent = 'No colour picked yet. Click the photo to pick one.';
  rebuildSource();
  drawCropCanvas();
  renderPreview();
});

/* ---- upload / paste / drop ---- */

els.dropzone.addEventListener('click', () => els.fileInput.click());
els.dropzone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') els.fileInput.click();
});
els.fileInput.addEventListener('change', () => {
  if (els.fileInput.files[0]) loadImageFile(els.fileInput.files[0]);
});
els.sampleBtn.addEventListener('click', loadSample);
els.dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  els.dropzone.classList.add('dragging');
});
els.dropzone.addEventListener('dragleave', () => els.dropzone.classList.remove('dragging'));
els.dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  els.dropzone.classList.remove('dragging');
  if (event.dataTransfer.files[0]) loadImageFile(event.dataTransfer.files[0]);
});
document.addEventListener('paste', (event) => {
  const item = Array.from(event.clipboardData?.items || []).find((i) => i.type.startsWith('image/'));
  if (item) loadImageFile(item.getAsFile());
});

/* ---- download + pack ---- */

function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) {
      toast('WebP export is not supported in this browser.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/webp');
}

els.downloadBtn.addEventListener('click', () => {
  if (!state.sourceCanvas) {
    toast('Add a photo or use the sample photo first.');
    return;
  }
  downloadCanvas(els.previewCanvas, 'stickermint-sticker.webp');
});

function renderPackGrid() {
  els.packCount.textContent = `${state.pack.length}/${MAX_PACK} stickers`;
  els.packEmpty.hidden = state.pack.length > 0;
  els.packGrid.innerHTML = '';
  state.pack.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'pack-card';
    const img = document.createElement('img');
    img.src = item.canvas.toDataURL('image/webp');
    img.alt = item.name;
    const name = document.createElement('p');
    name.textContent = item.name;
    const actions = document.createElement('div');
    actions.className = 'pack-actions';
    actions.innerHTML =
      `<button type="button" data-action="left" data-id="${item.id}" ${index === 0 ? 'disabled' : ''}>Move left</button>` +
      `<button type="button" data-action="right" data-id="${item.id}" ${index === state.pack.length - 1 ? 'disabled' : ''}>Move right</button>` +
      `<button type="button" data-action="download" data-id="${item.id}">Download</button>` +
      `<button type="button" data-action="remove" data-id="${item.id}">Remove</button>`;
    card.append(img, name, actions);
    els.packGrid.appendChild(card);
  });
}

els.addToPackBtn.addEventListener('click', () => {
  if (!state.sourceCanvas) {
    toast('Add a photo or use the sample photo first.');
    return;
  }
  if (!canAddToPack(state.pack.length)) {
    toast(`A pack holds up to ${MAX_PACK} stickers. Remove one to add another.`);
    return;
  }
  const canvas = document.createElement('canvas');
  canvas.width = STICKER_SIZE;
  canvas.height = STICKER_SIZE;
  renderSticker(canvas.getContext('2d'), buildSticker(currentInput()), state.sourceCanvas);
  state.packSeq += 1;
  state.pack.push({ id: state.packSeq, canvas, name: `sticker-${state.packSeq}` });
  renderPackGrid();
  renderPreview();
  toast(`Added to pack (${state.pack.length}/${MAX_PACK}).`);
});

els.packGrid.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const index = state.pack.findIndex((i) => i.id === id);
  if (index === -1) return;
  const action = btn.dataset.action;
  if (action === 'remove') state.pack.splice(index, 1);
  else if (action === 'left') state.pack = moveInPack(state.pack, index, index - 1);
  else if (action === 'right') state.pack = moveInPack(state.pack, index, index + 1);
  else if (action === 'download') downloadCanvas(state.pack[index].canvas, `${state.pack[index].name}.webp`);
  renderPackGrid();
  renderPreview();
});

els.downloadZipBtn.addEventListener('click', async () => {
  if (state.pack.length === 0) {
    toast('Your pack is empty. Add a sticker first.');
    return;
  }
  if (!window.JSZip) {
    toast('ZIP library did not load — downloading stickers one by one instead.');
    state.pack.forEach((item, i) => window.setTimeout(() => downloadCanvas(item.canvas, `${item.name}.webp`), i * 400));
    return;
  }
  const zip = new window.JSZip();
  for (const item of state.pack) {
    const blob = await new Promise((resolve) => item.canvas.toBlob(resolve, 'image/webp'));
    if (blob) zip.file(`${item.name}.webp`, blob);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'stickermint-pack.zip';
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
});

els.clearPackBtn.addEventListener('click', () => {
  state.pack = [];
  renderPackGrid();
  renderPreview();
});

/* ---- init ---- */

setMode('free');
renderPackGrid();
els.statusText.textContent = 'No photo yet — upload one, paste one, or try the sample photo.';
