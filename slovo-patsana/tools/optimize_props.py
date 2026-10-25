"""Decimate Poly Haven props to game budgets and pack them as single GLBs.

    python optimize_props.py <props_dir>   (reads <name>/<name>.gltf, writes <name>.glb)
"""
import bpy, glob, os, sys
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
root = argv[0]
BUDGET = {'street_lamp_01': 2500, 'concrete_road_barrier': 1500, 'dead_tree_trunk': 3000, 'covered_car': 6000}
for f in sorted(glob.glob(os.path.join(root, '*', '*.gltf'))):
    name = os.path.splitext(os.path.basename(f))[0]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=f)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    total = sum(len(o.data.polygons) for o in meshes)
    target = BUDGET.get(name, 4000)
    if total > target:
        ratio = target / total
        for o in meshes:
            bpy.context.view_layer.objects.active = o
            m = o.modifiers.new('d', 'DECIMATE')
            m.ratio = ratio
            bpy.ops.object.modifier_apply(modifier='d')
    for img in bpy.data.images:
        if img.size[0] > 1024:
            img.scale(1024, 1024)
    out = os.path.join(root, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85)
    print('prop', name, total, '->', sum(len(o.data.polygons) for o in meshes), os.path.getsize(out) // 1024, 'KB')
