# threejs-debug-view

<p align="center">
  <img src="assets/logo.svg" alt="threejs-debug-view logo" width="72" height="72" />
</p>

<p align="center"><strong>Debug views for Three.js WebGPU + TSL render pipelines.</strong></p>

<p align="center">
  Use the React-free root export in your own render loop, or drop in <code>DebugViewLayer</code> for a batteries-included R3F overlay.
</p>

[![npm version](https://img.shields.io/npm/v/threejs-debug-view.svg)](https://www.npmjs.com/package/threejs-debug-view)
[![license](https://img.shields.io/npm/l/threejs-debug-view.svg)](./LICENSE)
[![library gzip](https://img.shields.io/badge/library_gzip-30_kB-007ec6)](https://github.com/tonyblu331/threejs-debug-view#bundle-size)

## Install

**WebGPU app (no React):**

```bash
pnpm add threejs-debug-view three
```

**React Three Fiber:**

```bash
pnpm add threejs-debug-view three react react-dom @react-three/fiber @react-three/drei leva
```

The root export is React-free. The `/r3f` adapter needs the R3F and Leva peers above.

## Get started

| Path | Import | Use when |
| --- | --- | --- |
| Headless | `threejs-debug-view` | You own the WebGPU render loop. See the [headless runtime guide](https://tonyblu331.github.io/threejs-debug-view/guides/headless-runtime/). |
| Batteries included | `threejs-debug-view/r3f` → `DebugViewLayer` | You want built-in views, layouts, and Leva controls with minimal setup. |
| Controlled overlay | `threejs-debug-view/r3f` → `DebugViews` + `useDebugViewsControls` | Your app owns UI state or only needs part of the overlay. |

Full walkthrough: [Quick Start](https://tonyblu331.github.io/threejs-debug-view/guides/quick-start/) · [Batteries Included](https://tonyblu331.github.io/threejs-debug-view/guides/batteries-included/) · [Live demo](https://tonyblu331.github.io/threejs-debug-view/demo/)

```tsx
import { DebugViewLayer } from "threejs-debug-view/r3f"

function DebugLayer() {
  if (!import.meta.env.DEV) return null
  return <DebugViewLayer />
}
```

Keep debug views behind a dev flag unless you intentionally expose them in production.

## Status

- WebGPU-first.
- TSL-first.
- React Three Fiber adapter.
- No WebGL fallback right now.
- Not an `EffectComposer` helper.

The runtime uses `three/webgpu`, `three/tsl`, WebGPU MRT passes, and fullscreen `RenderPipeline` composition.

## What It Shows

Built-in debug sources include beauty, normal, depth, base color, material normal, emissive, roughness, AO, metallic, opacity, wireframe, lighting-only, reflection-only, measured overlap, estimated light overlap, and shader complexity.

Material scalars are packed into one RGBA target:

- `R`: roughness
- `G`: metallic
- `B`: AO
- `A`: opacity

Material-normal uses a focused material-detail pass. Emissive shares the reusable scene pass with the packed material scalar views. Wireframe, lighting-only, reflection-only, measured overlap, estimated light overlap, and shader-cost views are created only when the active layout needs them.

Roughness, metallic, AO, opacity, and emissive use shader-side defaults when a material does not support the property. The debug runtime does not patch scene materials to make a view compile. AO reads material-authored AO maps; it is not a screen-space AO buffer unless you provide one as a custom view or pass-backed source.

`shaderCost` is an estimate, not a native GPU instruction counter. It scores materials through source-labeled shader-unit buckets such as ALU proxy work, texture samples, dependent texture risk, branch/discard pressure, bandwidth pressure, and confidence. Measured overlap, estimated light overlap, and render-pass timing are separate diagnostics, not shader-cost inputs.

**Measured Overlap** (`overdraw`) counts translucent and alpha-cutout contributor layers via a depth prepass and blend counter — opaque meshes write depth but do not increment the layer count. **Estimated Light Overlap** (`lightComplexity`) counts point, spot, and rect lights on the default forward renderer (globals and shadows excluded in v1). In the bundled demo overlay, click the viewport on **Shader Complexity** or **Measured Overlap** to sample a pixel and read the legend marker. Demo tabs: **Overlap** (`?scene=overdraw`) and **Lights** (`?scene=lights`).

The demo overlay hides the Leva `Enabled` toggle because the demo is always showing debug views. Pass `showEnabledControl={false}` to `DebugViewLayer` to match that behavior.

## Presentation Routing

`DebugViews` routes presentation from the props you provide. Simple layouts and pane assignments use the fullscreen TSL compositor. When a pane needs a custom camera or `resolutionScale`, it uses viewport/scissor presentation.

`layout` and `paneCount` define the pane geometry. `viewportViews` assigns content to those panes. Use `split-diagonal` with `diagonalAngle` for a two-pane slanted split, or `breakdown` for a four-view diagonal material breakdown. Diagonal layouts clamp to `45` degrees by default; `breakdown` starts at `25` degrees.

```tsx
<DebugViews
  views={DEFAULT_DEBUG_VIEWS}
  viewportViews={[
    { view: "beauty", label: "Beauty" },
    { view: "lightingOnly", label: "Lighting" },
    { view: "normal", label: "Normals", resolutionScale: 0.5 },
    { view: "roughness", label: "Roughness", resolutionScale: 0.5 },
  ]}
  layout="row"
  paneCount={4}
  showLabels
/>
```

`resolutionScale` is quantized to `1`, `0.5`, or `0.25` so render targets stay predictable.

## Custom TSL Views

```tsx
import { float, vec4 } from "three/tsl"
import { createCustomDebugView, DEFAULT_DEBUG_VIEWS } from "threejs-debug-view"
import { DebugViews } from "threejs-debug-view/r3f"

const fresnelView = createCustomDebugView({
  id: "shader:fresnel",
  label: "Fresnel",
  node: vec4(float(1), float(0), float(0), float(1)),
})

<DebugViews views={[...DEFAULT_DEBUG_VIEWS, fresnelView]} />
```

Use a stable `id` when a custom node can be recreated between React renders. The viewport render graph uses that id in stable pass keys.
The compose runtime also tracks custom node identity so replacing the node instance rebuilds the pipeline instead of keeping stale shader code.

## Project Shape

- `components/debug-views/` is the package source.
- `threejs-debug-view` exports debug view definitions, render planning, TSL helpers, and headless WebGPU runtime (`createDebugPipelineRuntime`, `createDebugViewportRenderer`, `requiresViewportRuntime`).
- `threejs-debug-view/r3f` exports the batteries-included `DebugViewLayer`, the lower-level `DebugViews` component, and Leva controls.
- `src/` is the local demo app only; it is not published to npm.
- `packages/docs/` is the Astro documentation site and hosted demo build output; it is not published to npm.
- The npm tarball ships only `dist/`, `LICENSE`, and `README.md`. Run `pnpm pack:check` before publishing.

## Verification

```bash
pnpm verify
```

For runtime-facing WebGPU or demo changes, also run the Playwright demo checks and smoke-test the Vite demo in a browser with native WebGPU support:

```bash
pnpm test:e2e
pnpm dev
```

The e2e suite keeps CI strict: if Chromium cannot start the WebGPU demo in CI, the test fails instead of silently accepting the fallback gate.

## Bundle size

The npm badge reports the gzipped size of the published ESM files in `dist/` (~30 kB). Peer dependencies such as `three`, `react`, `react-dom`, and `@react-three/fiber` are excluded. Bundlephobia does not reliably analyze this package because of WebGPU/TSL peer imports, so the badge is measured locally via `pnpm pack:check`.
