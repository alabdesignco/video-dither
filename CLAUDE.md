# dither-alab

Standalone WebGL dither effect demo.

## Project Structure

```
dither-alab/
├── index.html       — Vite entry HTML
├── src/
│   ├── main.js      — Three.js scene, shader, GUI
│   └── style.css    — base layout and GUI styling
├── assets/
│   └── candle.mp4   — source video input
├── vite.config.js   — Vite config
└── package.json     — scripts and dependencies
```

## What It Does

Full-viewport dithered video renderer using vanilla Three.js (no framework, no build step). The flame video is rendered through a custom GLSL fragment shader that:

1. **Inverts luminance** — bright flames become dark ink, dark background becomes light
2. **Bayer 8×8 ordered dithering** — reduces video to 2 colors
3. **Breathing bias** — cheap 2D hash noise + sine pulse animates the dither threshold over time
4. **Idle sway** — gentle sine-wave UV displacement, always running
5. **Mouse ripple** — radial sine-wave UV distortion around the cursor (desktop only)
6. **Cover-fit UV** — `object-fit: cover` equivalent in GLSL for any screen size

## Key Technical Decisions

- **Vanilla Three.js via CDN importmap** — no build step, drops into any HTML page
- **Single render pass** — no FBO/ping-pong, one draw call per frame
- **2D hash noise** instead of 3D Perlin — ~10× cheaper per pixel, visually equivalent for this use case
- **`pointer: fine` media query** — ripple effect disabled on touch devices (tablet/mobile)
- **`loadedmetadata`** — video aspect ratio read from actual video dimensions, not hardcoded
- **`devicePixelRatio` capped at 2** — prevents 3× pixel blowup on high-DPI screens

## Colors

| Token | Hex | Role |
|---|---|---|
| Ink | `#0E0E0E` | Dark dither color |
| Background | `#E8E2DA` | Light dither color + page bg |

## Uniforms Reference

### Dither
| Uniform | Default | Description |
|---|---|---|
| `uBias` | `0.08` | Base dither threshold offset |
| `uNoiseScale` | `1.4` | Spatial scale of bias noise |
| `uNoiseSpeed` | `0.3` | Time speed of bias noise |
| `uNoiseWeight` | `0.77` | Noise contribution to bias animation |
| `uPulseSpeed` | `3.1` | Sine pulse frequency |
| `uPulseWeight` | `0.87` | Pulse contribution to bias animation |
| `uAnimStrength` | `0.22` | Master multiplier for bias breathing |

### Ripple
| Uniform | Default | Description |
|---|---|---|
| `uRippleRadius` | `0.35` | Radius of cursor effect zone |
| `uRippleStrength` | `0.018` | UV displacement amplitude |
| `uRippleFreq` | `18.0` | Concentric ring frequency |
| `uRippleSpeed` | `4.0` | Ring animation speed outward |
| `uIdleSway` | `0.006` | Idle sway amplitude |
| `uIdleSpeed` | `1.8` | Idle sway oscillation speed |

## Reference

- **Three.js**: `0.169.0` via CDN
- **lil-gui**: `0.19` via CDN (debug GUI only, remove for production)

## To Embed in Webflow

1. Remove the `<link>` and `<script>` for lil-gui
2. Host `flame.mp4` on a CDN (Cloudflare R2, etc.)
3. Add a `<div id="dither-canvas">` to the Webflow page
4. Mount the renderer into that div instead of full viewport:
   ```js
   const container = document.getElementById('dither-canvas');
   renderer.setSize(container.offsetWidth, container.offsetHeight);
   container.appendChild(renderer.domElement);
   ```
5. Paste the `<script type="importmap">` and `<script type="module">` blocks into Webflow's **Before `</body>`** custom code field
