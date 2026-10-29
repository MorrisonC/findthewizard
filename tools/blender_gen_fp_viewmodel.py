"""Blender 5.2 generator for Kaelen's first-person Shadowhand viewmodel.

Produces:
  threejs/public/assets/models/fp_shadowhand.glb   (Y-up, grip at origin)
  gdd/assets/fp_shadowhand_preview.png

Coordinate contract (Blender, Z-up):
  - grip centre at (0,0,0)
  - blade extends toward -Y (game forward) and curves up (+Z)
  - forearm extends toward +Y / +X (toward the camera, screen right)
  - back of the hand faces +Z (up)

Run: blender --background --python tools/blender_gen_fp_viewmodel.py
"""
import bpy
import math
import os
from mathutils import Vector

ROOT = "C:/Development/findthewizard"
OUT_GLB = f"{ROOT}/threejs/public/assets/models/fp_shadowhand.glb"
OUT_PREVIEW = f"{ROOT}/gdd/assets/fp_shadowhand_preview.png"


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures,
                 bpy.data.actions, bpy.data.cameras, bpy.data.lights):
        for item in list(coll):
            coll.remove(item)


def material(name, color, roughness=0.6, metallic=0.0, emission=None, strength=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (*color, 1.0)
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Metallic'].default_value = metallic
        if emission is not None:
            if 'Emission Color' in bsdf.inputs:
                bsdf.inputs['Emission Color'].default_value = (*emission, 1.0)
                bsdf.inputs['Emission Strength'].default_value = strength
            elif 'Emission' in bsdf.inputs:
                bsdf.inputs['Emission'].default_value = (*emission, 1.0)
    mat.diffuse_color = (*color, 1.0)
    return mat


def bevel(obj, width=0.004, segments=2):
    mod = obj.modifiers.new("Bevel", 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(40)


def finish(obj, name, mat, smooth=True, bev=0.003, bev_segments=2):
    obj.name = name
    obj.data.name = name
    obj.data.materials.append(mat)
    if bev > 0:
        bevel(obj, bev, bev_segments)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def rod(a, b, radius, mat, name, verts=10, r2=None):
    """Cylinder / tapered rod between two points."""
    a = Vector(a)
    b = Vector(b)
    d = b - a
    length = d.length
    if length < 1e-6:
        length = 1e-4
    r1 = radius
    r2 = radius if r2 is None else r2
    if abs(r2 - r1) < 1e-6:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r1, depth=length, location=(0, 0, 0))
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=length, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = d.to_track_quat('Z', 'Y')
    obj.location = (a + b) * 0.5
    return finish(obj, name, mat, smooth=True, bev=0.0015, bev_segments=1)


def box(name, loc, dims, mat, bev=0.004, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    obj = bpy.context.active_object
    obj.dimensions = dims
    obj.rotation_euler = rot
    return finish(obj, name, mat, smooth=True, bev=bev, bev_segments=2)


def sphere(name, loc, radius, mat, scale=(1, 1, 1), subdiv=2, smooth=True):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=radius, location=loc)
    obj = bpy.context.active_object
    obj.scale = scale
    return finish(obj, name, mat, smooth=smooth, bev=0.0)


def cylinder(name, loc, radius, depth, mat, rot=(math.pi / 2, 0, 0), verts=16, bev=0.0015):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    return finish(obj, name, mat, smooth=True, bev=bev, bev_segments=1)


def build_blade(mat_blade, mat_rune):
    """Curved single-edged fang blade in the Y-Z plane, thickness on X."""
    samples = 12
    verts = []
    faces = []
    rune_quads = []
    for i in range(samples + 1):
        t = i / samples
        y = -0.062 - 0.372 * t
        centre_z = 0.020 + 0.118 * (t ** 1.75)
        half_thick = 0.0072 * (1.0 - 0.80 * t)
        width = 0.082 * (1.0 - 0.78 * t) + 0.006
        spine_z = centre_z + width * 0.54
        edge_z = centre_z - width * 0.46
        x_off = 0.012 * math.sin(t * math.pi) * (1.0 - t)
        # wedge cross-section: thick spine, sharp edge
        verts.extend([
            (x_off - half_thick, y, spine_z),
            (x_off + half_thick, y, spine_z),
            (x_off + half_thick * 0.18, y, edge_z),
            (x_off - half_thick * 0.18, y, edge_z),
        ])
        if i > 0:
            b = (i - 1) * 4
            c = i * 4
            for k in range(4):
                k2 = (k + 1) % 4
                faces.append((b + k, b + k2, c + k2, c + k))
        # rune strip follows the spine, floating a hair off each flat
        if 1 <= i <= samples - 2:
            rz = spine_z - 0.011
            for side in (-1, 1):
                x = x_off + side * (half_thick + 0.0010)
                rune_quads.append((x, y, rz))
    # caps
    faces.append((0, 3, 2, 1))
    last = samples * 4
    faces.append((last, last + 1, last + 2, last + 3))
    mesh = bpy.data.meshes.new("VK_Blade_Obsidian")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("VK_Blade_Obsidian", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat_blade)
    bevel(obj, 0.0018, 2)
    for p in obj.data.polygons:
        p.use_smooth = True

    # Build two thin rune ribbons (left/right flat) from paired sample points.
    verts2, faces2 = [], []
    for side in (0, 1):
        base = len(verts2)
        pts = [rune_quads[i] for i in range(side, len(rune_quads), 2)]
        for (x, y, z) in pts:
            verts2.append((x, y, z + 0.0035))
            verts2.append((x, y, z - 0.0035))
        for i in range(len(pts) - 1):
            a = base + i * 2
            faces2.append((a, a + 1, a + 3, a + 2))
    mesh2 = bpy.data.meshes.new("VK_Rune_Violet")
    mesh2.from_pydata(verts2, [], faces2)
    mesh2.update()
    rune = bpy.data.objects.new("VK_Rune_Violet", mesh2)
    bpy.context.collection.objects.link(rune)
    rune.data.materials.append(mat_rune)
    return obj, rune


def build_viewmodel():
    clear_scene()
    col = bpy.data.collections.new("FP_Shadowhand")
    bpy.context.scene.collection.children.link(col)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children[col.name]

    mat_blade = material("VK_Blade_Obsidian", (0.055, 0.065, 0.095), roughness=0.22, metallic=0.92)
    mat_rune = material("VK_Rune_Violet", (0.52, 0.30, 0.95), roughness=0.15,
                        emission=(0.62, 0.36, 1.0), strength=2.6)
    mat_brass = material("VK_Brass_Aged", (0.55, 0.38, 0.13), roughness=0.32, metallic=0.95)
    mat_grip = material("VK_Grip_Leather", (0.075, 0.048, 0.032), roughness=0.86)
    mat_glove = material("VK_Glove_Leather", (0.040, 0.028, 0.022), roughness=0.78)
    mat_sleeve = material("VK_Sleeve_Purple", (0.095, 0.050, 0.150), roughness=0.9)
    mat_gem = material("VK_Gem_Amethyst", (0.55, 0.32, 0.95), roughness=0.08, metallic=0.15,
                       emission=(0.62, 0.30, 1.0), strength=1.8)

    parts = []

    # ---- blade + rune -------------------------------------------------------
    blade, rune = build_blade(mat_blade, mat_rune)
    parts.extend([blade, rune])

    # ---- guard / grip / pommel ---------------------------------------------
    guard = cylinder("VK_Guard_Brass", (0, -0.062, 0.020), 0.011, 0.128, mat_brass,
                     rot=(0, math.pi / 2, 0), verts=10, bev=0.002)
    parts.append(guard)
    for sx in (-1, 1):
        parts.append(sphere(f"VK_GuardKnob_{sx}", (sx * 0.065, -0.062, 0.024), 0.015,
                            mat_brass, scale=(1, 1.3, 1)))
    # down-curved quillon fangs
    parts.append(rod((0.0, -0.066, 0.010), (0.052, -0.088, -0.022), 0.008, mat_brass,
                     "VK_Quillon_L", verts=8, r2=0.003))
    parts.append(rod((0.0, -0.066, 0.010), (-0.038, -0.084, -0.014), 0.007, mat_brass,
                     "VK_Quillon_R", verts=8, r2=0.003))

    grip = cylinder("VK_Grip_Leather", (0, 0.032, 0.006), 0.0205, 0.135, mat_grip,
                    rot=(math.pi / 2, 0, 0), verts=14, bev=0.002)
    parts.append(grip)
    for i in range(5):
        y = -0.022 + i * 0.028
        bpy.ops.mesh.primitive_torus_add(major_radius=0.0215, minor_radius=0.0026,
                                         location=(0, y, 0.006),
                                         rotation=(math.pi / 2, 0, 0),
                                         major_segments=14, minor_segments=6)
        wrap = bpy.context.active_object
        parts.append(finish(wrap, f"VK_GripWrap_{i}", mat_brass, smooth=True, bev=0.0))

    parts.append(sphere("VK_Pommel", (0, 0.106, 0.006), 0.022, mat_brass, scale=(1, 0.9, 1)))
    parts.append(sphere("VK_Gem_Amethyst", (0, 0.123, 0.006), 0.015, mat_gem,
                        scale=(1, 1.1, 1), subdiv=2))
    # small brass claws cradling the gem
    for i in range(4):
        ang = i * math.pi / 2 + math.pi / 4
        parts.append(rod((0.011 * math.cos(ang), 0.103, 0.006 + 0.011 * math.sin(ang)),
                         (0.023 * math.cos(ang), 0.123, 0.006 + 0.023 * math.sin(ang)),
                         0.004, mat_brass, f"VK_GemClaw_{i}", verts=6, r2=0.002))

    # ---- hand ---------------------------------------------------------------
    # palm sits behind (+Z) the grip; shifted back so the guard reads clearly
    palm = box("VK_Glove_Palm", (-0.008, 0.022, 0.060), (0.082, 0.104, 0.052), mat_glove, bev=0.014)
    parts.append(palm)
    # wrist / cuff
    parts.append(rod((0.004, 0.082, 0.042), (0.012, 0.130, 0.032), 0.040, mat_glove,
                     "VK_Glove_Wrist", verts=14, r2=0.036))
    cuff = cylinder("VK_Bracer_Cuff", (0.014, 0.133, 0.032), 0.044, 0.030, mat_brass,
                    rot=(math.pi / 2, 0, 0), verts=14, bev=0.002)
    cuff.rotation_euler = (math.radians(84), 0, math.radians(-6))
    parts.append(cuff)

    # four fingers wrapping the grip (stacked along Y)
    finger_ys = [-0.036, -0.009, 0.018, 0.045]
    for fi, fy in enumerate(finger_ys):
        p0 = (0.014, fy, 0.080)
        p1 = (0.046, fy, 0.046)
        p2 = (0.040, fy, 0.001)
        p3 = (0.003, fy, -0.021)
        r = 0.0145 - fi * 0.0006
        parts.append(sphere(f"VK_Knuckle_{fi}", p1, r * 1.08, mat_glove, scale=(1, 1, 0.95)))
        parts.append(rod(p0, p1, r, mat_glove, f"VK_FingerA_{fi}", verts=8, r2=r * 0.96))
        parts.append(rod(p1, p2, r * 0.96, mat_glove, f"VK_FingerB_{fi}", verts=8, r2=r * 0.9))
        parts.append(rod(p2, p3, r * 0.9, mat_glove, f"VK_FingerC_{fi}", verts=8, r2=r * 0.72))
        # knuckle stud
        parts.append(sphere(f"VK_Stud_{fi}", (0.048, fy, 0.060), 0.005, mat_brass,
                            scale=(1, 1, 0.7), subdiv=1))
    # thumb across the front-left of the fist
    parts.append(rod((-0.044, 0.030, 0.082), (-0.058, 0.004, 0.038), 0.017, mat_glove,
                     "VK_ThumbA", verts=10, r2=0.015))
    parts.append(rod((-0.058, 0.004, 0.038), (-0.030, -0.028, 0.008), 0.015, mat_glove,
                     "VK_ThumbB", verts=10, r2=0.011))

    # ---- bracer / forearm / sleeve -----------------------------------------
    parts.append(rod((0.012, 0.137, 0.032), (0.088, 0.322, 0.000), 0.041, mat_glove,
                     "VK_Forearm_Leather", verts=14, r2=0.035))
    # low brass wrist guard hugging the top of the cuff
    wrist_guard = box("VK_Wrist_Guard", (0.010, 0.110, 0.071), (0.074, 0.064, 0.016), mat_brass,
                      bev=0.006, rot=(math.radians(-6), 0, math.radians(-3)))
    parts.append(wrist_guard)
    for i, y in enumerate((0.166, 0.244)):
        strap = cylinder(f"VK_Bracer_Strap_{i}", (0.026 + i * 0.026, y, 0.016),
                         0.044 - i * 0.002, 0.024, mat_brass, rot=(math.radians(90), 0, math.radians(-18)),
                         verts=14, bev=0.002)
        parts.append(strap)
    # sleeve
    parts.append(rod((0.080, 0.312, 0.002), (0.128, 0.412, -0.026), 0.050, mat_sleeve,
                     "VK_Sleeve_Purple", verts=14, r2=0.062))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.052, minor_radius=0.007,
                                     location=(0.084, 0.322, 0.000),
                                     rotation=(math.radians(90), 0, math.radians(-18)),
                                     major_segments=14, minor_segments=6)
    parts.append(finish(bpy.context.active_object, "VK_Sleeve_Cuff", mat_brass, smooth=True, bev=0.0))

    # ---- join under one root ------------------------------------------------
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # parent all parts to an empty at the grip
    root = bpy.data.objects.new("FP_Shadowhand_Root", None)
    bpy.context.collection.objects.link(root)
    root.empty_display_size = 0.06
    for p in parts:
        p.parent = root
        p.matrix_parent_inverse = root.matrix_world.inverted()

    tri_count = 0
    for p in parts:
        tri_count += sum(max(0, len(poly.vertices) - 2) for poly in p.data.polygons)

    return root, parts, tri_count


def setup_preview_and_render(root):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = OUT_PREVIEW
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass

    try:
        scene.view_settings.view_transform = 'Standard'
        scene.view_settings.look = 'None'
        scene.view_settings.exposure = -0.25
    except Exception:
        pass

    world = bpy.data.worlds.new("FP_PreviewWorld")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.012, 0.018, 0.032, 1.0)
        bg.inputs[1].default_value = 1.0
    scene.world = world

    def area(name, loc, rot, power, color, size):
        data = bpy.data.lights.new(name, 'AREA')
        data.energy = power
        data.color = color
        data.size = size
        obj = bpy.data.objects.new(name, data)
        obj.location = loc
        obj.rotation_euler = rot
        scene.collection.objects.link(obj)
        return obj

    area("Key", (0.55, 0.65, 0.75), (math.radians(52), 0, math.radians(45)), 45,
         (1.0, 0.86, 0.68), 0.8)
    area("Rim", (-0.55, 0.35, 0.35), (math.radians(75), 0, math.radians(-60)), 22,
         (0.42, 0.55, 1.0), 0.7)
    area("Under", (0.10, -0.25, -0.25), (math.radians(-110), 0, 0), 7,
         (0.55, 0.32, 1.0), 0.5)

    cam_data = bpy.data.cameras.new("FP_PreviewCam")
    cam_data.lens = 58
    cam = bpy.data.objects.new("FP_PreviewCam", cam_data)
    cam.location = (0.36, 0.70, 0.46)
    scene.collection.objects.link(cam)
    scene.camera = cam
    target = Vector((0.0, -0.14, 0.04))
    direction = target - Vector(cam.location)
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

    bpy.ops.render.render(write_still=True)
    return OUT_PREVIEW


def export_glb(root, parts):
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_materials='EXPORT',
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )
    print(f"Exported {OUT_GLB}")


def main():
    root, parts, tri_count = build_viewmodel()
    print(f"FP_SHADOWHAND_PARTS {len(parts)} TRIS {tri_count}")
    # Measure authored bounds before export.
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for p in parts:
        for corner in p.bound_box:
            w = p.matrix_world @ Vector(corner)
            mn = Vector((min(mn.x, w.x), min(mn.y, w.y), min(mn.z, w.z)))
            mx = Vector((max(mx.x, w.x), max(mx.y, w.y), max(mx.z, w.z)))
    print(f"FP_SHADOWHAND_BOUNDS min={tuple(round(v,3) for v in mn)} max={tuple(round(v,3) for v in mx)} size={tuple(round(mx[i]-mn[i],3) for i in range(3))}")
    preview = setup_preview_and_render(root)
    print(f"PREVIEW {preview}")
    # Remove preview objects so they never reach the GLB even if selection leaks.
    for name in ("Key", "Rim", "Under", "FP_PreviewCam"):
        obj = bpy.data.objects.get(name)
        if obj:
            bpy.data.objects.remove(obj, do_unlink=True)
    export_glb(root, parts)
    print("FP_SHADOWHAND_BUILD_COMPLETE")


if __name__ == "__main__":
    main()
