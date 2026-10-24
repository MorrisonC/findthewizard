"""VEILKEEP modular room kit. Run with Blender 5.2:
blender --background --python tools/build_veilkeep_room_kit.py
Builds three metre-scale, origin-centred, material-batched GLBs and preview panels.
Composite the panels into the final contact sheet with tools/compose_room_kit_preview.py.
"""
import bpy, bmesh, math, random, os, json
from mathutils import Vector
from collections import defaultdict

ROOT = 'C:/Development/findthewizard'
OUT = ROOT + '/threejs/public/assets/models'
PREVIEW_DIR = ROOT + '/gdd/assets/room_kit_panels'
os.makedirs(OUT, exist_ok=True)
os.makedirs(PREVIEW_DIR, exist_ok=True)
random.seed(83)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
    if c.name != 'Collection':
        bpy.data.collections.remove(c)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0
base_collection = bpy.data.collections.get('Collection')
base_collection.name = 'VEILKEEP_Room_Kit'


def collection(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c


def material(name, color, roughness=.78, metallic=0.0, emission=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = metallic
    if emission:
        p.inputs['Emission Color'].default_value = (*emission, 1)
        p.inputs['Emission Strength'].default_value = strength
    return m

stone = material('VK_Slate_BlueBlack', (.095, .135, .19))
stone_mid = material('VK_Slate_Worn', (.16, .205, .26))
stone_edge = material('VK_Slate_Pale_Edges', (.23, .285, .34))
dark = material('VK_Recess_Midnight', (.025, .04, .07), .9)
mortar = material('VK_Mortar_Deep_Navy', (.045, .065, .095), .95)
metal = material('VK_Iron_Cold_Forged', (.11, .14, .18), .38, .65)
bronze = material('VK_Bronze_Aged', (.25, .16, .075), .48, .65)
amber = material('VK_Amber_Exit_Inlay', (.7, .25, .045), .32, 0, (1, .32, .055), 2.2)
violet = material('VK_Veil_Amethyst', (.24, .075, .38), .38, 0, (.55, .12, .9), 1.8)
mirror_mat = material('VK_Mirror_Violet_Surface', (.12, .035, .22), .22, .25, (.38, .055, .72), 1.25)
tiles = [material('VK_Floor_Slate_%02d' % i, (.125+i*.009, .165+i*.009, .21+i*.01), .86) for i in range(5)]


def move_to(o, c):
    for cc in list(o.users_collection):
        cc.objects.unlink(o)
    c.objects.link(o)


def bevel(o, width=.035, segments=1):
    if width:
        b = o.modifiers.new('Hand_worn_bevel', 'BEVEL')
        b.width = width
        b.segments = segments
        b.limit_method = 'ANGLE'
        b.harden_normals = True
        w = o.modifiers.new('Weighted_corner_normals', 'WEIGHTED_NORMAL')
        w.keep_sharp = True
        w.weight = 40
    return o


def finish(o, name, mat, c, bev=.035, segments=1, smooth=False):
    o.name = name
    move_to(o, c)
    if mat:
        o.data.materials.append(mat)
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = len(p.vertices) == 4
    bevel(o, bev, segments)
    return o


def box(name, loc, dims, mat, c, bev=.035, rz=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.dimensions = dims
    o.rotation_euler.z = rz
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, name, mat, c, bev)


def cyl(name, loc, radius, depth, mat, c, verts=12, bev=.025, r2=None, rotation=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=radius, radius2=r2, depth=depth, location=loc)
    o = bpy.context.object
    if rotation:
        o.rotation_euler = rotation
    return finish(o, name, mat, c, bev, smooth=True)


def rod(name, a, b, radius, mat, c, verts=8, r2=None, bev=.008):
    a, b = Vector(a), Vector(b)
    d = b-a
    o = cyl(name, (a+b)/2, radius, d.length, mat, c, verts, bev, r2)
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return o


def mesh(name, verts, faces, mat, c, bev=0):
    me = bpy.data.meshes.new(name + '_Mesh')
    me.from_pydata(verts, [], faces)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    c.objects.link(o)
    if mat:
        me.materials.append(mat)
    bevel(o, bev)
    return o


def arch_wedge(name, a0, a1, inner, outer, spring, yfront, yback, mat, c):
    vs = []
    for y in (yfront, yback):
        for r, a in ((inner,a0), (inner,a1), (outer,a1), (outer,a0)):
            vs.append((r*math.cos(a), y, spring+r*math.sin(a)))
    return mesh(name, vs, [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)], mat, c, .022)


def elliptic_ring(name, center, rx, rz, width, depth, mat, c, n=32, bev=.012):
    cx, cy, cz = center
    vs = []
    for y in (cy-depth/2, cy+depth/2):
        for rxo, rzo in ((rx,rz), (rx-width,rz-width)):
            for i in range(n):
                a = math.tau*i/n
                vs.append((cx+rxo*math.cos(a), y, cz+rzo*math.sin(a)))
    fs = []
    for i in range(n):
        j = (i+1)%n
        fs.extend([(i,j,n+j,n+i), (2*n+i,3*n+i,3*n+j,2*n+j),
                   (i,2*n+i,2*n+j,j), (n+i,n+j,3*n+j,3*n+i)])
    return mesh(name, vs, fs, mat, c, bev)


def ellipse_disc(name, center, rx, rz, depth, mat, c, n=32):
    cx, cy, cz = center
    vs = []
    for y in (cy-depth/2, cy+depth/2):
        for i in range(n):
            a = math.tau*i/n
            vs.append((cx+rx*math.cos(a), y, cz+rz*math.sin(a)))
    fs = [tuple(reversed(range(n))), tuple(range(n,2*n))]
    for i in range(n):
        j = (i+1)%n
        fs.append((i,j,n+j,n+i))
    return mesh(name, vs, fs, mat, c, .008)


def batch_asset(label, coll):
    """Apply modifiers/transforms, join by material, retain a clean origin-centred root."""
    objects = [o for o in coll.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        for mod in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
        o.select_set(False)
    groups = defaultdict(list)
    for o in objects:
        key = o.data.materials[0].name if o.data.materials else 'Unassigned'
        groups[key].append(o)
    root = bpy.data.objects.new(label, None)
    coll.objects.link(root)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = .35
    root['asset_units'] = 'metres; base at Blender Z=0; glTF Y-up'
    for key, obs in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = obs[0]
        bpy.ops.object.join()
        o = bpy.context.object
        short = key.replace('VK_', '')
        o.name = label + '_' + short
        o.data.name = o.name + '_Mesh'
        o.parent = root
        o.select_set(False)
    return root, [o for o in coll.objects if o.type == 'MESH']


def export_asset(path, coll):
    bpy.ops.object.select_all(action='DESELECT')
    for o in coll.objects:
        o.hide_set(False)
        o.select_set(True)
    bpy.context.view_layer.objects.active = next(o for o in coll.objects if o.type == 'MESH')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_materials='EXPORT',
        export_cameras=False, export_lights=False, export_extras=True)

# ---------------------------------------------------------------- Room shell
room = collection('01_Room_Shell')
box('Room_Foundation', (0,0,-.28), (12.35,12.35,.56), stone, room, .14, )
box('Room_Shadow_Course', (0,0,-.075), (12.12,12.12,.18), dark, room, .045)
box('Room_Grout_Bed', (0,0,-.005), (11.95,11.95,.16), mortar, room, .035)
for ix in range(12):
    for iy in range(12):
        x, y = ix-5.5, iy-5.5
        box('Room_Flagstone_%02d_%02d' % (ix,iy), (x,y,.065+random.uniform(-.006,.006)),
            (.955,.955,.14), random.choice(tiles), room, .032)
# Low modular rim, blocks remain below character sightlines.
for side in (-1,1):
    for i in range(12):
        p = i-5.5
        h = .66 + (.08 if i%4 == 0 else 0)
        box('Room_Rim_X', (side*5.82,p,.14+h/2), (.48,.93,h), stone_mid if i%3 else stone_edge, room, .05)
        box('Room_Rim_Y', (p,side*5.82,.14+h/2), (.93,.48,h), stone_mid if i%3 else stone_edge, room, .05)
# Coping and four slightly taller corner trims.
for side in (-1,1):
    for i in range(11):
        p = i-5
        box('Room_Coping_X', (side*5.82,p,.86), (.55,.96,.15), stone, room, .035)
        box('Room_Coping_Y', (p,side*5.82,.86), (.96,.55,.15), stone, room, .035)
for x in (-5.72,5.72):
    for y in (-5.72,5.72):
        box('Room_Corner_Plinth', (x,y,.20), (.82,.82,.28), stone, room, .065)
        box('Room_Corner_Trim', (x,y,.67), (.65,.65,.72), stone_mid, room, .065)
        box('Room_Corner_Cap', (x,y,1.08), (.82,.82,.18), stone_edge, room, .045)
room_root, room_meshes = batch_asset('RoomShell', room)
export_asset(OUT + '/room_shell.glb', room)

# ---------------------------------------------------------------- Gate arch
gate = collection('02_Gate_Arch')
# Broad feet and stepped side buttresses.
for s in (-1,1):
    box('Gate_Foot', (s*1.83,0,.15), (1.25,1.65,.30), stone, gate, .08)
    box('Gate_Plinth', (s*1.83,0,.40), (1.02,1.40,.24), stone_mid, gate, .055)
    for row in range(5):
        box('Gate_Pylon_Ashlar', (s*1.72,0,.76+row*.48), (.78,1.12,.445),
            stone_mid if row%2 else stone, gate, .045)
    box('Gate_Outer_Buttress', (s*2.18,.15,1.35), (.40,1.30,1.90), stone, gate, .06)
    box('Gate_Buttress_Cap', (s*2.18,.12,2.34), (.54,1.43,.18), stone_mid, gate, .04)
    # Jamb frames the clear 2.4m opening.
    for row in range(5):
        box('Gate_Jamb', (s*1.36,-.03,.27+row*.48), (.30,1.18,.445), stone_edge, gate, .028)
# Eleven radial voussoirs; inner opening springs at 2.38m.
for i in range(11):
    a0 = math.pi*i/11 + .012
    a1 = math.pi*(i+1)/11 - .012
    arch_wedge('Gate_Voussoir_%02d'%i, a0,a1,1.20,1.68,2.38,-.60,.60,
               stone_edge if i%3 else stone_mid, gate)
# Deep blue rear recess makes the opening readable without sealing its front.
box('Gate_Deep_Recess', (0,.57,1.55), (2.34,.12,2.90), dark, gate, .025)
# Slightly raised portcullis silhouette, high enough to leave the exit clear.
for x in (-.90,-.45,0,.45,.90):
    rod('Gate_Raised_Portcullis', (x,.34,2.80), (x,.34,3.47), .026, metal, gate)
rod('Gate_Portcullis_Crossrail', (-1.04,.34,3.08),(1.04,.34,3.08),.035,metal,gate)
# Crown follows the fortified reference, with a low wall and battlements.
box('Gate_Crown_Shadow', (0,0,4.02), (4.55,1.12,.30), dark, gate, .04)
box('Gate_Crown_Course', (0,0,4.22), (4.70,1.22,.24), stone_mid, gate, .055)
for x in (-2.02,-1.02,0,1.02,2.02):
    box('Gate_Merlon', (x,0,4.66), (.65,1.10,.68), stone_mid if x else stone_edge, gate, .06)
    box('Gate_Merlon_Cap', (x,0,5.02), (.74,1.18,.12), stone, gate, .035)
# Restrained amber exit runes on the front jambs and violet keystone.
for s in (-1,1):
    box('Gate_Rune_Recess', (s*1.72,-.575,1.62), (.28,.055,.84), dark, gate, .03)
    box('Gate_Amber_Lancet', (s*1.72,-.611,1.62), (.075,.028,.52), amber, gate, .018)
    box('Gate_Amber_Crossbar', (s*1.72,-.626,1.62), (.19,.024,.055), amber, gate, .01)
# Small diamond inset on the central keystone.
o = box('Gate_Keystone_Veil', (0,-.627,3.72), (.16,.035,.16), violet, gate, .018)
o.rotation_euler.y = math.pi/4
gate_root, gate_meshes = batch_asset('GateArch', gate)
export_asset(OUT + '/gate_arch.glb', gate)

# ---------------------------------------------------------------- Mirror lock
mirror = collection('03_Mirror_Lock')
# Stable, faceted stand with three claw-like feet.
box('Mirror_Base_Lower', (0,0,.10), (1.40,.90,.20), stone, mirror, .07)
box('Mirror_Base_Upper', (0,0,.25), (1.08,.68,.16), metal, mirror, .045)
for s in (-1,1):
    rod('Mirror_Swept_Foot', (s*.18,.03,.30), (s*.73,-.12,.12), .105, metal, mirror, 8, .07, .015)
    box('Mirror_Foot_Toe', (s*.72,-.15,.10), (.35,.48,.16), stone_mid, mirror, .04)
rod('Mirror_Rear_Foot', (0,.15,.28),(0,.62,.10),.11,metal,mirror,8,.075,.015)
cyl('Mirror_Pedestal', (0,0,.53), .25,.48,stone_mid,mirror,8,.035,r2=.19)
cyl('Mirror_Pedestal_Band', (0,0,.73), .29,.12,bronze,mirror,12,.018)
# Two structural supports reach the lower frame.
for s in (-1,1):
    rod('Mirror_Frame_Support', (s*.19,.05,.67),(s*.47,.04,1.07),.065,bronze,mirror,8,.05,.012)
    cyl('Mirror_Pivot', (s*.69,0,1.66), .13,.20,bronze,mirror,12,.018,
        rotation=(math.pi/2,0,0))
# Layered elliptical frame, surface facing Blender -Y (Three.js +Z after glTF conversion).
ellipse_disc('Mirror_Back', (0,.035,1.79), .70,1.04,.16,dark,mirror)
elliptic_ring('Mirror_Outer_Frame', (0,0,1.79), .76,1.10,.13,.24,metal,mirror,32,.018)
elliptic_ring('Mirror_Bronze_Inner_Lip', (0,-.105,1.79), .655,.995,.045,.08,bronze,mirror,32,.009)
ellipse_disc('Mirror_Violet_Surface', (0,-.095,1.79), .565,.895,.045,mirror_mat,mirror,32)
# Ornament: cardinal clasps, small rivets, and restrained runic ticks.
for a in (0,math.pi/2,math.pi,3*math.pi/2):
    x = .745*math.cos(a); z = 1.79+1.085*math.sin(a)
    o = box('Mirror_Cardinal_Clasp', (x,-.035,z), (.20,.28,.20), bronze, mirror, .03)
    o.rotation_euler.y = -a
for i in range(12):
    a = math.tau*i/12
    x = .705*math.cos(a); z = 1.79+1.045*math.sin(a)
    cyl('Mirror_Frame_Rivet', (x,-.14,z), .032,.035,stone_edge,mirror,8,.006,
        rotation=(math.pi/2,0,0))
# Crown finial and suspended violet key-stone.
cyl('Mirror_Crown_Base', (0,0,2.94), .18,.15,bronze,mirror,8,.015)
cyl('Mirror_Crown_Finial', (0,0,3.14), .14,.32,metal,mirror,6,.012,r2=.025)
rod('Mirror_Key_Drop', (0,-.14,2.86),(0,-.14,2.67),.018,bronze,mirror,6)
o = box('Mirror_Veil_Key', (0,-.15,2.61), (.13,.08,.18), violet, mirror, .018)
o.rotation_euler.y = math.pi/4
# A few very subtle glowing glyphs directly on the mirror, leaving most surface quiet.
for x,z,w in ((-.19,1.90,.14),(.17,1.55,.12),(0,2.25,.16)):
    box('Mirror_Surface_Glyph', (x,-.123,z), (w,.014,.022), violet, mirror, .006)
    box('Mirror_Surface_Glyph_Stem', (x,-.124,z+.055), (.022,.014,.11), violet, mirror, .006)
mirror_root, mirror_meshes = batch_asset('MirrorLock', mirror)
export_asset(OUT + '/mirror_lock.glb', mirror)

# Save editable source scene with all three kits at origin in separate collections.
bpy.ops.wm.save_as_mainfile(filepath=OUT + '/veilkeep_room_kit.blend')

# -------------------------------------------------------------- Preview setup
preview = collection('90_Preview_Studio')
world = bpy.data.worlds.new('VK_Moonlit_Preview_World')
scene.world = world
world.use_nodes = True
world.node_tree.nodes.get('Background').inputs['Color'].default_value = (.035,.055,.09,1)
world.node_tree.nodes.get('Background').inputs['Strength'].default_value = .32

def area(name, loc, power, color, size):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = power
    data.color = color
    data.shape = 'DISK'
    data.size = size
    o = bpy.data.objects.new(name,data)
    preview.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector((0,0,1.2))-o.location).to_track_quat('-Z','Y').to_euler()
    return o
area('Preview_Key_Moon', ( -4,-6,9), 1500, (.64,.76,1.0), 6)
area('Preview_Fill_Violet', (5,-1,5), 650, (.56,.42,1.0), 5)
area('Preview_Rim_Amber', (-3,4,6), 1100, (1.0,.67,.37), 4)
cam_data = bpy.data.cameras.new('Preview_Orthographic')
cam = bpy.data.objects.new('Preview_Orthographic',cam_data)
preview.objects.link(cam)
scene.camera = cam
cam_data.type = 'ORTHO'
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = 800
scene.render.resolution_y = 700
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.view_settings.view_transform = 'AgX'

# Hide model collections not being photographed; studio remains visible.
def render_panel(label, coll, camera_loc, target, ortho, filename):
    for c in (room,gate,mirror):
        c.hide_render = c != coll
        c.hide_viewport = c != coll
    cam.location = camera_loc
    cam.rotation_euler = (Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    cam_data.ortho_scale = ortho
    scene.render.filepath = PREVIEW_DIR + '/' + filename
    bpy.ops.render.render(write_still=True)

render_panel('Room shell',room,(11,-14,12),(0,0,.1),20.0,'room_shell.png')
render_panel('Gate arch',gate,(7,-10,6.5),(0,0,2.35),7.2,'gate_arch.png')
render_panel('Mirror lock',mirror,(4,-7,3.8),(0,0,1.5),4.25,'mirror_lock.png')
print('VEILKEEP_ROOM_KIT_BUILD_COMPLETE')
