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
const FACE = /^(head|jaw|eye|brow|lip|cheek|nose|temple|chin|ear|tongue|levator|oris|orbicularis|risorius|special|oculi|mouth|teeth)/;

function parseObj(text) {
  const verts = [];
  const faces = [];
  let group = "";
  for (const line of text.split("\n")) {
    if (line.startsWith("v ")) {
      const [, x, y, z] = line.trim().split(/\s+/);
      verts.push(+x, +y, +z);
    } else if (line.startsWith("g ")) {
      group = line.slice(2).trim();
    } else if (line.startsWith("f ") && DRAWN.has(group)) {
      const idx = line.trim().split(/\s+/).slice(1).map((t) => parseInt(t, 10) - 1);
      for (let k = 1; k + 1 < idx.length; k++) faces.push(idx[0], idx[k], idx[k + 1]);
    }
  }
  return { verts: Float64Array.from(verts), faces };
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

/** Which garment a vertex is on, from the bone that moves it most and where it is at rest (decimetres). */
function garmentOf(body, bone, p, heads) {
  const hip = heads["upperleg01.L"][1];
  const knee = heads["lowerleg01.L"][1];
  const ankle = heads["foot.L"][1];
  if (/^eye\./.test(bone)) return "eye";
  if (/^(foot|toe)/.test(bone) || p[1] < ankle + 0.25) return "shoe";
  if (/^(wrist|metacarpal|finger)/.test(bone)) return bone.endsWith(".L") ? "glove" : "skin";
  if (bone === "lowerarm02.L" && dist(p, heads["wrist.L"]) < 1.05) return "glove";
  if (/^neck0[23]/.test(bone) || FACE.test(bone)) return bone === "head" && isHair(body, p, heads.head) ? "hair" : "skin";
  if (/^neck01/.test(bone)) return p[1] < heads.neck01[1] + 0.35 ? "jacket" : "skin";
  if (/^(lowerleg|upperleg|pelvis|root)/.test(bone) || p[1] < hip + 0.75) return p[1] < knee - 0.8 && !body.trousers ? "stocking" : "breeches";
  return "jacket";
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

    const normals = normalsOf(verts, obj.faces);
    const position = new Int16Array(count * 3);
    const garment = new Uint8Array(count);
    used.forEach((v, i) => {
      const p = [verts[3 * v], verts[3 * v + 1], verts[3 * v + 2]];
      const kind = garmentOf(body, strongest[i].bone, p, heads);
      garment[i] = GARMENTS.indexOf(kind);
      const out = body.loose[kind] ?? 0;
      for (let k = 0; k < 3; k++) {
        const cm = (p[k] + out * normals[3 * v + k]) * scale;
        position[3 * i + k] = Math.round(cm * 100);
      }
    });
    const cm = (p) => p.map((x) => Math.round(x * scale * 100) / 100);
    figures[who] = {
      position,
      garment,
      heads: BONES.map((name) => cm(heads[name])),
      tails: BONES.map((name) => cm(joints[skel.bones[name].tail])),
    };
  }
  return { count, index, skinIndex, skinWeight, parents, figures };
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
