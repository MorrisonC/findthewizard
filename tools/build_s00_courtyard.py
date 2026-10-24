import bpy, math, random, os, json
from mathutils import Vector
random.seed(27)
OUT='C:/Development/findthewizard/threejs/public/assets/models'
PRE='C:/Development/findthewizard/gdd/assets/s00_courtyard_model_preview.png'
os.makedirs(OUT,exist_ok=True); os.makedirs(os.path.dirname(PRE),exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.collections):
    if d.name!='Collection': bpy.data.collections.remove(d)
base=bpy.data.collections.get('Collection'); base.name='S00_Courtyard'
scene=bpy.context.scene; scene.unit_settings.system='METRIC'; scene.unit_settings.scale_length=1

def coll(name):
    c=bpy.data.collections.new(name); scene.collection.children.link(c); return c
architecture=coll('01_Architecture'); details=coll('02_Courtyard_Details'); flora=coll('03_Thorn_Gardens'); chars=coll('04_Character_Source')
def move(o,c):
    for cc in list(o.users_collection): cc.objects.unlink(o)
    c.objects.link(o)
    return o

def mat(name,color,rough=.75,metal=0,emission=None,strength=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1)
    m.use_nodes=True; p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal
    if emission:
        p.inputs['Emission Color'].default_value=(*emission,1); p.inputs['Emission Strength'].default_value=strength
    return m
stone=mat('Slate | blue-black limestone',(.095,.135,.19)); stone2=mat('Slate | worn edges',(.16,.205,.26)); stone3=mat('Slate | pale fractures',(.23,.285,.34)); dark=mat('Recess | midnight',(.025,.04,.07)); mortar=mat('Mortar | deep navy',(.045,.065,.095)); tilem=[mat('Floor slate %02d'%i,(.13+i*.009,.17+i*.009,.215+i*.01),.86) for i in range(5)]
metal=mat('Iron | cold forged',(.11,.14,.18),.38,.65); bronze=mat('Bronze | aged',(.25,.16,.075),.48,.65); amber=mat('Amber | leaded glass',(.7,.25,.045),.32,0,(1,.32,.055),3.5); violet=mat('Veil | restrained amethyst',(.24,.075,.38),.45,0,(.55,.12,.9),2.4); bark=mat('Thorn | blue charcoal',(.045,.055,.085),.9); leaf=mat('Thorn | dusty violet',(.14,.10,.20),.85)
cloth=mat('Kaelen | midnight wool',(.055,.075,.13),.95); cloth2=mat('Kaelen | folded cloak',(.10,.125,.19),.9); skin=mat('Skin | warm shadow',(.38,.25,.19),.8); leather=mat('Leather | umber',(.13,.075,.045),.85); blade=mat('Steel | silver edge',(.42,.52,.6),.28,.75); armor=mat('Guard | blued plate',(.18,.23,.29),.38,.7); guardcloth=mat('Guard | muted wine',(.22,.065,.08),.9)

def finish(o,name,material,c,bevel=.035,smooth=False):
    o.name=name; move(o,c)
    if material: o.data.materials.append(material)
    if bevel:
        mod=o.modifiers.new('Hand-worn bevel','BEVEL'); mod.width=bevel; mod.segments=2 if bevel>.05 else 1
    if smooth:
        for p in o.data.polygons: p.use_smooth=True
        mod=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL'); mod.keep_sharp=True; mod.weight=35
    return o

def box(name,loc,scale,material=stone,c=architecture,bevel=.035,rot=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=scale; o.rotation_euler[2]=rot
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,material,c,bevel)

def cyl(name,loc,r,depth,material=stone,c=architecture,verts=12,bevel=.025,r2=None):
    if r2 is None: bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=loc)
    else: bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r,radius2=r2,depth=depth,location=loc)
    return finish(bpy.context.object,name,material,c,bevel)

def ico(name,loc,scale,material,c=details,sub=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=loc); o=bpy.context.object; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,material,c,0)

def rod(name,a,b,r,material,c=details,verts=8,r2=None):
    a,b=Vector(a),Vector(b); d=b-a; o=cyl(name,(a+b)/2,r,d.length,material,c,verts,.012,r2)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); return o

def mesh(name,verts,faces,material,c=architecture,bevel=0):
    me=bpy.data.meshes.new(name+'Mesh'); me.from_pydata(verts,[],faces); me.update(); o=bpy.data.objects.new(name,me); c.objects.link(o)
    if material: me.materials.append(material)
    if bevel:
        m=o.modifiers.new('Soft chipped arris','BEVEL'); m.width=bevel; m.segments=1
    return o

# 12 x 12m floating diorama, top courtyard floor z=0; approach z=1.45
box('Diorama | bevelled basalt foundation',(0,0,-.63),(12,12,1.15),stone,architecture,.18)
box('Foundation | recessed shadow course',(0,0,-.22),(11.8,11.8,.18),dark,architecture,.06)
# courtyard flagstones, clipped circular edge and visible narrow grout
for ix in range(-5,6):
    for iy in range(-5,6):
        x=ix*.83+(iy%2)*.10; y=iy*.82
        if x*x+y*y>22.4: continue
        box('Courtyard | flagstone %d %d'%(ix,iy),(x,y,.015+random.uniform(-.012,.012)),(.77,.75,.13),random.choice(tilem),details,.035,random.uniform(-.018,.018))
# broken circular curb with intentional entrance gap toward front
for i in range(32):
    a=2*math.pi*i/32
    if 17<=i<=20: continue
    r=4.75; x,y=r*math.sin(a),r*math.cos(a)
    h=random.uniform(.25,.44)
    o=box('Rim | fractured curb %02d'%i,(x,y,.10+h/2),(.88,.38,h),random.choice([stone2,stone3]),details,.055,a+random.uniform(-.025,.025))
    if i in (4,12,25): o.rotation_euler[0]=random.uniform(-.13,.13)
# stair descending from foreground/right into court
for i in range(6):
    y=-5.65+i*.52; z=1.40-i*.225
    box('Approach | stair tread %02d'%i,(0,y,z-.14),(2.65,.59,.28),stone2,architecture,.055)
for x in (-1.57,1.57):
    for j in range(5):
        box('Stair | parapet block',(x,-5.5+j*.66,1.38-j*.15),(.42,.64,.55),stone,architecture,.06)
# approach landing and broken front edging
box('Approach | upper landing',(0,-5.55,1.38),(3.6,.9,.25),stone2,architecture,.08)
for side in (-1,1):
    for j in range(4):
        box('Approach | retaining pier',(side*(2.25+j*.83),-5.47,.61),(.76,.7,1.25),stone,architecture,.08)
# fortified rear wall, block courses with arch opening
# block grid at back y=4.9, arch centered x=0
for row in range(5):
    z=.37+row*.69
    for col in range(-6,7):
        x=col*.83+(row%2)*.15
        if abs(x)>5.25: continue
        # opening: vertical below 1.55, rounded arch above
        opening=(abs(x)<1.26 and z<1.55) or ((x*x+(z-1.55)**2)<1.42**2 and z>=1.55)
        if opening: continue
        box('Barbican | coursed ashlar %d %d'%(row,col),(x,4.86,z),(.78,.78,.63),random.choice([stone,stone,stone2]),architecture,.045)
# arch voussoirs as wedge meshes
for i in range(11):
    a0=math.pi*i/11+.018; a1=math.pi*(i+1)/11-.018
    vs=[]
    for y in (4.38,5.20):
        for r,a in ((1.26,a0),(1.26,a1),(1.68,a1),(1.68,a0)):
            vs.append((r*math.cos(a),y,1.48+r*math.sin(a)))
    mesh('Arch | radial keystone %02d'%i,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],stone3,architecture,.025)
for x in (-1.48,1.48):
    for j in range(3): box('Arch | jamb',(x,4.78,.28+j*.52),(.39,.98,.47),stone3,architecture,.035)
box('Gate | deep tunnel darkness',(0,5.16,1.22),(2.45,.15,2.4),dark,architecture,.02)
# raised portcullis bars in upper opening
for x in [-.9,-.45,0,.45,.9]: rod('Gate | raised portcullis',(x,4.34,1.7),(x,4.34,2.55),.035,metal)
rod('Gate | cross rail',(-1.08,4.34,2.2),(1.08,4.34,2.2),.045,metal)
# crenellated parapet
for x in [-5,-3.75,-2.5,-1.25,0,1.25,2.5,3.75,5]: box('Wall | merlon',(x,4.86,3.9),(.72,.88,.68),stone2,architecture,.06)
# crag towers polygonal with banding, windows, battlements
for x in (-4.25,4.25):
    cyl('Tower | lower battered plinth',(x,4.55,.45),1.23,.9,stone,verts=10,bevel=.06,r2=1.08)
    cyl('Tower | main crag shaft',(x,4.55,2.6),1.06,3.55,stone,verts=10,bevel=.045)
    for z in (1.03,3.48,4.28): cyl('Tower | projecting belt',(x,4.55,z),1.13,.18,stone2,verts=10,bevel=.025)
    cyl('Tower | crown',(x,4.55,4.48),1.23,.35,stone2,verts=10,bevel=.045)
    for k in range(10):
        if k%2==0:
            a=2*math.pi*k/10
            box('Tower | battlement',(x+1.05*math.sin(a),4.55+1.05*math.cos(a),4.92),(.53,.48,.66),stone2,architecture,.055,a)
    # amber arrow windows front and angled, dark recess and glowing slit
    for z in (2.0,3.05):
        box('Tower | window recess',(x,3.515,z),(.38,.06,.72),dark,architecture,.045)
        box('Tower | amber lancet',(x,3.474,z),(.15,.035,.49),amber,architecture,.04)
        rod('Window | mullion',(x,3.445,z-.23),(x,3.445,z+.23),.018,bronze)
    # angular roof finial
    cyl('Tower | central finial',(x,4.55,5.33),.18,.75,metal,verts=6,bevel=.015,r2=.045)
# side broken walls low enough not to obscure
for side in (-1,1):
    for j in range(5):
        y=1.8-j*.83; h=.75+(j%3)*.18
        box('Court | broken side wall',(side*5.45,y,h/2),(.55,.77,h),stone,architecture,.055)
# warm wall windows on wall faces
for x in (-2.25,2.25):
    box('Wall | window recess',(x,4.43,2.15),(.62,.055,.9),dark,architecture,.06)
    box('Wall | warm window',(x,4.39,2.15),(.40,.04,.65),amber,architecture,.035)
    rod('Window | vertical lead',(x,4.36,1.85),(x,4.36,2.45),.022,bronze)
    rod('Window | horizontal lead',(x-.2,4.36,2.15),(x+.2,4.36,2.15),.022,bronze)
# pedestals and small brazier-like violet relics
for x,y in [(-3.65,-2.4),(3.65,-2.1),(-3.4,2.0)]:
    box('Pedestal | square foot',(x,y,.13),(.85,.85,.25),stone2,details,.07)
    cyl('Pedestal | octagonal stem',(x,y,.58),.31,.72,stone,details,8,.035)
    box('Pedestal | cap',(x,y,.98),(.67,.67,.18),stone3,details,.05)
    ico('Pedestal | veil shard',(x,y,1.23),(.13,.13,.28),violet,details,1)
# rubble concentrated at rim
for i in range(22):
    a=random.uniform(0,math.tau); r=random.uniform(4.3,5.1); x,y=r*math.sin(a),r*math.cos(a)
    if y<-4.4 and abs(x)<2: continue
    o=box('Rubble | chipped block',(x,y,.12), (random.uniform(.18,.42),random.uniform(.18,.40),random.uniform(.14,.3)),random.choice([stone,stone2]),details,.04,random.random()*3)
    o.rotation_euler[0]=random.uniform(-.35,.35)
# thorn bushes: elegant angular arcs and sparse violet cores
for x,y,s in [(-4.15,-.7,1),(4.15,.4,.9),(-2.7,3.25,.8),(2.7,-3.55,.75)]:
    ico('Thorn | root mound',(x,y,.10),(.55*s,.48*s,.16),bark,flora,1)
    for k in range(7):
        a=math.tau*k/7+random.uniform(-.2,.2); h=random.uniform(.45,.9)*s
        p0=(x,y,.13); p1=(x+math.sin(a)*.30*s,y+math.cos(a)*.30*s,h*.65); p2=(x+math.sin(a)*.58*s,y+math.cos(a)*.58*s,h)
        rod('Thorn | crooked stem',p0,p1,.035*s,bark,flora,6,.022*s); rod('Thorn | hooked tip',p1,p2,.022*s,bark,flora,6,.004)
        rod('Thorn | barb',p1,(p1[0]+math.cos(a)*.19*s,p1[1]-math.sin(a)*.19*s,p1[2]+.12*s),.018*s,bark,flora,5,.002)
        if k%2==0: ico('Thorn | violet heart',(p1[0],p1[1],p1[2]),(.07*s,.07*s,.095*s),violet,flora,1)
# two subtle path runes inset at approach, restrained accents
for y in (-4.25,-3.85):
    box('Approach | runic inlay',(0,y,1.46-(y+5.65)/.52*.225),(.52,.035,.025),violet,details,.012)
# ---------------- Characters ----------------
def character_kaelen():
    before=set(bpy.data.objects)
    x,y=8,0
    # boots and legs
    for xx in (-.17,.17):
        box('Kaelen | boot',(x+xx,y,.12),(.22,.38,.22),leather,chars,.045)
        rod('Kaelen | leg',(x+xx,y,.22),(x+xx*.8,y,.66),.105,cloth,chars,8)
    cyl('Kaelen | tapered tunic',(x,y,.87),.34,.72,cloth,chars,8,.035,r2=.25)
    # cloak as faceted flared shell behind body
    vs=[(x-.30,y+.12,1.32),(x+.30,y+.12,1.32),(x+.48,y+.25,.38),(x+.15,y+.34,.24),(x-.17,y+.36,.29),(x-.48,y+.25,.42),(x,y+.42,.70)]
    mesh('Kaelen | sculpted cloak',vs,[(0,1,6),(1,2,6),(2,3,6),(3,4,6),(4,5,6),(5,0,6)],cloth2,chars,.018)
    sol=bpy.context.object.modifiers.new('Cloak thickness','SOLIDIFY'); sol.thickness=.035
    # hood and recessed face
    ico('Kaelen | hood',(x,y,1.48),(.31,.27,.35),cloth,chars,2)
    ico('Kaelen | face shadow',(x,y-.235,1.48),(.18,.045,.20),dark,chars,1)
    ico('Kaelen | face',(x,y-.269,1.47),(.115,.025,.135),skin,chars,1)
    # shoulders/arms and dagger
    rod('Kaelen | left arm',(x-.24,y,1.20),(x-.43,y-.10,.84),.095,cloth,chars,8,.07)
    rod('Kaelen | right arm',(x+.24,y,1.20),(x+.44,y-.20,1.0),.095,cloth,chars,8,.065)
    rod('Kaelen | dagger grip',(x+.44,y-.20,.92),(x+.44,y-.20,1.12),.035,leather,chars,8)
    rod('Kaelen | dagger guard',(x+.31,y-.20,1.12),(x+.57,y-.20,1.12),.025,bronze,chars,8)
    mesh('Kaelen | dagger blade',[(x+.40,y-.20,1.12),(x+.48,y-.20,1.12),(x+.47,y-.20,1.55),(x+.44,y-.20,1.66)],[(0,1,2,3)],blade,chars)
    box('Kaelen | belt',(x,y-.005,.83),(.59,.47,.075),leather,chars,.02)
    box('Kaelen | buckle',(x,y-.25,.83),(.09,.035,.085),bronze,chars,.012)
    objs=set(bpy.data.objects)-before
    root=bpy.data.objects.new('Kaelen',None); chars.objects.link(root)
    for o in objs: o.parent=root; o.matrix_parent_inverse=root.matrix_world.inverted()
    return root,objs

def character_guard():
    before=set(bpy.data.objects); x,y=10,0
    for xx in (-.18,.18):
        box('Guard | sabaton',(x+xx,y-.06,.13),(.25,.4,.24),armor,chars,.045)
        rod('Guard | greave',(x+xx,y,.24),(x+xx,y,.72),.12,armor,chars,8)
    cyl('Guard | armored torso',(x,y,1.02),.36,.66,armor,chars,8,.035,r2=.30)
    cyl('Guard | skirt',(x,y,.69),.36,.30,guardcloth,chars,8,.025,r2=.29)
    for xx in (-.36,.36): ico('Guard | pauldron',(x+xx,y,1.23),(.22,.25,.16),armor,chars,1)
    rod('Guard | left arm',(x-.35,y,1.17),(x-.42,y-.04,.83),.105,armor,chars,8)
    rod('Guard | spear arm',(x+.35,y,1.17),(x+.47,y-.15,.98),.105,armor,chars,8)
    ico('Guard | helmet',(x,y,1.52),(.29,.26,.31),armor,chars,2)
    box('Guard | visor',(x,y-.245,1.52),(.43,.06,.12),dark,chars,.025)
    for xx in (-.13,0,.13): box('Guard | visor slit',(x+xx,y-.282,1.52),(.045,.015,.028),amber,chars,.006)
    cyl('Guard | helmet crest',(x,y,1.86),.075,.24,guardcloth,chars,6,.012,r2=.01)
    # spear on right, clear silhouette
    rod('Guard | spear shaft',(x+.52,y-.14,.12),(x+.52,y-.14,2.16),.033,leather,chars,8)
    mesh('Guard | spear head',[(x+.52,y-.14,2.43),(x+.45,y-.14,2.15),(x+.52,y-.18,2.20),(x+.59,y-.14,2.15),(x+.52,y-.10,2.20)],[(0,1,2),(0,2,3),(0,3,4),(0,4,1),(1,4,3,2)],blade,chars)
    # shield
    o=box('Guard | kite shield',(x-.46,y-.19,.93),(.43,.10,.65),armor,chars,.09)
    box('Guard | shield heraldry',(x-.46,y-.252,.94),(.07,.018,.42),bronze,chars,.01)
    objs=set(bpy.data.objects)-before; root=bpy.data.objects.new('KeepGuard',None); chars.objects.link(root)
    for o in objs: o.parent=root; o.matrix_parent_inverse=root.matrix_world.inverted()
    return root,objs
kr,kobjs=character_kaelen(); gr,gobjs=character_guard()
# recenter each character geometry to root at local origin (world source x removed)
for root,objs,x in [(kr,kobjs,8),(gr,gobjs,10)]:
    root.location.x=-x
# export helpers: apply modifiers and select desired hierarchy
def export_asset(path,objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.hide_set(False); o.select_set(True)
    bpy.context.view_layer.objects.active=next((o for o in objects if o.type=='MESH'),objects[0])
    bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_materials='EXPORT',export_cameras=False,export_lights=False)

def tri_count(objects):
    total=0
    for o in objects:
        if o.type=='MESH':
            ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get()); me=ev.to_mesh(); me.calc_loop_triangles(); total+=len(me.loop_triangles); ev.to_mesh_clear()
    return total
counts={}
counts['s00_courtyard']=tri_count([o for o in scene.objects if o.type=='MESH' and o not in kobjs|gobjs])
counts['kaelen']=tri_count(kobjs); counts['keep_guard']=tri_count(gobjs)
# character exports, roots included
export_asset(os.path.join(OUT,'kaelen.glb'),[kr]+list(kobjs))
export_asset(os.path.join(OUT,'keep_guard.glb'),[gr]+list(gobjs))
# hide source characters for courtyard scene and export
for o in [kr,gr]+list(kobjs|gobjs): o.hide_render=True; o.hide_set(True)
courtyard=[o for o in scene.objects if o.type=='MESH' and o not in kobjs|gobjs]
export_asset(os.path.join(OUT,'s00_courtyard.glb'),courtyard)
# presentation only, not exported
presentation=coll('05_Presentation_Not_Exported')
box('Presentation | shadow plinth',(0,0,-1.35),(13.1,13.1,.20),dark,presentation,.18)
# lights/camera
world=bpy.data.worlds.new('VEILKEEP | moonlit navy') if not bpy.data.worlds else bpy.data.worlds[0]; scene.world=world; world.use_nodes=True
bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND'); bg.inputs[0].default_value=(.025,.04,.085,1); bg.inputs[1].default_value=.32

def area(name,loc,power,color,size,target=(0,0,0)):
    data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.color=color; data.shape='DISK'; data.size=size
    o=bpy.data.objects.new(name,data); presentation.objects.link(o); o.location=loc; o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler(); return o
area('Moon | large cool key',(-6,-4,11),1500,(.48,.62,1),7)
area('Rim | pale slate',(5,5,9),1100,(.52,.66,1),6)
area('Fill | soft neutral',(1,-8,6),650,(.72,.78,1),6)
area('Gate | amber spill',(0,3.2,2.3),95,(1,.28,.055),2,(0,0,0))
for x in (-4.25,4.25): area('Tower | amber spill',(x,3.25,2.7),65,(1,.28,.055),1.2,(x,1,0))
camd=bpy.data.cameras.new('Isometric Preview'); cam=bpy.data.objects.new('Isometric Preview',camd); presentation.objects.link(cam)
cam.location=(13,-17,14); target=Vector((0,0,1.0)); cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); camd.type='ORTHO'; camd.ortho_scale=18.2; scene.camera=cam
scene.render.engine='CYCLES'; scene.cycles.samples=48; scene.cycles.use_denoising=True
scene.render.resolution_x=1024; scene.render.resolution_y=576; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.filepath=PRE
scene.view_settings.view_transform='AgX'
scene.render.film_transparent=False
# Save editable source with source characters hidden
bpy.ops.wm.save_as_mainfile(filepath='C:/Development/findthewizard/threejs/public/assets/models/s00_courtyard.blend')
bpy.ops.render.render(write_still=True)
print('COUNTS '+json.dumps(counts))
print('EXPORTS '+OUT)
print('PREVIEW '+PRE)
