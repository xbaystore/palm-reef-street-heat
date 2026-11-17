// Sidewalk walkers. Each one strolls a loop around one block's sidewalk; fast cars,
// a punching player or a nearby police chase makes them flee; two punches (or a car
// at speed) knock them down for a few seconds. One pedestrian can also be told to
// `stand` — the mission scene's contact at the drop point.

import { PEDESTRIANS, WORLD } from './config.js';
import { blockRect } from './city.js';
import { randInt, range } from './random.js';

export const SHIRT_COLORS = [
  '#e8e8e8', '#c94f43', '#4f7ec9', '#f2c94c', '#3f8a4f', '#8a6fb8',
  '#e07a2f', '#2fb3a8', '#d94f7a', '#7a8a99',
];

/** Perimeter of the sidewalk loop around a block, inset 12 px from the block edge. */
function loopRect(block) {
  const r = block.rect;
  return { x: r.x - 12, y: r.y - 12, w: r.w + 24, h: r.h + 24 };
}

function loopPerimeter(r) {
  return 2 * (r.w + r.h);
}

/** Point `t` px along the loop, starting at the top-left corner, clockwise. */
export function loopPoint(r, t) {
  const p = ((t % loopPerimeter(r)) + loopPerimeter(r)) % loopPerimeter(r);
  if (p < r.w) return { x: r.x + p, y: r.y };
  if (p < r.w + r.h) return { x: r.x + r.w, y: r.y + (p - r.w) };
  if (p < 2 * r.w + r.h) return { x: r.x + r.w - (p - r.w - r.h), y: r.y + r.h };
  return { x: r.x, y: r.y + r.h - (p - 2 * r.w - r.h) };
}

export function spawnPedestrians(city, rng, count = PEDESTRIANS.count) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const block = city.blocks[Math.floor(rng() * city.blocks.length)];
    const loop = loopRect(block);
    const t = range(rng, 0, loopPerimeter(loop));
    const at = loopPoint(loop, t);
    out.push({
      x: at.x,
      y: at.y,
      block: { col: block.col, row: block.row },
      t,
      dir: rng() < 0.5 ? 1 : -1,
      speed: PEDESTRIANS.walk,
      state: 'walk',
      downTimer: 0,
      punches: 0,
      fleeTimer: 0,
      shirt: SHIRT_COLORS[Math.floor(rng() * SHIRT_COLORS.length)],
      bob: range(rng, 0, Math.PI * 2),
    });
  }
  return out;
}

/** Two punches (or a car at speed) put a pedestrian down; returns true when downed. */
export function knockDown(ped) {
  ped.punches += 1;
  if (ped.punches >= PEDESTRIANS.punchesToDown) {
    ped.state = 'down';
    ped.downTimer = PEDESTRIANS.knockTime;
    ped.punches = 0;
    return true;
  }
  return false;
}

/** Is this pedestrian scared right now (fast car, punching player, police close)? */
function threatNear(world, ped) {
  const p = world.player;
  if (!p.car) {
    const d = Math.hypot(p.x - ped.x, p.y - ped.y);
    if (d < 60 && world.input.punch) return { x: p.x, y: p.y };
  }
  const cars = [];
  if (p.car) cars.push(p.car);
  for (const t of world.traffic) cars.push(t.car);
  for (const pc of world.police) cars.push(pc);
  for (const car of cars) {
    if (Math.abs(car.speed) < 120) continue;
    const d = Math.hypot(car.x - ped.x, car.y - ped.y);
    if (d < 90) return { x: car.x, y: car.y };
  }
  return null;
}

export function stepPedestrians(world, dt) {
  for (const ped of world.pedestrians) {
    if (ped.state === 'stand') continue;
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.state = 'walk';
        ped.punches = 0;
      }
      continue;
    }
    const threat = threatNear(world, ped);
    if (threat) {
      ped.state = 'flee';
      ped.fleeTimer = 1.2;
    }
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      const dx = ped.x - (threat ? threat.x : world.player.x);
      const dy = ped.y - (threat ? threat.y : world.player.y);
      const d = Math.hypot(dx, dy) || 1;
      ped.x += (dx / d) * PEDESTRIANS.flee * dt;
      ped.y += (dy / d) * PEDESTRIANS.flee * dt;
      ped.x = Math.max(20, Math.min(WORLD.w - 20, ped.x));
      ped.y = Math.max(20, Math.min(WORLD.h - 20, ped.y));
      if (ped.fleeTimer <= 0) {
        ped.state = 'walk';
        // Snap back onto the nearest point of the home block's loop.
        const block = world.city.blocks.find((b) => b.col === ped.block.col && b.row === ped.block.row);
        if (block) {
          const loop = loopRect(block);
          const per = loopPerimeter(loop);
          let bestT = 0;
          let bestD = Infinity;
          for (let t = 0; t < per; t += 12) {
            const at = loopPoint(loop, t);
            const dd = Math.hypot(at.x - ped.x, at.y - ped.y);
            if (dd < bestD) {
              bestD = dd;
              bestT = t;
            }
          }
          ped.t = bestT;
          const at = loopPoint(loop, bestT);
          // The bottom of a southern block's loop runs into the bay: keep
          // walkers on the sand, not in the water.
          if (at.y > WORLD.sandTop - 4) at.y = WORLD.sandTop - 4;
          ped.x = at.x;
          ped.y = at.y;
        }
      }
      continue;
    }
    // Stroll the loop.
    const block = world.city.blocks.find((b) => b.col === ped.block.col && b.row === ped.block.row);
    if (!block) continue;
    const loop = loopRect(block);
    ped.t += ped.dir * ped.speed * dt;
    const at = loopPoint(loop, ped.t);
    // The bottom of a southern block's loop runs into the bay: keep walkers
    // on the sand, not in the water.
    if (at.y > WORLD.sandTop - 4) at.y = WORLD.sandTop - 4;
    ped.x = at.x;
    ped.y = at.y;
    ped.bob += dt * 6;
  }
}
