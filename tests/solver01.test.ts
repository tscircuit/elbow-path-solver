import { test, expect } from "bun:test"
import { ElbowPathPipelineSolver } from "../lib/index"
import { expectValidPath } from "./helpers"

test("documented API exists and solves unobstructed points", () => {
  const solver = new ElbowPathPipelineSolver({
    rects: [],
    pointA: { x: 0, y: 0 },
    pointB: { x: 100, y: 50 },
  })
  solver.solve()
  const { path } = solver.getOutput()
  expectValidPath(path, { x: 0, y: 0 }, { x: 100, y: 50 }, [])
})
