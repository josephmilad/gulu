"""
Clean up a downloaded car for the game:
  * drop scenery that came with it (ground, trees…)
  * turn it to face +Z (glTF), scale to its real length, put the tyres on y = 0
  * find the four road wheels and parent each to an empty named
    wheel_FL / wheel_FR / wheel_RL / wheel_RR at the hub, so the game can spin and steer them
  * join everything else by material to keep draw calls low

    CAR_IN=in.glb CAR_OUT=out.glb CAR_LEN=4.13 CAR_ROT=180 CAR_DROP="TREES,POST" python prep_car.py
"""
import os, math
import bpy
from mathutils import Vector, Matrix

src, out = os.environ['CAR_IN'], os.environ['CAR_OUT']
length = float(os.environ.get('CAR_LEN', '4.2'))
rot = math.radians(float(os.environ.get('CAR_ROT', '0')))
drop = [d for d in os.environ.get('CAR_DROP', '').split(',') if d]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
for o in list(bpy.data.objects):
    if o.type == 'MESH' and any(d.lower() in o.name.lower() for d in drop):
        bpy.data.objects.remove(o, do_unlink=True)

# Bake every transform into the meshes so we work in plain world space.
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
for o in meshes:
    o.data = o.data.copy()
    o.data.transform(o.matrix_world)
    o.parent = None
    o.matrix_world = Matrix.Identity(4)
for o in list(bpy.data.objects):
    if o.type != 'MESH':
        bpy.data.objects.remove(o, do_unlink=True)

def bbox(objs):
    pts = [v.co for o in objs for v in o.data.vertices]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx

# Blender: z up, the car's length runs along y. Rotate about z, then scale and ground it.
mn, mx = bbox(meshes)
c = (mn + mx) / 2
L = max(mx.x - mn.x, mx.y - mn.y)
s = length / L
xf = Matrix.Rotation(rot, 4, 'Z') @ Matrix.Scale(s, 4) @ Matrix.Translation(Vector((-c.x, -c.y, -mn.z)))
for o in meshes:
    o.data.transform(xf)
    o.data.update()
mn, mx = bbox(meshes)

# Wheels: tyre-shaped parts low down near the four corners.
W, Lh = (mx.x - mn.x) / 2, (mx.y - mn.y) / 2
wheels = {k: [] for k in ('FL', 'FR', 'RL', 'RR')}
for o in meshes:
    a, b = bbox([o])
    size = b - a
    cen = (a + b) / 2
    name = o.name.lower()
    named = 'wheel' in name or 'koles' in name
    tyre_like = 0.35 < size.z < 0.95 and abs(size.y - size.z) < 0.25 and size.x < 0.45 and cen.z < 0.6
    if not (named or tyre_like):
        continue
    if abs(cen.x) < W * 0.45 or abs(cen.y) < Lh * 0.25 or cen.z > 0.7:
        continue  # spare wheel, steering wheel…
    # In Blender coords after rotation, glTF +Z (front) is Blender -Y.
    front = cen.y < 0
    # glTF +X is Blender +X; the car's left (facing +Z glTF) is +X.
    left = cen.x > 0
    wheels[('F' if front else 'R') + ('L' if left else 'R')].append(o)

for k, objs in wheels.items():
    if not objs:
        continue
    a, b = bbox(objs)
    hub = (a + b) / 2
    e = bpy.data.objects.new('wheel_' + k, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = hub
    for o in objs:
        o.data.transform(Matrix.Translation(-hub))
        o.parent = e
        meshes.remove(o)
print('wheels', {k: len(v) for k, v in wheels.items()})

# Optional decimation of the body (CAR_FACES = target face count).
target = int(os.environ.get('CAR_FACES', '0'))
total = sum(len(o.data.polygons) for o in meshes)
if target and total > target:
    for o in meshes:
        bpy.context.view_layer.objects.active = o
        mod = o.modifiers.new('d', 'DECIMATE')
        mod.ratio = target / total
        bpy.ops.object.modifier_apply(modifier='d')
    print('decimated', total, '->', sum(len(o.data.polygons) for o in meshes))

# Join the body by material.
by_mat = {}
for o in meshes:
    m = o.data.materials[0].name if o.data.materials else ''
    by_mat.setdefault(m, []).append(o)
for objs in by_mat.values():
    if len(objs) < 2:
        continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
for img in bpy.data.images:
    if img.size[0] > 2048:
        img.scale(2048, 2048)
mn, mx = bbox([o for o in bpy.data.objects if o.type == 'MESH' and o.parent is None] or meshes)
print('size', [round(v, 2) for v in (mx - mn)], 'objects', len(bpy.data.objects))
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85)
