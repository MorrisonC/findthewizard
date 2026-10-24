import bpy, os, json
from collections import defaultdict
OUT='C:/Development/findthewizard/threejs/public/assets/models'
scene=bpy.context.scene
charcols=bpy.data.collections.get('04_Character_Source')
allchar=set(charcols.objects) if charcols else set()
kaelen={o for o in allchar if o.name.startswith('Kaelen')}
guard={o for o in allchar if o.name.startswith('Guard') or o.name=='KeepGuard'}
court={o for o in scene.objects if o.type=='MESH' and o not in allchar and not any(c.name.startswith('05_') for c in o.users_collection)}

def batch_export(path,objects,label):
    dg=bpy.context.evaluated_depsgraph_get(); groups=defaultdict(list); temp=[]
    for src in objects:
        if src.type!='MESH': continue
        ev=src.evaluated_get(dg)
        me=bpy.data.meshes.new_from_object(ev,depsgraph=dg)
        me.transform(src.matrix_world)
        ob=bpy.data.objects.new(label+' | part',me); scene.collection.objects.link(ob); temp.append(ob)
        key=me.materials[0].name if me.materials else 'Unassigned'; groups[key].append(ob)
    result=[]
    for key,obs in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs: o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0]
        if len(obs)>1: bpy.ops.object.join()
        ob=bpy.context.view_layer.objects.active; ob.name=label+' | '+key
        ob.data.calc_loop_triangles(); result.append(ob)
    bpy.ops.object.select_all(action='DESELECT')
    for o in result: o.select_set(True)
    bpy.context.view_layer.objects.active=result[0]
    bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
    tris=sum(len(o.data.loop_triangles) for o in result)
    print(label,'triangles',tris,'meshes',len(result),'bytes',os.path.getsize(path))

batch_export(os.path.join(OUT,'s00_courtyard.glb'),court,'S00_Courtyard')
batch_export(os.path.join(OUT,'kaelen.glb'),kaelen,'Kaelen')
batch_export(os.path.join(OUT,'keep_guard.glb'),guard,'KeepGuard')
