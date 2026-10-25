"""
Download CC-BY models from Sketchfab and turn them into game-ready GLBs.

    python sketchfab_fetch.py <uid> <out.glb> [target_faces] [length_m]

Needs a (free) Sketchfab account's API token: either in SKETCHFAB_TOKEN, or
configured as a network secret that adds "Authorization: Token …" to
requests to api.sketchfab.com (then the script sends no header itself). The GLB is
decimated to target_faces, scaled so its longest side is length_m metres,
rested on y = 0 and centred. Run it with Blender's Python (bpy) for the
optimisation step; plain Python just downloads the original archive.
"""
import json, os, sys, urllib.request, zipfile, tempfile, glob

uid, out = sys.argv[1], sys.argv[2]
faces = int(sys.argv[3]) if len(sys.argv) > 3 else 40000
length = float(sys.argv[4]) if len(sys.argv) > 4 else 0
token = os.environ.get('SKETCHFAB_TOKEN')
headers = {'Authorization': f'Token {token}'} if token else {}
req = urllib.request.Request(f'https://api.sketchfab.com/v3/models/{uid}/download', headers=headers)
info = json.load(urllib.request.urlopen(req))
url = (info.get('glb') or info['gltf'])['url']
tmp = tempfile.mkdtemp()
path = os.path.join(tmp, 'model.glb' if 'glb' in info else 'model.zip')
urllib.request.urlretrieve(url, path)
if path.endswith('.zip'):
    with zipfile.ZipFile(path) as z:
        z.extractall(tmp)
    path = (glob.glob(os.path.join(tmp, '**', '*.gltf'), recursive=True) + glob.glob(os.path.join(tmp, '**', '*.glb'), recursive=True))[0]
meta = json.load(urllib.request.urlopen(urllib.request.Request(f'https://api.sketchfab.com/v3/models/{uid}')))
credit = f"{meta['name']} by {meta['user']['displayName']} ({meta['viewerUrl']}), {meta['license']['label']}"
print('credit:', credit)

import bpy
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
total = sum(len(o.data.polygons) for o in meshes)
if total > faces:
    for o in meshes:
        bpy.context.view_layer.objects.active = o
        m = o.modifiers.new('d', 'DECIMATE')
        m.ratio = faces / total
        bpy.ops.object.modifier_apply(modifier='d')
for img in bpy.data.images:
    if img.size[0] > 2048:
        img.scale(2048, 2048)
# Normalise: one root, centred, on the ground, scaled to real length.
bpy.context.view_layer.update()
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
root = bpy.data.objects.new('root', None)
bpy.context.scene.collection.objects.link(root)
for o in bpy.data.objects:
    if o.parent is None and o is not root:
        o.parent = root
size = mx - mn
s = length / max(size.x, size.y) if length else 1
root.scale = (s, s, s)
root.location = (-(mn.x + mx.x) / 2 * s, -(mn.y + mx.y) / 2 * s, -mn.z * s)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85)
with open(out + '.credit.txt', 'w') as f:
    f.write(credit + '\n')
print('done', out, total, '->', sum(len(o.data.polygons) for o in meshes))
