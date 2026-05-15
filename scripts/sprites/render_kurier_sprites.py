"""
Kurier-Streife Sprite-Renderer — Blender Python.

Rendert ZWEI NPC-Modelle:

  Mutant (statisch, "Old Man") → kurier_idle/walk/react/dying_NxS.png
  Jamestrupp (Walker)          → kurier_walker_idle/walk/dying_NxS.png

Alle 128×128 transparent, 55° Top-Down-Pitch (passt zur Mapbox-Marker-Größe).

Aufruf (vom Projekt-Root):

    & "C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe" \\
        --background --python scripts/sprites/render_kurier_sprites.py

Output: scripts/sprites/_out/<prefix>/<tag>/frame_NN.png
        apps/web/public/sprites/<prefix>_<tag>_NxS.png
"""

import sys
import os
import math
from pathlib import Path

import bpy

# ─── CONFIG ───────────────────────────────────────────────────────────────
OUT_BASE = Path(__file__).resolve().parents[2] / "apps" / "web" / "public" / "sprites"
OUT_FRAMES_BASE = Path(__file__).resolve().parent / "_out"
FRAME_SIZE = 128
CAMERA_PITCH_DEG = 55.0

# Zwei Modelle: jedes hat eigenen Output-Prefix + eigene FBX-Mappings.
# Tag-Konvention: idle, walk, react, dying — das Frontend probt jedes per Image-onerror.
MODELS = [
    {
        "prefix": "mutant",
        "fbx_dir": Path(r"C:\Users\ameie\Desktop\3D_Modelle\Mutant"),
        "actions": {
            # User-Wunsch 2026-05-15: Zombie-Stance fuer idle
            "Zombie Idle.fbx":          ("idle",   12),
            "Unarmed Walk Forward.fbx": ("walk",   16),
            "Reaction.fbx":             ("react",   8),
            "Dying.fbx":                ("dying",  16),
        },
    },
    {
        "prefix": "mutant_walker",
        "fbx_dir": Path(r"C:\Users\ameie\Desktop\3D_Modelle\Jamestrupp"),
        "actions": {
            "Standing Arguing.fbx":   ("idle",   12),
            "Walking.fbx":            ("walk",   16),
            "Falling Back Death.fbx": ("dying",  16),
        },
    },
]


def log(msg: str) -> None:
    print(f"[kurier] {msg}", flush=True)


# ─── Engine + Settings einmalig ───────────────────────────────────────────
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


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def find_first_armature():
    for obj in bpy.data.objects:
        if obj.type == "ARMATURE":
            return obj
    return None


def world_bounds():
    from mathutils import Vector
    minv = Vector((float("inf"),) * 3)
    maxv = Vector((float("-inf"),) * 3)
    found = False
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            for i in range(3):
                if world[i] < minv[i]:
                    minv[i] = world[i]
                if world[i] > maxv[i]:
                    maxv[i] = world[i]
            found = True
    return (minv, maxv) if found else (None, None)


TARGET_HEIGHT_M = 1.75  # einheitliche Soll-Höhe nach Normalisierung


def normalize_armature_height(armature) -> float:
    """Skaliert die Armature so dass der Char genau TARGET_HEIGHT_M hoch ist.
    Wichtig weil Mixamo-FBX teils mit cm-Skala (1.7 m → 170 m) oder mit
    Mikro-Skala (1.7 m → 0.05 m) importiert wird, je nach FBX-Version.
    Ohne diese Normalisierung greift der ortho_scale-Floor → Char zu klein."""
    minv, maxv = world_bounds()
    if minv is None:
        return TARGET_HEIGHT_M
    raw_h = maxv.z - minv.z
    if raw_h < 1e-6:
        return TARGET_HEIGHT_M
    factor = TARGET_HEIGHT_M / raw_h
    armature.scale = (armature.scale[0] * factor,
                      armature.scale[1] * factor,
                      armature.scale[2] * factor)
    bpy.context.view_layer.update()
    log(f"  Normalize: raw_h={raw_h:.4f}m → factor={factor:.3f} → {TARGET_HEIGHT_M}m")
    return TARGET_HEIGHT_M


def setup_camera_and_lights(char_height: float, char_center) -> None:
    scene = bpy.context.scene
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = "ORTHO"
    # 0.95× → fast volle Höhe füllen + minimaler Rand. Nach Normalisierung
    # auf 1.75 m greift kein Floor mehr.
    cam_data.ortho_scale = char_height * 0.95
    cam = bpy.data.objects.new("Cam", cam_data)
    scene.collection.objects.link(cam)

    # CAMERA_PITCH_DEG = Winkel von der HORIZONTALEN (55° = stark top-down).
    # Default-Kamera schaut -Z; um sie um Winkel θ von der Vertikalen zu kippen
    # (so dass sie auf char_center blickt), rotiere um X um (90° - pitch).
    pitch_rad = math.radians(CAMERA_PITCH_DEG)
    rot_rad = math.radians(90.0 - CAMERA_PITCH_DEG)
    cam_dist = max(3.0, char_height * 2.5)
    # Ziel auf Brusthöhe statt Schwerpunkt — so steht der NPC besser im Frame
    target = (char_center[0], char_center[1], char_center[2] + char_height * 0.05)
    cam.location = (
        target[0],
        target[1] - cam_dist * math.cos(pitch_rad),
        target[2] + cam_dist * math.sin(pitch_rad),
    )
    cam.rotation_euler = (rot_rad, 0, 0)
    scene.camera = cam

    # 3-Punkt-Sun-Setup (identisch zu Lorekeeper-Pipeline)
    def add_sun(name, energy, color, rot_deg):
        light = bpy.data.lights.new(name, "SUN")
        light.energy = energy
        light.color = color
        obj = bpy.data.objects.new(name, light)
        obj.rotation_euler = tuple(math.radians(d) for d in rot_deg)
        scene.collection.objects.link(obj)

    add_sun("Key",  3.5, (1.0, 1.0, 1.0), (50, 30, 0))
    add_sun("Fill", 1.0, (0.9, 0.85, 1.0), (60, -50, 0))
    add_sun("Rim",  1.5, (1.0, 0.9, 0.7), (70, 180, 0))


def render_frames_to_sheet(action, prefix: str, tag: str, frame_count: int) -> Path:
    """Rendert frame_count Frames der gegebenen Action, packt sie zu einem
    horizontalen Sprite-Sheet. Returns Pfad zum Sheet."""
    scene = bpy.context.scene
    out_frames = OUT_FRAMES_BASE / prefix / tag
    out_frames.mkdir(parents=True, exist_ok=True)

    a_start = action.frame_range[0]
    a_end = action.frame_range[1]
    clip_span = a_end - a_start

    frame_paths: list[Path] = []
    for i in range(frame_count):
        t = i / max(1, frame_count - 1) if frame_count > 1 else 0.0
        src_frame = int(round(a_start + t * clip_span))
        scene.frame_set(src_frame)
        out_path = out_frames / f"frame_{i:02d}.png"
        scene.render.filepath = str(out_path)
        bpy.ops.render.render(write_still=True)
        frame_paths.append(out_path)

    # Pack to horizontal sheet
    sheet_w = FRAME_SIZE * frame_count
    sheet_h = FRAME_SIZE
    sheet_path = OUT_BASE / f"{prefix}_{tag}_{frame_count}x{FRAME_SIZE}.png"

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


def process_fbx(fbx_path: Path, prefix: str, tag: str, frame_count: int) -> None:
    log(f"━━━ [{prefix}] {fbx_path.name} → {tag} ({frame_count} frames) ━━━")
    reset_scene()
    setup_engine()

    bpy.ops.import_scene.fbx(filepath=str(fbx_path))

    armature = find_first_armature()
    if armature is None:
        log(f"SKIP: keine Armature in {fbx_path.name}")
        return

    actions = list(bpy.data.actions.keys())
    if not actions:
        log(f"SKIP: keine Animationen in {fbx_path.name}")
        return

    # Bevorzuge Action mit tag im Namen, sonst die erste
    clip_name = next((a for a in actions if tag in a.lower()), actions[0])
    log(f"  Action: {clip_name} (available: {actions})")
    action = bpy.data.actions[clip_name]
    if armature.animation_data is None:
        armature.animation_data_create()
    armature.animation_data.action = action

    # Auf Frame 0 der Action springen damit Bounds + Normalisierung
    # auf der echten geposeten Geometrie basieren (nicht der T-Pose).
    bpy.context.scene.frame_set(int(action.frame_range[0]))

    # Auf einheitliche Höhe normalisieren — sonst rendert Mixamo-FBX bei
    # micro-scale FBX-Versionen einen 5cm hohen Char in 1.2m großem Frame.
    normalize_armature_height(armature)

    minv, maxv = world_bounds()
    if minv is None:
        char_height, char_center = TARGET_HEIGHT_M, (0.0, 0.0, TARGET_HEIGHT_M / 2)
    else:
        char_height = maxv.z - minv.z
        char_center = ((minv[0] + maxv[0]) / 2, (minv[1] + maxv[1]) / 2, (minv[2] + maxv[2]) / 2)
    log(f"  Bounds (post-normalize): height={char_height:.2f}m center={tuple(round(c, 2) for c in char_center)}")

    setup_camera_and_lights(char_height, char_center)

    sheet_path = render_frames_to_sheet(action, prefix, tag, frame_count)
    log(f"  ✓ {sheet_path}")


# ─── Main ─────────────────────────────────────────────────────────────────
OUT_BASE.mkdir(parents=True, exist_ok=True)

rendered: list[tuple[str, str, int]] = []  # (prefix, tag, frame_count)

for model in MODELS:
    prefix = model["prefix"]
    fbx_dir = model["fbx_dir"]
    if not fbx_dir.is_dir():
        log(f"WARN: FBX-Ordner für '{prefix}' nicht gefunden: {fbx_dir}")
        continue
    log("")
    log(f"╔══ Model: {prefix} ({fbx_dir.name}) ══╗")
    for fname, (tag, frame_count) in model["actions"].items():
        fbx_path = fbx_dir / fname
        if not fbx_path.is_file():
            log(f"SKIP: {fname} nicht gefunden in {fbx_dir}")
            continue
        process_fbx(fbx_path, prefix, tag, frame_count)
        rendered.append((prefix, tag, frame_count))

log("")
log("✓ Done.")
log(f"  Output: {OUT_BASE}")
log(f"  Sheets gerendert: {len(rendered)}")
for (prefix, tag, frame_count) in rendered:
    log(f"    → {prefix}_{tag}_{frame_count}x{FRAME_SIZE}.png")
