// Wanted heat, crime reporting, pursuit and the bust meter. Heat buys stars at 100
// a star (max five); a crime counts in full when a pedestrian or a police car can
// see it, else at 40%. Police spawn at a road junction about 760 px out and steer
// freely at the player, ramming and boxing in; close pressure for 2.5 s busts.

import { CITY, WANTED } from './config.js';
import { createCar } from './vehicles.js';
import { lineOfSight, nearestJunction } from './city.js';

const PITCH = CITY.pitch;

export function createWanted() {
  return { heat: 0, stars: 0, lastSeen: 0, bust: 0 };
}

export function starsFor(heat) {
  // Any heat at all buys the first star: 90 heat is one star, 390 is four.
  if (heat <= 0) return 0;
  return Math.min(WANTED.maxStars, Math.ceil(heat / WANTED.perStar));
}

/** Was the crime at (x, y) witnessed? A pedestrian within 170 or police within 320 with line of sight. */
export function witnessed(world, x, y) {
  for (const ped of world.pedestrians) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - x, ped.y - y) < WANTED.witnessPed && lineOfSight(world.city, ped.x, ped.y, x, y)) return true;
  }
  for (const pc of world.police) {
    if (Math.hypot(pc.x - x, pc.y - y) < WANTED.witnessPolice && lineOfSight(world.city, pc.x, pc.y, x, y)) return true;
  }
  return false;
}

export function addCrime(world, type, x, y) {
  const amount = WANTED.crimes[type] ?? 0;
  if (amount === 0) return;
  const seen = witnessed(world, x, y);
  world.wanted.heat += seen ? amount : amount * 0.4;
  world.wanted.lastSeen = world.time;
  world.wanted.stars = starsFor(world.wanted.heat);
}

function spawnSpot(world) {
  const p = world.player;
  // Try junctions around the player until one is roughly 760 px away.
  for (let tries = 0; tries < 12; tries += 1) {
    const jx = (Math.floor(p.x / PITCH) + (tries % 3) - 1) * PITCH;
    const jy = (Math.floor(p.y / PITCH) + Math.floor(tries / 3) - 1) * PITCH;
    const j = nearestJunction(jx, jy);
    const d = Math.hypot(j.x - p.x, j.y - p.y);
    if (d > 600 && d < 1000) return j;
  }
  const j = nearestJunction(p.x + 760, p.y);
  return j;
}

export function stepPolice(world, dt) {
  const wanted = world.wanted;
  const p = world.player;

  // Heat decays after 4 s unseen.
  if (world.time - wanted.lastSeen > WANTED.unseenDelay && wanted.heat > 0) {
    wanted.heat = Math.max(0, wanted.heat - WANTED.decay * dt);
  }
  wanted.stars = starsFor(wanted.heat);

  // Keep the cruiser count equal to the star count.
  while (world.police.length < wanted.stars) {
    const spot = spawnSpot(world);
    const angle = Math.atan2(p.y - spot.y, p.x - spot.x);
    const car = createCar('police', spot.x, spot.y, angle, '#1c1e26');
    car.speed = 200;
    world.police.push(car);
  }
  while (world.police.length > wanted.stars) {
    // Drop the farthest cruiser when the heat fades.
    let far = 0;
    let farD = -1;
    for (let i = 0; i < world.police.length; i += 1) {
      const d = Math.hypot(world.police[i].x - p.x, world.police[i].y - p.y);
      if (d > farD) {
        farD = d;
        far = i;
      }
    }
    world.police.splice(far, 1);
  }

  // Pursuit: free steering toward the player, ramming speed, boxed-in pressure.
  let pressured = false;
  for (const car of world.police) {
    const dx = p.x - car.x;
    const dy = p.y - car.y;
    const dist = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
    const wantSpeed = dist > 320 ? car.top : dist > 120 ? 300 : 200;
    car.speed += Math.max(-420 * dt, Math.min(300 * dt, wantSpeed - car.speed));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = Math.max(30, Math.min(3840 - 30, car.x));
    car.y = Math.max(30, Math.min(2880 - 30, car.y));

    // Close pressure: on foot within 46, or boxed in a near-stopped car within 64.
    const playerSpeed = p.car ? Math.abs(p.car.speed) : Math.hypot(p.vx ?? 0, p.vy ?? 0);
    if ((!p.car && dist < 46) || (p.car && dist < 64 && playerSpeed < 26)) pressured = true;
  }

  if (wanted.stars > 0 && pressured) {
    wanted.bust += dt;
    if (wanted.bust >= WANTED.bustTime) {
      world.events.push({ type: 'busted' });
      wanted.bust = 0;
    }
  } else {
    wanted.bust = Math.max(0, wanted.bust - dt * 2);
  }
}
