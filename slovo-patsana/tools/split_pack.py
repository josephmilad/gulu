"""Split a Sketchfab 'pack' GLB into separate props along X.

    PACK_IN=pack.glb PACK_OUT=out_prefix PACK_SCALE=1 python split_pack.py
Writes out_prefix_a.glb, _b.glb… (each centred on x/z, standing on y = 0) and
prints each part's size and the position of its highest point (lamp heads).
"""
import os
import bpy
from mathutils import Vector

src, prefix = os.environ['PACK_IN'], os.environ['PACK_OUT']
scale = float(os.environ.get('PACK_SCALE', '1'))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
for o in meshes:
    o.data = o.data.copy()
    o.data.transform(o.matrix_world)
    o.parent = None
    o.matrix_world.identity()
for o in list(bpy.data.objects):
    if o.type != 'MESH':
        bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='LOOSE')
bpy.ops.object.mode_set(mode='OBJECT')
parts = [o for o in bpy.data.objects if o.type == 'MESH']
def bb(o):
    pts = [v.co for v in o.data.vertices]
    return Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))), Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
spans = sorted([(bb(o)[0].x, bb(o)[1].x, o) for o in parts], key=lambda t: t[0])
groups, cur, right = [], [], None
for a, b, o in spans:
    if right is not None and a > right + 0.3:
        groups.append(cur)
        cur = []
    cur.append(o)
    right = b if right is None else max(right, b)
groups.append(cur)
for i, g in enumerate(groups):
    for o in bpy.data.objects:
        o.select_set(o in g)
    pts = [v.co for o in g for v in o.data.vertices]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    # Centre on the footprint at ground level (a lamp's pole base), not the bounding box.
    low = [p for p in pts if p.z < mn.z + 0.3] or pts
    c = sum(low, Vector()) / len(low)
    top = max(pts, key=lambda p: p.z)
    for o in g:
        o.location = (-c.x * scale, -c.y * scale, -mn.z * scale)
        o.scale = (scale, scale, scale)
    out = f'{prefix}_{chr(97 + i)}.glb'
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_image_format='JPEG')
    # glTF axes: x = x, y = z (up), z = -y
    print('part', out, 'size', [round(v * scale, 2) for v in (mx - mn)], 'top(gltf)', [round((top.x - c.x) * scale, 2), round((top.z - mn.z) * scale, 2), round(-(top.y - c.y) * scale, 2)])
    for o in g:
        o.location = (0, 0, 0)
        o.scale = (1, 1, 1)
