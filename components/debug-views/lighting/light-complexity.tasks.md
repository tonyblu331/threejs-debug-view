# Light Complexity — Tasks

> **SDD:** [`light-complexity.sdd.md`](./light-complexity.sdd.md) — **Shipped**

## R0 — Fixture scene

- [x] `?scene=lights` preset with overlapping point lights
- [x] Dark room fixture renders in beauty mode

## R2 — Fragment light counter

- [x] `light-classification.ts`
- [x] `light-complexity-material.ts`
- [x] Pipeline wire-up + `Estimated Light Overlap` view
- [x] Legend `0 / 1 / 2 / 4 / 8+ lights`

## Verify

- [x] `pnpm verify` (typecheck, test, e2e, build:demo)
- [x] E2E `?scene=lights&debugView=lightComplexity`
