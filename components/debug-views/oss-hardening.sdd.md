# SDD: OSS Hardening

## Intent

Make `threejs-debug-view` credible as a public package, not just a working local demo. The core architecture is already strong; this plan hardens contributor trust, release confidence, repository hygiene, and consumer-facing verification.

## Current Truth

The package has a good architectural split:

- pure planning modules for layouts, viewport cells, labels, presenters, and render graph planning
- TSL compositor and visualization helpers
- React/R3F runtime isolated behind the `/react` entrypoint
- Astro documentation and a Vite demo

The weak spots are OSS-operational:

- root npm scripts used a local Windows Node path
- CI deployed docs but did not prove package quality on PRs
- generated scratch images and logs could leak into repo state
- the README explained usage but did not make the package/demo/docs boundary explicit enough
- runtime smoke verification was implicit instead of named

## Contract

### Package portability

Project scripts must run through package-manager binaries (`vite`, `tsc`, `vitest`) instead of absolute machine paths.

### CI trust

Pull requests and master pushes must run:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm docs:build
```

Docs deployment remains a separate publishing concern.

### Repository hygiene

Generated scratch outputs must stay out of the public repo. Durable README assets live in `assets/`; temporary concept-generation outputs live outside source control.

### Architecture communication

Public docs should describe the package shape:

- root export: core helpers and types
- `/react` export: React/R3F integration
- `src/`: demo app only
- `packages/docs/`: documentation site only

### Verification communication

Docs must name the minimum verification story for contributors:

- typecheck
- unit tests
- package build
- docs build
- browser smoke check for WebGPU-specific runtime changes

## Tasks

- [x] Replace machine-local script paths with portable package scripts.
- [x] Add a `verify` script for local package and docs release confidence.
- [x] Add GitHub Actions quality workflow for PRs and master pushes.
- [x] Ignore temporary concept-generation image output.
- [x] Document architecture/package boundaries.
- [x] Document contributor verification commands and runtime smoke expectations.

## Risks / Tradeoffs

- Keeping docs deploy separate from quality CI avoids coupling publishing credentials to PR validation.
- `/img/` is ignored because the package already ships stable README assets from `assets/`. If concept art becomes durable documentation content, move it intentionally into `assets/` or docs public assets.
- WebGPU runtime behavior still needs human/browser smoke testing because unit tests cannot fully validate renderer behavior across adapters.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm docs:build
git diff --check
```
