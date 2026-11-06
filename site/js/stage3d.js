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
  OrthographicCamera,
  PlaneGeometry,
  RedFormat,
  Scene,
  ShaderMaterial,
  Vector2,
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

const VERTEX = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
const FRAGMENT = `
  uniform sampler2D tColor, tLight, tNormal, tDepth;
  uniform vec2 resolution;
  uniform float detail, range, line;
  uniform vec3 ink;
  varying vec2 vUv;
  float depthAt(vec2 uv) { return texture2D(tDepth, uv).x * range; }
  vec3 normalAt(vec2 uv) { return normalize(texture2D(tNormal, uv).xyz * 2.0 - 1.0); }
  void main() {
    vec2 px = 1.0 / resolution;
    float d = depthAt(vUv);
    vec3 n = normalAt(vUv);
    vec3 c0 = texture2D(tColor, vUv).rgb;
    bool figure = texture2D(tDepth, vUv).x < 0.999;
    float edge = 0.0;
    for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
      vec2 o = vec2(float(i), float(j)) * px * line * detail;
      float dd = abs(depthAt(vUv + o * 1.3) - d);
      float nn = 1.0 - dot(n, normalAt(vUv + o * 0.8));
      float cd = length(texture2D(tColor, vUv + o * 0.7).rgb - c0);
      edge = max(edge, max(smoothstep(1.5, 3.5, dd), max(0.8 * smoothstep(0.3, 0.55, nn), 0.85 * smoothstep(0.03, 0.07, cd))));
    }
    if (!figure) {
      // Outside the figures only the outer half of their outline, on clear canvas.
      gl_FragColor = vec4(ink * edge, edge);
      return;
    }
    vec3 colour = c0;
    float light = texture2D(tLight, vUv).r;
    float spacing = 4.0 * detail;
    float l1 = 1.0 - smoothstep(0.45 * detail, 0.95 * detail, abs(mod(gl_FragCoord.x + gl_FragCoord.y, spacing) - spacing * 0.5));
    float l2 = 1.0 - smoothstep(0.45 * detail, 0.95 * detail, abs(mod(gl_FragCoord.x - gl_FragCoord.y, spacing) - spacing * 0.5));
    if (light < 0.8) colour = mix(colour, ink, 0.6 * l1);
    if (light < 0.5) colour = mix(colour, ink, 0.6 * l2);
    gl_FragColor = vec4(mix(colour, ink, edge), 1.0);
  }`;

/**
 * Sets up the 3D figures on `canvas` and loads their bodies. Resolves to `draw(view)`, which draws the fencers for
 * `view`: { poses: { A, B }, solo, frame: [x, y, w, h] as the stage's viewBox, camera in degrees }, and `lost`, true
 * once the browser has taken the drawing away.
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
  const flat = new MeshBasicMaterial({ vertexColors: true });
  const normals = new MeshNormalMaterial();

  const fencers = {};
  for (const who of ["A", "B"]) {
    const figure = createFigure(bodies, who);
    const colours = new Float32Array(bodies.vertices * 3);
    const byGarment = bodies.garments.map((g) => new Color(COLOURS[who][g] ?? INK));
    const { garment } = bodies.figures[who];
    for (let v = 0; v < bodies.vertices; v++) {
      const c = byGarment[garment[v]];
      colours.set([c.r, c.g, c.b], 3 * v);
    }
    figure.mesh.geometry.setAttribute("color", new BufferAttribute(colours, 3));
    figure.mesh.material = flat;
    for (const part of figure.sabre.children) {
      part.material = new MeshBasicMaterial({ color: new Color(SABRE[part.name] ?? INK) });
      part.userData.flat = part.material;
    }
    scene.add(figure.group);
    fencers[who] = figure;
  }
  stage.fencers = fencers;
  const meshes = [];
  scene.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  const use = (pass) => {
    for (const mesh of meshes) mesh.material = pass === "flat" ? (mesh.userData.flat ?? flat) : light;
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
      ink: { value: new Color(INK) },
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

  stage.draw = ({ poses, solo, frame, camera: angle }) => {
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
