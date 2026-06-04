# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-06-05

### Fixed
- Kept the demo debug overlay dev-only by default.

## [0.2.0] - 2026-06-05

### Changed
- Consolidated the React Three Fiber adapter under `threejs-debug-view/r3f`.

### Breaking
- Replace `threejs-debug-view/react` and `threejs-debug-view/react-controls` imports with `threejs-debug-view/r3f`.

## [0.1.2] - 2026-06-05

### Added
- Dedicated controls entrypoint for Leva-only imports.

### Changed
- Renamed the public package, docs, repository links, and shipped README assets to `threejs-debug-view`.
- Improved shader complexity texture-resolution weighting to account for width, height, and texel count.

### Fixed
- Invalidated shader complexity cache entries when texture dimensions, custom shader uniform counts, or physical material feature toggles change.
- Preserved distinct shader-cost buckets for standard and physical material families.

## [0.1.1] - 2026-06-03

### Added
- Composable TSL debug views for Three.js WebGPU render pipelines.
- Production-ready, zero-overhead estimated shader complexity engine (`shaderCost`).
- Declarative property evaluation for shader cost (texture resolution/type weighting, pipeline breakers, advanced optics).
- Bounded LRU cache (max 1000 entries) and aggressive early exits for render-loop safety.
- Starlight documentation site with live built-in views demo.
- Viewport render graph with stable pane assignments and scissor-based presentation.
- Optimized material view pipeline (lighting-only, reflection-only, wireframe).

### Changed
- Replaced fragile regex/source parsing with robust, declarative property evaluation.
- Enforced strict TypeScript boundaries, eliminating unsafe type casts.
- Packed material data into a single RGBA target to respect WebGPU `maxColorAttachmentBytesPerSample` limits.

### Fixed
- Resolved asset paths for Vite base path compatibility.
- Corrected TSL imports and type issues for WebGPU-first renderer.
- Switched to procedural environment (Lightformers) for WebGPU compatibility.
