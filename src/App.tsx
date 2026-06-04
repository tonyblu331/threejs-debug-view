import { lazy, Suspense, useState } from "react"
import { WebGpuCanvas } from "./components/WebGpuCanvas"
import { Scene } from "./components/Scene"

const DevDebugOverlay = import.meta.env.DEV
  ? lazy(() =>
      import("./components/DebugOverlay").then(({ DebugOverlay }) => ({
        default: DebugOverlay,
      })),
    )
  : null

type RendererWithBackend = {
  backend?: {
    isWebGPUBackend?: boolean
    isWebGLBackend?: boolean
  }
}

function getBackendLabel(renderer: RendererWithBackend) {
  if (renderer.backend?.isWebGPUBackend) return "native WebGPU"
  if (renderer.backend?.isWebGLBackend) return "WebGL2 fallback"
  return "initializing"
}

function BackendBadge({ label }: { label: string }) {
  return (
    <div style={{
      position: "fixed",
      bottom: 12,
      left: 12,
      padding: "6px 12px",
      background: "rgba(0,0,0,0.7)",
      color: "#fff",
      fontFamily: "monospace",
      fontSize: 12,
      borderRadius: 4,
      pointerEvents: "none",
      zIndex: 100,
    }}>
      Three.js r184 · {label}
    </div>
  )
}

export function App() {
  const [backend, setBackend] = useState("initializing")

  return (
    <>
      <WebGpuCanvas
        camera={{ position: [0, 0, 5.5], fov: 40 }}
        onCreated={({ gl }) => setBackend(getBackendLabel(gl as RendererWithBackend))}
      >
        <Suspense fallback={null}>
          <Scene />
          {DevDebugOverlay ? <DevDebugOverlay /> : null}
        </Suspense>
      </WebGpuCanvas>

      <BackendBadge label={backend} />
    </>
  )
}
