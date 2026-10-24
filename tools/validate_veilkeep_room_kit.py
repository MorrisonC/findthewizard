"""Reimport final GLBs and report delivered triangle counts, bounds and topology.
Run: blender --background --python tools/validate_veilkeep_room_kit.py
"""
import bpy, bmesh, json, os
from mathutils import Vector
ROOT = 'C:/Development/findthewizard'
OUT = ROOT + '/threejs/public/assets/models'
report = {}
for filename in ('room_shell.glb','gate_arch.glb','mirror_lock.glb'):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=OUT+'/'+filename)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    points = []
    triangles = 0
    nonmanifold = 0
    degenerate = 0
    for o in meshes:
        o.data.calc_loop_triangles()
        triangles += len(o.data.loop_triangles)
        points.extend(o.matrix_world @ Vector(v) for v in o.bound_box)
        bm = bmesh.new()
        bm.from_mesh(o.data)
        # glTF splits vertices at normal/UV seams; weld only for topology validation.
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
        nonmanifold += sum(not e.is_manifold for e in bm.edges)
        degenerate += sum(f.calc_area() < 1e-10 for f in bm.faces)
        bm.free()
    lo = [min(p[i] for p in points) for i in range(3)]
    hi = [max(p[i] for p in points) for i in range(3)]
    report[filename] = {
        'triangles': triangles,
        'mesh_nodes': len(meshes),
        'vertices_before_gltf_shared_vertex_expansion': sum(len(o.data.vertices) for o in meshes),
        'bounds_metres_blender_z_up': {'min':lo,'max':hi,'size':[hi[i]-lo[i] for i in range(3)]},
        'nonmanifold_edges': nonmanifold,
        'degenerate_faces': degenerate,
        'file_bytes': os.path.getsize(OUT+'/'+filename),
    }
report['total_triangles'] = sum(v['triangles'] for k,v in report.items() if isinstance(v,dict))
with open(ROOT+'/tools/veilkeep_room_kit_validation.json','w') as f:
    json.dump(report,f,indent=2)
print(json.dumps(report,indent=2))
