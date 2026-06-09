import { Suspense, useMemo, useRef } from "react"
import { useFrame, useLoader } from "@react-three/fiber"
import { Html, OrbitControls, useGLTF, useProgress } from "@react-three/drei"
import { isSocialCapture } from "../demo/capture-mode"
import { CaptureCamera } from "./CaptureCamera"
import { HdrEnvironment } from "./HdrEnvironment"
import {
  DataTexture,
  DoubleSide,
  Color,
  Group,
  IcosahedronGeometry,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  UnsignedByteType,
  type Texture,
} from "three"

export type DemoSceneVariant = "main" | "overdraw" | "lights"

const DAMAGED_HELMET_URL = `${import.meta.env.BASE_URL}models/DamagedHelmet/glTF/DamagedHelmet.gltf`
const textureRoot = `${import.meta.env.BASE_URL}textures/cliff_side`
const vegetationRoot = `${import.meta.env.BASE_URL}textures/vegetation`

useGLTF.preload(DAMAGED_HELMET_URL)

const vegetationTexturePaths = [
  `${vegetationRoot}/grassbushcc005.png`,
  `${vegetationRoot}/grassbushcc006.png`,
  `${vegetationRoot}/grassbushcc007.png`,
  `${vegetationRoot}/grassbushcc008.png`,
  `${vegetationRoot}/vegetation_fern_01.png`,
] as const

const shrubPlacements = [
  { position: [-3.05, -0.9, -1.18] as const, scale: 0.98, rotation: -0.42, cards: 8 },
  { position: [-2.18, -0.94, -0.72] as const, scale: 0.72, rotation: 0.25, cards: 5 },
  { position: [-1.48, -0.91, -1.06] as const, scale: 1.18, rotation: -0.15, cards: 18 },
  { position: [-1.32, -0.92, -1.0] as const, scale: 1.08, rotation: 0.46, cards: 16 },
  { position: [-0.54, -0.96, -0.62] as const, scale: 0.78, rotation: 0.52, cards: 6 },
  { position: [0.16, -0.93, -1.02] as const, scale: 1.22, rotation: -0.38, cards: 20 },
  { position: [0.34, -0.94, -0.94] as const, scale: 1.08, rotation: 0.7, cards: 16 },
  { position: [1.02, -0.96, -0.7] as const, scale: 0.76, rotation: 0.35, cards: 6 },
  { position: [1.72, -0.91, -1.16] as const, scale: 1.16, rotation: 0.12, cards: 18 },
  { position: [1.88, -0.92, -1.08] as const, scale: 1.02, rotation: -0.62, cards: 15 },
  { position: [2.75, -0.94, -0.78] as const, scale: 0.82, rotation: -0.56, cards: 5 },
  { position: [3.22, -0.93, -1.35] as const, scale: 0.96, rotation: 0.44, cards: 8 },
] as const

const grassPlacements = Array.from({ length: 58 }, (_, index) => {
  const lane = index % 13
  const row = Math.floor(index / 13)

  return {
    position: [
      -3.65 + lane * 0.62 + Math.sin(index * 2.1) * 0.1,
      -0.96,
      0.04 - row * 0.34 + Math.cos(index * 1.7) * 0.09,
    ] as const,
    scale: 0.34 + (index % 5) * 0.06,
    rotation: Math.sin(index * 1.31) * 0.72,
  }
})

const rockPlacements = [
  { position: [-3.2, -0.38, -2.18] as const, rotation: [0.08, -0.52, -0.16] as const, scale: [1.65, 1.34, 0.92] as const, seed: 3 },
  { position: [-1.72, -0.2, -2.42] as const, rotation: [-0.04, 0.28, 0.08] as const, scale: [1.8, 1.65, 1.0] as const, seed: 9 },
  { position: [-0.08, -0.08, -2.58] as const, rotation: [0.12, -0.18, -0.1] as const, scale: [1.9, 1.86, 1.05] as const, seed: 15 },
  { position: [1.62, -0.18, -2.4] as const, rotation: [-0.08, 0.44, 0.12] as const, scale: [1.72, 1.52, 0.94] as const, seed: 21 },
  { position: [3.05, -0.35, -2.2] as const, rotation: [0.06, 0.62, -0.08] as const, scale: [1.45, 1.28, 0.88] as const, seed: 27 },
  { position: [-2.35, -0.72, -1.62] as const, rotation: [0.2, 0.18, -0.28] as const, scale: [0.92, 0.7, 0.66] as const, seed: 34 },
  { position: [2.34, -0.74, -1.56] as const, rotation: [-0.12, -0.28, 0.16] as const, scale: [0.98, 0.72, 0.7] as const, seed: 41 },
] as const

function Loader() {
  const { progress } = useProgress()
  return (
    <Html center>
      <div
        style={{
          color: "white",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          userSelect: "none",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 8 }}>
          Loading scene...
        </div>
        <div
          style={{
            background: "rgba(255,255,255,0.15)",
            borderRadius: 0,
            height: 4,
            overflow: "hidden",
            width: 160,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 0,
              height: "100%",
              transition: "width 0.2s ease",
              width: `${progress}%`,
            }}
          />
        </div>
        <div style={{ fontSize: 12, marginTop: 8, opacity: 0.5 }}>
          {progress.toFixed(0)}%
        </div>
      </div>
    </Html>
  )
}

function Helmet() {
  const ref = useRef<Group>(null!)
  const { scene } = useGLTF(DAMAGED_HELMET_URL)

  useFrame((_, delta) => {
    ref.current.rotation.y += delta * 0.5
  })

  return <primitive ref={ref} object={scene} position={[0, 0.55, 0]} scale={0.62} />
}

function createSolidTexture(r: number, g: number, b: number, a = 255, size = 512) {
  const data = new Uint8Array(size * size * 4)
  for (let index = 0; index < data.length; index += 4) {
    data[index] = r
    data[index + 1] = g
    data[index + 2] = b
    data[index + 3] = a
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.needsUpdate = true
  return texture
}

function createStripeTexture(size = 1024) {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4
      const stripe = (Math.sin((x + y * 0.45) * 0.045) + 1) * 0.5
      const ring = (Math.sin(Math.hypot(x - size * 0.5, y - size * 0.45) * 0.04) + 1) * 0.5
      const value = 72 + stripe * 84 + ring * 28
      data[index] = value
      data[index + 1] = value
      data[index + 2] = value
      data[index + 3] = 255
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(1.4, 1.4)
  texture.needsUpdate = true
  return texture
}

function createNormalTexture(size = 1024) {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4
      const ridge = Math.sin(x * 0.08) * Math.cos(y * 0.065)
      data[index] = 128 + ridge * 42
      data[index + 1] = 128 + Math.sin((x + y) * 0.04) * 32
      data[index + 2] = 190
      data[index + 3] = 255
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(2, 2)
  texture.needsUpdate = true
  return texture
}

const textureSet = {
  albedo: createStripeTexture(),
  normal: createNormalTexture(),
  roughness: createSolidTexture(170, 170, 170, 255, 1024),
  metalness: createSolidTexture(45, 45, 45, 255, 1024),
  clearcoat: createSolidTexture(235, 235, 235, 255, 1024),
  transmission: createSolidTexture(225, 225, 225, 255, 1024),
  ao: createSolidTexture(180, 180, 180, 255, 1024),
  alpha: createSolidTexture(255, 255, 255, 190, 1024),
  emissive: createSolidTexture(210, 210, 210, 255, 1024),
}

const costSamples = [
  {
    label: "Basic",
    material: new MeshBasicMaterial({
      color: "#f2f2f2",
      toneMapped: false,
    }),
    position: [-3.25, 0, 0] as const,
  },
  {
    label: "Standard",
    material: new MeshStandardMaterial({
      color: "#bdbdbd",
      metalness: 0.05,
      roughness: 0.72,
    }),
    position: [-1.95, 0, 0] as const,
  },
  {
    label: "Mapped PBR",
    material: new MeshStandardMaterial({
      color: "#d8d8d8",
      map: textureSet.albedo,
      metalness: 0.25,
      metalnessMap: textureSet.metalness,
      normalMap: textureSet.normal,
      roughness: 0.55,
      roughnessMap: textureSet.roughness,
    }),
    position: [-0.65, 0, 0] as const,
  },
  {
    label: "Layered",
    material: new MeshPhysicalMaterial({
      clearcoat: 0.92,
      clearcoatMap: textureSet.clearcoat,
      color: "#a6a6a6",
      envMapIntensity: 1.4,
      iridescence: 0.65,
      normalMap: textureSet.normal,
      roughness: 0.22,
      sheen: 0.7,
    }),
    position: [0.65, 0, 0] as const,
  },
  {
    label: "POM stack",
    material: new MeshPhysicalMaterial({
      alphaMap: textureSet.alpha,
      aoMap: textureSet.ao,
      clearcoat: 0.85,
      clearcoatMap: textureSet.clearcoat,
      color: "#e6e6e6",
      emissive: "#2a2a2a",
      emissiveIntensity: 0.18,
      emissiveMap: textureSet.emissive,
      envMapIntensity: 1.6,
      iridescence: 0.75,
      map: textureSet.albedo,
      metalness: 0.35,
      metalnessMap: textureSet.metalness,
      normalMap: textureSet.normal,
      opacity: 0.78,
      roughness: 0.16,
      roughnessMap: textureSet.roughness,
      sheen: 0.8,
      side: DoubleSide,
      transparent: true,
      transmission: 0.28,
      transmissionMap: textureSet.transmission,
    }),
    position: [1.95, 0, 0] as const,
  },
  {
    label: "HDR Emissive",
    material: new MeshStandardMaterial({
      color: "#07171d",
      emissive: new Color("#2ecbff").multiplyScalar(5),
      emissiveIntensity: 1,
      metalness: 0.08,
      roughness: 0.32,
      toneMapped: false,
    }),
    position: [3.25, 0, 0] as const,
  },
]

function configureTiledTexture(texture: Texture, repeatX: number, repeatY: number) {
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(repeatX, repeatY)
  texture.needsUpdate = true
  return texture
}

function createGroundGeometry() {
  const geometry = new PlaneGeometry(8.8, 5.8, 88, 58)
  const position = geometry.attributes.position

  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index)
    const y = position.getY(index)
    const backSlope = Math.max(0, -y - 0.72)
    const foregroundDip = Math.max(0, y - 1.12)
    const height =
      Math.sin(x * 1.35 + y * 1.9) * 0.055 +
      Math.cos(x * 3.2 - y * 0.6) * 0.035 +
      backSlope * 0.18 -
      foregroundDip * 0.11
    position.setZ(index, height)
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

function createRockGeometry(seed: number) {
  const geometry = new IcosahedronGeometry(1, 4)
  const position = geometry.attributes.position

  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index)
    const y = position.getY(index)
    const z = position.getZ(index)
    const strata = Math.sin(y * 8.5 + seed) * 0.11
    const fracture = Math.sin((x + seed) * 7.1) * Math.cos((z - seed) * 5.8) * 0.09
    const ledge = Math.round((y + 1) * 5) / 5 - y
    const radius = 0.86 + strata + fracture + ledge * 0.28

    position.setXYZ(
      index,
      x * radius * (1 + Math.sin(seed) * 0.08),
      y * (0.9 + Math.cos(seed * 0.7) * 0.08),
      z * radius * (0.78 + Math.sin(seed * 1.3) * 0.08),
    )
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

function CliffEnvironment() {
  const [cliffColor, cliffNormal, cliffRoughness] = useLoader(TextureLoader, [
    `${textureRoot}/cliff_side_diff_1k.jpg`,
    `${textureRoot}/cliff_side_nor_gl_1k.jpg`,
    `${textureRoot}/cliff_side_rough_1k.jpg`,
  ])
  const groundGeometry = useMemo(createGroundGeometry, [])
  const rockGeometries = useMemo(
    () => rockPlacements.map((rock) => createRockGeometry(rock.seed)),
    [],
  )

  const cliffMaterial = useMemo(() => {
    cliffColor.colorSpace = SRGBColorSpace
    configureTiledTexture(cliffColor, 1.15, 1.35)
    configureTiledTexture(cliffNormal, 1.15, 1.35)
    configureTiledTexture(cliffRoughness, 1.15, 1.35)

    return new MeshStandardMaterial({
      color: "#b89972",
      map: cliffColor,
      normalMap: cliffNormal,
      roughnessMap: cliffRoughness,
      roughness: 0.94,
    })
  }, [cliffColor, cliffNormal, cliffRoughness])

  const groundMaterial = useMemo(() => {
    const colorMap = cliffColor.clone()
    const normalMap = cliffNormal.clone()
    const roughnessMap = cliffRoughness.clone()

    colorMap.colorSpace = SRGBColorSpace
    configureTiledTexture(colorMap, 2.8, 2.2)
    configureTiledTexture(normalMap, 2.8, 2.2)
    configureTiledTexture(roughnessMap, 2.8, 2.2)

    return new MeshStandardMaterial({
      color: "#6d7846",
      map: colorMap,
      normalMap,
      roughnessMap,
      roughness: 0.9,
    })
  }, [cliffColor, cliffNormal, cliffRoughness])

  return (
    <>
      <mesh geometry={groundGeometry} material={groundMaterial} position={[0, -1.05, -0.08]} rotation={[-Math.PI / 2, 0, 0]} />
      {rockPlacements.map((rock, index) => (
        <mesh
          key={rock.seed}
          geometry={rockGeometries[index]}
          material={cliffMaterial}
          position={rock.position}
          rotation={rock.rotation}
          scale={rock.scale}
        />
      ))}
    </>
  )
}

function ShrubCluster({
  cards,
  materials,
  position,
  rotation,
  scale,
}: {
  cards: number
  materials: readonly MeshStandardMaterial[]
  position: readonly [number, number, number]
  rotation: number
  scale: number
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      {Array.from({ length: cards }, (_, index) => {
        const offset = index - cards * 0.5
        const width = 0.72 + (index % 4) * 0.16
        const height = 0.78 + (index % 5) * 0.14

        return (
          <mesh
            key={index}
            material={materials[index % materials.length]}
            position={[offset * 0.04, 0.34 + (index % 4) * 0.025, -index * 0.012]}
            rotation={[0.015 * index, index * 0.73, Math.sin(index) * 0.14]}
            renderOrder={20 + index}
          >
            <planeGeometry args={[width, height, 5, 4]} />
          </mesh>
        )
      })}
    </group>
  )
}

function GrassTuft({
  geometry,
  materials,
  position,
  rotation,
  scale,
}: {
  geometry: PlaneGeometry
  materials: readonly MeshStandardMaterial[]
  position: readonly [number, number, number]
  rotation: number
  scale: number
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      {[0, 1, 2].map((index) => (
        <mesh
          key={index}
          geometry={geometry}
          material={materials[(index + 4) % materials.length]}
          rotation={[0, index * Math.PI / 3, 0]}
          renderOrder={40 + index}
        />
      ))}
    </group>
  )
}

function ShaderCostSamples() {
  const group = useRef<Group>(null!)

  useFrame((_, delta) => {
    group.current.rotation.y = Math.sin(performance.now() * 0.00035) * 0.08
    group.current.rotation.x += delta * 0.03
  })

  return (
    <group ref={group} position={[0, -1.45, 0]}>
      {costSamples.map((sample) => (
        <group key={sample.label} position={sample.position}>
          {sample.label === "HDR Emissive" ? (
            <pointLight color="#2ecbff" distance={2.4} intensity={16} />
          ) : null}
          <mesh material={sample.material}>
            <sphereGeometry args={[0.48, 72, 36]} />
          </mesh>
          <Html center position={[0, -0.74, 0]}>
            <span
              style={{
                background: "rgba(0, 0, 0, 0.64)",
                border: "1px solid rgba(255, 255, 255, 0.18)",
                borderRadius: 0,
                color: "white",
                fontFamily: "monospace",
                fontSize: 10,
                letterSpacing: "0.04em",
                padding: "4px 6px",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {sample.label}
            </span>
          </Html>
        </group>
      ))}
    </group>
  )
}

function FoliageOverdrawScene() {
  const group = useRef<Group>(null)
  const vegetationTextures = useLoader(TextureLoader, [...vegetationTexturePaths]) as Texture[]
  const grassBladeGeometry = useMemo(() => new PlaneGeometry(0.34, 0.58, 2, 4), [])
  const vegetationMaterials = useMemo(
    () =>
      vegetationTextures.map((texture) => {
        texture.colorSpace = SRGBColorSpace
        texture.needsUpdate = true

        return new MeshStandardMaterial({
          alphaMap: texture,
          alphaTest: 0.035,
          color: "#b7dc86",
          depthWrite: false,
          map: texture,
          opacity: 1,
          roughness: 0.78,
          side: DoubleSide,
          transparent: true,
        })
      }),
    [vegetationTextures],
  )

  useFrame(({ clock }) => {
    if (!group.current) return
    group.current.rotation.y = Math.sin(clock.elapsedTime * 0.2) * 0.045
    group.current.position.x = Math.sin(clock.elapsedTime * 0.17) * 0.04
  })

  return (
    <group ref={group}>
      <CliffEnvironment />
      {shrubPlacements.map((shrub) => (
        <ShrubCluster
          key={`${shrub.position.join(",")}-${shrub.cards}`}
          cards={shrub.cards}
          materials={vegetationMaterials}
          position={shrub.position}
          rotation={shrub.rotation}
          scale={shrub.scale}
        />
      ))}
      {grassPlacements.map((grass, index) => (
        <GrassTuft
          key={index}
          geometry={grassBladeGeometry}
          materials={vegetationMaterials}
          position={grass.position}
          rotation={grass.rotation}
          scale={grass.scale}
        />
      ))}
    </group>
  )
}

function MainDemoScene() {
  return (
    <>
      <color attach="background" args={["#050505"]} />
      <ambientLight intensity={0.3} />
      <directionalLight
        castShadow
        intensity={2}
        position={[5, 5, 5]}
        shadow-mapSize-height={1024}
        shadow-mapSize-width={1024}
      />
      <OrbitControls enableDamping makeDefault />
      {isSocialCapture() ? <CaptureCamera variant="main" /> : null}
      <Suspense fallback={<Loader />}>
        <HdrEnvironment />
        <Helmet />
        <ShaderCostSamples />
      </Suspense>
    </>
  )
}

function LightOverlapScene() {
  const roomMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#141414",
        metalness: 0,
        roughness: 0.92,
      }),
    [],
  )

  return (
    <group>
      <mesh material={roomMaterial} position={[0, 0, -2.4]} receiveShadow>
        <planeGeometry args={[8, 5]} />
      </mesh>
      <mesh material={roomMaterial} position={[0, -1.2, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[8, 8]} />
      </mesh>
      <mesh material={roomMaterial} position={[0, 0.2, 0]}>
        <icosahedronGeometry args={[0.55, 1]} />
      </mesh>
      <pointLight color="#ff6b4a" distance={2.8} intensity={18} position={[-0.8, 0.8, 0.4]} />
      <pointLight color="#ffd166" distance={2.6} intensity={16} position={[0.2, 0.6, 0.2]} />
      <pointLight color="#4cc9f0" distance={2.5} intensity={14} position={[0.9, 0.5, -0.1]} />
      <pointLight color="#b5179e" distance={2.4} intensity={12} position={[-0.2, 0.2, 0.8]} />
      <pointLight color="#80ed99" distance={2.2} intensity={10} position={[0.5, -0.1, 0.7]} />
    </group>
  )
}

function LightsDemoScene() {
  return (
    <>
      <color attach="background" args={["#050505"]} />
      <ambientLight intensity={0.04} />
      <OrbitControls enableDamping makeDefault maxDistance={6} minDistance={2.4} target={[0, 0, 0]} />
      <LightOverlapScene />
    </>
  )
}

function OverdrawDemoScene() {
  return (
    <>
      <color attach="background" args={["#121a14"]} />
      <fog attach="fog" args={["#121a14", 4.4, 8.4]} />
      <ambientLight intensity={0.58} />
      <directionalLight position={[2.6, 4.2, 3.8]} intensity={2.35} />
      <directionalLight color="#b7d7ff" position={[-3, 2, -2]} intensity={0.72} />
      <OrbitControls enableDamping makeDefault maxDistance={7} minDistance={2.2} target={[0, -0.28, -1.42]} />
      {isSocialCapture() ? <CaptureCamera variant="overdraw" /> : null}
      <FoliageOverdrawScene />
    </>
  )
}

export function Scene({ variant = "main" }: { variant?: DemoSceneVariant }) {
  if (variant === "overdraw") return <OverdrawDemoScene />
  if (variant === "lights") return <LightsDemoScene />
  return <MainDemoScene />
}
