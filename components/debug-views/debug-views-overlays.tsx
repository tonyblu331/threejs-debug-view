import { useMemo, type CSSProperties, type ReactNode } from "react"
import { Html } from "@react-three/drei"
import type { Camera, Object3D } from "three"
import {
  createDebugViewportLabels,
  createDebugViewportPlanLabels,
  type DebugViewportLabels,
} from "./debug-viewport-labels"
import type { DebugViewportPlan } from "./debug-viewport-plan"
import type { ResolvedDebugViewLayout } from "./debug-view-layout"
import { createPresentationLabelRegions } from "./debug-viewport-label-anchors"
import type { DebugView } from "./debug-views-tsl/compositor"

export interface ShaderCostSample {
  cost: number
  x: number
  y: number
}

export interface OverdrawLayerSample {
  layers: number
  x: number
  y: number
}

export interface DebugViewportLabelOverlayProps {
  views: readonly DebugView[]
  layout: ResolvedDebugViewLayout
  labels?: DebugViewportLabels
  viewportPlan?: DebugViewportPlan
}

export function DebugViewportLabelOverlay({
  views,
  layout,
  labels,
  viewportPlan,
}: DebugViewportLabelOverlayProps) {
  const viewportLabels = useMemo(
    () => viewportPlan
      ? createDebugViewportPlanLabels(viewportPlan, labels)
      : createDebugViewportLabels(views, layout, labels),
    [views, layout, labels, viewportPlan],
  )
  const labelRegions = useMemo(
    () => createPresentationLabelRegions(layout),
    [layout],
  )
  const labelGridStyle = useMemo(
    () => (labelRegions ? presentationLabelContainerStyle : createLabelGridStyle(layout)),
    [labelRegions, layout],
  )

  const labelsToRender = useMemo(() => {
    if (!labelRegions) return viewportLabels
    return viewportLabels.slice(0, labelRegions.length)
  }, [labelRegions, viewportLabels])

  if (labelsToRender.length === 0) return null

  return (
    <Html fullscreen calculatePosition={canvasHudPosition} style={htmlOverlayStyle}>
      <div aria-hidden="true" style={labelGridStyle}>
        {labelsToRender.map((label, index) => {
          const region = labelRegions && index < labelRegions.length
            ? labelRegions[index]
            : undefined
          return (
            <div
              key={`${index}:${label}`}
              style={region ? bandLabelCellStyle(region) : labelCellStyle}
            >
              <span style={viewportLabelStyle}>{label}</span>
            </div>
          )
        })}
      </div>
    </Html>
  )
}

export function ShaderCostLegendOverlay({
  sample,
}: {
  sample: ShaderCostSample | null
}) {
  const sampleCost = sample?.cost ?? null

  return (
    <Html fullscreen calculatePosition={canvasHudPosition} style={htmlOverlayStyle}>
      {sample ? (
        <div
          aria-hidden="true"
          style={{
            ...shaderCostSampleCursorStyle,
            left: sample.x,
            top: sample.y,
          }}
        >
          <span style={shaderCostSampleCursorRingStyle} />
          <span style={shaderCostSampleCursorCrosshairHorizontalStyle} />
          <span style={shaderCostSampleCursorCrosshairVerticalStyle} />
        </div>
      ) : null}
      <div aria-hidden="true" style={legendOverlayStyle}>
        <div style={legendPanelStyle}>
          <DiagnosticLegendRamp
            leftLabel="low"
            note={sample ? undefined : "shader complexity"}
            rightLabel="high"
            rampStyle={shaderCostLegendRampStyle}
          >
            <ShaderCostSampleMarker sampleCost={sampleCost} />
          </DiagnosticLegendRamp>
        </div>
      </div>
    </Html>
  )
}

function ShaderCostSampleMarker({ sampleCost }: { sampleCost: number | null }) {
  if (sampleCost === null) return null

  const markerPercent = `${(sampleCost * 100).toFixed(2)}%`
  const position = `clamp(8px, ${markerPercent}, calc(100% - 8px))`

  return (
    <div style={{ ...shaderCostTimingMarkerStyle, left: position }}>
      <span style={shaderCostTimingMarkerTriangleStyle} />
    </div>
  )
}

function DiagnosticLegendRamp({
  leftLabel,
  rightLabel,
  rampStyle,
  note,
  children,
}: {
  leftLabel: string
  rightLabel: string
  rampStyle: CSSProperties
  note?: string
  children?: ReactNode
}) {
  return (
    <div style={legendRampBlockStyle}>
      <div style={{ ...rampStyle, ...legendRampBarStyle }}>
        {children}
      </div>
      <div style={legendRampEndsStyle}>
        <span style={legendEndLabelStyle}>{leftLabel}</span>
        <span style={legendEndLabelStyle}>{rightLabel}</span>
      </div>
      {note ? <div style={legendNoteStyle}>{note}</div> : null}
    </div>
  )
}

export function OverdrawLegendOverlay({ sample }: { sample?: OverdrawLayerSample | null }) {
  return (
    <Html fullscreen calculatePosition={canvasHudPosition} style={htmlOverlayStyle}>
      <div aria-hidden="true" style={legendOverlayStyle}>
        {sample ? (
          <div
            style={{
              ...shaderCostSampleCursorStyle,
              left: sample.x,
              top: sample.y,
            }}
          >
            <span style={shaderCostSampleCursorRingStyle} />
            <span style={shaderCostSampleCursorCrosshairHorizontalStyle} />
            <span style={shaderCostSampleCursorCrosshairVerticalStyle} />
          </div>
        ) : null}
        <div style={legendPanelStyle}>
          <DiagnosticLegendRamp
            leftLabel="0 layers"
            note="Click viewport to sample integer layer count."
            rampStyle={overdrawLegendRampStyle}
            rightLabel="8+ layers"
          >
            {sample ? <OverdrawLayerMarker layers={sample.layers} /> : null}
          </DiagnosticLegendRamp>
        </div>
      </div>
    </Html>
  )
}

export function LightComplexityLegendOverlay() {
  return (
    <Html fullscreen calculatePosition={canvasHudPosition} style={htmlOverlayStyle}>
      <div aria-hidden="true" style={legendOverlayStyle}>
        <div style={legendPanelStyle}>
          <DiagnosticLegendRamp
            leftLabel="0 lights"
            note="Shadows excluded in v1. Default forward lights only."
            rampStyle={lightComplexityLegendRampStyle}
            rightLabel="8+ lights"
          />
        </div>
      </div>
    </Html>
  )
}

const OVERDRAW_LEGEND_CLAMP_LAYERS = 8

function OverdrawLayerMarker({ layers }: { layers: number }) {
  const position = `${Math.min(100, Math.max(0, (Math.min(layers, OVERDRAW_LEGEND_CLAMP_LAYERS) / OVERDRAW_LEGEND_CLAMP_LAYERS) * 100))}%`

  return (
    <div style={{ ...shaderCostTimingMarkerStyle, left: position }}>
      <span style={shaderCostTimingMarkerTriangleStyle} />
    </div>
  )
}

/** Anchor fullscreen HUD to the canvas, not world-origin projection. */
export const canvasHudPosition = (
  _object: Object3D,
  _camera: Camera,
  size: { width: number; height: number },
): [number, number] => [size.width / 2, size.height / 2]

const htmlOverlayStyle: CSSProperties = {
  pointerEvents: "none",
}

const presentationLabelContainerStyle: CSSProperties = {
  height: "100%",
  inset: 0,
  pointerEvents: "none",
  position: "absolute",
  width: "100%",
}

const labelCellStyle: CSSProperties = {
  minWidth: 0,
  padding: "10px",
  position: "relative",
}

function bandLabelCellStyle(region: { left: number; top: number; width: number }): CSSProperties {
  const center = region.left + region.width / 2

  return {
    boxSizing: "border-box",
    left: `${center * 100}%`,
    maxWidth: `${region.width * 100}%`,
    padding: "0 4px",
    position: "absolute",
    top: `calc(${region.top * 100}% + 6px)`,
    transform: "translateX(-50%)",
  }
}

const viewportLabelStyle: CSSProperties = {
  backdropFilter: "blur(8px)",
  background: "rgba(0, 0, 0, 0.58)",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  borderRadius: 0,
  color: "#fff",
  display: "inline-block",
  fontFamily: "monospace",
  fontSize: 12,
  letterSpacing: "0.04em",
  lineHeight: 1,
  maxWidth: "100%",
  overflow: "hidden",
  padding: "6px 8px",
  textOverflow: "ellipsis",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
}

const legendOverlayStyle: CSSProperties = {
  alignItems: "center",
  bottom: 42,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  left: "50%",
  pointerEvents: "none",
  position: "absolute",
  transform: "translateX(-50%)",
  width: "min(560px, calc(100vw - 48px))",
  zIndex: 20,
}

const legendPanelStyle: CSSProperties = {
  background: "rgba(0, 0, 0, 0.62)",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  borderRadius: 0,
  boxShadow: "0 10px 32px rgba(0, 0, 0, 0.32)",
  padding: "8px 10px",
  width: "100%",
}

const legendRampBlockStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  width: "100%",
}

const legendRampBarStyle: CSSProperties = {
  overflow: "visible",
  position: "relative",
  width: "100%",
}

const legendRampEndsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  textAlign: "center",
  width: "100%",
}

const legendEndLabelStyle: CSSProperties = {
  color: "#fff",
  fontFamily: "monospace",
  fontSize: 12,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
}

const shaderCostSampleCursorStyle: CSSProperties = {
  height: 46,
  pointerEvents: "none",
  position: "fixed",
  transform: "translate(-50%, -50%)",
  width: 46,
  zIndex: 19,
}

const shaderCostSampleCursorRingStyle: CSSProperties = {
  border: "2px solid rgba(255, 255, 255, 0.92)",
  borderRadius: "999px",
  boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.72), 0 0 18px rgba(255, 255, 255, 0.28)",
  display: "block",
  height: 46,
  width: 46,
}

const shaderCostSampleCursorCrosshairHorizontalStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.92)",
  boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.72)",
  height: 1,
  left: "50%",
  position: "absolute",
  top: "50%",
  transform: "translate(-50%, -50%)",
  width: 62,
}

const shaderCostSampleCursorCrosshairVerticalStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.92)",
  boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.72)",
  height: 62,
  left: "50%",
  position: "absolute",
  top: "50%",
  transform: "translate(-50%, -50%)",
  width: 1,
}

const diagnosticLegendRampBaseStyle: CSSProperties = {
  border: "1px solid rgba(255, 255, 255, 0.24)",
  borderRadius: 0,
  height: 12,
  position: "relative",
}

const shaderCostLegendRampStyle: CSSProperties = {
  ...diagnosticLegendRampBaseStyle,
  background:
    "linear-gradient(90deg, #000 0%, #000 6%, #00ff1f 18%, #fff000 48%, #ff0d00 80%, #fff 100%)",
  overflow: "visible",
}

const legendNoteStyle: CSSProperties = {
  color: "rgba(255, 255, 255, 0.7)",
  fontFamily: "monospace",
  fontSize: 12,
  letterSpacing: "0.04em",
  textAlign: "center",
  textTransform: "uppercase",
}

const shaderCostTimingMarkerStyle: CSSProperties = {
  bottom: -5,
  height: 22,
  position: "absolute",
  transform: "translateX(-50%)",
  width: 0,
}

const shaderCostTimingMarkerTriangleStyle: CSSProperties = {
  borderLeft: "5px solid transparent",
  borderRight: "5px solid transparent",
  borderTop: "7px solid #fff",
  left: -5,
  position: "absolute",
  top: -1,
}

const overdrawLegendRampStyle: CSSProperties = {
  ...diagnosticLegendRampBaseStyle,
  background:
    "linear-gradient(90deg, #000 0%, #101820 18%, #2f4f7f 48%, #9ec5ff 78%, #fff 100%)",
}

const lightComplexityLegendRampStyle: CSSProperties = {
  ...diagnosticLegendRampBaseStyle,
  background:
    "linear-gradient(90deg, #000 0%, #0d2a12 20%, #2f8f3f 48%, #d6ff4d 78%, #fff 100%)",
}

function createLabelGridStyle(layout: ResolvedDebugViewLayout): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
    height: "100%",
    inset: 0,
    pointerEvents: "none",
    position: "absolute",
    width: "100%",
  }
}
