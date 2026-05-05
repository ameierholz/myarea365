"""
Sprite-Sheet-Renderer for MyArea365 — Blender Python script.

Loads a glTF character + its animation packs and renders 8-direction
sprite-frames per animation into PNG sequences with transparent background.

Usage (from project root):

    blender --background --python scripts/sprites/render_sprites.py -- \
        --char-id lorekeeper \
        --character apps/web/public/3d/lorekeeper/character.glb \
        --animations apps/web/public/3d/lorekeeper/anim_general.glb \
        --animations apps/web/public/3d/lorekeeper/anim_movement.glb \
        --actions Idle_A:idle:1,Walking_A:walk:16,Running_A:run:14,Hit_A:hit:8

Output:
    scripts/sprites/_out/<char_id>/<action>/dir<0-7>_frame<NNN>.png

Then run:
    pnpm tsx scripts/sprites/build_atlas.mjs <char_id>

…to pack the PNG sequences into per-action atlas PNGs + JSON manifests
(`apps/web/public/sprites/<char_id>/<action>.png|json`).

Why 8 directions?  RoK/CoD-style top-down map view — the camera
is fixed isometric; the character rotates in 45° steps to face its
march bearing. 8 directions is the sweet spot between disk size and
visual smoothness (4 looks janky, 16 is overkill for small markers).

Why Blender for this?  glTF animation evaluation in JS (Three.js)
isn't trivially headless-renderable on a server — Blender has a mature
glTF importer + Cycles/Eevee renderer + Python API in one tool.
"""

import sys
import os
import argparse
import math

import bpy

# ─── argparse — only consume args after "--" ──────────────────────────────
argv = sys.argv
if "--" in argv:
    argv = argv[argv.index("--") + 1:]
else:
    argv = []

parser = argparse.ArgumentParser(description="Render sprite-sheet frames from glTF")
parser.add_argument("--char-id", required=True, help="Output folder name")
parser.add_argument("--character", required=True, help="Path to character glb")
parser.add_argument("--animations", action="append", default=[], help="Animation glb (repeatable)")
parser.add_argument("--actions", required=True, help="Comma-separated CLIP_NAME:tag:framecount entries")
parser.add_argument("--directions", type=int, default=8, help="Number of yaw rotations (default 8)")
parser.add_argument("--size", type=int, default=128, help="Render resolution per frame (square)")
parser.add_argument("--camera-pitch", type=float, default=55.0, help="Camera pitch in degrees (top-down lean)")
parser.add_argument("--out", default="scripts/sprites/_out", help="Output base dir")
args = parser.parse_args(argv)


def parse_actions(spec: str):
    """'Idle_A:idle:1,Walking_A:walk:16' → [('Idle_A','idle',1), ('Walking_A','walk',16)]"""
    out = []
    for entry in spec.split(","):
        parts = entry.strip().split(":")
        if len(parts) != 3:
            print(f"  WARN: bad action entry: {entry}")
            continue
        out.append((parts[0], parts[1], int(parts[2])))
    return out


ACTIONS = parse_actions(args.actions)


# ─── Scene reset ──────────────────────────────────────────────────────────
def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.meshes): bpy.data.meshes.remove(block)
    for block in list(bpy.data.materials): bpy.data.materials.remove(block)
    for block in list(bpy.data.armatures): bpy.data.armatures.remove(block)
    for block in list(bpy.data.actions): bpy.data.actions.remove(block)


clear_scene()


# ─── Import character ─────────────────────────────────────────────────────
print(f"[render] Importing character: {args.character}")
bpy.ops.import_scene.gltf(filepath=os.path.abspath(args.character))

# Find imported armature (rig)
armature = None
for obj in bpy.data.objects:
    if obj.type == "ARMATURE":
        armature = obj
        break
if not armature:
    print("[render] ERROR: No armature found in character glb")
    sys.exit(1)
print(f"[render] Armature: {armature.name}")


# ─── Import animations into the same armature ─────────────────────────────
# Trick: re-import the anim glbs and steal their actions, attach to our rig.
imported_actions = {}  # name → bpy.types.Action
for anim_path in args.animations:
    print(f"[render] Importing animations: {anim_path}")
    pre_actions = set(bpy.data.actions.keys())
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(anim_path))
    new_action_names = set(bpy.data.actions.keys()) - pre_actions
    for n in new_action_names:
        imported_actions[n] = bpy.data.actions[n]
        print(f"  + {n}")
    # Delete the dummy armature/mesh that came in with the anim glb
    for obj in list(bpy.data.objects):
        if obj.type == "ARMATURE" and obj is not armature:
            bpy.data.objects.remove(obj, do_unlink=True)
        elif obj.type == "MESH" and obj.users == 0:
            bpy.data.objects.remove(obj, do_unlink=True)

# Also include actions that came with the character glb itself
for n, a in bpy.data.actions.items():
    imported_actions.setdefault(n, a)


# ─── Camera + lighting setup ──────────────────────────────────────────────
# Position character at origin, point camera from above-front
scene = bpy.context.scene
# Engine: BLENDER_EEVEE (Blender 5.x) / BLENDER_EEVEE_NEXT (Blender 4.x).
# Cycles wäre Film-Quality, aber 100× langsamer.
try:
    scene.render.engine = "BLENDER_EEVEE"
except TypeError:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.render.resolution_x = args.size
scene.render.resolution_y = args.size
scene.render.film_transparent = True  # PNG with alpha
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"

# Camera
cam_data = bpy.data.cameras.new("Cam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = 2.4  # zoom — tweak per character height (Lorekeeper ~1.7m)
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
# Position: above + back, looking down at character
pitch_rad = math.radians(args.camera_pitch)
cam.location = (0, -2.5 * math.cos(pitch_rad), 2.5 * math.sin(pitch_rad))
cam.rotation_euler = (pitch_rad, 0, 0)
scene.camera = cam

# Lighting — 3-point setup
key = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "SUN"))
key.data.energy = 3.5
key.rotation_euler = (math.radians(50), math.radians(30), 0)
scene.collection.objects.link(key)

fill = bpy.data.objects.new("Fill", bpy.data.lights.new("Fill", "SUN"))
fill.data.energy = 1.0
fill.data.color = (0.9, 0.85, 1.0)
fill.rotation_euler = (math.radians(60), math.radians(-50), 0)
scene.collection.objects.link(fill)

rim = bpy.data.objects.new("Rim", bpy.data.lights.new("Rim", "SUN"))
rim.data.energy = 1.5
rim.data.color = (1.0, 0.9, 0.7)
rim.rotation_euler = (math.radians(70), math.radians(180), 0)
scene.collection.objects.link(rim)


# ─── Render loop ──────────────────────────────────────────────────────────
out_base = os.path.abspath(os.path.join(args.out, args.char_id))
os.makedirs(out_base, exist_ok=True)

# Make sure armature has an animation_data block
if armature.animation_data is None:
    armature.animation_data_create()

for clip_name, tag, framecount in ACTIONS:
    if clip_name not in imported_actions:
        print(f"[render] SKIP — action not found: {clip_name}")
        print(f"   available: {list(imported_actions.keys())[:20]}")
        continue
    action = imported_actions[clip_name]
    armature.animation_data.action = action
    print(f"[render] Action: {clip_name} → {tag} ({framecount} frames)")

    # Distribute `framecount` samples across the action duration
    a_start = action.frame_range[0]
    a_end = action.frame_range[1]
    total_clip = a_end - a_start
    out_dir = os.path.join(out_base, tag)
    os.makedirs(out_dir, exist_ok=True)

    for direction in range(args.directions):
        yaw_deg = (360.0 / args.directions) * direction
        armature.rotation_euler = (0, 0, math.radians(yaw_deg))

        for frame_idx in range(framecount):
            # Map our 0..framecount-1 onto the action's frame range
            t = frame_idx / max(1, framecount - 1) if framecount > 1 else 0
            scene.frame_set(int(round(a_start + t * total_clip)))

            scene.render.filepath = os.path.join(
                out_dir, f"dir{direction}_frame{frame_idx:03d}.png"
            )
            bpy.ops.render.render(write_still=True)

print(f"[render] Done — output in {out_base}")
