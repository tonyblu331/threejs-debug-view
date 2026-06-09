# Measured Overdraw — Tasks

> **SDD:** [`measured-overdraw.sdd.md`](./measured-overdraw.sdd.md) — **Shipped**

## Spike 0 — Atomic feasibility (non-blocking)

- [ ] 1×1 `NodeMaterial` + `atomicAdd` readback → document pass/fail in this file

## Spike 1 — Blend counter (blocking)

- [x] Depth prepass + `ONE ONE` counter with shared depth on single RT
- [x] Vitest: classification + fixture scene expectations (1/2/4/blocker/cutout)
- [x] Spike 0 deferred — blend path passed fixtures

## Slice 2 — Ship measured on `overdraw`

- [x] `overdraw-classification.ts`
- [x] `measured-overdraw-pass.ts` + pipeline wire-up
- [x] Label `Measured Overlap`; remove `scale: 2.5`
- [x] Legend `0 / 1 / 4 / 8+ layers`
- [x] `createDebugPipelineRuntimeKey` viewport dimensions

## Slice 3 — `overdrawVisual`

- [x] `overdrawVisual` source + `usesOverdrawVisualPass`
- [x] Keep `overdraw-override.ts` for visual approx path

## Slice 4 — Inspector + docs

- [x] Layer click inspector (linear R via GPU readback)
- [x] Docs + E2E updates

## Verify

- [x] `pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build:demo`
