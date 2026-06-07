import type { DebugView, DebugViewSource } from "./debug-views-tsl/compositor"

export const MATERIAL_DEBUG_VIEW_SOURCES = [
  "albedo",
  "materialNormal",
  "normalMap",
  "emissive",
  "roughness",
  "ao",
  "metallic",
  "opacity",
  "wireframe",
  "lightingOnly",
  "reflectionOnly",
  "overdraw",
  "shaderCost",
] as const satisfies readonly DebugViewSource[]

export const DEFAULT_DEBUG_VIEWS = [
  { label: "Beauty", source: "beauty", mode: "passthrough" },
  { label: "Normal", source: "normal", mode: "passthrough" },
  { label: "Depth", source: "depth", mode: "depth" },
  { label: "Base Color / Albedo", source: "albedo", mode: "passthrough" },
  { label: "Material Normal / Normal Map", source: "materialNormal", mode: "passthrough" },
  { label: "Emissive", source: "emissive", mode: "passthrough" },
  { label: "Roughness", source: "roughness", mode: "passthrough" },
  { label: "AO", source: "ao", mode: "passthrough" },
  { label: "Metallic", source: "metallic", mode: "passthrough" },
  { label: "Opacity", source: "opacity", mode: "passthrough" },
  { label: "Wireframe", source: "wireframe", mode: "passthrough" },
  { label: "Lighting Only", source: "lightingOnly", mode: "passthrough" },
  { label: "Reflection Only", source: "reflectionOnly", mode: "passthrough" },
  { label: "Overlap", source: "overdraw", mode: "heatmap", scale: 2.5 },
  { label: "Estimated Shader Complexity", source: "shaderCost", mode: "heatmap" },
] as const satisfies readonly DebugView[]

export function getDebugViewLabels(views: readonly DebugView[] = DEFAULT_DEBUG_VIEWS) {
  return views.map((view) => view.label)
}
