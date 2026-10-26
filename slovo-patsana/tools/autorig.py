"""
Auto-rig an unrigged A-pose character mesh (image-to-3D output) with a Mixamo-named skeleton,
so tools/retarget.py can bake the animation library onto it.

    python autorig.py <mesh.glb> <out.glb> [height_m=1.78]

Joints are found from the mesh itself (arm lines through the extreme hand points, leg and
torso slice centroids); skin weights are inverse-distance to the bone segments, smoothed
over the mesh so joints bend softly.
"""
import sys
import bpy
import bmesh
import numpy as np
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
SRC, OUT = argv[0], argv[1]
H = float(argv[2]) if len(argv) > 2 else 1.78

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
# Bake transforms, unparent from any import empties.
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(bpy.context.scene.objects):
    if o.type == 'EMPTY':
        bpy.data.objects.remove(o)

# Merge split vertices so smoothing can cross UV seams.
bm = bmesh.new()
bm.from_mesh(body.data)
V = np.array([v.co[:] for v in bm.verts])
# Normalise: feet on the ground, centred, height H.
mn, mx = V.min(0), V.max(0)
s = H / (mx[2] - mn[2])
off = np.array([-(mn[0] + mx[0]) / 2, -(mn[1] + mx[1]) / 2, -mn[2]])
for v in bm.verts:
    v.co = Vector(((v.co[0] + off[0]) * s, (v.co[1] + off[1]) * s, (v.co[2] + off[2]) * s))
bm.to_mesh(body.data)
V = np.array([v.co[:] for v in bm.verts])
# Neighbour lists for weight smoothing (positionally merged, so seams connect).
key = np.round(V / 0.004).astype(np.int64)
_, weld = np.unique(key, axis=0, return_inverse=True)
weld = weld.reshape(-1)
edges = np.array([[e.verts[0].index, e.verts[1].index] for e in bm.edges])
bm.free()
X, Y, Z = V[:, 0], V[:, 1], V[:, 2]


def slab(z0, dz=0.02 * H, mask=None):
    m = np.abs(Z - z0) < dz
    return m if mask is None else (m & mask)


def centroid(m, fallback):
    return V[m].mean(0) if m.sum() > 8 else np.array(fallback, dtype=float)


# --- torso / head ---
torso = np.abs(X) < 0.11 * H
hips = centroid(slab(0.53 * H, mask=torso), (0, 0, 0.53 * H)); hips[0] = 0
spine = [centroid(slab(f * H, mask=torso), (0, 0, f * H)) for f in (0.60, 0.68, 0.76)]
for p in spine:
    p[0] = 0
neck = centroid(slab(0.85 * H, mask=np.abs(X) < 0.06 * H), (0, 0, 0.85 * H)); neck[0] = 0
head = centroid(slab(0.895 * H, mask=np.abs(X) < 0.07 * H), (0, 0, 0.895 * H)); head[0] = 0
head_top = np.array([0, head[1], H])
chest_y = spine[2][1]

joints = {}
joints['Hips'] = hips
joints['Spine'], joints['Spine1'], joints['Spine2'] = spine
joints['Neck'] = neck
joints['Head'] = head

for side, sg in (('Left', 1), ('Right', -1)):
    # Character faces -Y in Blender, so its left hand is at +X.
    sidem = (X * sg) > 0
    i_tip = np.argmax(X * sg)
    tip = V[i_tip]
    sh = np.array([sg * 0.105 * H, chest_y, 0.815 * H])
    clav = np.array([sg * 0.03 * H, chest_y, 0.80 * H])
    d = tip - sh
    L = np.linalg.norm(d)
    u = d / L

    def along(t):
        c = sh + d * t
        rel = V - c
        par = rel @ u
        perp = np.linalg.norm(rel - np.outer(par, u), axis=1)
        m = (np.abs(par) < 0.025 * H) & (perp < 0.07 * H) & sidem
        return V[m].mean(0) if m.sum() > 8 else c

    joints[side + 'Shoulder'] = clav
    joints[side + 'Arm'] = sh
    joints[side + 'ForeArm'] = along(0.43)
    joints[side + 'Hand'] = along(0.77)
    joints[side + 'HandEnd'] = tip
    legm = sidem & (np.abs(X) < 0.16 * H)
    thigh = centroid(slab(0.44 * H, mask=legm), (sg * 0.05 * H, 0, 0.44 * H))
    knee = centroid(slab(0.28 * H, mask=legm), (sg * 0.05 * H, 0, 0.28 * H))
    ankle = centroid(slab(0.05 * H, dz=0.015 * H, mask=legm), (sg * 0.05 * H, 0, 0.05 * H))
    joints[side + 'UpLeg'] = np.array([thigh[0] * 0.8, hips[1], 0.505 * H])
    joints[side + 'Leg'] = knee
    joints[side + 'Foot'] = ankle
    foot = legm & (Z < 0.05 * H)
    toe_y = V[foot][:, 1].min() if foot.sum() > 4 else ankle[1] - 0.12 * H
    joints[side + 'ToeBase'] = np.array([ankle[0], ankle[1] + (toe_y - ankle[1]) * 0.65, 0.015 * H])
    joints[side + 'ToeEnd'] = np.array([ankle[0], toe_y, 0.01 * H])

PARENT = {
    'Hips': None, 'Spine': 'Hips', 'Spine1': 'Spine', 'Spine2': 'Spine1', 'Neck': 'Spine2', 'Head': 'Neck',
}
TAIL = {'Hips': 'Spine', 'Spine': 'Spine1', 'Spine1': 'Spine2', 'Spine2': 'Neck', 'Neck': 'Head'}
for side in ('Left', 'Right'):
    PARENT.update({side + 'Shoulder': 'Spine2', side + 'Arm': side + 'Shoulder', side + 'ForeArm': side + 'Arm',
                   side + 'Hand': side + 'ForeArm', side + 'UpLeg': 'Hips', side + 'Leg': side + 'UpLeg',
                   side + 'Foot': side + 'Leg', side + 'ToeBase': side + 'Foot'})
    TAIL.update({side + 'Shoulder': side + 'Arm', side + 'Arm': side + 'ForeArm', side + 'ForeArm': side + 'Hand',
                 side + 'Hand': side + 'HandEnd', side + 'UpLeg': side + 'Leg', side + 'Leg': side + 'Foot',
                 side + 'Foot': side + 'ToeBase', side + 'ToeBase': side + 'ToeEnd'})

arm_data = bpy.data.armatures.new('Armature')
rig = bpy.data.objects.new('Armature', arm_data)
bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
eb = {}
for name in PARENT:
    b = arm_data.edit_bones.new(name)
    b.head = Vector(joints[name])
    b.tail = Vector(head_top) if name == 'Head' else Vector(joints[TAIL[name]])
    if (b.tail - b.head).length < 0.01:
        b.tail = b.head + Vector((0, 0, 0.05))
    eb[name] = b
for name, p in PARENT.items():
    if p:
        eb[name].parent = eb[p]
        eb[name].use_connect = False
bpy.ops.object.mode_set(mode='OBJECT')

# --- skin weights ---
names = list(PARENT)
segs = [(np.array(eb_h), np.array(eb_t)) for eb_h, eb_t in
        [(joints[n], head_top if n == 'Head' else joints[TAIL[n]]) for n in names]]


def seg_dist(P, a, b):
    ab = b - a
    t = np.clip(((P - a) @ ab) / max(ab @ ab, 1e-9), 0, 1)
    return np.linalg.norm(P - (a + np.outer(t, ab)), axis=1)


D = np.stack([seg_dist(V, a, b) for a, b in segs], 1)
# Keep limbs from grabbing the torso and vice versa: penalise bones on the wrong side.
for j, n in enumerate(names):
    if n.startswith('Left'):
        D[X < -0.02 * H, j] += 1
    if n.startswith('Right'):
        D[X > 0.02 * H, j] += 1
    if 'Leg' in n or 'Foot' in n or 'Toe' in n:
        D[Z > 0.56 * H, j] += 1
    if n in ('LeftShoulder', 'RightShoulder'):
        D[:, j] += 0.03 * H  # clavicles only take a little
W = 1.0 / (D + 0.01 * H) ** 4
W /= W.sum(1, keepdims=True)
# Smooth over the welded neighbourhood graph.
nv = len(V)
for _ in range(6):
    acc = np.zeros_like(W)
    cnt = np.zeros(nv)
    np.add.at(acc, edges[:, 0], W[edges[:, 1]])
    np.add.at(acc, edges[:, 1], W[edges[:, 0]])
    np.add.at(cnt, edges[:, 0], 1)
    np.add.at(cnt, edges[:, 1], 1)
    # Share weights across welded seam duplicates too.
    wsum = np.zeros((weld.max() + 1, W.shape[1]))
    np.add.at(wsum, weld, W)
    wc = np.bincount(weld)
    seam = wsum[weld] / wc[weld, None]
    W = 0.5 * W + 0.3 * acc / np.maximum(cnt, 1)[:, None] + 0.2 * seam
    W /= W.sum(1, keepdims=True)
# Top-4 influences.
idx = np.argsort(-W, 1)[:, :4]
for j, n in enumerate(names):
    body.vertex_groups.new(name=n)
for i in range(nv):
    ws = W[i, idx[i]]
    ws = ws / ws.sum()
    for k in range(4):
        if ws[k] > 0.01:
            body.vertex_groups[names[idx[i, k]]].add([i], float(ws[k]), 'REPLACE')

body.parent = rig
mod = body.modifiers.new('Armature', 'ARMATURE')
mod.object = rig
body.name = 'Body'

bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
rig.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_animations=False,
                          export_image_format='JPEG', export_jpeg_quality=90)
print('rigged', OUT, {k: [round(float(x), 3) for x in v] for k, v in joints.items() if k in ('Hips', 'LeftArm', 'LeftHand', 'LeftFoot', 'Head')})
