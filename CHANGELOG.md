# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.7] - 2026-06-08

### Added
- Package logo (`assets/logo.svg`) for README, npm, and Starlight docs.
- Starlight guide explaining the batteries-included `/r3f` path, controlled overlay, React-free core, and unpublished demo/docs split.

### Changed
- README and docs homepage now lead with batteries-included positioning and logo branding.

## [0.2.6] - 2026-06-08

### Fixed
- Replaced the broken Bundlephobia badge with a measured library gzip badge validated during `pnpm pack:check`.

## [0.2.5] - 2026-06-08

### Added
- Click-to-sample shader cost inspector in the demo overlay with a centered viewport crosshair and legend marker synced to the clicked pixel.
- `showEnabledControl` on `DebugViewLayer` to hide the Leva `Enabled` toggle when debug views should always stay mounted.
- `pack:check` script to fail releases when the npm tarball includes demo, docs, or other non-library files.

### Changed
- Renamed the built-in `shaderCost` label from **Estimated Shader Complexity** to **Shader Cost**.
- Separated overlap and shader-cost legend UI so multi-pane layouts can show both diagnostics without shared ramp styling.
- Default `breakdown` diagonal angle is now `25` degrees instead of `35`.
- Release workflow publishes to GitHub Packages in addition to npm.

## [0.2.4] - 2026-06-08

### Changed
- Removed README image dependencies from the published package.

## [0.2.3] - 2026-06-08

### Changed
- Reduced the published npm package by excluding non-runtime image assets.

## [0.2.2] - 2026-06-08

### Added
- Added diagonal split layouts, including a four-pane `breakdown` layout for material review views.
- Added Leva controls for diagonal layout angle and breakdown pane assignments.

### Fixed
- Improved composed layout routing for pane assignments and diagonal presentations.
- Stabilized demo asset loading for the live documentation demo.

## [0.2.1] - 2026-06-05

### Added
- Documented the calibrated shader complexity and GPU timing roadmap.

### Changed
- Refactored shader complexity scoring around structured material features and prediction.

### Fixed
- Accounted for alpha-hashed and risky basic-material render states in shader complexity scoring.
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
