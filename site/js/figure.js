// Fencers drawn in pen and ink, as SVG path data.
//
// The body is worked out in centimetres, y up, facing +x with the back foot at
// 0; a projector then places it on the piste and turns it for the camera,
// which swings around a point on the piste. Out come SVG units, y down.
import { poseAt } from "./phrase.js";

// The camera turns around this point on the piste (cm).
export const PIVOT = 115;

const RAD = Math.PI / 180;
// Thigh and shin, hip to ankle (cm).
const THIGH = 44;
const SHIN = 46;

function fmt(point) {
  return `${point[0].toFixed(1)} ${point[1].toFixed(1)}`;
}

/** The knee for a hip and an ankle; it bends forward, and a leg too short to reach goes straight. */
export function knee(hx, hy, ax, ay) {
  const dx = ax - hx;
  const dy = ay - hy;
  const d = Math.hypot(dx, dy);
  if (d >= THIGH + SHIN - 0.05 || d < 1) {
    return [hx + (dx * THIGH) / (THIGH + SHIN), hy + (dy * THIGH) / (THIGH + SHIN)];
  }
  const towardAnkle = Math.atan2(dy, dx);
  const bend = Math.acos(Math.max(-1, Math.min(1, (THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d))));
  return [hx + THIGH * Math.cos(towardAnkle + bend), hy + THIGH * Math.sin(towardAnkle + bend)];
}

/** Every joint of a pose, plus `at(k)`: the point k cm along the blade from the hand. */
export function skeleton(p) {
  const hip = [p.hipX, p.hipY];
  const ankB = [0, 8 + Math.max(0, p.liftB)];
  const ankF = [p.footF, 8 + Math.max(0, p.liftF)];
  const kB = knee(hip[0], hip[1], ankB[0], ankB[1]);
  const kF = knee(hip[0], hip[1], ankF[0], ankF[1]);
  // Up the torso, and forward across it.
  const u = [Math.sin(p.lean * RAD), Math.cos(p.lean * RAD)];
  const f = [u[1], -u[0]];
  const T = (a, b) => [hip[0] + u[0] * a + f[0] * b, hip[1] + u[1] * a + f[1] * b];
  const sh = T(52, 0);
  const nk = T(58, 0);
  const hd = T(72, 1);
  const el = [sh[0] + 30 * Math.cos(p.arm * RAD), sh[1] + 30 * Math.sin(p.arm * RAD)];
  const hn = [el[0] + 27 * Math.cos(p.fore * RAD), el[1] + 27 * Math.sin(p.fore * RAD)];
  const bp = p.blade * RAD;
  const by = p.yaw * RAD;
  const bd = [Math.cos(bp) * Math.cos(by), Math.sin(bp) * Math.cos(by), Math.sin(by)];
  const at = (k) => [hn[0] + k * bd[0], hn[1] + k * bd[1], k * bd[2]];
  const ra = (p.rArm - p.lean) * RAD;
  const rf = (p.rFore - p.lean) * RAD;
  const rs = T(51, -3);
  const re = [rs[0] + 28 * Math.cos(ra), rs[1] + 28 * Math.sin(ra)];
  const rh = [re[0] + 25 * Math.cos(rf), re[1] + 25 * Math.sin(rf)];
  return { hip, ankB, ankF, kB, kF, u, f, T, sh, nk, hd, el, hn, bp, at, tip: at(88), rs, re, rh, lean: p.lean };
}

/**
 * Places body points on the piste and turns them for the camera. `dir` is 1
 * for a fencer facing right and -1 for one facing left.
 */
export function projector(p, dir, camera) {
  const c = Math.cos(camera * RAD);
  const s = Math.sin(camera * RAD);
  return (q) => [(p.x + dir * q[0] - PIVOT) * c + dir * (q[2] || 0) * s + PIVOT, -q[1]];
}

export function bladeTip(p, dir, camera) {
  return fmt(projector(p, dir, camera)(skeleton(p).tip));
}

/** A quick line drawing of a pose: the motion ghosts. */
export function stickFigure(p, dir, camera) {
  const J = skeleton(p);
  const W = projector(p, dir, camera);
  const S = (q) => fmt(W(q));
  const h = W(J.hd);
  return {
    body:
      `M${S(J.hip)}L${S(J.kB)}L${S(J.ankB)}M${S(J.hip)}L${S(J.kF)}L${S(J.ankF)}` +
      `M${S(J.hip)}L${S(J.nk)}M${S(J.sh)}L${S(J.el)}L${S(J.hn)}` +
      `M${S(J.rs)}L${S(J.re)}L${S(J.rh)}` +
      `M${(h[0] - 10).toFixed(1)} ${h[1].toFixed(1)}a10 10 0 1 0 20 0a10 10 0 1 0 -20 0`,
    blade: `M${S(J.at(-7))}L${S(J.tip)}`,
  };
}

/**
 * The pen-and-ink fencer. Each layer is a merged silhouette (`g`) with its
 * fold and detail lines (`d`); l1 is drawn first and l6 last, with the head
 * between l4 and l6. The blade goes over both fencers.
 *
 * `backView` draws the sword arm on the far side, as the camera sees the
 * fencer facing right; `bald` gives a receding hairline.
 */
export function inkFigure(p, dir, camera, { backView = false, bald = false } = {}) {
  const J = skeleton(p);
  const W = projector(p, dir, camera);
  const S = (q) => fmt(W(q));
  // Every outline winds the same way, so overlapping ones fill as one shape.
  const area = (pts) => {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const q = pts[i];
      const w = pts[(i + 1) % pts.length];
      a += q[0] * w[1] - w[0] * q[1];
    }
    return a;
  };
  const poly = (pts) => `M${(area(pts) < 0 ? pts.slice().reverse() : pts).map(S).join("L")}Z`;
  const ln = (pts) => `M${pts.map(S).join("L")}`;
  const Q = (o, a, k, b, m) => [o[0] + a[0] * k + b[0] * m, o[1] + a[1] * k + b[1] * m];
  const P = (o, a, k) => [o[0] + a[0] * k, o[1] + a[1] * k];
  const unit = (a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    return [dx / L, dy / L];
  };
  const nrm = (v) => [-v[1], v[0]];
  // A limb segment: round ends of radius r0 at p0 and r1 at p1.
  const cap = (p0, p1, r0, r1) => {
    const u = unit(p0, p1);
    const n = nrm(u);
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const t = (90 - i * 30) * RAD;
      pts.push(Q(p1, u, r1 * Math.cos(t), n, r1 * Math.sin(t)));
    }
    for (let i = 0; i <= 6; i++) {
      const t = (-90 - i * 30) * RAD;
      pts.push(Q(p0, u, r0 * Math.cos(t), n, r0 * Math.sin(t)));
    }
    return poly(pts);
  };

  // Legs: knickerbockers gathered below the knee, socks, low shoes.
  const leg = (ank, kn, front, seat) => {
    const tu = unit(J.hip, kn);
    const tn = nrm(tu);
    const su = unit(kn, ank);
    const sn = nrm(su);
    const pe = P(kn, su, 9);
    const a = ank;
    const L = front ? 1 : 0.62;
    let g =
      cap(J.hip, kn, 11, 9.4) +
      cap(kn, pe, 9.9, 7) +
      cap(pe, ank, 5.2, 3.7) +
      poly([
        [a[0] - 6, a[1] + 1],
        [a[0] - 7.5, a[1] - 5],
        [a[0] - 6.5, a[1] - 8],
        [a[0] + 19 * L, a[1] - 8],
        [a[0] + 21 * L, a[1] - 6.2],
        [a[0] + 19 * L, a[1] - 3.6],
        [a[0] + 9 * L, a[1] - 1.2],
        [a[0] + 2, a[1] + 2],
      ]);
    if (seat) g += cap(Q(J.hip, J.f, -6, J.u, 4), Q(J.hip, J.f, 5, J.u, 2), 13, 12);
    const d =
      ln([Q(pe, sn, 6.8, su, 0), Q(pe, sn, -6.8, su, 0)]) +
      ln([Q(pe, sn, 4.6, su, 3), Q(pe, sn, -4.6, su, 3)]) +
      ln([Q(pe, sn, 2, su, 7), Q(ank, sn, 1.2, su, -6)]) +
      ln([Q(J.hip, tn, 4, tu, 14), Q(kn, tn, 3, tu, -10)]) +
      ln([Q(J.hip, tn, -3, tu, 20), Q(kn, tn, -5, tu, -4)]) +
      ln([
        [a[0] - 5.5, a[1] - 3],
        [a[0] + 8 * L, a[1] - 1.6],
      ]);
    return { g, d };
  };

  // Jacket with a high collar, and the neck.
  const T = J.T;
  const torso = {
    g:
      poly([T(4, -13), T(18, -15.5), T(34, -15), T(47, -12), T(55, -8), T(60, -5), T(61, 3.5), T(56, 6.5), T(46, 13), T(32, 14), T(18, 12), T(4, 12.5)]) +
      cap(T(57, 0), J.hd, 5.4, 5),
    d: ln([T(10, -14.5), T(10.5, 12.8)]) + ln([T(57, -5.6), T(57.5, 4.6)]) + ln([T(42, -10.5), T(26, -12.5)]) + ln([T(34, 10.5), T(20, 9.5)]),
  };

  // Head in profile, hair as a solid mass of ink.
  const hl = J.lean * 0.35 * RAD;
  const hf = [Math.cos(hl), -Math.sin(hl)];
  const hu = [Math.sin(hl), Math.cos(hl)];
  const H = (deg, rad) => {
    const t = deg * RAD;
    return Q(J.hd, hf, 1.08 * rad * Math.cos(t), hu, 1.08 * rad * Math.sin(t));
  };
  const profile = [
    [-180, 10.2], [-145, 10], [-115, 9.3], [-90, 8.6], [-62, 9.4], [-40, 11.2], [-24, 10.6], [-12, 10.9],
    [-2, 10.4], [7, 13.4], [15, 11], [28, 10.9], [50, 10.5], [90, 10.6], [130, 10.6], [160, 10.4],
  ];
  const hairPts = bald
    ? [H(115, 10.9), H(150, 11.1), H(185, 11), H(215, 10.4), H(222, 7.6), H(185, 8.2), H(150, 8.8), H(120, 9.8)]
    : [H(48, 11.2), H(75, 12.2), H(105, 12.3), H(140, 11.8), H(175, 11.3), H(212, 10.6), H(220, 7.4), H(185, 7.6), H(150, 8.2), H(110, 9), H(75, 9.4), H(52, 9.7)];
  const ear = [];
  for (let i = 0; i <= 10; i++) {
    const t = i * 36 * RAD;
    ear.push(Q(H(188, 3.2), hf, 1.5 * Math.cos(t), hu, 2.3 * Math.sin(t)));
  }
  const head = {
    g: poly(profile.map((q) => H(q[0], q[1]))),
    hair: poly(hairPts),
    d: ln(ear) + ln([H(22, 8.4), H(19, 6.4)]) + ln([H(-14, 10.6), H(-16, 8.2)]),
  };

  // Sword arm: sleeve, gauntlet, fist.
  const fu = unit(J.el, J.hn);
  const fn = nrm(fu);
  const au = unit(J.sh, J.el);
  const an = nrm(au);
  const sword = {
    g:
      cap(J.sh, J.el, 6.2, 5.3) +
      cap(J.el, P(J.hn, fu, -6), 5.3, 4.4) +
      cap(P(J.hn, fu, -8), P(J.hn, fu, 1), 5.4, 5.2) +
      cap(J.hn, P(J.hn, fu, 2.5), 4.8, 4.6),
    d:
      ln([Q(J.hn, fn, 5.6, fu, -8), Q(J.hn, fn, -5.6, fu, -8)]) +
      ln([Q(J.el, an, 3.5, au, -5), Q(J.el, fn, 2, fu, 5)]) +
      ln([Q(J.el, an, -2.5, au, -7), Q(J.el, fn, -3, fu, 3)]),
  };

  // Rear arm, hand on the hip.
  const ru = unit(J.rs, J.re);
  const rn = nrm(ru);
  const qu = unit(J.re, J.rh);
  const qn = nrm(qu);
  const rear = {
    g: cap(J.rs, J.re, 6, 5.2) + cap(J.re, J.rh, 5.2, 4.3) + cap(J.rh, P(J.rh, qu, 5), 4.6, 3.6),
    d: ln([Q(J.re, rn, 3, ru, -6), Q(J.re, qn, 2.5, qu, 5)]) + ln([Q(J.rh, qn, 4.6, qu, -1.5), Q(J.rh, qn, -4.6, qu, -1.5)]),
  };

  // Sabre: tapered blade (k), bell guard (g) and knuckle bow (d), worked out
  // after projection so the guard stays an oval across the blade.
  const b0 = W(J.at(5));
  const b1 = W(J.tip);
  const cc = W(J.at(3));
  const quad = (a, b, w0, w1) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L;
    const ny = dx / L;
    return (
      `M${fmt([a[0] + nx * w0, a[1] + ny * w0])}L${fmt([b[0] + nx * w1, b[1] + ny * w1])}` +
      `L${fmt([b[0] - nx * w1, b[1] - ny * w1])}L${fmt([a[0] - nx * w0, a[1] - ny * w0])}Z`
    );
  };
  const ex0 = b1[0] - b0[0];
  const ey0 = b1[1] - b0[1];
  const BL = Math.hypot(ex0, ey0) || 1;
  const ex = [ex0 / BL, ey0 / BL];
  const ey = [-ex[1], ex[0]];
  const cup = [];
  for (let i = 0; i < 14; i++) {
    const t = (i / 14) * Math.PI * 2;
    cup.push(fmt([cc[0] + ex[0] * 3 * Math.cos(t) + ey[0] * 7.6 * Math.sin(t), cc[1] + ex[1] * 3 * Math.cos(t) + ey[1] * 7.6 * Math.sin(t)]));
  }
  const pe = [Math.sin(J.bp), -Math.cos(J.bp)];
  const off = (q, k) => [q[0] + pe[0] * k, q[1] + pe[1] * k, q[2]];
  const blade = {
    k: quad(b0, b1, 0.75, 0.2),
    g: `M${cup.join("L")}Z`,
    d: `M${[off(J.at(3), 7.2), off(J.at(-1.5), 8.6), off(J.at(-5), 7), off(J.at(-7.5), 2.5)].map(S).join("L")}`,
  };

  // Hatching on the floor under each planted foot, fading as it lifts.
  const ground = (ank, front) => {
    const lift = ank[1] - 8;
    if (lift > 5) return "";
    const k = 1 - lift / 6;
    const a = ank[0] - 9;
    const b = ank[0] + (front ? 25 : 15);
    const w = (b - a) * k;
    return (
      ln([[a, 0.3], [a + w, 0.3]]) +
      ln([[a + 6, -1.5], [a + 6 + w, -1.5]]) +
      ln([[a - 5, -3], [a - 5 + w - 6, -3]])
    );
  };

  // Draw order: what the camera sees first goes last.
  const legF = leg(J.ankF, J.kF, true, !backView);
  const legB = leg(J.ankB, J.kB, false, backView);
  const order = backView ? [sword, legF, legB, torso, rear] : [rear, legB, legF, torso, sword];
  return {
    l1: order[0],
    l2: order[1],
    l3: order[2],
    l4: order[3],
    head,
    l6: order[4],
    blade,
    ground: ground(J.ankF, true) + ground(J.ankB, false),
  };
}

/** The piste: a floor line with a tick every 50 cm and a longer one at the centre. */
export function floorPath(camera) {
  const c = Math.cos(camera * RAD);
  const X = (x) => ((x - PIVOT) * c + PIVOT).toFixed(1);
  let d = `M${X(-600)} 0 H${X(900)}`;
  for (let x = -550; x <= 850; x += 50) d += ` M${X(x)} 0 V${x === 100 ? 6 : 3}`;
  return d;
}

/**
 * Where each blade tip travels over the whole phrase, sampled about every
 * 10 ms (at most 700 times): the times, and the tip of A and of B at each.
 */
export function bladePaths(timeline, camera) {
  const n = Math.max(2, Math.min(700, Math.ceil(timeline.duration / 10)));
  const times = [];
  const a = [];
  const b = [];
  for (let i = 0; i <= n; i++) {
    const t = (timeline.duration * i) / n;
    const q = poseAt(timeline, t);
    times.push(t);
    a.push(bladeTip(q.A, 1, camera));
    b.push(bladeTip(q.B, -1, camera));
  }
  return { times, a, b };
}
