// Traffic AI on the road rails, plus parked cars. A traffic car lives on one road
// (an x-road or a y-road) with a direction and a lane offset of +/-26 for
// right-hand driving; at a junction it may turn onto the crossing road. Cars brake
// for the car ahead. All decisions come from the world's seeded RNG.

import { CITY, TRAFFIC, WORLD } from './config.js';
import { createCar, randomCarColor, randomCarKind } from './vehicles.js';
import { randInt, range } from './random.js';

const PITCH = CITY.pitch;
const LANE = CITY.lane;

/** Pick a road line and a direction, then place the car on its right-hand lane. */
function spawnOne(rng) {
  const kind = randomCarKind(rng);
  const horizontal = rng() < 0.5;
  const line = randInt(rng, 0, 8) * PITCH;
  const along = range(rng, 60, WORLD.w - 60);
  const dir = rng() < 0.5 ? 1 : -1;
  let x;
  let y;
  let angle;
  if (horizontal) {
    // Eastbound rides the south lane (+26), westbound the north lane (-26).
    y = line + (dir === 1 ? LANE : -LANE);
    x = along;
    angle = dir === 1 ? 0 : Math.PI;
  } else {
    // Southbound rides the east lane (+26), northbound the west lane (-26).
    x = line + (dir === 1 ? LANE : -LANE);
    y = along;
    angle = dir === 1 ? Math.PI / 2 : -Math.PI / 2;
  }
  const car = createCar(kind, x, y, angle, randomCarColor(rng, kind));
  car.speed = range(rng, TRAFFIC.minSpeed, TRAFFIC.maxSpeed);
  return {
    car,
    horizontal,
    dir,
    speed: car.speed,
    targetSpeed: range(rng, TRAFFIC.minSpeed, TRAFFIC.maxSpeed),
  };
}

export function spawnTraffic(city, rng, count = TRAFFIC.count) {
  const out = [];
  for (let i = 0; i < count; i += 1) out.push(spawnOne(rng));
  return out;
}

/** Parked cars: a few in every parking block, plus kerb rows along some roads. */
export function spawnParkedCars(city, rng) {
  const out = [];
  for (const block of city.blocks) {
    if (block.type !== 'parking') continue;
    const take = Math.min(block.spots.length, randInt(rng, 2, 5));
    for (let i = 0; i < take; i += 1) {
      const spot = block.spots[Math.floor(rng() * block.spots.length)];
      if (out.some((c) => Math.hypot(c.x - spot.x, c.y - spot.y) < 50)) continue;
      const kind = randomCarKind(rng);
      out.push(createCar(kind, spot.x, spot.y, spot.angle, randomCarColor(rng, kind)));
    }
  }
  // Kerb rows: cars parked along the south edge of a few east-west roads.
  for (let i = 0; i < 10; i += 1) {
    const roadY = randInt(rng, 0, 5) * PITCH;
    const x = range(rng, 200, WORLD.w - 200);
    const kind = randomCarKind(rng);
    out.push(createCar(kind, x, roadY + 50, 0, randomCarColor(rng, kind)));
  }
  return out;
}

/** Is this traffic car close to a junction on both axes (ready to turn)? */
function atJunction(t) {
  const { x, y } = t.car;
  const nearX = Math.abs(x - Math.round(x / PITCH) * PITCH) < 30;
  const nearY = Math.abs(y - Math.round(y / PITCH) * PITCH) < 30;
  return nearX && nearY;
}

/** The car ahead of `t` on the same rail, if any, and how far ahead it is. */
function carAhead(t, cars) {
  let best = null;
  let bestGap = Infinity;
  for (const other of cars) {
    if (other === t) continue;
    const o = other.car;
    if (t.horizontal) {
      if (Math.abs(o.y - t.car.y) > 26) continue;
      const gap = (o.x - t.car.x) * t.dir;
      if (gap > 0 && gap < bestGap) {
        bestGap = gap;
        best = other;
      }
    } else {
      if (Math.abs(o.x - t.car.x) > 26) continue;
      const gap = (o.y - t.car.y) * t.dir;
      if (gap > 0 && gap < bestGap) {
        bestGap = gap;
        best = other;
      }
    }
  }
  return { car: best, gap: bestGap };
}

export function stepTraffic(world, dt) {
  const rng = world.rng;
  const all = world.traffic;
  for (const t of all) {
    const car = t.car;
    // Brake for the car ahead; otherwise ease back to the cruising speed.
    const ahead = carAhead(t, all);
    let want = t.targetSpeed;
    if (ahead.car && ahead.gap < TRAFFIC.brakeGap + 40) {
      want = Math.max(0, ahead.car.speed - 20);
      if (ahead.gap < TRAFFIC.brakeGap) want = 0;
    }
    car.speed += Math.max(-420 * dt, Math.min(180 * dt, want - car.speed));

    // Turn at a junction: swap axis, keep right-hand lane, pick a new direction.
    if (atJunction(t) && rng() < TRAFFIC.turnChance * dt * 4) {
      const jx = Math.round(car.x / PITCH) * PITCH;
      const jy = Math.round(car.y / PITCH) * PITCH;
      const newDir = rng() < 0.5 ? 1 : -1;
      if (t.horizontal) {
        t.horizontal = false;
        t.dir = newDir;
        car.x = jx + (newDir === 1 ? LANE : -LANE);
        car.y = jy;
        car.angle = newDir === 1 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        t.horizontal = true;
        t.dir = newDir;
        car.y = jy + (newDir === 1 ? LANE : -LANE);
        car.x = jx;
        car.angle = newDir === 1 ? 0 : Math.PI;
      }
    }

    const step = car.speed * dt;
    if (t.horizontal) car.x += step * t.dir;
    else car.y += step * t.dir;
    // Wrap around the world edge so the streets never empty out.
    if (car.x < -60) car.x = WORLD.w + 60;
    if (car.x > WORLD.w + 60) car.x = -60;
    if (car.y < -60) car.y = WORLD.h + 60;
    if (car.y > WORLD.h + 60) car.y = -60;
  }
}
