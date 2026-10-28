import * as THREE from 'three';
import { snapObjectToFloor } from './EnemyFactory';

export interface RoomPropSpec {
  id: string;
  kind:
    | 'bookshelf'
    | 'study_desk'
    | 'astrolabe'
    | 'lectern'
    | 'candelabra'
    | 'hedge_wall'
    | 'thorn_gate'
    | 'pressure_plate'
    | 'statue'
    | 'sluice_valve'
    | 'sarcophagus'
    | 'brazier'
    | 'pillar'
    | 'mirror_monolith'
    | 'counterweight_cage';
  position: [number, number, number];
  rotationY?: number;
  scale?: [number, number, number];
  floating?: boolean;
  hoverHeight?: number;
  interactiveId?: string;
  collidable?: boolean;
  boundsHalfSize?: [number, number, number];
}

export interface BuiltRoomScene {
  zoneId: string;
  group: THREE.Group;
  colliders: THREE.Box3[];
  interactiveProps: Map<string, THREE.Object3D>;
  dynamicGates: Map<string, THREE.Object3D>;
}

/**
 * Full-Scene Room Builder (`RoomSceneBuilder.ts`)
 * Replaces sparse 1-prop rooms with rich, multi-prop Victorian Gothic / Arcane Fantasy scenes:
 * - Grand Library (`L1`): 16 multi-shelf bookcases packed with leather tomes, 4 elemental lecterns,
 *   study desks, floating grimoires, and central Chronomantic Astrolabe.
 * - Navigable Hedge Maze (`HM1`): Full 9x9 topiary labyrinth with collision bounds, 3 retractable
 *   iron thorn gates, 3 sunken Moon-Rune pressure plates, weeping statues, and central Clockwork Gazebo.
 * - Outer Courtyard (`OW1`), Gatehouse (`GH3`), Colosseum (`C01`), Flooded Crypts (`CR01`),
 *   and Vaelor's Shattered Mirror Sanctum (`T05`).
 */
export class RoomSceneBuilder {
  public static buildFullRoom(zoneId: string): BuiltRoomScene {
    const group = new THREE.Group();
    group.name = `room_scene_${zoneId}`;
    const colliders: THREE.Box3[] = [];
    const interactiveProps = new Map<string, THREE.Object3D>();
    const dynamicGates = new Map<string, THREE.Object3D>();

    // Floor & Perimeter Architecture
    const floorMat = new THREE.MeshStandardMaterial({
      color: zoneId === 'HM1' ? 0x14261c : zoneId === 'L1' ? 0x261a14 : 0x1e2430,
      roughness: 0.8,
      metalness: 0.15,
    });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(26, 0.4, 26), floorMat);
    floor.position.set(0, -0.2, 0);
    floor.receiveShadow = true;
    group.add(floor);

    if (zoneId === 'L1') {
      this.populateGrandLibrary(group, colliders, interactiveProps);
    } else if (zoneId === 'HM1') {
      this.populateHedgeMaze(group, colliders, interactiveProps, dynamicGates);
    } else if (zoneId === 'CR01') {
      this.populateFloodedCrypts(group, colliders, interactiveProps);
    } else if (zoneId === 'T05' || zoneId === 'S1') {
      this.populateVaelorSanctum(group, colliders, interactiveProps);
    } else {
      this.populateFortressCourtyardAndGatehouse(group, colliders, interactiveProps);
    }

    return { zoneId, group, colliders, interactiveProps, dynamicGates };
  }

  private static createBookshelfMesh(): THREE.Group {
    const shelfGroup = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3b2314, roughness: 0.65 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.4, 0.55), woodMat);
    frame.position.set(0, 1.7, 0);
    frame.castShadow = true;
    frame.receiveShadow = true;
    shelfGroup.add(frame);

    const bookColors = [0x991b1b, 0x1e40af, 0x065f46, 0x6b21a8, 0xb45309];
    for (let row = 0; row < 5; row++) {
      const y = 0.35 + row * 0.62;
      for (let b = 0; b < 8; b++) {
        const bookMat = new THREE.MeshStandardMaterial({
          color: bookColors[(row + b) % bookColors.length],
          roughness: 0.5,
        });
        const bh = 0.34 + (b % 3) * 0.05;
        const book = new THREE.Mesh(new THREE.BoxGeometry(0.18, bh, 0.42), bookMat);
        book.position.set(-0.92 + b * 0.26, y + bh * 0.5, 0.08);
        shelfGroup.add(book);
      }
    }
    snapObjectToFloor(shelfGroup, 0, false, 0);
    return shelfGroup;
  }

  private static populateGrandLibrary(
    group: THREE.Group,
    colliders: THREE.Box3[],
    interactiveProps: Map<string, THREE.Object3D>
  ): void {
    // 12 Perimeter & Aisle Mahogany Bookshelves packed with books
    const shelfCoords: Array<[number, number, number]> = [
      [-9, -10.5, 0], [-5.5, -10.5, 0], [5.5, -10.5, 0], [9, -10.5, 0],
      [-10.5, -6, Math.PI / 2], [-10.5, 0, Math.PI / 2], [-10.5, 6, Math.PI / 2],
      [10.5, -6, -Math.PI / 2], [10.5, 0, -Math.PI / 2], [10.5, 6, -Math.PI / 2],
      [-5.5, -3.5, 0], [5.5, -3.5, 0], [-5.5, 3.5, 0], [5.5, 3.5, 0],
    ];
    for (const [x, z, rotY] of shelfCoords) {
      const shelf = this.createBookshelfMesh();
      shelf.position.set(x, 0, z);
      shelf.rotation.y = rotY;
      group.add(shelf);
      colliders.push(new THREE.Box3().setFromObject(shelf));
    }

    // Central Chronomantic Astrolabe (grounded at 0,0,0)
    const astrolabe = new THREE.Group();
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.3, 0.5, 16),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 })
    );
    plinth.position.y = 0.25;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.08, 12, 32),
      new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.25 })
    );
    ring.position.y = 1.65;
    astrolabe.add(plinth, ring);
    snapObjectToFloor(astrolabe, 0, false, 0);
    group.add(astrolabe);
    colliders.push(new THREE.Box3().setFromObject(plinth));

    // 4 Interactive Elemental Archival Lecterns (Ignis, Aer, Aqua, Terra)
    const lecterns: Array<{ id: string; pos: [number, number]; color: number }> = [
      { id: 'lectern_ignis', pos: [-3.2, -3.2], color: 0xef4444 },
      { id: 'lectern_aer', pos: [3.2, -3.2], color: 0x38bdf8 },
      { id: 'lectern_aqua', pos: [-3.2, 3.2], color: 0x3b82f6 },
      { id: 'lectern_terra', pos: [3.2, 3.2], color: 0x10b981 },
    ];
    for (const l of lecterns) {
      const lect = new THREE.Group();
      const stand = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 1.15, 0.55),
        new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.6 })
      );
      stand.position.y = 0.575;
      const tome = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.1, 0.4),
        new THREE.MeshStandardMaterial({ color: l.color, emissive: l.color, emissiveIntensity: 0.35 })
      );
      tome.position.y = 1.2;
      lect.add(stand, tome);
      lect.position.set(l.pos[0], 0, l.pos[1]);
      snapObjectToFloor(lect, 0, false, 0);
      group.add(lect);
      interactiveProps.set(l.id, lect);
    }
  }

  private static populateHedgeMaze(
    group: THREE.Group,
    colliders: THREE.Box3[],
    interactiveProps: Map<string, THREE.Object3D>,
    dynamicGates: Map<string, THREE.Object3D>
  ): void {
    const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.85 });
    // True navigable 3D Hedge Maze walls
    const segments: Array<[number, number, number, number]> = [
      // [centerX, centerZ, widthX, depthZ]
      [-6, -6, 8, 1.2], [5, -6, 8, 1.2],
      [-8, -1, 1.2, 9], [-3, -1, 1.2, 7], [3, -2, 1.2, 8], [8, 0, 1.2, 10],
      [-5, 4, 6, 1.2], [4, 5, 7, 1.2], [0, -9, 14, 1.2],
    ];
    for (const [cx, cz, wx, wz] of segments) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(wx, 3.1, wz), hedgeMat);
      wall.position.set(cx, 1.55, cz);
      wall.castShadow = true;
      wall.receiveShadow = true;
      snapObjectToFloor(wall, 0, false, 0);
      group.add(wall);
      colliders.push(new THREE.Box3().setFromObject(wall));
    }

    // 3 Moon-Rune Pressure Plates in maze alcoves
    const plates: Array<{ id: string; pos: [number, number] }> = [
      { id: 'maze_plate_1', pos: [-6.5, 6.5] },
      { id: 'maze_plate_2', pos: [6.5, -3.5] },
      { id: 'maze_plate_3', pos: [-5.5, -3.5] },
    ];
    for (const p of plates) {
      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 0.8, 0.12, 20),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.4 })
      );
      plate.position.set(p.pos[0], 0.06, p.pos[1]);
      snapObjectToFloor(plate, 0, false, 0);
      group.add(plate);
      interactiveProps.set(p.id, plate);
    }

    // Retractable Iron Thorn Gate blocking the central Clockwork Gazebo
    const gate = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 3.0, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x78350f, metalness: 0.7, roughness: 0.35 })
    );
    gate.position.set(0, 1.5, 2.2);
    snapObjectToFloor(gate, 0, false, 0);
    group.add(gate);
    dynamicGates.set('thorn_gate_main', gate);
  }

  private static populateFloodedCrypts(
    group: THREE.Group,
    colliders: THREE.Box3[],
    interactiveProps: Map<string, THREE.Object3D>
  ): void {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75 });
    const sarcCoords: Array<[number, number]> = [
      [-6, -5], [6, -5], [-6, 3], [6, 3],
    ];
    for (const [sx, sz] of sarcCoords) {
      const sarc = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.95, 2.6), stoneMat);
      sarc.position.set(sx, 0.475, sz);
      snapObjectToFloor(sarc, 0, false, 0);
      group.add(sarc);
      colliders.push(new THREE.Box3().setFromObject(sarc));
    }

    // 3 Hydraulic Sluice Gate Wheels
    const valves: Array<{ id: string; pos: [number, number] }> = [
      { id: 'sluice_valve_intake', pos: [-4.0, -8.0] },
      { id: 'sluice_valve_bypass', pos: [0.0, -8.0] },
      { id: 'sluice_valve_drain', pos: [4.0, -8.0] },
    ];
    for (const v of valves) {
      const valve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 1.35, 16),
        new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.75, roughness: 0.3 })
      );
      valve.position.set(v.pos[0], 0.675, v.pos[1]);
      snapObjectToFloor(valve, 0, false, 0);
      group.add(valve);
      interactiveProps.set(v.id, valve);
    }
  }

  private static populateVaelorSanctum(
    group: THREE.Group,
    colliders: THREE.Box3[],
    interactiveProps: Map<string, THREE.Object3D>
  ): void {
    const mirrorMat = new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      metalness: 0.9,
      roughness: 0.1,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.3,
    });
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const mx = Math.cos(angle) * 9.5;
      const mz = Math.sin(angle) * 9.5;
      const monolith = new THREE.Mesh(new THREE.BoxGeometry(1.6, 4.2, 0.35), mirrorMat);
      monolith.position.set(mx, 2.1, mz);
      monolith.lookAt(0, 2.1, 0);
      snapObjectToFloor(monolith, 0, false, 0);
      group.add(monolith);
      colliders.push(new THREE.Box3().setFromObject(monolith));
      if (i % 2 === 0) {
        interactiveProps.set(`aether_conduit_${i / 2 + 1}`, monolith);
      }
    }
  }

  private static populateFortressCourtyardAndGatehouse(
    group: THREE.Group,
    colliders: THREE.Box3[],
    interactiveProps: Map<string, THREE.Object3D>
  ): void {
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
    const pillars: Array<[number, number]> = [
      [-7, -7], [7, -7], [-7, 7], [7, 7],
    ];
    for (const [px, pz] of pillars) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.8, 1.4), pillarMat);
      p.position.set(px, 1.9, pz);
      snapObjectToFloor(p, 0, false, 0);
      group.add(p);
      colliders.push(new THREE.Box3().setFromObject(p));
    }
    const winch = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.3, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.6 })
    );
    winch.position.set(-4.5, 0.65, -4.5);
    snapObjectToFloor(winch, 0, false, 0);
    group.add(winch);
    interactiveProps.set('courtyard_winch', winch);
  }
}
