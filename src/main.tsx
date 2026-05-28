import { createRoot } from "react-dom/client"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, Sphere, Torus, Plane } from "@react-three/drei"
import { DebugViews } from "../components/debug-views/debug-views-post"
import { useDebugViewsControls } from "../components/debug-views/use-debug-views-controls"
import { normalWorld, positionWorld, uv, float, vec4 } from "three/tsl"

function Scene() {
  const controls = useDebugViewsControls({
    channelCount: 4,
    defaultLayout: "single",
    defaultVisualization: "normal",
  })

  const debugChannels = [
    { node: normalWorld, visualization: controls.vis_0 ?? "normal", label: "Normals" },
    { node: positionWorld, visualization: controls.vis_1 ?? "position", label: "Position", scale: 0.01 },
    { node: uv(), visualization: controls.vis_2 ?? "uv", label: "UV" },
    { node: float(0.8), visualization: controls.vis_3 ?? "value", label: "Custom Value" },
  ]

  return (
    <>
      <DebugViews
        channels={debugChannels}
        layout={(controls.layout as any) ?? "single"}
        activeChannel={controls.activeChannel ?? 0}
        splitPosition={controls.splitPosition ?? 0.5}
        opacity={controls.opacity ?? 0.5}
        enabled={controls.enabled ?? true}
      />

      <OrbitControls />

      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />

      <Sphere args={[1, 32, 32]} position={[-2, 0, 0]}>
        <meshStandardMaterial color="hotpink" />
      </Sphere>

      <Torus args={[0.8, 0.3, 16, 32]} position={[0, 0, 0]}>
        <meshStandardMaterial color="cyan" />
      </Torus>

      <Sphere args={[0.6, 32, 32]} position={[2, 0, 0]}>
        <meshStandardMaterial color="yellow" />
      </Sphere>

      <Plane args={[10, 10]} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]}>
        <meshStandardMaterial color="#444" />
      </Plane>
    </>
  )
}

createRoot(document.getElementById("root")!).render(
  <Canvas
    camera={{ position: [0, 2, 5], fov: 50 }}
    gl={{ antialias: true }}
  >
    <Scene />
  </Canvas>,
)
