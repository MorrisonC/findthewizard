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
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
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
    col = bpy.data.collections.new("MH1_Hearth_Compound")
    bpy.context.scene.collection.children.link(col)

    # --- Materials Palette ---
    mat_brick = make_material("VictorianBrick", (0.35, 0.12, 0.08, 1.0), roughness=0.88, metalness=0.0)
    mat_stone = make_material("CarvedAshlar", (0.45, 0.42, 0.38, 1.0), roughness=0.65, metalness=0.05)
    mat_soot = make_material("SootyFirebox", (0.05, 0.04, 0.04, 1.0), roughness=0.98, metalness=0.0)
    mat_iron = make_material("CastIronKettle", (0.08, 0.08, 0.09, 1.0), roughness=0.35, metalness=0.85)
    mat_wood = make_material("AgedWalnut", (0.22, 0.10, 0.04, 1.0), roughness=0.55, metalness=0.0)
    mat_timber_frame = make_material("CottageOakBeams", (0.16, 0.09, 0.04, 1.0), roughness=0.68, metalness=0.0)
    mat_plaster = make_material("CottagePlasterWall", (0.65, 0.62, 0.58, 1.0), roughness=0.92, metalness=0.0)
    mat_roof_slate = make_material("CottageRoofSlate", (0.12, 0.15, 0.20, 1.0), roughness=0.72, metalness=0.05)
    mat_ember = make_material("GlowingEmbers", (1.0, 0.32, 0.05, 1.0), roughness=0.3, emissive=(1.0, 0.40, 0.08, 1.0), emissive_intensity=3.5)
    mat_cellar_glow = make_material("CellarAetherGlow", (0.12, 0.85, 0.45, 1.0), roughness=0.2, emissive=(0.15, 0.95, 0.50, 1.0), emissive_intensity=2.8)
    mat_soil = make_material("HerbGardenSoil", (0.10, 0.07, 0.05, 1.0), roughness=0.95, metalness=0.0)
    mat_nightshade_stem = make_material("NightshadeStem", (0.08, 0.18, 0.09, 1.0), roughness=0.8, metalness=0.0)
    mat_nightshade_bloom = make_material("NightshadeBloom", (0.55, 0.15, 0.85, 1.0), roughness=0.3, emissive=(0.65, 0.20, 1.0, 1.0), emissive_intensity=2.4)
    mat_mandrake = make_material("MandrakeRoot", (0.28, 0.20, 0.12, 1.0), roughness=0.85, metalness=0.0)

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

    # In Blender: Y = -glTF_Z.
    # Cottage is located in northern quadrant: center_x = 0, center_y = 16 (Three.js tz = -16).
    cot_x = 0.0
    cot_y = 16.0

    # =========================================================================
    # 1. THE WITCH'S COTTAGE ARCHITECTURE (12m x 10m x 4.5m tall with pitched roof)
    # =========================================================================
    # Stone Base Foundation
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cot_x, cot_y, 0.25))
    foundation = bpy.context.active_object
    foundation.name = "Cottage_Foundation"
    foundation.scale = (12.4, 10.4, 0.5)
    bpy.ops.object.transform_apply(scale=True)
    foundation.data.materials.append(mat_stone)

    # North Wall (Back wall containing Hearth)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cot_x, cot_y + 4.9, 2.25))
    n_wall = bpy.context.active_object
    n_wall.name = "Cottage_NorthWall"
    n_wall.scale = (12.0, 0.6, 3.5)
    bpy.ops.object.transform_apply(scale=True)
    n_wall.data.materials.append(mat_plaster)

    # West Wall (Contains Dollhouse Display)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cot_x - 5.7, cot_y, 2.25))
    w_wall = bpy.context.active_object
    w_wall.name = "Cottage_WestWall"
    w_wall.scale = (0.6, 9.8, 3.5)
    bpy.ops.object.transform_apply(scale=True)
    w_wall.data.materials.append(mat_plaster)

    # East Wall (Facing Herb Garden)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cot_x + 5.7, cot_y, 2.25))
    e_wall = bpy.context.active_object
    e_wall.name = "Cottage_EastWall"
    e_wall.scale = (0.6, 9.8, 3.5)
    bpy.ops.object.transform_apply(scale=True)
    e_wall.data.materials.append(mat_plaster)

    # South Wall with Front Doorway (opening at x = 0)
    for sx, w_scale in [(-3.5, 4.4), (3.5, 4.4)]:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cot_x + sx, cot_y - 4.9, 2.25))
        s_part = bpy.context.active_object
        s_part.name = f"Cottage_SouthWall_{sx}"
        s_part.scale = (w_scale, 0.6, 3.5)
        bpy.ops.object.transform_apply(scale=True)
        s_part.data.materials.append(mat_plaster)

    # Door Lintel above front entrance
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cot_x, cot_y - 4.9, 3.4))
    door_lintel = bpy.context.active_object
    door_lintel.name = "Cottage_DoorLintel"
    door_lintel.scale = (2.6, 0.7, 1.2)
    bpy.ops.object.transform_apply(scale=True)
    door_lintel.data.materials.append(mat_timber_frame)

    # Timber Corner Posts
    for px in [-5.8, 5.8]:
        for py in [-5.0, 5.0]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cot_x + px, cot_y + py, 2.25))
            post = bpy.context.active_object
            post.name = f"Cottage_Post_{px}_{py}"
            post.scale = (0.55, 0.55, 3.8)
            bpy.ops.object.transform_apply(scale=True)
            post.data.materials.append(mat_timber_frame)

    # Pitched Slate Roof (West and East Slopes)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cot_x - 3.2, cot_y, 5.2))
    roof_w = bpy.context.active_object
    roof_w.name = "Cottage_Roof_West"
    roof_w.scale = (7.4, 11.2, 0.28)
    roof_w.rotation_euler = (0, math.radians(34), 0)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    roof_w.data.materials.append(mat_roof_slate)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cot_x + 3.2, cot_y, 5.2))
    roof_e = bpy.context.active_object
    roof_e.name = "Cottage_Roof_East"
    roof_e.scale = (7.4, 11.2, 0.28)
    roof_e.rotation_euler = (0, math.radians(-34), 0)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    roof_e.data.materials.append(mat_roof_slate)

    # Roof Ridge Timber Cap
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cot_x, cot_y, 7.1))
    ridge = bpy.context.active_object
    ridge.name = "Cottage_Roof_Ridge"
    ridge.scale = (0.6, 11.6, 0.35)
    bpy.ops.object.transform_apply(scale=True)
    ridge.data.materials.append(mat_timber_frame)

    # =========================================================================
    # 2. VICTORIAN BRICK HEARTH & KETTLE (Inside cottage against North wall)
    # =========================================================================
    hearth_x = cot_x
    hearth_y = cot_y + 4.4  # ~20.4 in Blender / Three.js z = -20.4

    # Brick Fireplace Chimney Breast (Puncturing through roof)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(hearth_x, hearth_y + 0.15, 4.0))
    chimney = bpy.context.active_object
    chimney.name = "ChimneyBreast"
    chimney.scale = (3.4, 1.2, 8.0)
    bpy.ops.object.transform_apply(scale=True)
    chimney.data.materials.append(mat_brick)

    # Firebox Cavity (Opening south into cottage interior)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(hearth_x, hearth_y - 0.15, 0.95))
    firebox = bpy.context.active_object
    firebox.name = "FireboxSoot"
    firebox.scale = (2.2, 0.9, 1.6)
    bpy.ops.object.transform_apply(scale=True)
    firebox.data.materials.append(mat_soot)

    # Hearth Stone Apron
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(hearth_x, hearth_y - 0.6, 0.15))
    apron = bpy.context.active_object
    apron.name = "HearthApron"
    apron.scale = (3.8, 1.4, 0.25)
    bpy.ops.object.transform_apply(scale=True)
    apron.data.materials.append(mat_stone)

    # Mantlepiece Top Shelf
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(hearth_x, hearth_y - 0.35, 2.25))
    mantel = bpy.context.active_object
    mantel.name = "MantelpieceTop"
    mantel.scale = (3.8, 0.8, 0.2)
    bpy.ops.object.transform_apply(scale=True)
    mantel.data.materials.append(mat_wood)

    # Burning Logs & Glowing Embers
    for li, lx in enumerate([-0.45, 0.0, 0.45]):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.1, depth=0.85, location=(hearth_x + lx, hearth_y - 0.18, 0.25))
        log = bpy.context.active_object
        log.name = f"HearthLog_{li}"
        log.rotation_euler = (math.radians(90), math.radians(15 if li == 1 else -20), 0)
        bpy.ops.object.transform_apply(rotation=True)
        log.data.materials.append(mat_soot)

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.35, location=(hearth_x, hearth_y - 0.18, 0.22))
    ember = bpy.context.active_object
    ember.name = "HearthEmberCore"
    ember.scale = (1.8, 1.0, 0.6)
    bpy.ops.object.transform_apply(scale=True)
    ember.data.materials.append(mat_ember)

    # Hanging Cast-Iron Confectionery Kettle
    kettle_loc = (hearth_x, hearth_y - 0.5, 0.72)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.36, location=kettle_loc)
    pot = bpy.context.active_object
    pot.name = "KettlePotBelly"
    pot.scale = (1.0, 1.0, 0.88)
    bpy.ops.object.transform_apply(scale=True)
    pot.data.materials.append(mat_iron)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.22, depth=0.08, location=(kettle_loc[0], kettle_loc[1], kettle_loc[2] + 0.28))
    rim = bpy.context.active_object
    rim.name = "KettleRim"
    rim.data.materials.append(mat_iron)

    # Iron suspension chain
    bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=1.2, location=(kettle_loc[0], kettle_loc[1], kettle_loc[2] + 1.05))
    chain = bpy.context.active_object
    chain.name = "KettleChain"
    chain.data.materials.append(mat_iron)

    # =========================================================================
    # 3. DOLLHOUSE SHELF & 6 PORCELAIN DOLLS (Inside West Wall)
    # =========================================================================
    shelf_loc = (cot_x - 5.2, cot_y, 1.2)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=shelf_loc)
    shelf = bpy.context.active_object
    shelf.name = "DollShelf"
    shelf.scale = (0.45, 3.6, 0.08)
    bpy.ops.object.transform_apply(scale=True)
    shelf.data.materials.append(mat_wood)

    doll_ys = [-1.4, -0.85, -0.3, 0.3, 0.85, 1.4]
    for idx, dy in enumerate(doll_ys):
        doll_x = shelf_loc[0]
        doll_y = shelf_loc[1] + dy
        doll_z = shelf_loc[2] + 0.04

        bpy.ops.mesh.primitive_cone_add(radius1=0.12, radius2=0.04, depth=0.30, location=(doll_x, doll_y, doll_z + 0.15))
        skirt = bpy.context.active_object
        skirt.name = f"DollSkirt_{idx}"
        skirt.data.materials.append(doll_mats[idx])

        bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=0.12, location=(doll_x, doll_y, doll_z + 0.35))
        bodice = bpy.context.active_object
        bodice.name = f"DollBodice_{idx}"
        bodice.data.materials.append(doll_mats[idx])

        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, location=(doll_x, doll_y, doll_z + 0.45))
        head = bpy.context.active_object
        head.name = f"DollHead_{idx}"
        head.data.materials.append(mat_doll_face)

    # =========================================================================
    # 4. SUNKEN ROOT CELLAR / BASEMENT ENTRANCE (West Flank: bx = -12, by = 16)
    # =========================================================================
    cellar_x = cot_x - 11.5
    cellar_y = cot_y

    # Stone Stairwell Retaining Curb
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cellar_x, cellar_y, 0.4))
    cellar_rim = bpy.context.active_object
    cellar_rim.name = "Cellar_Stone_Rim"
    cellar_rim.scale = (3.8, 5.0, 0.8)
    bpy.ops.object.transform_apply(scale=True)
    cellar_rim.data.materials.append(mat_stone)

    # Sunken Cellar Well Cavity
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cellar_x, cellar_y, -0.4))
    cellar_pit = bpy.context.active_object
    cellar_pit.name = "Cellar_Pit_Dark"
    cellar_pit.scale = (2.6, 3.8, 1.4)
    bpy.ops.object.transform_apply(scale=True)
    cellar_pit.data.materials.append(mat_soot)

    # Descending Stone Steps
    for step_i in range(4):
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cellar_x, cellar_y + 1.2 - step_i * 0.7, 0.2 - step_i * 0.22))
        step = bpy.context.active_object
        step.name = f"Cellar_Step_{step_i}"
        step.scale = (2.2, 0.65, 0.25)
        bpy.ops.object.transform_apply(scale=True)
        step.data.materials.append(mat_stone)

    # Angled Wooden Cellar Hatch Doors (One ajar, revealing glowing green/amber alchemical basement)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cellar_x - 0.7, cellar_y - 0.3, 0.85))
    hatch_l = bpy.context.active_object
    hatch_l.name = "Cellar_Hatch_Closed"
    hatch_l.scale = (1.4, 2.6, 0.12)
    hatch_l.rotation_euler = (math.radians(-28), math.radians(-15), 0)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    hatch_l.data.materials.append(mat_wood)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cellar_x + 0.8, cellar_y - 0.2, 1.25))
    hatch_r = bpy.context.active_object
    hatch_r.name = "Cellar_Hatch_Ajar"
    hatch_r.scale = (1.4, 2.6, 0.12)
    hatch_r.rotation_euler = (math.radians(-28), math.radians(45), 0)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    hatch_r.data.materials.append(mat_wood)

    # Eerie Green/Amber Light Emitter from Basement depths
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cellar_x + 0.3, cellar_y - 0.5, 0.1))
    cellar_emitter = bpy.context.active_object
    cellar_emitter.name = "Cellar_Aether_Emitter"
    cellar_emitter.scale = (1.2, 1.8, 0.2)
    bpy.ops.object.transform_apply(scale=True)
    cellar_emitter.data.materials.append(mat_cellar_glow)

    # Fermentation Casks on Landing
    for b_idx, (bx, by) in enumerate([(-1.4, 1.8), (1.4, 1.8), (1.5, 0.9)]):
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.42, depth=0.95, location=(cellar_x + bx, cellar_y + by, 0.55))
        barrel = bpy.context.active_object
        barrel.name = f"Cellar_Cask_{b_idx}"
        barrel.data.materials.append(mat_wood)

    # =========================================================================
    # 5. ENCHANTED OUTDOOR HERB GARDEN (East Flank: bx = +10 to +24, by = 6 to 24)
    # =========================================================================
    garden_cx = cot_x + 16.0
    garden_cy = cot_y

    # Garden Terrace Stone Perimeter Wall
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(garden_cx, garden_cy, 0.4))
    g_wall = bpy.context.active_object
    g_wall.name = "Garden_Perimeter_Wall"
    g_wall.scale = (14.0, 14.0, 0.75)
    bpy.ops.object.transform_apply(scale=True)
    g_wall.data.materials.append(mat_stone)

    # Garden Soil Basin
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(garden_cx, garden_cy, 0.25))
    g_soil = bpy.context.active_object
    g_soil.name = "Garden_Tilled_Soil"
    g_soil.scale = (12.4, 12.4, 0.4)
    bpy.ops.object.transform_apply(scale=True)
    g_soil.data.materials.append(mat_soil)

    # Central Stone Sundial / Astrological Font
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=1.2, depth=0.8, location=(garden_cx, garden_cy, 0.5))
    sundial = bpy.context.active_object
    sundial.name = "Garden_Astrological_Font"
    sundial.data.materials.append(mat_stone)

    # Raised Timber Planting Beds (North & South of central font)
    for p_row, ry in enumerate([-3.5, 3.5]):
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(garden_cx, garden_cy + ry, 0.55))
        bed = bpy.context.active_object
        bed.name = f"HerbBed_TimberFrame_{p_row}"
        bed.scale = (8.5, 2.4, 0.45)
        bpy.ops.object.transform_apply(scale=True)
        bed.data.materials.append(mat_timber_frame)

        # Plant Specimens (Glowing Nightshade Blooms & Mandrakes)
        for plant_i, px in enumerate([-3.0, -1.5, 0.0, 1.5, 3.0]):
            plant_pos = (garden_cx + px, garden_cy + ry, 0.78)
            # Twisted Mandrake Stalk
            bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=0.55, location=(plant_pos[0], plant_pos[1], plant_pos[2] + 0.2))
            stalk = bpy.context.active_object
            stalk.name = f"Plant_Stalk_{p_row}_{plant_i}"
            stalk.data.materials.append(mat_nightshade_stem)

            # Bioluminescent Flower Petals
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.22, location=(plant_pos[0], plant_pos[1], plant_pos[2] + 0.5))
            bloom = bpy.context.active_object
            bloom.name = f"Nightshade_Bloom_{p_row}_{plant_i}"
            bloom.data.materials.append(mat_nightshade_bloom)

    # =========================================================================
    # 6. FRONT SKIRMISH GLADE & COBBLESTONE PERIMETER (South: by = -12 to +4)
    # =========================================================================
    # Sprawling open combat courtyard (~40m wide) for fighting sugar familiars
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, -4.0, 0.15))
    glade = bpy.context.active_object
    glade.name = "Glade_Combat_Paving"
    glade.scale = (38.0, 26.0, 0.3)
    bpy.ops.object.transform_apply(scale=True)
    glade.data.materials.append(mat_stone)

    # Garden Gateposts marking entry from the south
    for gpx in [-4.5, 4.5]:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(gpx, -16.5, 1.6))
        gatepost = bpy.context.active_object
        gatepost.name = f"Glade_Gatepost_{gpx}"
        gatepost.scale = (1.2, 1.2, 3.2)
        bpy.ops.object.transform_apply(scale=True)
        gatepost.data.materials.append(mat_stone)

    # Low mossy fieldstone walls flanking the south entry
    for wx, wl in [(-16.0, 22.0), (16.0, 22.0)]:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(wx, -16.5, 0.7))
        f_wall = bpy.context.active_object
        f_wall.name = f"Glade_Perimeter_Wall_{wx}"
        f_wall.scale = (wl, 0.8, 1.4)
        bpy.ops.object.transform_apply(scale=True)
        f_wall.data.materials.append(mat_stone)

    # Export final compound GLB
    output_path = r"c:\Development\findthewizard\threejs\public\assets\models\mh1_hearth.glb"
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True
    )
    print("SUCCESS_EXPORT_MH1_COMPOUND:", output_path)

if __name__ == "__main__":
    build_mh1()
