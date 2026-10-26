"""Blender 5.2 generator for the VEILKEEP Moonlit Briar / Photophobic Veil Bramble.
Author: Antigravity
Generates: threejs/public/assets/models/veil_bramble.glb with:
- Deep twilight violet thorn vines, root claws, and luminescent amethyst bud core
- Armature with Root, Core, and Vine bones
- Baked 'Idle' (swaying, pulsing breathing loop) and 'Retract' (photophobic cower/flatten into floor) animations
"""
import bpy
import math
from mathutils import Vector, Euler, Matrix

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for col in list(bpy.data.collections):
        bpy.data.collections.remove(col)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)
    for arm in list(bpy.data.armatures):
        bpy.data.armatures.remove(arm)
    for act in list(bpy.data.actions):
        bpy.data.actions.remove(act)

def make_material(name, base_color, roughness=0.6, metalness=0.1, emissive=None, emissive_intensity=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = base_color
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Metallic'].default_value = metalness
        if emissive:
            if 'Emission Color' in bsdf.inputs:
                bsdf.inputs['Emission Color'].default_value = emissive
                bsdf.inputs['Emission Strength'].default_value = emissive_intensity
            elif 'Emission' in bsdf.inputs:
                bsdf.inputs['Emission'].default_value = emissive
    return mat

def create_bramble():
    clear_scene()
    col = bpy.data.collections.new("VeilBramble")
    bpy.context.scene.collection.children.link(col)

    # Materials
    # Dark thorny vine bark (deep twilight purple-charcoal)
    mat_bark = make_material("VK_Bramble_Bark", (0.11, 0.07, 0.18, 1.0), roughness=0.72, metalness=0.15)
    # Sharp thorn spines (dark metallic violet)
    mat_thorns = make_material("VK_Bramble_Thorns", (0.22, 0.10, 0.32, 1.0), roughness=0.35, metalness=0.55)
    # Luminous Amethyst buds / petals (vibrant royal purple with violet glow)
    mat_amethyst = make_material("VK_Veil_Amethyst", (0.42, 0.12, 0.75, 1.0), roughness=0.25, metalness=0.1, emissive=(0.55, 0.18, 0.95, 1.0), emissive_intensity=2.4)
    # Photophobic Starlight Core (pulsing brilliant magenta-crystal)
    mat_core = make_material("VK_Veil_Core", (0.75, 0.45, 0.98, 1.0), roughness=0.12, metalness=0.05, emissive=(0.85, 0.40, 1.0, 1.0), emissive_intensity=3.6)
    # Spreading Root Claws on flagstone floor
    mat_roots = make_material("VK_Bramble_Roots", (0.07, 0.05, 0.10, 1.0), roughness=0.85, metalness=0.1)

    # --- 1. Create Armature ---
    arm_data = bpy.data.armatures.new("BrambleRig")
    arm_obj = bpy.data.objects.new("BrambleArmature", arm_data)
    col.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='EDIT')

    # Root bone
    root_bone = arm_data.edit_bones.new("Root")
    root_bone.head = (0, 0, 0)
    root_bone.tail = (0, 0, 0.15)

    # Core bone (controls central glowing heart)
    core_bone = arm_data.edit_bones.new("Core")
    core_bone.parent = root_bone
    core_bone.head = (0, 0, 0.15)
    core_bone.tail = (0, 0, 0.45)

    # 5 Vine branch bones radiating outward
    vine_bones = []
    num_vines = 5
    vine_radius = 0.55
    vine_height = 0.75
    for i in range(num_vines):
        angle = (2 * math.pi / num_vines) * i
        v_name = f"Vine_{i+1:02d}"
        vb = arm_data.edit_bones.new(v_name)
        vb.parent = root_bone
        vx = math.cos(angle) * (vine_radius * 0.4)
        vy = math.sin(angle) * (vine_radius * 0.4)
        vb.head = (vx, vy, 0.12)
        tx = math.cos(angle) * vine_radius
        ty = math.sin(angle) * vine_radius
        vb.tail = (tx, ty, vine_height)
        vine_bones.append(v_name)

    bpy.ops.object.mode_set(mode='OBJECT')

    # --- 2. Create Meshes & Parent to Bones ---
    created_meshes = []

    # A. Root Base (Spreading tentacles along stone)
    for ri in range(8):
        rangle = (2 * math.pi / 8) * ri + 0.18
        rx = math.cos(rangle) * 0.65
        ry = math.sin(rangle) * 0.65
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.045, depth=0.7, location=(rx * 0.5, ry * 0.5, 0.025))
        root_seg = bpy.context.active_object
        root_seg.name = f"RootTendril_{ri}"
        root_seg.rotation_euler = (math.pi / 2 - 0.05, 0, rangle + math.pi / 2)
        root_seg.data.materials.append(mat_roots)
        root_seg.parent = arm_obj
        root_seg.parent_type = 'BONE'
        root_seg.parent_bone = "Root"
        created_meshes.append(root_seg)

    # B. Central Amethyst Core (Dodecahedron-shaped crystal)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.22, location=(0, 0, 0.28))
    core_mesh = bpy.context.active_object
    core_mesh.name = "BrambleCore"
    core_mesh.data.materials.append(mat_core)
    core_mesh.parent = arm_obj
    core_mesh.parent_type = 'BONE'
    core_mesh.parent_bone = "Core"
    created_meshes.append(core_mesh)

    # Surrounding inner Amethyst Petals / Shards
    for pi in range(6):
        pangle = (2 * math.pi / 6) * pi
        px = math.cos(pangle) * 0.16
        py = math.sin(pangle) * 0.16
        bpy.ops.mesh.primitive_cone_add(vertices=5, radius1=0.07, radius2=0.01, depth=0.22, location=(px, py, 0.32))
        shard = bpy.context.active_object
        shard.name = f"CoreShard_{pi}"
        shard.rotation_euler = (0.35 * math.sin(pangle), -0.35 * math.cos(pangle), pangle)
        shard.data.materials.append(mat_amethyst)
        shard.parent = arm_obj
        shard.parent_type = 'BONE'
        shard.parent_bone = "Core"
        created_meshes.append(shard)

    # C. Vine Stalks & Protruding Thorns
    for vi, v_name in enumerate(vine_bones):
        angle = (2 * math.pi / num_vines) * vi
        # Vine stalk
        bpy.ops.mesh.primitive_cylinder_add(vertices=7, radius=0.055, depth=0.68, location=(0, 0, 0))
        stalk = bpy.context.active_object
        stalk.name = f"VineStalk_{vi+1:02d}"
        stalk.data.materials.append(mat_bark)
        # Position relative to bone
        stalk.parent = arm_obj
        stalk.parent_type = 'BONE'
        stalk.parent_bone = v_name
        # Center mesh along bone length
        stalk.location = (0, 0, 0.34)
        created_meshes.append(stalk)

        # 3 Curved Thorns per stalk
        for ti in range(3):
            tz = 0.18 + ti * 0.18
            bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.035, radius2=0.005, depth=0.14, location=(0, 0, 0))
            thorn = bpy.context.active_object
            thorn.name = f"Thorn_{vi+1:02d}_{ti}"
            thorn.data.materials.append(mat_thorns)
            thorn.parent = arm_obj
            thorn.parent_type = 'BONE'
            thorn.parent_bone = v_name
            thorn_side = 1 if ti % 2 == 0 else -1
            thorn.location = (0.045 * thorn_side, 0.02, tz)
            thorn.rotation_euler = (0, math.pi / 2.6 * thorn_side, math.pi / 4)
            created_meshes.append(thorn)

        # Violet Bud at tip of vine
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.08, location=(0, 0, 0))
        bud = bpy.context.active_object
        bud.name = f"VineBud_{vi+1:02d}"
        bud.data.materials.append(mat_amethyst)
        bud.parent = arm_obj
        bud.parent_type = 'BONE'
        bud.parent_bone = v_name
        bud.location = (0, 0, 0.68)
        created_meshes.append(bud)

    # --- 3. Keyframe Animations on Armature ---
    # Ensure animation data exists
    if not arm_obj.animation_data:
        arm_obj.animation_data_create()

    # ACTION 1: 'Idle' (60 frames @ 30fps = 2.0s looping organic sway and core pulse)
    act_idle = bpy.data.actions.new(name="Idle")
    arm_obj.animation_data.action = act_idle
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='POSE')

    core_pbone = arm_obj.pose.bones["Core"]
    core_pbone.rotation_mode = 'XYZ'
    vine_pbones = [arm_obj.pose.bones[vn] for vn in vine_bones]
    for vb in vine_pbones:
        vb.rotation_mode = 'XYZ'

    for frame, pulse_scale, pulse_z, sway_amp in [
        (0,  1.00, 0.0, 0.0),
        (15, 1.10, 0.03, 0.07),
        (30, 0.98, -0.01, -0.05),
        (45, 1.06, 0.02, 0.04),
        (60, 1.00, 0.0, 0.0)
    ]:
        bpy.context.scene.frame_set(frame)
        # Core pulsing
        core_pbone.scale = Vector((pulse_scale, pulse_scale, pulse_scale * 1.05))
        core_pbone.location = Vector((0, 0, pulse_z))
        core_pbone.keyframe_insert(data_path="scale", frame=frame)
        core_pbone.keyframe_insert(data_path="location", frame=frame)

        # Vine swaying
        for vi, vbone in enumerate(vine_pbones):
            phase = (vi * math.pi / 2.5)
            rx = sway_amp * math.sin(phase)
            ry = sway_amp * math.cos(phase)
            vbone.rotation_euler = Euler((rx, ry, 0), 'XYZ')
            vbone.keyframe_insert(data_path="rotation_euler", frame=frame)

    # Push Idle action to NLA track
    track_idle = arm_obj.animation_data.nla_tracks.new()
    track_idle.name = "NLA_Idle"
    strip_idle = track_idle.strips.new("Idle", 0, act_idle)
    strip_idle.action_frame_start = 0
    strip_idle.action_frame_end = 60

    # ACTION 2: 'Retract' (30 frames @ 30fps = 1.0s photophobic cower into floor)
    act_retract = bpy.data.actions.new(name="Retract")
    arm_obj.animation_data.action = act_retract

    for frame, cower_factor in [
        (0,  0.0),
        (8,  0.35),
        (18, 0.75),
        (30, 1.0)
    ]:
        bpy.context.scene.frame_set(frame)
        # When fully cowered (cower_factor = 1.0), core shrinks and flattens into ground
        c_scale = 1.0 - cower_factor * 0.78
        c_z = -cower_factor * 0.22
        core_pbone.scale = Vector((c_scale * 0.7, c_scale * 0.7, c_scale * 0.35))
        core_pbone.location = Vector((0, 0, c_z))
        core_pbone.keyframe_insert(data_path="scale", frame=frame)
        core_pbone.keyframe_insert(data_path="location", frame=frame)

        # Vines curl down flat against the stones
        for vi, vbone in enumerate(vine_pbones):
            angle = (2 * math.pi / num_vines) * vi
            # Curl inward and flatten Y/Z
            curl_rot = cower_factor * (math.pi / 2.8)
            vbone.rotation_euler = Euler((curl_rot, -curl_rot * 0.4, 0), 'XYZ')
            v_sz = 1.0 - cower_factor * 0.82
            v_sxy = 1.0 - cower_factor * 0.45
            vbone.scale = Vector((v_sxy, v_sxy, v_sz))
            vbone.keyframe_insert(data_path="rotation_euler", frame=frame)
            vbone.keyframe_insert(data_path="scale", frame=frame)

    # Push Retract action to NLA track
    track_retract = arm_obj.animation_data.nla_tracks.new()
    track_retract.name = "NLA_Retract"
    strip_retract = track_retract.strips.new("Retract", 70, act_retract)
    strip_retract.action_frame_start = 0
    strip_retract.action_frame_end = 30

    bpy.ops.object.mode_set(mode='OBJECT')

    # Select all objects for export
    bpy.ops.object.select_all(action='SELECT')
    out_path = "C:/Development/findthewizard/threejs/public/assets/models/veil_bramble.glb"
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
    print(f"Successfully baked Veil Bramble model with Idle & Retract animations to: {out_path}")

if __name__ == "__main__":
    create_bramble()
