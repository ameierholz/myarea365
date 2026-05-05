/**
 * MarchSpritesLayer — Mapbox Custom WebGL Layer that renders all visible
 * marches as animated sprite-billboards in a SINGLE draw call (Three.js
 * InstancedMesh). Designed for 100+ simultaneous marches.
 *
 * Pattern: Three.js inside Mapbox CustomLayer (sharing the GL context).
 * Per atlas (char × action) → one InstancedMesh; each instance = one march.
 * Per-frame update: position interpolated along route, direction from bearing,
 * frame from elapsed-time × FPS → instance UV-offset.
 */

import * as THREE from "three";
import mapboxgl from "mapbox-gl";
import {
  bearingToDirectionIndex,
  bearingBetween,
  frameIndexForTime,
  interpolatePosition,
  loadAllManifests,
  loadAtlasImage,
  type ActionTag,
  type SpriteManifest,
} from "./march-sprites";

export type MarchInstance = {
  id: string;            // unique march id (uuid)
  charId: string;        // sprite-char id (e.g. "lorekeeper")
  action: ActionTag;     // current action
  fromLat: number; fromLng: number;
  toLat: number; toLng: number;
  startMs: number;       // epoch ms
  endMs: number;         // epoch ms
  spriteScale?: number;  // pixel-height of the sprite (default 48)
};

// ─── Vertex / Fragment shader ─────────────────────────────────────────────
// Three.js ShaderMaterial injiziert automatisch:
//   - attribute vec3 position
//   - attribute vec2 uv
//   - uniform mat4 projectionMatrix
//   - uniform mat4 modelViewMatrix
// Wir deklarieren NUR unsere eigenen Per-Instance-Attribute (aOffset, aUvRect)
// und Custom-Uniforms.
//
// Anti-Jitter: aOffset enthält die Mercator-Position RELATIV zu uOrigin
// (subtrahiert in JS). Sonst leidet die Float-Präzision in der Vertex-Shader-Math
// bei Mercator-Werten ~0.5 + Sprite-Offset ~1e-6 (highp ≈ 7 Stellen).
// Die volle Position wird in der Matrix-Pipeline rekonstruiert: uOrigin (groß) +
// aOffset (klein) → mat4-mul mit double-precision-aware Mapbox-Matrix.
const VERT = /* glsl */ `
  attribute vec3 aOffset;
  attribute vec4 aUvRect;
  uniform float uPixelScale;
  uniform vec2 uSpritePixelSize;
  uniform vec3 uOrigin;
  varying vec2 vUv;
  void main() {
    vec3 worldOffset = vec3(
      position.x * uSpritePixelSize.x * uPixelScale,
      position.y * uSpritePixelSize.y * uPixelScale,
      0.0
    );
    vec3 finalPos = uOrigin + aOffset + worldOffset;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
    vUv = vec2(aUvRect.x + uv.x * aUvRect.z, aUvRect.y + (1.0 - uv.y) * aUvRect.w);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uAtlas;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uAtlas, vUv);
    if (c.a < 0.05) discard;
    gl_FragColor = c;
  }
`;

type AtlasGroup = {
  manifest: SpriteManifest;
  texture: THREE.Texture;
  mesh: THREE.Mesh;
  geometry: THREE.InstancedBufferGeometry;
  offsetAttr: THREE.InstancedBufferAttribute; // vec3 per instance
  uvAttr: THREE.InstancedBufferAttribute;     // vec4 per instance
  instances: MarchInstance[];
  capacity: number;
};

const MAX_INSTANCES_PER_GROUP = 256;

export class MarchSpritesLayer {
  id = "march-sprites";
  type = "custom" as const;
  renderingMode = "3d" as const;

  private map: mapboxgl.Map | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private camera: THREE.Camera = new THREE.Camera();
  private scene: THREE.Scene = new THREE.Scene();
  private groups = new Map<string, AtlasGroup>(); // key = `${charId}/${action}`
  private marches = new Map<string, MarchInstance>();
  private animFps = 12;

  constructor(initialMarches: MarchInstance[] = []) {
    initialMarches.forEach((m) => this.marches.set(m.id, m));
  }

  /** Replace the full set of active marches (reactive update). */
  setMarches(list: MarchInstance[]) {
    this.marches.clear();
    list.forEach((m) => this.marches.set(m.id, m));
    this.regroupInstances();
  }

  /** Add or update a single march. */
  upsertMarch(m: MarchInstance) {
    this.marches.set(m.id, m);
    this.regroupInstances();
  }

  removeMarch(id: string) {
    this.marches.delete(id);
    this.regroupInstances();
  }

  // ── Mapbox CustomLayerInterface ──
  async onAdd(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl as unknown as WebGLRenderingContext,
      antialias: true,
    });
    this.renderer.autoClear = false;

    // Pre-load: for now just lorekeeper. Later iterate over all char-ids in marches.
    await this.ensureGroupsForChar("lorekeeper");
  }

  onRemove() {
    for (const g of this.groups.values()) {
      g.geometry.dispose();
      g.texture.dispose();
      (g.mesh.material as THREE.Material).dispose();
    }
    this.groups.clear();
    this.renderer?.dispose();
    this.renderer = null;
  }

  async ensureGroupsForChar(charId: string) {
    const manifests = await loadAllManifests(charId);
    for (const action of Object.keys(manifests) as ActionTag[]) {
      const m = manifests[action]!;
      const key = `${charId}/${action}`;
      if (this.groups.has(key)) continue;
      const img = await loadAtlasImage(m.atlas);
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;

      // Quad geometry (-0.5..0.5)
      const baseGeo = new THREE.PlaneGeometry(1, 1);
      const geo = new THREE.InstancedBufferGeometry();
      geo.index = baseGeo.index;
      geo.setAttribute("position", baseGeo.getAttribute("position"));
      geo.setAttribute("uv", baseGeo.getAttribute("uv"));

      const offsetArr = new Float32Array(MAX_INSTANCES_PER_GROUP * 3);
      const uvArr = new Float32Array(MAX_INSTANCES_PER_GROUP * 4);
      const offsetAttr = new THREE.InstancedBufferAttribute(offsetArr, 3);
      const uvAttr = new THREE.InstancedBufferAttribute(uvArr, 4);
      offsetAttr.setUsage(THREE.DynamicDrawUsage);
      uvAttr.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute("aOffset", offsetAttr);
      geo.setAttribute("aUvRect", uvAttr);
      geo.instanceCount = 0;

      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uAtlas: { value: tex },
          uPixelScale: { value: 1.0 },
          uSpritePixelSize: { value: new THREE.Vector2(48, 64) },
          uOrigin: { value: new THREE.Vector3(0, 0, 0) },
        },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = false;
      mesh.matrixWorld.identity();
      this.scene.add(mesh);

      this.groups.set(key, {
        manifest: m,
        texture: tex,
        mesh,
        geometry: geo,
        offsetAttr,
        uvAttr,
        instances: [],
        capacity: MAX_INSTANCES_PER_GROUP,
      });
    }
    this.regroupInstances();
  }

  private regroupInstances() {
    // Bucket marches by (char, action) into groups
    for (const g of this.groups.values()) g.instances = [];
    for (const m of this.marches.values()) {
      const key = `${m.charId}/${m.action}`;
      const g = this.groups.get(key);
      if (g) g.instances.push(m);
    }
    for (const g of this.groups.values()) g.geometry.instanceCount = g.instances.length;
  }

  render(_gl: WebGL2RenderingContext, matrix: number[] | Float32Array) {
    if (!this.map || !this.renderer) return;
    const map = this.map;
    const now = Date.now();

    // Mapbox transformation: matrix maps from mercator-coords to clip-space.
    // Build a Three.js compatible camera with this projection.
    this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix as number[]);
    this.camera.matrixWorld.identity();
    this.camera.matrixWorldInverse.identity();

    // Pixel→Mercator-Skala. Mapbox-Konvention: 1 mercator unit = entire world width.
    // Bei Zoom Z hat die Welt 256 * 2^Z Pixel Breite, also 1 unit = 256 * 2^Z pixel.
    // → mer/pixel = 1 / (256 * 2^Z)
    const zoom = map.getZoom();
    const merPerPixel = 1.0 / (256 * Math.pow(2, zoom));

    // Anti-Jitter: Origin = aktuelles View-Center in Mercator. Sprite-Positionen
    // werden RELATIV dazu im aOffset gespeichert (kleine Zahlen, gute Float-Präzision).
    const center = map.getCenter();
    const originMerc = mapboxgl.MercatorCoordinate.fromLngLat([center.lng, center.lat], 0);

    // Update each group's instance buffers
    for (const g of this.groups.values()) {
      if (g.instances.length === 0) continue;
      const m = g.manifest;
      const cellWuv = m.cell_w / m.atlas_w;
      const cellHuv = m.cell_h / m.atlas_h;

      for (let i = 0; i < g.instances.length; i++) {
        const inst = g.instances[i];
        const total = inst.endMs - inst.startMs;
        const progress = total > 0 ? Math.min(1, Math.max(0, (now - inst.startMs) / total)) : 0;
        const [lat, lng] = interpolatePosition(inst.fromLat, inst.fromLng, inst.toLat, inst.toLng, progress);
        const merc = mapboxgl.MercatorCoordinate.fromLngLat([lng, lat], 0);

        g.offsetAttr.array[i * 3 + 0] = merc.x - originMerc.x;
        g.offsetAttr.array[i * 3 + 1] = merc.y - originMerc.y;
        g.offsetAttr.array[i * 3 + 2] = 0;

        const bearing = bearingBetween(inst.fromLat, inst.fromLng, inst.toLat, inst.toLng);
        const dir = bearingToDirectionIndex(bearing, m.directions);
        const frame = frameIndexForTime(now - inst.startMs, m.frames, this.animFps);

        g.uvAttr.array[i * 4 + 0] = frame * cellWuv;
        g.uvAttr.array[i * 4 + 1] = dir * cellHuv;
        g.uvAttr.array[i * 4 + 2] = cellWuv;
        g.uvAttr.array[i * 4 + 3] = cellHuv;
      }
      g.offsetAttr.needsUpdate = true;
      g.uvAttr.needsUpdate = true;

      // Update uniform pixel scale + sprite pixel size + origin
      const mat = g.mesh.material as THREE.ShaderMaterial;
      mat.uniforms.uPixelScale.value = merPerPixel;
      const scale = g.instances[0]?.spriteScale ?? 48;
      mat.uniforms.uSpritePixelSize.value.set(scale, scale * (m.cell_h / m.cell_w));
      mat.uniforms.uOrigin.value.set(originMerc.x, originMerc.y, 0);
    }

    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);

    // Continuous animation
    map.triggerRepaint();
  }
}
