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

def build_san1():
    clear_scene()
    col = bpy.data.collections.new("SAN1_Sanctum")
    bpy.context.scene.collection.children.link(col)

    # Materials
    mat_obsidian = make_material("CelestialObsidian", (0.05, 0.06, 0.10, 1.0), roughness=0.15, metalness=0.85)
    mat_quartz = make_material("StarlightQuartz", (0.75, 0.88, 0.98, 1.0), roughness=0.08, metalness=0.25, emissive=(0.15, 0.55, 0.85, 1.0), emissive_intensity=1.5)
    mat_gold = make_material("ArchonGold", (0.88, 0.72, 0.25, 1.0), roughness=0.22, metalness=0.92)
    mat_velvet = make_material("IndigoThroneVelvet", (0.15, 0.08, 0.35, 1.0), roughness=0.85, metalness=0.0)
    mat_glass_cage = make_material("GlassHeartCage", (0.35, 0.85, 1.0, 1.0), roughness=0.05, metalness=0.1, emissive=(0.2, 0.75, 1.0, 1.0), emissive_intensity=2.2)
    mat_soul_core = make_material("CynthiaSoulCore", (1.0, 0.45, 0.75, 1.0), roughness=0.04, metalness=0.05, emissive=(1.0, 0.35, 0.78, 1.0), emissive_intensity=4.5)

    # In Blender: Y = -glTF_Z.
    # Three.js North dais is at tz = -3.5, so throne_y = +3.5.
    throne_y = 3.5

    # --- 1. Crystalline Starlight Throne ---
    # 3-Tier Stepped Octagonal Dais
    dais_radii = [2.2, 1.8, 1.4]
    dais_heights = [0.12, 0.24, 0.36]
    for di, (dr, dh) in enumerate(zip(dais_radii, dais_heights)):
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=dr, depth=0.12, location=(0, throne_y, dh - 0.06))
        dais = bpy.context.active_object
        dais.name = f"ThroneDaisTier_{di}"
        dais.data.materials.append(mat_obsidian)

    # Flanking Crystalline Spire Pillars (North offset)
    for px in [-1.2, 1.2]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.18, depth=2.4, location=(px, throne_y + 0.2, 1.2))
        pillar = bpy.context.active_object
        pillar.name = f"ThronePillar_{px}"
        pillar.data.materials.append(mat_obsidian)

        # Crystalline Spire Cap
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.22, radius2=0.02, depth=0.8, location=(px, throne_y + 0.2, 2.7))
        cap = bpy.context.active_object
        cap.name = f"ThroneSpireCap_{px}"
        cap.data.materials.append(mat_quartz)

    # Throne Seat Base & Box
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, throne_y, 0.65))
    seat_base = bpy.context.active_object
    seat_base.name = "ThroneSeatBase"
    seat_base.scale = (1.1, 0.9, 0.5)
    bpy.ops.object.transform_apply(scale=True)
    seat_base.data.materials.append(mat_obsidian)

    # Velvet Cushion
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, throne_y, 0.92))
    cushion = bpy.context.active_object
    cushion.name = "ThroneCushion"
    cushion.scale = (0.95, 0.8, 0.12)
    bpy.ops.object.transform_apply(scale=True)
    cushion.data.materials.append(mat_velvet)

    # High-Backed Gothic Crystalline Throne Backrest (at North side: throne_y + 0.38)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, throne_y + 0.38, 1.8))
    backrest = bpy.context.active_object
    backrest.name = "ThroneBackrest"
    backrest.scale = (1.0, 0.18, 1.6)
    bpy.ops.object.transform_apply(scale=True)
    backrest.data.materials.append(mat_obsidian)

    # Central Backrest Velvet Panel
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, throne_y + 0.33, 1.7))
    back_velvet = bpy.context.active_object
    back_velvet.name = "ThroneBackVelvet"
    back_velvet.scale = (0.8, 0.08, 1.3)
    bpy.ops.object.transform_apply(scale=True)
    back_velvet.data.materials.append(mat_velvet)

    # Crown Finial Spires atop Backrest
    spire_xs = [-0.35, -0.18, 0.0, 0.18, 0.35]
    spire_lens = [0.45, 0.65, 0.9, 0.65, 0.45]
    for sx, sl in zip(spire_xs, spire_lens):
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.06, radius2=0.01, depth=sl, location=(sx, throne_y + 0.38, 2.6 + sl*0.4))
        spire = bpy.context.active_object
        spire.name = f"ThroneCrownSpire_{sx}"
        spire.data.materials.append(mat_quartz)

    # Armrests with Archon Gold Terminals (facing South towards player: throne_y - 0.42)
    for ax in [-0.52, 0.52]:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(ax, throne_y, 1.05))
        arm = bpy.context.active_object
        arm.scale = (0.14, 0.82, 0.22)
        bpy.ops.object.transform_apply(scale=True)
        arm.data.materials.append(mat_obsidian)

        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.08, location=(ax, throne_y - 0.42, 1.12))
        crest = bpy.context.active_object
        crest.data.materials.append(mat_gold)

    # --- 2. Multifaceted Glass Heart Dodecahedron (Center of Sanctum) ---
    # Three.js Glass Heart is at tz = -1.0, ty = 1.8 -> Blender by = +1.0, bz = 1.8
    heart_loc = (0, 1.0, 1.8)

    # Stepped Pedestal Stand
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.65, depth=0.18, location=(heart_loc[0], heart_loc[1], 0.09))
    pbase = bpy.context.active_object
    pbase.name = "GlassHeartPedestalBase"
    pbase.data.materials.append(mat_obsidian)

    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.22, depth=1.1, location=(heart_loc[0], heart_loc[1], 0.72))
    pcol = bpy.context.active_object
    pcol.name = "GlassHeartPedestalCol"
    pcol.data.materials.append(mat_obsidian)

    # Outer Dodecahedron Cage (Sacred Geometry)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.95, location=heart_loc)
    cage = bpy.context.active_object
    cage.name = "GlassHeartOuterCage"
    cage.data.materials.append(mat_glass_cage)

    # Wireframe / Bevelled lattice modifier for crystalline frame look
    wire_mod = cage.modifiers.new(name="Wireframe", type='WIREFRAME')
    wire_mod.thickness = 0.04
    wire_mod.use_replace = False
    bpy.ops.object.modifier_apply(modifier="Wireframe")

    # Inner Multifaceted Soul Crystal (Cynthia's Trapped Essence)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.48, location=heart_loc)
    core = bpy.context.active_object
    core.name = "CynthiaSoulCrystal"
    core.scale = (1.0, 0.9, 1.2)
    bpy.ops.object.transform_apply(scale=True)
    core.data.materials.append(mat_soul_core)

    # Dual Gimbal Orbital Starlight Rings
    bpy.ops.mesh.primitive_torus_add(major_radius=1.25, minor_radius=0.025, location=heart_loc)
    ring1 = bpy.context.active_object
    ring1.name = "StarlightGimbalRing1"
    ring1.rotation_euler = (math.radians(35), math.radians(20), 0)
    bpy.ops.object.transform_apply(rotation=True)
    ring1.data.materials.append(mat_quartz)

    bpy.ops.mesh.primitive_torus_add(major_radius=1.38, minor_radius=0.025, location=heart_loc)
    ring2 = bpy.context.active_object
    ring2.name = "StarlightGimbalRing2"
    ring2.rotation_euler = (math.radians(-45), math.radians(-30), 0)
    bpy.ops.object.transform_apply(rotation=True)
    ring2.data.materials.append(mat_quartz)

    # Export to GLB
    output_path = r"c:\Development\findthewizard\threejs\public\assets\models\san1_sanctum.glb"
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True
    )
    print("SUCCESS_EXPORT_SAN1:", output_path)

if __name__ == "__main__":
    build_san1()
