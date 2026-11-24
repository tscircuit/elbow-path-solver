import { test, expect } from "bun:test"
import { ElbowPathPipelineSolver } from "../lib/index"
import { expectValidPath } from "./helpers"

// rect directly in the way of the base path middle segment
test("avoids a rect blocking the middle segment", () => {
  const rects = [{ minX: 40, minY: -10, maxX: 60, maxY: 40 }]
  const solver = new ElbowPathPipelineSolver({
    rects,
    pointA: { x: 0, y: 0 },
    pointB: { x: 100, y: 50 },
  })
  solver.solve()
  const { path } = solver.getOutput()
  expectValidPath(path, { x: 0, y: 0 }, { x: 100, y: 50 }, rects)
})
