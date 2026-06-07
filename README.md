# threejs-debug-view

[![npm version](https://img.shields.io/npm/v/threejs-debug-view.svg)](https://www.npmjs.com/package/threejs-debug-view)
[![license](https://img.shields.io/npm/l/threejs-debug-view.svg)](./LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/threejs-debug-view.svg)](https://bundlephobia.com/package/threejs-debug-view)

Small debug views for Three.js WebGPU + TSL render pipelines.

It lets you inspect what your scene is producing while you build: beauty, normals, depth, material channels, override views, and estimated shader complexity. It is focused on WebGPU debugging, not on being a full scene inspector.

![threejs-debug-view composed viewport banner](https://cdn.jsdelivr.net/npm/threejs-debug-view@0.2.0/assets/readme-debug-view-banner.png)

## Install

```bash
pnpm add threejs-debug-view three react react-dom @react-three/fiber @react-three/drei leva
```

The root package is React-free. The `threejs-debug-view/r3f` adapter needs the React Three Fiber and Leva peers shown above.

## Status

- WebGPU-first.
- TSL-first.
- React Three Fiber adapter.
- No WebGL fallback right now.
- Not an `EffectComposer` helper.

The runtime uses `three/webgpu`, `three/tsl`, WebGPU MRT passes, and fullscreen `RenderPipeline` composition.

## Quick Start

```tsx
import { DebugViewLayer } from "threejs-debug-view/r3f"

function DebugLayer() {
  if (!import.meta.env.DEV) return null
  return <DebugViewLayer />
}
```

Keep the overlay behind your app's dev flag. The package is publishable, but debug views should not be mounted in production unless you intentionally expose them.

## What It Shows

Built-in debug sources include beauty, normal, depth, base color, material normal, emissive, roughness, AO, metallic, opacity, wireframe, lighting-only, reflection-only, overlap, and estimated shader complexity.

Material scalars are packed into one RGBA target:

- `R`: roughness
- `G`: metallic
- `B`: AO
- `A`: opacity

Material-normal uses a focused material-detail pass. Emissive shares the reusable scene pass with the packed material scalar views. Wireframe, lighting-only, reflection-only, overlap, and shader-cost views are created only when the active layout needs them.

Roughness, metallic, AO, opacity, and emissive use shader-side defaults when a material does not support the property. The debug runtime does not patch scene materials to make a view compile. AO reads material-authored AO maps; it is not a screen-space AO buffer unless you provide one as a custom view or pass-backed source.

`shaderCost` is an estimate, not a native GPU instruction counter. It scores materials through source-labeled shader-unit buckets such as ALU proxy work, texture samples, dependent texture risk, branch/discard pressure, bandwidth pressure, and confidence. Overlap and render-pass timing are separate diagnostics, not shader-cost inputs.

## Render Modes

`DebugViews` has two modes:

- `compose`: one fullscreen TSL output for single, overlay, split, row, column, and grid layouts.
- `viewport`: explicit viewport assignment with labels, per-pane resolution scale, and scissor-based presentation.

`layout` and `paneCount` define the pane geometry. `viewportViews` assigns content to those panes.

```tsx
<DebugViews
  mode="viewport"
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

Use a stable `id` when a custom node can be recreated between React renders. The viewport render graph uses that id to dedupe equivalent custom views.
The compose runtime also tracks custom node identity so replacing the node instance rebuilds the pipeline instead of keeping stale shader code.

## Project Shape

- `components/debug-views/` is the package source.
- `threejs-debug-view` exports debug view definitions, planning utilities, TSL helpers, and public types.
- `threejs-debug-view/r3f` exports the batteries-included `DebugViewLayer`, the lower-level `DebugViews` component, and Leva controls.
- `src/` is the local demo app.
- `packages/docs/` is the Astro documentation site.

## Verification

```bash
pnpm verify
```

For runtime-facing WebGPU changes, also smoke-test the Vite demo in a browser with WebGPU support:

```bash
pnpm dev
```
