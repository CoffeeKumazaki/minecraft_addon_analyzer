import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RotateCcw, RefreshCw, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GeometryDef, GeometryCube, Vec3 } from '@/analyzer/geometry-parser'
import {
  BOX_FACES, SIDE_FACES, DEG, type FaceName,
  toScenePoint, toSceneRotation, cubeFaceUVs, faceMaterialInstance,
  resolveBoneParents, isModelTooComplex, cubeSceneCenter,
} from '@/lib/bedrock-geometry'

/** Texture URL per face of a plain 16×16×16 block */
export type CubeFaceTextures = Partial<Record<FaceName, string>>

export type ModelViewerProps = (
  | {
      geometry: GeometryDef
      /** Default texture for faces without a specific material */
      textureSrc?: string
      /** Block material_instances: instance or face name → texture URL */
      materialTextures?: Record<string, string>
      cubeFaces?: never
    }
  | { cubeFaces: CubeFaceTextures; geometry?: never; textureSrc?: never; materialTextures?: never }
) & {
  height?: number
  /** Direction from the model center towards the camera (scene space) */
  cameraDirection?: [number, number, number]
}

/** Bedrock entities face north (-Z in scene space); view them from the north-west (front-right) */
const DEFAULT_CAMERA_DIRECTION: [number, number, number] = [-0.7, 0.45, -1]

class ModelTooComplexError extends Error {}

/** Picks the material for a face from its material_instance name, falling back by face direction */
type MaterialResolver = (face: FaceName, instance: string | undefined) => THREE.Material

function toVector3(v: Vec3): THREE.Vector3 {
  return new THREE.Vector3(v[0], v[1], v[2])
}

function toSceneEuler(rotation?: Vec3): THREE.Euler {
  const [x, y, z] = toSceneRotation(rotation)
  return new THREE.Euler(x, y, z, 'ZYX')
}

function buildCubeMesh(
  cube: GeometryCube,
  texW: number,
  texH: number,
  resolveMaterial: MaterialResolver,
  hiddenMaterial: THREE.Material,
): THREE.Mesh {
  const inflate = cube.inflate ?? 0
  const [sx, sy, sz] = cube.size
  const box = new THREE.BoxGeometry(sx + inflate * 2, sy + inflate * 2, sz + inflate * 2)

  const faceUVs = cubeFaceUVs(cube)
  const uvAttr = box.getAttribute('uv') as THREE.BufferAttribute
  const materials: THREE.Material[] = []
  BOX_FACES.forEach((face, i) => {
    const uvs = faceUVs[face]
    // Faces omitted from a per-face UV definition are not rendered
    materials.push(uvs ? resolveMaterial(face, faceMaterialInstance(cube, face)) : hiddenMaterial)
    uvs?.forEach(([u, v], j) => uvAttr.setXY(i * 4 + j, u / texW, 1 - v / texH))
  })

  // A single material avoids one draw call per face when every face is visible
  return new THREE.Mesh(box, singleOrArray(materials))
}

function singleOrArray(materials: THREE.Material[]): THREE.Material | THREE.Material[] {
  return materials.every(m => m === materials[0]) ? materials[0] : materials
}

/** Build a three.js object hierarchy from a Bedrock geometry definition */
function buildModel(
  geometry: GeometryDef,
  texW: number,
  texH: number,
  resolveMaterial: MaterialResolver,
  hiddenMaterial: THREE.Material,
): THREE.Group {
  const { parents, maxDepth } = resolveBoneParents(geometry)
  if (isModelTooComplex(geometry, maxDepth)) throw new ModelTooComplexError()

  const root = new THREE.Group()
  const groups = geometry.bones.map(bone => {
    const group = new THREE.Group()
    group.name = bone.name
    group.rotation.copy(toSceneEuler(bone.rotation))
    return group
  })

  geometry.bones.forEach((bone, i) => {
    const group = groups[i]
    const pivot = toVector3(toScenePoint(bone.pivot))
    const parentIdx = parents[i]
    const parentPivot = parentIdx != null ? toVector3(toScenePoint(geometry.bones[parentIdx].pivot)) : new THREE.Vector3()
    group.position.copy(pivot).sub(parentPivot)
    ;(parentIdx != null ? groups[parentIdx] : root).add(group)

    for (const cube of bone.cubes) {
      const mesh = buildCubeMesh(cube, texW, texH, resolveMaterial, hiddenMaterial)
      const center = toVector3(cubeSceneCenter(cube))

      if (cube.rotation) {
        const cubePivot = cube.pivot ? toVector3(toScenePoint(cube.pivot)) : center.clone()
        const pivotGroup = new THREE.Group()
        pivotGroup.position.copy(cubePivot).sub(pivot)
        pivotGroup.rotation.copy(toSceneEuler(cube.rotation))
        mesh.position.copy(center).sub(cubePivot)
        pivotGroup.add(mesh)
        group.add(pivotGroup)
      } else {
        mesh.position.copy(center).sub(pivot)
        group.add(mesh)
      }
    }
  })

  return root
}

function loadTexture(src: string): Promise<THREE.Texture | null> {
  return new Promise(resolve => {
    new THREE.TextureLoader().load(
      src,
      tex => {
        tex.magFilter = THREE.NearestFilter
        tex.minFilter = THREE.NearestFilter
        tex.generateMipmaps = false
        tex.colorSpace = THREE.SRGBColorSpace
        resolve(tex)
      },
      undefined,
      () => resolve(null),
    )
  })
}

type LoadedContent = {
  object: THREE.Object3D
  materials: THREE.Material[]
  textures: THREE.Texture[]
}

function texturedMaterial(tex: THREE.Texture | null): THREE.Material {
  return tex
    ? new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.1, side: THREE.DoubleSide })
    : new THREE.MeshLambertMaterial({ color: 0xb0b0b0, side: THREE.DoubleSide })
}

function disposeContent(content: LoadedContent) {
  content.object.traverse(obj => {
    if (obj instanceof THREE.Mesh) obj.geometry.dispose()
  })
  content.materials.forEach(m => m.dispose())
  content.textures.forEach(t => t.dispose())
}

async function loadGeometryContent(
  geometry: GeometryDef,
  textureSrc: string | undefined,
  materialTextures: Record<string, string>,
): Promise<LoadedContent> {
  const urls = [...new Set([textureSrc, ...Object.values(materialTextures)].filter((u): u is string => !!u))]
  const loaded = await Promise.all(urls.map(loadTexture))
  const textures = loaded.filter((t): t is THREE.Texture => t != null)
  const defaultTex = textureSrc ? loaded[urls.indexOf(textureSrc)] : (loaded.find(t => t != null) ?? null)
  // UVs are in geometry texture space; fall back to the default texture's pixel size
  const img = defaultTex?.image as { width?: number; height?: number } | undefined
  const texW = geometry.textureWidth ?? img?.width ?? 64
  const texH = geometry.textureHeight ?? img?.height ?? 64

  const defaultMaterial = texturedMaterial(defaultTex)
  const hiddenMaterial = new THREE.MeshBasicMaterial({ visible: false })
  const materialByUrl = new Map<string, THREE.Material>()
  urls.forEach((url, i) => {
    materialByUrl.set(url, url === textureSrc ? defaultMaterial : texturedMaterial(loaded[i]))
  })
  const lookup = (name: string | undefined) => {
    const url = name ? materialTextures[name] : undefined
    return url ? materialByUrl.get(url) : undefined
  }
  const resolveMaterial: MaterialResolver = (face, instance) =>
    lookup(instance) ?? lookup(face) ?? (SIDE_FACES.has(face) ? lookup('sides') : undefined) ?? lookup('*') ?? defaultMaterial
  const materials = [defaultMaterial, hiddenMaterial, ...[...materialByUrl.values()].filter(m => m !== defaultMaterial)]

  try {
    return {
      object: buildModel(geometry, texW, texH, resolveMaterial, hiddenMaterial),
      materials,
      textures,
    }
  } catch (err) {
    materials.forEach(m => m.dispose())
    textures.forEach(t => t.dispose())
    throw err
  }
}

/** Full block: each face shows its whole texture, default BoxGeometry UVs keep sides upright */
async function loadCubeContent(faces: CubeFaceTextures): Promise<LoadedContent> {
  const urls = [...new Set(Object.values(faces).filter((u): u is string => !!u))]
  const loaded = await Promise.all(urls.map(loadTexture))
  const texByUrl = new Map(urls.map((u, i) => [u, loaded[i]]))
  const materialByUrl = new Map<string | undefined, THREE.Material>()
  const materials = BOX_FACES.map(face => {
    const url = faces[face]
    let mat = materialByUrl.get(url)
    if (!mat) {
      mat = texturedMaterial((url && texByUrl.get(url)) || null)
      materialByUrl.set(url, mat)
    }
    return mat
  })
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(16, 16, 16), singleOrArray(materials))
  mesh.position.y = 8
  return {
    object: mesh,
    materials: [...materialByUrl.values()],
    textures: loaded.filter((t): t is THREE.Texture => t != null),
  }
}

// Stable per-object ids so a new GeometryDef with the same identifier still gets a fresh session
const geometryIds = new WeakMap<GeometryDef, number>()
let nextGeometryId = 1
function geometrySessionId(geometry: GeometryDef): number {
  let id = geometryIds.get(geometry)
  if (id == null) {
    id = nextGeometryId++
    geometryIds.set(geometry, id)
  }
  return id
}

/** Serialize a string map in a key-order independent way so it can be compared by value */
function stableMapKey(map: Record<string, string> | undefined): string {
  return map ? JSON.stringify(Object.entries(map).sort(([a], [b]) => a.localeCompare(b))) : ''
}

/**
 * Each distinct model gets its own viewer session (remounted via key), so error state
 * from a failed attempt never leaks into, or blocks, the next attempt.
 */
export function ModelViewer(props: ModelViewerProps) {
  // Shape identifies the mesh; textures may change while the shape (and thus the camera view) stays
  const shapeKey = props.cubeFaces ? 'cube' : `geo|${props.geometry ? geometrySessionId(props.geometry) : 0}`
  const sessionKey = props.cubeFaces
    ? `cube|${JSON.stringify(BOX_FACES.map(f => props.cubeFaces[f] ?? null))}`
    : `${shapeKey}|${props.textureSrc ?? ''}|${stableMapKey(props.materialTextures)}`
  return <ModelViewerShapeScope key={shapeKey} {...props} shapeKey={shapeKey} sessionKey={sessionKey} />
}

/**
 * Lives as long as the shape stays the same (remounted on geometry change), so the view and
 * rotation setting survive texture swaps but reset for a different model.
 */
function ModelViewerShapeScope({ shapeKey, sessionKey, ...props }: ModelViewerProps & { shapeKey: string; sessionKey: string }) {
  const [autoRotate, setAutoRotate] = useState(true)
  const savedViewRef = useRef<SavedView | null>(null)
  return (
    <ModelViewerSession
      key={sessionKey}
      {...props}
      shapeKey={shapeKey}
      savedViewRef={savedViewRef}
      autoRotate={autoRotate}
      setAutoRotate={setAutoRotate}
    />
  )
}

type SavedView = { shapeKey: string; position: THREE.Vector3; target: THREE.Vector3 }

type SessionProps = ModelViewerProps & {
  shapeKey: string
  savedViewRef: React.RefObject<SavedView | null>
  autoRotate: boolean
  setAutoRotate: React.Dispatch<React.SetStateAction<boolean>>
}

function ModelViewerSession({
  geometry, textureSrc, materialTextures, cubeFaces, height = 360, cameraDirection = DEFAULT_CAMERA_DIRECTION,
  shapeKey, savedViewRef, autoRotate, setAutoRotate,
}: SessionProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const autoRotateRef = useRef(autoRotate)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    autoRotateRef.current = autoRotate
    if (controlsRef.current) controlsRef.current.autoRotate = autoRotate
  }, [autoRotate])

  // Compare by value so a freshly built object each render doesn't rebuild the scene
  const cubeFacesKey = cubeFaces ? JSON.stringify(BOX_FACES.map(f => cubeFaces[f] ?? null)) : null
  const materialTexturesKey = stableMapKey(materialTextures)
  const [camX, camY, camZ] = cameraDirection

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let disposed = false
    const fail = (message: string) => {
      if (!disposed) setError(message)
    }

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      // Defer so the state update doesn't happen synchronously inside the effect
      queueMicrotask(() => fail('3D preview is unavailable: WebGL could not be initialized in this browser.'))
      return () => { disposed = true }
    }
    renderer.setPixelRatio(window.devicePixelRatio || 1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.add(new THREE.AmbientLight(0xffffff, 1.6))
    const sun = new THREE.DirectionalLight(0xffffff, 1.4)
    sun.position.set(0.6, 1, -0.8)
    scene.add(sun)

    const grid = new THREE.GridHelper(64, 4, 0x4a7bb0, 0x25507d)
    const gridMaterial = grid.material as THREE.Material
    gridMaterial.transparent = true
    gridMaterial.opacity = 0.5
    scene.add(grid)

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 5000)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.autoRotate = autoRotateRef.current
    controls.autoRotateSpeed = 1.5
    controlsRef.current = controls
    // Stop auto-rotation as soon as the user grabs the model
    const onStart = () => setAutoRotate(false)
    controls.addEventListener('start', onStart)

    const resize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      if (w === 0 || h === 0) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)

    // Render loop runs only while the viewer is on screen and the model is ready
    let frameId = 0
    let ready = false
    let visible = true
    const loop = () => {
      frameId = 0
      if (!visible) return
      controls.update()
      renderer.render(scene, camera)
      frameId = requestAnimationFrame(loop)
    }
    const startLoop = () => {
      if (ready && visible && !frameId && !disposed) frameId = requestAnimationFrame(loop)
    }
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      startLoop()
    })
    visibilityObserver.observe(container)

    let content: LoadedContent | null = null
    let load: Promise<LoadedContent>
    if (cubeFacesKey) {
      const urls = JSON.parse(cubeFacesKey) as (string | null)[]
      const faces: CubeFaceTextures = {}
      BOX_FACES.forEach((f, i) => { if (urls[i]) faces[f] = urls[i]! })
      load = loadCubeContent(faces)
    } else if (geometry) {
      const materials = materialTexturesKey ? Object.fromEntries(JSON.parse(materialTexturesKey) as [string, string][]) : {}
      load = loadGeometryContent(geometry, textureSrc, materials)
    } else {
      load = Promise.reject(new Error('No model'))
    }

    load.then(loaded => {
      if (disposed) { disposeContent(loaded); return }
      content = loaded
      scene.add(loaded.object)

      // Frame the model
      const bounds = new THREE.Box3().setFromObject(loaded.object)
      const center = bounds.getCenter(new THREE.Vector3())
      const radius = Math.max(bounds.getSize(new THREE.Vector3()).length() / 2, 1)
      const distance = radius / Math.sin((camera.fov * DEG) / 2) * 1.05
      const dir = new THREE.Vector3(camX, camY, camZ).normalize()
      camera.position.copy(center).addScaledVector(dir, distance)
      camera.near = distance / 100
      camera.far = distance * 100
      camera.updateProjectionMatrix()
      controls.target.copy(center)
      controls.update()
      controls.saveState()
      // Restore the previous view when only the textures changed
      const saved = savedViewRef.current
      if (saved && saved.shapeKey === shapeKey) {
        camera.position.copy(saved.position)
        controls.target.copy(saved.target)
        controls.update()
      }

      ready = true
      startLoop()
    }).catch(err => {
      fail(err instanceof ModelTooComplexError
        ? '3D preview skipped: the model is too complex to display.'
        : '3D preview failed to load this model.')
    })

    return () => {
      disposed = true
      if (frameId) cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      visibilityObserver.disconnect()
      controls.removeEventListener('start', onStart)
      controls.dispose()
      controlsRef.current = null
      if (content) {
        savedViewRef.current = { shapeKey, position: camera.position.clone(), target: controls.target.clone() }
        disposeContent(content)
      }
      grid.geometry.dispose()
      gridMaterial.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [geometry, textureSrc, materialTexturesKey, cubeFacesKey, camX, camY, camZ, shapeKey, savedViewRef, setAutoRotate])

  const handleReset = () => {
    controlsRef.current?.reset()
  }

  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 border border-border-light bg-secondary/50 text-xs text-muted-foreground" style={{ height }}>
        <TriangleAlert className="h-4 w-4" />
        <span>{error}</span>
      </div>
    )
  }

  return (
    <div className="relative border border-border-light bg-secondary/50" style={{ height }}>
      <div ref={containerRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
      <div className="absolute top-2 right-2 flex gap-1">
        <button
          type="button"
          onClick={() => setAutoRotate(v => !v)}
          title="Auto rotate"
          className={cn(
            'p-1.5 border border-border bg-card hover:bg-secondary transition-colors',
            autoRotate && 'bg-accent text-accent-foreground hover:bg-accent/90',
          )}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleReset}
          title="Reset view"
          className="p-1.5 border border-border bg-card hover:bg-secondary transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="absolute bottom-2 left-2 text-[10px] text-muted-foreground pointer-events-none select-none">
        Drag: rotate · Scroll: zoom · Right-drag: pan
      </p>
    </div>
  )
}
