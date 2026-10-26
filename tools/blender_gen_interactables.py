"""Blender 5.2 Generator for Veilkeep Interactive Quest, Puzzle & Lore Objects.
Generates bespoke PBR glTF models into threejs/public/assets/models/
"""
import bpy
import math
import os

OUT_DIR = r"c:\Development\findthewizard\threejs\public\assets\models"

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for coll in (bpy.data.collections, bpy.data.materials, bpy.data.meshes, bpy.data.curves, bpy.data.armatures):
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

def export_glb(filename):
    out_path = os.path.join(OUT_DIR, filename)
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True
    )
    print(f"SUCCESS_EXPORT: {filename} ({os.path.getsize(out_path)} bytes)")

# -------------------------------------------------------------------------
# 1. Archival Lectern (Lore Objects throughout Fortress)
# -------------------------------------------------------------------------
def gen_archival_lectern():
    clear_scene()
    col = bpy.data.collections.new("ArchivalLectern")
    bpy.context.scene.collection.children.link(col)

    mat_brass = make_mat("Lectern_Brass", (0.78, 0.60, 0.22, 1.0), roughness=0.28, metalness=0.88)
    mat_walnut = make_mat("Lectern_Walnut", (0.16, 0.09, 0.05, 1.0), roughness=0.65, metalness=0.05)
    mat_parchment = make_mat("Lectern_Parchment", (0.88, 0.82, 0.70, 1.0), roughness=0.75, metalness=0.0)
    mat_orb = make_mat("Lectern_StarlightOrb", (0.95, 0.85, 0.40, 1.0), roughness=0.1, metalness=0.1, emissive=(1.0, 0.75, 0.2, 1.0), strength=3.0)

    # Base plinth (octagonal brass stepped)
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.45, depth=0.10, location=(0, 0, 0.05))
    base1 = bpy.context.active_object
    base1.data.materials.append(mat_brass)

    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.36, depth=0.12, location=(0, 0, 0.16))
    base2 = bpy.context.active_object
    base2.data.materials.append(mat_brass)

    # Central fluted column
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.12, depth=0.75, location=(0, 0, 0.58))
    col_obj = bpy.context.active_object
    col_obj.data.materials.append(mat_brass)

    # Decorative brass rings
    for rz in [0.26, 0.58, 0.90]:
        bpy.ops.mesh.primitive_torus_add(major_radius=0.14, minor_radius=0.02, location=(0, 0, rz))
        ring = bpy.context.active_object
        ring.data.materials.append(mat_brass)

    # Angled reading desk (walnut)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.04, 1.08))
    desk = bpy.context.active_object
    desk.scale = (0.68, 0.52, 0.06)
    desk.rotation_euler = (math.radians(-25), 0, 0)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    desk.data.materials.append(mat_walnut)

    # Open manuscript tome
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.04, 1.13))
    tome = bpy.context.active_object
    tome.scale = (0.54, 0.40, 0.04)
    tome.rotation_euler = (math.radians(-25), 0, 0)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    tome.data.materials.append(mat_parchment)

    # Floating resonant starlight orb
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.16, location=(0, 0, 1.48))
    orb = bpy.context.active_object
    orb.name = "StarlightOrb"
    orb.data.materials.append(mat_orb)

    # Gyro ring around orb
    bpy.ops.mesh.primitive_torus_add(major_radius=0.22, minor_radius=0.015, location=(0, 0, 1.48))
    gring = bpy.context.active_object
    gring.rotation_euler = (math.radians(35), math.radians(45), 0)
    bpy.ops.object.transform_apply(rotation=True)
    gring.data.materials.append(mat_brass)

    export_glb("archival_lectern.glb")

# -------------------------------------------------------------------------
# 2. Patrol Desk (GH1 Captain's Patrol Ledger & Gatehouse Exterior)
# -------------------------------------------------------------------------
def gen_patrol_desk():
    clear_scene()
    col = bpy.data.collections.new("PatrolDesk")
    bpy.context.scene.collection.children.link(col)

    mat_wood = make_mat("Desk_Oak", (0.24, 0.14, 0.08, 1.0), roughness=0.7, metalness=0.05)
    mat_iron = make_mat("Desk_Iron", (0.18, 0.18, 0.20, 1.0), roughness=0.45, metalness=0.85)
    mat_ledger = make_mat("Desk_LedgerCover", (0.42, 0.12, 0.12, 1.0), roughness=0.8, metalness=0.0)
    mat_paper = make_mat("Desk_Paper", (0.85, 0.80, 0.70, 1.0), roughness=0.9, metalness=0.0)
    mat_brass = make_mat("Desk_BrassLamp", (0.80, 0.62, 0.20, 1.0), roughness=0.3, metalness=0.9)
    mat_lamp_light = make_mat("Desk_LampGlow", (1.0, 0.7, 0.2, 1.0), roughness=0.1, metalness=0.0, emissive=(1.0, 0.7, 0.2, 1.0), strength=3.5)

    # Table Top
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.74))
    top = bpy.context.active_object
    top.scale = (1.4, 0.8, 0.08)
    bpy.ops.object.transform_apply(scale=True)
    top.data.materials.append(mat_wood)

    # Table Legs
    for lx in [-0.62, 0.62]:
        for ly in [-0.32, 0.32]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(lx, ly, 0.35))
            leg = bpy.context.active_object
            leg.scale = (0.09, 0.09, 0.70)
            bpy.ops.object.transform_apply(scale=True)
            leg.data.materials.append(mat_wood)

    # Corner iron brackets
    for lx in [-0.68, 0.68]:
        for ly in [-0.38, 0.38]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(lx, ly, 0.74))
            br = bpy.context.active_object
            br.scale = (0.05, 0.05, 0.09)
            bpy.ops.object.transform_apply(scale=True)
            br.data.materials.append(mat_iron)

    # Captain's Patrol Ledger
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-0.15, 0.05, 0.81))
    ledger = bpy.context.active_object
    ledger.name = "PatrolLedger"
    ledger.scale = (0.32, 0.44, 0.05)
    ledger.rotation_euler = (0, 0, math.radians(12))
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    ledger.data.materials.append(mat_ledger)

    # Ledger pages (white edge)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-0.15, 0.05, 0.835))
    pages = bpy.context.active_object
    pages.scale = (0.28, 0.40, 0.02)
    pages.rotation_euler = (0, 0, math.radians(12))
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    pages.data.materials.append(mat_paper)

    # Brass Hurricane Oil Lamp
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.08, depth=0.04, location=(0.45, -0.15, 0.80))
    lamp_base = bpy.context.active_object
    lamp_base.data.materials.append(mat_brass)

    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.05, depth=0.18, location=(0.45, -0.15, 0.91))
    glass = bpy.context.active_object
    glass.data.materials.append(mat_lamp_light)

    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.09, depth=0.05, location=(0.45, -0.15, 1.03))
    cap = bpy.context.active_object
    cap.data.materials.append(mat_brass)

    # Inkwell & Quill
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.04, depth=0.06, location=(0.20, 0.22, 0.81))
    ink = bpy.context.active_object
    ink.data.materials.append(mat_iron)

    export_glb("patrol_desk.glb")

# -------------------------------------------------------------------------
# 3. Vent Grate (GH4 Vent Grate Key & Vent Passage Ascent)
# -------------------------------------------------------------------------
def gen_vent_grate():
    clear_scene()
    col = bpy.data.collections.new("VentGrate")
    bpy.context.scene.collection.children.link(col)

    mat_iron = make_mat("Vent_CastIron", (0.16, 0.17, 0.19, 1.0), roughness=0.55, metalness=0.85)
    mat_brass = make_mat("Vent_BrassKey", (0.82, 0.64, 0.22, 1.0), roughness=0.25, metalness=0.92)
    mat_steam = make_mat("Vent_SteamGlow", (0.6, 0.85, 1.0, 1.0), roughness=0.2, metalness=0.1, emissive=(0.4, 0.75, 1.0, 1.0), strength=2.2)

    # Heavy riveted square frame
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.9))
    frame = bpy.context.active_object
    frame.scale = (1.5, 0.18, 1.5)
    bpy.ops.object.transform_apply(scale=True)
    frame.data.materials.append(mat_iron)

    # Hollow interior cutter
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.9))
    inner = bpy.context.active_object
    inner.scale = (1.2, 0.25, 1.2)
    bpy.ops.object.transform_apply(scale=True)

    mod_bool = frame.modifiers.new("Cutout", 'BOOLEAN')
    mod_bool.object = inner
    mod_bool.operation = 'DIFFERENCE'
    bpy.context.view_layer.objects.active = frame
    bpy.ops.object.modifier_apply(modifier="Cutout")
    bpy.data.objects.remove(inner)

    # Louver slats
    for z in [-0.45, -0.30, -0.15, 0, 0.15, 0.30, 0.45]:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.9 + z))
        slat = bpy.context.active_object
        slat.scale = (1.22, 0.04, 0.07)
        slat.rotation_euler = (math.radians(35), 0, 0)
        bpy.ops.object.transform_apply(scale=True, rotation=True)
        slat.data.materials.append(mat_iron)

    # Steam pressure gauge on top frame
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.18, depth=0.08, location=(0, 0.10, 1.74))
    gauge = bpy.context.active_object
    gauge.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    gauge.data.materials.append(mat_brass)

    # Glowing Steam Core inside vent
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.05, 0.9))
    core = bpy.context.active_object
    core.scale = (1.1, 0.05, 1.1)
    bpy.ops.object.transform_apply(scale=True)
    core.data.materials.append(mat_steam)

    # Vent Grate Key (heavy ornate notched key)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.03, depth=0.45, location=(0.4, 0.15, 0.6))
    kshaft = bpy.context.active_object
    kshaft.name = "VentKey"
    kshaft.data.materials.append(mat_brass)

    bpy.ops.mesh.primitive_torus_add(major_radius=0.09, minor_radius=0.02, location=(0.4, 0.15, 0.84))
    kbow = bpy.context.active_object
    kbow.data.materials.append(mat_brass)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.4, 0.18, 0.42))
    kbit = bpy.context.active_object
    kbit.scale = (0.02, 0.08, 0.08)
    bpy.ops.object.transform_apply(scale=True)
    kbit.data.materials.append(mat_brass)

    export_glb("vent_grate.glb")

# -------------------------------------------------------------------------
# 4. Servant's Hearth (SQ1 Servant's Diary & Secret Pantry)
# -------------------------------------------------------------------------
def gen_servant_hearth():
    clear_scene()
    col = bpy.data.collections.new("ServantHearth")
    bpy.context.scene.collection.children.link(col)

    mat_brick = make_mat("Hearth_Brick", (0.32, 0.22, 0.18, 1.0), roughness=0.85, metalness=0.05)
    mat_mantle = make_mat("Hearth_MantleWood", (0.22, 0.12, 0.06, 1.0), roughness=0.6, metalness=0.05)
    mat_copper = make_mat("Hearth_KettleCopper", (0.78, 0.42, 0.22, 1.0), roughness=0.3, metalness=0.85)
    mat_fire = make_mat("Hearth_EmbersGlow", (1.0, 0.45, 0.1, 1.0), roughness=0.3, metalness=0.0, emissive=(1.0, 0.4, 0.05, 1.0), strength=3.0)
    mat_diary = make_mat("Hearth_DiaryLeather", (0.18, 0.32, 0.22, 1.0), roughness=0.7, metalness=0.0)

    # Fireplace Body
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.8))
    body = bpy.context.active_object
    body.scale = (1.8, 0.6, 1.6)
    bpy.ops.object.transform_apply(scale=True)
    body.data.materials.append(mat_brick)

    # Firebox opening
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.15, 0.55))
    fcut = bpy.context.active_object
    fcut.scale = (1.1, 0.5, 1.0)
    bpy.ops.object.transform_apply(scale=True)

    mod = body.modifiers.new("Firebox", 'BOOLEAN')
    mod.object = fcut
    mod.operation = 'DIFFERENCE'
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier="Firebox")
    bpy.data.objects.remove(fcut)

    # Heavy Wood Mantle Shelf
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.05, 1.65))
    mantle = bpy.context.active_object
    mantle.scale = (2.1, 0.75, 0.12)
    bpy.ops.object.transform_apply(scale=True)
    mantle.data.materials.append(mat_mantle)

    # Glowing Embers Bed
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.05, 0.12))
    embers = bpy.context.active_object
    embers.scale = (0.9, 0.35, 0.15)
    bpy.ops.object.transform_apply(scale=True)
    embers.data.materials.append(mat_fire)

    # Copper Tea Kettle on Mantle
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.14, depth=0.20, location=(0.45, -0.05, 1.81))
    kettle = bpy.context.active_object
    kettle.data.materials.append(mat_copper)

    bpy.ops.mesh.primitive_torus_add(major_radius=0.12, minor_radius=0.02, location=(0.45, -0.05, 1.98))
    handle = bpy.context.active_object
    handle.rotation_euler = (0, math.radians(90), 0)
    bpy.ops.object.transform_apply(rotation=True)
    handle.data.materials.append(mat_copper)

    # Servant's Diary (hidden on mantle corner)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-0.5, -0.05, 1.74))
    diary = bpy.context.active_object
    diary.name = "ServantsDiary"
    diary.scale = (0.28, 0.38, 0.05)
    diary.rotation_euler = (0, 0, math.radians(-15))
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    diary.data.materials.append(mat_diary)

    export_glb("servant_hearth.glb")

# -------------------------------------------------------------------------
# 5. Barracks Armory (B1 Armory Key & Barracks Raid)
# -------------------------------------------------------------------------
def gen_barracks_armory():
    clear_scene()
    col = bpy.data.collections.new("BarracksArmory")
    bpy.context.scene.collection.children.link(col)

    mat_oak = make_mat("Armory_DarkOak", (0.18, 0.12, 0.08, 1.0), roughness=0.75, metalness=0.05)
    mat_steel = make_mat("Armory_ForgedSteel", (0.50, 0.52, 0.55, 1.0), roughness=0.25, metalness=0.92)
    mat_iron = make_mat("Armory_WroughtIron", (0.18, 0.18, 0.20, 1.0), roughness=0.5, metalness=0.85)
    mat_brass = make_mat("Armory_BrassKey", (0.85, 0.65, 0.18, 1.0), roughness=0.25, metalness=0.9)

    # Heavy timber weapons rack base
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.15))
    base = bpy.context.active_object
    base.scale = (2.2, 0.7, 0.3)
    bpy.ops.object.transform_apply(scale=True)
    base.data.materials.append(mat_oak)

    # Upright slotted posts
    for x in [-0.95, 0.95]:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x, 0, 1.0))
        post = bpy.context.active_object
        post.scale = (0.14, 0.14, 1.6)
        bpy.ops.object.transform_apply(scale=True)
        post.data.materials.append(mat_oak)

    # Top crossbar
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 1.72))
    bar = bpy.context.active_object
    bar.scale = (2.1, 0.12, 0.12)
    bpy.ops.object.transform_apply(scale=True)
    bar.data.materials.append(mat_oak)

    # 4 Halberds resting in rack
    for hx in [-0.6, -0.2, 0.2, 0.6]:
        # Pole
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.025, depth=2.1, location=(hx, 0.02, 1.05))
        pole = bpy.context.active_object
        pole.data.materials.append(mat_oak)
        # Blade head
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(hx, 0.02, 2.05))
        blade = bpy.context.active_object
        blade.scale = (0.28, 0.02, 0.38)
        bpy.ops.object.transform_apply(scale=True)
        blade.data.materials.append(mat_steel)

    # Round Citadel Shield mounted on front
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.45, depth=0.06, location=(0, -0.28, 0.85))
    shield = bpy.context.active_object
    shield.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    shield.data.materials.append(mat_iron)

    # Brass Shield Boss
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.12, location=(0, -0.32, 0.85))
    boss = bpy.context.active_object
    boss.data.materials.append(mat_brass)

    # Armory Heavy Iron Key on chest
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.7, -0.25, 0.36))
    kbox = bpy.context.active_object
    kbox.name = "ArmoryKeyChest"
    kbox.scale = (0.35, 0.25, 0.16)
    bpy.ops.object.transform_apply(scale=True)
    kbox.data.materials.append(mat_iron)

    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.025, depth=0.35, location=(0.7, -0.25, 0.48))
    key = bpy.context.active_object
    key.name = "ArmoryKey"
    key.rotation_euler = (0, math.radians(90), 0)
    bpy.ops.object.transform_apply(rotation=True)
    key.data.materials.append(mat_brass)

    export_glb("barracks_armory.glb")

# -------------------------------------------------------------------------
# 6. Escher Anchor (RC1 & RS1..RS6 Relativity Cloister)
# -------------------------------------------------------------------------
def gen_escher_anchor():
    clear_scene()
    col = bpy.data.collections.new("EscherAnchor")
    bpy.context.scene.collection.children.link(col)

    mat_granite = make_mat("Escher_Granite", (0.35, 0.36, 0.42, 1.0), roughness=0.65, metalness=0.1)
    mat_iron = make_mat("Escher_ColdIron", (0.12, 0.14, 0.18, 1.0), roughness=0.35, metalness=0.9)
    mat_rift = make_mat("Escher_DimensionalNexus", (0.6, 0.4, 1.0, 1.0), roughness=0.1, metalness=0.2, emissive=(0.65, 0.35, 1.0, 1.0), strength=3.5)

    # Impossible Interlocking Pedestal Base
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.2))
    base = bpy.context.active_object
    base.scale = (1.8, 1.8, 0.4)
    bpy.ops.object.transform_apply(scale=True)
    base.data.materials.append(mat_granite)

    # 4 Floating Interlocking Stairway Segments
    angles = [0, 90, 180, 270]
    for idx, ang in enumerate(angles):
        rad = math.radians(ang)
        x = math.cos(rad) * 0.7
        y = math.sin(rad) * 0.7
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x, y, 0.7 + idx * 0.12))
        stair = bpy.context.active_object
        stair.scale = (0.45, 0.8, 0.12)
        stair.rotation_euler = (math.radians(25 if idx % 2 == 0 else -25), 0, rad)
        bpy.ops.object.transform_apply(scale=True, rotation=True)
        stair.data.materials.append(mat_granite)

    # Giant Cold-Iron Grounding Spike in Center
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.22, radius2=0.02, depth=1.4, location=(0, 0, 1.0))
    spike = bpy.context.active_object
    spike.name = "IronSpikeAnchor"
    spike.data.materials.append(mat_iron)

    # 3 Binding Iron Ring Bands
    for sz in [0.6, 0.9, 1.2]:
        bpy.ops.mesh.primitive_torus_add(major_radius=0.24, minor_radius=0.03, location=(0, 0, sz))
        sring = bpy.context.active_object
        sring.data.materials.append(mat_iron)

    # Floating Dimensional Nexus Dodecahedron
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.28, location=(0, 0, 1.9))
    core = bpy.context.active_object
    core.name = "RelativityCore"
    core.data.materials.append(mat_rift)

    # Bundle of Iron Nails nearby
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.03, depth=0.45, location=(0.6, -0.6, 0.45))
    nail = bpy.context.active_object
    nail.name = "IronNailsPickup"
    nail.rotation_euler = (math.radians(20), math.radians(30), 0)
    bpy.ops.object.transform_apply(rotation=True)
    nail.data.materials.append(mat_iron)

    export_glb("escher_anchor.glb")

# -------------------------------------------------------------------------
# 7. Chronomantic Astrolabe (CR1 Tachyon Phial & Retrocausal Portcullis)
# -------------------------------------------------------------------------
def gen_chronomantic_astrolabe():
    clear_scene()
    col = bpy.data.collections.new("ChronomanticAstrolabe")
    bpy.context.scene.collection.children.link(col)

    mat_brass = make_mat("Astrolabe_Brass", (0.85, 0.68, 0.22, 1.0), roughness=0.28, metalness=0.92)
    mat_copper = make_mat("Astrolabe_Copper", (0.75, 0.40, 0.20, 1.0), roughness=0.35, metalness=0.85)
    mat_tachyon = make_mat("Astrolabe_TachyonCyan", (0.2, 0.85, 1.0, 1.0), roughness=0.08, metalness=0.15, emissive=(0.3, 0.9, 1.0, 1.0), strength=4.0)
    mat_marble = make_mat("Astrolabe_BlackMarble", (0.08, 0.09, 0.11, 1.0), roughness=0.25, metalness=0.4)

    # Marble pedestal
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.6, depth=0.8, location=(0, 0, 0.4))
    ped = bpy.context.active_object
    ped.data.materials.append(mat_marble)

    # Gear train base
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.52, depth=0.08, location=(0, 0, 0.84))
    gear = bpy.context.active_object
    gear.data.materials.append(mat_brass)

    # 3 Concentric Gimbal Astrolabe Rings
    ring_radii = [0.85, 0.72, 0.58]
    ring_tilts = [(40, 20), (-35, 45), (15, -50)]
    for idx, (rad, (rx, ry)) in enumerate(zip(ring_radii, ring_tilts)):
        bpy.ops.mesh.primitive_torus_add(major_radius=rad, minor_radius=0.035, location=(0, 0, 1.5))
        ring = bpy.context.active_object
        ring.name = f"AstrolabeRing_{idx}"
        ring.rotation_euler = (math.radians(rx), math.radians(ry), 0)
        bpy.ops.object.transform_apply(rotation=True)
        ring.data.materials.append(mat_brass if idx % 2 == 0 else mat_copper)

    # Central Suspended Tachyon Phial (Glowing Hourglass Shape)
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.12, radius2=0.03, depth=0.22, location=(0, 0, 1.62))
    phial_top = bpy.context.active_object
    phial_top.data.materials.append(mat_tachyon)

    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.03, radius2=0.12, depth=0.22, location=(0, 0, 1.38))
    phial_bot = bpy.context.active_object
    phial_bot.data.materials.append(mat_tachyon)

    # Ouroboros Serpent Ring around phial
    bpy.ops.mesh.primitive_torus_add(major_radius=0.32, minor_radius=0.03, location=(0, 0, 1.5))
    ouro = bpy.context.active_object
    ouro.name = "OuroborosGear"
    ouro.data.materials.append(mat_brass)

    export_glb("chronomantic_astrolabe.glb")

# -------------------------------------------------------------------------
# 8. Glass Armonica (MS3 Glass-Armonica Mallet & Resonant Harmonies)
# -------------------------------------------------------------------------
def gen_glass_armonica():
    clear_scene()
    col = bpy.data.collections.new("GlassArmonica")
    bpy.context.scene.collection.children.link(col)

    mat_mahogany = make_mat("Armonica_Mahogany", (0.22, 0.08, 0.04, 1.0), roughness=0.55, metalness=0.05)
    mat_crystal = make_mat("Armonica_CrystalGlass", (0.85, 0.95, 1.0, 1.0), roughness=0.05, metalness=0.2, emissive=(0.4, 0.8, 1.0, 1.0), strength=2.2)
    mat_brass = make_mat("Armonica_Brass", (0.84, 0.68, 0.24, 1.0), roughness=0.3, metalness=0.9)
    mat_velvet = make_mat("Armonica_CrimsonVelvet", (0.45, 0.06, 0.08, 1.0), roughness=0.85, metalness=0.0)

    # Victorian Trestle Table Frame
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.72))
    table = bpy.context.active_object
    table.scale = (2.2, 0.7, 0.08)
    bpy.ops.object.transform_apply(scale=True)
    table.data.materials.append(mat_mahogany)

    # Trestle Legs & Spindle
    for lx in [-0.85, 0.85]:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(lx, 0, 0.35))
        leg = bpy.context.active_object
        leg.scale = (0.12, 0.6, 0.7)
        bpy.ops.object.transform_apply(scale=True)
        leg.data.materials.append(mat_mahogany)

    # Spindle Axle
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.03, depth=1.9, location=(0, 0, 0.92))
    axle = bpy.context.active_object
    axle.rotation_euler = (0, math.radians(90), 0)
    bpy.ops.object.transform_apply(rotation=True)
    axle.data.materials.append(mat_brass)

    # Series of 9 Concentric Glass Armonica Bowls (Graduated size)
    for bi, bx in enumerate([-0.7, -0.52, -0.35, -0.18, 0, 0.18, 0.35, 0.52, 0.7]):
        r = 0.16 + (bi * 0.02)
        bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=r, radius2=0.06, depth=0.14, location=(bx, 0, 0.92))
        bowl = bpy.context.active_object
        bowl.name = f"ArmonicaBowl_{bi}"
        bowl.rotation_euler = (0, math.radians(90), 0)
        bpy.ops.object.transform_apply(rotation=True)
        bowl.data.materials.append(mat_crystal)

    # Musical Score Stand on table
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.28, 1.05))
    stand = bpy.context.active_object
    stand.scale = (0.6, 0.04, 0.45)
    stand.rotation_euler = (math.radians(-25), 0, 0)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    stand.data.materials.append(mat_brass)

    # Crystal Glass Mallet
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.015, depth=0.42, location=(0.8, -0.15, 0.78))
    mhandle = bpy.context.active_object
    mhandle.name = "GlassMallet"
    mhandle.data.materials.append(mat_brass)

    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.06, location=(0.8, -0.15, 0.99))
    mhead = bpy.context.active_object
    mhead.data.materials.append(mat_crystal)

    export_glb("glass_armonica.glb")

# -------------------------------------------------------------------------
# 9. Warden Bureau & Keyring (PB1 & PB4 Abyssal Prison Block)
# -------------------------------------------------------------------------
def gen_warden_desk():
    clear_scene()
    col = bpy.data.collections.new("WardenDesk")
    bpy.context.scene.collection.children.link(col)

    mat_oak = make_mat("Warden_StainedOak", (0.14, 0.10, 0.08, 1.0), roughness=0.7, metalness=0.05)
    mat_iron = make_mat("Warden_ColdIron", (0.16, 0.16, 0.18, 1.0), roughness=0.45, metalness=0.88)
    mat_brass = make_mat("Warden_KeyringBrass", (0.82, 0.62, 0.18, 1.0), roughness=0.28, metalness=0.9)
    mat_runic = make_mat("Warden_RunicGlow", (0.3, 0.85, 0.5, 1.0), roughness=0.1, metalness=0.1, emissive=(0.2, 0.9, 0.45, 1.0), strength=2.8)

    # Massive Warden's Roll-Top Bureau
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.5))
    desk = bpy.context.active_object
    desk.scale = (1.6, 0.9, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    desk.data.materials.append(mat_oak)

    # Upper pigeon-hole organizer
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.25, 1.35))
    top = bpy.context.active_object
    top.scale = (1.5, 0.35, 0.7)
    bpy.ops.object.transform_apply(scale=True)
    top.data.materials.append(mat_oak)

    # Heavy Iron Candelabra
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.08, depth=0.04, location=(-0.5, -0.15, 1.02))
    cand = bpy.context.active_object
    cand.data.materials.append(mat_iron)

    # Warden's Abyssal Keyring (Heavy ring with 5 large skeleton keys)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.14, minor_radius=0.02, location=(0.35, -0.15, 1.04))
    kring = bpy.context.active_object
    kring.name = "WardenKeyring"
    kring.data.materials.append(mat_brass)

    for ki, kang in enumerate([-30, -15, 0, 15, 30]):
        rad = math.radians(kang)
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.018, depth=0.28, location=(0.35 + math.sin(rad)*0.08, -0.15 - 0.18, 1.04))
        key = bpy.context.active_object
        key.data.materials.append(mat_iron)

    # Runic Prison Log Registry
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-0.05, -0.12, 1.03))
    reg = bpy.context.active_object
    reg.scale = (0.35, 0.45, 0.06)
    bpy.ops.object.transform_apply(scale=True)
    reg.data.materials.append(mat_runic)

    export_glb("warden_desk.glb")

# -------------------------------------------------------------------------
# 10. Rooftop Anemometer & Wind Vane (RG2 & RG4 Rooftop Gardens)
# -------------------------------------------------------------------------
def gen_rooftop_anemometer():
    clear_scene()
    col = bpy.data.collections.new("RooftopAnemometer")
    bpy.context.scene.collection.children.link(col)

    mat_brass = make_mat("Vane_PolishedBrass", (0.85, 0.68, 0.20, 1.0), roughness=0.25, metalness=0.92)
    mat_stone = make_mat("Vane_CarvedLimestone", (0.55, 0.54, 0.50, 1.0), roughness=0.8, metalness=0.05)
    mat_starlight = make_mat("Vane_StarlightAura", (0.4, 0.85, 1.0, 1.0), roughness=0.1, metalness=0.1, emissive=(0.3, 0.8, 1.0, 1.0), strength=3.0)

    # Carved stone pedestal
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.38, depth=0.8, location=(0, 0, 0.4))
    ped = bpy.context.active_object
    ped.data.materials.append(mat_stone)

    # Central tall brass spire
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.06, depth=1.6, location=(0, 0, 1.6))
    spire = bpy.context.active_object
    spire.data.materials.append(mat_brass)

    # Cardinal directional compass arms (N-S, E-W)
    for cr in [0, math.radians(90)]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.02, depth=0.8, location=(0, 0, 1.8))
        arm = bpy.context.active_object
        arm.rotation_euler = (math.radians(90), 0, cr)
        bpy.ops.object.transform_apply(rotation=True)
        arm.data.materials.append(mat_brass)

    # Rotating 4-Cup Anemometer
    for cang in [0, 90, 180, 270]:
        crad = math.radians(cang)
        cx = math.cos(crad) * 0.32
        cy = math.sin(crad) * 0.32
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.07, location=(cx, cy, 2.15))
        cup = bpy.context.active_object
        cup.data.materials.append(mat_brass)

    # Top Silhouette: Gilded Starlight Stag Weather Vane
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.08, radius2=0.01, depth=0.55, location=(-0.25, 0, 2.45))
    arrow_tail = bpy.context.active_object
    arrow_tail.rotation_euler = (0, math.radians(90), 0)
    bpy.ops.object.transform_apply(rotation=True)
    arrow_tail.data.materials.append(mat_brass)

    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.12, radius2=0.01, depth=0.35, location=(0.35, 0, 2.45))
    arrow_head = bpy.context.active_object
    arrow_head.name = "WindVane"
    arrow_head.rotation_euler = (0, math.radians(-90), 0)
    bpy.ops.object.transform_apply(rotation=True)
    arrow_head.data.materials.append(mat_starlight)

    export_glb("rooftop_anemometer.glb")

# -------------------------------------------------------------------------
# 11. Celestial Telescope (AT1 & AT2 Astronomy Tower)
# -------------------------------------------------------------------------
def gen_celestial_telescope():
    clear_scene()
    col = bpy.data.collections.new("CelestialTelescope")
    bpy.context.scene.collection.children.link(col)

    mat_brass = make_mat("Telescope_GildedBrass", (0.86, 0.70, 0.24, 1.0), roughness=0.25, metalness=0.92)
    mat_wood = make_mat("Telescope_MahoganyLegs", (0.24, 0.12, 0.06, 1.0), roughness=0.6, metalness=0.05)
    mat_lens = make_mat("Telescope_AstromancerLens", (0.3, 0.85, 1.0, 1.0), roughness=0.05, metalness=0.1, emissive=(0.4, 0.88, 1.0, 1.0), strength=3.5)

    # Tripod Base Hub
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.18, depth=0.15, location=(0, 0, 0.95))
    hub = bpy.context.active_object
    hub.data.materials.append(mat_brass)

    # 3 Tripod Splayed Legs
    for lang in [0, 120, 240]:
        lrad = math.radians(lang)
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.035, depth=1.1, location=(math.cos(lrad)*0.32, math.sin(lrad)*0.32, 0.48))
        leg = bpy.context.active_object
        leg.rotation_euler = (math.sin(lrad)*0.35, -math.cos(lrad)*0.35, 0)
        bpy.ops.object.transform_apply(rotation=True)
        leg.data.materials.append(mat_wood)

    # Gimbal Yoke & Setting Circles
    bpy.ops.mesh.primitive_torus_add(major_radius=0.25, minor_radius=0.03, location=(0, 0, 1.25))
    yoke = bpy.context.active_object
    yoke.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    yoke.data.materials.append(mat_brass)

    # Main Optical Barrel (angled upward 35 deg toward sky)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.14, depth=1.8, location=(0, 0.2, 1.55))
    barrel = bpy.context.active_object
    barrel.name = "TelescopeBarrel"
    barrel.rotation_euler = (math.radians(35), 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    barrel.data.materials.append(mat_brass)

    # Objective Lens (Astromancer's Lens) at tip
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.16, depth=0.04, location=(0, 0.2 - math.sin(math.radians(35))*0.9, 1.55 + math.cos(math.radians(35))*0.9))
    lens = bpy.context.active_object
    lens.name = "AstromancersLens"
    lens.rotation_euler = (math.radians(35), 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    lens.data.materials.append(mat_lens)

    export_glb("celestial_telescope.glb")

# -------------------------------------------------------------------------
# 12. Star Map Pedestal (AT3 Astronomy Tower)
# -------------------------------------------------------------------------
def gen_starmap_pedestal():
    clear_scene()
    col = bpy.data.collections.new("StarMapPedestal")
    bpy.context.scene.collection.children.link(col)

    mat_marble = make_mat("StarMap_WhiteMarble", (0.85, 0.85, 0.88, 1.0), roughness=0.3, metalness=0.1)
    mat_brass = make_mat("StarMap_BrassGimbal", (0.85, 0.68, 0.22, 1.0), roughness=0.25, metalness=0.92)
    mat_chart = make_mat("StarMap_GlowingConstellation", (0.25, 0.75, 1.0, 1.0), roughness=0.08, metalness=0.1, emissive=(0.35, 0.85, 1.0, 1.0), strength=4.0)

    # Stepped Marble Dais
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.85, depth=0.15, location=(0, 0, 0.08))
    d1 = bpy.context.active_object
    d1.data.materials.append(mat_marble)

    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.68, depth=0.65, location=(0, 0, 0.48))
    d2 = bpy.context.active_object
    d2.data.materials.append(mat_marble)

    # Glowing Constellation Tabletop Platter
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.72, depth=0.06, location=(0, 0, 0.84))
    chart = bpy.context.active_object
    chart.name = "StarMapPlatter"
    chart.data.materials.append(mat_chart)

    # Armillary Sphere Frame above platter
    for rz in [0, 45, 90, 135]:
        bpy.ops.mesh.primitive_torus_add(major_radius=0.45, minor_radius=0.02, location=(0, 0, 1.25))
        ring = bpy.context.active_object
        ring.rotation_euler = (math.radians(rz), math.radians(30), 0)
        bpy.ops.object.transform_apply(rotation=True)
        ring.data.materials.append(mat_brass)

    # Central Celestial Core
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.18, location=(0, 0, 1.25))
    core = bpy.context.active_object
    core.data.materials.append(mat_chart)

    export_glb("starmap_pedestal.glb")

# -------------------------------------------------------------------------
# 13. Alchemist Bench (AL1 & AL3 Alchemist's Lab)
# -------------------------------------------------------------------------
def gen_alchemist_bench():
    clear_scene()
    col = bpy.data.collections.new("AlchemistBench")
    bpy.context.scene.collection.children.link(col)

    mat_oak = make_mat("Alch_StainedBench", (0.18, 0.12, 0.08, 1.0), roughness=0.75, metalness=0.05)
    mat_copper = make_mat("Alch_CopperBoiler", (0.75, 0.42, 0.20, 1.0), roughness=0.3, metalness=0.88)
    mat_glass = make_mat("Alch_GreenReagent", (0.2, 0.9, 0.4, 1.0), roughness=0.08, metalness=0.1, emissive=(0.2, 0.85, 0.35, 1.0), strength=3.0)
    mat_sulfur = make_mat("Alch_VolatileSulfur", (0.95, 0.85, 0.15, 1.0), roughness=0.2, metalness=0.1, emissive=(1.0, 0.8, 0.1, 1.0), strength=3.5)

    # Heavy Heavy Table Workbench
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.42))
    table = bpy.context.active_object
    table.scale = (2.2, 0.9, 0.84)
    bpy.ops.object.transform_apply(scale=True)
    table.data.materials.append(mat_oak)

    # Copper Retort / Alembic Boiler (Left)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.28, location=(-0.65, 0, 1.12))
    boiler = bpy.context.active_object
    boiler.data.materials.append(mat_copper)

    # Alembic swan neck tube
    bpy.ops.mesh.primitive_torus_add(major_radius=0.22, minor_radius=0.025, location=(-0.45, 0, 1.35))
    neck = bpy.context.active_object
    neck.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    neck.data.materials.append(mat_copper)

    # Coiled Glass Condenser Flask (Center)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.12, depth=0.35, location=(-0.15, 0, 1.02))
    flask = bpy.context.active_object
    flask.data.materials.append(mat_glass)

    # Volatile Sulfur Crucible & Vial (Right)
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.15, depth=0.18, location=(0.55, -0.1, 0.93))
    crucible = bpy.context.active_object
    crucible.name = "VolatileSulfurCrucible"
    crucible.data.materials.append(mat_sulfur)

    # Glowing Reagent Phials in wooden rack
    for px in [0.25, 0.4, 0.55]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.035, depth=0.18, location=(px, 0.22, 0.93))
        vial = bpy.context.active_object
        vial.data.materials.append(mat_glass)

    export_glb("alchemist_bench.glb")

# -------------------------------------------------------------------------
# 14. Mimic Chest (TR2 & TR4 Trophy Hall)
# -------------------------------------------------------------------------
def gen_mimic_chest():
    clear_scene()
    col = bpy.data.collections.new("MimicChest")
    bpy.context.scene.collection.children.link(col)

    mat_wood = make_mat("Mimic_DarkChestWood", (0.24, 0.14, 0.08, 1.0), roughness=0.6, metalness=0.05)
    mat_brass = make_mat("Mimic_BrassHardware", (0.84, 0.64, 0.18, 1.0), roughness=0.28, metalness=0.92)
    mat_teeth = make_mat("Mimic_CrystalFangs", (0.9, 0.95, 1.0, 1.0), roughness=0.1, metalness=0.1)
    mat_mouth = make_mat("Mimic_AbyssalMouth", (0.45, 0.05, 0.12, 1.0), roughness=0.4, metalness=0.0, emissive=(0.8, 0.1, 0.2, 1.0), strength=2.5)

    # Lower Chest Box
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.35))
    cbox = bpy.context.active_object
    cbox.scale = (1.2, 0.8, 0.7)
    bpy.ops.object.transform_apply(scale=True)
    cbox.data.materials.append(mat_wood)

    # Ajar Chest Lid (tilted back 25 degrees)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.42, depth=1.2, location=(0, 0.12, 0.85))
    lid = bpy.context.active_object
    lid.rotation_euler = (0, math.radians(90), 0)
    lid.scale = (1.0, 0.75, 1.0)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    lid.rotation_euler = (math.radians(-25), 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    lid.data.materials.append(mat_wood)

    # Glowing predatory interior cavity
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.05, 0.72))
    maw = bpy.context.active_object
    maw.name = "MimicMaw"
    maw.scale = (1.0, 0.55, 0.2)
    bpy.ops.object.transform_apply(scale=True)
    maw.data.materials.append(mat_mouth)

    # Upper & Lower Sharp Fangs
    for fx in [-0.4, -0.2, 0, 0.2, 0.4]:
        # Top fangs
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.035, radius2=0.005, depth=0.14, location=(fx, -0.28, 0.84))
        tfang = bpy.context.active_object
        tfang.data.materials.append(mat_teeth)
        # Bottom fangs
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.035, radius2=0.005, depth=0.14, location=(fx, -0.32, 0.65))
        bfang = bpy.context.active_object
        bfang.rotation_euler = (math.radians(180), 0, 0)
        bpy.ops.object.transform_apply(rotation=True)
        bfang.data.materials.append(mat_teeth)

    # Brass corner straps
    for bx in [-0.61, 0.61]:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(bx, 0, 0.35))
        bstrap = bpy.context.active_object
        bstrap.scale = (0.05, 0.84, 0.72)
        bpy.ops.object.transform_apply(scale=True)
        bstrap.data.materials.append(mat_brass)

    export_glb("mimic_chest.glb")

# -------------------------------------------------------------------------
# 15. Monk Sarcophagus (U1 & U2 Undercrypt)
# -------------------------------------------------------------------------
def gen_monk_sarcophagus():
    clear_scene()
    col = bpy.data.collections.new("MonkSarcophagus")
    bpy.context.scene.collection.children.link(col)

    mat_stone = make_mat("Monk_GothicLimestone", (0.42, 0.44, 0.48, 1.0), roughness=0.8, metalness=0.05)
    mat_beads = make_mat("Monk_PrayerBeadsAmber", (0.9, 0.65, 0.2, 1.0), roughness=0.25, metalness=0.1, emissive=(0.85, 0.55, 0.15, 1.0), strength=2.5)

    # Sarcophagus Chest (Chiseled Limestone)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.45))
    tomb = bpy.context.active_object
    tomb.scale = (1.2, 2.2, 0.9)
    bpy.ops.object.transform_apply(scale=True)
    tomb.data.materials.append(mat_stone)

    # Sarcophagus Lid Slab
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.98))
    lid = bpy.context.active_object
    lid.scale = (1.35, 2.35, 0.16)
    bpy.ops.object.transform_apply(scale=True)
    lid.data.materials.append(mat_stone)

    # Carved Resting Monk Effigy (Head, Torso, Folded Hands)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.22, location=(0, 0.75, 1.18))
    head = bpy.context.active_object
    head.scale = (0.85, 1.1, 0.7)
    bpy.ops.object.transform_apply(scale=True)
    head.data.materials.append(mat_stone)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.1, 1.14))
    cowl = bpy.context.active_object
    cowl.scale = (0.75, 1.1, 0.18)
    bpy.ops.object.transform_apply(scale=True)
    cowl.data.materials.append(mat_stone)

    # Offering Bowl with Glowing Monk Prayer Beads
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.18, depth=0.08, location=(0, -0.65, 1.10))
    bowl = bpy.context.active_object
    bowl.data.materials.append(mat_stone)

    # Prayer Bead Necklace inside bowl
    bpy.ops.mesh.primitive_torus_add(major_radius=0.12, minor_radius=0.035, location=(0, -0.65, 1.14))
    beads = bpy.context.active_object
    beads.name = "PrayerBeads"
    beads.data.materials.append(mat_beads)

    export_glb("monk_sarcophagus.glb")

# -------------------------------------------------------------------------
# 16. Aeolian Belfry Bell (BT1 Bell Tower)
# -------------------------------------------------------------------------
def gen_aeolian_belfry():
    clear_scene()
    col = bpy.data.collections.new("AeolianBelfry")
    bpy.context.scene.collection.children.link(col)

    mat_bronze = make_mat("Belfry_AncientBronze", (0.65, 0.48, 0.22, 1.0), roughness=0.35, metalness=0.88)
    mat_timber = make_mat("Belfry_DarkTimber", (0.16, 0.10, 0.06, 1.0), roughness=0.8, metalness=0.05)
    mat_iron = make_mat("Belfry_IronStraps", (0.18, 0.18, 0.20, 1.0), roughness=0.5, metalness=0.85)
    mat_chime = make_mat("Belfry_ResonantPipes", (0.85, 0.75, 0.35, 1.0), roughness=0.2, metalness=0.92, emissive=(0.85, 0.65, 0.2, 1.0), strength=2.2)

    # 4 Heavy A-frame timber posts
    for x in [-1.0, 1.0]:
        for y in [-0.5, 0.5]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x, y, 1.4))
            beam = bpy.context.active_object
            beam.scale = (0.2, 0.2, 2.8)
            bpy.ops.object.transform_apply(scale=True)
            beam.data.materials.append(mat_timber)

    # Top crossbeam
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 2.7))
    top_beam = bpy.context.active_object
    top_beam.scale = (2.4, 0.35, 0.35)
    bpy.ops.object.transform_apply(scale=True)
    top_beam.data.materials.append(mat_timber)

    # Monumental Cathedral Bell
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.65, depth=0.9, location=(0, 0, 1.8))
    bell = bpy.context.active_object
    bell.name = "AeolianCathedralBell"
    bell.data.materials.append(mat_bronze)

    # Flared Bell Lip
    bpy.ops.mesh.primitive_torus_add(major_radius=0.72, minor_radius=0.08, location=(0, 0, 1.35))
    lip = bpy.context.active_object
    lip.data.materials.append(mat_bronze)

    # 4 Vertical Resonant Chime Baffles
    for ci, cx in enumerate([-0.5, -0.2, 0.2, 0.5]):
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.04, depth=1.4 - ci*0.15, location=(cx, -0.65, 1.4))
        chime = bpy.context.active_object
        chime.name = f"AeolianChimePipe_{ci}"
        chime.data.materials.append(mat_chime)

    export_glb("aeolian_belfry.glb")

# -------------------------------------------------------------------------
# 17. Void Rift Anchor (VR1, VR2, VR3 Void Realm)
# -------------------------------------------------------------------------
def gen_void_rift_anchor():
    clear_scene()
    col = bpy.data.collections.new("VoidRiftAnchor")
    bpy.context.scene.collection.children.link(col)

    mat_obsidian = make_mat("Void_RiftObsidian", (0.05, 0.05, 0.08, 1.0), roughness=0.15, metalness=0.9)
    mat_dream_core = make_mat("Void_DreamCorePulsing", (0.45, 0.25, 0.95, 1.0), roughness=0.05, metalness=0.1, emissive=(0.55, 0.3, 1.0, 1.0), strength=4.5)

    # Base crater pedestal
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.9, depth=0.25, location=(0, 0, 0.12))
    base = bpy.context.active_object
    base.data.materials.append(mat_obsidian)

    # 3 Floating Jagged Obsidian Shards orbiting center
    for si, sang in enumerate([0, 120, 240]):
        srad = math.radians(sang)
        sx = math.cos(srad) * 0.75
        sy = math.sin(srad) * 0.75
        bpy.ops.mesh.primitive_cone_add(vertices=5, radius1=0.22, radius2=0.04, depth=1.6, location=(sx, sy, 1.1))
        shard = bpy.context.active_object
        shard.name = f"ObsidianMonolith_{si}"
        shard.rotation_euler = (math.sin(srad)*0.25, -math.cos(srad)*0.25, srad)
        bpy.ops.object.transform_apply(rotation=True)
        shard.data.materials.append(mat_obsidian)

    # Central Floating Pulsing Dream Core
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.38, location=(0, 0, 1.25))
    core = bpy.context.active_object
    core.name = "DreamCore"
    core.data.materials.append(mat_dream_core)

    # Outer ethereal orbital gyro ring
    bpy.ops.mesh.primitive_torus_add(major_radius=0.55, minor_radius=0.02, location=(0, 0, 1.25))
    oring = bpy.context.active_object
    oring.rotation_euler = (math.radians(45), math.radians(30), 0)
    bpy.ops.object.transform_apply(rotation=True)
    oring.data.materials.append(mat_dream_core)

    export_glb("void_rift_anchor.glb")

# -------------------------------------------------------------------------
# 18. Crystal Theater Mirror (CO3 The Crystal Theater)
# -------------------------------------------------------------------------
def gen_crystal_theater_mirror():
    clear_scene()
    col = bpy.data.collections.new("CrystalTheaterMirror")
    bpy.context.scene.collection.children.link(col)

    mat_gold = make_mat("Theater_GildedGold", (0.90, 0.75, 0.25, 1.0), roughness=0.22, metalness=0.92)
    mat_velvet = make_mat("Theater_CrimsonVelvet", (0.55, 0.05, 0.12, 1.0), roughness=0.9, metalness=0.0)
    mat_mirror = make_mat("Theater_CrystalMirror", (0.85, 0.95, 1.0, 1.0), roughness=0.02, metalness=0.95, emissive=(0.2, 0.6, 0.9, 1.0), strength=2.0)

    # Heavy baroque frame
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 1.6))
    frame = bpy.context.active_object
    frame.scale = (1.8, 0.14, 2.6)
    bpy.ops.object.transform_apply(scale=True)
    frame.data.materials.append(mat_gold)

    # Cutout mirror glass face
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.04, 1.6))
    glass = bpy.context.active_object
    glass.name = "DuchessSeraphinaMirror"
    glass.scale = (1.45, 0.04, 2.25)
    bpy.ops.object.transform_apply(scale=True)
    glass.data.materials.append(mat_mirror)

    # Draped side theater velvet curtains
    for cx in [-1.05, 1.05]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.22, depth=2.8, location=(cx, -0.08, 1.6))
        drape = bpy.context.active_object
        drape.data.materials.append(mat_velvet)

    # Top Crown Crest
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.32, location=(0, 0, 3.05))
    crest = bpy.context.active_object
    crest.data.materials.append(mat_gold)

    export_glb("crystal_theater_mirror.glb")

# -------------------------------------------------------------------------
# 19. Steampunk Boiler (Outer Wards & Gatehouses: OW1, GH1, GH2, GH3, GH4)
# -------------------------------------------------------------------------
def gen_steampunk_boiler():
    clear_scene()
    col = bpy.data.collections.new("SteampunkBoiler")
    bpy.context.scene.collection.children.link(col)

    mat_iron = make_mat("Boiler_RivetedIron", (0.22, 0.24, 0.26, 1.0), roughness=0.45, metalness=0.88)
    mat_copper = make_mat("Boiler_CopperPipes", (0.78, 0.42, 0.22, 1.0), roughness=0.3, metalness=0.88)
    mat_brass = make_mat("Boiler_BrassGauges", (0.85, 0.65, 0.20, 1.0), roughness=0.25, metalness=0.92)
    mat_fire = make_mat("Boiler_FireGlow", (1.0, 0.45, 0.1, 1.0), roughness=0.3, metalness=0.0, emissive=(1.0, 0.4, 0.05, 1.0), strength=3.5)

    # Main Horizontal Cylindrical Tank
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.65, depth=1.8, location=(0, 0, 1.1))
    tank = bpy.context.active_object
    tank.rotation_euler = (0, math.radians(90), 0)
    bpy.ops.object.transform_apply(rotation=True)
    tank.data.materials.append(mat_iron)

    # 3 Rivet Bands
    for bx in [-0.75, 0, 0.75]:
        bpy.ops.mesh.primitive_torus_add(major_radius=0.68, minor_radius=0.04, location=(bx, 0, 1.1))
        band = bpy.context.active_object
        band.rotation_euler = (0, math.radians(90), 0)
        bpy.ops.object.transform_apply(rotation=True)
        band.data.materials.append(mat_copper)

    # Heavy Iron Leg Saddles
    for sx in [-0.65, 0.65]:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(sx, 0, 0.35))
        saddle = bpy.context.active_object
        saddle.scale = (0.22, 1.2, 0.7)
        bpy.ops.object.transform_apply(scale=True)
        saddle.data.materials.append(mat_iron)

    # Firebox Door with Glow
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.66, 0.95))
    fdoor = bpy.context.active_object
    fdoor.scale = (0.45, 0.08, 0.45)
    bpy.ops.object.transform_apply(scale=True)
    fdoor.data.materials.append(mat_fire)

    # Chimney Stack
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.18, depth=1.2, location=(-0.5, 0, 2.1))
    chimney = bpy.context.active_object
    chimney.data.materials.append(mat_iron)

    # 2 Brass Pressure Dial Gauges on front
    for gx in [0.2, 0.5]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.12, depth=0.06, location=(gx, -0.65, 1.2))
        gauge = bpy.context.active_object
        gauge.rotation_euler = (math.radians(90), 0, 0)
        bpy.ops.object.transform_apply(rotation=True)
        gauge.data.materials.append(mat_brass)

    export_glb("steampunk_boiler.glb")

# -------------------------------------------------------------------------
# 20. Starlight Planter (Rooftop Gardens RG1..RG4)
# -------------------------------------------------------------------------
def gen_starlight_planter():
    clear_scene()
    col = bpy.data.collections.new("StarlightPlanter")
    bpy.context.scene.collection.children.link(col)

    mat_stone = make_mat("Planter_CarvedStone", (0.50, 0.52, 0.56, 1.0), roughness=0.7, metalness=0.05)
    mat_flora = make_mat("Planter_StarlightFlora", (0.2, 0.85, 0.6, 1.0), roughness=0.4, metalness=0.1, emissive=(0.3, 0.9, 0.65, 1.0), strength=2.8)
    mat_bloom = make_mat("Planter_StarlightBloom", (0.9, 0.4, 0.9, 1.0), roughness=0.3, metalness=0.1, emissive=(0.95, 0.45, 0.95, 1.0), strength=3.5)

    # Octagonal Gothic Stone Basin
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.75, depth=0.65, location=(0, 0, 0.35))
    basin = bpy.context.active_object
    basin.data.materials.append(mat_stone)

    # Upper basin lip
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.85, depth=0.12, location=(0, 0, 0.72))
    lip = bpy.context.active_object
    lip.data.materials.append(mat_stone)

    # Foliage Bush
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.6, location=(0, 0, 0.95))
    bush = bpy.context.active_object
    bush.scale = (1.0, 1.0, 0.75)
    bpy.ops.object.transform_apply(scale=True)
    bush.data.materials.append(mat_flora)

    # Glowing celestial blossoms
    for bx, by, bz in [(-0.3, 0.2, 1.25), (0.35, -0.15, 1.3), (-0.1, -0.35, 1.28), (0.2, 0.35, 1.22)]:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.12, location=(bx, by, bz))
        bloom = bpy.context.active_object
        bloom.data.materials.append(mat_bloom)

    export_glb("starlight_planter.glb")

def main():
    print("=== STARTING VEILKEEP INTERACTABLE & ROOM THEME ASSET GENERATION ===")
    gen_archival_lectern()
    gen_patrol_desk()
    gen_vent_grate()
    gen_servant_hearth()
    gen_barracks_armory()
    gen_escher_anchor()
    gen_chronomantic_astrolabe()
    gen_glass_armonica()
    gen_warden_desk()
    gen_rooftop_anemometer()
    gen_celestial_telescope()
    gen_starmap_pedestal()
    gen_alchemist_bench()
    gen_mimic_chest()
    gen_monk_sarcophagus()
    gen_aeolian_belfry()
    gen_void_rift_anchor()
    gen_crystal_theater_mirror()
    gen_steampunk_boiler()
    gen_starlight_planter()
    print("=== ALL 20 BESPOKE ASSETS SUCCESSFULLY GENERATED ===")

if __name__ == "__main__":
    main()
