import { test, expect } from "bun:test"
import { ElbowPathPipelineSolver } from "../lib/index"
import { expectValidPath } from "./helpers"

// rect blocking the first segment right at the start
test("avoids a rect blocking the first segment near pointA", () => {
  const rects = [{ minX: 10, minY: -5, maxX: 80, maxY: 5 }]
  const solver = new ElbowPathPipelineSolver({
    rects,
    pointA: { x: 0, y: 0 },
    pointB: { x: 100, y: 0 },
  })
  solver.solve()
  const { path } = solver.getOutput()
  expectValidPath(path, { x: 0, y: 0 }, { x: 100, y: 0 }, rects)
})
