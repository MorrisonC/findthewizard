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

def build_mh1():
    clear_scene()
    col = bpy.data.collections.new("MH1_Hearth")
    bpy.context.scene.collection.children.link(col)

    # Materials
    mat_brick = make_material("VictorianBrick", (0.35, 0.12, 0.08, 1.0), roughness=0.88, metalness=0.0)
    mat_stone = make_material("CarvedAshlar", (0.45, 0.42, 0.38, 1.0), roughness=0.65, metalness=0.05)
    mat_soot = make_material("SootyFirebox", (0.05, 0.04, 0.04, 1.0), roughness=0.98, metalness=0.0)
    mat_iron = make_material("CastIronKettle", (0.08, 0.08, 0.09, 1.0), roughness=0.35, metalness=0.85)
    mat_wood = make_material("AgedWalnut", (0.22, 0.10, 0.04, 1.0), roughness=0.55, metalness=0.0)
    mat_ember = make_material("GlowingEmbers", (1.0, 0.32, 0.05, 1.0), roughness=0.3, emissive=(1.0, 0.40, 0.08, 1.0), emissive_intensity=3.5)

    doll_colors = [
        (0.92, 0.45, 0.55, 1.0), # Rose
        (0.40, 0.78, 0.65, 1.0), # Peppermint
        (0.68, 0.52, 0.88, 1.0), # Spun Violet
        (0.95, 0.82, 0.35, 1.0), # Lemon Curd
        (0.32, 0.55, 0.88, 1.0), # Royal Cobalt
        (0.90, 0.88, 0.80, 1.0), # Marzipan White
    ]
    doll_mats = [make_material(f"PorcelainDoll_{i}", col, roughness=0.22, metalness=0.1) for i, col in enumerate(doll_colors)]
    mat_doll_face = make_material("PorcelainFace", (0.98, 0.94, 0.90, 1.0), roughness=0.18, metalness=0.05)

    # In Blender: Y = -glTF_Z. Three.js North wall is at tz = -4.8, so hearth_y = +4.8.
    hearth_y = 4.8

    # --- 1. Victorian Brick Hearth Fireplace ---
    # Brick Fireplace Chimney Breast / Exterior (Back against North wall)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, hearth_y + 0.15, 1.4))
    chimney = bpy.context.active_object
    chimney.name = "ChimneyBreast"
    chimney.scale = (2.8, 0.8, 2.6)
    bpy.ops.object.transform_apply(scale=True)
    chimney.data.materials.append(mat_brick)

    # Firebox Cavity (Hollowed Chamber opening south towards room)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, hearth_y - 0.05, 0.85))
    firebox = bpy.context.active_object
    firebox.name = "FireboxSoot"
    firebox.scale = (1.6, 0.75, 1.45)
    bpy.ops.object.transform_apply(scale=True)
    firebox.data.materials.append(mat_soot)

    # Hearth Base Stone Apron (Extending into room at tz = -4.4, so by = +4.4)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, hearth_y - 0.4, 0.06))
    apron = bpy.context.active_object
    apron.name = "HearthApron"
    apron.scale = (3.2, 1.1, 0.12)
    bpy.ops.object.transform_apply(scale=True)
    apron.data.materials.append(mat_stone)

    # Fluted Pilasters (Left & Right Columns)
    for px in [-1.15, 1.15]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.14, depth=1.8, location=(px, hearth_y - 0.22, 1.0))
        pilaster = bpy.context.active_object
        pilaster.name = f"Pilaster_{px}"
        pilaster.data.materials.append(mat_stone)

        # Corbel Capital
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(px, hearth_y - 0.22, 1.95))
        corbel = bpy.context.active_object
        corbel.scale = (0.35, 0.35, 0.15)
        bpy.ops.object.transform_apply(scale=True)
        corbel.data.materials.append(mat_stone)

    # Carved Mantelpiece Top Shelf
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, hearth_y - 0.22, 2.08))
    mantel = bpy.context.active_object
    mantel.name = "MantelpieceTop"
    mantel.scale = (3.2, 0.65, 0.14)
    bpy.ops.object.transform_apply(scale=True)
    mantel.data.materials.append(mat_stone)

    # Burning Hearth Logs & Glowing Embers
    for li, lx in enumerate([-0.35, 0.0, 0.35]):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=0.7, location=(lx, hearth_y - 0.1, 0.18))
        log = bpy.context.active_object
        log.name = f"HearthLog_{li}"
        log.rotation_euler = (math.radians(90), math.radians(15 if li == 1 else -20), 0)
        bpy.ops.object.transform_apply(rotation=True)
        log.data.materials.append(mat_soot)

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.25, location=(0, hearth_y - 0.1, 0.16))
    ember = bpy.context.active_object
    ember.name = "HearthEmberCore"
    ember.scale = (1.5, 0.8, 0.5)
    bpy.ops.object.transform_apply(scale=True)
    ember.data.materials.append(mat_ember)

    # --- 2. Hanging Cast-Iron Kettle (Hanging at tz = -4.4, so by = +4.4) ---
    kettle_loc = (0, hearth_y - 0.4, 0.62)
    # Pot belly
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.28, location=kettle_loc)
    pot = bpy.context.active_object
    pot.name = "KettlePotBelly"
    pot.scale = (1.0, 1.0, 0.85)
    bpy.ops.object.transform_apply(scale=True)
    pot.data.materials.append(mat_iron)

    # Kettle Flared Rim & Lid
    bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=0.06, location=(kettle_loc[0], kettle_loc[1], kettle_loc[2] + 0.22))
    rim = bpy.context.active_object
    rim.name = "KettleRim"
    rim.data.materials.append(mat_iron)

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.035, location=(kettle_loc[0], kettle_loc[1], kettle_loc[2] + 0.28))
    lid_knob = bpy.context.active_object
    lid_knob.name = "KettleLidKnob"
    lid_knob.data.materials.append(mat_iron)

    # Pour Spout
    bpy.ops.mesh.primitive_cone_add(radius1=0.06, radius2=0.025, depth=0.22, location=(kettle_loc[0] - 0.25, kettle_loc[1], kettle_loc[2] + 0.10))
    spout = bpy.context.active_object
    spout.name = "KettleSpout"
    spout.rotation_euler = (0, math.radians(-50), 0)
    bpy.ops.object.transform_apply(rotation=True)
    spout.data.materials.append(mat_iron)

    # Arching swing handle
    bpy.ops.mesh.primitive_torus_add(major_radius=0.22, minor_radius=0.02, location=(kettle_loc[0], kettle_loc[1], kettle_loc[2] + 0.25))
    handle = bpy.context.active_object
    handle.name = "KettleHandle"
    handle.scale = (1.0, 0.15, 1.2)
    bpy.ops.object.transform_apply(scale=True)
    handle.data.materials.append(mat_iron)

    # Iron suspension chain to chimney ceiling
    bpy.ops.mesh.primitive_cylinder_add(radius=0.015, depth=0.9, location=(kettle_loc[0], kettle_loc[1], kettle_loc[2] + 0.9))
    chain = bpy.context.active_object
    chain.name = "KettleChain"
    chain.data.materials.append(mat_iron)

    # --- 3. Dollhouse Shelf & 6 Miniature Porcelain Dolls ---
    # Positioned on West Wall: tx = -4.5, tz = 0.0 -> bx = -4.5, by = 0.0
    shelf_loc = (-4.4, 0.0, 0.85)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=shelf_loc)
    shelf = bpy.context.active_object
    shelf.name = "DollShelf"
    shelf.scale = (0.35, 2.6, 0.06)
    bpy.ops.object.transform_apply(scale=True)
    shelf.data.materials.append(mat_wood)

    # Wall brackets under shelf
    for by in [-0.95, 0.95]:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(shelf_loc[0], shelf_loc[1] + by, shelf_loc[2] - 0.15))
        bracket = bpy.context.active_object
        bracket.name = f"ShelfBracket_{by}"
        bracket.scale = (0.28, 0.06, 0.24)
        bpy.ops.object.transform_apply(scale=True)
        bracket.data.materials.append(mat_wood)

    # 6 Miniature Porcelain Dolls along Y (-1.0 to 1.0)
    doll_ys = [-1.0, -0.6, -0.2, 0.2, 0.6, 1.0]
    for idx, dy in enumerate(doll_ys):
        doll_x = shelf_loc[0]
        doll_y = shelf_loc[1] + dy
        doll_z = shelf_loc[2] + 0.03

        # Bell Skirt / Gown
        bpy.ops.mesh.primitive_cone_add(radius1=0.09, radius2=0.03, depth=0.24, location=(doll_x, doll_y, doll_z + 0.12))
        skirt = bpy.context.active_object
        skirt.name = f"DollSkirt_{idx}"
        skirt.data.materials.append(doll_mats[idx])

        # Bodice & Arms
        bpy.ops.mesh.primitive_cylinder_add(radius=0.035, depth=0.09, location=(doll_x, doll_y, doll_z + 0.27))
        bodice = bpy.context.active_object
        bodice.name = f"DollBodice_{idx}"
        bodice.data.materials.append(doll_mats[idx])

        # Porcelain Head
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.04, location=(doll_x, doll_y, doll_z + 0.35))
        head = bpy.context.active_object
        head.name = f"DollHead_{idx}"
        head.data.materials.append(mat_doll_face)

        # Hair bonnet / curls
        bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=0.025, location=(doll_x, doll_y, doll_z + 0.38))
        bonnet = bpy.context.active_object
        bonnet.name = f"DollBonnet_{idx}"
        bonnet.data.materials.append(doll_mats[idx])

    # Export to GLB
    output_path = r"c:\Development\findthewizard\threejs\public\assets\models\mh1_hearth.glb"
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True
    )
    print("SUCCESS_EXPORT_MH1:", output_path)

if __name__ == "__main__":
    build_mh1()
