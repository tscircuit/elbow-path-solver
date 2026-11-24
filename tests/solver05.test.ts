import { test, expect } from "bun:test"
import { ElbowPathPipelineSolver } from "../lib/index"
import { expectValidPath } from "./helpers"

test("routes below three staggered walls", () => {
  const rects = [
    { minX: 20, minY: -50, maxX: 30, maxY: 30 },
    { minX: 45, minY: -20, maxX: 55, maxY: 60 },
    { minX: 70, minY: -50, maxX: 80, maxY: 30 },
  ]
  const A = { x: 0, y: 0 }
  const B = { x: 100, y: 10 }
  const solver = new ElbowPathPipelineSolver({ rects, pointA: A, pointB: B })
  solver.solve()
  expectValidPath(solver.getOutput().path, A, B, rects)
})

test("solves when pointB is up and left of pointA", () => {
  const rects = [{ minX: 40, minY: -10, maxX: 60, maxY: 40 }]
  const A = { x: 100, y: 50 }
  const B = { x: 0, y: 0 }
  const solver = new ElbowPathPipelineSolver({ rects, pointA: A, pointB: B })
  solver.solve()
  expectValidPath(solver.getOutput().path, A, B, rects)
})

test("a point fully boxed in fails gracefully without hanging", () => {
  const solver = new ElbowPathPipelineSolver({
    rects: [{ minX: -10, minY: -10, maxX: 10, maxY: 10 }],
    pointA: { x: 0, y: 0 },
    pointB: x100y0(),
    maxIterations: 100,
  })
  solver.solve()
  expect(solver.solved).toBe(false)
  expect(solver.getOutput().path).toBeNull()
})

function x100y0() {
  return { x: 100, y: 0 }
}

test("identical endpoints yield a trivial one-point path", () => {
  const solver = new ElbowPathPipelineSolver({
    rects: [],
    pointA: { x: 5, y: 5 },
    pointB: { x: 5, y: 5 },
  })
  solver.solve()
  expect(solver.getOutput().path).toEqual([{ x: 5, y: 5 }])
})
