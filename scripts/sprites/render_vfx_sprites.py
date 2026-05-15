"""
VFX Sprite-Renderer — Blender Python.

Rendert prozedurale VFX-Sprite-Sheets fuer Crew-Angriff-Kampf-Visualisierung
auf der Mapbox-Map. Anders als die Charakter-Renderer (Mutant/Walker) gibt es
hier keine FBX-Quelle — die Effekte werden direkt mit Blender-Geometrie
(animated meshes + emissive shader + bloom) gebaut.

Effekte (Stand erste Version — Proof-of-Concept):

  slash      → 8  frames, 128x128   (loop, weiss-cyan Bogenschnitt)
  explosion  → 16 frames, 128x128   (one-shot, orange-gelber Burst)

Erweiterungs-Slots (nicht in v1): blood, smoke, sparks, shockwave.

Aufruf (vom Projekt-Root):

    & "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" \\
        --background --python scripts/sprites/render_vfx_sprites.py

Output:
    scripts/sprites/_out/vfx/<tag>/frame_NN.png
    apps/web/public/sprites/vfx_<tag>_NxS.png

Design-Notes:
- Top-Down ortho cam wie bei Charakter-Sprites (gleiche Perspektive auf Map).
- Emissive Shader → kein Lighting noetig, Effekt strahlt selbst (passt zu Glow).
- Bloom (Eevee) verstaerkt den Look ohne extra Post-FX im Frontend.
- transparenter Hintergrund → laesst sich als CSS-Sprite-Layer ueber Mutant
  blenden ohne Mask-Probleme.
"""

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

# ─── CONFIG ───────────────────────────────────────────────────────────────
OUT_BASE = Path(__file__).resolve().parents[2] / "apps" / "web" / "public" / "sprites"
OUT_FRAMES_BASE = Path(__file__).resolve().parent / "_out" / "vfx"
FRAME_SIZE = 128

# VFX-Definitionen. Jede entry buildet einmal die Geometry + Animation, dann
# rendert die `frames` ueber das gesamte Frame-Range.
VFX_DEFS = [
    {"tag": "slash",     "frames": 8,  "build": "build_slash"},
    {"tag": "explosion", "frames": 16, "build": "build_explosion"},
]


def log(msg: str) -> None:
    print(f"[vfx] {msg}", flush=True)


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def setup_engine() -> None:
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = FRAME_SIZE
    scene.render.resolution_y = FRAME_SIZE
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    # Bloom-Glow fuer Emissive — macht VFX strahlend (Eevee-Default ist aus).
    try:
        scene.eevee.use_bloom = True
        scene.eevee.bloom_intensity = 0.5
        scene.eevee.bloom_radius = 4.0
    except AttributeError:
        # EEVEE_NEXT in 5.1 hat anderes API, falls Bloom nicht greift egal.
        pass


def setup_camera_topdown() -> None:
    """Reine Top-Down-Kamera (90 Grad pitch) — VFX sieht von oben symmetrisch
    aus, anders als Charaktere die einen Tilt brauchen."""
    scene = bpy.context.scene
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = "ORTHO"
    # 1.5m FOV → VFX-Spielraum, Effekte sind ca. 0.8m im Durchmesser
    cam_data.ortho_scale = 1.5
    cam = bpy.data.objects.new("Cam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (0, 0, 3)
    cam.rotation_euler = (0, 0, 0)
    scene.camera = cam


def make_emissive_material(name: str, rgb: tuple, intensity: float):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    # alte default-nodes entfernen
    for n in list(nodes):
        nodes.remove(n)
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (*rgb, 1.0)
    emission.inputs["Strength"].default_value = intensity
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    mix = nodes.new("ShaderNodeMixShader")
    output = nodes.new("ShaderNodeOutputMaterial")
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(emission.outputs[0], mix.inputs[2])
    # Alpha-channel kommt aus material.blend_method (siehe build_*)
    mix.inputs["Fac"].default_value = 1.0
    links.new(mix.outputs[0], output.inputs["Surface"])
    mat.blend_method = "BLEND"
    return mat


def keyframe(obj, frame: int, **props):
    """Helper: setzt props auf obj und keyframet sie bei frame."""
    for prop, value in props.items():
        if prop == "location":
            obj.location = value
            obj.keyframe_insert(data_path="location", frame=frame)
        elif prop == "scale":
            obj.scale = value
            obj.keyframe_insert(data_path="scale", frame=frame)
        elif prop == "rotation":
            obj.rotation_euler = value
            obj.keyframe_insert(data_path="rotation_euler", frame=frame)


# ─── EFFEKT 1: SLASH ─────────────────────────────────────────────────────
def build_slash(frames: int) -> None:
    """Bogenfoermiger Schwert-Schnitt: ein gekruemmtes Mesh (Torus-Segment)
    skaliert von links nach rechts ueber die Frames. Weiss-cyan emissive."""
    # Torus mit dickem Tube fuer Klingen-Look
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.5,
        minor_radius=0.04,
        major_segments=24,
        minor_segments=6,
    )
    torus = bpy.context.active_object
    torus.location = (0, 0, 0)

    # Material: weiss-cyan, sehr hell
    mat = make_emissive_material("slash_mat", (0.85, 1.0, 1.0), intensity=15.0)
    torus.data.materials.append(mat)

    # Animation: rotation Z von -90° auf +90° + scale Y ramp (0.1 → 1 → 0.3)
    # → sieht aus wie ein Klingen-Bogen der durchs Bild schwingt
    end = frames
    keyframe(torus, 1, rotation=(0, 0, math.radians(-100)), scale=(0.2, 0.2, 0.1))
    keyframe(torus, end // 2, rotation=(0, 0, 0), scale=(1.0, 1.0, 0.1))
    keyframe(torus, end, rotation=(0, 0, math.radians(100)), scale=(0.3, 0.3, 0.1))


# ─── EFFEKT 2: EXPLOSION ─────────────────────────────────────────────────
def build_explosion(frames: int) -> None:
    """Zwei Layer:
       - zentraler core: weisser sphere, expandiert + fade out (scale 0→1.5)
       - aussen burst: orange-rote shell, expandiert + verblasst (scale 0→2)
    Beide emissive damit sie ohne Lichter strahlen."""
    end = frames

    # Core
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.2, segments=16, ring_count=8)
    core = bpy.context.active_object
    core.name = "core"
    core_mat = make_emissive_material("core_mat", (1.0, 0.95, 0.7), intensity=25.0)
    core.data.materials.append(core_mat)
    keyframe(core, 1, scale=(0.01, 0.01, 0.01))
    keyframe(core, end // 3, scale=(1.5, 1.5, 1.5))
    keyframe(core, end, scale=(0.1, 0.1, 0.1))

    # Outer shell
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.3, segments=20, ring_count=10)
    shell = bpy.context.active_object
    shell.name = "shell"
    shell_mat = make_emissive_material("shell_mat", (1.0, 0.5, 0.1), intensity=10.0)
    shell.data.materials.append(shell_mat)
    keyframe(shell, 1, scale=(0.05, 0.05, 0.05))
    keyframe(shell, end // 2, scale=(2.0, 2.0, 2.0))
    keyframe(shell, end, scale=(2.5, 2.5, 2.5))

    # Animation der Material-Alpha (verblassen) — via fcurve auf intensity.
    # Wir setzen Emission-Strength keyframes ueber den Shader.
    def animate_strength(mat, frame_start: int, val_start: float, frame_end: int, val_end: float):
        emission = next(n for n in mat.node_tree.nodes if n.type == "EMISSION")
        emission.inputs["Strength"].default_value = val_start
        emission.inputs["Strength"].keyframe_insert(data_path="default_value", frame=frame_start)
        emission.inputs["Strength"].default_value = val_end
        emission.inputs["Strength"].keyframe_insert(data_path="default_value", frame=frame_end)

    animate_strength(core_mat, 1, 25.0, end, 0.5)
    animate_strength(shell_mat, 1, 10.0, end, 0.1)


# ─── RENDER + MONTAGE ────────────────────────────────────────────────────
def render_frames_to_sheet(tag: str, frame_count: int) -> Path:
    """Rendert frame_count Frames der aktuellen Szene + packt sie zu einem
    horizontalen Sprite-Sheet (analog Mutant-Pipeline)."""
    scene = bpy.context.scene
    out_frames = OUT_FRAMES_BASE / tag
    out_frames.mkdir(parents=True, exist_ok=True)

    frame_paths: list[Path] = []
    for i in range(frame_count):
        # Linear interpolation ueber das definierte Frame-Range (1..frame_count)
        src_frame = i + 1
        scene.frame_set(src_frame)
        out_path = out_frames / f"frame_{i:02d}.png"
        scene.render.filepath = str(out_path)
        bpy.ops.render.render(write_still=True)
        frame_paths.append(out_path)

    sheet_w = FRAME_SIZE * frame_count
    sheet_h = FRAME_SIZE
    sheet_path = OUT_BASE / f"vfx_{tag}_{frame_count}x{FRAME_SIZE}.png"

    try:
        import numpy as np
        sheet = np.zeros((sheet_h, sheet_w, 4), dtype=np.float32)
        for idx, p in enumerate(frame_paths):
            img = bpy.data.images.load(str(p))
            src = np.array(img.pixels[:], dtype=np.float32).reshape(img.size[1], img.size[0], 4)
            x = idx * FRAME_SIZE
            sheet[:, x:x + FRAME_SIZE, :] = src
            bpy.data.images.remove(img)
        pixels = sheet.flatten().tolist()
    except ImportError:
        log("WARN: numpy fehlt — pure-Python Pack (langsamer)")
        pixels = [0.0] * (sheet_w * sheet_h * 4)
        for idx, p in enumerate(frame_paths):
            img = bpy.data.images.load(str(p))
            src = list(img.pixels[:])
            sw, sh = img.size[0], img.size[1]
            x_off = idx * FRAME_SIZE
            for y in range(sh):
                for x in range(sw):
                    sp = (y * sw + x) * 4
                    dp = (y * sheet_w + (x + x_off)) * 4
                    for c in range(4):
                        pixels[dp + c] = src[sp + c]
            bpy.data.images.remove(img)

    sheet_img = bpy.data.images.new(f"sheet_{tag}", width=sheet_w, height=sheet_h, alpha=True)
    sheet_img.pixels = pixels
    sheet_img.filepath_raw = str(sheet_path)
    sheet_img.file_format = "PNG"
    sheet_img.save()
    bpy.data.images.remove(sheet_img)
    return sheet_path


def process_vfx(tag: str, frames: int, build_fn_name: str) -> None:
    log(f"━━━ vfx/{tag} ({frames} frames) ━━━")
    reset_scene()
    setup_engine()
    setup_camera_topdown()

    # Frame-Range setzen (1..frames)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = frames

    # Build-Funktion aus Globals aufrufen
    build_fn = globals()[build_fn_name]
    build_fn(frames)

    sheet_path = render_frames_to_sheet(tag, frames)
    log(f"  ✓ {sheet_path}")


def main() -> None:
    OUT_BASE.mkdir(parents=True, exist_ok=True)

    sheets: list[str] = []
    for vfx in VFX_DEFS:
        try:
            process_vfx(vfx["tag"], vfx["frames"], vfx["build"])
            sheets.append(f"vfx_{vfx['tag']}_{vfx['frames']}x{FRAME_SIZE}.png")
        except Exception as e:
            log(f"FAIL {vfx['tag']}: {e}")
            import traceback
            traceback.print_exc()

    log("")
    log("✓ Done.")
    log(f"  Output: {OUT_BASE}")
    log(f"  Sheets gerendert: {len(sheets)}")
    for s in sheets:
        log(f"    → {s}")


if __name__ == "__main__":
    main()
