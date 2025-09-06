# @tscircuit/elbow-path-solver

Solve schematic traces using the "elbow-shift" method

```tsx
import { ElbowPathPipelineSolver } from "@tscircuit/elbow-path-solver"

const solver = new ElbowPathPipelineSolver({
  rects: {  minX, maxX, minY, maxY },
  pointA: { x, y },
  pointB: { x, y }
})

solver.solve()

solver.getOutput()
// { path: Array<{ x: number, y: number }> }

```

## Algorithm Overview

The premise is as follows:

You start with a set of rects and two points to connect (PA and PB)

You compute an elbow path using calculate-elbow.

You check each segment for collisions.

If a segment has a collision, you add the rect (C) it collided with to the
CollisionRectSet.

From the current segment position, you have two new segment shifts to
explore, if you move the segment to mid(PA, C) and mid mid(PB, C)

Every time a shifted segment has a collision, you consider the two possible paths
that can be explored using the two mid lines created between the new colliding rect,
and the nearest rect in the CollisionRectSet or the bounds defined by PA and PB

When shifting a segment, you always shift orthogonal to the segments position.

When shifting a segment, it causes the adjacent segments to be elongated or shortened,
if they are elongated you must check for collisions in the same manner.

Generated paths are always orthogonal lines (90 degree turns only)

Note that the mid function considers the middle of the empty space between two points/rects
or a point and a rect. So if point `P` is to the left of `R` then `midX(P, R) = (p.x + R.minX)/2`

The `calculate-elbow` module is used to create the "basePath"
