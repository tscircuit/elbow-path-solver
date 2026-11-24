import { test, expect } from "bun:test"
import { ElbowPathPipelineSolver } from "../lib/index"
import { expectValidPath } from "./helpers"

test("straight line when points share y and no obstacles", () => {
  const solver = new ElbowPathPipelineSolver({
    rects: [],
    pointA: { x: 0, y: 10 },
    pointB: { x: 50, y: 10 },
  })
  solver.solve()
  const { path } = solver.getOutput()
  expect(path).toEqual([
    { x: 0, y: 10 },
    { x: 50, y: 10 },
  ])
})

test("aligned points blocked by a long rect must route around", () => {
  const rects = [{ minX: 20, minY: 5, maxX: 30, maxY: 15 }]
  const solver = new ElbowPathPipelineSolver({
    rects,
    pointA: { x: 0, y: 10 },
    pointB: { x: 50, y: 10 },
  })
  solver.solve()
  const { path } = solver.getOutput()
  expectValidPath(path, { x: 0, y: 10 }, { x: 50, y: 10 }, rects)
})

test("accepts a single rect object like the README example", () => {
  const solver = new ElbowPathPipelineSolver({
    rects: { minX: 20, minY: 5, maxX: 30, maxY: 15 },
    pointA: { x: 0, y: 10 },
    pointB: { x: 50, y: 10 },
  })
  solver.solve()
  const { path } = solver.getOutput()
  expectValidPath(path, { x: 0, y: 10 }, { x: 50, y: 10 }, [
    { minX: 20, minY: 5, maxX: 30, maxY: 15 },
  ])
})
