export interface ElbowSolverPoint {
  x: number
  y: number
}

export interface ElbowSolverRect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface ElbowPathPipelineSolverInput {
  /** Obstacle rects the path must avoid. A single rect object is also accepted. */
  rects: ElbowSolverRect[] | ElbowSolverRect
  pointA: ElbowSolverPoint
  pointB: ElbowSolverPoint
  /** Safety cap on search iterations (default 300) */
  maxIterations?: number
}

const EPS = 1e-9

type Pt = ElbowSolverPoint

const horizontal = (a: Pt, b: Pt) => a.y === b.y

/**
 * Strict-interior intersection between an axis-aligned segment and a rect.
 * Touching the rect boundary is not a collision.
 */
export const segmentIntersectsRect = (
  a: Pt,
  b: Pt,
  r: ElbowSolverRect,
): boolean => {
  const x1 = Math.min(a.x, b.x)
  const x2 = Math.max(a.x, b.x)
  const y1 = Math.min(a.y, b.y)
  const y2 = Math.max(a.y, b.y)
  const ox = Math.min(x2, r.maxX) - Math.max(x1, r.minX)
  const oy = Math.min(y2, r.maxY) - Math.max(y1, r.minY)
  if (a.x === b.x) {
    return oy > EPS && a.x > r.minX + EPS && a.x < r.maxX - EPS
  }
  return ox > EPS && a.y > r.minY + EPS && a.y < r.maxY - EPS
}

const firstCollision = (
  path: Pt[],
  rects: ElbowSolverRect[],
): { segIndex: number; rect: ElbowSolverRect } | null => {
  for (let i = 0; i < path.length - 1; i++) {
    for (const rect of rects) {
      if (segmentIntersectsRect(path[i]!, path[i + 1]!, rect)) {
        return { segIndex: i, rect }
      }
    }
  }
  return null
}

const countCollisions = (path: Pt[], rects: ElbowSolverRect[]): number => {
  let n = 0
  for (let i = 0; i < path.length - 1; i++) {
    for (const rect of rects) {
      if (segmentIntersectsRect(path[i]!, path[i + 1]!, rect)) {
        n++
        break
      }
    }
  }
  return n
}

const pathLength = (path: Pt[]): number => {
  let len = 0
  for (let i = 0; i < path.length - 1; i++) {
    len +=
      Math.abs(path[i + 1]!.x - path[i]!.x) +
      Math.abs(path[i + 1]!.y - path[i]!.y)
  }
  return len
}

/** Remove zero-length segments and merge collinear consecutive segments. */
export const normalizePath = (path: Pt[]): Pt[] => {
  let pts = path.map((p) => ({ x: p.x, y: p.y }))
  let changed = true
  while (changed) {
    changed = false
    // drop zero-length segments (skip index 0 so the start point is stable)
    for (let i = 1; i < pts.length; i++) {
      if (pts[i]!.x === pts[i - 1]!.x && pts[i]!.y === pts[i - 1]!.y) {
        pts.splice(i, 1)
        changed = true
        break
      }
    }
    if (changed) continue
    // merge collinear consecutive segments
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1]!
      const b = pts[i]!
      const c = pts[i + 1]!
      const collinear =
        (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)
      if (collinear) {
        pts.splice(i, 1)
        changed = true
        break
      }
    }
  }
  return pts
}

const keyOf = (path: Pt[]): string =>
  path.map((p) => `${round9(p.x)},${round9(p.y)}`).join(";")

const round9 = (v: number) => Math.round(v * 1e9) / 1e9

/**
 * Solves orthogonal "elbow" paths between two points around obstacle rects
 * using the elbow-shift method described in the README:
 *
 * 1. A base elbow path is computed (a Z shape through the midpoint).
 * 2. Colliding segments are shifted orthogonally to midlines of the empty
 *    space between the colliding rect and the nearest constraint (another
 *    rect, or one of the two endpoints).
 * 3. Shifting an end segment inserts a perpendicular connector so the path
 *    stays attached to its endpoint; shifting an interior segment elongates
 *    or shortens the adjacent segments.
 */
export class ElbowPathPipelineSolver {
  rects: ElbowSolverRect[]
  pointA: Pt
  pointB: Pt
  maxIterations: number

  iterations = 0
  solved = false
  failed = false
  private outputPath: Pt[] | null = null

  constructor(input: ElbowPathPipelineSolverInput) {
    this.rects = Array.isArray(input.rects) ? input.rects : [input.rects]
    this.pointA = { x: input.pointA.x, y: input.pointA.y }
    this.pointB = { x: input.pointB.x, y: input.pointB.y }
    this.maxIterations = input.maxIterations ?? 300
  }

  private basePaths(): Pt[][] {
    const { pointA: A, pointB: B } = this
    const midX = (A.x + B.x) / 2
    const midY = (A.y + B.y) / 2
    const hFirst = normalizePath([
      { ...A },
      { x: midX, y: A.y },
      { x: midX, y: B.y },
      { ...B },
    ])
    const vFirst = normalizePath([
      { ...A },
      { x: A.x, y: midY },
      { x: B.x, y: midY },
      { ...B },
    ])
    return [hFirst, vFirst]
  }

  /**
   * Candidate positions for shifting a segment past the colliding rect C,
   * one per direction along the shift axis. Each position is the midline of
   * the empty space between C's far edge and the nearest constraint beyond
   * it (another rect or an endpoint), or just clear of C when the space is
   * open.
   */
  private shiftCandidates(
    seg: [Pt, Pt],
    C: ElbowSolverRect,
  ): { axis: "x" | "y"; positions: number[] } {
    const axis: "x" | "y" = horizontal(seg[0], seg[1]) ? "y" : "x"
    // span of the segment on the cross axis, used to decide which rects constrain
    const crossAxis = axis === "x" ? "y" : "x"
    const c1 = crossAxis === "x" ? "minX" : "minY"
    const c2 = crossAxis === "x" ? "maxX" : "maxY"
    const lo = Math.min(seg[0][crossAxis], seg[1][crossAxis])
    const hi = Math.max(seg[0][crossAxis], seg[1][crossAxis])

    const overlapsSpan = (r: ElbowSolverRect) =>
      Math.min(hi, r[c2]) - Math.max(lo, r[c1]) > -EPS

    const minA = axis === "x" ? "minX" : "minY"
    const maxA = axis === "x" ? "maxX" : "maxY"

    // clearance fallback when open space has no constraint: small fraction of scene
    const sceneSize =
      Math.max(
        ...this.rects.flatMap((r) => [r.maxX, r.maxY]),
        this.pointA.x,
        this.pointA.y,
        this.pointB.x,
        this.pointB.y,
      ) -
      Math.min(
        ...this.rects.flatMap((r) => [r.minX, r.minY]),
        this.pointA.x,
        this.pointA.y,
        this.pointB.x,
        this.pointB.y,
      )
    const clearance = Math.max(sceneSize * 0.01, 1e-6)

    const positions: number[] = []
    for (const dir of [1, -1] as const) {
      const farEdge = dir === 1 ? C[maxA] : C[minA]
      // nearest constraint edge beyond the far edge
      let nearest: number | null = null
      const consider = (edge: number) => {
        if (dir === 1 ? edge > farEdge + EPS : edge < farEdge - EPS) {
          if (
            nearest === null ||
            (dir === 1 ? edge < nearest : edge > nearest)
          ) {
            nearest = edge
          }
        }
      }
      for (const r of this.rects) {
        if (!overlapsSpan(r)) continue
        consider(dir === 1 ? r[minA] : r[maxA])
      }
      for (const p of [this.pointA, this.pointB]) {
        consider(p[axis])
      }
      positions.push(
        nearest === null
          ? farEdge + dir * clearance
          : (farEdge + nearest) / 2,
      )
    }
    return { axis, positions }
  }

  /** Shift segment i of the path to a new position along the orthogonal axis. */
  private shiftPath(path: Pt[], i: number, axis: "x" | "y", pos: number): Pt[] {
    const pts = path.map((p) => ({ x: p.x, y: p.y }))
    const last = pts.length - 2 // index of the final segment
    if (i === 0 && i === last) {
      // the whole path is one segment: shifting it detaches both endpoints,
      // so insert a connector at each end
      const a = pts[0]!
      const b = pts[pts.length - 1]!
      const connA = { x: a.x, y: a.y }
      connA[axis] = pos
      const connB = { x: b.x, y: b.y }
      connB[axis] = pos
      return normalizePath([{ ...a }, connA, connB, { ...b }])
    }
    if (i === 0) {
      // shifting the first segment inserts a connector so the path stays on A
      const a = pts[0]!
      const connector = { x: a.x, y: a.y }
      connector[axis] = pos
      pts[1] = { ...pts[1]!, [axis]: pos }
      pts.splice(1, 0, connector)
    } else if (i === last) {
      const b = pts[pts.length - 1]!
      const connector = { x: b.x, y: b.y }
      connector[axis] = pos
      pts[pts.length - 2] = { ...pts[pts.length - 2]!, [axis]: pos }
      pts.splice(pts.length - 1, 0, connector)
    } else {
      pts[i] = { ...pts[i]!, [axis]: pos }
      pts[i + 1] = { ...pts[i + 1]!, [axis]: pos }
    }
    return normalizePath(pts)
  }

  solve() {
    if (this.pointA.x === this.pointB.x && this.pointA.y === this.pointB.y) {
      this.solved = true
      this.outputPath = [{ ...this.pointA }]
      return
    }
    interface State {
      path: Pt[]
      collisions: number
      length: number
    }
    const seen = new Set<string>()
    const queue: State[] = []
    const push = (path: Pt[]) => {
      if (path.length < 2) return
      const first = path[0]!
      const lastPt = path[path.length - 1]!
      if (first.x !== this.pointA.x || first.y !== this.pointA.y) return
      if (lastPt.x !== this.pointB.x || lastPt.y !== this.pointB.y) return
      const key = keyOf(path)
      if (seen.has(key)) return
      seen.add(key)
      queue.push({
        path,
        collisions: countCollisions(path, this.rects),
        length: pathLength(path),
      })
    }
    for (const base of this.basePaths()) push(base)

    while (queue.length > 0 && this.iterations < this.maxIterations) {
      this.iterations++
      queue.sort(
        (a, b) => a.collisions - b.collisions || a.length - b.length,
      )
      const state = queue.shift()!
      if (state.collisions === 0) {
        this.solved = true
        this.outputPath = state.path
        return
      }
      const hit = firstCollision(state.path, this.rects)
      if (!hit) continue
      const seg: [Pt, Pt] = [
        state.path[hit.segIndex]!,
        state.path[hit.segIndex + 1]!,
      ]
      const { axis, positions } = this.shiftCandidates(seg, hit.rect)
      for (const pos of positions) {
        push(this.shiftPath(state.path, hit.segIndex, axis, pos))
      }
    }
    this.failed = true
  }

  getOutput(): { path: Pt[] | null } {
    return { path: this.outputPath }
  }
}
