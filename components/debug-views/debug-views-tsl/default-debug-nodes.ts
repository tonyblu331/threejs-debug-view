import {
  float,
  directionToColor,
  materialColor,
  materialNormal,
  materialOpacity,
  mrt,
  normalView,
  output,
  vec4,
} from "three/tsl"
import type { DebugNode, FloatNode, Vec3Node, Vec4Node } from "./node-types"
import {
  safeMaterialAO,
  safeMaterialEmissive,
  safeMaterialMetalness,
  safeMaterialRoughness,
} from "./safe-material-nodes"

interface DebugPass {
  getTextureNode(name?: string): DebugNode
  getViewZNode(name?: string): FloatNode
}

interface ConfigurableDebugPass extends DebugPass {
  setMRT(mrtNode: ReturnType<typeof mrt>): unknown
}

export interface MaterialDebugChannels {
  roughness?: boolean
  metalness?: boolean
  ao?: boolean
  opacity?: boolean
}

export interface SceneDebugOutputs {
  normal?: boolean
  albedo?: boolean
  emissive?: boolean
  material?: MaterialDebugChannels
}

export interface MaterialDetailOutputs {
  materialNormal?: boolean
}

interface DefaultDebugNodeResolverOptions {
  materialDetailPass?: DebugPass
  wireframePass?: DebugPass
  lightingOnlyPass?: DebugPass
  reflectionOnlyPass?: DebugPass
  overdrawPass?: DebugPass
  overdrawVisualPass?: DebugPass
  lightComplexityPass?: DebugPass
  shaderCostPass?: DebugPass
}

const BLACK = vec4(0, 0, 0, 1)

export function configureSceneDebugPass(
  scenePass: ConfigurableDebugPass,
  outputs: SceneDebugOutputs,
) {
  const mrtOutputs: Record<string, DebugNode> = {
    output: typedNode<DebugNode>(output),
  }

  if (outputs.normal) {
    mrtOutputs.normal = toVec4(directionToColor(typedNode<Vec3Node>(normalView)))
  }

  if (outputs.albedo) {
    mrtOutputs.albedo = toVec4(typedNode<Vec3Node>(materialColor).rgb)
  }

  if (outputs.emissive) {
    mrtOutputs.emissive = toVec4(safeMaterialEmissive.rgb)
  }

  if (outputs.material) {
    mrtOutputs.material = createMaterialNode(outputs.material)
  }

  scenePass.setMRT(mrt(mrtOutputs))
}

export function configureMaterialDetailPass(
  materialDetailPass: ConfigurableDebugPass,
  outputs: MaterialDetailOutputs,
) {
  const mrtOutputs: Record<string, DebugNode> = {
    output: BLACK,
  }

  if (outputs.materialNormal) {
    mrtOutputs.materialNormal = toVec4(directionToColor(typedNode<Vec3Node>(materialNormal)))
  }

  materialDetailPass.setMRT(mrt(mrtOutputs))
}

export function createDefaultDebugNodeResolver(
  scenePass: DebugPass,
  options: DefaultDebugNodeResolverOptions = {},
) {
  const cache = new Map<string, DebugNode>()

  function cached(key: string, createNode: () => DebugNode) {
    const existing = cache.get(key)
    if (existing) return existing

    const node = createNode()
    cache.set(key, node)
    return node
  }

  function materialBuffer() {
    return typedNode<Vec4Node>(cached("material", () => scenePass.getTextureNode("material")))
  }

  return function getDefaultDebugNode(source: string): DebugNode {
    switch (source) {
      case "beauty":
      case "passthrough":
        return cached("beauty", () => scenePass.getTextureNode("output"))
      case "normal":
        return cached("normal", () => scenePass.getTextureNode("normal"))
      case "depth":
        return cached("depth", () => scenePass.getViewZNode("depth").mul(-1))
      case "albedo":
      case "baseColor":
        return cached("albedo", () => scenePass.getTextureNode("albedo"))
      case "materialNormal":
      case "normalMap":
        return cached(source, () => options.materialDetailPass?.getTextureNode("materialNormal") ?? BLACK)
      case "emissive":
        return cached("emissive", () => scenePass.getTextureNode("emissive"))
      case "roughness":
        return cached("roughness", () => packScalar(materialBuffer().r))
      case "metalness":
      case "metallic":
        return cached(source, () => packScalar(materialBuffer().g))
      case "opacity":
        return cached("opacity", () => packScalar(materialBuffer().a))
      case "transparency":
        return cached("transparency", () => packScalar(materialBuffer().a.oneMinus()))
      case "ao":
        return cached("ao", () => packScalar(materialBuffer().b))
      case "wireframe":
        return cached("wireframe", () => options.wireframePass?.getTextureNode("output") ?? BLACK)
      case "lightingOnly":
        return cached("lightingOnly", () => options.lightingOnlyPass?.getTextureNode("output") ?? BLACK)
      case "reflectionOnly":
        return cached("reflectionOnly", () => options.reflectionOnlyPass?.getTextureNode("output") ?? BLACK)
      case "overdraw":
        return cached(
          "overdraw",
          () => typedNode<Vec4Node>(options.overdrawPass?.getTextureNode("output") ?? BLACK).r,
        )
      case "overdrawVisual":
        return cached(
          "overdrawVisual",
          () => typedNode<Vec4Node>(options.overdrawVisualPass?.getTextureNode("output") ?? BLACK).r,
        )
      case "lightComplexity":
        return cached(
          "lightComplexity",
          () => typedNode<Vec4Node>(options.lightComplexityPass?.getTextureNode("output") ?? BLACK).r,
        )
      case "shaderCost":
        return cached(
          "shaderCost",
          () => typedNode<Vec4Node>(options.shaderCostPass?.getTextureNode("output") ?? BLACK).r,
        )
      default:
        return cached("beauty", () => scenePass.getTextureNode("output"))
    }
  }
}

function createMaterialNode(channels: MaterialDebugChannels): Vec4Node {
  return vec4(
    channels.roughness ? float(safeMaterialRoughness) : float(0),
    channels.metalness ? float(safeMaterialMetalness) : float(0),
    channels.ao ? float(safeMaterialAO) : float(0),
    channels.opacity ? float(typedNode<FloatNode>(materialOpacity)) : float(1),
  )
}

function packScalar(node: FloatNode): Vec4Node {
  return vec4(node, node, node, 1)
}

function toVec4(node: Vec3Node): Vec4Node {
  return vec4(node.x, node.y, node.z, 1)
}

function typedNode<TNode extends DebugNode>(node: unknown): TNode {
  return node as TNode
}
