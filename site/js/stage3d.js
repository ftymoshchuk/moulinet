// The 3D figures: the fencers as people (rig.js) drawn in ink on a canvas laid
// over the stage. The stage's own drawing keeps the floor, the motion ghosts and
// the blade paths under it; the canvas is clear but for the fencers.
//
// The figures are drawn three times, off the page: in the flat colours of what
// they wear, in white under a light, and as which way each point of them faces
// and how far it is from the camera. Ink is laid where the distance jumps, where
// the way a surface faces turns sharply and where one colour meets another, and
// hatching where the light is low; the rest takes its flat colour.
import {
  AmbientLight,
  BufferAttribute,
  Color,
  ColorManagement,
  DataTexture,
  DepthTexture,
  DirectionalLight,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  MeshNormalMaterial,
  MeshToonMaterial,
  NearestFilter,
  NoBlending,
  OrthographicCamera,
  PlaneGeometry,
  RedFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "../vendor/three.module.min.js";
import { loadBodies } from "./bodies.js";
import { PIVOT } from "./figure.js";
import { createFigure } from "./rig.js";

const RAD = Math.PI / 180;
// The colours are the page's own, as they are written, with no conversion.
ColorManagement.enabled = false;

const INK = "#1d1b18";
// What each fencer wears, by garment as bake-fencers.js names them, as the stage's drawing colours them.
const COLOURS = {
  A: { jacket: "#f6f3ec", breeches: "#eee9df", stocking: "#f8f6f1", shoe: "#3a332c", glove: "#e6dfcf", skin: "#efe4d3", hair: "#26211d", eye: "#3a342e" },
  B: { jacket: "#e0dacd", breeches: "#cdc6b5", stocking: "#cdc6b5", shoe: "#3a332c", glove: "#e6dfcf", skin: "#ebe2d2", hair: "#8d877c", eye: "#3a342e" },
};
const SABRE = { blade: "#2a2723", guard: "#eceae4", grip: "#3a352f", pommel: "#eceae4" };
// The camera stands this far from the pivot of the piste (cm), which only has to be beyond everything it sees.
const DISTANCE = 2000;
// How many pixels the figures are drawn with for each pixel of the page at most, and at least: drawn finer than the
// screen, the lines come out smooth.
const DETAIL = [1.5, 2];
// How thick the lines are, in pixels of the page.
const LINE = 0.9;

// The pass in flat colour carries in its alpha which fencer each pixel is of, for the hatching to go with him, and how
// much of it is hair: from WHO for none to a fifth more for all. The hair is drawn over the skin from that, with a
// smooth line where it grows: the young man's dark, the older man's grey, in strokes of the pen.
const WHO = { A: 0.2, B: 0.6 };
const HAIR = 0.2;

const VERTEX = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
const FRAGMENT = `
  uniform sampler2D tColor, tLight, tNormal, tDepth;
  uniform vec2 resolution, anchorA, anchorB;
  uniform float detail, range, line, wobble;
  uniform vec3 ink, hairA;
  varying vec2 vUv;
  float depthAt(vec2 uv) { return texture2D(tDepth, uv).x * range; }
  vec3 normalAt(vec2 uv) { return normalize(texture2D(tNormal, uv).xyz * 2.0 - 1.0); }
  bool inside(vec2 uv) { return texture2D(tDepth, uv).x < 0.999; }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float rule(float at, float spacing) {
    return 1.0 - smoothstep(0.45 * detail, 0.95 * detail, abs(mod(at, spacing) - spacing * 0.5));
  }
  void main() {
    vec2 px = 1.0 / resolution;
    // The pen wavers a little along its line, as the drawing's ink texture has it.
    vec2 at = gl_FragCoord.xy / (36.0 * detail);
    vec2 uv = vUv + wobble * 1.6 * detail * px * vec2(noise(at) - 0.5, noise(at + 31.7) - 0.5);
    float d = depthAt(uv);
    vec3 n = normalAt(uv);
    vec4 c0 = texture2D(tColor, uv);
    bool figure = inside(uv);
    // The line is heavier where the figure turns from the light, as a pen presses on the shadow side.
    float shade = figure ? 1.0 - texture2D(tLight, uv).r : 0.0;
    for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
      vec2 q = uv + vec2(float(i), float(j)) * px * line * detail * 2.0;
      if (inside(q)) shade = max(shade, 1.0 - texture2D(tLight, q).r);
    }
    float reach = line * detail * (1.0 + 1.2 * shade);
    float edge = 0.0;
    for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
      vec2 o = vec2(float(i), float(j)) * px * reach;
      float dd = abs(depthAt(uv + o * 1.3) - d);
      float nn = 1.0 - dot(n, normalAt(uv + o * 0.8));
      float cd = length(texture2D(tColor, uv + o * 0.7).rgb - c0.rgb);
      edge = max(edge, max(smoothstep(1.5, 3.5, dd), max(0.8 * smoothstep(0.3, 0.55, nn), 0.85 * smoothstep(0.03, 0.07, cd))));
    }
    if (!figure) {
      // Outside the figures only the outer half of their outline, on clear canvas.
      gl_FragColor = vec4(ink * edge, edge);
      return;
    }
    // Hatching where the light is low, crossed where it is lowest, ruled from a point on each fencer so that it goes
    // with him as he moves.
    vec3 colour = c0.rgb;
    float light = texture2D(tLight, uv).r;
    bool older = c0.a > 0.5;
    float hair = (c0.a - (older ? ${WHO.B.toFixed(2)} : ${WHO.A.toFixed(2)})) / ${HAIR.toFixed(2)};
    vec2 h = gl_FragCoord.xy - (older ? anchorB : anchorA);
    float spacing = 4.0 * detail;
    if (hair > 0.5) {
      // The young man's hair dark, the older man's in close strokes of the pen, combed back.
      colour = older ? mix(colour, ink, 0.55 * rule(h.y + 0.35 * h.x, 2.6 * detail)) : hairA;
    } else {
      if (light < 0.8) colour = mix(colour, ink, 0.6 * rule(h.x + h.y, spacing));
      if (light < 0.5) colour = mix(colour, ink, 0.6 * rule(h.x - h.y, spacing));
    }
    gl_FragColor = vec4(mix(colour, ink, edge), 1.0);
  }`;

// How much of each vertex is hair, from 0 to 1: the hair as the bodies have it, smoothed over the head a few rounds, so
// that the line where it grows, half way, is a smooth curve rather than the edges of the mesh.
function hairOf(bodies, garment) {
  const [hair, skin] = [bodies.garments.indexOf("hair"), bodies.garments.indexOf("skin")];
  const head = (v) => garment[v] === hair || garment[v] === skin;
  const around = Array.from({ length: bodies.vertices }, () => []);
  const { index } = bodies;
  for (let t = 0; t < index.length; t += 3) {
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      const [u, v] = [index[t + a], index[t + b]];
      if (head(u) && head(v)) around[u].push(v);
    }
  }
  let amount = Float32Array.from(garment, (g) => (g === hair ? 1 : 0));
  for (let round = 0; round < 4; round++) {
    const next = amount.slice();
    for (let v = 0; v < amount.length; v++) {
      if (!around[v].length) continue;
      let sum = 0;
      for (const u of around[v]) sum += amount[u];
      next[v] = 0.5 * amount[v] + (0.5 * sum) / around[v].length;
    }
    amount = next;
  }
  return amount;
}

/**
 * Sets up the 3D figures on `canvas` and loads their bodies. Resolves to `draw(view)`, which draws the fencers for
 * `view`: { poses: { A, B }, solo, frame: [x, y, w, h] as the stage's viewBox, camera in degrees, and ink, whether the
 * pen wavers as the drawing's ink texture does }; `lost`, true once the browser has taken the drawing away; and
 * `fencers`, the figures as rig.js makes them.
 */
export async function createStage3d(canvas) {
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: true, stencil: false, preserveDrawingBuffer: false });
  if (!gl) throw new Error("WebGL 2 is not available");
  const bodies = await loadBodies(new URL("../models/fencers.bin", import.meta.url));
  const renderer = new WebGLRenderer({ canvas, context: gl });
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const stage = { lost: false, fencers: null };
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    stage.lost = true;
  });

  // The light, from high in front and to the left, and the bands of tone the white figures take under it.
  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 1.2));
  const sun = new DirectionalLight(0xffffff, 2.2);
  sun.position.set(-150, 300, 260);
  scene.add(sun);
  const tones = new DataTexture(new Uint8Array([105, 170, 255]), 3, 1, RedFormat);
  tones.minFilter = tones.magFilter = NearestFilter;
  tones.needsUpdate = true;
  const light = new MeshToonMaterial({ color: 0xffffff, gradientMap: tones });
  const normals = new MeshNormalMaterial();
  // In flat colour, unblended, so the alpha is kept as it is.
  const flat = (options) => new MeshBasicMaterial({ ...options, blending: NoBlending });

  const fencers = {};
  for (const who of ["A", "B"]) {
    const figure = createFigure(bodies, who);
    // The hair has the skin's colour, and says it is hair in the alpha.
    const colours = new Float32Array(bodies.vertices * 4);
    const byGarment = bodies.garments.map((g) => new Color(COLOURS[who][g === "hair" ? "skin" : g] ?? INK));
    const { garment } = bodies.figures[who];
    const hair = hairOf(bodies, garment);
    for (let v = 0; v < bodies.vertices; v++) {
      const c = byGarment[garment[v]];
      colours.set([c.r, c.g, c.b, WHO[who] + HAIR * hair[v]], 4 * v);
    }
    figure.mesh.geometry.setAttribute("color", new BufferAttribute(colours, 4));
    figure.mesh.userData.flat = flat({ vertexColors: true });
    for (const part of figure.sabre.children) part.userData.flat = flat({ color: new Color(SABRE[part.name] ?? INK), opacity: WHO[who] });
    scene.add(figure.group);
    fencers[who] = figure;
  }
  stage.fencers = fencers;
  const meshes = [];
  scene.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  const use = (pass) => {
    for (const mesh of meshes) mesh.material = pass === "flat" ? mesh.userData.flat : light;
  };

  const camera = new OrthographicCamera(-1, 1, 1, -1, 1, DISTANCE * 2);
  const targets = { color: new WebGLRenderTarget(1, 1), light: new WebGLRenderTarget(1, 1), normal: new WebGLRenderTarget(1, 1) };
  targets.normal.depthTexture = new DepthTexture(1, 1);
  const composite = new ShaderMaterial({
    uniforms: {
      tColor: { value: targets.color.texture },
      tLight: { value: targets.light.texture },
      tNormal: { value: targets.normal.texture },
      tDepth: { value: targets.normal.depthTexture },
      resolution: { value: new Vector2(1, 1) },
      detail: { value: 1 },
      range: { value: camera.far - camera.near },
      line: { value: LINE },
      wobble: { value: 0 },
      anchorA: { value: new Vector2() },
      anchorB: { value: new Vector2() },
      ink: { value: new Color(INK) },
      hairA: { value: new Color(COLOURS.A.hair) },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const page = new Scene();
  page.add(new Mesh(new PlaneGeometry(2, 2), composite));
  const flatCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let size = [0, 0];

  // Where a point of the piste is on the canvas, in its pixels from the bottom left.
  const onCanvas = (point, out) => {
    const ndc = new Vector3(...point).project(camera);
    return out.set(((ndc.x + 1) / 2) * size[0], ((ndc.y + 1) / 2) * size[1]);
  };

  stage.draw = ({ poses, solo, frame, camera: angle, ink = true }) => {
    if (stage.lost) return;
    // As many pixels as the canvas has on the page, times the detail.
    const detail = Math.min(DETAIL[1], Math.max(DETAIL[0], window.devicePixelRatio || 1));
    const w = Math.max(1, Math.round(canvas.clientWidth * detail));
    const h = Math.max(1, Math.round(canvas.clientHeight * detail));
    if (w !== size[0] || h !== size[1]) {
      size = [w, h];
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      for (const target of Object.values(targets)) target.setSize(w, h);
      composite.uniforms.resolution.value.set(w, h);
    }
    composite.uniforms.detail.value = detail;

    fencers.A.pose(poses.A, 1);
    fencers.B.group.visible = !solo;
    if (!solo) fencers.B.pose(poses.B, -1);

    // The camera looks at the pivot of the piste from `angle` round, and sees just what the stage's view box holds.
    const [fx, fy, fw, fh] = frame;
    camera.left = fx - PIVOT;
    camera.right = fx + fw - PIVOT;
    camera.top = -fy;
    camera.bottom = -(fy + fh);
    camera.position.set(PIVOT - Math.sin(angle * RAD) * DISTANCE, 0, Math.cos(angle * RAD) * DISTANCE);
    camera.lookAt(PIVOT, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const { uniforms } = composite;
    onCanvas([poses.A.x + poses.A.hipX, poses.A.hipY, 0], uniforms.anchorA.value);
    if (!solo) onCanvas([poses.B.x - poses.B.hipX, poses.B.hipY, 0], uniforms.anchorB.value);
    uniforms.wobble.value = ink ? 1 : 0;

    renderer.setClearColor(0xffffff, 0);
    use("flat");
    renderer.setRenderTarget(targets.color);
    renderer.clear();
    renderer.render(scene, camera);
    use("light");
    renderer.setRenderTarget(targets.light);
    renderer.clear();
    renderer.render(scene, camera);
    scene.overrideMaterial = normals;
    renderer.setRenderTarget(targets.normal);
    renderer.setClearColor(0x8080ff, 1);
    renderer.clear();
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(page, flatCamera);
  };
  return stage;
}
