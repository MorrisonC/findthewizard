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
            # Blender 4+ / 5+ uses Emission Color
            if 'Emission Color' in bsdf.inputs:
                bsdf.inputs['Emission Color'].default_value = emissive
                bsdf.inputs['Emission Strength'].default_value = emissive_intensity
            elif 'Emission' in bsdf.inputs:
                bsdf.inputs['Emission'].default_value = emissive
    return mat

def build_bq1():
    clear_scene()
    col = bpy.data.collections.new("BQ1_Feast")
    bpy.context.scene.collection.children.link(col)

    # Materials
    mat_mahogany = make_material("Mahogany", (0.12, 0.04, 0.02, 1.0), roughness=0.32, metalness=0.05)
    mat_velvet = make_material("CrimsonVelvet", (0.35, 0.02, 0.06, 1.0), roughness=0.85, metalness=0.0)
    mat_silver = make_material("TarnishedSilver", (0.85, 0.88, 0.92, 1.0), roughness=0.18, metalness=0.95)
    mat_gold = make_material("AntiqueGold", (0.82, 0.65, 0.22, 1.0), roughness=0.25, metalness=0.88)
    mat_roast = make_material("RoastGlaze", (0.32, 0.12, 0.04, 1.0), roughness=0.38, metalness=0.05)
    mat_tusk = make_material("BoarBone", (0.88, 0.86, 0.78, 1.0), roughness=0.45, metalness=0.0)
    mat_candle = make_material("WaxTallow", (0.92, 0.90, 0.82, 1.0), roughness=0.6, metalness=0.0)
    mat_flame = make_material("FlameGlow", (1.0, 0.6, 0.1, 1.0), roughness=0.1, emissive=(1.0, 0.65, 0.15, 1.0), emissive_intensity=3.5)

    # --- 1. Mahogany Banquet Table ---
    # Top
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.74))
    table_top = bpy.context.active_object
    table_top.name = "TableTop"
    table_top.scale = (2.2, 6.4, 0.08)
    bpy.ops.object.transform_apply(scale=True)
    table_top.data.materials.append(mat_mahogany)

    # Bevel on table top
    bev = table_top.modifiers.new(name="Bevel", type='BEVEL')
    bev.width = 0.03
    bev.segments = 2
    bpy.ops.object.modifier_apply(modifier="Bevel")

    # Table Apron / Trim
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.66))
    table_apron = bpy.context.active_object
    table_apron.name = "TableApron"
    table_apron.scale = (2.05, 6.25, 0.08)
    bpy.ops.object.transform_apply(scale=True)
    table_apron.data.materials.append(mat_mahogany)

    # 6 Turned Baluster Legs
    leg_x = [-0.92, 0.92]
    leg_y = [-2.8, 0.0, 2.8]
    for lx in leg_x:
        for ly in leg_y:
            # Foot
            bpy.ops.mesh.primitive_cylinder_add(radius=0.12, depth=0.1, location=(lx, ly, 0.05))
            foot = bpy.context.active_object
            foot.name = f"LegFoot_{lx}_{ly}"
            foot.data.materials.append(mat_mahogany)

            # Turned middle sphere
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.13, location=(lx, ly, 0.32))
            sphere = bpy.context.active_object
            sphere.scale = (1.0, 1.0, 1.3)
            bpy.ops.object.transform_apply(scale=True)
            sphere.data.materials.append(mat_mahogany)

            # Upper shaft
            bpy.ops.mesh.primitive_cylinder_add(radius=0.09, depth=0.32, location=(lx, ly, 0.52))
            shaft = bpy.context.active_object
            shaft.data.materials.append(mat_mahogany)

    # --- 2. Velvet Table Runner ---
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.785))
    runner = bpy.context.active_object
    runner.name = "VelvetRunner"
    runner.scale = (1.1, 6.44, 0.015)
    bpy.ops.object.transform_apply(scale=True)
    runner.data.materials.append(mat_velvet)

    # Runner draping ends
    for end_y in [-3.22, 3.22]:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, end_y, 0.65))
        drape = bpy.context.active_object
        drape.name = f"RunnerDrape_{end_y}"
        drape.scale = (1.1, 0.015, 0.26)
        bpy.ops.object.transform_apply(scale=True)
        drape.data.materials.append(mat_velvet)

    # --- 3. Themis Balance Scale (at North Head of Table) ---
    scale_loc = (0, 2.5, 0.79)
    # Pedestal
    bpy.ops.mesh.primitive_cylinder_add(radius=0.16, depth=0.04, location=(scale_loc[0], scale_loc[1], scale_loc[2] + 0.02))
    scale_base = bpy.context.active_object
    scale_base.name = "ThemisScaleBase"
    scale_base.data.materials.append(mat_gold)

    # Central fluted column
    bpy.ops.mesh.primitive_cylinder_add(radius=0.035, depth=0.62, location=(scale_loc[0], scale_loc[1], scale_loc[2] + 0.33))
    scale_col = bpy.context.active_object
    scale_col.name = "ThemisScaleColumn"
    scale_col.data.materials.append(mat_gold)

    # Fulcrum top finial
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.06, location=(scale_loc[0], scale_loc[1], scale_loc[2] + 0.65))
    finial = bpy.context.active_object
    finial.name = "ThemisScaleFinial"
    finial.data.materials.append(mat_gold)

    # Crossbeam (slightly tilted for dramatic imbalance)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.018, depth=0.68, location=(scale_loc[0], scale_loc[1], scale_loc[2] + 0.62))
    beam = bpy.context.active_object
    beam.name = "ThemisScaleBeam"
    beam.rotation_euler = (0, math.radians(90), math.radians(8))
    bpy.ops.object.transform_apply(rotation=True)
    beam.data.materials.append(mat_gold)

    # Pans & Struts
    pan_offsets = [(-0.31, 0.44), (0.31, 0.52)] # slightly tilted heights
    for idx, (px, py_height) in enumerate(pan_offsets):
        pan_x = scale_loc[0] + px
        pan_y = scale_loc[1]
        pan_z = scale_loc[2] + py_height - 0.22

        # Pan dish
        bpy.ops.mesh.primitive_cylinder_add(radius=0.11, depth=0.02, location=(pan_x, pan_y, pan_z))
        pan = bpy.context.active_object
        pan.name = f"ThemisPan_{idx}"
        pan.data.materials.append(mat_silver)

        # 3 suspension struts
        for angle in [0, 120, 240]:
            rad = math.radians(angle)
            sx = pan_x + math.cos(rad) * 0.09
            sy = pan_y + math.sin(rad) * 0.09
            bpy.ops.mesh.primitive_cylinder_add(radius=0.004, depth=0.22, location=( (pan_x + px)/2 if False else sx, sy, pan_z + 0.11 ))
            strut = bpy.context.active_object
            strut.data.materials.append(mat_gold)

    # --- 4. Roast Boar on Silver Platter (Table Center) ---
    boar_loc = (0, 0, 0.79)
    # Oval Silver Platter
    bpy.ops.mesh.primitive_cylinder_add(radius=0.48, depth=0.03, location=(boar_loc[0], boar_loc[1], boar_loc[2] + 0.015))
    platter = bpy.context.active_object
    platter.name = "BoarSilverPlatter"
    platter.scale = (0.75, 1.5, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    platter.data.materials.append(mat_silver)

    # Boar Body (Ellipsoid with spine arch)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.32, location=(boar_loc[0], boar_loc[1], boar_loc[2] + 0.22))
    boar_body = bpy.context.active_object
    boar_body.name = "RoastBoarBody"
    boar_body.scale = (0.7, 1.35, 0.85)
    bpy.ops.object.transform_apply(scale=True)
    boar_body.data.materials.append(mat_roast)

    # Boar Head & Snout
    bpy.ops.mesh.primitive_cone_add(radius1=0.18, radius2=0.08, depth=0.35, location=(boar_loc[0], boar_loc[1] - 0.52, boar_loc[2] + 0.20))
    snout = bpy.context.active_object
    snout.name = "RoastBoarSnout"
    snout.rotation_euler = (math.radians(-90), 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    snout.data.materials.append(mat_roast)

    # Snout disc
    bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=0.03, location=(boar_loc[0], boar_loc[1] - 0.70, boar_loc[2] + 0.20))
    disc = bpy.context.active_object
    disc.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    disc.data.materials.append(mat_roast)

    # Tusks
    for tx in [-0.08, 0.08]:
        bpy.ops.mesh.primitive_cone_add(radius1=0.025, radius2=0.005, depth=0.15, location=(boar_loc[0] + tx, boar_loc[1] - 0.65, boar_loc[2] + 0.24))
        tusk = bpy.context.active_object
        tusk.rotation_euler = (math.radians(-35), math.radians(20 if tx > 0 else -20), 0)
        bpy.ops.object.transform_apply(rotation=True)
        tusk.data.materials.append(mat_tusk)

    # Roasted Rib Contours / Haunches
    for hx in [-0.22, 0.22]:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.14, location=(boar_loc[0] + hx, boar_loc[1] + 0.28, boar_loc[2] + 0.20))
        haunch = bpy.context.active_object
        haunch.scale = (0.7, 1.2, 0.9)
        bpy.ops.object.transform_apply(scale=True)
        haunch.data.materials.append(mat_roast)

    # --- 5. Victorian Candelabras along Table ---
    candelabra_ys = [-1.4, 1.4]
    for cy in candelabra_ys:
        # Base & stem
        bpy.ops.mesh.primitive_cylinder_add(radius=0.10, depth=0.03, location=(0, cy, 0.79 + 0.015))
        cbase = bpy.context.active_object
        cbase.data.materials.append(mat_gold)

        bpy.ops.mesh.primitive_cylinder_add(radius=0.025, depth=0.45, location=(0, cy, 0.79 + 0.24))
        cstem = bpy.context.active_object
        cstem.data.materials.append(mat_gold)

        # 3 branches
        for b_angle in [-0.18, 0.0, 0.18]:
            cx = b_angle
            cz = 0.79 + 0.46
            # Branch arm
            if b_angle != 0.0:
                bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cx/2, cy, cz - 0.05))
                carm = bpy.context.active_object
                carm.scale = (abs(b_angle), 0.015, 0.015)
                bpy.ops.object.transform_apply(scale=True)
                carm.data.materials.append(mat_gold)

            # Candle cup
            bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=0.04, location=(cx, cy, cz))
            cup = bpy.context.active_object
            cup.data.materials.append(mat_gold)

            # Wax candle
            bpy.ops.mesh.primitive_cylinder_add(radius=0.018, depth=0.14, location=(cx, cy, cz + 0.08))
            wax = bpy.context.active_object
            wax.data.materials.append(mat_candle)

            # Flame
            bpy.ops.mesh.primitive_cone_add(radius1=0.015, radius2=0.002, depth=0.05, location=(cx, cy, cz + 0.17))
            flame = bpy.context.active_object
            flame.data.materials.append(mat_flame)

    # --- 6. Silver Charger Plates & Goblets for 8 Seated Guests ---
    guest_ys = [-2.0, -1.0, 1.0, 2.0]
    for gy in guest_ys:
        for gx in [-0.75, 0.75]:
            # Silver plate
            bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=0.015, location=(gx, gy, 0.795))
            plate = bpy.context.active_object
            plate.data.materials.append(mat_silver)

            # Inner plate recess
            bpy.ops.mesh.primitive_cylinder_add(radius=0.13, depth=0.018, location=(gx, gy, 0.798))
            inner = bpy.context.active_object
            inner.data.materials.append(mat_silver)

            # Goblet
            goblet_x = gx + (0.12 if gx < 0 else -0.12)
            goblet_y = gy - 0.16
            bpy.ops.mesh.primitive_cylinder_add(radius=0.038, depth=0.09, location=(goblet_x, goblet_y, 0.84))
            goblet = bpy.context.active_object
            goblet.data.materials.append(mat_silver)

            bpy.ops.mesh.primitive_cylinder_add(radius=0.01, depth=0.08, location=(goblet_x, goblet_y, 0.81))
            stem = bpy.context.active_object
            stem.data.materials.append(mat_silver)

    # Export to GLB
    output_path = r"c:\Development\findthewizard\threejs\public\assets\models\bq1_feast.glb"
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True
    )
    print("SUCCESS_EXPORT_BQ1:", output_path)

if __name__ == "__main__":
    build_bq1()
