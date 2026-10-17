// Pen-and-ink primitives, as SVG path data: smooth curves through points,
// tapered brush strokes, and hatching. Everything takes and gives plain numbers,
// so it can be run and checked without a page.

const RAD = Math.PI / 180;

// A number as short as the eye can tell apart on the stage.
function num(n) {
  const r = Math.round(n * 10) / 10;
  return Object.is(r, -0) ? "0" : String(r);
}

/** A point as path data. */
export function pt(p) {
  return `${num(p[0])} ${num(p[1])}`;
}

export function add(a, b) {
  return [a[0] + b[0], a[1] + b[1]];
}

export function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1]];
}

export function mul(a, k) {
  return [a[0] * k, a[1] * k];
}

export function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function dist(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** The unit vector from a to b, or (1, 0) where they coincide. */
export function unit(a, b) {
  const l = dist(a, b);
  return l < 1e-9 ? [1, 0] : [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
}

/** The vector turned a quarter circle anticlockwise. */
export function perp(v) {
  return [-v[1], v[0]];
}

export function rotate(v, degrees) {
  const c = Math.cos(degrees * RAD);
  const s = Math.sin(degrees * RAD);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
}

/** Twice the signed area of a polygon. */
export function area(points) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a;
}

/** The points wound one way, whichever way they came, so shapes drawn together merge as one. */
export function wound(points) {
  return area(points) < 0 ? points.slice().reverse() : points;
}

/**
 * A smooth curve through `points`. Each point is left in the direction of the
 * line between its neighbours, with a handle a third as long as the stretch to
 * the next point, so a curve never overshoots or loops. A point given a third
 * item, `[x, y, 1]`, is a corner: the curve comes to it and turns.
 */
export function curve(points, closed = true) {
  const n = points.length;
  if (n < 2) return "";
  const at = (i) => points[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  const heading = (i) => {
    if (at(i)[2]) return [0, 0];
    return unit(at(i - 1), at(i + 1));
  };
  let d = `M${pt(at(0))}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p = at(i);
    const q = at(i + 1);
    const k = dist(p, q) / 3;
    const a = heading(i);
    const b = heading(i + 1);
    d += `C${pt([p[0] + a[0] * k, p[1] + a[1] * k])} ${pt([q[0] - b[0] * k, q[1] - b[1] * k])} ${pt(q)}`;
  }
  return closed ? `${d}Z` : d;
}

/** A closed smooth shape, wound the same way as every other. */
export function blob(points) {
  return curve(wound(points), true);
}

/** Points along a smooth curve through `points`, `count` of them, for drawing a stroke along it. */
function along(points, count) {
  if (points.length === 2) {
    return Array.from({ length: count }, (_, i) => lerp(points[0], points[1], i / (count - 1)));
  }
  // Three points: a quadratic bend through the middle one.
  if (points.length === 3) {
    const [a, m, b] = points;
    const c = [2 * m[0] - (a[0] + b[0]) / 2, 2 * m[1] - (a[1] + b[1]) / 2];
    return Array.from({ length: count }, (_, i) => {
      const t = i / (count - 1);
      const u = 1 - t;
      return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
    });
  }
  // More: straight pieces, enough of them to read as a curve.
  const out = [];
  const segments = points.length - 1;
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) * segments;
    const s = Math.min(segments - 1, Math.floor(t));
    out.push(lerp(points[s], points[s + 1], t - s));
  }
  return out;
}

/**
 * A stroke that swells and ends in points, like a pen lifted off the paper: a
 * filled shape along a line or a bend through two or three points, `width`
 * across at its fullest, which comes `swell` of the way along.
 */
export function brush(points, width, swell = 0.45) {
  const line = along(points, 7);
  const left = [];
  const right = [];
  for (let i = 0; i < line.length; i++) {
    const t = i / (line.length - 1);
    // Zero at both ends, one at `swell`.
    const u = t < swell ? t / swell : (1 - t) / (1 - swell);
    const w = (width / 2) * Math.sin((u * Math.PI) / 2) ** 0.8;
    const dir = unit(line[Math.max(0, i - 1)], line[Math.min(line.length - 1, i + 1)]);
    const n = perp(dir);
    left.push([line[i][0] + n[0] * w, line[i][1] + n[1] * w]);
    right.push([line[i][0] - n[0] * w, line[i][1] - n[1] * w]);
  }
  return `M${[...left, ...right.reverse()].map(pt).join("L")}Z`;
}

/** A thin line through points, as a curve that is not closed. */
export function line(points) {
  return curve(points, false);
}

/**
 * Short strokes side by side along the line from `a` to `b`, each leaving it
 * at `angle` degrees from the line's normal and `length` long, growing and
 * shrinking toward the ends of the band, like the hatching that shades a fold.
 */
export function hatch(a, b, { count = 6, length = 5, angle = 35, width = 0.7, side = 1 } = {}) {
  const along = unit(a, b);
  const normal = mul(perp(along), side);
  let d = "";
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const start = lerp(a, b, t);
    // Longest in the middle, short at the ends.
    const l = length * (0.45 + 0.55 * Math.sin(t * Math.PI));
    const dir = add(mul(normal, Math.cos(angle * RAD)), mul(along, Math.sin(angle * RAD)));
    d += brush([start, add(start, mul(dir, l))], width, 0.3);
  }
  return d;
}
