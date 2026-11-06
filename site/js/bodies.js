// The two fencers' bodies for the 3D figures, as scripts/bake-fencers.js bakes
// them from MakeHuman's public-domain base mesh into models/fencers.bin: the
// triangles, the skin and its bones, and for each body where every vertex is
// and which garment it is on. Only the 3D figures load it.

const MAGIC = "MLF1";

// A list kept as the steps between its numbers, `stride` apart, as 16-bit numbers that wrap round: the numbers again.
function unstep(steps, stride, out) {
  for (let i = 0; i < steps.length; i++) out[i] = steps[i] + (i >= stride ? out[i - stride] : 0);
  return out;
}

/** The bodies from the bytes of fencers.bin, once it is uncompressed. */
export function readBodies(buffer) {
  const bytes = new Uint8Array(buffer);
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== MAGIC) throw new Error("not a fencers file");
  const length = new DataView(buffer).getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + length)));
  if (header.format !== 1) throw new Error(`fencers file format ${header.format} is not known`);
  const start = 8 + length;
  const n = header.vertices;
  const at = (Type, offset, count) => new Type(buffer, start + offset, count);

  const index = unstep(at(Int16Array, header.index, header.triangles * 3), 3, new Uint16Array(header.triangles * 3));
  const figures = {};
  for (const [who, figure] of Object.entries(header.figures)) {
    // All the x, then the y, then the z, each as steps from the vertex before, and those from the first body's if it says so.
    const planes = unstep(at(Int16Array, figure.position, n * 3), 1, new Int16Array(n * 3));
    const base = figure.from ? figures[figure.from].raw : null;
    const raw = new Int16Array(n * 3);
    const position = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 3; k++) {
        const v = planes[k * n + i] + (base ? base[3 * i + k] : 0);
        raw[3 * i + k] = v;
        position[3 * i + k] = raw[3 * i + k] / 100;
      }
    }
    figures[who] = { raw, position, garment: at(Uint8Array, figure.garment, n), heads: figure.heads, tails: figure.tails };
  }
  for (const figure of Object.values(figures)) delete figure.raw;
  return {
    source: header.source,
    vertices: n,
    triangles: header.triangles,
    bones: header.bones,
    garments: header.garments,
    index,
    skinIndex: at(Uint8Array, header.skinIndex, n * 4),
    skinWeight: at(Uint8Array, header.skinWeight, n * 4),
    figures,
  };
}

/** Fetches fencers.bin from `url` and reads it, uncompressing it unless the server already has. */
export async function loadBodies(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  let buffer = await response.arrayBuffer();
  const head = new Uint8Array(buffer, 0, 2);
  if (head[0] === 0x1f && head[1] === 0x8b) {
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
    buffer = await new Response(stream).arrayBuffer();
  }
  return readBodies(buffer);
}
