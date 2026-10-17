// Pen-and-ink primitives, as SVG path data: smooth curves through points and
// tapered brush strokes. Everything takes and gives plain numbers, so it can be
// run and checked without a page.

const RAD = Math.PI / 180;

// A number as short as the eye can tell apart on the stage.
function num(n) {
  const r = Math.round(n * 10) / 10;
  return Object.is(r, -0) ? "0" : String(r);
}

// A whole number of tenths as text: 123 is "12.3" and -5 is "-0.5". The small
// ones, which are nearly all of them in a path of relative coordinates, are
// looked up rather than worked out.
const TENTHS = [];
function tenths(i) {
  if (i < -2000 || i > 2000) return String(i / 10);
  return (TENTHS[i + 2000] ??= String(i / 10));
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
 *
 * It is written in relative coordinates from the rounded point it has reached,
 * which is a third shorter than absolute ones and cannot drift.
 */
export function curve(points, closed = true) {
  const n = points.length;
  if (n < 2) return "";
  const hx = new Array(n);
  const hy = new Array(n);
  for (let i = 0; i < n; i++) {
    if (points[i][2]) {
      hx[i] = 0;
      hy[i] = 0;
      continue;
    }
    const a = points[closed ? (i + n - 1) % n : i > 0 ? i - 1 : 0];
    const b = points[closed ? (i + 1) % n : i < n - 1 ? i + 1 : n - 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    hx[i] = dx / l;
    hy[i] = dy / l;
  }
  let cx = Math.round(points[0][0] * 10);
  let cy = Math.round(points[0][1] * 10);
  let d = `M${tenths(cx)} ${tenths(cy)}`;
  for (let i = 0, last = closed ? n : n - 1; i < last; i++) {
    const j = i + 1 === n ? 0 : i + 1;
    const p = points[i];
    const q = points[j];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const k = Math.sqrt(dx * dx + dy * dy) / 3;
    const x1 = Math.round((p[0] + hx[i] * k) * 10);
    const y1 = Math.round((p[1] + hy[i] * k) * 10);
    const x2 = Math.round((q[0] - hx[j] * k) * 10);
    const y2 = Math.round((q[1] - hy[j] * k) * 10);
    const x = Math.round(q[0] * 10);
    const y = Math.round(q[1] * 10);
    d += `c${tenths(x1 - cx)} ${tenths(y1 - cy)} ${tenths(x2 - cx)} ${tenths(y2 - cy)} ${tenths(x - cx)} ${tenths(y - cy)}`;
    cx = x;
    cy = y;
  }
  return closed ? `${d}Z` : d;
}

/** A closed smooth shape, wound the same way as every other. */
export function blob(points) {
  return curve(wound(points), true);
}

/**
 * A closed smooth shape of solid ink, wound the way every brush stroke is, so it
 * and the strokes that cross it in one path stay solid.
 */
export function solid(points) {
  return curve(wound(points).reverse(), true);
}

// The way the light comes, on the page: from above and to the left.
const LIGHT = [-0.6, -0.8];

/**
 * The outline of a closed shape as a line of ink laid just outside it, with a
 * weight that changes as it goes round: `thin` where the shape faces the light,
 * `thick` where it turns away, as a pen presses harder on the shadow side, and a
 * little uneven, as a hand is. It is the outer edge of the line, as a shape of ink
 * that reaches over the whole shape; drawn first, with the shape filled over it,
 * only the line itself shows.
 */
export function ribbon(points, thin = 0.26, thick = 0.95) {
  const shape = wound(points);
  const n = shape.length;
  const outer = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = shape[(i + n - 1) % n];
    const b = shape[(i + 1) % n];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    // Wound this way, the inside of the shape is on the left of the way round.
    const nx = dy / l;
    const ny = -dx / l;
    const dark = 0.5 - 0.5 * (nx * LIGHT[0] + ny * LIGHT[1]);
    const hand = 0.82 + 0.36 * (((i * 7 + n * 3) % 11) / 10);
    const p = shape[i];
    // A point may say how much of the line it keeps (a fourth item): none, where the edge is only where another shape begins.
    const w = (thin + (thick - thin) * dark * dark * (3 - 2 * dark)) * hand * (p[3] ?? 1);
    outer[i] = p[2] ? [p[0] + nx * w, p[1] + ny * w, 1] : [p[0] + nx * w, p[1] + ny * w];
  }
  return curve(outer);
}

// A point `t` of the way along a stroke through two or three points (a bend
// through the middle one), more as straight pieces, and the direction it runs in.
function strokeAt(points, t) {
  const n = points.length;
  if (n === 2) {
    const [a, b] = points;
    return [[a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], unit(a, b)];
  }
  if (n === 3) {
    const [a, m, b] = points;
    const cx = 2 * m[0] - (a[0] + b[0]) / 2;
    const cy = 2 * m[1] - (a[1] + b[1]) / 2;
    const u = 1 - t;
    const dx = 2 * u * (cx - a[0]) + 2 * t * (b[0] - cx);
    const dy = 2 * u * (cy - a[1]) + 2 * t * (b[1] - cy);
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    return [[u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]], [dx / l, dy / l]];
  }
  const at = t * (n - 1);
  const i = Math.min(n - 2, Math.floor(at));
  return [lerp(points[i], points[i + 1], at - i), unit(points[i], points[i + 1])];
}

/**
 * A stroke that swells and ends in points, like a pen lifted off the paper: a
 * filled shape along a line or a bend through two or three points, `width`
 * across at its fullest, which comes `swell` of the way along. Eight corners
 * are enough for it to read as a lens.
 */
export function brush(points, width, swell = 0.45) {
  // Three places along it, where the sides are widest, and by how much of the full width.
  const left = [];
  const right = [];
  for (let k = 0; k < 3; k++) {
    const [p, dir] = strokeAt(points, [swell / 2, swell, swell + (1 - swell) / 2][k]);
    const w = (width / 2) * (k === 1 ? 1 : 0.76);
    left.push([p[0] - dir[1] * w, p[1] + dir[0] * w]);
    right.push([p[0] + dir[1] * w, p[1] - dir[0] * w]);
  }
  const corners = [points[0], ...left, points[points.length - 1], ...right.reverse()];
  let cx = Math.round(corners[0][0] * 10);
  let cy = Math.round(corners[0][1] * 10);
  let d = `M${tenths(cx)} ${tenths(cy)}l`;
  for (let i = 1; i < corners.length; i++) {
    const x = Math.round(corners[i][0] * 10);
    const y = Math.round(corners[i][1] * 10);
    d += `${i > 1 ? " " : ""}${tenths(x - cx)} ${tenths(y - cy)}`;
    cx = x;
    cy = y;
  }
  return `${d}z`;
}

/** A thin line through points, as a curve that is not closed. */
export function line(points) {
  return curve(points, false);
}
