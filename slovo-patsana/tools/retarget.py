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

UE_TO_TGT = {
    'pelvis': 'Hips', 'spine_01': 'SPINE0', 'spine_02': 'SPINE1', 'spine_03': 'SPINE2', 'neck_01': 'neck', 'Head': 'Head',
    'clavicle_l': 'LeftShoulder', 'upperarm_l': 'LeftArm', 'lowerarm_l': 'LeftForeArm', 'hand_l': 'LeftHand',
    'clavicle_r': 'RightShoulder', 'upperarm_r': 'RightArm', 'lowerarm_r': 'RightForeArm', 'hand_r': 'RightHand',
    'thigh_l': 'LeftUpLeg', 'calf_l': 'LeftLeg', 'foot_l': 'LeftFoot', 'ball_l': 'LeftToeBase',
    'thigh_r': 'RightUpLeg', 'calf_r': 'RightLeg', 'foot_r': 'RightFoot', 'ball_r': 'RightToeBase',
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

# Meshy names its spine chain oddly; walk Hips -> neck to find the three spine bones.
chain = []
b = tgt.data.bones['Hips']
while True:
    kids = [c for c in b.children if not c.name.startswith(('Left', 'Right'))]
    if not kids:
        break
    b = kids[0]
    if b.name == 'neck':
        break
    chain.append(b.name)
spine = (chain + chain[-1:] * 3)[:3]
names = {'SPINE0': spine[0], 'SPINE1': spine[1], 'SPINE2': spine[2]}
MAP = {s: names.get(t, t) for s, t in UE_TO_TGT.items()}
MAP = {s: t for s, t in MAP.items() if t in tgt.data.bones}
# Avoid mapping two source bones onto one target bone when the target spine is shorter.
seen = set()
for s in list(MAP):
    if MAP[s] in seen:
        del MAP[s]
    else:
        seen.add(MAP[s])
print('spine chain', chain, 'mapped', len(MAP))

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


tgt_order = order(tgt, set(MAP.values()))
inv_map = {t: s for s, t in MAP.items()}
tgt_rest_world = {t: world_rot(tgt, tgt.data.bones[t].matrix_local) for t in tgt_order}

made = []
for path in SRCS:
    src, src_objs, src_acts = import_glb(path)
    # Use the source's own bone names if it is a Meshy rig (for extra clips like a kick).
    src_is_ue = 'pelvis' in src.data.bones
    smap = {inv_map[t]: t for t in tgt_order} if src_is_ue else {t: t for t in tgt_order if t in src.data.bones}
    if not src_is_ue:
        # Meshy source: spine names are the same as ours by construction.
        pass
    sinv = {t: s for s, t in smap.items()}
    # Rest alignment: rotate each target rest bone so it points like the source rest bone.
    align = {}
    for t in tgt_order:
        s = sinv.get(t)
        if not s:
            continue
        d_s = bone_dir(src, src.data.bones[s])
        d_t = bone_dir(tgt, tgt.data.bones[t])
        align[t] = d_t.rotation_difference(d_s)
    s_hips = sinv.get('Hips')
    src_hip_h = (src.matrix_world @ src.data.bones[s_hips].head_local).z
    tgt_hip_h = (tgt.matrix_world @ tgt.data.bones['Hips'].head_local).z
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
                if t == 'Hips':
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
                if t == 'Hips':
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
