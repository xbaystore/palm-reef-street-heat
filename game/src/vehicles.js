// What a car is, and arcade driving physics. A car has a kind (top speed, health,
// footprint), a heading and a speed; steering scales with speed so slow cars turn
// tight and fast cars drift wide. Buildings push out and dent; car-car collisions
// shove both cars apart and cost health. No wall clock, no unseeded randomness.

import { CAR, CAR_KINDS, WORLD } from './config.js';
import { pick } from './random.js';
import { collideCircle } from './city.js';

export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

export const CAR_COLORS = {
  sedan: ['#c94f43', '#4f7ec9', '#c9c9c9', '#3f5a3a', '#8a6fb8'],
  taxi: ['#f2c94c'],
  coupe: ['#2fb3a8', '#e07a2f', '#d94f7a', '#f2f2f2'],
  van: ['#e8e8e8', '#7a8a99', '#c9a24f'],
  truck: ['#8a7a5a', '#5a6e8a', '#a8543a'],
  police: ['#1c1e26'],
};

let nextCarId = 1;

export function createCar(kind, x, y, angle, color) {
  const spec = CAR_KINDS[kind];
  const id = nextCarId;
  nextCarId += 1;
  return {
    id,
    kind,
    x,
    y,
    angle,
    speed: 0,
    health: spec.health,
    maxHealth: spec.health,
    len: spec.len,
    wid: spec.wid,
    top: spec.top,
    color: color ?? pickColor(kind),
    owned: false,
    // Siren flash phase derives from the id, never from the clock.
    sirenPhase: (id * 1.7) % (Math.PI * 2),
  };
}

function pickColor(kind) {
  // Deterministic fallback: callers pass a seeded colour; this only covers direct
  // construction without one, so it must not reach for Math.random.
  const colors = CAR_COLORS[kind] ?? CAR_COLORS.sedan;
  return colors[0];
}

export function randomCarKind(rng) {
  const roll = rng();
  if (roll < 0.42) return 'sedan';
  if (roll < 0.56) return 'taxi';
  if (roll < 0.72) return 'coupe';
  if (roll < 0.86) return 'van';
  return 'truck';
}

export function randomCarColor(rng, kind) {
  const colors = CAR_COLORS[kind] ?? CAR_COLORS.sedan;
  return colors[Math.floor(rng() * colors.length)];
}

/** Damage a car; returns true when it is wrecked. */
export function damageCar(car, amount) {
  car.health -= amount;
  return car.health <= 0;
}

/**
 * Drive one fixed step. `input` is {up, down, left, right}. Returns {crashed} when
 * the car hit a building hard enough to dent. The car is clamped inside the world.
 */
export function stepDrivenCar(car, input, dt, city) {
  const before = car.speed;
  if (input.up) car.speed += CAR.accel * dt;
  if (input.down) {
    if (car.speed > 0) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.accel * 0.6 * dt;
  }
  // Drag: exponential decay toward rest.
  car.speed -= car.speed * CAR.drag * dt;
  if (car.speed > car.top) car.speed = car.top;
  if (car.speed < -CAR.reverseTop) car.speed = -CAR.reverseTop;
  if (!input.up && !input.down && Math.abs(car.speed) < 4) car.speed = 0;

  const steerDir = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const speedFactor = Math.min(1, Math.abs(car.speed) / 140);
  car.angle += steerDir * CAR.steer * speedFactor * dt * (car.speed < 0 ? -1 : 1);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Collide at the nose and the tail so the car cannot clip a corner.
  const half = car.len / 2 - 4;
  const fx = nx + Math.cos(car.angle) * half;
  const fy = ny + Math.sin(car.angle) * half;
  const bx = nx - Math.cos(car.angle) * half;
  const by = ny - Math.sin(car.angle) * half;
  const front = collideCircle(city, fx, fy, car.wid / 2);
  const back = collideCircle(city, bx, by, car.wid / 2);
  let crashed = false;
  if (front.hit || back.hit) {
    const impact = Math.abs(before);
    if (impact > 90) {
      car.speed *= 0.35;
      crashed = true;
      damageCar(car, Math.min(18, impact * 0.05));
    } else {
      car.speed *= 0.6;
    }
    // Rebuild the centre from the corrected nose/tail.
    car.x = (front.x + back.x) / 2;
    car.y = (front.y + back.y) / 2;
  } else {
    car.x = nx;
    car.y = ny;
  }
  car.x = Math.max(30, Math.min(WORLD.w - 30, car.x));
  car.y = Math.max(30, Math.min(WORLD.h - 30, car.y));
  return { crashed };
}

/** Shove two cars apart and trade a little speed; returns true when they touched. */
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const min = (a.len + b.len) / 2 - 6;
  if (dist >= min || dist < 0.001) return false;
  const nx = dx / dist;
  const ny = dy / dist;
  const push = (min - dist) / 2;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const rel = (a.speed - b.speed) * 0.4;
  a.speed -= rel * 0.5;
  b.speed += rel * 0.5;
  return true;
}

/** Circle-vs-car test for a point (used for pedestrians and the player on foot). */
export function carHitsPoint(car, x, y, r) {
  const dx = x - car.x;
  const dy = y - car.y;
  const cos = Math.cos(-car.angle);
  const sin = Math.sin(-car.angle);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.abs(lx) < car.len / 2 + r && Math.abs(ly) < car.wid / 2 + r;
}
