import { useControls, folder } from "leva"
import type { VisualizationType } from "./debug-views-nodes"

const visualizationOptions: Record<VisualizationType, string> = {
  grayscale: "Grayscale",
  normal: "Normal → RGB",
  position: "Position → RGB",
  uv: "UV → RGB",
  ao: "AO → Grayscale",
  heatmap: "Heatmap",
  depth: "Depth → Grayscale",
  value: "Value",
  passthrough: "Passthrough",
}

const layoutOptions = {
  single: "Single",
  "split-h": "Split Horizontal",
  "split-v": "Split Vertical",
  quad: "Quad",
  overlay: "Overlay",
}

interface UseDebugViewsControlsOptions {
  channelCount?: number
  defaultLayout?: string
  defaultVisualization?: string
}

export function useDebugViewsControls(options: UseDebugViewsControlsOptions = {}) {
  const { channelCount = 1, defaultLayout = "single", defaultVisualization = "grayscale" } = options

  const channelControls: Record<string, any> = {}
  for (let i = 0; i < channelCount; i++) {
    channelControls[`Channel ${i}`] = folder({
      [`vis_${i}`]: {
        label: "Visualization",
        value: defaultVisualization,
        options: visualizationOptions,
      },
      [`scale_${i}`]: {
        label: "Scale",
        value: 1,
        min: 0.001,
        max: 100,
        step: 0.001,
      },
      [`bias_${i}`]: {
        label: "Bias",
        value: 0,
        min: -1,
        max: 1,
        step: 0.01,
      },
    })
  }

  const controls = useControls("Debug Views", {
    enabled: { label: "Enabled", value: true },
    layout: {
      label: "Layout",
      value: defaultLayout,
      options: layoutOptions,
    },
    activeChannel: {
      label: "Active Channel",
      value: 0,
      min: 0,
      max: Math.max(0, channelCount - 1),
      step: 1,
    },
    splitPosition: {
      label: "Split Position",
      value: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
    },
    opacity: {
      label: "Opacity",
      value: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
    },
    ...channelControls,
  })

  return controls
}
