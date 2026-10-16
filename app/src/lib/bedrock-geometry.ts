import type { GeometryDef, GeometryCube, Vec3 } from '@/analyzer/geometry-parser'

/**
 * Renderer-independent helpers for Bedrock geometry.
 *
 * "Scene space" follows Blockbench (and the Minecraft world): +X east, +Y up, -Z north.
 * Bedrock model files store X mirrored, so points and rotations are converted with toScene*.
 */

export type FaceName = 'east' | 'west' | 'up' | 'down' | 'south' | 'north'
/** Face order of THREE.BoxGeometry groups: +x, -x, +y, -y, +z, -z */
export const BOX_FACES: FaceName[] = ['east', 'west', 'up', 'down', 'south', 'north']
export const SIDE_FACES = new Set<FaceName>(['east', 'west', 'south', 'north'])

// Upper bounds for untrusted add-on models; beyond these renderers refuse to draw
export const MAX_BONES = 2000
export const MAX_CUBES = 10000
export const MAX_BONE_DEPTH = 128

export const DEG = Math.PI / 180

/** [u1, v1, u2, v2] in geometry texture pixels */
type FaceUVRect = [number, number, number, number]
export type UV = [number, number]

export function toScenePoint([x, y, z]: Vec3): Vec3 {
  return [-x, y, z]
}

/** Euler angles in radians for intrinsic 'ZYX' order (matrix = Rz · Ry · Rx) */
export function toSceneRotation(rotation?: Vec3): Vec3 {
  const [rx, ry, rz] = rotation ?? [0, 0, 0]
  return [-rx * DEG, -ry * DEG, rz * DEG]
}

/** Box UV layout (Blockbench convention), returns [u1, v1, u2, v2] per face in texture pixels */
function boxUVRects(cube: GeometryCube, [u, v]: UV): Record<FaceName, FaceUVRect> {
  const [sx, sy, sz] = cube.size.map(s => Math.floor(s + 1e-7))
  const faces: { face: FaceName; from: UV; size: UV }[] = [
    { face: 'east', from: [0, sz], size: [sz, sy] },
    { face: 'west', from: [sz + sx, sz], size: [sz, sy] },
    { face: 'up', from: [sz + sx, sz], size: [-sx, -sz] },
    { face: 'down', from: [sz + sx * 2, 0], size: [-sx, sz] },
    { face: 'south', from: [sz * 2 + sx, sz], size: [sx, sy] },
    { face: 'north', from: [sz, sz], size: [sx, sy] },
  ]
  if (cube.mirror) {
    for (const f of faces) {
      f.from[0] += f.size[0]
      f.size[0] *= -1
    }
    const east = faces[0]
    faces[0] = { ...faces[1], face: 'east' }
    faces[1] = { ...east, face: 'west' }
  }
  const rects = {} as Record<FaceName, FaceUVRect>
  for (const f of faces) {
    rects[f.face] = [u + f.from[0], v + f.from[1], u + f.from[0] + f.size[0], v + f.from[1] + f.size[1]]
  }
  return rects
}

function faceUVRects(cube: GeometryCube): Partial<Record<FaceName, FaceUVRect>> {
  // Bedrock defaults to box UV at [0, 0]
  if (!cube.uv) return boxUVRects(cube, [0, 0])
  if (Array.isArray(cube.uv)) return boxUVRects(cube, cube.uv)

  const rects: Partial<Record<FaceName, FaceUVRect>> = {}
  for (const face of BOX_FACES) {
    const fd = cube.uv[face]
    if (!fd) continue
    const [u, v] = fd.uv
    const [w, h] = fd.uvSize
    // Bedrock stores up/down per-face UVs inverted relative to the side faces
    rects[face] = face === 'up' || face === 'down'
      ? [u + w, v + h, u, v]
      : [u, v, u + w, v + h]
  }
  return rects
}

/** Clockwise quarter turns of a per-face UV (format 1.21.0+) */
function faceRotationSteps(cube: GeometryCube, face: FaceName): number {
  if (!cube.uv || Array.isArray(cube.uv)) return 0
  const deg = cube.uv[face]?.rotation ?? 0
  return ((Math.round(deg / 90) % 4) + 4) % 4
}

/**
 * UVs (texture pixels) for each face's corners in BoxGeometry vertex order:
 * top-left, top-right, bottom-left, bottom-right. Faces omitted from a per-face UV are absent.
 */
export function cubeFaceUVs(cube: GeometryCube): Partial<Record<FaceName, [UV, UV, UV, UV]>> {
  const rects = faceUVRects(cube)
  const result: Partial<Record<FaceName, [UV, UV, UV, UV]>> = {}
  for (const face of BOX_FACES) {
    const rect = rects[face]
    if (!rect) continue
    const [u1, v1, u2, v2] = rect
    // Corners in clockwise order: top-left, top-right, bottom-right, bottom-left
    const corners: UV[] = [[u1, v1], [u2, v1], [u2, v2], [u1, v2]]
    // Rotating the texture clockwise shifts each corner's UV one position clockwise
    const steps = faceRotationSteps(cube, face)
    const [tl, tr, br, bl] = corners.map((_, k) => corners[(k - steps + 4) % 4])
    result[face] = [tl, tr, bl, br]
  }
  return result
}

export function faceMaterialInstance(cube: GeometryCube, face: FaceName): string | undefined {
  return cube.uv && !Array.isArray(cube.uv) ? cube.uv[face]?.materialInstance : undefined
}

/**
 * Resolve each bone's parent index and depth, detaching bones that would close a cycle.
 * Linear time: every bone is walked once.
 */
export function resolveBoneParents(geometry: GeometryDef): { parents: (number | undefined)[]; depth: number[]; maxDepth: number } {
  const bones = geometry.bones
  const boneIndex = new Map<string, number>()
  bones.forEach((bone, i) => { if (bone.name && !boneIndex.has(bone.name)) boneIndex.set(bone.name, i) })
  const parents = bones.map(b => (b.parent != null ? boneIndex.get(b.parent) : undefined))

  const depth = new Array<number>(bones.length).fill(-1)
  let maxDepth = 0
  for (let i = 0; i < bones.length; i++) {
    if (depth[i] >= 0) continue
    const path: number[] = []
    const onPath = new Set<number>()
    let cur = i as number | undefined
    while (cur != null && depth[cur] < 0 && !onPath.has(cur)) {
      path.push(cur)
      onPath.add(cur)
      cur = parents[cur]
    }
    if (cur != null && onPath.has(cur)) {
      // Cycle: attach the bone where the walk re-entered the path to the root
      parents[cur] = undefined
      depth[cur] = 0
    }
    for (let k = path.length - 1; k >= 0; k--) {
      const b = path[k]
      if (depth[b] >= 0) continue
      const p = parents[b]
      depth[b] = p == null ? 0 : depth[p] + 1
      maxDepth = Math.max(maxDepth, depth[b])
    }
  }
  return { parents, depth, maxDepth }
}

export function isModelTooComplex(geometry: GeometryDef, maxDepth: number): boolean {
  return geometry.bones.length > MAX_BONES || geometry.cubes.length > MAX_CUBES || maxDepth > MAX_BONE_DEPTH
}

/** Cube center in scene space (X mirrored: from = -(origin.x + size.x)) */
export function cubeSceneCenter(cube: GeometryCube): Vec3 {
  const [ox, oy, oz] = cube.origin
  const [sx, sy, sz] = cube.size
  return [-(ox + sx) + sx / 2, oy + sy / 2, oz + sz / 2]
}

// ---- Minimal affine math (3×4 row-major) for renderers without three.js ----

type Mat = number[] // [m00, m01, m02, tx, m10, m11, m12, ty, m20, m21, m22, tz]

const IDENTITY: Mat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]

function translation([x, y, z]: Vec3): Mat {
  return [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z]
}

/** Rz · Ry · Rx, matching THREE.Euler order 'ZYX' */
function rotationZYX([a, b, c]: Vec3): Mat {
  const ca = Math.cos(a), sa = Math.sin(a)
  const cb = Math.cos(b), sb = Math.sin(b)
  const cc = Math.cos(c), sc = Math.sin(c)
  return [
    cc * cb, cc * sb * sa - sc * ca, cc * sb * ca + sc * sa, 0,
    sc * cb, sc * sb * sa + cc * ca, sc * sb * ca - cc * sa, 0,
    -sb, cb * sa, cb * ca, 0,
  ]
}

function mul(a: Mat, b: Mat): Mat {
  const r = new Array<number>(12)
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 4; j++) {
      r[i * 4 + j] = a[i * 4] * b[j] + a[i * 4 + 1] * b[4 + j] + a[i * 4 + 2] * b[8 + j] + (j === 3 ? a[i * 4 + 3] : 0)
    }
  }
  return r
}

function applyPoint(m: Mat, [x, y, z]: Vec3): Vec3 {
  return [
    m[0] * x + m[1] * y + m[2] * z + m[3],
    m[4] * x + m[5] * y + m[6] * z + m[7],
    m[8] * x + m[9] * y + m[10] * z + m[11],
  ]
}

function applyDirection(m: Mat, [x, y, z]: Vec3): Vec3 {
  return [
    m[0] * x + m[1] * y + m[2] * z,
    m[4] * x + m[5] * y + m[6] * z,
    m[8] * x + m[9] * y + m[10] * z,
  ]
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export type WorldFace = {
  face: FaceName
  /** Scene-space corners: top-left, top-right, bottom-left, bottom-right */
  corners: [Vec3, Vec3, Vec3, Vec3]
  normal: Vec3
  uvs: [UV, UV, UV, UV]
  materialInstance?: string
}

/** Local corner signs per face (BoxGeometry vertex order) and outward normal */
const FACE_LAYOUT: Record<FaceName, { corners: [Vec3, Vec3, Vec3, Vec3]; normal: Vec3 }> = {
  east: { corners: [[1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1]], normal: [1, 0, 0] },
  west: { corners: [[-1, 1, -1], [-1, 1, 1], [-1, -1, -1], [-1, -1, 1]], normal: [-1, 0, 0] },
  up: { corners: [[-1, 1, -1], [1, 1, -1], [-1, 1, 1], [1, 1, 1]], normal: [0, 1, 0] },
  down: { corners: [[-1, -1, 1], [1, -1, 1], [-1, -1, -1], [1, -1, -1]], normal: [0, -1, 0] },
  south: { corners: [[-1, 1, 1], [1, 1, 1], [-1, -1, 1], [1, -1, 1]], normal: [0, 0, 1] },
  north: { corners: [[1, 1, -1], [-1, 1, -1], [1, -1, -1], [-1, -1, -1]], normal: [0, 0, -1] },
}

/**
 * Every textured cube face of a geometry in scene space, with bone and cube
 * pivots/rotations, inflate and the Bedrock X mirror applied.
 * Returns null when the model exceeds the complexity limits.
 */
export function computeWorldFaces(geometry: GeometryDef): WorldFace[] | null {
  const { parents, depth, maxDepth } = resolveBoneParents(geometry)
  if (isModelTooComplex(geometry, maxDepth)) return null

  // Parents always have a smaller depth, so processing by depth fills world matrices in order
  const order = geometry.bones.map((_, i) => i).sort((a, b) => depth[a] - depth[b])
  const world: Mat[] = new Array(geometry.bones.length)
  for (const i of order) {
    const bone = geometry.bones[i]
    const p = parents[i]
    const pivot = toScenePoint(bone.pivot)
    const parentPivot: Vec3 = p != null ? toScenePoint(geometry.bones[p].pivot) : [0, 0, 0]
    const local = mul(translation(sub(pivot, parentPivot)), rotationZYX(toSceneRotation(bone.rotation)))
    world[i] = p != null ? mul(world[p], local) : mul(IDENTITY, local)
  }

  const faces: WorldFace[] = []
  geometry.bones.forEach((bone, i) => {
    const bonePivot = toScenePoint(bone.pivot)
    for (const cube of bone.cubes) {
      const center = cubeSceneCenter(cube)
      let cubeMat: Mat
      if (cube.rotation) {
        const cubePivot = cube.pivot ? toScenePoint(cube.pivot) : center
        cubeMat = mul(
          mul(translation(sub(cubePivot, bonePivot)), rotationZYX(toSceneRotation(cube.rotation))),
          translation(sub(center, cubePivot)),
        )
      } else {
        cubeMat = translation(sub(center, bonePivot))
      }
      const m = mul(world[i], cubeMat)
      const inflate = cube.inflate ?? 0
      const half: Vec3 = [cube.size[0] / 2 + inflate, cube.size[1] / 2 + inflate, cube.size[2] / 2 + inflate]
      const uvs = cubeFaceUVs(cube)
      for (const face of BOX_FACES) {
        const faceUVs = uvs[face]
        if (!faceUVs) continue
        const layout = FACE_LAYOUT[face]
        faces.push({
          face,
          corners: layout.corners.map(s => applyPoint(m, [s[0] * half[0], s[1] * half[1], s[2] * half[2]])) as WorldFace['corners'],
          normal: applyDirection(m, layout.normal),
          uvs: faceUVs,
          materialInstance: faceMaterialInstance(cube, face),
        })
      }
    }
  })
  return faces
}
