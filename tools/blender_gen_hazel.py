"""Blender 5.2 generator for Mother Hazel (MH1 Witch Homestead Herbalist).
Generates: threejs/public/assets/models/mother_hazel.glb
Features:
- Rigged humanoid witch armature (Root, Hips, Spine, Chest, Head, Arms, Hands, Staff, Lantern)
- Woven herbalist shawl, apothecary apron, hanging mandrake/vials, gnarled staff with glowing lantern
- Baked actions: 'Idle', 'Talk'
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

def make_mat(name, color, roughness=0.6, metalness=0.0, emissive=None, strength=1.0):
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

def build_hazel():
    clear_scene()
    col = bpy.data.collections.new("MotherHazel")
    bpy.context.scene.collection.children.link(col)

    # Materials
    mat_shawl = make_mat("Hazel_Woven_Shawl", (0.55, 0.12, 0.22, 1.0), roughness=0.85, metalness=0.05)
    mat_skirt = make_mat("Hazel_Umber_Skirt", (0.22, 0.16, 0.12, 1.0), roughness=0.88, metalness=0.05)
    mat_apron = make_mat("Hazel_Herb_Apron", (0.65, 0.58, 0.45, 1.0), roughness=0.75, metalness=0.05)
    mat_hair = make_mat("Hazel_Silver_Hair", (0.78, 0.80, 0.84, 1.0), roughness=0.6, metalness=0.1)
    mat_skin = make_mat("Hazel_Weathered_Skin", (0.72, 0.52, 0.42, 1.0), roughness=0.65, metalness=0.0)
    mat_wood = make_mat("Hazel_Gnarled_Wood", (0.28, 0.18, 0.10, 1.0), roughness=0.7, metalness=0.1)
    mat_lantern = make_mat("Hazel_Amber_Lantern", (0.95, 0.65, 0.15, 1.0), roughness=0.1, metalness=0.2, emissive=(1.0, 0.70, 0.18, 1.0), strength=3.5)
    mat_potion = make_mat("Hazel_Emerald_Potion", (0.20, 0.85, 0.35, 1.0), roughness=0.15, metalness=0.1, emissive=(0.25, 0.90, 0.40, 1.0), strength=2.2)

    # 1. Armature
    arm_data = bpy.data.armatures.new("HazelRig")
    arm_obj = bpy.data.objects.new("HazelArmature", arm_data)
    col.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones

    root = eb.new("Root")
    root.head = (0, 0, 0)
    root.tail = (0, 0, 0.25)

    hips = eb.new("Hips")
    hips.parent = root
    hips.head = (0, 0, 0.65)
    hips.tail = (0, 0, 0.95)

    chest = eb.new("Chest")
    chest.parent = hips
    chest.head = (0, 0, 0.95)
    chest.tail = (0, 0, 1.25)

    head = eb.new("Head")
    head.parent = chest
    head.head = (0, 0.02, 1.25)
    head.tail = (0, 0.04, 1.52)

    l_arm = eb.new("LeftArm")
    l_arm.parent = chest
    l_arm.head = (-0.22, 0, 1.20)
    l_arm.tail = (-0.42, -0.08, 0.95)

    l_hand = eb.new("LeftHand")
    l_hand.parent = l_arm
    l_hand.head = (-0.42, -0.08, 0.95)
    l_hand.tail = (-0.48, -0.15, 0.85)

    r_arm = eb.new("RightArm")
    r_arm.parent = chest
    r_arm.head = (0.22, 0, 1.20)
    r_arm.tail = (0.40, -0.05, 0.95)

    r_hand = eb.new("RightHand")
    r_hand.parent = r_arm
    r_hand.head = (0.40, -0.05, 0.95)
    r_hand.tail = (0.44, -0.12, 0.88)

    staff_bone = eb.new("Staff")
    staff_bone.parent = r_hand
    staff_bone.head = (0.44, -0.12, 0.88)
    staff_bone.tail = (0.44, -0.12, 1.65)

    lantern_bone = eb.new("Lantern")
    lantern_bone.parent = staff_bone
    lantern_bone.head = (0.44, -0.22, 1.45)
    lantern_bone.tail = (0.44, -0.22, 1.25)

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
    # Skirt
    add_part(bpy.ops.mesh.primitive_cone_add, "Hazel_Skirt", "Hips", mat_skirt,
             vertices=8, radius1=0.42, radius2=0.22, depth=0.75, location=(0, 0, 0.40))

    # Apron
    add_part(bpy.ops.mesh.primitive_cube_add, "Hazel_Apron", "Hips", mat_apron,
             size=1.0, location=(0, -0.22, 0.55))
    ap_obj = bpy.data.objects["Hazel_Apron"]
    ap_obj.scale = (0.28, 0.04, 0.45)

    # Hanging potion vials on apron belt
    for vi, vx in enumerate((-0.10, 0.10)):
        add_part(bpy.ops.mesh.primitive_cylinder_add, f"Hazel_Potion_{vi}", "Hips", mat_potion,
                 vertices=6, radius=0.032, depth=0.12, location=(vx, -0.24, 0.72))

    # Shawl & Bodice
    add_part(bpy.ops.mesh.primitive_cone_add, "Hazel_Shawl", "Chest", mat_shawl,
             vertices=8, radius1=0.32, radius2=0.18, depth=0.42, location=(0, 0, 1.08))

    # Head, Hair, Bun
    add_part(bpy.ops.mesh.primitive_ico_sphere_add, "Hazel_HeadMesh", "Head", mat_skin,
             subdivisions=2, radius=0.11, location=(0, 0.02, 1.36))
    add_part(bpy.ops.mesh.primitive_ico_sphere_add, "Hazel_HairBun", "Head", mat_hair,
             subdivisions=2, radius=0.12, location=(0, 0.10, 1.42))

    # Arms & Hands
    add_part(bpy.ops.mesh.primitive_cylinder_add, "Hazel_Sleeve_L", "LeftArm", mat_shawl,
             vertices=6, radius=0.065, depth=0.36, location=(-0.32, -0.04, 1.08))
    add_part(bpy.ops.mesh.primitive_ico_sphere_add, "Hazel_Hand_L", "LeftHand", mat_skin,
             subdivisions=1, radius=0.05, location=(-0.45, -0.12, 0.88))

    add_part(bpy.ops.mesh.primitive_cylinder_add, "Hazel_Sleeve_R", "RightArm", mat_shawl,
             vertices=6, radius=0.065, depth=0.36, location=(0.32, -0.02, 1.08))
    add_part(bpy.ops.mesh.primitive_ico_sphere_add, "Hazel_Hand_R", "RightHand", mat_skin,
             subdivisions=1, radius=0.05, location=(0.42, -0.08, 0.90))

    # Walking Staff
    add_part(bpy.ops.mesh.primitive_cylinder_add, "Hazel_StaffShaft", "Staff", mat_wood,
             vertices=7, radius=0.035, depth=1.65, location=(0.44, -0.12, 0.85))

    # Amber Lantern hanging from staff hook
    add_part(bpy.ops.mesh.primitive_cylinder_add, "Hazel_LanternFrame", "Lantern", mat_wood,
             vertices=6, radius=0.06, depth=0.18, location=(0.44, -0.22, 1.35))
    add_part(bpy.ops.mesh.primitive_ico_sphere_add, "Hazel_LanternGlass", "Lantern", mat_lantern,
             subdivisions=1, radius=0.048, location=(0.44, -0.22, 1.35))

    # 3. Animations
    ad = arm_obj.animation_data_create()
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='POSE')
    pbs = arm_obj.pose.bones
    for pb in pbs:
        pb.rotation_mode = 'XYZ'

    p_chest = pbs["Chest"]
    p_head = pbs["Head"]
    p_larm = pbs["LeftArm"]
    p_lantern = pbs["Lantern"]

    # ACTION 1: 'Idle' (Leaning gently on staff, breathing, lantern swaying, 60 frames)
    act_idle = bpy.data.actions.new("Idle")
    ad.action = act_idle
    for frame, breathe_z, lan_sway in [
        (0,  0.0,   0.0),
        (15, 0.015, 0.12),
        (30, 0.0,   0.0),
        (45, -0.01, -0.12),
        (60, 0.0,   0.0)
    ]:
        p_chest.location = (0, 0, breathe_z)
        p_chest.keyframe_insert(data_path="location", frame=frame)
        p_lantern.rotation_euler = (lan_sway, 0, 0)
        p_lantern.keyframe_insert(data_path="rotation_euler", frame=frame)

    track_idle = ad.nla_tracks.new()
    track_idle.name = "NLA_Idle"
    strip_idle = track_idle.strips.new("Idle", 0, act_idle)
    strip_idle.action_frame_start = 0
    strip_idle.action_frame_end = 60

    # ACTION 2: 'Talk' (Gesturing with left hand towards hearth, raising staff, 45 frames)
    act_talk = bpy.data.actions.new("Talk")
    ad.action = act_talk
    for frame, l_gest, h_nod in [
        (0,  0.0,  0.0),
        (12, 0.45, 0.12),
        (22, 0.75, 0.04),
        (32, 0.35, 0.10),
        (45, 0.0,  0.0)
    ]:
        p_larm.rotation_euler = (l_gest, 0, -l_gest * 0.4)
        p_larm.keyframe_insert(data_path="rotation_euler", frame=frame)
        p_head.rotation_euler = (h_nod, 0, 0)
        p_head.keyframe_insert(data_path="rotation_euler", frame=frame)

    track_talk = ad.nla_tracks.new()
    track_talk.name = "NLA_Talk"
    strip_talk = track_talk.strips.new("Talk", 70, act_talk)
    strip_talk.action_frame_start = 0
    strip_talk.action_frame_end = 45

    bpy.ops.object.mode_set(mode='OBJECT')

    # Export GLB
    bpy.ops.object.select_all(action='SELECT')
    out_path = "C:/Development/findthewizard/threejs/public/assets/models/mother_hazel.glb"
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
    print(f"Successfully baked Mother Hazel model to: {out_path}")

if __name__ == "__main__":
    build_hazel()
