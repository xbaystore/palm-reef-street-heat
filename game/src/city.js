// The city of Palm Reef: six districts on a 3x2 grid, blocks on a 480 pitch, roads on
// the multiples of 480. Blocks roll building / parking / park; the four story
// landmarks sit on fixed blocks. Collision is circle-vs-building-rectangle, and
// line of sight is sampled along the segment. All of it seeded, no wall clock.

import { CITY, DISTRICTS, SHOP_SIGNS, WORLD } from './config.js';
import { createRandom, pick, randInt, range } from './random.js';

export { DISTRICTS };

const PITCH = CITY.pitch;
const HALF = CITY.roadHalf;

/** The four fixed story places: {x, y} points plus the block they sit on. */
export const LANDMARKS = {
  garage: { x: 1200, y: 2386, col: 2, row: 4 },
  marinaDrop: { x: 2160, y: 2788, col: 4, row: 5 },
  portYard: { x: 3120, y: 720, col: 6, row: 1 },
  uptownLot: { x: 720, y: 720, col: 1, row: 1 },
};

export function blockRect(col, row) {
  return { x: col * PITCH + HALF, y: row * PITCH + HALF, w: PITCH - HALF * 2, h: PITCH - HALF * 2 };
}

export function districtIndex(x, y) {
  const col = Math.min(2, Math.max(0, Math.floor(x / 1280)));
  const row = Math.min(1, Math.max(0, Math.floor(y / 1440)));
  return row * 3 + col;
}

export function districtAt(x, y) {
  return DISTRICTS[districtIndex(x, y)];
}

/** A stable 0..1 hash of a grid position, for lit windows and per-building shade. */
export function hash2(cx, cy) {
  let h = (cx * 374761393 + cy * 668265263) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function buildBlock(rng, col, row, district) {
  const rect = blockRect(col, row);
  const roll = rng();
  let type = roll < 0.68 ? 'building' : roll < 0.84 ? 'parking' : 'park';
  // Forced types for the story landmarks.
  if (col === LANDMARKS.garage.col && row === LANDMARKS.garage.row) type = 'garage';
  if (col === LANDMARKS.uptownLot.col && row === LANDMARKS.uptownLot.row) type = 'parking';
  if (col === LANDMARKS.portYard.col && row === LANDMARKS.portYard.row) type = 'parking';
  if (col === LANDMARKS.marinaDrop.col && row === LANDMARKS.marinaDrop.row) type = 'park';

  const block = { col, row, type, rect, district, buildings: [], spots: [], palms: [], sign: null };
  if (type === 'building' || type === 'garage') {
    const pattern = type === 'garage' ? 1 : randInt(rng, 1, 3);
    const roof = pick(rng, district.roofs);
    const shade = 0.86 + rng() * 0.24;
    if (pattern === 1) {
      block.buildings.push({ x: rect.x + 24, y: rect.y + 24, w: rect.w - 48, h: rect.h - 48, roof, shade, seed: hash2(col, row) });
    } else if (pattern === 2) {
      const gap = 20;
      const w = (rect.w - 48 - gap) / 2;
      block.buildings.push({ x: rect.x + 24, y: rect.y + 24, w, h: rect.h - 48, roof, shade, seed: hash2(col, row) });
      block.buildings.push({ x: rect.x + 24 + w + gap, y: rect.y + 24, w, h: rect.h - 48, roof: pick(rng, district.roofs), shade: 0.86 + rng() * 0.24, seed: hash2(col + 9, row) });
    } else {
      const gap = 20;
      const w = (rect.w - 48 - gap) / 2;
      const h = (rect.h - 48 - gap) / 2;
      for (let i = 0; i < 4; i += 1) {
        const bx = rect.x + 24 + (i % 2) * (w + gap);
        const by = rect.y + 24 + Math.floor(i / 2) * (h + gap);
        block.buildings.push({ x: bx, y: by, w, h, roof: pick(rng, district.roofs), shade: 0.86 + rng() * 0.24, seed: hash2(col * 4 + i, row * 4 + i) });
      }
    }
    if (district.name === 'DOWNTOWN' || district.name === 'OLD TOWN' || district.name === 'MARINA') {
      block.sign = pick(rng, SHOP_SIGNS);
    }
    if (type === 'garage') {
      block.sign = "MARLA'S MOTORWORKS";
      block.buildings[0].roof = '#a83a2e';
    }
  } else if (type === 'parking') {
    // Two rows of marked bays across the block.
    for (let i = 0; i < 6; i += 1) {
      block.spots.push({ x: rect.x + 40 + i * 52, y: rect.y + 60, angle: Math.PI / 2 });
      block.spots.push({ x: rect.x + 40 + i * 52, y: rect.y + rect.h - 60, angle: -Math.PI / 2 });
    }
  } else {
    // Park: a few palms scattered inside the block.
    const n = randInt(rng, 3, 6);
    for (let i = 0; i < n; i += 1) {
      block.palms.push({ x: range(rng, rect.x + 40, rect.x + rect.w - 40), y: range(rng, rect.y + 40, rect.y + rect.h - 40) });
    }
  }
  return block;
}

export function createCity(seed) {
  const rng = createRandom(seed);
  const blocks = [];
  const buildings = [];
  for (let row = 0; row < CITY.rows; row += 1) {
    for (let col = 0; col < CITY.cols; col += 1) {
      const district = DISTRICTS[Math.floor(row / 3) * 3 + Math.floor(col / 3)];
      // Districts are 3 across x 2 down over the 8x6 block grid: map by thirds of the world.
      const dIndex = districtIndex((col + 0.5) * PITCH, (row + 0.5) * PITCH);
      const block = buildBlock(rng, col, row, DISTRICTS[dIndex]);
      blocks.push(block);
      for (const b of block.buildings) buildings.push(b);
    }
  }
  // Palms along the Marina / Coral Bay coast and in parks.
  const palms = [];
  for (let i = 0; i < 26; i += 1) {
    palms.push({ x: range(rng, 1300, 3800), y: range(rng, WORLD.sandTop + 8, WORLD.sandTop + 60) });
  }
  for (const block of blocks) {
    if (block.type === 'park') for (const p of block.palms) palms.push(p);
  }
  return { seed, blocks, buildings, palms, landmarks: LANDMARKS };
}

/** Push a circle out of every building it overlaps. Returns the corrected position and whether it hit. */
export function collideCircle(city, x, y, r) {
  let hit = false;
  for (let i = 0; i < city.buildings.length; i += 1) {
    const b = city.buildings[i];
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      y = cy + (dy / d) * r;
    } else {
      // Centre inside the rectangle: push out along the smallest penetration.
      const left = x - b.x + r;
      const right = b.x + b.w - x + r;
      const top = y - b.y + r;
      const bottom = b.y + b.h - y + r;
      const m = Math.min(left, right, top, bottom);
      if (m === left) x = b.x - r;
      else if (m === right) x = b.x + b.w + r;
      else if (m === top) y = b.y - r;
      else y = b.y + b.h + r;
    }
  }
  return { x, y, hit };
}

/** True when no building stands between the two points (sampled every 24 px). */
export function lineOfSight(city, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(1, Math.ceil(dist / 24));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = x1 + dx * t;
    const y = y1 + dy * t;
    for (let j = 0; j < city.buildings.length; j += 1) {
      const b = city.buildings[j];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return false;
    }
  }
  return true;
}

/** The nearest road-junction point (multiples of 480) to a position. */
export function nearestJunction(x, y) {
  return { x: Math.round(x / PITCH) * PITCH, y: Math.round(y / PITCH) * PITCH };
}

/** Is this point on a road (within the road half-width of a grid line)? */
export function onRoad(x, y) {
  const rx = x % PITCH;
  const ry = y % PITCH;
  const dx = Math.min(rx, PITCH - rx);
  const dy = Math.min(ry, PITCH - ry);
  return dx <= HALF || dy <= HALF;
}
