# Scene Engine

A small, dependency-free (Three.js vendored) engine for **first-person, explorable 3D business scenes**.
The visitor looks around (drag / touch / mouse), walks (arrow keys / WASD / on-screen pad) and clicks glowing
hotspots that fly the camera in and open an info panel with live content, CTAs and links to the rest of the site.

```
scene-engine/
  engine.js          generic: renderer, lights, camera rig, picking, hotspots, panels, tour chips, UI
  engine.css         generic UI skin (re-themable via config.theme)
  props-hd.js        photoreal-leaning prop library (PBR materials, real glass, lawn, cart, bar props)
  props.js           stylized low-poly prop library + shared helpers (canvasTex…)
  vendor/            three.module.min.js (r160) + the example add-ons used for post-processing
  assets/            logo, env/*.hdr (lighting panorama), textures/ (see assets/CREDITS.md)
  scenes/
    distinct-coffee.js   ← the ONLY business-specific file
explore.html         page shell that mounts a scene
```

No build step: native ES modules. Serve the folder over HTTP (opening via `file://` won't load modules).

## Mounting a scene

```html
<link rel="stylesheet" href="scene-engine/engine.css" />
<div id="stage"></div>
<script type="module">
  import { SceneEngine } from './scene-engine/engine.js';
  import scene from './scene-engine/scenes/my-business.js';
  new SceneEngine(document.getElementById('stage'), scene).start();
</script>
```

`explore.html` is a complete example. `window.__scene` exposes the running engine (handy for debugging).

## Making a scene for a new business

1. Copy `scenes/distinct-coffee.js` to `scenes/<business>.js`.
2. Change `id`, `title`, `ui.logo`, `theme`, and the `world` look (sky, fog, sun).
3. Replace `load()` with that business's data (any async fetch: Supabase, REST, static JSON). Whatever it returns is passed to `build()` as `data`.
4. In `build()`, compose the set from `props.js` (positions in **metres**, y up, the visitor stands near z+ looking toward −z).
5. Declare hotspots (below). Order = guided-tour order (chips, ←/→ keys).
6. Add a page that mounts it (copy `explore.html`).

### Config

```js
export default {
  id, title,
  ui:     { logo, exit: { label, href }, loading },
  theme:  { bg, accent, font },                       // → --se-* CSS variables
  world:  { hdr: 'path/to/pano.hdr',                 // photographic lighting + reflections + backdrop
            backgroundBlur, backgroundIntensity, envIntensity, exposure, fog, fogNear, fogFar,
            sun: { position, color, intensity, extent, far },   // should match the sun in the panorama
            low: { … } },                             // overrides for the low quality tier
            // without `hdr` the engine falls back to the stylized sky: { skyTop, horizon, hemi, … }
  post:   { ao: { radius, intensity }, dof: { aperture, focusAperture, maxblur },
            bloom: { strength, radius, threshold } }, // high tier only; omit a key or set false to disable
  quality: 'high' | 'low',                            // optional; default = low on touch devices
  camera: { fov, start: { from:[x,y,z], to:[x,y,z] }, startPortrait: { from, to },
            focusPoint: [x,y,z],                       // what depth-of-field keeps sharp while roaming
            bounds: { minX, maxX, minZ, maxZ },        // walkable area
            colliders: [{ minX, maxX, minZ, maxZ }],   // things you can't walk through
            lookYaw, lookPitch, speed },
  async load() { return {…} },                         // optional; result → data
  build(ctx) { … },                                    // create objects + hotspots
};
```

`ctx` = `{ THREE, props, hd, quality, esc, scene, renderer, camera, engine, data, hotspot(def), animate(fn) }`.
`animate((dt, t) => …)` registers a per-frame callback. Use `esc()` on any live text you put in panel HTML.

### Hotspots

```js
hotspot({
  id: 'menu',
  label: 'The Menu',               // chip + marker tooltip
  object: someMesh,                // glows on hover; its bounds are the click target
  marker: [x, y, z],               // where the pulsing dot floats
  hitPad: 0.05,                    // optional: grow the click target
  focus: { from: [x,y,z], to: [x,y,z], fov: 42 },   // camera pose when opened
  panel: {
    eyebrow: 'The Menu', title: 'Crafted with intention',
    html: () => '<p>…</p>',        // string or function (re-run on open → fresh data)
    ctas: [{ label: 'Order', href: 'order.html' }, { label: 'More', href: '/#about' }],   // 1st = solid, rest = outlined; add external: true for new-tab links
  },
});
```

Inside panel HTML, `<a data-hotspot="events">…</a>` jumps to another hotspot. Helpful classes: `.row`
(name/price rows), `.tag`, `.event`, `h4`.

### Rendering quality

Two tiers, picked automatically (override with `?quality=high|low` in the URL):

- **high** (desktop): HDR image-based lighting, 4096 soft shadows, ambient occlusion, depth of field that follows
  the camera's focus, bloom, filmic tone mapping, true refractive glass. If the first ~90 frames average under
  ~22 fps the engine drops post-processing by itself.
- **low** (touch devices): same HDR lighting, materials and models; no post-processing, cheaper glass, less grass.

Debug switches: `?off=ao,dof,bloom` (or `?off=post`), `?nodegrade`.
Objects can opt out of helper passes with `userData.noAO` / `userData.noDofDepth`.

To relight a scene, swap `world.hdr` for another equirectangular `.hdr` (Poly Haven has free CC0 ones — a 1k file
is plenty) and point `world.sun.position` at the sun in that panorama.

### HD props (`props-hd.js`)

Scenery: `lawn` (photo-textured ground + instanced wind-blown grass), `tree`, `treeLine`, `canopyTent`.
Bar/cart: `cart` (marble top, acrylic sign on standoffs, casters), `barMat`, `cupStack`, `icedCup`, `pumpBottle`,
`strawGlass`, `brewPot`, `syrupBottle`, `espressoMachine`, `towelStack`, `pitcher`, `organizer`, `beanJar`,
`menuDisplay`, `cardStand`, `aFrame`, `pendant`, `plant`.
Materials: `M.steel()`, `M.marble()`, `M.blackPaint()`, `M.gold()`…, `glass({ liquid })`, `clearShell()`.
Textures: `marbleTex`, `brushedTex`, `spunTex`, `noiseTex`, `grassTex`.
For hero objects that must match a real product exactly, load a glTF model instead and add it to the scene the same way.

### Stylized props (`props.js`)

Every builder returns a `THREE.Group`. Scenery: `ground, tree, palm, pavilion, stringLights, popupTent, aFrame, lantern, walkers/stepWalker, person`.
Cafe: `cart, barMat, can, waterBottle, beanJar, stockPot, kettle, syrupBottle, espressoMachine, bowlAndTowel, speaker, tabletDisplay, loyaltyCard`.
Helpers: `mat, box, cyl, sphere, lathe, rod, canvasTex, redrawTex, createSky`.
`canvasTex(w, h, draw)` makes a texture from a 2D canvas — that's how live menus, signs, labels and chalkboards are painted onto 3D surfaces.

New business types (salon, bakery, workshop…) mostly need a few new props added to this file; the engine does not change.

## Behaviour notes

- Hotspot markers can be hidden with the "Dots" button; the tour chips always work.
- Mobile: panel becomes a bottom sheet; the subject is shifted above it via `camera.setViewOffset`.
- Falls back to a friendly message (with a link back to the main site) when WebGL is unavailable.
- Honors `prefers-reduced-motion`.
- If a device struggles it is moved off post-processing automatically; force it with `quality: 'low'` in the config.
