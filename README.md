# StickerMint

**Live:** https://stickermint-app.vercel.app

I kept making one-off stickers for friends by screenshotting photos and
cropping them in my phone's gallery, and the results always came out
blurry, the wrong size, or with half the caption cut off. WhatsApp wants
stickers at exactly 512 x 512 WebP, and nothing I had on hand produced
that reliably. So I built the tool I actually wanted: open a photo, drag
a crop box, type a caption, and get a proper sticker file out.

## Try it in 30 seconds

1. Open the site and press **Try the built-in sample photo instead**
   (no file needed to see it work).
2. Drag the red crop box, or switch to **Square** or **Rounded**.
3. Type a caption, drag it on the preview to where you want it.
4. Press **Download this sticker (WebP)** — or **Add to pack** and keep
   going until you have up to 30, then **Download pack as ZIP**.

## What it does

- **Upload any way you like:** file picker, drag and drop, or paste
  (Ctrl+V). JPG, PNG and WebP photos work.
- **Interactive crop:** drag the box to move it, drag a corner to
  resize it. Free, square, and rounded modes, with an adjustable corner
  radius in rounded mode.
- **Exact output:** every sticker is 512 x 512 WebP, with an optional
  white border (adjustable width, on by default) and a soft shadow
  toggle.
- **Captions:** text, size, colour, dark outline, and top / bottom /
  center presets — or drag the caption anywhere on the preview for a
  custom position.
- **Erase-by-colour assist:** click the photo to pick a colour, then
  adjust tolerance. It removes that colour where it touches the photo
  edges. I labelled it an assist on purpose (see below).
- **Packs:** up to 30 stickers, reorder or remove any of them, download
  one at a time or the whole pack as a ZIP.

## What it does not do (yet)

- The erase assist is **not** an AI cutout. It only handles fairly
  uniform colours connected to the edges. Busy backgrounds, hair, and
  gradients will not cut out cleanly, and there is no manual cleanup
  brush yet — that is the biggest gap, and the one I would add first.
- It does not publish to WhatsApp. You get the WebP files; importing
  them into WhatsApp still needs a sticker app or WhatsApp's own import
  flow.
- It exports WebP only, because that is the format WhatsApp stickers
  use. Very old browsers that cannot export WebP will get an honest
  error instead of a broken file.
- Photos over 2000 px on the longest side are scaled down first, to
  keep the editor fast. HEIC photos from some phones will not open in
  most browsers — convert to JPG first.

## How it works, technically

Everything runs in the browser with vanilla JavaScript (ES modules, no
build step, no backend). The only third-party code is JSZip 3.10.1 from
cdnjs, pinned by version, used for the ZIP download — and if that CDN
is unreachable, the app falls back to downloading stickers one by one.

The code is split so the pipeline is testable: `js/geometry.js` (crop
and caption maths), `js/pixels.js` (the erase assist on raw RGBA data),
and `js/render.js` (the single 512 x 512 render path, including the one
function that assembles a sticker object, so the producer and the
renderer can never disagree about field names). `js/app.js` is only UI
wiring. The harness that checks all of this lives outside this repo, in
the pipeline notes.

## Privacy

Your photos are processed locally in your browser and never uploaded.
There is no account, no analytics, and no server receiving your images
— there is no server at all.

## Running it locally

Any static file server works, for example:

```
npx serve .
```

or just open `index.html` — except the ES module imports need to be
served over HTTP, so a local server is the reliable route.

## License

MIT — see [LICENSE](LICENSE).
