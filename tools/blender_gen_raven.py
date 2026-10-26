"""Blender 5.2 generator for Sable's Starlight Raven (S00 Courtyard Messenger).
Generates: threejs/public/assets/models/starlight_raven.glb
Features:
- Rigged corvid armature (Root, Body, Neck, Head, Beak, LeftWing, RightWing, Tail, Legs)
- Sleek obsidian-indigo body, luminescent starlight wingtips, glowing cyan astral eyes
- Baked actions: 'Idle', 'Flap_Caw'
"""
import bpy
import math
from mathutils import Vector, Euler

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures, bpy.data.actions):
        for item in list(coll):
            coll.remove(item)

def make_mat(name, color, roughness=0.5, metalness=0.0, emissive=None, strength=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = color
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Metallic'].default_value = metalness
        if emissive:
            if 'Emission Color' in bsdf.inputs:
                bsdf.inputs['Emission Color'].default_value = emissive
                bsdf.inputs['Emission Strength'].default_value = strength
            elif 'Emission' in bsdf.inputs:
                bsdf.inputs['Emission'].default_value = emissive
    return mat

def build_raven():
    clear_scene()
    col = bpy.data.collections.new("StarlightRaven")
    bpy.context.scene.collection.children.link(col)

    # Materials
    mat_feathers = make_mat("Raven_Feathers", (0.08, 0.08, 0.15, 1.0), roughness=0.45, metalness=0.25)
    mat_wingtips = make_mat("Raven_Starlight_Wings", (0.25, 0.70, 0.98, 1.0), roughness=0.15, metalness=0.1, emissive=(0.20, 0.75, 1.0, 1.0), strength=2.8)
    mat_beak = make_mat("Raven_Beak", (0.04, 0.04, 0.06, 1.0), roughness=0.3, metalness=0.6)
    mat_eyes = make_mat("Raven_Eyes", (0.45, 0.90, 1.0, 1.0), roughness=0.1, metalness=0.0, emissive=(0.40, 0.95, 1.0, 1.0), strength=4.0)

    # 1. Armature
    arm_data = bpy.data.armatures.new("RavenRig")
    arm_obj = bpy.data.objects.new("RavenArmature", arm_data)
    col.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones

    root = eb.new("Root")
    root.head = (0, 0, 0)
    root.tail = (0, 0, 0.15)

    body = eb.new("Body")
    body.parent = root
    body.head = (0, 0.05, 0.15)
    body.tail = (0, -0.15, 0.32)

    neck = eb.new("Neck")
    neck.parent = body
    neck.head = (0, -0.15, 0.32)
    neck.tail = (0, -0.25, 0.45)

    head = eb.new("Head")
    head.parent = neck
    head.head = (0, -0.25, 0.45)
    head.tail = (0, -0.36, 0.48)

    beak = eb.new("Beak")
    beak.parent = head
    beak.head = (0, -0.36, 0.46)
    beak.tail = (0, -0.48, 0.43)

    # Wings (Left & Right)
    l_wing = eb.new("LeftWing")
    l_wing.parent = body
    l_wing.head = (-0.12, -0.05, 0.30)
    l_wing.tail = (-0.42, 0.18, 0.22)

    r_wing = eb.new("RightWing")
    r_wing.parent = body
    r_wing.head = (0.12, -0.05, 0.30)
    r_wing.tail = (0.42, 0.18, 0.22)

    # Tail
    tail = eb.new("Tail")
    tail.parent = body
    tail.head = (0, 0.18, 0.22)
    tail.tail = (0, 0.42, 0.14)

    # Legs
    l_leg = eb.new("LeftLeg")
    l_leg.parent = root
    l_leg.head = (-0.08, 0, 0.15)
    l_leg.tail = (-0.08, 0, 0.0)

    r_leg = eb.new("RightLeg")
    r_leg.parent = root
    r_leg.head = (0.08, 0, 0.15)
    r_leg.tail = (0.08, 0, 0.0)

    bpy.ops.object.mode_set(mode='OBJECT')

    def add_part(func, name, bone, mat, **kwargs):
        func(**kwargs)
        o = bpy.context.active_object
        o.name = name
        o.data.materials.append(mat)
        o.parent = arm_obj
        o.parent_type = 'BONE'
        o.parent_bone = bone
        return o

    # 2. Meshes
    # Body (Tapered oval torso)
    add_part(bpy.ops.mesh.primitive_cone_add, "Raven_Body", "Body", mat_feathers,
             vertices=8, radius1=0.15, radius2=0.08, depth=0.38, location=(0, 0.02, 0.24))
    b_obj = bpy.data.objects["Raven_Body"]
    b_obj.rotation_euler = (math.pi / 3, 0, 0)

    # Head & Neck
    add_part(bpy.ops.mesh.primitive_ico_sphere_add, "Raven_Head", "Head", mat_feathers,
             subdivisions=2, radius=0.10, location=(0, -0.28, 0.46))

    # Beak (Sharp cone)
    add_part(bpy.ops.mesh.primitive_cone_add, "Raven_BeakMesh", "Beak", mat_beak,
             vertices=5, radius1=0.042, radius2=0.005, depth=0.16, location=(0, -0.40, 0.44))
    bk_obj = bpy.data.objects["Raven_BeakMesh"]
    bk_obj.rotation_euler = (-math.pi / 2.3, 0, 0)

    # Astral Eyes
    for ex in (-0.055, 0.055):
        add_part(bpy.ops.mesh.primitive_ico_sphere_add, f"Raven_Eye_{ex}", "Head", mat_eyes,
                 subdivisions=1, radius=0.022, location=(ex, -0.32, 0.48))

    # Wings (Left & Right) with glowing starlight primaries
    for side, sx in (("Left", -1), ("Right", 1)):
        add_part(bpy.ops.mesh.primitive_cube_add, f"Raven_Wing_{side}", f"{side}Wing", mat_feathers,
                 size=1.0, location=(sx * 0.22, 0.08, 0.25))
        w_obj = bpy.data.objects[f"Raven_Wing_{side}"]
        w_obj.scale = (0.24, 0.38, 0.035)
        w_obj.rotation_euler = (math.pi / 5, sx * 0.2, -sx * math.pi / 6)

        add_part(bpy.ops.mesh.primitive_cone_add, f"Raven_WingTip_{side}", f"{side}Wing", mat_wingtips,
                 vertices=4, radius1=0.07, radius2=0.01, depth=0.25, location=(sx * 0.35, 0.22, 0.18))
        wt_obj = bpy.data.objects[f"Raven_WingTip_{side}"]
        wt_obj.rotation_euler = (math.pi / 4, sx * 0.3, -sx * math.pi / 5)

    # Tail Fan
    add_part(bpy.ops.mesh.primitive_cone_add, "Raven_TailFan", "Tail", mat_feathers,
             vertices=4, radius1=0.14, radius2=0.02, depth=0.32, location=(0, 0.30, 0.16))
    t_obj = bpy.data.objects["Raven_TailFan"]
    t_obj.rotation_euler = (-math.pi / 4, 0, 0)

    # Talons (Left & Right)
    for side, sx in (("Left", -0.08), ("Right", 0.08)):
        add_part(bpy.ops.mesh.primitive_cylinder_add, f"Raven_Talon_{side}", f"{side}Leg", mat_beak,
                 vertices=6, radius=0.025, depth=0.15, location=(sx, 0, 0.075))

    # 3. Animations
    ad = arm_obj.animation_data_create()
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='POSE')
    pbs = arm_obj.pose.bones
    for pb in pbs:
        pb.rotation_mode = 'XYZ'

    p_head = pbs["Head"]
    p_body = pbs["Body"]
    p_lwing = pbs["LeftWing"]
    p_rwing = pbs["RightWing"]
    p_beak = pbs["Beak"]

    # ACTION 1: 'Idle' (Perching, curious head tilting, breathing, 60 frames)
    act_idle = bpy.data.actions.new("Idle")
    ad.action = act_idle
    for frame, h_tilt_y, h_rot_z, b_bob in [
        (0,  0.0,   0.0,  0.0),
        (15, 0.20,  0.35, 0.015),
        (30, 0.0,   0.15, 0.0),
        (45, -0.18, -0.30, 0.012),
        (60, 0.0,   0.0,  0.0)
    ]:
        p_head.rotation_euler = (0, h_tilt_y, h_rot_z)
        p_head.keyframe_insert(data_path="rotation_euler", frame=frame)
        p_body.location = (0, 0, b_bob)
        p_body.keyframe_insert(data_path="location", frame=frame)
        p_lwing.rotation_euler = (0, 0, b_bob * 2)
        p_lwing.keyframe_insert(data_path="rotation_euler", frame=frame)
        p_rwing.rotation_euler = (0, 0, -b_bob * 2)
        p_rwing.keyframe_insert(data_path="rotation_euler", frame=frame)

    track_idle = ad.nla_tracks.new()
    track_idle.name = "NLA_Idle"
    strip_idle = track_idle.strips.new("Idle", 0, act_idle)
    strip_idle.action_frame_start = 0
    strip_idle.action_frame_end = 60

    # ACTION 2: 'Flap_Caw' (Rearing up, opening beak, spreading and flapping wings twice, 45 frames)
    act_caw = bpy.data.actions.new("Flap_Caw")
    ad.action = act_caw
    for frame, wing_spread, beak_open, body_rear in [
        (0,  0.0,  0.0,  0.0),
        (10, 0.85, 0.35, 0.12),
        (18, 0.10, 0.40, 0.08),
        (26, 0.95, 0.45, 0.14),
        (35, 0.25, 0.20, 0.05),
        (45, 0.0,  0.0,  0.0)
    ]:
        p_lwing.rotation_euler = (0, -wing_spread, wing_spread * 0.8)
        p_lwing.keyframe_insert(data_path="rotation_euler", frame=frame)
        p_rwing.rotation_euler = (0, wing_spread, -wing_spread * 0.8)
        p_rwing.keyframe_insert(data_path="rotation_euler", frame=frame)
        p_beak.rotation_euler = (beak_open, 0, 0)
        p_beak.keyframe_insert(data_path="rotation_euler", frame=frame)
        p_body.rotation_euler = (-body_rear, 0, 0)
        p_body.keyframe_insert(data_path="rotation_euler", frame=frame)

    track_caw = ad.nla_tracks.new()
    track_caw.name = "NLA_Caw"
    strip_caw = track_caw.strips.new("Flap_Caw", 70, act_caw)
    strip_caw.action_frame_start = 0
    strip_caw.action_frame_end = 45

    bpy.ops.object.mode_set(mode='OBJECT')

    # Export GLB
    bpy.ops.object.select_all(action='SELECT')
    out_path = "C:/Development/findthewizard/threejs/public/assets/models/starlight_raven.glb"
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_materials='EXPORT',
        export_animations=True,
        export_nla_strips=True
    )
    print(f"Successfully baked Starlight Raven model to: {out_path}")

if __name__ == "__main__":
    build_raven()
