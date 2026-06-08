import { useMemo, type CSSProperties } from "react"
import { Html } from "@react-three/drei"
import {
  createDebugViewportLabels,
  createDebugViewportPlanLabels,
  type DebugViewportLabels,
} from "./debug-viewport-labels"
import type { DebugViewportPlan } from "./debug-viewport-plan"
import type { ResolvedDebugViewLayout } from "./debug-view-layout"
import type { DebugView } from "./debug-views-tsl/compositor"

export interface ShaderCostSample {
  cost: number
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
  const labelGridStyle = useMemo(
    () => createLabelGridStyle(layout),
    [layout],
  )

  if (viewportLabels.length === 0) return null

  return (
    <Html fullscreen style={htmlOverlayStyle}>
      <div aria-hidden="true" style={labelGridStyle}>
        {viewportLabels.map((label, index) => (
          <div key={`${index}:${label}`} style={labelCellStyle}>
            <span style={viewportLabelStyle}>{label}</span>
          </div>
        ))}
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
    <Html fullscreen style={htmlOverlayStyle}>
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
          <span style={legendLabelStyle}>low shader work</span>
          <ShaderCostLegendRamp sampleCost={sampleCost} />
          <span style={legendLabelStyle}>high shader work</span>
        </div>
        <div style={legendNoteStyle}>
          {sample ? "shader cost sample" : "click viewport to sample shader cost"}
        </div>
      </div>
    </Html>
  )
}

function ShaderCostLegendRamp({ sampleCost }: { sampleCost: number | null }) {
  const markerPercent = sampleCost === null ? null : `${(sampleCost * 100).toFixed(2)}%`
  const position = markerPercent === null
    ? undefined
    : `clamp(30px, ${markerPercent}, calc(100% - 30px))`

  return (
    <div style={shaderCostLegendRampStyle}>
      {position ? (
        <div style={{ ...shaderCostTimingMarkerStyle, left: position }}>
          <span style={shaderCostTimingMarkerTriangleStyle} />
          <span style={shaderCostTimingMarkerLabelStyle}>sample</span>
        </div>
      ) : null}
    </div>
  )
}

export function OverdrawLegendOverlay() {
  return (
    <Html fullscreen style={htmlOverlayStyle}>
      <div aria-hidden="true" style={legendOverlayStyle}>
        <div style={legendPanelStyle}>
          <span style={legendLabelStyle}>no overlap</span>
          <div style={overdrawLegendRampStyle} />
          <span style={legendLabelStyle}>heavy overlap</span>
        </div>
        <div style={legendNoteStyle}>pixel overlap</div>
      </div>
    </Html>
  )
}

const htmlOverlayStyle: CSSProperties = {
  pointerEvents: "none",
}

const labelCellStyle: CSSProperties = {
  minWidth: 0,
  position: "relative",
}

const viewportLabelStyle: CSSProperties = {
  backdropFilter: "blur(8px)",
  background: "rgba(0, 0, 0, 0.58)",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  borderRadius: 0,
  color: "#fff",
  fontFamily: "monospace",
  fontSize: 12,
  left: 10,
  letterSpacing: "0.04em",
  lineHeight: 1,
  padding: "6px 8px",
  position: "absolute",
  textTransform: "uppercase",
  top: 10,
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
  alignItems: "center",
  background: "rgba(0, 0, 0, 0.62)",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  borderRadius: 0,
  boxShadow: "0 10px 32px rgba(0, 0, 0, 0.32)",
  display: "grid",
  gap: 8,
  gridTemplateColumns: "auto 1fr auto",
  padding: "8px 10px",
  width: "100%",
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

const shaderCostLegendRampStyle: CSSProperties = {
  background:
    "linear-gradient(90deg, #000 0%, #000 6%, #00ff1f 18%, #fff000 48%, #ff0d00 80%, #fff 100%)",
  border: "1px solid rgba(255, 255, 255, 0.24)",
  borderRadius: 0,
  height: 12,
  overflow: "visible",
  position: "relative",
}

const legendNoteStyle: CSSProperties = {
  color: "rgba(255, 255, 255, 0.7)",
  fontFamily: "monospace",
  fontSize: 12,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
}

const legendLabelStyle: CSSProperties = {
  color: "#fff",
  fontFamily: "monospace",
  fontSize: 12,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
}

const shaderCostTimingMarkerStyle: CSSProperties = {
  bottom: -5,
  height: 22,
  position: "absolute",
  transform: "translateX(-50%)",
  width: 0,
}

const shaderCostTimingMarkerLabelStyle: CSSProperties = {
  background: "rgba(0, 0, 0, 0.78)",
  border: "1px solid rgba(255, 255, 255, 0.28)",
  color: "#fff",
  fontFamily: "monospace",
  fontSize: 10,
  left: "50%",
  letterSpacing: "0.06em",
  lineHeight: 1,
  padding: "3px 5px",
  position: "absolute",
  textTransform: "uppercase",
  top: -20,
  transform: "translateX(-50%)",
  whiteSpace: "nowrap",
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
  background:
    "linear-gradient(90deg, #000 0%, #101820 18%, #2f4f7f 48%, #9ec5ff 78%, #fff 100%)",
  border: "1px solid rgba(255, 255, 255, 0.24)",
  borderRadius: 0,
  height: 12,
  position: "relative",
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
