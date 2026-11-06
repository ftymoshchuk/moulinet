// Bakes the bodies of the two fencers for the 3D stage from MakeHuman's base
// mesh, skeleton, skin weights and body shapes, which are public domain (CC0):
//
//   node scripts/bake-fencers.js <MakeHuman>/makehuman
//
// where <MakeHuman> is a checkout of github.com/makehumancommunity/makehuman at
// the commit SOURCE names. It writes site/models/fencers.bin, which the page
// loads only when the 3D figures are turned on. Run it again only to change the
// bodies; the page never needs MakeHuman itself.
//
// The file is gzip-compressed. Inside: four bytes "MLF1", the length of a JSON
// header as a 32-bit little-endian number, the header (padded with spaces to a
// multiple of four bytes), then the arrays it describes, each at a multiple of
// four bytes from the end of the header. Shared by both bodies: the triangles,
// as vertex numbers, and for each vertex the four bones that move it and how
// much each does (in 255ths). For each body: where each vertex is, in
// hundredths of a centimetre, which garment it is on, and where each bone
// starts and ends. The numbers that run on from one to the next are kept as the
// steps between them, which compress far better: each corner of a triangle as
// the step from the same corner of the one before, and each coordinate of a
// vertex, all the x first, then the y, then the z, as the step from the vertex
// before; the second body's vertices are kept as steps from the first's. Each
// step is a 16-bit number that wraps round, as the bodies' readers undo it.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

export const SOURCE = {
  name: "MakeHuman base mesh hm08, default skeleton and weights, and body targets",
  repository: "https://github.com/makehumancommunity/makehuman",
  commit: "a8bc2d54ff0ac92e78ff71431b1023eda42bf482",
  licence: "CC0-1.0",
};

// The fencers' legs, hip joint to ankle, are this long (cm), as figure.js has them.
const LEG = 90;

// What a vertex can be on. The page colours each one.
export const GARMENTS = ["jacket", "breeches", "stocking", "shoe", "glove", "skin", "hair", "eye"];

// The two bodies: MakeHuman targets and how far each garment stands off the
// skin, in MakeHuman's units (decimetres), before the body is scaled to the
// fencers' height.
const BODIES = {
  // A young man, athletic: the young male shape, some muscle, ideal proportions.
  A: {
    targets: [
      ["macrodetails/caucasian-male-young.target", 1],
      ["macrodetails/universal-male-young-maxmuscle-averageweight.target", 0.35],
      ["macrodetails/proportions/male-young-averagemuscle-averageweight-idealproportions.target", 0.6],
    ],
    loose: { jacket: 0.09, breeches: 0.13, stocking: 0.02, glove: 0.04 },
    hair: "full",
  },
  // An older man, heavier and balding, in trousers to the ankle.
  B: {
    targets: [
      ["macrodetails/caucasian-male-old.target", 0.75],
      ["macrodetails/caucasian-male-young.target", 0.25],
      ["macrodetails/universal-male-old-averagemuscle-maxweight.target", 0.45],
    ],
    loose: { jacket: 0.1, breeches: 0.24, glove: 0.04 },
    hair: "balding",
    trousers: true,
  },
};

// How many rounds of smoothing each garment has, so that cloth runs over the hollows of the body rather than into
// them and a shoe is a shoe, not a bare foot; and how far a shoe stands off the foot (decimetres).
const SMOOTH = { jacket: 20, breeches: 40, shoe: 30 };
const SHOE = 0.03;
// The seat of the breeches spans the cleft between the buttocks, as cloth does: the vertices of the breeches that face
// back at least this much (the cosine of their angle from straight back) are filled this many rounds.
const SEAT = { facing: 0.35, rounds: 120 };

// The bones the page poses. Every other bone of MakeHuman's skeleton only ever
// turns with its parent, so its share of the skin goes to the nearest of these
// above it: the face to the head, the toes to the foot, the breast to the chest.
const SIDES = ["L", "R"];
const FINGERS = [1, 2, 3, 4, 5].flatMap((f) => [1, 2, 3].map((j) => `finger${f}-${j}`));
export const BONES = [
  "root",
  "spine05",
  "spine04",
  "spine03",
  "spine02",
  "spine01",
  "neck01",
  "neck02",
  "neck03",
  "head",
  ...SIDES.flatMap((s) =>
    ["upperleg01", "upperleg02", "lowerleg01", "lowerleg02", "foot", "clavicle", "shoulder01", "upperarm01", "upperarm02", "lowerarm01", "lowerarm02", "wrist", ...FINGERS].map((b) => `${b}.${s}`),
  ),
];

// The groups of the base mesh that are drawn: the body and the eyes in it.
const DRAWN = new Set(["body", "helper-l-eye", "helper-r-eye"]);

// The base mesh: its vertices, and the faces drawn as triangles, with the face of the mesh each came from.
function parseObj(text) {
  const verts = [];
  const faces = [];
  const from = [];
  let group = "";
  let face = 0;
  for (const line of text.split("\n")) {
    if (line.startsWith("v ")) {
      const [, x, y, z] = line.trim().split(/\s+/);
      verts.push(+x, +y, +z);
    } else if (line.startsWith("g ")) {
      group = line.slice(2).trim();
    } else if (line.startsWith("f ") && DRAWN.has(group)) {
      const idx = line.trim().split(/\s+/).slice(1).map((t) => parseInt(t, 10) - 1);
      for (let k = 1; k + 1 < idx.length; k++) {
        faces.push(idx[0], idx[k], idx[k + 1]);
        from.push(face);
      }
      face++;
    }
  }
  return { verts: Float64Array.from(verts), faces, from };
}

function applyTarget(verts, text, weight) {
  for (const line of text.split("\n")) {
    if (!line.trim() || line[0] === "#") continue;
    const [i, dx, dy, dz] = line.trim().split(/\s+/);
    verts[3 * i] += weight * dx;
    verts[3 * i + 1] += weight * dy;
    verts[3 * i + 2] += weight * dz;
  }
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dist = (a, b) => Math.hypot(...sub(a, b));

// Area-weighted vertex normals over the drawn triangles.
function normalsOf(verts, faces) {
  const n = new Float64Array(verts.length);
  const at = (i) => [verts[3 * i], verts[3 * i + 1], verts[3 * i + 2]];
  for (let f = 0; f < faces.length; f += 3) {
    const [a, b, c] = [faces[f], faces[f + 1], faces[f + 2]];
    const [u, v] = [sub(at(b), at(a)), sub(at(c), at(a))];
    const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const i of [a, b, c]) for (let k = 0; k < 3; k++) n[3 * i + k] += cross[k];
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    for (let k = 0; k < 3; k++) n[i + k] /= l;
  }
  return n;
}

// How long the fencers' upper arms and forearms are, shoulder joint to elbow and elbow to wrist (cm). MakeHuman's
// upper arm is short for the skeleton in figure.js, whose arm reaches 32 cm to the elbow and 27 more to the wrist; at
// these lengths the hand reaches where the skeleton's does, the shoulder coming forward for the rest.
const ARMS = { upper: 31, fore: 27 };

// Makes one length of an arm `wanted` long: everything beyond its far joint moves out along it, and what is along it
// moves as far as it is along, each vertex by as much of it as those bones move.
function lengthen(verts, joints, skel, part, wanted) {
  const from = joints[skel.bones[part.from].head];
  const to = joints[skel.bones[part.to].head];
  const l = dist(from, to);
  const d = sub(to, from).map((x) => x / l);
  const extra = wanted - l;
  const along = (p) => Math.max(0, Math.min(1, (sub(p, from)[0] * d[0] + sub(p, from)[1] * d[1] + sub(p, from)[2] * d[2]) / l));
  const total = verts.length / 3;
  for (let v = 0; v < total; v++) {
    const p = [verts[3 * v], verts[3 * v + 1], verts[3 * v + 2]];
    const k = part.beyondShare[v] + part.ownShare[v] * along(p);
    for (let c = 0; c < 3; c++) verts[3 * v + c] += extra * d[c] * k;
  }
  // The joints: where a bone beyond starts or ends, all the way; where only a bone along it does, as far as it is along.
  const moved = new Map();
  for (const [name, bone] of Object.entries(skel.bones)) {
    for (const j of [bone.head, bone.tail]) {
      const k = part.beyond.has(name) ? 1 : part.own.has(name) ? along(joints[j]) : 0;
      moved.set(j, Math.max(moved.get(j) ?? 0, k));
    }
  }
  for (const [j, k] of moved) if (k) joints[j] = joints[j].map((x, c) => x + extra * d[c] * k);
}

// Fills the hollows under cloth that spans them: each vertex of `which` that lies below the middle of its neighbours,
// along `normals`, rises toward it, round after round.
function fill(pos, neighbours, normals, which, rounds) {
  for (let round = 0; round < rounds; round++) {
    for (const v of which) {
      const around = neighbours[v];
      let rise = 0;
      for (let k = 0; k < 3; k++) {
        let sum = 0;
        for (const u of around) sum += pos[3 * u + k];
        rise += (sum / around.length - pos[3 * v + k]) * normals[3 * v + k];
      }
      if (rise > 0) for (let k = 0; k < 3; k++) pos[3 * v + k] += rise * normals[3 * v + k];
    }
  }
}

// Smooths each vertex `rounds[v]` rounds, by Taubin's pair of steps, which keep a shape its size: each vertex moves
// toward the middle of its neighbours, then a little back out.
function smooth(pos, neighbours, rounds) {
  const most = Math.max(...rounds);
  const next = new Float64Array(pos.length);
  for (let round = 0; round < most; round++) {
    for (const step of [0.5, -0.53]) {
      next.set(pos);
      rounds.forEach((r, v) => {
        if (r <= round) return;
        const around = neighbours[v];
        for (let k = 0; k < 3; k++) {
          let sum = 0;
          for (const u of around) sum += pos[3 * u + k];
          next[3 * v + k] = pos[3 * v + k] + step * (sum / around.length - pos[3 * v + k]);
        }
      });
      pos.set(next);
    }
  }
}

// Where the garments end, in MakeHuman's units (decimetres), each measured along the bone it crosses, so that it runs
// round the limb with the rings of the mesh: the top of the shoe up the shin from the ankle, the band of the
// knickerbockers down the shin from the knee, the waist up from the hip joints, the collar up the neck, the gauntlet
// of the sword hand back up the forearm from the wrist, and the cuff of the rear sleeve.
const ENDS = { shoe: 0.25, knee: 0.8, waist: 0.75, collar: 0.35, gauntlet: 1.05, cuff: 0.15 };

/** Which garment a vertex is on, from the bone that moves it most and where it is at rest (decimetres). */
function garmentOf(body, bone, p, heads) {
  // How far `p` is along the line from the start of bone `a` toward the start of bone `b`.
  const along = (a, b) => {
    const d = sub(heads[b], heads[a]);
    const l = Math.hypot(...d);
    const q = sub(p, heads[a]);
    return (q[0] * d[0] + q[1] * d[1] + q[2] * d[2]) / l;
  };
  if (/^eye\./.test(bone)) return "eye";
  const side = bone.endsWith(".L") ? "L" : "R";
  if (/^(upperleg|lowerleg|foot|toe)/.test(bone)) {
    const up = along(`foot.${side}`, `lowerleg01.${side}`);
    if (up < ENDS.shoe) return "shoe";
    if (!body.trousers && up < dist(heads[`foot.${side}`], heads[`lowerleg01.${side}`]) - ENDS.knee) return "stocking";
  } else if (/^(upperarm|lowerarm|wrist|metacarpal|finger)/.test(bone)) {
    const past = along(`lowerarm01.${side}`, `wrist.${side}`) - dist(heads[`lowerarm01.${side}`], heads[`wrist.${side}`]);
    if (side === "L") return past > -ENDS.gauntlet ? "glove" : "jacket";
    return past > -ENDS.cuff ? "skin" : "jacket";
  } else if (along("neck01", "head") > ENDS.collar) {
    return isHair(body, p, heads.head) ? "hair" : "skin";
  }
  return p[1] < heads["upperleg01.L"][1] + ENDS.waist ? "breeches" : "jacket";
}

// Hair over the crown and down the back of the head; an older man's only round the back and sides.
function isHair(body, p, head) {
  const top = p[1] - head[1];
  const back = p[2] - head[2];
  return body.hair === "balding" ? top > 0.1 && top < 0.85 && back < -0.3 : top > 0.5 - Math.max(0, -back) * 0.55 && back < 0.6;
}

export function bake(root, bodies = BODIES) {
  const read = (path) => readFileSync(join(root, path), "utf8");
  const obj = parseObj(read("data/3dobjs/base.obj"));
  const skel = JSON.parse(read("data/rigs/default.mhskel"));
  const { weights } = JSON.parse(read("data/rigs/default_weights.mhw"));

  // The vertices drawn, in the order of the base mesh, and the triangles by their new numbers.
  const used = [...new Set(obj.faces)].sort((a, b) => a - b);
  const number = new Map(used.map((v, i) => [v, i]));
  const count = used.length;
  const index = Uint16Array.from(obj.faces, (v) => number.get(v));
  if (count > 65535) throw new Error("too many vertices for 16-bit triangles");

  // Which vertices share an edge with each.
  const linked = Array.from({ length: count }, () => new Set());
  for (let f = 0; f < index.length; f += 3) {
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      linked[index[f + a]].add(index[f + b]);
      linked[index[f + b]].add(index[f + a]);
    }
  }
  const neighbours = linked.map((set) => [...set]);

  // Each bone of the skeleton, and the bone the page poses that it turns with.
  const posed = new Map(BONES.map((name, i) => [name, i]));
  const keptAbove = (name) => {
    for (let n = name; n; n = skel.bones[n].parent) if (posed.has(n)) return posed.get(n);
    throw new Error(`${name} has no posed bone above it`);
  };
  for (const name of BONES) if (!skel.bones[name]) throw new Error(`MakeHuman has no bone ${name}`);
  const parents = BONES.map((name) => (skel.bones[name].parent ? keptAbove(skel.bones[name].parent) : -1));
  parents.forEach((p, i) => {
    if (p >= i) throw new Error(`${BONES[i]} comes before its parent`);
  });

  // The skin: for each drawn vertex, its share of each posed bone, the four largest kept, in 255ths that add up to 255;
  // and the skeleton's own bone that moves it most, which says what it is.
  const shares = Array.from({ length: count }, () => new Map());
  const strongest = Array.from({ length: count }, () => ({ bone: "root", w: 0 }));
  for (const [bone, list] of Object.entries(weights)) {
    if (!skel.bones[bone]) continue;
    const to = keptAbove(bone);
    for (const [v, w] of list) {
      const i = number.get(v);
      if (i === undefined) continue;
      shares[i].set(to, (shares[i].get(to) ?? 0) + w);
      if (w > strongest[i].w) strongest[i] = { bone, w };
    }
  }
  const skinIndex = new Uint8Array(count * 4);
  const skinWeight = new Uint8Array(count * 4);
  shares.forEach((map, i) => {
    const top = [...map].sort((a, b) => b[1] - a[1]).slice(0, 4);
    if (!top.length) top.push([0, 1]);
    const sum = top.reduce((s, [, w]) => s + w, 0);
    const q = top.map(([, w]) => Math.round((255 * w) / sum));
    q[0] += 255 - q.reduce((s, w) => s + w, 0);
    top.forEach(([b], k) => {
      skinIndex[4 * i + k] = b;
      skinWeight[4 * i + k] = q[k];
    });
  });

  // Each arm's two lengths, and for each vertex how much of it the bones of that length move and how much the bones
  // beyond them do, which lengthening the arm moves it by.
  const total = obj.verts.length / 3;
  const below = (top) => {
    const out = new Set([top]);
    for (const name of Object.keys(skel.bones)) for (let n = name; n; n = skel.bones[n].parent) if (n === top) out.add(name);
    return out;
  };
  const shareOf = (bones) => {
    const w = new Float64Array(total);
    for (const bone of bones) for (const [v, x] of weights[bone] ?? []) w[v] += x;
    return w;
  };
  const length = (side, a, b, c) => {
    const beyond = below(`${b}.${side}`);
    const own = [`${a}01.${side}`, `${a}02.${side}`];
    return { from: `${a}01.${side}`, to: `${b}.${side}`, own: new Set(own), beyond, ownShare: shareOf(own), beyondShare: shareOf(beyond) };
  };
  const armWeights = Object.fromEntries(SIDES.map((side) => [side, { upper: length(side, "upperarm", "lowerarm01", "wrist"), fore: length(side, "lowerarm", "wrist") }]));

  // The faces of the mesh: the corners of each, which faces share an edge with it, and the faces round each vertex.
  const faces = faceStructure(index, obj.from, count);

  const figures = {};
  for (const [who, body] of Object.entries(bodies)) {
    const verts = obj.verts.slice();
    for (const [file, w] of body.targets) applyTarget(verts, read(`data/targets/${file}`), w);
    const joints = Object.fromEntries(
      Object.entries(skel.joints).map(([name, idx]) => {
        const p = [0, 0, 0];
        for (const i of idx) for (let k = 0; k < 3; k++) p[k] += verts[3 * i + k] / idx.length;
        return [name, p];
      }),
    );
    const headOf = (name) => joints[skel.bones[name].head];
    const leg = dist(headOf("upperleg01.L"), headOf("lowerleg01.L")) + dist(headOf("lowerleg01.L"), headOf("foot.L"));
    const scale = LEG / leg;
    for (const side of SIDES) {
      lengthen(verts, joints, skel, armWeights[side].upper, ARMS.upper / scale);
      lengthen(verts, joints, skel, armWeights[side].fore, ARMS.fore / scale);
    }
    const heads = Object.fromEntries(Object.keys(skel.bones).map((name) => [name, headOf(name)]));

    // Each vertex on its garment, and each face; where garments meet, the vertices of the seam set on the line the
    // garment ends at, so the seam runs straight round the body.
    const garment = Uint8Array.from(used, (v, i) => GARMENTS.indexOf(garmentOf(body, strongest[i].bone, [verts[3 * v], verts[3 * v + 1], verts[3 * v + 2]], heads)));
    const wearing = faceGarments(garment, faces);
    const seam = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      const kinds = new Set(faces.round[i].map((f) => wearing.get(f)));
      const plane = kinds.size > 1 ? seamPlane(kinds, strongest[i].bone, heads) : null;
      if (!plane) continue;
      seam[i] = 1;
      const v = used[i];
      const off = (verts[3 * v] - plane.at[0]) * plane.dir[0] + (verts[3 * v + 1] - plane.at[1]) * plane.dir[1] + (verts[3 * v + 2] - plane.at[2]) * plane.dir[2];
      for (let k = 0; k < 3; k++) verts[3 * v + k] -= off * plane.dir[k];
    }
    // Each standing off the skin as far as its garment does, and the garments smoothed but for their seams.
    const normals = normalsOf(verts, obj.faces);
    const dressed = new Float64Array(count * 3);
    used.forEach((v, i) => {
      const kind = GARMENTS[garment[i]];
      const out = kind === "shoe" ? SHOE : (body.loose[kind] ?? 0);
      for (let k = 0; k < 3; k++) dressed[3 * i + k] = verts[3 * v + k] + out * normals[3 * v + k];
    });
    const drawnNormals = Float64Array.from({ length: count * 3 }, (_, j) => normals[3 * used[Math.floor(j / 3)] + (j % 3)]);
    const seat = [...garment.keys()].filter((i) => !seam[i] && GARMENTS[garment[i]] === "breeches" && -drawnNormals[3 * i + 2] > SEAT.facing);
    fill(dressed, neighbours, drawnNormals, seat, SEAT.rounds);
    smooth(dressed, neighbours, [...garment].map((g, i) => (seam[i] ? 0 : (SMOOTH[GARMENTS[g]] ?? 0))));
    const position = Int16Array.from(dressed, (x) => Math.round(x * scale * 100));
    const cm = (p) => p.map((x) => Math.round(x * scale * 100) / 100);
    figures[who] = {
      position,
      garment,
      wearing,
      heads: BONES.map((name) => cm(heads[name])),
      tails: BONES.map((name) => cm(joints[skel.bones[name].tail])),
    };
  }
  return seamed({ count, index, skinIndex, skinWeight, parents, figures }, obj.from);
}

// The faces of the mesh, from the triangles and the face each came from: the corners of each face, the faces that
// share an edge with each, and the faces round each vertex.
function faceStructure(index, from, count) {
  const corners = new Map();
  const round = Array.from({ length: count }, () => []);
  const sharing = new Map();
  from.forEach((face, t) => {
    const list = corners.get(face) ?? new Set();
    for (let c = 0; c < 3; c++) {
      const v = index[3 * t + c];
      list.add(v);
      if (!round[v].includes(face)) round[v].push(face);
      const w = index[3 * t + ((c + 1) % 3)];
      const edge = v < w ? `${v} ${w}` : `${w} ${v}`;
      const faces = sharing.get(edge) ?? [];
      if (!faces.includes(face)) faces.push(face);
      sharing.set(edge, faces);
    }
    corners.set(face, list);
  });
  const next = new Map([...corners.keys()].map((face) => [face, new Set()]));
  for (const list of sharing.values()) for (const f of list) for (const g of list) if (f !== g) next.get(f).add(g);
  return { corners, next, round };
}

// The garment each face wears: the one most of its corners are on, or of those the first in GARMENTS; and then a face
// that differs from at least three of the faces beside it takes theirs, so a seam has no notch one face deep. The hair
// is not a garment: where it meets the skin the colours blend, as a hairline does, so a face of hair wears skin here.
const [HAIR, SKIN] = [GARMENTS.indexOf("hair"), GARMENTS.indexOf("skin")];
function faceGarments(garment, { corners, next }) {
  const wearing = new Map();
  for (const [face, list] of corners) {
    const votes = new Map();
    for (const v of list) {
      const kind = garment[v] === HAIR ? SKIN : garment[v];
      votes.set(kind, (votes.get(kind) ?? 0) + 1);
    }
    wearing.set(face, [...votes].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]);
  }
  for (let round = 0; round < 3; round++) {
    for (const [face, kind] of [...wearing]) {
      const votes = new Map();
      for (const g of next.get(face)) votes.set(wearing.get(g), (votes.get(wearing.get(g)) ?? 0) + 1);
      const [most, count] = [...votes].sort((a, b) => b[1] - a[1])[0] ?? [kind, 0];
      if (most !== kind && count >= 3) wearing.set(face, most);
    }
  }
  return wearing;
}

// The plane a seam between the garments `kinds` lies in, at a vertex moved most by `bone`: through `at`, square to
// `dir`. The waist is level; the others are square to the bone they go round.
function seamPlane(kinds, bone, heads) {
  const has = (kind) => kinds.has(GARMENTS.indexOf(kind));
  const side = bone.endsWith(".L") ? "L" : "R";
  const across = (a, b, along) => {
    const d = sub(heads[b], heads[a]);
    const l = Math.hypot(...d);
    const dir = d.map((x) => x / l);
    return { dir, at: heads[a].map((x, k) => x + dir[k] * along(l)) };
  };
  const arm = /^(upperarm|lowerarm|wrist|metacarpal|finger)/.test(bone);
  if (has("jacket") && has("breeches")) return { dir: [0, 1, 0], at: [0, heads["upperleg01.L"][1] + ENDS.waist, 0] };
  if (has("shoe")) return across(`foot.${side}`, `lowerleg01.${side}`, () => ENDS.shoe);
  if (has("stocking")) return across(`foot.${side}`, `lowerleg01.${side}`, (l) => l - ENDS.knee);
  if (has("glove")) return across(`lowerarm01.${side}`, `wrist.${side}`, (l) => l - ENDS.gauntlet);
  if (has("jacket") && has("skin")) return arm ? across(`lowerarm01.${side}`, `wrist.${side}`, (l) => l - ENDS.cuff) : across("neck01", "head", () => ENDS.collar);
  return null;
}

// Where garments meet, each vertex of the seam is doubled, one for each garment, so the colours meet at the seam rather
// than blending across a face. The doubles are where the vertex is and move as it does, so nothing parts. Both bodies
// share the triangles, so a vertex is doubled where the garments of either meet. `from` is the face of the mesh each
// triangle came from, and each body's `wearing` the garment each face wears.
function seamed({ count, index, skinIndex, skinWeight, parents, figures }, from) {
  const bodies = Object.values(figures);
  const worn = bodies.map((body) => body.wearing);
  const keyOf = from.map((face) => worn.map((wearing) => wearing.get(face)).join(","));
  // Each vertex keeps its number for the first garment it is on, and its doubles are numbered after all the rest.
  const keys = Array.from({ length: count }, () => []);
  for (let j = 0; j < index.length; j++) {
    const key = keyOf[Math.floor(j / 3)];
    if (!keys[index[j]].includes(key)) keys[index[j]].push(key);
  }
  const source = Array.from({ length: count }, (_, v) => v);
  const numbers = keys.map((list, v) => new Map(list.map((key, k) => [key, k === 0 ? v : source.push(v) - 1])));
  if (source.length > 65535) throw new Error("too many vertices for 16-bit triangles");
  const copy = (array, size) => {
    const out = new array.constructor(source.length * size);
    source.forEach((v, i) => out.set(array.subarray(v * size, v * size + size), i * size));
    return out;
  };
  const wears = (b) => {
    const out = new Uint8Array(source.length);
    const own = bodies[b].garment;
    for (let j = 0; j < index.length; j++) {
      const worn = Number(keyOf[Math.floor(j / 3)].split(",")[b]);
      out[numbers[index[j]].get(keyOf[Math.floor(j / 3)])] = worn === SKIN ? own[index[j]] : worn;
    }
    return out;
  };
  return {
    count: source.length,
    index: Uint16Array.from(index, (v, j) => numbers[v].get(keyOf[Math.floor(j / 3)])),
    skinIndex: copy(skinIndex, 4),
    skinWeight: copy(skinWeight, 4),
    parents,
    figures: Object.fromEntries(Object.entries(figures).map(([who, { wearing, ...f }], b) => [who, { ...f, position: copy(f.position, 3), garment: wears(b) }])),
  };
}

// A list of 16-bit numbers as the steps between them, `stride` apart, wrapping round.
function steps(values, stride = 1) {
  const out = new Int16Array(values.length);
  for (let i = 0; i < values.length; i++) out[i] = values[i] - (i >= stride ? values[i - stride] : 0);
  return out;
}

// x, y, z of each vertex as all the x, then all the y, then all the z.
function planes(xyz) {
  const n = xyz.length / 3;
  const out = new Int16Array(xyz.length);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) out[k * n + i] = xyz[3 * i + k];
  return out;
}

/** The baked bodies as the bytes of fencers.bin, before compression. */
export function pack({ count, index, skinIndex, skinWeight, parents, figures }) {
  const arrays = [];
  let offset = 0;
  const put = (array) => {
    const at = offset;
    arrays.push(array);
    offset += Math.ceil(array.byteLength / 4) * 4;
    return at;
  };
  const [first, ...others] = Object.keys(figures);
  const base = figures[first].position;
  const header = {
    format: 1,
    source: SOURCE,
    unit: "cm",
    vertices: count,
    triangles: index.length / 3,
    bones: BONES.map((name, i) => ({ name, parent: parents[i] })),
    garments: GARMENTS,
    index: put(steps(index, 3)),
    skinIndex: put(skinIndex),
    skinWeight: put(skinWeight),
    figures: {},
  };
  for (const who of [first, ...others]) {
    const { position, garment, heads, tails } = figures[who];
    const from = who === first ? null : first;
    const own = from ? Int16Array.from(position, (v, i) => v - base[i]) : position;
    header.figures[who] = { from, position: put(steps(planes(own))), garment: put(garment), heads, tails };
  }
  let json = JSON.stringify(header);
  json += " ".repeat((4 - (Buffer.byteLength(json) % 4)) % 4);
  const head = Buffer.alloc(8);
  head.write("MLF1", 0, "latin1");
  head.writeUInt32LE(Buffer.byteLength(json), 4);
  const body = Buffer.alloc(offset);
  let at = 0;
  for (const array of arrays) {
    Buffer.from(array.buffer, array.byteOffset, array.byteLength).copy(body, at);
    at += Math.ceil(array.byteLength / 4) * 4;
  }
  return Buffer.concat([head, Buffer.from(json), body]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.argv[2];
  if (!root) {
    console.error("usage: node scripts/bake-fencers.js <MakeHuman checkout>/makehuman");
    process.exit(1);
  }
  const baked = bake(root);
  const bytes = pack(baked);
  const out = fileURLToPath(new URL("../site/models/", import.meta.url));
  mkdirSync(out, { recursive: true });
  const packed = gzipSync(bytes, { level: 9 });
  writeFileSync(join(out, "fencers.bin"), packed);
  console.log(`${baked.count} vertices, ${baked.index.length / 3} triangles, ${BONES.length} bones: ${bytes.length} bytes, ${packed.length} compressed`);
}
