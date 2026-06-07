import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from "three"
import { WebGPURenderer } from "three/webgpu"

type RendererFactoryProps = ConstructorParameters<typeof WebGPURenderer>[0]
type RendererBackendFlags = {
  isWebGLBackend?: boolean
}

const WEBGPU_PREFLIGHT_TIMEOUT_MS = 1_500
const REQUIRED_COLOR_ATTACHMENT_BYTES_PER_SAMPLE = 40
const ENABLE_SHADER_COST_TIMING = import.meta.env.VITE_DEBUG_SHADER_TIMING === "true"

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export async function hasUsableWebGpuAdapter() {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    return false
  }

  try {
    const adapter = await withTimeout(
      navigator.gpu.requestAdapter(),
      WEBGPU_PREFLIGHT_TIMEOUT_MS,
      null,
    )

    return (
      adapter !== null &&
      adapter.limits.maxColorAttachmentBytesPerSample >= REQUIRED_COLOR_ATTACHMENT_BYTES_PER_SAMPLE
    )
  } catch {
    return false
  }
}

async function createInitializedRenderer(props: RendererFactoryProps) {
  const renderer = new WebGPURenderer({
    ...props,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
    forceWebGL: false,
    requiredLimits: {
      maxColorAttachmentBytesPerSample: REQUIRED_COLOR_ATTACHMENT_BYTES_PER_SAMPLE,
    },
    trackTimestamp: ENABLE_SHADER_COST_TIMING,
  })

  await renderer.init()

  if ((renderer.backend as RendererBackendFlags | undefined)?.isWebGLBackend) {
    throw new Error("WebGPU is required for this demo, but Three initialized the WebGL2 backend.")
  }

  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 2
  renderer.shadowMap.enabled = true
  renderer.shadowMap.transmitted = true
  renderer.shadowMap.type = PCFSoftShadowMap

  return renderer
}

export async function createWebGpuRenderer(props: RendererFactoryProps) {
  if (!await hasUsableWebGpuAdapter()) {
    throw new Error("WebGPU is required for this demo, but no native adapter is available.")
  }

  return createInitializedRenderer(props)
}
