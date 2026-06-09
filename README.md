# threejs-debug-view

<p align="center">
  <img src="assets/logo.svg" alt="threejs-debug-view logo" width="72" height="72" />
</p>

<p align="center"><strong>Debug views for Three.js WebGPU + TSL render pipelines.</strong></p>

<p align="center">
  Native WebGPU runtime first; optional R3F adapter via <code>DebugViewLayer</code>.
</p>

[![npm version](https://img.shields.io/npm/v/threejs-debug-view.svg)](https://www.npmjs.com/package/threejs-debug-view)
[![license](https://img.shields.io/npm/l/threejs-debug-view.svg)](./LICENSE)
[![library gzip](https://img.shields.io/badge/library_gzip-30_kB-007ec6)](https://github.com/tonyblu331/threejs-debug-view#bundle-size)

**Docs:** [Starlight site](https://tonyblu331.github.io/threejs-debug-view/) · [Live demo](https://tonyblu331.github.io/threejs-debug-view/demo/)

## Install

**Native:**

```bash
pnpm add threejs-debug-view three
```

**R3F** (optional adapter):

```bash
pnpm add threejs-debug-view three react react-dom @react-three/fiber @react-three/drei leva
```

The root export is the main path. `/r3f` needs the peers above.

## Get started

| Path | Import | Use when |
| --- | --- | --- |
| Native | `threejs-debug-view` | You own the WebGPU render loop. |
| R3F | `threejs-debug-view/r3f` → `DebugViewLayer` | Optional adapter with built-in views, layouts, and Leva. |
| Controlled R3F | `threejs-debug-view/r3f` → `DebugViews` + `useDebugViewsControls` | Your app owns UI state or part of the surface. |

Guides: [Quick Start](https://tonyblu331.github.io/threejs-debug-view/guides/quick-start/) · [Native Runtime](https://tonyblu331.github.io/threejs-debug-view/guides/headless-runtime/) · [R3F](https://tonyblu331.github.io/threejs-debug-view/guides/batteries-included/)

**Native** — wire into your frame loop:

```ts
import {
  DEFAULT_DEBUG_VIEWS,
  createDebugRenderPlan,
  createDebugPipelineRuntime,
  createDebugViewUniforms,
  resolveDebugViewLayout,
  updateDebugViewUniforms,
} from "threejs-debug-view"

const layout = resolveDebugViewLayout("single")
const plan = createDebugRenderPlan(DEFAULT_DEBUG_VIEWS, 0, layout)
const uniforms = createDebugViewUniforms()
const runtime = createDebugPipelineRuntime(scene, camera, plan, layout, renderer, uniforms)

function animate() {
  updateDebugViewUniforms(uniforms, plan.activePipelineView, layout, plan.pipelineViews.length, 1)
  runtime.pipeline.render()
  requestAnimationFrame(animate)
}
```

**R3F** (optional) — drop in inside `<Canvas>`:

```tsx
import { DebugViewLayer } from "threejs-debug-view/r3f"

function DebugLayer() {
  if (!import.meta.env.DEV) return null
  return <DebugViewLayer />
}
```

Keep debug views behind a dev flag unless you intentionally ship them in production.

## Built-in views

`DEFAULT_DEBUG_VIEWS` ships sixteen named sources. Override and heatmap passes are **demand-driven**: they render only when the active view or layout needs them.

| Source | Mode | What it shows |
| --- | --- | --- |
| `beauty` | passthrough | Final lit color |
| `normal` | passthrough | View-space geometry normals |
| `depth` | depth | View-space depth |
| `albedo` | passthrough | Base color without lighting |
| `materialNormal` | passthrough | Material normal map output |
| `emissive` | passthrough | Emissive color |
| `roughness` | passthrough | Packed scalar (`R` of material target) |
| `metallic` | passthrough | Packed scalar (`G`) |
| `ao` | passthrough | Packed scalar (`B`); material AO, not SSAO |
| `opacity` | passthrough | Packed scalar (`A`) |
| `wireframe` | passthrough | Wireframe override pass |
| `lightingOnly` | passthrough | Neutral lighting-only override |
| `reflectionOnly` | passthrough | Reflection-only override |
| `overdraw` | heatmap | Measured contributor layer count |
| `lightComplexity` | heatmap | Light overlap (v1 analytic counter) |
| `shaderCost` | heatmap | Shader-cost estimate (not native GPU counters) |

Full tables and pass behavior: [Built-in Views](https://tonyblu331.github.io/threejs-debug-view/guides/built-in-views/) · [Overlap & light diagnostics](https://tonyblu331.github.io/threejs-debug-view/guides/overlap-and-light-diagnostics/) · [Shader cost](https://tonyblu331.github.io/threejs-debug-view/guides/shader-cost-heatmap/)

Unsupported material properties use shader-side defaults; the runtime does not patch scene materials to force a view to compile.

## Custom debug view

Add a TSL `node` view, or use `createCustomDebugView()` when React may recreate the node and you need a stable render-graph `id`:

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

Pass-backed views that need their own target, material override, or camera belong in a dedicated pass — not forced into `node`. Details: [Custom Debug Views](https://tonyblu331.github.io/threejs-debug-view/guides/custom-debug-views/).

## Documentation site

User docs live in `packages/docs/` (Astro + Starlight). They are not published to npm.

```bash
pnpm docs:dev      # local Starlight dev server
pnpm docs:build    # production build (included in verify)
pnpm docs:preview  # preview the built site
```

Hosted at [tonyblu331.github.io/threejs-debug-view](https://tonyblu331.github.io/threejs-debug-view/).

## Quality gates

| Gate | Command | What it checks |
| --- | --- | --- |
| Typecheck | `pnpm typecheck` | TypeScript across library + demo |
| Unit tests | `pnpm test` | Vitest (render plans, views, helpers) |
| Library build | `pnpm build` | ESM `dist/` + declaration emit |
| npm surface | `pnpm pack:check` | Tarball contains only `dist/`, logo, LICENSE, README; bundle badge |
| Docs build | `pnpm docs:build` | Starlight site compiles |
| Full verify | `pnpm verify` | All of the above |
| E2E demo | `pnpm test:e2e` | Playwright against the Vite demo (WebGPU required; fails in CI without it) |

For WebGPU or demo changes, run `pnpm test:e2e` and smoke-test `pnpm dev` in a browser with native WebGPU.

## Project shape

- `components/debug-views/` — library source
- `threejs-debug-view` — view definitions, render planning, TSL helpers, native runtime
- `threejs-debug-view/r3f` — `DebugViewLayer`, `DebugViews`, Leva controls
- `src/` — local demo (not on npm)
- `packages/docs/` — Starlight docs + hosted demo build output (not on npm)

The npm tarball ships `dist/`, `assets/logo.svg`, `LICENSE`, and `README.md` only.

## Status

- WebGPU-first, TSL-first, no WebGL fallback
- Not an `EffectComposer` helper
- Uses `three/webgpu`, `three/tsl`, WebGPU MRT passes, and fullscreen `RenderPipeline` composition

## Bundle size

The badge reports gzipped published ESM in `dist/` (~30 kB). Peers (`three`, React, R3F, Leva) are excluded. Measured locally via `pnpm pack:check` because Bundlephobia does not reliably analyze WebGPU/TSL peer imports.
