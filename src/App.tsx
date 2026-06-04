import { lazy, Suspense, useState } from "react"
import { Leva } from "leva"
import { getDebugViewLabels } from "@/components/debug-views"
import { useDebugViewsControls } from "@/components/debug-views/r3f"
import { WebGpuCanvas } from "./components/WebGpuCanvas"
import { Scene } from "./components/Scene"

const enableDebugOverlay = import.meta.env.DEV || import.meta.env.VITE_DEBUG_VIEW_DEMO === "true"
const DEBUG_VIEW_LABELS = getDebugViewLabels()

const neutralLevaTheme = {
  colors: {
    elevation1: "#050505",
    elevation2: "#111111",
    elevation3: "#1c1c1c",
    accent1: "#2a2a2a",
    accent2: "#d8d8d8",
    accent3: "#ffffff",
    highlight1: "#7a7a7a",
    highlight2: "#d8d8d8",
    highlight3: "#ffffff",
    vivid1: "#ffffff",
  },
  radii: {
    xs: "0px",
    sm: "0px",
    lg: "0px",
  },
  shadows: {
    level1: "none",
    level2: "none",
  },
}

const DevDebugOverlay = enableDebugOverlay
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
      borderRadius: 0,
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
      {enableDebugOverlay ? (
        <DebugScene onBackendChange={setBackend} />
      ) : (
        <DefaultScene onBackendChange={setBackend} />
      )}
      <BackendBadge label={backend} />
    </>
  )
}

interface SceneShellProps {
  onBackendChange: (backend: string) => void
}

function DefaultScene({ onBackendChange }: SceneShellProps) {
  return (
    <WebGpuCanvas
      camera={{ position: [0, 0, 5.5], fov: 40 }}
      onCreated={({ gl }) => onBackendChange(getBackendLabel(gl as RendererWithBackend))}
    >
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </WebGpuCanvas>
  )
}

function DebugScene({ onBackendChange }: SceneShellProps) {
  const debugControls = useDebugViewsControls({ viewLabels: DEBUG_VIEW_LABELS })

  return (
    <>
      <WebGpuCanvas
        camera={{ position: [0, 0, 5.5], fov: 40 }}
        onCreated={({ gl }) => onBackendChange(getBackendLabel(gl as RendererWithBackend))}
      >
        <Suspense fallback={null}>
          <Scene />
          {DevDebugOverlay ? (
            <DevDebugOverlay
              controls={debugControls}
              viewLabels={DEBUG_VIEW_LABELS}
            />
          ) : null}
        </Suspense>
      </WebGpuCanvas>

      <Leva collapsed={false} flat theme={neutralLevaTheme} />
    </>
  )
}
