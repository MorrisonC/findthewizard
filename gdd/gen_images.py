#!/usr/bin/env python3
"""Generate all concept art for VEILKEEP via Cloudflare Workers AI."""
import json, base64, os, sys

CREDS = r"C:\secure\cf.txt"
OUTDIR = "assets"
MODEL = os.environ.get("VEILKEEP_MODEL", "@cf/black-forest-labs/flux-1-schnell")
STYLE = "painterly 2D game concept art, quest for glory shadows of darkness but HD, moody gothic fantasy, 4k, cinematic lighting"

PROMPTS = {
    # --- Zones ---
    "scene00_approach_sunken": "A hooded thief on a sunken stone courtyard at the foot of a massive floating illusionist fortress, broken stairways descending into shadow, violet windows and gold starlight chains, stylized low-poly 3D diorama with painterly materials, moonlit purple and deep blue palette, soft shadows and fog, not pixel art, {STYLE}",
    "veilkeep": "A massive fantasy castle floating in the sky at dusk, chains of starlight anchoring it to jagged peaks, glowing purple windows, gates open, torches lit, {STYLE}",
    "approach": "A lone hooded thief standing on a high cliff bridge leading to a massive floating fortress at dusk, wind whipping cloak, no turning back, {STYLE}",
    "outerwards": "A silent courtyard in a magic fortress, broken statues of petrified guards, overgrown hedges shaped like guards, dusk light, {STYLE}",
    "gatehouse": "A towering stone gatehouse with an ornate gate, mirror-based lens mechanism glinting on walls, dusk, {STYLE}",
    "servants": "Cozy servants' quarters inside a gothic fortress, warm hearth, tapestries, lantern-lit hall, calm safe room, {STYLE}",
    "kitchens": "A grand fortress kitchen with cauldrons, copper pots, hanging herbs, dumbwaiter shaft in corner, warm candlelight, {STYLE}",
    "barracks": "A stone barracks hall with bunks, armor racks, long table, low torchlight, martial mood, {STYLE}",
    "mirrors": "A maze of tall mirrors in a dark corridor, reflections moving independently, purple glowing accents, {STYLE}",
    "library": "A vast magical library inside a fortress, spiraling shelves, floating books, lantern glow, scholars' desks, {STYLE}",
    "menagerie": "A warehouse-like menagerie in a fortress, cages of illusion beasts made of shimmering light, a real giant creature among them, {STYLE}",
    "gardens": "A magnificent terrace garden blooming with impossible magical flowers, floating petals, dream logic architecture, {STYLE}",
    "clock": "A tower interior filled with giant gears and moving platforms, clockwork mechanisms, moonlight through glass ceiling, {STYLE}",
    "undercrypt": "An ancient underground crypt beneath a fortress, stone tombs of monks, faint blue mist, {STYLE}",
    "chapel": "A small chapel of mirrors lit by candles, soft hymn light, prayer benches, stained glass, {STYLE}",
    "sanctum": "A circular arena inside a magic fortress, walls lined with mirrors, glowing runic floor, {STYLE}",
    "relativity": "Impossible architecture with stairways at every angle, figures walking on walls and upside down stairs, windows opening onto a sunny park, featureless bulb-headed robed strollers, M.C. Escher inspired, {STYLE}",
    "colosseum": "A tiered stone colosseum arena at night, silent robed spectators with bulb heads, glowing magical barriers, {STYLE}",
    "trophy": "A museum hall lined with mounted illusory beasts and murals of impossible hunts, {STYLE}",
    "astronomy": "A tall astronomy tower interior with an antique telescope, star-map floor of constellations, moonlight, {STYLE}",
    "alchemy": "A cluttered alchemist's workshop with bubbling cauldrons, floating reagents, shelves of jars, instability sparks, {STYLE}",
    "prison": "A dark oppressive stone prison block with cells, chains on walls, dim torchlight, oppressive mood, {STYLE}",
    "rooftop": "A rooftop garden terrace above the clouds, wing-like gliders on racks, wind-swept plants, golden hour, {STYLE}",
    "void": "A dreamlike void space where gravity bends, impossible portals floating, robed dreamer silhouette, reversed whispers visualized as ripples, {STYLE}",
    "gatekeeper": "A sturdy gatekeeper guard in armor looking confused at a stone statue, dusk, {STYLE}",
    "diner": "A mysterious figure in identical robe seated at a long outdoor dining table eating eternally, bulb-shaped head, park view beyond windows, {STYLE}",

    # --- Characters / NPCs ---
    "kaelen": "A hooded thief in dark leather armor holding a curved shortblade, standing on a cliff overlooking a floating fortress at dusk, side profile, {STYLE}",
    "vaelor": "An ageless wizard in flowing robes with a glowing mirror shard amulet, standing before a wall of mirrors covering them, {STYLE}",
    "orst": "A young dark-haired servant girl with a locket, standing in a warm hall, hopeful expression, {STYLE}",
    "maren": "A scholarly librarian woman with glasses and cardigan, surrounded by floating books, {STYLE}",
    "hesta": "A plump kindly cook in an apron, stirring a large cauldron, warm smile, kitchen background",
    "priest": "A blind monk priest with milky eyes in simple robes, holding a mirror shard, candlelight chapel",
    "dreamer": "A prophet-like dreamer with closed eyes, standing in a garden of impossible flowers, {STYLE}",
    "pim": "A shy herbalist gardener tending to wilting plants, soft light, {STYLE}",
    "merchant": "A shady mirror-faced merchant under a cloak, offering glowing shards, {STYLE}",
    "keeper": "A zookeeper in warm clothes standing before a massive caged beast, {STYLE}",
    "diner": "A silent bulb-headed figure in identical robes seated at a lone dining table in a strange garden, {STYLE}",
    "stairkeeper": "A silent guide figure pointing at a stairway in impossible architecture, {STYLE}",
    "stargazer": "An astronomer in a tall tower peering through a telescope, star charts scatter, {STYLE}",
    "vex": "An unstable alchemist genius with wide eyes holding a bubbling vial, chaotic lab, {STYLE}",
    "korr": "A ragged real prisoner in a cell looking defiant, chains, torchlight, {STYLE}",
    "windkeeper": "A silent figure standing in strong wind on a rooftop garden, cloak billowing, {STYLE}",

    # --- Enemies ---
    "guard": "An armored fortress guard with spear and shield, torchlight, menacing stance, {STYLE}",
    "archer": "A fortress archer with a recurve bow perched on a parapet, dusk, {STYLE}",
    "captain": "A fortress guard captain with ornate armor and longsword, commanding pose, {STYLE}",
    "hound": "A phantom hound made of shimmering light with glowing eyes, tearing through the floor, {STYLE}",
    "wraith": "A mirror wraith reflected in a tall mirror, blurring between reflection and reality, {STYLE}",
    "gargoyle": "A stone gargoyle crouched on a ledge, wings half-furled, glowing eyes, gothic, {STYLE}",
    "construct": "A clockwork soldier made of brass and iron, steam vents, holding a sword, {STYLE}",
    "beast": "A massive phantasmal beast made of light and smoke, roaring, {STYLE}",
    "monk": "An undead monk in tattered robe reaching out, blue mist, gothic, {STYLE}",
    "warden": "A clockwork warden mini-boss made of gears and armor plates, glowing core, {STYLE}",
    "mimic": "A treasure chest with a toothy maw and long tongue, disguised mimic monster, {STYLE}",
    "colosseum_beast": "A wild illusionary beast in an arena pit, glowing eyes and claws, {STYLE}",

    # --- Items ---
    "whisper": "A curved shortblade dagger with a whisper-silent edge, ornate, ember glow, {STYLE}",
    "truthlens": "A crystal lens held in a hand, glowing faintly, revealing a hidden wall behind it, {STYLE}",
    "shadowcloak": "A cloak of woven shadow dissolving at the edges, {STYLE}",
    "starlight": "A glowing vial of liquid starlight, {STYLE}",
    "irone": "A plain iron nail with runes, grounding sigil, {STYLE}",
    "memorythread": "A faint glowing thread tied to a mirror shard, {STYLE}",
    "perspective": "A lens revealing an impossible stairway as normal when looked through, {STYLE}",
    "goldengate": "An ornate ornate key with a gate motif, {STYLE}",
    "gauntlets": "A pair of worn leather gauntlets with lockpickHarness, {STYLE}",
    "gilder": "A wing-like glider backpack made of concealment Cloth, {STYLE}",
    "voidcloak": "A cloak woven from void, barely visible at edges, {STYLE}",
    "sigil": "A champion's sigil emblem, glowing, {STYLE}",
    "regent": "A wizard's signet ring with mirror motif, {STYLE}",
    "chin": "A crystal glass bottle stoppered with cork, glowing inside, {STYLE}",
}

PROMPTS = {k: v.replace("{STYLE}", STYLE) for k, v in PROMPTS.items()}


def serve():
    lines = [l.strip() for l in open(CREDS, encoding="utf-8").read().split('\n') if l.strip()]
    return lines[0], lines[1] if len(lines) > 1 else ''


def run():
    if not os.path.isdir(OUTDIR):
        os.makedirs(OUTDIR, exist_ok=True)
    token, acct = serve()
    import urllib.request as ur
    base = f"https://api.cloudflare.com/client/v4/accounts/{acct}/ai/run/"
    only = sys.argv[1:]
    for name, prompt in PROMPTS.items():
        if only and name not in only:
            continue
        outpath = os.path.join(OUTDIR, name + ".png")
        if os.path.isfile(outpath):
            print(name, "skip (exists)")
            continue
        data = json.dumps({"prompt": prompt}).encode()
        req = ur.Request(base + MODEL, data=data)
        req.add_header('Authorization', f'Bearer {token}')
        req.add_header('Content-Type', 'application/json')
        try:
            with ur.urlopen(req, timeout=120) as resp:
                body = resp.read()
                if not resp.headers.get('Content-Type', '').startswith('image/'):
                    body = base64.b64decode(json.loads(body)['result']['image'])
        except Exception as e:
            print(name, "ERR", e); continue
        with open(outpath, 'wb') as f:
            f.write(body)
        print(name, "OK", len(body))


if __name__ == "__main__":
    run()
