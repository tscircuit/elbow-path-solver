export interface Pt {
  x: number
  y: number
}
export interface Rect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export const isOrthogonal = (path: Pt[]): boolean => {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!
    const b = path[i + 1]!
    if (a.x !== b.x && a.y !== b.y) return false
  }
  return true
}

export const hasZeroLengthSegment = (path: Pt[]): boolean => {
  for (let i = 0; i < path.length - 1; i++) {
    if (path[i]!.x === path[i + 1]!.x && path[i]!.y === path[i + 1]!.y)
      return true
  }
  return false
}

// strict interior intersection of an axis-aligned segment with a rect
export const segmentIntersectsRect = (
  a: Pt,
  b: Pt,
  r: Rect,
  eps = 1e-9,
): boolean => {
  const x1 = Math.min(a.x, b.x)
  const x2 = Math.max(a.x, b.x)
  const y1 = Math.min(a.y, b.y)
  const y2 = Math.max(a.y, b.y)
  // overlap in x and y must both be positive-area or positive-length along segment
  const ox = Math.min(x2, r.maxX) - Math.max(x1, r.minX)
  const oy = Math.min(y2, r.maxY) - Math.max(y1, r.minY)
  if (a.x === b.x) {
    // vertical segment: must overlap in y, and x strictly inside rect
    return oy > eps && a.x > r.minX + eps && a.x < r.maxX - eps
  }
  return ox > eps && a.y > r.minY + eps && a.y < r.maxY - eps
}

export const pathCollides = (path: Pt[], rects: Rect[]): boolean => {
  for (let i = 0; i < path.length - 1; i++) {
    for (const r of rects) {
      if (segmentIntersectsRect(path[i]!, path[i + 1]!, r)) return true
    }
  }
  return false
}

export const endpointsMatch = (path: Pt[], A: Pt, B: Pt): boolean =>
  path.length >= 2 &&
  path[0]!.x === A.x &&
  path[0]!.y === A.y &&
  path[path.length - 1]!.x === B.x &&
  path[path.length - 1]!.y === B.y

export const expectValidPath = (
  path: Pt[] | null,
  A: Pt,
  B: Pt,
  rects: Rect[],
) => {
  if (path === null) throw new Error("expected a path, got null")
  if (!endpointsMatch(path, A, B))
    throw new Error(`endpoints do not match: ${JSON.stringify(path)}`)
  if (!isOrthogonal(path))
    throw new Error(`path is not orthogonal: ${JSON.stringify(path)}`)
  if (hasZeroLengthSegment(path))
    throw new Error(`path has zero-length segments: ${JSON.stringify(path)}`)
  if (pathCollides(path, rects))
    throw new Error(`path collides with rects: ${JSON.stringify(path)}`)
}
