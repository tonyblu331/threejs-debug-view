import { useEffect } from "react"
import { Leva } from "leva"
import { useDebugViewsControls } from "@/components/debug-views/r3f"
import type { DebugControlValues } from "./debug-control-values"

interface DebugControlsProps {
  onChange: (controls: DebugControlValues) => void
  viewLabels: string[]
}

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

export function DebugControls({ onChange, viewLabels }: DebugControlsProps) {
  const controls = useDebugViewsControls({ viewLabels }) as DebugControlValues

  useEffect(() => {
    onChange(controls)
  }, [
    controls.activeView,
    controls.columns,
    controls.enabled,
    controls.layout,
    controls.mode,
    controls.overlayOpacity,
    controls.rows,
    controls.showLabels,
    controls.slots,
    onChange,
  ])

  return <Leva collapsed={false} flat theme={neutralLevaTheme} />
}
