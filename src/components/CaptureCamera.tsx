import { useEffect } from "react"
import { useThree } from "@react-three/fiber"
import { PerspectiveCamera } from "three"
import { isSocialCapture } from "../demo/capture-mode"
import type { DemoSceneVariant } from "./Scene"

type OrbitControlsLike = {
  target: { set: (x: number, y: number, z: number) => void }
  update: () => void
}

const SOCIAL_CAMERA: Record<
  DemoSceneVariant,
  { position: [number, number, number]; target: [number, number, number]; fov: number }
> = {
  main: {
    position: [3.55, 0.62, 4.35],
    target: [0.05, -0.22, -0.35],
    fov: 33,
  },
  overdraw: {
    position: [4.25, 1.05, 3.55],
    target: [0.1, -0.38, -1.22],
    fov: 34,
  },
  lights: {
    position: [2.8, 1.4, 3.2],
    target: [0, 0, 0],
    fov: 38,
  },
}

export function CaptureCamera({ variant }: { variant: DemoSceneVariant }) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as OrbitControlsLike | null

  useEffect(() => {
    if (!isSocialCapture()) return

    const preset = SOCIAL_CAMERA[variant]
    camera.position.set(...preset.position)

    if (camera instanceof PerspectiveCamera) {
      camera.fov = preset.fov
      camera.updateProjectionMatrix()
    }

    if (controls) {
      controls.target.set(...preset.target)
      controls.update()
      return
    }

    camera.lookAt(...preset.target)
  }, [camera, controls, variant])

  return null
}
