#!/usr/bin/env python3
import re, html, os

SRC = "gdd.md"
OUT = "index.html"

def slugify(text):
    s = re.sub(r'<[^>]+>', '', text)
    s = s.lower()
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s or 'section'

def inline(text):
    # escape first
    t = html.escape(text)
    # code
    t = re.sub(r'`([^`]+)`', lambda m: '<code>' + m.group(1) + '</code>', t)
    # images
    t = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', lambda m: '<span class="art-card"><img src="%s" alt="%s" loading="lazy">%s</span>' % (m.group(2), m.group(1), ('<span class="art-caption">%s</span>' % m.group(1)) if m.group(1) else ''), t)
    # links (handle balanced parentheses in URLs)
    def _link_repl(m):
        url = m.group(2)
        text = m.group(1)
        if url.startswith('http://') or url.startswith('https://'):
            return '<a href="%s" target="_blank" rel="noopener noreferrer">%s</a>' % (url, text)
        return '<a href="%s">%s</a>' % (url, text)
    t = re.sub(r'\[([^\]]+)\]\(([^)]+(?:\([^)]*\)[^)]*)*)\)', _link_repl, t)
    # bold
    t = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', t)
    # italic
    t = re.sub(r'\*([^*]+)\*', r'<em>\1</em>', t)
    return t

def parse_blocks(lines):
    blocks = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        if line.strip() == '':
            i += 1
            continue
        # fenced code
        m = re.match(r'^```(\w*)\s*$', line.strip())
        if m:
            lang = m.group(1)
            i += 1
            code_lines = []
            while i < n and not lines[i].strip().startswith('```'):
                code_lines.append(lines[i])
                i += 1
            i += 1  # skip closing
            blocks.append(('code', lang, code_lines))
            continue
        # heading
        m = re.match(r'^(#{1,6})\s+(.*)$', line)
        if m:
            level = len(m.group(1))
            text = m.group(2).strip()
            blocks.append(('heading', level, text))
            i += 1
            continue
        # raw html block
        if line.lstrip().startswith('<'):
            html_lines = []
            while i < n and lines[i].strip() != '':
                html_lines.append(lines[i])
                i += 1
            blocks.append(('html', '\n'.join(html_lines)))
            continue
        # table
        if '|' in line and i+1 < n and re.match(r'^\s*\|?[\s\-:|]+\|?\s*$', lines[i+1]):
            # header
            header = [c.strip() for c in line.strip().strip('|').split('|')]
            i += 2
            rows = []
            while i < n and '|' in lines[i] and lines[i].strip() != '':
                cells = [c.strip() for c in lines[i].strip().strip('|').split('|')]
                rows.append(cells)
                i += 1
            blocks.append(('table', header, rows))
            continue
        # unordered list
        if re.match(r'^\s*[-*]\s+', line):
            items = []
            while i < n and re.match(r'^\s*[-*]\s+', lines[i]):
                items.append(re.sub(r'^\s*[-*]\s+', '', lines[i]))
                i += 1
            blocks.append(('ul', items))
            continue
        # ordered list
        if re.match(r'^\s*\d+\.\s+', line):
            items = []
            while i < n and re.match(r'^\s*\d+\.\s+', lines[i]):
                items.append(re.sub(r'^\s*\d+\.\s+', '', lines[i]))
                i += 1
            blocks.append(('ol', items))
            continue
        # blockquote
        if line.lstrip().startswith('>'):
            bq = []
            while i < n and lines[i].lstrip().startswith('>'):
                bq.append(lines[i].lstrip()[1:].strip())
                i += 1
            blocks.append(('bq', bq))
            continue
        # horizontal rule
        if re.match(r'^\s*[-*_]{3,}\s*$', line):
            blocks.append(('hr',))
            i += 1
            continue
        # paragraph
        para = []
        while i < n and lines[i].strip() != '' and not lines[i].lstrip().startswith('<') \
              and not re.match(r'^#{1,6}\s+', lines[i]) and not re.match(r'^\s*[-*]\s+', lines[i]) \
              and not re.match(r'^\s*\d+\.\s+', lines[i]) and '|' not in lines[i] \
              and not lines[i].strip().startswith('```') and not lines[i].lstrip().startswith('>'):
            para.append(lines[i])
            i += 1
        if para:
            blocks.append(('p', ' '.join(para)))
    return blocks

def render_blocks(blocks):
    out = []
    h2s = []
    for b in blocks:
        if b[0] == 'heading':
            level = b[1]
            text = b[2]
            hid = slugify(text)
            out.append('<h%d id="%s">%s</h%d>' % (level, hid, inline(text), level))
            if level == 2:
                h2s.append((hid, text))
        elif b[0] == 'p':
            out.append('<p>%s</p>' % inline(b[1]))
        elif b[0] == 'ul':
            items = ''.join('<li>%s</li>' % inline(x) for x in b[1])
            out.append('<ul>%s</ul>' % items)
        elif b[0] == 'ol':
            items = ''.join('<li>%s</li>' % inline(x) for x in b[1])
            out.append('<ol>%s</ol>' % items)
        elif b[0] == 'table':
            header, rows = b[1], b[2]
            ths = ''.join('<th>%s</th>' % inline(c) for c in header)
            trs = ''
            for r in rows:
                tds = ''.join('<td>%s</td>' % inline(c) for c in r)
                trs += '<tr>%s</tr>' % tds
            out.append('<table><tr>%s</tr>%s</table>' % (ths, trs))
        elif b[0] == 'code':
            lang, code_lines = b[1], b[2]
            code = html.escape('\n'.join(code_lines))
            out.append('<pre class="mono card"><code>%s</code></pre>' % code)
        elif b[0] == 'html':
            out.append(b[1])
        elif b[0] == 'bq':
            inner = ''.join('<p>%s</p>' % inline(x) for x in b[1])
            out.append('<blockquote>%s</blockquote>' % inner)
        elif b[0] == 'hr':
            out.append('<hr>')
    return '\n'.join(out), h2s

def main():
    with open(SRC, encoding='utf-8') as f:
        lines = f.read().split('\n')
    blocks = parse_blocks(lines)
    body, h2s = render_blocks(blocks)

    nav = '\n'.join('    <a href="#%s">%s</a>' % (hid, html.escape(text)) for hid, text in h2s)

    template = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VEILKEEP - Game Design Document</title>
<style>
  :root{--bg:#0b0d14;--panel:#141826;--panel2:#1b2033;--accent:#9b7cff;--accent2:#d4af37;--text:#e8e6f0;--muted:#9aa0b8;--line:#2a304a;--good:#6dd39a;--warn:#e0a060;}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:"Segoe UI",system-ui,sans-serif;font-size:15px;line-height:1.55;scroll-behavior:smooth}
  a{color:var(--accent)}
  .layout{display:grid;grid-template-columns:260px 1fr;min-height:100vh}
  aside.sidebar{position:sticky;top:0;height:100vh;overflow:auto;background:var(--panel);border-right:1px solid var(--line);padding:16px}
  aside.sidebar h1{font-size:18px;margin:0 0 4px;color:var(--accent2);letter-spacing:.5px}
  aside.sidebar .sub{font-size:11px;color:var(--muted);margin-bottom:12px}
  aside.sidebar input{width:100%;padding:8px 10px;background:var(--bg);border:1px solid var(--line);color:var(--text);border-radius:6px;margin-bottom:12px}
  aside.sidebar nav a{display:block;padding:6px 10px;color:var(--muted);text-decoration:none;border-radius:6px;font-size:13px;margin-bottom:2px}
  aside.sidebar nav a:hover,aside.sidebar nav a.active{background:var(--panel2);color:var(--text)}
  aside.sidebar nav a.active{border-left:2px solid var(--accent)}
  main.content{padding:28px 40px;max-width:1100px}
  main.content h2{font-size:26px;color:var(--accent2);border-bottom:1px solid var(--line);padding-bottom:6px;margin-top:36px}
  main.content h3{font-size:18px;color:var(--accent);margin-top:22px}
  main.content h4{font-size:15px;color:var(--muted);margin-top:14px}
  p{margin:8px 0}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;margin:12px 0}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
  table{width:100%;border-collapse:collapse;margin:10px 0;font-size:13px}
  th,td{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
  th{background:var(--panel2);color:var(--accent2)}
  tr:hover td{background:var(--panel2)}
  details{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin:10px 0}
  details summary{cursor:pointer;font-weight:600;color:var(--accent)}
  details[open] summary{margin-bottom:8px}
  .tag{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;margin:2px;background:var(--panel2);border:1px solid var(--line)}
  .tag.good{color:var(--good);border-color:var(--good)}
  .tag.warn{color:var(--warn);border-color:var(--warn)}
  .tag.accent{color:var(--accent);border-color:var(--accent)}
  .mono{font-family:Consolas,monospace;font-size:12px}
  .quest{border-left:3px solid var(--accent2);padding:8px 12px;margin:10px 0;background:var(--panel)}
  .quest .title{font-weight:700;color:var(--accent2)}
  .quest .meta{font-size:12px;color:var(--muted)}
  .map-wrap{display:grid;grid-template-columns:1fr 320px;gap:14px;margin:12px 0}
  .map-svg{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px}
  .map-svg svg{width:100%;height:auto}
  .room{fill:#1f2540;stroke:#4a5280;stroke-width:1.5;cursor:pointer;transition:fill .15s}
  .room:hover{fill:#2e3660}
  .room.active{fill:#3a2f6b;stroke:var(--accent)}
  .info-panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px;min-height:240px}
  .info-panel h4{margin-top:0;color:var(--accent2)}
  .tabs{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
  .tab{padding:6px 12px;background:var(--panel);border:1px solid var(--line);border-radius:6px;cursor:pointer;font-size:13px}
  .tab.active{background:var(--accent);color:#fff;border-color:var(--accent)}
  .tabpane{display:none}
  .tabpane.active{display:block}
  .csheet{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px}
  .bar{height:8px;background:#0a0c14;border-radius:4px;overflow:hidden;margin:4px 0}
  .bar>div{height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2))}
  blockquote{border-left:3px solid var(--accent);padding:8px 12px;margin:10px 0;background:var(--panel);color:var(--muted)}
  footer{color:var(--muted);font-size:12px;margin-top:40px;border-top:1px solid var(--line);padding-top:12px}
  pre{overflow:auto}
  .art-card{display:block;margin:18px 0;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:12px;box-shadow:0 8px 24px rgba(0,0,0,0.45);transition:border-color .2s,box-shadow .2s}
  .art-card:hover{border-color:var(--accent);box-shadow:0 8px 28px rgba(155,124,255,0.2)}
  .art-card img{width:100%;max-width:100%;height:auto;border-radius:6px;display:block;image-rendering:pixelated}
  .art-card .art-caption{display:block;text-align:center;font-size:12px;color:var(--accent2);margin-top:10px;font-weight:600;letter-spacing:.3px}
  @media(max-width:900px){.layout{grid-template-columns:1fr}aside.sidebar{position:static;height:auto}.map-wrap{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="layout">
<aside class="sidebar">
  <h1>VEILKEEP</h1>
  <div class="sub">Game Design Document v1.0</div>
  <input id="search" type="text" placeholder="Search sections...">
  <nav id="nav">
__NAV__
  </nav>
</aside>
<main class="content">
__BODY__
<footer>VEILKEEP GDD v1.0 — Built from gdd.md. Interactive map & tabs above.</footer>
</main>
</div>
<script>
const rooms = {
 outer:{name:"Outer Wards & Sunken Barbican Courtyard",img:"assets/scene00_approach_sunken.png",desc:"Terraced mountain approach and sunken courtyard carved into the red-rock foundation beneath the imposing terracotta fortress. Features photophobic aether-bramble bushes with retracting starlight thorns, deceptive shadow sentry traps, and the dry moat waterwheel siphon winch to breach the barbican.",npcs:"—",puzzle:"Statue Riddle & Photophobic Bramble Alignment",loot:"Cache: Clockwork Tension Lockpick, Grappling Hook, 50 moons, Sun-Blessed Consecration Oil"},
 gate:{name:"Gatehouse",img:"assets/gameplay_mockup.jpg",desc:"Lift-gate puzzle: align mirror beams. Guard captain mini-boss (optional). Bypass via vent (climbing 2).",npcs:"Gatekeeper Orin",puzzle:"Mirror Alignment",loot:"Gatehouse Key, Iron Nails x3"},
 servants:{name:"Servants' Quarters & Banquet Salon",img:"assets/scene_servants_hub.jpg",desc:"Hub for peaceful NPCs. Presided over with Victorian decorum by Grand Butler Mister Bartholomew Sterling and maid Lira. Features heated copper steam radiators, the grand dining table, and a secret dumbwaiter network.",npcs:"Mister Bartholomew Sterling, Lira, Hesta, Pim",puzzle:"—",loot:"The Grand Seneschal's Master Passkey, Sterling's Silver Pocket Watch, Bartholomew's Imperial Earl Grey"},
 kitchen:{name:"Kitchens",img:"assets/scene_servants_hub.jpg",desc:"Food prep. Cook Hesta's 'Missing Spice' quest. Hidden passage to Undercrypt via dumbwaiter (climbing 3).",npcs:"Cook Hesta",puzzle:"Dumbwaiter Climb",loot:"Starlight Vial recipe"},
 mirrors:{name:"Halls of Mirrors",img:"assets/scene_halls_of_mirrors.jpg",desc:"Core puzzle zone. Maze of reflections; doors keyed to true mirror. Phantasmal hounds patrol.",npcs:"Mirror Merchant",puzzle:"True Mirror",loot:"Mirror Shard Amulet"},
 library:{name:"Arcane Library",img:"assets/scene_arcane_library.jpg",desc:"Lore, spellbooks, counter-illusion recipes. Librarian Maren (faction). Hidden reading room.",npcs:"Librarian Maren",puzzle:"Library Index",loot:"Memory Thread, Truth Lens"},
 menagerie:{name:"Menagerie",desc:"Illusion beasts in cages (some real). Combat gauntlet.",npcs:"Menagerie Keeper",puzzle:"—",loot:"Veil-Piercing Dagger"},
 gardens:{name:"Dreaming Gardens",img:"assets/scene_dreaming_gardens.jpg",desc:"Open-air terraces, dream-logic flora. Belief manipulation puzzles.",npcs:"Dreamer, Gardener Pim",puzzle:"Belief Garden",loot:"Shadowweave Cloak (hidden)"},
 barracks:{name:"Barracks",desc:"Guard quarters. Combat-heavy; stealth route via rafters.",npcs:"—",puzzle:"—",loot:"Armor, knives, guard schedules"},
 prison:{name:"The Abyssal Prison Block & Penitent's Oubliette",img:"assets/prison.png",desc:"Subterranean maximum-security cell block and aether-siphon oubliette. Guard patrols, cognitive extraction chairs, and the deep starlight crucible where Eldrin makes his final sacrifice to empower the amulet.",npcs:"Prisoner Korr, Eldrin the Star-Carver, Siphon Warden Malakor",puzzle:"The Hydraulic Siphon Matrix (Puzzle 30)",loot:"The Martyr's Starlight Amulet, Siphon Warden's Ring, Prison Keyring"},
 eyrie:{name:"The High Eyrie of the Sky-Sovereign",img:"assets/scene_gryphon_eyrie.jpg",desc:"Dizzying open-air marble pinnacle perched high above the clouds atop the Clockwork Spire. Perch of Lord Aurelius, the mythical talking Aether-Gryphon, surrounded by gold hoards, howling gales, and shattered storm baffles.",npcs:"Lord Aurelius the Sky-Sovereign",puzzle:"The Aeolian Tempest Harmony (Puzzle 28)",loot:"Cloak of the Sky-Sovereign, Aurelius's Royal Gryphon Whistle, Fast-Travel Flight"},
 clock:{name:"Clockwork Spire",desc:"Vertical ascent, timed clockwork puzzles, moving platforms. Mini-boss: Clockwork Warden.",npcs:"—",puzzle:"Clockwork Sequence",loot:"Shadow Step upgrade"},
 crypt:{name:"Undercrypt",desc:"Secrets, tombs of original monks. Real undead. Hidden backstory.",npcs:"Ghost Monk",puzzle:"Echo Chamber",loot:"Relics, Heart hint"},
 chapel:{name:"Chapel of Reflections & Solar Vestry",desc:"Save point, blessing (cure Confused). Spiritual sanctuary of Blind Priest and headquarters for Lady Eleanor the Sun-Scarred (Knight-Commander of Radiant Aegis). Connects to Solarium where Sir Roderick stands calcified.",npcs:"Lady Eleanor, Blind Priest, Sir Roderick",puzzle:"The Solar Prism Refraction Alignment (Puzzle 26)",loot:"Daybreak Solar Greatsword, Aegis of the Solar Prism, The Knight's Consecrated Vow"},
 relativity:{name:"Relativity Cloister",desc:"Paradoxical architecture where gravity is perspective. Escher-like stairways; Dreamwalkers stroll on walls. Windows open to park illusions.",npcs:"The Diner, Stairkeeper",puzzle:"Perspective Gravity",loot:"Perspective Lens"},
 colosseum:{name:"The Veil Colosseum",desc:"Illusionist arena with bulb-headed spectators. Combat gauntlets, puzzle-trials, hidden passage to Undercrypt.",npcs:"Arena Master",puzzle:"Mirror Alignment (pressure)",loot:"Champion's Sigil"},
 trophy:{name:"Trophy Hall",desc:"Gallery of Vaelor's 'slain' beasts. Trophies are illusions; hidden passages behind them. Curator gives lore.",npcs:"Curator",puzzle:"Veil Sight examination",loot:"Hunter's Cloak"},
 haunted:{name:"The Haunted Manor Suites & Ghost-Light Chambers",img:"assets/scene_haunted_chambers.jpg",desc:"Dust-sheeted ancestral apartments trapped in a perpetual midnight storm. Shifting unobserved furniture, self-rocking cradles, whispering portraits, and telekinetic poltergeists born of ancestral grief.",npcs:"Madame Vivienne, Lord Morvath Vaelor",puzzle:"The Séance of Shifting Shadows (Puzzle 27)",loot:"Spectral Spirit-Lantern, Vivienne's Mourning Cameo, Cynthia's Porcelain Music Doll"},
 playhouse:{name:"Phantasmagoria Playhouse",desc:"Carnival performance theater. Vintage show posters, circus troupe performers, high-wire rigging, and Barnaby the Astrological Talking Horse. Timing-based knife wheel and feats-of-strength high striker.",npcs:"Ringmaster Valenti, Barnaby the Talking Horse, Strongman Boris",puzzle:"Ringmaster's Knife-Wheel & Titan's High-Striker",loot:"Carnival Tokens, Houyhnhnm's Horseshoe, Titan's Belt"},
 foundry:{name:"Aether-Steam Foundry & Boiler Core",desc:"Roaring industrial sub-level. Riveted copper boilers, starlight steam manifolds, pneumatic dispatch tubes, and a 30ft governor flywheel. Powers fortress lifts and mirror focus arrays.",npcs:"Chief Mechanist Master Vane",puzzle:"Pneumatic Steam-Condenser Circuit & Differential Escapement",loot:"Steam-Piston Stiletto, Pneumatic Harpoon Grapple, Brass Manifold Monocle"},
 refectory:{name:"The Skeptic's Refectory",desc:"Cantilevered glass study overlooking the abyss. Stark Hopper lighting, towering parchment ziggurats, and a hearth where Doctor Renatus tests beeswax against the illusions of the Malicious Demon.",npcs:"Philosopher Renatus (Doctor Renatus of Touraine)",puzzle:"Cartesian Dualism Dialectic & The Five Senses Resonance",loot:"The Cogito Ring, Tuning Fork of Unmaking, Meditations of Doctor Renatus"},
 enclave:{name:"The Thaumaturges' Enclave & Crucible",desc:"Subterranean mages' haven and summoning pit. Scent of ozone, burning sulfur, and starlight chalk. Exiled minor magicians teach Arcane Trickster spells to thieves who vanquish their bound creature mini-bosses in the Crucible arena.",npcs:"Ignis-Weaver Vaelen, Mirrormancer Sylas, Astromancer Zephyra",puzzle:"Pentagram Alignment Glyph",loot:"Spellweaver's Bracers, Apostate's Grimoire, Archmage's Signet"},
 columbarium:{name:"The Grand Columbarium & Starlight Aviary",desc:"High-altitude parapet aviary and messenger roost. Weather-beaten perches, iridescent Aether-Pigeons, and brass cipher desks. Headquarters of the fortress dead-drop courier network.",npcs:"Pigeon Master Corvo",puzzle:"Sky-Courier Flight Cipher",loot:"Aether-Pigeon Whistle, Brass Pigeon Leg-Canister, Starlight Bird-Feed"},
 chronomancy:{name:"The Chronomantic Scriptorium & Hall of Inverted Hours",desc:"Sanctuary of inverted entropy. Monumental swinging pendulums, upward-falling rain, backward-flowing inks, and shattered stone bridges that must be un-fallen. Where Vaelor sought to undo his daughter's death.",npcs:"Lady Aurelia the Inverted",puzzle:"The Un-Fallen Bridge of Chronos & Retrocausal Paradox Portcullis",loot:"Retrograde Ouroboros, Hourglass of Inverted Sands, Tachyon Phial"},
 conservatory:{name:"The Gilded Music Salon & Harmonic Conservatory",img:"assets/scene_harmonic_salon.jpg",desc:"Opulent Victorian ballroom with mirrored parquet floor, gilded cherub friezes, and a steam-orchestrion. Cursed spectral virtuosos play an unresolved waltz.",npcs:"Maestro Niccolò, Madame Clara, Bandmaster Gustav",puzzle:"The Cadence of Resonant Harmonies (Rhythm Mini-Game)",loot:"The Maestro's Chrono-Metronome, Virtuoso's Starlight Rosin, Score of the Unbroken Chord"},
 labyrinth:{name:"The Daedalian Brass Labyrinth & Minotaur's Penumbra",desc:"Subterranean steam-hydraulic maze of shifting brass corridors. Ariadne spins glowing starlight thread at the threshold, while the blind, brass-horned Minotaur Asterion stalks intruders through acoustic echo.",npcs:"Ariadne the Clockwork Weaver, Asterion the Brass-Horned",puzzle:"The Clew of Shifting Corridors (Puzzle 29)",loot:"Ariadne's Starlight Clew, The Minotaur's Brass Labrys, Asterion's Gilded Horn"},
 sanctum:{name:"Sanctum",img:"assets/vaelor_sprites.jpg",desc:"Boss arena. Multi-phase fight with Vaelor. Ending choices.",npcs:"Vaelor",puzzle:"—",loot:"Heart of Mirrors"}
};
const info=document.getElementById('roomInfo');
if(info){
  document.querySelectorAll('.room').forEach(r=>{
    r.addEventListener('click',()=>{
      document.querySelectorAll('.room').forEach(x=>x.classList.remove('active'));
      r.classList.add('active');
      const d=rooms[r.dataset.id];
      if(d){
        const imgHtml = d.img ? '<img src="'+d.img+'" alt="'+d.name+'" style="width:100%;height:150px;object-fit:cover;border-radius:6px;border:1px solid var(--line);margin-bottom:10px;image-rendering:pixelated">' : '';
        info.innerHTML=imgHtml+'<h4>'+d.name+'</h4><p>'+d.desc+'</p><p><b>NPCs:</b> '+d.npcs+'</p><p><b>Puzzle:</b> '+d.puzzle+'</p><p><b>Loot:</b> '+d.loot+'</p>';
      }
    });
  });
}
function setupTabs(containerId){
  const tabs=document.querySelectorAll('#'+containerId+' .tab');
  tabs.forEach(t=>t.addEventListener('click',()=>{
    const paneId=t.dataset.tab;
    tabs.forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    const pane=document.getElementById(paneId);
    if(!pane) return;
    const container=pane.parentElement;
    container.querySelectorAll('.tabpane').forEach(p=>p.classList.remove('active'));
    pane.classList.add('active');
  }));
}
setupTabs('questTabs');
setupTabs('bossTabs');
const search=document.getElementById('search');
if(search){
  search.addEventListener('input',e=>{
    const q=e.target.value.toLowerCase();
    document.querySelectorAll('#nav a').forEach(a=>{
      a.style.display = a.textContent.toLowerCase().includes(q)?'':'none';
    });
  });
}
if('IntersectionObserver' in window){
  const navLinks=document.querySelectorAll('#nav a');
  const observer=new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        const id=entry.target.getAttribute('id');
        navLinks.forEach(a=>{
          if(a.getAttribute('href')==='#'+id){
            a.classList.add('active');
            a.scrollIntoView({block:'nearest',behavior:'smooth'});
          } else {
            a.classList.remove('active');
          }
        });
      }
    });
  },{rootMargin:'0px 0px -75% 0px'});
  document.querySelectorAll('main.content h2').forEach(h=>observer.observe(h));
}
</script>
</body>
</html>'''.replace('__NAV__', nav).replace('__BODY__', body)

    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(template)
    print('Built', OUT, 'from', SRC)

if __name__ == '__main__':
    main()
