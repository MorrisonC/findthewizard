"""Blender 5.2 generator for Arch-Illusionist Duke Vaelor.
Generates: threejs/public/assets/models/vaelor.glb
Features:
- Rigged armature with Root, Hips, Spine, Chest, Head, Shoulders, Arms, Hands, StaffSocket, Halo
- Layered astral robes with gold filigree, porcelain illusionist mask, celestial halo
- Astral scepter with floating starlight gyro-crystal
- Baked actions: 'Idle', 'Cast', 'Phase2_Invert', 'Hit', 'Death'
"""
import bpy
import bmesh
import math
from mathutils import Vector, Euler, Matrix

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

def build_vaelor():
    clear_scene()
    col = bpy.data.collections.new("VaelorBoss")
    bpy.context.scene.collection.children.link(col)

    # Materials
    mat_robe = make_mat("Vaelor_Astral_Robe", (0.12, 0.10, 0.35, 1.0), roughness=0.35, metalness=0.15)
    mat_gold = make_mat("Vaelor_Archon_Gold", (0.85, 0.68, 0.22, 1.0), roughness=0.25, metalness=0.88)
    mat_mask = make_mat("Vaelor_Porcelain_Mask", (0.95, 0.96, 1.0, 1.0), roughness=0.15, metalness=0.05)
    mat_starlight = make_mat("Vaelor_Starlight_Cyan", (0.35, 0.85, 1.0, 1.0), roughness=0.1, metalness=0.1, emissive=(0.25, 0.85, 1.0, 1.0), strength=3.2)
    mat_obsidian = make_mat("Vaelor_Obsidian_Staff", (0.05, 0.05, 0.08, 1.0), roughness=0.3, metalness=0.8)

    # 1. Armature
    arm_data = bpy.data.armatures.new("VaelorRig")
    arm_obj = bpy.data.objects.new("VaelorArmature", arm_data)
    col.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones

    # Bones (Blender Z-up)
    root = eb.new("Root")
    root.head = (0, 0, 0)
    root.tail = (0, 0, 0.4)

    hips = eb.new("Hips")
    hips.parent = root
    hips.head = (0, 0, 0.85)
    hips.tail = (0, 0, 1.15)

    chest = eb.new("Chest")
    chest.parent = hips
    chest.head = (0, 0, 1.15)
    chest.tail = (0, 0, 1.55)

    head = eb.new("Head")
    head.parent = chest
    head.head = (0, 0, 1.55)
    head.tail = (0, 0, 1.85)

    halo = eb.new("HaloSocket")
    halo.parent = head
    halo.head = (0, 0.12, 1.72)
    halo.tail = (0, 0.12, 2.05)

    # Arms
    l_arm = eb.new("LeftArm")
    l_arm.parent = chest
    l_arm.head = (-0.28, 0, 1.48)
    l_arm.tail = (-0.58, 0, 1.15)

    l_hand = eb.new("LeftHand")
    l_hand.parent = l_arm
    l_hand.head = (-0.58, 0, 1.15)
    l_hand.tail = (-0.68, 0.05, 1.0)

    r_arm = eb.new("RightArm")
    r_arm.parent = chest
    r_arm.head = (0.28, 0, 1.48)
    r_arm.tail = (0.58, 0, 1.15)

    r_hand = eb.new("RightHand")
    r_hand.parent = r_arm
    r_hand.head = (0.58, 0, 1.15)
    r_hand.tail = (0.68, 0.05, 1.0)

    staff_bone = eb.new("StaffSocket")
    staff_bone.parent = r_hand
    staff_bone.head = (0.68, 0.1, 1.0)
    staff_bone.tail = (0.68, 0.1, 2.1)

    bpy.ops.object.mode_set(mode='OBJECT')

    # Helper function to create part and bind to bone
    def add_mesh_part(mesh_func, name, bone_name, mat, **kwargs):
        mesh_func(**kwargs)
        obj = bpy.context.active_object
        obj.name = name
        obj.data.materials.append(mat)
        obj.parent = arm_obj
        obj.parent_type = 'BONE'
        obj.parent_bone = bone_name
        return obj

    # 2. Geometry
    # Flowing conical lower robes (floating levitation aesthetic)
    add_mesh_part(bpy.ops.mesh.primitive_cone_add, "Vaelor_LowerRobes", "Hips", mat_robe,
                  vertices=10, radius1=0.62, radius2=0.28, depth=1.1, location=(0, 0, 0.6))

    # Upper torso / tunic
    add_mesh_part(bpy.ops.mesh.primitive_cube_add, "Vaelor_Torso", "Chest", mat_robe,
                  size=1.0, location=(0, 0, 1.35))
    obj_torso = bpy.data.objects["Vaelor_Torso"]
    obj_torso.scale = (0.44, 0.30, 0.42)

    # Golden sash & belt
    add_mesh_part(bpy.ops.mesh.primitive_cylinder_add, "Vaelor_GoldBelt", "Chest", mat_gold,
                  vertices=8, radius=0.28, depth=0.12, location=(0, 0, 1.18))

    # Pauldrons
    for side, sx in (("Left", -0.32), ("Right", 0.32)):
        add_mesh_part(bpy.ops.mesh.primitive_cylinder_add, f"Vaelor_Pauldron_{side}", f"{side}Arm", mat_gold,
                      vertices=6, radius=0.16, depth=0.28, location=(sx, 0, 1.48))

    # Sleeves & Hands
    add_mesh_part(bpy.ops.mesh.primitive_cone_add, "Vaelor_Sleeve_L", "LeftArm", mat_robe,
                  vertices=8, radius1=0.18, radius2=0.10, depth=0.55, location=(-0.44, 0, 1.30))
    add_mesh_part(bpy.ops.mesh.primitive_ico_sphere_add, "Vaelor_Hand_L", "LeftHand", mat_mask,
                  subdivisions=1, radius=0.075, location=(-0.62, 0.04, 1.05))

    add_mesh_part(bpy.ops.mesh.primitive_cone_add, "Vaelor_Sleeve_R", "RightArm", mat_robe,
                  vertices=8, radius1=0.18, radius2=0.10, depth=0.55, location=(0.44, 0, 1.30))
    add_mesh_part(bpy.ops.mesh.primitive_ico_sphere_add, "Vaelor_Hand_R", "RightHand", mat_mask,
                  subdivisions=1, radius=0.075, location=(0.62, 0.04, 1.05))

    # Porcelain Mask & Hood
    add_mesh_part(bpy.ops.mesh.primitive_ico_sphere_add, "Vaelor_Hood", "Head", mat_robe,
                  subdivisions=2, radius=0.22, location=(0, 0.02, 1.68))
    add_mesh_part(bpy.ops.mesh.primitive_cube_add, "Vaelor_Mask", "Head", mat_mask,
                  size=1.0, location=(0, -0.15, 1.68))
    obj_mask = bpy.data.objects["Vaelor_Mask"]
    obj_mask.scale = (0.16, 0.06, 0.22)

    # Starlight Eyes
    for eye_x in (-0.055, 0.055):
        add_mesh_part(bpy.ops.mesh.primitive_ico_sphere_add, f"Vaelor_Eye_{eye_x}", "Head", mat_starlight,
                      subdivisions=1, radius=0.025, location=(eye_x, -0.18, 1.70))

    # Floating Astral Halo Ring
    add_mesh_part(bpy.ops.mesh.primitive_torus_add, "Vaelor_HaloRing", "HaloSocket", mat_starlight,
                  major_radius=0.48, minor_radius=0.035, location=(0, 0.15, 1.78))
    halo_obj = bpy.data.objects["Vaelor_HaloRing"]
    halo_obj.rotation_euler = (math.pi / 2, 0, 0)

    # Astral Scepter (Obsidian shaft + golden gimbal ring + levitating starlight gem)
    add_mesh_part(bpy.ops.mesh.primitive_cylinder_add, "Vaelor_StaffShaft", "StaffSocket", mat_obsidian,
                  vertices=8, radius=0.03, depth=1.8, location=(0.68, 0.1, 1.2))
    add_mesh_part(bpy.ops.mesh.primitive_torus_add, "Vaelor_StaffGimbal", "StaffSocket", mat_gold,
                  major_radius=0.18, minor_radius=0.022, location=(0.68, 0.1, 2.05))
    add_mesh_part(bpy.ops.mesh.primitive_ico_sphere_add, "Vaelor_StaffCrystal", "StaffSocket", mat_starlight,
                  subdivisions=1, radius=0.10, location=(0.68, 0.1, 2.05))

    # 3. Baked Animations
    ad = arm_obj.animation_data_create()
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='POSE')
    pbs = arm_obj.pose.bones
    for pb in pbs:
        pb.rotation_mode = 'XYZ'

    p_root = pbs["Root"]
    p_hips = pbs["Hips"]
    p_chest = pbs["Chest"]
    p_larm = pbs["LeftArm"]
    p_rarm = pbs["RightArm"]
    p_halo = pbs["HaloSocket"]
    p_staff = pbs["StaffSocket"]

    # ACTION 1: 'Idle' (Levitation floating and gentle halo spinning, 60 frames)
    act_idle = bpy.data.actions.new("Idle")
    ad.action = act_idle
    for frame, lev_z, sway_r, halo_rot in [
        (0,  0.0,   0.0,   0.0),
        (15, 0.08,  0.04,  math.pi * 0.5),
        (30, 0.12,  0.0,   math.pi * 1.0),
        (45, 0.06, -0.04,  math.pi * 1.5),
        (60, 0.0,   0.0,   math.pi * 2.0)
    ]:
        p_root.location = (0, 0, lev_z)
        p_root.keyframe_insert(data_path="location", frame=frame)
        p_chest.rotation_euler = (0, 0, sway_r)
        p_chest.keyframe_insert(data_path="rotation_euler", frame=frame)
        p_larm.rotation_euler = (0.1, 0, 0.08 + sway_r)
        p_larm.keyframe_insert(data_path="rotation_euler", frame=frame)
        p_rarm.rotation_euler = (-0.1, 0, -0.08 - sway_r)
        p_rarm.keyframe_insert(data_path="rotation_euler", frame=frame)
        p_halo.rotation_euler = (0, 0, halo_rot)
        p_halo.keyframe_insert(data_path="rotation_euler", frame=frame)

    track_idle = ad.nla_tracks.new()
    track_idle.name = "NLA_Idle"
    strip_idle = track_idle.strips.new("Idle", 0, act_idle)
    strip_idle.action_frame_start = 0
    strip_idle.action_frame_end = 60

    # ACTION 2: 'Cast' (Raising scepter and left hand summoning celestial beams, 45 frames)
    act_cast = bpy.data.actions.new("Cast")
    ad.action = act_cast
    for frame, r_arm_up, l_arm_up in [
        (0,  -0.1,  0.1),
        (15, -0.6, -0.5),
        (25, -1.1, -0.9),
        (35, -0.8, -0.6),
        (45, -0.1,  0.1)
    ]:
        p_rarm.rotation_euler = (r_arm_up, 0, -0.2)
        p_rarm.keyframe_insert(data_path="rotation_euler", frame=frame)
        p_larm.rotation_euler = (l_arm_up, 0, 0.2)
        p_larm.keyframe_insert(data_path="rotation_euler", frame=frame)
        p_staff.rotation_euler = (r_arm_up * 0.5, 0, 0)
        p_staff.keyframe_insert(data_path="rotation_euler", frame=frame)

    track_cast = ad.nla_tracks.new()
    track_cast.name = "NLA_Cast"
    strip_cast = track_cast.strips.new("Cast", 70, act_cast)
    strip_cast.action_frame_start = 0
    strip_cast.action_frame_end = 45

    # ACTION 3: 'Phase2_Invert' (Levitation surge with halo flare, 30 frames)
    act_phase2 = bpy.data.actions.new("Phase2_Invert")
    ad.action = act_phase2
    for frame, burst_z, tilt in [
        (0,  0.0, 0.0),
        (10, -0.1, 0.1),
        (20, 0.45, -0.25),
        (30, 0.35, 0.0)
    ]:
        p_root.location = (0, 0, burst_z)
        p_root.keyframe_insert(data_path="location", frame=frame)
        p_chest.rotation_euler = (tilt, 0, 0)
        p_chest.keyframe_insert(data_path="rotation_euler", frame=frame)
        p_halo.scale = (1.0 + burst_z * 0.5, 1.0 + burst_z * 0.5, 1.0 + burst_z * 0.5)
        p_halo.keyframe_insert(data_path="scale", frame=frame)

    track_p2 = ad.nla_tracks.new()
    track_p2.name = "NLA_Phase2"
    strip_p2 = track_p2.strips.new("Phase2", 125, act_phase2)
    strip_p2.action_frame_start = 0
    strip_p2.action_frame_end = 30

    # ACTION 4: 'Hit' (Stagger recoil, 20 frames)
    act_hit = bpy.data.actions.new("Hit")
    ad.action = act_hit
    for frame, recoil, hz in [
        (0,  0.0, 0.0),
        (6,  0.35, -0.1),
        (12, 0.15, -0.05),
        (20, 0.0, 0.0)
    ]:
        p_chest.rotation_euler = (recoil, 0, 0)
        p_chest.keyframe_insert(data_path="rotation_euler", frame=frame)
        p_root.location = (0, recoil * 0.2, hz)
        p_root.keyframe_insert(data_path="location", frame=frame)

    track_hit = ad.nla_tracks.new()
    track_hit.name = "NLA_Hit"
    strip_hit = track_hit.strips.new("Hit", 165, act_hit)
    strip_hit.action_frame_start = 0
    strip_hit.action_frame_end = 20

    # ACTION 5: 'Death' (Dissolution collapse, 40 frames)
    act_death = bpy.data.actions.new("Death")
    ad.action = act_death
    for frame, fall_z, collapse_scale in [
        (0,  0.0, 1.0),
        (15, -0.3, 0.8),
        (28, -0.7, 0.4),
        (40, -0.9, 0.05)
    ]:
        p_root.location = (0, 0, fall_z)
        p_root.keyframe_insert(data_path="location", frame=frame)
        p_root.scale = (collapse_scale, collapse_scale, collapse_scale)
        p_root.keyframe_insert(data_path="scale", frame=frame)

    track_death = ad.nla_tracks.new()
    track_death.name = "NLA_Death"
    strip_death = track_death.strips.new("Death", 195, act_death)
    strip_death.action_frame_start = 0
    strip_death.action_frame_end = 40

    bpy.ops.object.mode_set(mode='OBJECT')

    # Export GLB
    bpy.ops.object.select_all(action='SELECT')
    out_path = "C:/Development/findthewizard/threejs/public/assets/models/vaelor.glb"
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
    print(f"Successfully baked Duke Vaelor boss model to: {out_path}")

if __name__ == "__main__":
    build_vaelor()
