# Scene Engine

A small, dependency-free (Three.js vendored) engine for **first-person, explorable 3D business scenes**.
The visitor looks around (drag / touch / mouse), walks (arrow keys / WASD / on-screen pad) and clicks glowing
hotspots that fly the camera in and open an info panel with live content, CTAs and links to the rest of the site.

```
scene-engine/
  engine.js          generic: renderer, lights, camera rig, picking, hotspots, panels, tour chips, UI
  engine.css         generic UI skin (re-themable via config.theme)
  props.js           reusable low-poly prop library (tent, cart, people, trees, bottles, signs…)
  vendor/            three.module.min.js (r160) + license
  assets/            logo etc.
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
  world:  { skyTop, horizon, fogNear, fogFar, hemi, envIntensity, exposure,
            sun: { position, intensity, extent } },
  camera: { fov, start: { from:[x,y,z], to:[x,y,z] },
            bounds: { minX, maxX, minZ, maxZ },        // walkable area
            colliders: [{ minX, maxX, minZ, maxZ }],   // things you can't walk through
            lookYaw, lookPitch, speed },
  async load() { return {…} },                         // optional; result → data
  build(ctx) { … },                                    // create objects + hotspots
};
```

`ctx` = `{ THREE, props, esc, scene, renderer, camera, engine, data, hotspot(def), animate(fn) }`.
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

### Props (`props.js`)

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
- If a device struggles, lower the pixel ratio cap / shadows in `engine.js` (`setupWorld`).
