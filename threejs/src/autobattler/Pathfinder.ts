/**
 * Grid A* pathfinding for the Veilkeep auto-battler.
 *
 * The fortress rooms are axis-aligned shells with a handful of static box
 * colliders (walls, pillars, gate jambs). Rapier exposes those boxes to the
 * game, and the auto-battler turns them into an inflatable obstacle set so the
 * automaton can route around walls instead of grinding into them.
 */

export interface Point {
  x: number;
  z: number;
}

export interface ObstacleRect {
  /** Centre of the box on the X axis. */
  x: number;
  /** Centre of the box on the Z axis. */
  z: number;
  /** Half extent on X. */
  hx: number;
  /** Half extent on Z. */
  hz: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const DEFAULT_BOUNDS: Bounds = { minX: -5.9, maxX: 5.9, minZ: -5.9, maxZ: 5.9 };
export const DEFAULT_RADIUS = 0.48;

const EPSILON = 1e-6;

export function isBlockedAt(
  x: number,
  z: number,
  obstacles: readonly ObstacleRect[],
  radius: number = DEFAULT_RADIUS,
): boolean {
  for (const o of obstacles) {
    if (Math.abs(x - o.x) <= o.hx + radius + EPSILON && Math.abs(z - o.z) <= o.hz + radius + EPSILON) {
      return true;
    }
  }
  return false;
}

/** True when a straight walk between two points clears every inflated box. */
export function hasLineOfSight(
  from: Point,
  to: Point,
  obstacles: readonly ObstacleRect[],
  radius: number = DEFAULT_RADIUS,
): boolean {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dz);
  if (dist < EPSILON) return !isBlockedAt(from.x, from.z, obstacles, radius);
  const step = 0.16;
  const steps = Math.max(1, Math.ceil(dist / step));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (isBlockedAt(from.x + dx * t, from.z + dz * t, obstacles, radius)) return false;
  }
  return true;
}

interface GridNode {
  ix: number;
  iz: number;
  g: number;
  f: number;
  parent: GridNode | null;
}

function key(ix: number, iz: number): number {
  // 512-wide grid packing keeps keys unique for the small fortress rooms.
  return iz * 512 + ix;
}

function toWorld(ix: number, iz: number, bounds: Bounds, cell: number): Point {
  return { x: bounds.minX + (ix + 0.5) * cell, z: bounds.minZ + (iz + 0.5) * cell };
}

function cellCount(bounds: Bounds, cell: number): { nx: number; nz: number } {
  return {
    nx: Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cell)),
    nz: Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / cell)),
  };
}

function nearestWalkableCell(
  point: Point,
  bounds: Bounds,
  cell: number,
  blocked: (x: number, z: number) => boolean,
): { ix: number; iz: number } {
  const { nx, nz } = cellCount(bounds, cell);
  const clampIx = (v: number): number => Math.min(nx - 1, Math.max(0, v));
  const clampIz = (v: number): number => Math.min(nz - 1, Math.max(0, v));
  const ix0 = clampIx(Math.floor((point.x - bounds.minX) / cell));
  const iz0 = clampIz(Math.floor((point.z - bounds.minZ) / cell));
  if (!blocked(bounds.minX + (ix0 + 0.5) * cell, bounds.minZ + (iz0 + 0.5) * cell)) {
    return { ix: ix0, iz: iz0 };
  }
  for (let ring = 1; ring <= 10; ring++) {
    for (let dz = -ring; dz <= ring; dz++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
        const ix = ix0 + dx;
        const iz = iz0 + dz;
        if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) continue;
        const wx = bounds.minX + (ix + 0.5) * cell;
        const wz = bounds.minZ + (iz + 0.5) * cell;
        if (!blocked(wx, wz)) return { ix, iz };
      }
    }
  }
  return { ix: ix0, iz: iz0 };
}

/**
 * Finds a walkable path from `start` to `goal`.
 *
 * Returns an empty array when the goal is already within `arriveRadius`.
 * Returns a single point when a straight line is clear.
 */
export function findPath(
  start: Point,
  goal: Point,
  obstacles: readonly ObstacleRect[],
  bounds: Bounds = DEFAULT_BOUNDS,
  radius: number = DEFAULT_RADIUS,
  cell: number = 0.5,
  arriveRadius = 0.35,
): Point[] {
  if (Math.hypot(goal.x - start.x, goal.z - start.z) <= arriveRadius) return [];
  if (hasLineOfSight(start, goal, obstacles, radius)) return [{ x: goal.x, z: goal.z }];

  const blocked = (x: number, z: number): boolean => isBlockedAt(x, z, obstacles, radius);
  const { nx, nz } = cellCount(bounds, cell);
  const startCell = nearestWalkableCell(start, bounds, cell, blocked);
  const goalCell = nearestWalkableCell(goal, bounds, cell, blocked);

  const open = new Map<number, GridNode>();
  const closed = new Set<number>();
  const startNode: GridNode = {
    ix: startCell.ix,
    iz: startCell.iz,
    g: 0,
    f: Math.hypot(goalCell.ix - startCell.ix, goalCell.iz - startCell.iz),
    parent: null,
  };
  open.set(key(startNode.ix, startNode.iz), startNode);

  const neighbours: [number, number, number][] = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
  ];

  let guard = nx * nz * 4;
  while (open.size > 0 && guard-- > 0) {
    let current: GridNode | null = null;
    for (const node of open.values()) {
      if (!current || node.f < current.f || (node.f === current.f && node.g < current.g)) current = node;
    }
    if (!current) break;
    const currentKey = key(current.ix, current.iz);
    if (current.ix === goalCell.ix && current.iz === goalCell.iz) {
      return reconstruct(current, bounds, cell, goal, obstacles, radius);
    }
    open.delete(currentKey);
    closed.add(currentKey);

    for (const [dx, dz, cost] of neighbours) {
      const ix = current.ix + dx;
      const iz = current.iz + dz;
      if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) continue;
      const wx = bounds.minX + (ix + 0.5) * cell;
      const wz = bounds.minZ + (iz + 0.5) * cell;
      if (blocked(wx, wz)) continue;
      if (dx !== 0 && dz !== 0) {
        // Do not shave corners: both orthogonal cells must be free as well.
        const ox = bounds.minX + (current.ix + dx + 0.5) * cell;
        const oz = bounds.minZ + (current.iz + 0.5) * cell;
        const qx = bounds.minX + (current.ix + 0.5) * cell;
        const qz = bounds.minZ + (current.iz + dz + 0.5) * cell;
        if (blocked(ox, oz) || blocked(qx, qz)) continue;
      }
      const nk = key(ix, iz);
      if (closed.has(nk)) continue;
      const g = current.g + cost;
      const h = Math.hypot(goalCell.ix - ix, goalCell.iz - iz);
      const existing = open.get(nk);
      if (existing && existing.g <= g) continue;
      open.set(nk, { ix, iz, g, f: g + h, parent: current });
    }
  }

  return [];
}

function reconstruct(
  node: GridNode,
  bounds: Bounds,
  cell: number,
  goal: Point,
  obstacles: readonly ObstacleRect[],
  radius: number,
): Point[] {
  const raw: Point[] = [];
  let n: GridNode | null = node;
  while (n) {
    raw.push(toWorld(n.ix, n.iz, bounds, cell));
    n = n.parent;
  }
  raw.reverse();
  if (raw.length === 0) return [];

  // Greedy string-pulling so the player cuts corners instead of zig-zagging.
  const smoothed: Point[] = [];
  let anchor = 0;
  smoothed.push(raw[0]);
  for (let i = 1; i < raw.length - 1; i++) {
    if (!hasLineOfSight(raw[anchor], raw[i + 1], obstacles, radius)) {
      smoothed.push(raw[i]);
      anchor = i;
    }
  }
  if (raw.length > 1) smoothed.push(raw[raw.length - 1]);

  // If the exact goal is reachable from the final cell, finish on it so the
  // automaton lands precisely on pickups and levers.
  const last = smoothed[smoothed.length - 1];
  if (last && hasLineOfSight(last, goal, obstacles, radius)) smoothed.push({ x: goal.x, z: goal.z });
  if (smoothed.length > 2) smoothed.shift();
  return smoothed;
}

/**
 * Pulls the final waypoint ~0.55 units toward the room centre so door triggers
 * (which sit inside wall colliders) remain reachable.
 */
export function doorApproachPoint(door: Point, roomCenter: Point = { x: 0, z: 0 }, inset = 0.55): Point {
  const dx = roomCenter.x - door.x;
  const dz = roomCenter.z - door.z;
  const dist = Math.hypot(dx, dz);
  if (dist < EPSILON) return { ...door };
  return { x: door.x + (dx / dist) * inset, z: door.z + (dz / dist) * inset };
}
