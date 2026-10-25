/**
 * Strongly-typed Asset Manifest for VEILKEEP
 * Pre-maps all 2D textures, sprites, animations, and concept art
 */
export const ASSETS = {
  TILES: {
    DUNGEON_FLOOR: 'assets/art/dungeon_tiles/TilesDungeon/Tile.png',
    DUNGEON_WALL: 'assets/art/dungeon_tiles/TilesDungeon/Wall.png',
    DUNGEON_TILESET_FULL: 'assets/art/tileset_dungeon.png',
    TOPDOWN_16: 'assets/art/topdown16_326.png',
  },
  CHARACTERS: {
    RPG_CHARACTERS_32: 'assets/art/rpgCharacterSprites32x32.png',
    MALE_TOPDOWN: 'assets/art/male_top_down_01.png',
    SKELETON_ATTACK: 'assets/art/skeleton_attack.png',
    GARGOYLE: 'assets/art/gargoyle.png',
    WIZARD_IDLE_BASE: 'assets/art/magician/magician/sequences/idle/Armature_idle_00.png',
    WIZARD_WALK_BASE: 'assets/art/magician/magician/sequences/walk/Armature_walk_00.png',
    WIZARD_RUN_BASE: 'assets/art/magician/magician/sequences/run/Armature_run_00.png',
    WIZARD_DIE_BASE: 'assets/art/magician/magician/sequences/die/Armature_die_00.png',
  },
  PROPS: {
    MAGIC_MIRROR: 'assets/art/magic_mirror.png',
    CHEST: 'assets/art/chest2.png',
    COIN_SPIN: 'assets/art/coin_11.png',
  },
  CONCEPT: {
    SCENE00_APPROACH: 'assets/art/concept/scene00_approach.jpg',
    SCENE00_APPROACH_SUNKEN: 'assets/art/scene00_approach_sunken.png',
    KAELEN_HERO: 'assets/art/concept/kaelen_shadowhand_1792799728775.jpg',
    KAELEN_SPRITES: 'assets/art/concept/kaelen_sprites_1792799781645.jpg',
    VAELOR_BOSS: 'assets/art/concept/vaelor_archillusionist_1792799743519.jpg',
    VAELOR_SPRITES: 'assets/art/concept/vaelor_boss_sprite_1792799799160.jpg',
    ITEM_SHEET: 'assets/art/concept/item_sprites_sheet_1792799839861.jpg',
    HAUNTED_CHAMBERS: 'assets/art/concept/scene_haunted_chambers_1792807098179.jpg',
    GRYPHON_EYRIE: 'assets/art/concept/scene_gryphon_eyrie_1792807327186.jpg',
    HARMONIC_SALON: 'assets/art/concept/scene_harmonic_salon_1792805989082.jpg',
    DREAMING_GARDENS: 'assets/art/concept/scene_dreaming_gardens_1792800960597.jpg',
    ARCANE_LIBRARY: 'assets/art/concept/scene_arcane_library_1792800937780.jpg',
  }
} as const;

export type AssetCategory = keyof typeof ASSETS;
