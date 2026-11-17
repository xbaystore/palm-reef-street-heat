// Dario on foot and behind the wheel. On foot he walks or runs, turns toward his
// movement, and is pushed out of buildings. E (edge-triggered) enters the nearest
// car in range — entering a car that is not his is theft, and police cars are
// locked. E again gets out. Driving hands the car to the arcade physics.

import { PLAYER, WORLD } from './config.js';
import { collideCircle } from './city.js';
import { stepDrivenCar } from './vehicles.js';
import { addCrime } from './police.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    angle: 0,
    health: PLAYER.startHealth,
    money: PLAYER.startMoney,
    car: null,
    punchCooldown: 0,
    punchAnim: 0,
  };
}

export function hurtPlayer(world, amount) {
  const p = world.player;
  if (p.health <= 0) return;
  p.health -= amount;
  world.events.push({ type: 'hurt' });
  if (p.health <= 0) {
    p.health = 0;
    world.events.push({ type: 'wasted' });
  }
}

/** The nearest enterable car within range (police cars never are). */
export function carInReach(world) {
  const p = world.player;
  if (p.car) return null;
  let best = null;
  let bestD = PLAYER.enterRange;
  const cars = [];
  for (const t of world.traffic) cars.push(t.car);
  for (const c of world.parked) cars.push(c);
  for (const c of world.police) cars.push(c);
  if (world.serrano) cars.push(world.serrano);
  for (const car of cars) {
    if (car.kind === 'police') continue;
    if (car.health <= 0) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function stepOnFoot(world, input, dt) {
  const p = world.player;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    p.angle = Math.atan2(my, mx);
  }
  const speed = input.run ? PLAYER.run : PLAYER.walk;
  p.vx = mx * speed;
  p.vy = my * speed;
  const nx = p.x + p.vx * dt;
  const ny = p.y + p.vy * dt;
  const fixed = collideCircle(world.city, nx, ny, PLAYER.radius);
  p.x = Math.max(PLAYER.radius, Math.min(WORLD.w - PLAYER.radius, fixed.x));
  p.y = Math.max(PLAYER.radius, Math.min(WORLD.h - PLAYER.radius, fixed.y));
  if (p.punchAnim > 0) p.punchAnim -= dt;
}

export function stepPlayer(world, input, dt) {
  const p = world.player;
  if (p.car) {
    const result = stepDrivenCar(p.car, input, dt, world.city);
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
    p.vx = Math.cos(p.car.angle) * p.car.speed;
    p.vy = Math.sin(p.car.angle) * p.car.speed;
    if (result.crashed) {
      world.events.push({ type: 'crash' });
      addCrime(world, 'hitCar', p.car.x, p.car.y);
      hurtPlayer(world, 4);
    }
    if (input.enter) {
      // Get out: step aside so the car does not run the player over.
      const car = p.car;
      p.car = null;
      p.x = car.x - Math.cos(car.angle) * 0;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
      p.vx = 0;
      p.vy = 0;
      world.events.push({ type: 'exitCar' });
    }
    return;
  }

  stepOnFoot(world, input, dt);

  if (input.enter) {
    const car = carInReach(world);
    if (car) {
      const theft = !car.owned;
      p.car = car;
      car.speed = 0;
      if (theft) {
        car.owned = true;
        addCrime(world, 'theft', car.x, car.y);
        world.events.push({ type: 'steal', kind: car.kind });
      } else {
        world.events.push({ type: 'enterCar' });
      }
    }
  }
}
