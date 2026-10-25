"""
Bake Quaternius Universal Animation Library clips onto a Meshy-rigged character
and export a game-ready GLB (JPEG textures, no emissive, one glTF animation per clip).

    python retarget.py <hero.glb> <out.glb> <UAL1.glb> <UAL2.glb> [extra_src.glb ...]

Retargeting matches each target bone's world direction to the source bone's
world direction, so it works across different rest poses (T-pose vs A-pose).
"""
import os, sys
import bpy
from mathutils import Matrix, Quaternion, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
HERO, OUT, *SRCS = argv

# Source clip -> name in the game.
CLIPS = {
    'Idle_Loop': 'idle', 'Walk_Loop': 'walk', 'Jog_Fwd_Loop': 'jog', 'Sprint_Loop': 'sprint',
    'Punch_Jab': 'jab', 'Punch_Cross': 'cross', 'Melee_Hook': 'hook', 'OverhandThrow': 'haymaker',
    'Shield_Dash': 'lunge', 'Hit_Chest': 'hit_chest', 'Hit_Head': 'hit_head', 'Hit_Knockback': 'knockback',
    'Death01': 'death', 'LayToIdle': 'getup', 'Roll': 'roll', 'Idle_FoldArms_Loop': 'folded',
    'Idle_Talking_Loop': 'talk', 'Dance_Loop': 'dance', 'Sword_Block': 'block', 'Yes': 'yes',
    'Sitting_Idle_Loop': 'sit', 'Crouch_Idle_Loop': 'crouch',
    'Kick': 'kick',
}


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30


def import_glb(path):
    before = set(bpy.data.objects)
    acts_before = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == 'ARMATURE')
    acts = [a for a in bpy.data.actions if a not in acts_before]
    return arm, new, acts


tgt, tgt_objs, tgt_acts = import_glb(HERO)
for a in tgt_acts:
    bpy.data.actions.remove(a)
if tgt.animation_data:
    tgt.animation_data.action = None

import re


def norm(n):
    """'mixamorig:LeftUpLeg_09' / 'rp_x_upperarm_l_024' / 'CC_Base_L_Thigh_04' -> comparable tokens."""
    n = n.split(':')[-1]
    n = re.sub(r'^rp_.*?_(?=(root|hip|spine|neck|head|jaw|eye|mouth|shoulder|upperarm|lowerarm|hand|thumb|index|middle|ring|pinky|thigh|calf|foot|ball|toe))', '', n.lower())
    n = re.sub(r'_\d+$', '', n)
    n = n.replace('cc_base_', '')
    return n


def side_of(n):
    if re.search(r'(^|[_.])l([_.]|$)|left', n):
        return 'L'
    if re.search(r'(^|[_.])r([_.]|$)|right', n):
        return 'R'
    return ''


def find_slots(arm):
    """Map canonical slots (hips, spine0..2, neck, head, shL, armL, foreL, handL, thighL, calfL, footL, toeL, …)
    to bone names, for Meshy, UE/Quaternius, Mixamo, RenderPeople and Reallusion CC rigs."""
    bones = arm.data.bones
    depth = {b.name: len(b.parent_recursive) for b in bones}
    info = [(b.name, norm(b.name), side_of(norm(b.name))) for b in bones]
    bad = ('twist', 'end', 'share', 'top', 'index', 'middle', 'ring', 'pinky', 'thumb', 'finger', 'toe1', 'roll')
    def pick(pred, side=''):
        c = [n for n, k, s in info if pred(k) and s == side and not any(x in k for x in bad)]
        return min(c, key=lambda n: depth[n]) if c else None
    slots = {}
    slots['hips'] = pick(lambda k: k in ('hips', 'hip')) or pick(lambda k: k == 'pelvis')
    spine = sorted([n for n, k, s in info if ('spine' in k or k == 'waist') and not any(x in k for x in bad)], key=lambda n: depth[n])
    for i, n in enumerate(spine[:3]):
        slots[f'spine{i}'] = n
    slots['neck'] = pick(lambda k: 'neck' in k)
    slots['head'] = pick(lambda k: k == 'head' or k.endswith('_head') or k == 'head')
    for S in ('L', 'R'):
        slots['sh' + S] = pick(lambda k: 'clavicle' in k or 'shoulder' in k, S)
        slots['arm' + S] = pick(lambda k: ('upperarm' in k) or (re.sub(r'left|right|_|l$|r$|^l|^r', '', k) == 'arm'), S)
        slots['fore' + S] = pick(lambda k: 'forearm' in k or 'lowerarm' in k, S)
        slots['hand' + S] = pick(lambda k: re.sub(r'left|right|_|\.|^l|^r|l$|r$', '', k) == 'hand', S)
        slots['thigh' + S] = pick(lambda k: 'thigh' in k or 'upleg' in k or 'upperleg' in k, S)
        slots['calf' + S] = pick(lambda k: 'calf' in k or 'shin' in k or 'lowerleg' in k or (re.sub(r'left|right|_|^l|^r|l$|r$', '', k) == 'leg'), S)
        slots['foot' + S] = pick(lambda k: 'foot' in k, S)
        slots['toe' + S] = pick(lambda k: 'toebase' in k or k.startswith('ball') or re.sub(r'left|right|_|^l|^r|l$|r$', '', k) == 'toe', S)
    return {k: v for k, v in slots.items() if v}


# Some rigs (RenderPeople) come in centimetres: scale the whole import to metres.
_root = tgt
while _root.parent:
    _root = _root.parent
_hip_bone = next((b for b in tgt.data.bones if 'hip' in b.name.lower() or 'pelvis' in b.name.lower()), tgt.data.bones[0])
if (tgt.matrix_world @ _hip_bone.head_local).z > 10:
    _root.scale = _root.scale * 0.01
    bpy.context.view_layer.update()
    print('scaled centimetre rig to metres')

TGT_SLOTS = find_slots(tgt)
# Normalise height: the head joint of a ~1.75 m adult sits around 1.6 m.
_head_z = (tgt.matrix_world @ tgt.data.bones[TGT_SLOTS['head']].head_local).z if 'head' in TGT_SLOTS else 1.6
if not 1.4 < _head_z < 1.85:
    _root.scale = _root.scale * (1.6 / _head_z)
    bpy.context.view_layer.update()
    print('normalised height, head was at', round(_head_z, 2))
# Next joint along each limb (slot prefix without the L/R side).
CHILD_SLOT = {'sh': 'arm', 'arm': 'fore', 'fore': 'hand', 'thigh': 'calf', 'calf': 'foot', 'foot': 'toe'}
print('target slots', len(TGT_SLOTS), {k: v for k, v in TGT_SLOTS.items() if k in ('hips', 'spine0', 'armL', 'calfR', 'toeL')})
HIPS = TGT_SLOTS['hips']

# Strip emissive (it would make clothes glow at night) and keep textures modest.
for o in tgt_objs:
    if o.type != 'MESH':
        continue
    for slot in o.material_slots:
        m = slot.material
        if not m or not m.use_nodes:
            continue
        bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf:
            for inp in ('Emission Color', 'Emission'):
                if inp in bsdf.inputs:
                    for l in list(bsdf.inputs[inp].links):
                        m.node_tree.links.remove(l)
                    bsdf.inputs[inp].default_value = (0, 0, 0, 1)
            if 'Emission Strength' in bsdf.inputs:
                bsdf.inputs['Emission Strength'].default_value = 0.0
# TEXSIZE / DECIMATE env vars produce the lighter NPC version of a model.
TEX = int(os.environ.get('TEXSIZE', '2048'))
for img in bpy.data.images:
    if img.size[0] > TEX:
        img.scale(TEX, TEX)
DEC = float(os.environ.get('DECIMATE', '1'))
if DEC < 1:
    for o in tgt_objs:
        if o.type != 'MESH':
            continue
        bpy.context.view_layer.objects.active = o
        if o.data.shape_keys:
            o.shape_key_clear()
        mod = o.modifiers.new('dec', 'DECIMATE')
        mod.ratio = DEC
        bpy.ops.object.modifier_move_to_index(modifier='dec', index=0)
        bpy.ops.object.modifier_apply(modifier='dec')
        print('decimated', o.name, len(o.data.vertices))


def world_rot(arm, bone_mat):
    return (arm.matrix_world @ bone_mat).to_quaternion()


def bone_dir(arm, bone):
    return ((arm.matrix_world @ bone.matrix_local).to_3x3() @ Vector((0, 1, 0))).normalized()


def order(arm, names_):
    out = []
    def walk(b):
        if b.name in names_:
            out.append(b.name)
        for c in b.children:
            walk(c)
    for b in arm.data.bones:
        if b.parent is None:
            walk(b)
    return out


tgt_order = order(tgt, set(TGT_SLOTS.values()))
tgt_rest_world = {t: world_rot(tgt, tgt.data.bones[t].matrix_local) for t in tgt_order}

made = []
for path in SRCS:
    src, src_objs, src_acts = import_glb(path)
    src_is_ue = 'pelvis' in src.data.bones
    src_slots = find_slots(src)
    # target bone -> source bone, through the shared slot names
    sinv = {TGT_SLOTS[k]: v for k, v in src_slots.items() if k in TGT_SLOTS}
    # Rest alignment: rotate each target rest bone so it points like the source rest bone.
    align = {}
    slot_of = {v: k for k, v in TGT_SLOTS.items()}
    for t in tgt_order:
        s = sinv.get(t)
        if not s:
            continue
        # Torso bones point different ways in different rigs (RenderPeople's hip points
        # forward); both characters stand upright facing +Z, so keep those as-is and
        # only line up the limbs, whose rest poses differ (A-pose vs T-pose).
        if slot_of.get(t, '') in ('hips', 'spine0', 'spine1', 'spine2', 'neck', 'head'):
            align[t] = Quaternion()
            continue
        # Direction along the limb = this joint to the next joint (bone tails from
        # imported FBX/glTF rigs often point somewhere arbitrary).
        slot = slot_of.get(t, '')
        nxt = CHILD_SLOT.get(slot[:-1], None) if slot else None
        child_slot = nxt + slot[-1] if nxt else None
        if child_slot and child_slot in TGT_SLOTS and child_slot in src_slots:
            d_s = ((src.matrix_world @ src.data.bones[src_slots[child_slot]].head_local) - (src.matrix_world @ src.data.bones[s].head_local)).normalized()
            d_t = ((tgt.matrix_world @ tgt.data.bones[TGT_SLOTS[child_slot]].head_local) - (tgt.matrix_world @ tgt.data.bones[t].head_local)).normalized()
        else:
            d_s = bone_dir(src, src.data.bones[s])
            d_t = bone_dir(tgt, tgt.data.bones[t])
        align[t] = d_t.rotation_difference(d_s)
    s_hips = sinv.get(HIPS)
    src_hip_h = (src.matrix_world @ src.data.bones[s_hips].head_local).z
    tgt_hip_h = (tgt.matrix_world @ tgt.data.bones[HIPS].head_local).z
    hscale = tgt_hip_h / max(src_hip_h, 1e-4)
    src_hip_rest = src.matrix_world @ src.data.bones[s_hips].head_local

    for act in src_acts:
        base = act.name.split('|')[-1]
        key = next((k for k in CLIPS if base == k or base.startswith(k)), None)
        if not src_is_ue and key is None:
            key = 'Kick'
        if key is None or CLIPS[key] in made:
            continue
        game_name = CLIPS[key]
        src.animation_data_create()
        src.animation_data.action = act
        if hasattr(src.animation_data, 'action_slot') and len(act.slots):
            src.animation_data.action_slot = act.slots[0]
        f0, f1 = map(int, act.frame_range)
        new = bpy.data.actions.new(game_name)
        new.use_fake_user = True
        tgt.animation_data_create()
        tgt.animation_data.action = new
        for f in range(f0, f1 + 1):
            scene.frame_set(f)
            desired = {}
            for t in tgt_order:
                pb = tgt.pose.bones[t]
                bone = pb.bone
                s = sinv.get(t)
                rest_rel = (bone.parent.matrix_local.inverted() @ bone.matrix_local) if bone.parent else bone.matrix_local
                parent_des = desired.get(bone.parent.name) if bone.parent else None
                if parent_des is None and bone.parent:
                    parent_des = tgt.pose.bones[bone.parent.name].matrix
                head_arm = (parent_des @ rest_rel).to_translation() if bone.parent else bone.matrix_local.to_translation()
                if s:
                    sp = src.pose.bones[s]
                    s_rest_w = world_rot(src, src.data.bones[s].matrix_local)
                    s_pose_w = world_rot(src, sp.matrix)
                    delta = s_pose_w @ s_rest_w.inverted()
                    t_w = delta @ align[t] @ tgt_rest_world[t]
                    rot_arm = tgt.matrix_world.to_quaternion().inverted() @ t_w
                else:
                    rot_arm = ((parent_des @ rest_rel) if bone.parent else bone.matrix_local).to_quaternion()
                if t == HIPS:
                    s_head_w = src.matrix_world @ sp.head
                    off_w = (s_head_w - src_hip_rest) * hscale
                    t_head_w = tgt.matrix_world @ bone.head_local + off_w
                    head_arm = tgt.matrix_world.inverted() @ t_head_w
                M = Matrix.LocRotScale(head_arm, rot_arm, Vector((1, 1, 1)))
                desired[t] = M
                parent_m = desired.get(bone.parent.name) if bone.parent else None
                if bone.parent and parent_m is None:
                    parent_m = tgt.pose.bones[bone.parent.name].matrix
                basis = ((parent_m @ rest_rel) if bone.parent else bone.matrix_local).inverted() @ M
                loc, rot, _ = basis.decompose()
                pb.rotation_mode = 'QUATERNION'
                pb.rotation_quaternion = rot
                pb.keyframe_insert('rotation_quaternion', frame=f - f0)
                if t == HIPS:
                    pb.location = loc
                    pb.keyframe_insert('location', frame=f - f0)
        made.append(game_name)
        print('baked', game_name, f1 - f0, 'frames')
    # Drop the source rig and its meshes.
    for o in src_objs:
        bpy.data.objects.remove(o, do_unlink=True)
    for a in src_acts:
        bpy.data.actions.remove(a)

# Reset to rest so the exported bind pose is clean.
tgt.animation_data.action = None
for pb in tgt.pose.bones:
    pb.matrix_basis = Matrix.Identity(4)

bpy.ops.object.select_all(action='DESELECT')
for o in tgt_objs:
    if o.name in bpy.data.objects:
        o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
    export_image_format='JPEG', export_jpeg_quality=85, export_apply=False,
    export_anim_slide_to_zero=True,
)
print('exported', OUT, made)
