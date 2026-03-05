"""
render_wireframe.py — Blender Python script (run headless via blender --background)

Opens a .blend file, replaces all materials with a neon-glowing wireframe
(emission shader), ensures the camera is zoomed out to show the full model,
then renders N frames of a 360° rotation with transparent background.

Output: individual RGBA PNGs in <output_dir>/frame_NNNN.png

Compatible with Blender 4.x and 5.x.

Usage (called by render_all_models.py, not typically run directly):
  blender --background --python render_wireframe.py -- \\
      <blend_path> <output_dir> <size> <frames> [neon_hex]

Arguments after '--':
  blend_path  — absolute path to the .blend file
  output_dir  — directory for frame PNGs (created if needed)
  size        — pixel dimension for each square frame (e.g. 256)
  frames      — number of rotation frames (e.g. 36)
  neon_hex    — optional 6-char hex colour (e.g. FF00FF); random if omitted
"""

import bpy
import sys
import os
import math
import random
import mathutils

# ── CLI args (everything after '--') ──────────────────────────────────────────
argv = sys.argv
args = argv[argv.index('--') + 1:] if '--' in argv else []

if len(args) < 4:
    print("Usage: blender --background --python render_wireframe.py -- "
          "<blend_path> <output_dir> <size> <frames> [neon_hex]")
    sys.exit(1)

BLEND_PATH   = args[0]
OUTPUT_DIR   = args[1]
FRAME_SIZE   = int(args[2])
TOTAL_FRAMES = int(args[3])
NEON_HEX     = args[4] if len(args) > 4 else None

# ── Neon colour palette ───────────────────────────────────────────────────────
NEON_COLOURS = [
    (0.0, 1.0, 0.18),   # green   #00FF2F
    (0.0, 0.8, 1.0),    # cyan    #00CCFF
    (1.0, 0.0, 0.5),    # hotpink #FF0080
    (1.0, 0.2, 0.0),    # red-org #FF3300
    (0.5, 0.0, 1.0),    # violet  #8000FF
    (1.0, 1.0, 0.0),    # yellow  #FFFF00
    (0.0, 1.0, 1.0),    # aqua    #00FFFF
    (1.0, 0.0, 1.0),    # magenta #FF00FF
    (0.4, 1.0, 0.0),    # lime    #66FF00
    (1.0, 0.5, 0.0),    # orange  #FF8000
]

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4))

def pick_neon():
    return hex_to_rgb(NEON_HEX) if NEON_HEX else random.choice(NEON_COLOURS)

# ── Open blend ────────────────────────────────────────────────────────────────
bpy.ops.wm.open_mainfile(filepath=BLEND_PATH)

# Remove existing lights & cameras — we set up our own
for obj in list(bpy.data.objects):
    if obj.type in {'LIGHT', 'CAMERA'}:
        bpy.data.objects.remove(obj, do_unlink=True)

# ── Mesh objects ──────────────────────────────────────────────────────────────
mesh_objects = [o for o in bpy.data.objects if o.type == 'MESH']
if not mesh_objects:
    print(f"WARNING: no mesh objects in {BLEND_PATH}")
    sys.exit(0)

for obj in mesh_objects:
    obj.hide_render = False
    obj.hide_viewport = False

# ── Shader-based wireframe material (reliable across Blender 4.x/5.x) ───────
# Uses ShaderNodeWireframe to mask: edges get neon emission, faces are transparent.
neon = pick_neon()
mat = bpy.data.materials.new(name="NeonWireframe")
mat.use_backface_culling = False
if hasattr(mat, 'blend_method'):            # EEVEE transparency
    mat.blend_method = 'BLEND'
nodes = mat.node_tree.nodes
links = mat.node_tree.links
nodes.clear()

# Wireframe mask — outputs 1.0 on edges, 0.0 on faces
wire_node = nodes.new('ShaderNodeWireframe')
wire_node.use_pixel_size = True
wire_node.inputs['Size'].default_value = 1.2       # 1.2 px edge width

# Emission for the bright neon wire edges
emission = nodes.new('ShaderNodeEmission')
emission.inputs['Color'].default_value = (*neon, 1.0)
emission.inputs['Strength'].default_value = 12.0    # strong glow

# Transparent BSDF for the faces between edges
transparent = nodes.new('ShaderNodeBsdfTransparent')

# Mix: wireframe mask selects emission (edge) vs transparent (face)
mix = nodes.new('ShaderNodeMixShader')
links.new(wire_node.outputs['Fac'], mix.inputs['Fac'])
links.new(transparent.outputs['BSDF'], mix.inputs[1])  # face -> transparent
links.new(emission.outputs['Emission'], mix.inputs[2])  # edge -> neon

output = nodes.new('ShaderNodeOutputMaterial')
links.new(mix.outputs['Shader'], output.inputs['Surface'])

# ── Apply (bake) geometry modifiers then assign wireframe material ────────────
# Mirror, Array, Subdivision, Solidify etc. must be applied so the full mesh
# is realised before we swap to the wireframe shader.
ctx_override = bpy.context.copy()
for obj in mesh_objects:
    ctx_override['object'] = obj
    bpy.context.view_layer.objects.active = obj
    # Apply all modifiers in stack order so mirrors/arrays are baked
    for mod in list(obj.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception:
            # If apply fails (e.g. disabled modifier), just remove it
            try:
                obj.modifiers.remove(mod)
            except Exception:
                pass
    obj.data.materials.clear()
    obj.data.materials.append(mat)

# ── Bounding sphere (worst-case for any rotation angle) ──────────────────────
# Use all bounding-box corners in world space for every mesh.
all_coords = []
for obj in mesh_objects:
    for corner in obj.bound_box:
        all_coords.append(obj.matrix_world @ mathutils.Vector(corner))

if not all_coords:
    print("WARNING: empty bounding box")
    sys.exit(0)

xs = [c.x for c in all_coords]
ys = [c.y for c in all_coords]
zs = [c.z for c in all_coords]
centre = mathutils.Vector(((min(xs)+max(xs))/2, (min(ys)+max(ys))/2, (min(zs)+max(zs))/2))
# Radius = farthest point from centre (the model rotates, so every corner can
# end up at any edge of the frame).
radius = max((c - centre).length for c in all_coords) or 1.0

# ── Pivot empty ───────────────────────────────────────────────────────────────
pivot = bpy.data.objects.new("Pivot", None)
bpy.context.scene.collection.objects.link(pivot)
pivot.location = centre
for obj in mesh_objects:
    obj.parent = pivot
    obj.matrix_parent_inverse = pivot.matrix_world.inverted()

# ── Camera (orthographic — guarantees model always fits) ──────────────────────
cam_data = bpy.data.cameras.new("RenderCam")
cam_data.type = 'ORTHO'
cam_data.ortho_scale = radius * 4.5        # generous padding for glow + rotation
cam_data.shift_x = 0.0
cam_data.shift_y = 0.0

cam_obj = bpy.data.objects.new("RenderCam", cam_data)
bpy.context.scene.collection.objects.link(cam_obj)

dist = radius * 5
elev = math.radians(25)
# Place camera on a sphere around the centre, looking inward
cam_x = centre.x + dist * math.cos(elev)
cam_y = centre.y
cam_z = centre.z + dist * math.sin(elev)
cam_obj.location = (cam_x, cam_y, cam_z)

# Point camera exactly at the bounding-box centre using track_to constraint
# (more reliable than manual quaternion math for centering)
track = cam_obj.constraints.new(type='TRACK_TO')
track.target = pivot                       # pivot sits at 'centre'
track.track_axis = 'TRACK_NEGATIVE_Z'
track.up_axis = 'UP_Y'
bpy.context.view_layer.update()            # bake the constraint

bpy.context.scene.camera = cam_obj

# ── Render settings ──────────────────────────────────────────────────────────
scene = bpy.context.scene
# Blender 4.2+ renamed EEVEE to EEVEE_NEXT, 5.x may use either name
for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
    try:
        scene.render.engine = eng
        break
    except TypeError:
        continue
scene.render.resolution_x = FRAME_SIZE
scene.render.resolution_y = FRAME_SIZE
scene.render.resolution_percentage = 100
scene.render.film_transparent = True       # alpha background
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.compression = 9
scene.render.use_compositing = False
scene.render.use_sequencer = False

# Minimal samples for speed — wireframes don't need AA refinement
try:
    scene.eevee.taa_render_samples = 16
except AttributeError:
    pass

# Black transparent world
world = bpy.data.worlds.new("DarkVoid")
world.use_nodes = True
wn = world.node_tree.nodes; wl = world.node_tree.links
wn.clear()
bg = wn.new('ShaderNodeBackground')
bg.inputs['Color'].default_value = (0, 0, 0, 1)
bg.inputs['Strength'].default_value = 0.0
wo = wn.new('ShaderNodeOutputWorld')
wl.new(bg.outputs['Background'], wo.inputs['Surface'])
scene.world = world

# ── Render loop ───────────────────────────────────────────────────────────────
os.makedirs(OUTPUT_DIR, exist_ok=True)
step = (2 * math.pi) / TOTAL_FRAMES

# Rotate on all three axes at different rates for a tumbling look.
# Z = full 360°, X = half turn, Y = third turn — creates an interesting
# non-repeating-looking tumble that still loops seamlessly.
for i in range(TOTAL_FRAMES):
    t = i * step
    pivot.rotation_euler = (t * 0.5, t * 0.33, t)
    bpy.context.view_layer.update()
    scene.render.filepath = os.path.join(OUTPUT_DIR, f"frame_{i:04d}.png")
    bpy.ops.render.render(write_still=True)
    print(f"  [{i+1}/{TOTAL_FRAMES}] {scene.render.filepath}")

print(f"DONE  {TOTAL_FRAMES} frames → {OUTPUT_DIR}")
