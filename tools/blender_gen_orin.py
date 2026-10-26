"""Blender 5.2 generator for Gatekeeper Orin (OW1 Outer Wall Warden).
Generates: threejs/public/assets/models/gatekeeper_orin.glb
Features:
- Rigged humanoid warden armature (Root, Hips, Spine, Chest, Head, Shoulders, Arms, Hands, Legs, Halberd)
- Heavy blued plate armor, brass cog insignia, glowing blue visor slit, iron key ring, warden poleaxe
- Baked actions: 'Idle', 'Talk', 'Walk'
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

def build_orin():
    clear_scene()
    col = bpy.data.collections.new("GatekeeperOrin")
    bpy.context.scene.collection.children.link(col)

    # Materials
    mat_plate = make_mat("Orin_Blued_Plate", (0.12, 0.16, 0.24, 1.0), roughness=0.35, metalness=0.85)
    mat_brass = make_mat("Orin_Citadel_Brass", (0.80, 0.58, 0.18, 1.0), roughness=0.28, metalness=0.9)
    mat_leather = make_mat("Orin_Warden_Leather", (0.24, 0.15, 0.08, 1.0), roughness=0.85, metalness=0.05)
    mat_steel = make_mat("Orin_Forged_Steel", (0.55, 0.58, 0.62, 1.0), roughness=0.22, metalness=0.92)
    mat_visor = make_mat("Orin_Cyan_Visor", (0.35, 0.85, 1.0, 1.0), roughness=0.1, metalness=0.0, emissive=(0.30, 0.88, 1.0, 1.0), strength=3.5)

    # 1. Armature
    arm_data = bpy.data.armatures.new("OrinRig")
    arm_obj = bpy.data.objects.new("OrinArmature", arm_data)
    col.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones

    root = eb.new("Root")
    root.head = (0, 0, 0)
    root.tail = (0, 0, 0.25)

    hips = eb.new("Hips")
    hips.parent = root
    hips.head = (0, 0, 0.85)
    hips.tail = (0, 0, 1.10)

    chest = eb.new("Chest")
    chest.parent = hips
    chest.head = (0, 0, 1.10)
    chest.tail = (0, 0, 1.48)

    head = eb.new("Head")
    head.parent = chest
    head.head = (0, 0, 1.48)
    head.tail = (0, 0, 1.78)

    # Legs
    for side, sx in (("Left", -0.16), ("Right", 0.16)):
        uleg = eb.new(f"{side}UpLeg")
        uleg.parent = hips
        uleg.head = (sx, 0, 0.85)
        uleg.tail = (sx, 0, 0.45)

        lleg = eb.new(f"{side}Leg")
        lleg.parent = uleg
        lleg.head = (sx, 0, 0.45)
        lleg.tail = (sx, 0, 0.05)

    # Arms
    l_arm = eb.new("LeftArm")
    l_arm.parent = chest
    l_arm.head = (-0.28, 0, 1.42)
    l_arm.tail = (-0.52, -0.05, 1.12)

    l_hand = eb.new("LeftHand")
    l_hand.parent = l_arm
    l_hand.head = (-0.52, -0.05, 1.12)
    l_hand.tail = (-0.60, -0.10, 0.98)

    r_arm = eb.new("RightArm")
    r_arm.parent = chest
    r_arm.head = (0.28, 0, 1.42)
    r_arm.tail = (0.45, -0.15, 1.15)

    r_hand = eb.new("RightHand")
    r_hand.parent = r_arm
    r_hand.head = (0.45, -0.15, 1.15)
    r_hand.tail = (0.48, -0.22, 1.05)

    weapon = eb.new("Halberd")
    weapon.parent = r_hand
    weapon.head = (0.48, -0.22, 1.05)
    weapon.tail = (0.48, -0.22, 2.2)

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
    # Cuirass (Breastplate)
    add_part(bpy.ops.mesh.primitive_cube_add, "Orin_Cuirass", "Chest", mat_plate,
             size=1.0, location=(0, 0, 1.28))
    c_obj = bpy.data.objects["Orin_Cuirass"]
    c_obj.scale = (0.46, 0.32, 0.40)

    # Brass Cog Medallion on chest
    add_part(bpy.ops.mesh.primitive_cylinder_add, "Orin_CogInsignia", "Chest", mat_brass,
             vertices=8, radius=0.10, depth=0.03, location=(0, -0.17, 1.34))
    cg_obj = bpy.data.objects["Orin_CogInsignia"]
    cg_obj.rotation_euler = (math.pi / 2, 0, 0)

    # Belt & Iron Key Ring
    add_part(bpy.ops.mesh.primitive_cylinder_add, "Orin_Belt", "Hips", mat_leather,
             vertices=8, radius=0.25, depth=0.12, location=(0, 0, 0.88))
    add_part(bpy.ops.mesh.primitive_torus_add, "Orin_KeyRing", "Hips", mat_brass,
             major_radius=0.075, minor_radius=0.012, location=(-0.24, -0.06, 0.84))
    for ki in range(3):
        add_part(bpy.ops.mesh.primitive_cylinder_add, f"Orin_Key_{ki}", "Hips", mat_steel,
                 vertices=4, radius=0.015, depth=0.12, location=(-0.24, -0.06, 0.76 - ki * 0.02))

    # Helm & Glowing Visor
    add_part(bpy.ops.mesh.primitive_ico_sphere_add, "Orin_SalletHelm", "Head", mat_plate,
             subdivisions=2, radius=0.18, location=(0, 0, 1.62))
    add_part(bpy.ops.mesh.primitive_cube_add, "Orin_VisorSlit", "Head", mat_visor,
             size=1.0, location=(0, -0.16, 1.62))
    v_obj = bpy.data.objects["Orin_VisorSlit"]
    v_obj.scale = (0.16, 0.03, 0.035)

    # Pauldrons
    for side, sx in (("Left", -0.34), ("Right", 0.34)):
        add_part(bpy.ops.mesh.primitive_cylinder_add, f"Orin_Pauldron_{side}", f"{side}Arm", mat_brass,
                 vertices=6, radius=0.14, depth=0.22, location=(sx, 0, 1.42))

    # Arms & Gauntlets
    for side, sx in (("Left", -1), ("Right", 1)):
        add_part(bpy.ops.mesh.primitive_cylinder_add, f"Orin_ArmMesh_{side}", f"{side}Arm", mat_plate,
                 vertices=6, radius=0.08, depth=0.38, location=(sx * 0.40, -0.04, 1.25))
        add_part(bpy.ops.mesh.primitive_cube_add, f"Orin_Gauntlet_{side}", f"{side}Hand", mat_steel,
                 size=1.0, location=(sx * 0.52, -0.12, 1.05))
        g_obj = bpy.data.objects[f"Orin_Gauntlet_{side}"]
        g_obj.scale = (0.09, 0.12, 0.09)

    # Legs & Greaves
    for side, sx in (("Left", -0.16), ("Right", 0.16)):
        add_part(bpy.ops.mesh.primitive_cylinder_add, f"Orin_Thigh_{side}", f"{side}UpLeg", mat_leather,
                 vertices=6, radius=0.10, depth=0.40, location=(sx, 0, 0.65))
        add_part(bpy.ops.mesh.primitive_cylinder_add, f"Orin_Greave_{side}", f"{side}Leg", mat_plate,
                 vertices=6, radius=0.09, depth=0.38, location=(sx, 0, 0.25))
        add_part(bpy.ops.mesh.primitive_cube_add, f"Orin_Sabaton_{side}", f"{side}Leg", mat_steel,
                 size=1.0, location=(sx, -0.06, 0.06))
        sb_obj = bpy.data.objects[f"Orin_Sabaton_{side}"]
        sb_obj.scale = (0.11, 0.22, 0.08)

    # Warden Poleaxe / Halberd
    add_part(bpy.ops.mesh.primitive_cylinder_add, "Orin_HalberdShaft", "Halberd", mat_leather,
             vertices=8, radius=0.035, depth=2.1, location=(0.48, -0.22, 1.15))
    add_part(bpy.ops.mesh.primitive_cube_add, "Orin_HalberdAxeHead", "Halberd", mat_steel,
             size=1.0, location=(0.48, -0.32, 2.05))
    ax_obj = bpy.data.objects["Orin_HalberdAxeHead"]
    ax_obj.scale = (0.025, 0.28, 0.22)
    add_part(bpy.ops.mesh.primitive_cone_add, "Orin_HalberdSpike", "Halberd", mat_brass,
             vertices=4, radius1=0.04, radius2=0.005, depth=0.32, location=(0.48, -0.22, 2.32))

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
    p_lleg = pbs["LeftUpLeg"]
    p_rleg = pbs["RightUpLeg"]

    # ACTION 1: 'Idle' (Vigilant warden stance, resting halberd, breathing, 60 frames)
    act_idle = bpy.data.actions.new("Idle")
    ad.action = act_idle
    for frame, breathe_z in [(0, 0.0), (15, 0.015), (30, 0.0), (45, -0.01), (60, 0.0)]:
        p_chest.location = (0, 0, breathe_z)
        p_chest.keyframe_insert(data_path="location", frame=frame)

    track_idle = ad.nla_tracks.new()
    track_idle.name = "NLA_Idle"
    strip_idle = track_idle.strips.new("Idle", 0, act_idle)
    strip_idle.action_frame_start = 0
    strip_idle.action_frame_end = 60

    # ACTION 2: 'Talk' (Nodding, gesturing firmly with left arm, 45 frames)
    act_talk = bpy.data.actions.new("Talk")
    ad.action = act_talk
    for frame, nod_x, l_gest in [
        (0,  0.0,  0.0),
        (12, 0.12, 0.35),
        (22, 0.02, 0.55),
        (32, 0.10, 0.25),
        (45, 0.0,  0.0)
    ]:
        p_head.rotation_euler = (nod_x, 0, 0)
        p_head.keyframe_insert(data_path="rotation_euler", frame=frame)
        p_larm.rotation_euler = (l_gest, 0, -l_gest * 0.3)
        p_larm.keyframe_insert(data_path="rotation_euler", frame=frame)

    track_talk = ad.nla_tracks.new()
    track_talk.name = "NLA_Talk"
    strip_talk = track_talk.strips.new("Talk", 70, act_talk)
    strip_talk.action_frame_start = 0
    strip_talk.action_frame_end = 45

    # ACTION 3: 'Walk' (Heavy plated patrol stride, 30 frames)
    act_walk = bpy.data.actions.new("Walk")
    ad.action = act_walk
    for frame, l_stride in [(0, 0.35), (8, 0.0), (15, -0.35), (22, 0.0), (30, 0.35)]:
        p_lleg.rotation_euler = (l_stride, 0, 0)
        p_lleg.keyframe_insert(data_path="rotation_euler", frame=frame)
        p_rleg.rotation_euler = (-l_stride, 0, 0)
        p_rleg.keyframe_insert(data_path="rotation_euler", frame=frame)

    track_walk = ad.nla_tracks.new()
    track_walk.name = "NLA_Walk"
    strip_walk = track_walk.strips.new("Walk", 125, act_walk)
    strip_walk.action_frame_start = 0
    strip_walk.action_frame_end = 30

    bpy.ops.object.mode_set(mode='OBJECT')

    # Export GLB
    bpy.ops.object.select_all(action='SELECT')
    out_path = "C:/Development/findthewizard/threejs/public/assets/models/gatekeeper_orin.glb"
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
    print(f"Successfully baked Gatekeeper Orin model to: {out_path}")

if __name__ == "__main__":
    build_orin()
