"""
Generates the rigged + animated main character (Wizard-Hunter protagonist) and
exports it to threejs/public/assets/models/main_character.glb

Pipeline:
    cd threejs && npx -y tsx ../tools/dump_combat_clips.ts      # bone layout + clips -> JSON
    blender --background --python tools/blender_gen_main_character.py

The skeleton uses the canonical bone names from src/character/MainCharacterRig.ts
(Root, Hips, Spine, Chest, Head, Left/Right Shoulder/UpperArm/LowerArm/Hand,
UpperLeg/LowerLeg/Foot) plus the helper bones hand_r_socket, SpellOrigin and
HitboxAnchor. All 12 combat clips (Idle_Combat, Locomotion_*, Light_Attack_1/2,
Heavy_Combo_Finisher, Arcane_Cast, Dodge_Roll, Block_Parry, Hit_Stagger) are baked
as Blender actions with the same normalised timings the game's hitbox windows use.

Conventions: Blender is Z-up facing -Y; glTF/Three is Y-up facing +Z. G() converts.
"""
import bpy
import bmesh
import json
import math
import os
from mathutils import Vector, Matrix, Quaternion

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = json.load(open(os.path.join(HERE, "main_character_clips.json")))
OUT = os.path.normpath(os.path.join(HERE, "..", "threejs", "public", "assets", "models", "main_character.glb"))
FPS = 30

C = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))  # glTF axes -> Blender axes
C_INV = C.inverted()


def G(v):
    return Vector((v[0], -v[2], v[1]))


# --------------------------------------------------------------------------- scene
def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures, bpy.data.actions):
        for item in list(coll):
            coll.remove(item)


def make_material(name, color, roughness=0.6, metalness=0.0, emissive=None, strength=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metalness
    if emissive:
        bsdf.inputs["Emission Color"].default_value = emissive
        bsdf.inputs["Emission Strength"].default_value = strength
    return mat


# --------------------------------------------------------------------------- armature
BONES = [(n, p, tuple(o)) for n, p, o in DATA["bones"]]
JW = {}  # joint world position, glTF space
for name, parent, off in BONES:
    base = JW[parent] if parent else Vector((0, 0, 0))
    JW[name] = base + Vector(off)

EXTRA = {  # helper bones: name -> (parent, glTF offset from parent joint)
    "hand_r_socket": ("RightHand", (0, -0.05, 0)),
    "SpellOrigin": ("LeftHand", (0, -0.14, 0.08)),
    "HitboxAnchor": ("RightHand", (0, -0.05, 0.55)),
}
for n, (p, off) in EXTRA.items():
    JW[n] = JW[p] + Vector(off)

TAIL_TO = {"Root": None, "Hips": "Spine", "Spine": "Chest", "Chest": "Head",
           "LeftShoulder": "LeftUpperArm", "LeftUpperArm": "LeftLowerArm", "LeftLowerArm": "LeftHand",
           "RightShoulder": "RightUpperArm", "RightUpperArm": "RightLowerArm", "RightLowerArm": "RightHand",
           "LeftUpperLeg": "LeftLowerLeg", "LeftLowerLeg": "LeftFoot",
           "RightUpperLeg": "RightLowerLeg", "RightLowerLeg": "RightFoot"}
TAIL_OFFSET = {"Root": (0, 0.3, 0), "Head": (0, 0.28, 0), "LeftHand": (0, -0.1, 0), "RightHand": (0, -0.1, 0),
               "LeftFoot": (0, 0, 0.2), "RightFoot": (0, 0, 0.2)}


def build_armature():
    arm_data = bpy.data.armatures.new("MainCharacterRig")
    arm_obj = bpy.data.objects.new("Armature", arm_data)
    bpy.context.scene.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    arm_obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones
    for name, parent, _ in BONES:
        b = eb.new(name)
        b.head = G(JW[name])
        tgt = TAIL_TO.get(name)
        if tgt:
            b.tail = G(JW[tgt])
        else:
            b.tail = G(JW[name] + Vector(TAIL_OFFSET.get(name, (0, 0.1, 0))))
        if parent:
            b.parent = eb[parent]
    for name, (parent, _) in EXTRA.items():
        b = eb.new(name)
        b.head = G(JW[name])
        b.tail = G(JW[name] + Vector((0, 0, 0.05)))
        b.parent = eb[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm_obj


# --------------------------------------------------------------------------- mesh parts
PARTS = []


def _finish(bm, name, bone, mat, smooth=True):
    me = bpy.data.meshes.new(name)
    if smooth:
        for f in bm.faces:
            f.smooth = True
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    vg = obj.vertex_groups.new(name=bone)
    vg.add([v.index for v in me.vertices], 1.0, "REPLACE")
    PARTS.append(obj)
    return obj


def _place(bm, bone, off, rot=(0, 0, 0), scale=(1, 1, 1)):
    """Position verts at joint(bone)+off (glTF axes). rot = glTF-axis Euler (XYZ intrinsic like Three)."""
    R = Matrix.Rotation(rot[0], 3, "X") @ Matrix.Rotation(rot[1], 3, "Y") @ Matrix.Rotation(rot[2], 3, "Z")
    Rb = C @ R @ C_INV
    S = Matrix.Diagonal(Vector((scale[0], scale[2], scale[1])))  # glTF (x,y,z) -> Blender (x,z,y)
    M = Matrix.Translation(G(JW[bone] + Vector(off))) @ (Rb @ S).to_4x4()
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)


def box(name, bone, mat, size, off, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    _place(bm, bone, off, rot, size)
    return _finish(bm, name, bone, mat, smooth=False)


def sphere(name, bone, mat, radius, off, scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=radius)
    _place(bm, bone, off, scale=scale)
    return _finish(bm, name, bone, mat)


def capsule(name, bone, mat, length, radius, off):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=radius)
    half = max(0.0, length - 2 * radius) / 2
    for v in bm.verts:
        v.co.z += half if v.co.z > 0 else -half
    _place(bm, bone, off)
    return _finish(bm, name, bone, mat)


def cone(name, bone, mat, r_bottom, r_top, depth, off, rot=(0, 0, 0), segments=16):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=r_bottom, radius2=r_top, depth=depth)
    _place(bm, bone, off, rot)
    return _finish(bm, name, bone, mat)


def back_shell(name, bone, mat, r_bottom, r_top, depth, off, thickness=0.012):
    """Open half-cone covering the character's back (cloak / collar)."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=False, cap_tris=False, segments=24, radius1=r_bottom, radius2=r_top, depth=depth)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y < -0.01], context="VERTS")
    _place(bm, bone, off)
    obj = _finish(bm, name, bone, mat)
    mod = obj.modifiers.new("Solid", "SOLIDIFY")
    mod.thickness = thickness
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier="Solid")
    return obj


def build_visuals():
    cloth = make_material("HunterCloth", (0.045, 0.04, 0.12, 1), 0.95)
    cloak_m = make_material("HunterCloak", (0.06, 0.05, 0.14, 1), 0.95)
    trim = make_material("CrimsonTrim", (0.30, 0.04, 0.07, 1), 0.85)
    leather = make_material("HunterLeather", (0.12, 0.07, 0.04, 1), 0.85)
    skin = make_material("Skin", (0.70, 0.45, 0.30, 1), 0.7)
    steel = make_material("Steel", (0.45, 0.47, 0.5, 1), 0.4, 0.85)
    blade = make_material("AntiArcaneBlade", (0.75, 0.82, 0.9, 1), 0.25, 0.9, (0.3, 0.6, 1.0, 1), 1.2)
    glow = make_material("ArcaneGlow", (0.5, 0.3, 1.0, 1), 0.3, 0.0, (0.55, 0.3, 1.0, 1), 6.0)

    box("Pelvis", "Hips", leather, (0.34, 0.18, 0.2), (0, 0, 0))
    cone("Abdomen", "Spine", cloth, 0.14, 0.16, 0.26, (0, 0.05, 0), segments=12)
    box("Belt", "Spine", leather, (0.38, 0.05, 0.24), (0, -0.03, 0))
    for i in range(3):
        cone(f"Vial{i}", "Spine", glow, 0.018, 0.018, 0.07, (-0.1 + i * 0.05, -0.1, 0.13), segments=8)
    box("Torso", "Chest", cloth, (0.4, 0.34, 0.22), (0, 0.12, 0))
    box("Bandolier", "Chest", leather, (0.06, 0.5, 0.25), (0.04, 0.12, 0), rot=(0, 0, -0.7))
    back_shell("Cloak", "Chest", cloak_m, 0.46, 0.23, 1.0, (0, -0.32, -0.04))
    back_shell("CloakCollar", "Chest", trim, 0.26, 0.26, 0.08, (0, 0.22, -0.03), 0.01)

    sphere("HeadMesh", "Head", skin, 0.11, (0, 0.13, 0))
    cone("HatBrim", "Head", leather, 0.3, 0.3, 0.015, (0, 0.2, 0), segments=24)
    cone("HatCrown", "Head", leather, 0.14, 0.1, 0.22, (0, 0.3, 0))
    cone("HatBand", "Head", trim, 0.145, 0.145, 0.04, (0, 0.24, 0))
    cone("Scarf", "Head", trim, 0.09, 0.075, 0.1, (0, 0.02, 0), segments=12)

    sphere("LeftPauldron", "LeftShoulder", steel, 0.1, (0, 0, 0))
    sphere("RightPauldron", "RightShoulder", cloth, 0.1, (0, 0, 0))
    for side in ("Left", "Right"):
        capsule(f"{side}UpperArmMesh", f"{side}UpperArm", cloth, 0.29, 0.055, (0, -0.145, 0))
        capsule(f"{side}LowerArmMesh", f"{side}LowerArm", leather, 0.27, 0.05, (0, -0.135, 0))
        sphere(f"{side}HandMesh", f"{side}Hand", skin, 0.05, (0, -0.04, 0))
        capsule(f"{side}UpperLegMesh", f"{side}UpperLeg", cloth, 0.46, 0.075, (0, -0.23, 0))
        capsule(f"{side}LowerLegMesh", f"{side}LowerLeg", leather, 0.43, 0.06, (0, -0.215, 0))
        box(f"{side}Boot", f"{side}Foot", leather, (0.11, 0.07, 0.26), (0, 0, 0.07))

    # Arcane gauntlet ring marks SpellOrigin
    cone("SpellRing", "LeftHand", glow, 0.065, 0.065, 0.02, (0, -0.08, 0.04), segments=16)

    # Weapon is mounted dynamically to hand_r_socket in engine (HunterBlade, Cleaver, etc.)

    bpy.ops.object.select_all(action="DESELECT")
    for o in PARTS:
        o.select_set(True)
    bpy.context.view_layer.objects.active = PARTS[0]
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = "MainCharacterMesh"
    return body


# --------------------------------------------------------------------------- animation
def bake_clips(arm_obj):
    pbs = arm_obj.pose.bones
    for pb in pbs:
        pb.rotation_mode = "QUATERNION"
    rest = {b.name: b.matrix_local.to_3x3() for b in arm_obj.data.bones}
    ad = arm_obj.animation_data_create()
    names = [n for n, _, _ in BONES if n != "Root"]
    actions = {}
    for cname, clip in DATA["clips"].items():
        action = bpy.data.actions.new(cname)
        ad.action = action
        for pb in pbs:
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
        for bone in names:
            tr = clip["tracks"][f"{bone}.quaternion"]
            prev = None
            for i, t in enumerate(tr["times"]):
                x, y, z, w = tr["values"][i * 4:i * 4 + 4]
                Rb = C @ Quaternion((w, x, y, z)).to_matrix() @ C_INV
                q = (rest[bone].inverted() @ Rb @ rest[bone]).to_quaternion()
                if prev is not None and prev.dot(q) < 0:
                    q.negate()
                prev = q
                pbs[bone].rotation_quaternion = q
                pbs[bone].keyframe_insert("rotation_quaternion", frame=1 + t * FPS, group=bone)
        tr = clip["tracks"]["Hips.position"]
        for i, t in enumerate(tr["times"]):
            px, py, pz = tr["values"][i * 3:i * 3 + 3]
            d = C @ Vector((px, py - JW["Hips"].y, pz))
            pbs["Hips"].location = rest["Hips"].inverted() @ d
            pbs["Hips"].keyframe_insert("location", frame=1 + t * FPS, group="Hips")
        actions[cname] = action
    # One NLA track per clip -> exported as a named glTF animation.
    ad.action = None
    for cname, action in actions.items():
        track = ad.nla_tracks.new()
        track.name = cname
        strip = track.strips.new(cname, 1, action)
        strip.name = cname
        try:
            if action.slots:
                strip.action_slot = action.slots[0]
        except Exception:
            pass
    for pb in pbs:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)


def main():
    clear_scene()
    bpy.context.scene.render.fps = FPS
    arm_obj = build_armature()
    body = build_visuals()
    body.parent = arm_obj
    mod = body.modifiers.new("Armature", "ARMATURE")
    mod.object = arm_obj
    bake_clips(arm_obj)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT,
        export_format="GLB",
        use_selection=False,
        export_apply=False,
        export_skins=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_yup=True,
        export_cameras=False,
        export_lights=False,
    )
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "main_character.blend"))
    print("SUCCESS_EXPORT_MAIN_CHARACTER:", OUT)


if __name__ == "__main__":
    main()
