// VEILKEEP — three.js helper: build a 3x/4x map from ASCII dungeon maps
//
// Conventions (dungeon cartography skill):
//   '#' wall, '.' floor, '+' door, '@' hero, letters label rooms.
//
// Exposes TILE_SIZE, TILESET_KEYS, and buildFromAscii(asciiLines) that returns
// an array of { x, y, kind, label } ready to be turned into THREE.PlaneGeometry.

export const TILE_SIZE = 32;

export const TILESET_KEYS = {
  wall:  { tx: 0, ty: 0 },   // generic wall block (texture atlas coordinates)
  floor: { tx: 1, ty: 0 },   // generic floor block
  door:  { tx: 2, ty: 0 },   // door tile
  hero:  { tx: 3, ty: 0 },   // hero marker
  room:  { tx: 4, ty: 0 },   // labeled room tile
};

export function buildFromAscii(lines) {
  const tiles = [];
  for (let row = 0; row < lines.length; row++) {
    const line = lines[row];
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch === ' ') continue;
      let kind = 'floor';
      if (ch === '#') kind = 'wall';
      else if (ch === '+') kind = 'door';
      else if (ch === '@') kind = 'hero';
      else if (ch !== '.') kind = 'room';
      const label = ch !== '.' && ch !== '#' && ch !== '+' && ch !== '@' ? ch : null;
      tiles.push({ x: col, y: row, kind, label });
    }
  }
  return tiles;
}

// ASCII fortress overview (dungeon-cartography skill conventions)
// '#' walls, '.' floor, '+' doors, '@' hero, letters label rooms (A-P).
export const OVERVIEW = [
'  ############  ############  ############  ############  ',
'  #..........#  #..........#  #..........#  #..........#  ',
'  #...@.A....+..+.....B....+..+.....C....+..+.....D....#  ',
'  #..........#  #..........#  #..........#  #..........#  ',
'  #####+######  #####+######  #####+######  #####+######  ',
'        .             .             .             .        ',
'        .             .             .             .        ',
'  #####+######  #####+######  #####+######  #####+######  ',
'  #..........#  #..........#  #..........#  #..........#  ',
'  #.....E....+..+.....F....+..+.....G....+..+.....H....#  ',
'  #..........#  #..........#  #..........#  #..........#  ',
'  #####+######  #####+######  #####+######  #####+######  ',
'        .             .             .             .        ',
'        .             .             .             .        ',
'  #####+######  #####+######  #####+######  #####+######  ',
'  #..........#  #..........#  #..........#  #..........#  ',
'  #.....I....+..+.....J....+..+.....K....+..+.....L....#  ',
'  #..........#  #..........#  #..........#  #..........#  ',
'  #####+######  #####+######  #####+######  #####+######  ',
'        .             .             .             .        ',
'        .             .             .             .        ',
'  #####+######  #####+######  #####+######  #####+######  ',
'  #..........#  #..........#  #..........#  #..........#  ',
'  #.....M....+..+.....N....+..+.....O....+..+.....P....#  ',
'  #..........#  #..........#  #..........#  #..........#  ',
'  ############  ############  ############  ############  ',
];

// Example usage:
//   const scene = new THREE.Scene();
//   const tiles = buildFromAscii(OVERVIEW);
//   tiles.forEach(t => {
//     const geo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
//     const mat = new THREE.MeshBasicMaterial({ map: tileTextureFor(t.kind), transparent: true });
//     const mesh = new THREE.Mesh(geo, mat);
//     mesh.position.set(t.x * TILE_SIZE, -t.y * TILE_SIZE, 0);
//     scene.add(mesh);
//   });
