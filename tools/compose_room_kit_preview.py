"""Compose the three Blender-rendered panels into the requested contact sheet.
Run after build_veilkeep_room_kit.py and validate_veilkeep_room_kit.py:
python tools/compose_room_kit_preview.py
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import json
ROOT = Path('C:/Development/findthewizard')
PANELS = ROOT/'gdd/assets/room_kit_panels'
OUT = ROOT/'gdd/assets/room_kit_preview.png'
report = json.loads((ROOT/'tools/veilkeep_room_kit_validation.json').read_text())
W,H = 2400,890
im = Image.new('RGB',(W,H),(13,22,33))
d = ImageDraw.Draw(im)
def font(size,bold=False):
    p = 'C:/Windows/Fonts/segoeuib.ttf' if bold else 'C:/Windows/Fonts/segoeui.ttf'
    try: return ImageFont.truetype(p,size)
    except OSError: return ImageFont.load_default()
d.text((32,18),'VEILKEEP  /  MODULAR ROOM KIT',font=font(30,True),fill=(195,207,224))
d.text((32,57),'Moonlit slate  •  worn bevels  •  restrained veillight',font=font(18),fill=(123,143,167))
d.line((32,87,W-32,87),fill=(50,67,88),width=2)
items = [
    ('room_shell.png','01  ROOM SHELL','room_shell.glb','12.35 × 12.35 m  /  low rim'),
    ('gate_arch.png','02  GATE ARCH','gate_arch.glb','4.91 × 1.66 × 5.08 m'),
    ('mirror_lock.png','03  MIRROR LOCK','mirror_lock.glb','1.79 × 1.09 × 3.30 m'),
]
for i,(filename,title,key,dims) in enumerate(items):
    x=i*800
    panel=Image.open(PANELS/filename).convert('RGB')
    im.paste(panel,(x,116))
    d.text((x+28,96),title,font=font(20,True),fill=(172,188,211))
    d.line((x+24,816,x+776,816),fill=(43,58,79),width=1)
    d.text((x+28,831),dims,font=font(18),fill=(162,179,201))
    d.text((x+28,858),f"{report[key]['triangles']:,} triangles  •  {report[key]['mesh_nodes']} material batches",font=font(16),fill=(111,133,158))
im.save(OUT)
print(OUT)
