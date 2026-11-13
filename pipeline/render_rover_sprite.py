"""Frames of the little rover that rides down the page -> public/rover/perseverance_sprite.webp

Renders NASA's Perseverance model (public/models/perseverance.glb; public domain, NASA-3D-Resources) into a sprite
sheet of 8 columns of 288x162 frames with a transparent background, seen from the side, front to the left:
  0-23  spin: a full turn in 15 degree steps about the cable's hook (deck centre)
  24-29 drive: the six wheels turning 0-50 degrees (the wheels repeat every 60 degrees)
  30-37 mast: stowed -> raised (the model's own deploy animation)
  38-47 arm: stowed -> raised (the model's own arm animation)
  48-56 pan: camera head turned -60 -> +60 degrees (+60 faces the viewer)
The hook sits at (164.9, 60.2) in every frame. src/components/ScrollRover.tsx uses these numbers; keep them in sync.
Rendering runs three.js (from node_modules) in headless Chromium with software WebGL, so no GPU is needed.
Run: npm install && pip install playwright pillow && playwright install chromium
     python pipeline/render_rover_sprite.py
"""
import base64
import functools
import io
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "rover" / "perseverance_sprite.webp"

PAGE = r"""<!doctype html><html><body style="margin:0">
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<script>window.addEventListener('error', () => { window.FAILED = true; });</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
async function setup(W, H) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(W, H); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0; r.outputColorSpace = THREE.SRGBColorSpace;
  r.setClearColor(0x000000, 0);
  document.body.appendChild(r.domElement);
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
  const d = new DRACOLoader(); d.setDecoderPath('/public/draco/');
  const l = new GLTFLoader(); l.setDRACOLoader(d);
  const g = await l.loadAsync('/public/models/perseverance.glb');
  const pivot = new THREE.Group(); scene.add(pivot); pivot.add(g.scene);
  const mixer = new THREE.AnimationMixer(g.scene);
  const clips = g.animations;
  return { THREE, r, scene, g, pivot, mixer, clips };
}

const CW = 288, CH = 162, COLS = 8;
// world frame around the cable hook A (deck centre): 3.15 m ahead of it, 2.35 m behind, 1.15 m above
const FL = -3.15, FR = 2.35, FT = 1.15, FB = 1.15 - (2.35 + 3.15) * 162 / 288;
const A_WORLD = [0, 1.5, -0.14];
const REST = 3.8;
const groups = {
  spin:  Array.from({ length: 24 }, (_, i) => ({ yaw: i * 15 })),
  drive: Array.from({ length: 6 }, (_, i) => ({ wheel: i * 10 })),
  mast:  Array.from({ length: 8 }, (_, i) => ({ mastT: (i / 7) * 1.25 })),
  arm:   Array.from({ length: 10 }, (_, i) => ({ armT: REST + (i / 9) * (6.2 - REST) })),
  pan:   Array.from({ length: 9 }, (_, i) => ({ pan: -60 + i * 15 })),
};
const order = Object.keys(groups);
const total = order.reduce((n, k) => n + groups[k].length, 0);
const ROWS = Math.ceil(total / COLS);
const { r, scene, g, pivot, mixer, clips } = await setup(CW * COLS, CH * ROWS);

// light: env for the metal, a warm key from upper front-left, a cool fill
scene.environmentIntensity = 0.8;
const key = new THREE.DirectionalLight(0xfff0dc, 1.6); key.position.set(-2, 5, 6); scene.add(key);
const fill = new THREE.DirectionalLight(0x9db8ff, 0.35); fill.position.set(4, 1, -3); scene.add(fill);

// turntable about the hook's vertical axis
const A = new THREE.Vector3(...A_WORLD);
pivot.position.set(A.x, 0, A.z); g.scene.position.set(-A.x, 0, -A.z);

// animation actions: mast vs everything else
const MAST = /^(Cylinder|bottom|top|Cylinder002|Empty001|probe001)\./;
const acts = clips.map((c) => { const a = mixer.clipAction(c); a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; a.play(); return { a, mast: c.tracks.every((t) => MAST.test(t.name)) }; });
const pose = (mastT, otherT) => { acts.forEach(({ a, mast }) => { a.time = Math.min(mast ? mastT : otherT, a.getClip().duration); }); mixer.update(0); };

// split the single wheels mesh into six wheels so each turns on its own axle
const wheelsGroup = g.scene.getObjectByName('Wheels_objs');
const wheelMeshes = []; wheelsGroup.traverse((o) => { if (o.isMesh) wheelMeshes.push(o); });
const spinners = [];
for (const m of wheelMeshes) {
  const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
  const pos = geo.attributes.position, nT = pos.count / 3;
  const buckets = new Map();
  for (let t = 0; t < nT; t++) {
    let cx = 0, cz = 0; for (let v = 0; v < 3; v++) { cx += pos.getX(t * 3 + v); cz += pos.getZ(t * 3 + v); }
    cx /= 3; cz /= 3;
    const key = `${cx > 0 ? 1 : 0}_${Math.round(cz / 1.0)}`;
    if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(t);
  }
  for (const [, tris] of buckets) {
    const sub = new THREE.BufferGeometry();
    for (const name of Object.keys(geo.attributes)) {
      const src = geo.attributes[name], arr = new src.array.constructor(tris.length * 3 * src.itemSize);
      tris.forEach((t, j) => { for (let v = 0; v < 3; v++) for (let c = 0; c < src.itemSize; c++) arr[(j * 3 + v) * src.itemSize + c] = src.array[(t * 3 + v) * src.itemSize + c]; });
      sub.setAttribute(name, new THREE.BufferAttribute(arr, src.itemSize, src.normalized));
    }
    sub.computeBoundingBox(); const c = sub.boundingBox.getCenter(new THREE.Vector3());
    sub.translate(-c.x, -c.y, -c.z);
    const hub = new THREE.Group(); hub.position.copy(c);
    hub.add(new THREE.Mesh(sub, m.material)); m.parent.add(hub);
    spinners.push(hub);
  }
  m.visible = false;
}

const cam = new THREE.OrthographicCamera(FL, FR, FT, FB, 0.1, 100);
const az = 70 * Math.PI / 180, el = 12 * Math.PI / 180, R = 20;
cam.position.set(A.x + R * Math.cos(el) * Math.sin(az), A.y + R * Math.sin(el), A.z + R * Math.cos(el) * Math.cos(az));
cam.lookAt(A);

const top = g.scene.getObjectByName('top');
r.setScissorTest(true);
let i = 0; const start = {};
for (const k of order) {
  start[k] = i;
  for (const f of groups[k]) {
    pivot.rotation.set(0, (f.yaw ?? 0) * Math.PI / 180, 0);
    pose(f.mastT ?? REST, f.armT ?? REST);
    const q0 = top.quaternion.clone();
    if (f.pan) top.rotateY(f.pan * Math.PI / 180);
    spinners.forEach((s) => s.rotation.set((f.wheel ?? 0) * Math.PI / 180, 0, 0));
    const x = (i % COLS) * CW, y = (ROWS - 1 - Math.floor(i / COLS)) * CH;
    r.setViewport(x, y, CW, CH); r.setScissor(x, y, CW, CH); r.render(scene, cam);
    top.quaternion.copy(q0);
    i++;
  }
}
const hook = [(-FL / (FR - FL)) * CW, (FT / (FT - FB)) * CH];
window.INFO = { cell: [CW, CH], cols: COLS, rows: ROWS, total, start, counts: Object.fromEntries(order.map((k) => [k, groups[k].length])), hook, wheels: spinners.length };
window.OUT = { ...window.INFO, png: r.domElement.toDataURL('image/png') };
window.DONE = true;
</script></body></html>
"""

server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(SimpleHTTPRequestHandler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{server.server_address[1]}"

with sync_playwright() as p:
    browser = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    page = browser.new_page(viewport={"width": 2304, "height": 1296})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.route(f"{base}/__render.html", lambda route: route.fulfill(body=PAGE, content_type="text/html"))
    page.goto(f"{base}/__render.html")
    page.wait_for_function("window.DONE === true || window.FAILED", timeout=600_000)
    if errors:
        raise SystemExit(f"render failed: {errors[0]}")
    out = page.evaluate("window.OUT")
    browser.close()
server.shutdown()

png = base64.b64decode(out.pop("png").split(",", 1)[1])
OUT.parent.mkdir(parents=True, exist_ok=True)
Image.open(io.BytesIO(png)).convert("RGBA").save(OUT, "WEBP", quality=82, method=6)
print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")
print(json.dumps(out))
