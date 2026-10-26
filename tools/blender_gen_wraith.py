"""Blender 5.2 generator for the Mirror Wraith (HM1 Hall of Mirrors Sentinel).
Generates: threejs/public/assets/models/mirror_wraith.glb
Features:
- Rigged spectral armature (Root, Torso, Head, LeftArm, RightArm, ShardOrbit)
- Tattered ethereal cloak, glowing amethyst spectral face, razor obsidian mirror claws, floating orbiting mirror shards
- Baked actions: 'Idle', 'Attack', 'Hit', 'Death'
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

def build_wraith():
    clear_scene()
    col = bpy.data.collections.new("MirrorWraith")
    bpy.context.scene.collection.children.link(col)

    # Materials
    mat_cowl = make_mat("Wraith_Cowl", (0.10, 0.04, 0.18, 1.0), roughness=0.45, metalness=0.15)
    mat_glow = make_mat("Wraith_Amethyst_Glow", (0.55, 0.15, 0.95, 1.0), roughness=0.15, metalness=0.05, emissive=(0.60, 0.20, 1.0, 1.0), strength=3.5)
    mat_glass = make_mat("Wraith_Mirror_Shards", (0.65, 0.75, 0.90, 1.0), roughness=0.12, metalness=0.85, emissive=(0.35, 0.55, 0.85, 1.0), strength=1.5)
    mat_claw = make_mat("Wraith_Glass_Claws", (0.15, 0.18, 0.25, 1.0), roughness=0.2, metalness=0.9)

    # 1. Armature
    arm_data = bpy.data.armatures.new("WraithRig")
    arm_obj = bpy.data.objects.new("WraithArmature", arm_data)
    col.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones

    root = eb.new("Root")
    root.head = (0, 0, 0)
    root.tail = (0, 0, 0.3)

    torso = eb.new("Torso")
    torso.parent = root
    torso.head = (0, 0, 0.6)
    torso.tail = (0, 0, 1.1)

    head = eb.new("Head")
    head.parent = torso
    head.head = (0, 0, 1.1)
    head.tail = (0, 0, 1.45)

    orbit = eb.new("ShardOrbit")
    orbit.parent = torso
    orbit.head = (0, 0, 0.85)
    orbit.tail = (0, 0, 1.05)

    l_arm = eb.new("LeftArm")
    l_arm.parent = torso
    l_arm.head = (-0.26, 0, 1.05)
    l_arm.tail = (-0.52, -0.15, 0.75)

    r_arm = eb.new("RightArm")
    r_arm.parent = torso
    r_arm.head = (0.26, 0, 1.05)
    r_arm.tail = (0.52, -0.15, 0.75)

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
    # Ghostly tapered lower cowl (whispy spectral vapor)
    add_part(bpy.ops.mesh.primitive_cone_add, "Wraith_PhantomCowl", "Torso", mat_cowl,
             vertices=8, radius1=0.48, radius2=0.18, depth=0.95, location=(0, 0, 0.55))

    # Upper Cowl & Hood
    add_part(bpy.ops.mesh.primitive_ico_sphere_add, "Wraith_HoodMesh", "Head", mat_cowl,
             subdivisions=2, radius=0.22, location=(0, 0, 1.25))

    # Glowing Hollow Face & Eyes
    add_part(bpy.ops.mesh.primitive_cube_add, "Wraith_InnerVisage", "Head", mat_glow,
             size=1.0, location=(0, -0.12, 1.25))
    v_obj = bpy.data.objects["Wraith_InnerVisage"]
    v_obj.scale = (0.16, 0.05, 0.18)

    for ex in (-0.05, 0.05):
        add_part(bpy.ops.mesh.primitive_ico_sphere_add, f"Wraith_Eye_{ex}", "Head", mat_glow,
                 subdivisions=1, radius=0.032, location=(ex, -0.16, 1.28))

    # Arms & Razor Mirror Claws
    for side, sx in (("Left", -1), ("Right", 1)):
        add_part(bpy.ops.mesh.primitive_cone_add, f"Wraith_Sleeve_{side}", f"{side}Arm", mat_cowl,
                 vertices=7, radius1=0.14, radius2=0.06, depth=0.48, location=(sx * 0.38, -0.06, 0.92))
        s_obj = bpy.data.objects[f"Wraith_Sleeve_{side}"]
        s_obj.rotation_euler = (math.pi / 4, 0, sx * 0.2)

        # 3 Curved mirror claws at hand
        for ci in range(3):
            cz = -0.04 + ci * 0.04
            add_part(bpy.ops.mesh.primitive_cone_add, f"Wraith_Claw_{side}_{ci}", f"{side}Arm", mat_claw,
                     vertices=4, radius1=0.022, radius2=0.004, depth=0.18, location=(sx * 0.52 + sx * cz, -0.22, 0.74))
            c_obj = bpy.data.objects[f"Wraith_Claw_{side}_{ci}"]
            c_obj.rotation_euler = (math.pi / 2.2, 0, sx * math.pi / 4)

    # 4 Orbiting Mirror Shards
    for si in range(4):
        sangle = (2 * math.pi / 4) * si
        sx = math.cos(sangle) * 0.52
        sy = math.sin(sangle) * 0.52
        add_part(bpy.ops.mesh.primitive_cube_add, f"Wraith_Shard_{si}", "ShardOrbit", mat_glass,
                 size=1.0, location=(sx, sy, 0.9))
        sh_obj = bpy.data.objects[f"Wraith_Shard_{si}"]
        sh_obj.scale = (0.02, 0.12, 0.18)
        sh_obj.rotation_euler = (0.2, sangle, math.pi / 6)

    # 3. Animations
    ad = arm_obj.animation_data_create()
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='POSE')
    pbs = arm_obj.pose.bones
    for pb in pbs:
        pb.rotation_mode = 'XYZ'

    p_root = pbs["Root"]
    p_torso = pbs["Torso"]
    p_larm = pbs["LeftArm"]
    p_rarm = pbs["RightArm"]
    p_orbit = pbs["ShardOrbit"]

    # ACTION 1: 'Idle' (Spectral levitation, undulating cowl, mirror shards spinning, 60 frames)
    act_idle = bpy.data.actions.new("Idle")
    ad.action = act_idle
    for frame, bob_z, sway_x, orbit_rot in [
        (0,  0.0,   0.0,  0.0),
        (15, 0.08,  0.06, math.pi * 0.5),
        (30, 0.12,  0.0,  math.pi * 1.0),
        (45, 0.06, -0.06, math.pi * 1.5),
        (60, 0.0,   0.0,  math.pi * 2.0)
    ]:
        p_root.location = (0, 0, bob_z)
        p_root.keyframe_insert(data_path="location", frame=frame)
        p_torso.rotation_euler = (sway_x * 0.5, 0, sway_x)
        p_torso.keyframe_insert(data_path="rotation_euler", frame=frame)
        p_orbit.rotation_euler = (0, 0, orbit_rot)
        p_orbit.keyframe_insert(data_path="rotation_euler", frame=frame)

    track_idle = ad.nla_tracks.new()
    track_idle.name = "NLA_Idle"
    strip_idle = track_idle.strips.new("Idle", 0, act_idle)
    strip_idle.action_frame_start = 0
    strip_idle.action_frame_end = 60

    # ACTION 2: 'Attack' (Lunging double-claw slash, 30 frames)
    act_atk = bpy.data.actions.new("Attack")
    ad.action = act_atk
    for frame, fwd_y, slash_rot in [
        (0,  0.0,  0.0),
        (10, 0.25, 0.6),
        (18, -0.65, -0.85),
        (24, -0.35, -0.40),
        (30, 0.0,  0.0)
    ]:
        p_root.location = (0, fwd_y, -fwd_y * 0.2)
        p_root.keyframe_insert(data_path="location", frame=frame)
        p_larm.rotation_euler = (slash_rot, -slash_rot * 0.4, 0)
        p_larm.keyframe_insert(data_path="rotation_euler", frame=frame)
        p_rarm.rotation_euler = (slash_rot, slash_rot * 0.4, 0)
        p_rarm.keyframe_insert(data_path="rotation_euler", frame=frame)

    track_atk = ad.nla_tracks.new()
    track_atk.name = "NLA_Attack"
    strip_atk = track_atk.strips.new("Attack", 70, act_atk)
    strip_atk.action_frame_start = 0
    strip_atk.action_frame_end = 30

    # ACTION 3: 'Hit' (Spectral stagger / flicker, 20 frames)
    act_hit = bpy.data.actions.new("Hit")
    ad.action = act_hit
    for frame, recoil_y in [(0, 0.0), (6, 0.35), (12, 0.15), (20, 0.0)]:
        p_root.location = (0, recoil_y, -0.05)
        p_root.keyframe_insert(data_path="location", frame=frame)
        p_torso.rotation_euler = (recoil_y * 0.8, 0, 0)
        p_torso.keyframe_insert(data_path="rotation_euler", frame=frame)

    track_hit = ad.nla_tracks.new()
    track_hit.name = "NLA_Hit"
    strip_hit = track_hit.strips.new("Hit", 110, act_hit)
    strip_hit.action_frame_start = 0
    strip_hit.action_frame_end = 20

    # ACTION 4: 'Death' (Shattering collapse, 35 frames)
    act_death = bpy.data.actions.new("Death")
    ad.action = act_death
    for frame, sink_z, scale in [(0, 0.0, 1.0), (12, -0.2, 0.75), (25, -0.5, 0.35), (35, -0.7, 0.05)]:
        p_root.location = (0, 0, sink_z)
        p_root.keyframe_insert(data_path="location", frame=frame)
        p_root.scale = (scale, scale, scale)
        p_root.keyframe_insert(data_path="scale", frame=frame)

    track_death = ad.nla_tracks.new()
    track_death.name = "NLA_Death"
    strip_death = track_death.strips.new("Death", 140, act_death)
    strip_death.action_frame_start = 0
    strip_death.action_frame_end = 35

    bpy.ops.object.mode_set(mode='OBJECT')

    # Export GLB
    bpy.ops.object.select_all(action='SELECT')
    out_path = "C:/Development/findthewizard/threejs/public/assets/models/mirror_wraith.glb"
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
    print(f"Successfully baked Mirror Wraith model to: {out_path}")

if __name__ == "__main__":
    build_wraith()
