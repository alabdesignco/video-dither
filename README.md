# video-dither

Full-viewport WebGL dithered video effect using Three.js and a custom fragment shader.

The demo uses:

- Bayer 8×8 ordered dithering
- Inverted luminance (light background, dark ink)
- Breathing bias animation (noise + pulse)
- Idle sway + mouse ripple

This repo is designed to be:

- Run locally with Vite
- Deployed to Vercel
- Embedded into Webflow via a single `app.js` script and a `data-dither` attribute

---

## 1. Local development

```bash
npm install
npm run dev
```

Then open the printed `http://localhost:5173` (or similar) URL.

Key files:

- `src/main.js` – Three.js scene, shader, GUI, FPS cap
- `assets/candle.mp4` – baked-in video source

---

## 2. Build & deploy (Vercel)

Build:

```bash
npm run build
```

The static site will be in `dist/`. You can deploy this folder to Vercel as a standard Vite app.

Default expectations:

- The app serves `index.html` at `/`
- The video lives at `/assets/candle.mp4`

You can adjust this to your preferred Vercel project setup if needed.

---

## 3. Using as a script from Webflow

The intended integration model is:

- Host this app on Vercel
- Expose a bundled `app.js` script from that app
- Load that script in Webflow and trigger it via `data-dither`

### 3.1. Webflow markup

In Webflow Designer, add a `div` where you want the effect:

```html
<div data-dither></div>
```

Make sure the parent has an explicit height (e.g. via a section or utility class), since the canvas will fill the container.

### 3.2. Webflow custom code

In **Project Settings → Custom Code → Before `</body>`**, load the script hosted by this app (example path shown; update to your Vercel domain + script path):

```html
<script src="https://your-vercel-app.vercel.app/app.js" type="module"></script>
```

`app.js` should:

- Find all elements with `[data-dither]`
- Create a `<canvas>` and `<video>` inside each container
- Use the baked-in video URL (e.g. `/assets/candle.mp4` served by your Vercel app)
- Initialize the Three.js renderer and shader effect

One container can host one instance of the effect; add multiple `data-dither` divs if you need more.

---

## 4. Shader controls & performance

The shader exposes a number of uniforms (see `CLAUDE.md` for full reference). In the dev build:

- A hidden lil-gui instance controls:
  - Dither / breathing / ripple parameters
  - FPS cap (0 / 15 / 24 / 30 / 45 / 60)
- FPS and scale (effective DPR) are measured and shown in the GUI

Defaults:

- FPS cap: `24` (film-like, good trade-off between look and cost)
- `devicePixelRatio` capped at `2` to avoid 3× blowups on HiDPI screens

---

## 5. Notes

- `assets/` is committed on purpose so the demo is reproducible.
- `CLAUDE.md` documents shader design decisions and uniform meanings.

