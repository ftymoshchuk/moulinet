// Path data read back as points, so a test can check what was drawn. It knows
// only what the drawing writes: M, then relative c and l (or absolute L, which
// the blade uses), and Z. Anything else, or a number run into the one before it,
// is an error, so a change in the way paths are written is noticed here.

/**
 * The shapes in `d`, each as `{ points, controls, closed }`: every point the
 * path reaches, in order, starting with where it began (a closed curve ends on
 * its start again), the control points of its curves, and whether it was shut.
 */
export function readPath(d) {
  const shapes = [];
  let shape = null;
  let x = 0;
  let y = 0;
  for (const [, op, args] of d.matchAll(/([A-Za-z])([^A-Za-z]*)/g)) {
    const n = args.trim() === "" ? [] : args.trim().split(/\s+/).map(Number);
    if (n.some((v) => !Number.isFinite(v))) throw new Error(`not a number in "${op}${args}"`);
    if (op === "M") {
      [x, y] = n;
      shape = { points: [[x, y]], controls: [], closed: false };
      shapes.push(shape);
    } else if (op === "c" || op === "l") {
      const step = op === "c" ? 6 : 2;
      if (!shape || n.length === 0 || n.length % step) throw new Error(`"${op}" takes groups of ${step} numbers: "${args}"`);
      for (let i = 0; i < n.length; i += step) {
        if (op === "c") shape.controls.push([x + n[i], y + n[i + 1]], [x + n[i + 2], y + n[i + 3]]);
        x += n[i + step - 2];
        y += n[i + step - 1];
        shape.points.push([x, y]);
      }
    } else if (op === "L") {
      if (!shape || n.length === 0 || n.length % 2) throw new Error(`"L" takes pairs of numbers: "${args}"`);
      for (let i = 0; i < n.length; i += 2) {
        [x, y] = [n[i], n[i + 1]];
        shape.points.push([x, y]);
      }
    } else if (op === "Z" || op === "z") {
      if (!shape) throw new Error("a path cannot start by closing");
      shape.closed = true;
      [x, y] = shape.points[0];
    } else {
      throw new Error(`unexpected command "${op}"`);
    }
  }
  return shapes;
}

/** Every string of path data in a drawing, which is nested objects of them. */
export function allPaths(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (value && typeof value === "object") Object.values(value).forEach((v) => allPaths(v, out));
  return out;
}

/** The corners of the box round every point of `shapes`. */
export function boxOf(shapes) {
  const points = shapes.flatMap((shape) => shape.points);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}
