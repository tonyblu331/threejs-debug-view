import { lazy, Suspense, useEffect, useState, type CSSProperties } from "react"
import { WebGpuCanvas } from "./components/WebGpuCanvas"
import { Scene, type DemoSceneVariant } from "./components/Scene"

const enableDebugOverlay = import.meta.env.DEV || import.meta.env.VITE_DEBUG_VIEW_DEMO === "true"

const DevDebugOverlay = enableDebugOverlay
  ? lazy(() =>
      import("./components/DebugOverlay").then(({ DebugOverlay }) => ({
        default: DebugOverlay,
      })),
    )
  : null

const DevDebugControls = enableDebugOverlay
  ? lazy(() =>
      import("./components/DebugControls").then(({ DebugControls }) => ({
        default: DebugControls,
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
  if (renderer.backend?.isWebGLBackend) return "unsupported backend"
  return "WebGPU required"
}

function BackendBadge({ label }: { label: string }) {
  return (
    <div style={backendBadgeStyle}>
      Three.js r184 · {label}
    </div>
  )
}

const backendBadgeStyle: CSSProperties = {
  background: "rgba(0,0,0,0.7)",
  borderRadius: 0,
  bottom: 12,
  color: "#fff",
  fontFamily: "monospace",
  fontSize: 12,
  left: 12,
  padding: "6px 12px",
  pointerEvents: "none",
  position: "fixed",
  zIndex: 100,
}

export function App() {
  const [backend, setBackend] = useState("initializing")
  const [sceneVariant, setSceneVariant] = useState<DemoSceneVariant>(getSceneVariantFromUrl)
  const [debugViewSource, setDebugViewSource] = useState(getDebugViewSourceFromUrl)

  useEffect(() => {
    const handlePopState = () => {
      setSceneVariant(getSceneVariantFromUrl())
      setDebugViewSource(getDebugViewSourceFromUrl())
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  function updateSceneVariant(variant: DemoSceneVariant) {
    setSceneVariant(variant)
    const url = new URL(window.location.href)
    if (variant === "main") {
      url.searchParams.delete("scene")
      url.searchParams.delete("debugView")
      setDebugViewSource(null)
    } else {
      url.searchParams.set("scene", variant)
      url.searchParams.set("debugView", "overdraw")
      setDebugViewSource("overdraw")
    }
    window.history.pushState(null, "", url)
  }

  return (
    <>
      <SceneTabs active={sceneVariant} onChange={updateSceneVariant} />
      {enableDebugOverlay ? (
        <DebugScene
          debugViewSource={debugViewSource}
          onBackendChange={setBackend}
          sceneVariant={sceneVariant}
        />
      ) : (
        <DefaultScene onBackendChange={setBackend} sceneVariant={sceneVariant} />
      )}
      <BackendBadge label={backend} />
    </>
  )
}

interface SceneShellProps {
  debugViewSource?: string | null
  onBackendChange: (backend: string) => void
  sceneVariant: DemoSceneVariant
}

function DefaultScene({ onBackendChange, sceneVariant }: SceneShellProps) {
  return (
    <WebGpuCanvas
      camera={{ position: [0, 0, 5.5], fov: 40 }}
      onCreated={({ gl }) => onBackendChange(getBackendLabel(gl as RendererWithBackend))}
      onSupportChange={(support) => {
        if (support === "unsupported") onBackendChange("WebGPU required")
      }}
    >
      <Suspense fallback={null}>
        <Scene variant={sceneVariant} />
      </Suspense>
    </WebGpuCanvas>
  )
}

function DebugScene({ debugViewSource, onBackendChange, sceneVariant }: SceneShellProps) {
  return (
    <>
      <WebGpuCanvas
        camera={{ position: [0, 0, 5.5], fov: 40 }}
        onCreated={({ gl }) => onBackendChange(getBackendLabel(gl as RendererWithBackend))}
        onSupportChange={(support) => {
          if (support === "unsupported") onBackendChange("WebGPU required")
        }}
      >
        <Suspense fallback={null}>
          <Scene variant={sceneVariant} />
          {DevDebugOverlay ? <DevDebugOverlay debugViewSource={debugViewSource} /> : null}
        </Suspense>
      </WebGpuCanvas>

      <Suspense fallback={null}>
        {DevDebugControls ? <DevDebugControls /> : null}
      </Suspense>
    </>
  )
}

function SceneTabs({
  active,
  onChange,
}: {
  active: DemoSceneVariant
  onChange: (variant: DemoSceneVariant) => void
}) {
  return (
    <div aria-label="Demo scene" role="tablist" style={sceneTabsStyle}>
      <button
        aria-selected={active === "main"}
        onClick={() => onChange("main")}
        role="tab"
        style={getSceneTabStyle(active === "main")}
        type="button"
      >
        Main
      </button>
      <button
        aria-selected={active === "overdraw"}
        onClick={() => onChange("overdraw")}
        role="tab"
        style={getSceneTabStyle(active === "overdraw")}
        type="button"
      >
        Overlap
      </button>
    </div>
  )
}

function getSceneVariantFromUrl(): DemoSceneVariant {
  const scene = new URLSearchParams(window.location.search).get("scene")
  return scene === "overdraw" || scene === "overlap" ? "overdraw" : "main"
}

function getDebugViewSourceFromUrl() {
  return new URLSearchParams(window.location.search).get("debugView")
}

const sceneTabsStyle: CSSProperties = {
  background: "rgba(0,0,0,0.72)",
  border: "1px solid rgba(255,255,255,0.14)",
  display: "flex",
  gap: 0,
  left: 12,
  padding: 4,
  position: "fixed",
  top: 44,
  zIndex: 101,
}

function getSceneTabStyle(active: boolean): CSSProperties {
  return {
    background: active ? "#f2f2f2" : "transparent",
    border: 0,
    color: active ? "#050505" : "#d8d8d8",
    cursor: "pointer",
    fontFamily: "monospace",
    fontSize: 12,
    padding: "7px 12px",
  }
}
