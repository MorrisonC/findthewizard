import bpy
import math

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for col in list(bpy.data.collections):
        bpy.data.collections.remove(col)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)

def make_material(name, base_color, roughness=0.5, metalness=0.0, emissive=None, emissive_intensity=1.0):
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

def build_ag1():
    clear_scene()
    col = bpy.data.collections.new("AG1_Tree")
    bpy.context.scene.collection.children.link(col)

    # Materials
    mat_bark = make_material("AncientBark", (0.08, 0.06, 0.04, 1.0), roughness=0.92, metalness=0.0)
    mat_heartwood = make_material("InnerHeartwood", (0.18, 0.10, 0.05, 1.0), roughness=0.75, metalness=0.0)
    mat_moss = make_material("StarlightMoss", (0.04, 0.18, 0.08, 1.0), roughness=0.88, metalness=0.0)
    mat_eye_ring = make_material("EyeRings", (0.05, 0.25, 0.35, 1.0), roughness=0.3, metalness=0.2, emissive=(0.02, 0.45, 0.65, 1.0), emissive_intensity=1.8)
    mat_eye_core = make_material("EyeCoreStarlight", (0.2, 0.8, 1.0, 1.0), roughness=0.1, emissive=(0.3, 0.88, 1.0, 1.0), emissive_intensity=3.5)
    mat_thorn = make_material("BrambleThorn", (0.12, 0.04, 0.08, 1.0), roughness=0.6, metalness=0.1)

    # In Blender: Y = -glTF_Z. Three.js trunk is at tz = -2.8, so tree_y = +2.8.
    tree_y = 2.8

    # --- 1. Ancient Heartwood Trunk ---
    # Stacked, twisted trunk tiers for gnarled organic form
    trunk_tiers = [
        {"z": 0.5, "r1": 1.6, "r2": 1.3, "h": 1.0, "rot": 5},
        {"z": 1.4, "r1": 1.3, "r2": 1.05, "h": 1.0, "rot": -8},
        {"z": 2.3, "r1": 1.05, "r2": 0.88, "h": 1.0, "rot": 12},
        {"z": 3.2, "r1": 0.88, "r2": 0.72, "h": 1.0, "rot": -6},
        {"z": 4.1, "r1": 0.72, "r2": 0.55, "h": 1.0, "rot": 15},
    ]

    for idx, tier in enumerate(trunk_tiers):
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=14,
            radius=tier["r1"],
            depth=tier["h"],
            location=(math.sin(idx * 0.4) * 0.12, tree_y + math.cos(idx * 0.4) * 0.08, tier["z"])
        )
        t_mesh = bpy.context.active_object
        t_mesh.name = f"TrunkTier_{idx}"
        t_mesh.rotation_euler = (0, 0, math.radians(tier["rot"]))
        t_mesh.scale = (1.0 + (idx % 2)*0.15, 1.0 - (idx % 2)*0.1, 1.0)
        bpy.ops.object.transform_apply(scale=True, rotation=True)
        t_mesh.data.materials.append(mat_bark)

    # --- 2. Gnarled Buttress Roots (Radial Coils) ---
    root_angles = [0, 45, 90, 140, 195, 250, 305]
    for idx, angle in enumerate(root_angles):
        rad = math.radians(angle)
        rx = math.cos(rad) * 1.5
        ry = math.sin(rad) * 1.5

        # Root ridge
        bpy.ops.mesh.primitive_cone_add(
            vertices=8,
            radius1=0.45,
            radius2=0.08,
            depth=2.2,
            location=(rx, tree_y + ry, 0.45)
        )
        root = bpy.context.active_object
        root.name = f"ButtressRoot_{idx}"
        root.rotation_euler = (
            math.radians(math.sin(rad) * 45),
            math.radians(-math.cos(rad) * 45),
            rad + math.radians(15)
        )
        bpy.ops.object.transform_apply(rotation=True)
        root.data.materials.append(mat_bark)

    # --- 3. Spreading Lateral Branch Canopies ---
    branch_specs = [
        {"angle": 30, "z": 4.2, "len": 2.4, "pitch": 35},
        {"angle": 120, "z": 4.0, "len": 2.2, "pitch": 40},
        {"angle": 210, "z": 4.3, "len": 2.6, "pitch": 30},
        {"angle": 300, "z": 4.1, "len": 2.3, "pitch": 38},
    ]

    for idx, b in enumerate(branch_specs):
        rad = math.radians(b["angle"])
        bx = math.cos(rad) * (b["len"] * 0.45)
        by = math.sin(rad) * (b["len"] * 0.45)
        bz = b["z"] + math.sin(math.radians(b["pitch"])) * (b["len"] * 0.45)

        bpy.ops.mesh.primitive_cylinder_add(
            vertices=10,
            radius=0.28,
            depth=b["len"],
            location=(bx, tree_y + by, bz)
        )
        branch = bpy.context.active_object
        branch.name = f"CanopyBranch_{idx}"
        branch.rotation_euler = (
            math.radians(math.sin(rad) * b["pitch"]),
            math.radians(-math.cos(rad) * b["pitch"]),
            rad
        )
        bpy.ops.object.transform_apply(rotation=True)
        branch.data.materials.append(mat_bark)

        # Moss / Foliage cluster at branch tip
        tip_x = math.cos(rad) * (b["len"] * 0.95)
        tip_y = math.sin(rad) * (b["len"] * 0.95)
        tip_z = b["z"] + math.sin(math.radians(b["pitch"])) * (b["len"] * 0.95)
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=0.75,
            location=(tip_x, tree_y + tip_y, tip_z)
        )
        foliage = bpy.context.active_object
        foliage.name = f"StarlightFoliage_{idx}"
        foliage.scale = (1.4, 1.4, 0.7)
        bpy.ops.object.transform_apply(scale=True)
        foliage.data.materials.append(mat_moss)

    # --- 4. Central Starlight Eye of Yggdra (South Face of Trunk towards player) ---
    # Facing player: in Three.js tz = -1.85, so Blender by = +1.85
    eye_loc = (0.0, tree_y - 0.95, 2.35)
    # Bark Hollow Aperture
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.48,
        minor_radius=0.14,
        location=eye_loc
    )
    aperture = bpy.context.active_object
    aperture.name = "EyeAperture"
    aperture.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    aperture.data.materials.append(mat_heartwood)

    # Concentric Sacred Ring
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.32,
        minor_radius=0.06,
        location=(eye_loc[0], eye_loc[1] - 0.03, eye_loc[2])
    )
    ring = bpy.context.active_object
    ring.name = "EyeConcentricRing"
    ring.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    ring.data.materials.append(mat_eye_ring)

    # Pulsing Starlight Eye Iris & Core
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=0.22,
        location=(eye_loc[0], eye_loc[1] - 0.06, eye_loc[2])
    )
    eye_core = bpy.context.active_object
    eye_core.name = "EyeCoreStarlight"
    eye_core.scale = (1.0, 0.5, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    eye_core.data.materials.append(mat_eye_core)

    # --- 5. Thorny Root Wall Barrier (Blocking North Gate at tz = -5.0) ---
    # In Blender: by = -(-5.0) = +5.0
    wall_y = 5.0
    for ti in range(8):
        tx = -1.8 + ti * 0.52
        tz = 1.1 + math.sin(ti * 0.9) * 0.35
        bpy.ops.mesh.primitive_cone_add(
            vertices=8,
            radius1=0.22,
            radius2=0.04,
            depth=2.4,
            location=(tx, wall_y, tz)
        )
        thorn_bar = bpy.context.active_object
        thorn_bar.name = f"RootWallBar_{ti}"
        thorn_bar.rotation_euler = (
            math.radians(math.sin(ti)*20),
            math.radians(math.cos(ti)*25),
            math.radians(15 if ti % 2 == 0 else -15)
        )
        bpy.ops.object.transform_apply(rotation=True)
        thorn_bar.data.materials.append(mat_thorn)

        # Secondary sharp barbs
        for bi in [-0.4, 0.4]:
            bpy.ops.mesh.primitive_cone_add(
                vertices=6,
                radius1=0.06,
                radius2=0.01,
                depth=0.35,
                location=(tx + (0.15 if bi > 0 else -0.15), wall_y + bi*0.3, tz + bi)
            )
            barb = bpy.context.active_object
            barb.rotation_euler = (math.radians(45), math.radians(-30), 0)
            bpy.ops.object.transform_apply(rotation=True)
            barb.data.materials.append(mat_thorn)

    # Export to GLB
    output_path = r"c:\Development\findthewizard\threejs\public\assets\models\ag1_tree.glb"
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True
    )
    print("SUCCESS_EXPORT_AG1:", output_path)

if __name__ == "__main__":
    build_ag1()
