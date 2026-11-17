// The player's fists. A punch fires on the edge-triggered punch action, once per
// 0.38 s cooldown, hitting pedestrians and cars inside a 40 px arc of 1.9 radians
// in front of the player. Punching a pedestrian is a crime; punching a car dents
// it and is a smaller one.

import { PLAYER } from './config.js';
import { damageCar } from './vehicles.js';
import { knockDown } from './pedestrians.js';
import { addCrime } from './police.js';

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function stepCombat(world, dt) {
  const p = world.player;
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
  if (p.car) return;
  if (!world.input.punch || p.punchCooldown > 0) return;

  p.punchCooldown = PLAYER.punchCooldown;
  p.punchAnim = 0.18;
  world.events.push({ type: 'punch' });

  // Pedestrians in the arc.
  for (const ped of world.pedestrians) {
    if (ped.state === 'down' || ped.state === 'stand') continue;
    const dx = ped.x - p.x;
    const dy = ped.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > PLAYER.punchRange + 11) continue;
    if (Math.abs(angleDiff(Math.atan2(dy, dx), p.angle)) > PLAYER.punchArc / 2 + 0.35) continue;
    const downed = knockDown(ped);
    addCrime(world, 'punchPedestrian', ped.x, ped.y);
    if (downed) world.events.push({ type: 'pedDown' });
  }

  // Cars in the arc: dent them, and the law notices.
  const cars = [];
  for (const t of world.traffic) cars.push(t.car);
  for (const c of world.parked) cars.push(c);
  for (const pc of world.police) cars.push(pc);
  if (world.serrano) cars.push(world.serrano);
  for (const car of cars) {
    const dx = car.x - p.x;
    const dy = car.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > PLAYER.punchRange + car.len / 2) continue;
    if (Math.abs(angleDiff(Math.atan2(dy, dx), p.angle)) > PLAYER.punchArc / 2 + 0.4) continue;
    const wrecked = damageCar(car, 8);
    addCrime(world, 'punchCar', car.x, car.y);
    world.events.push({ type: 'carHit', wrecked });
  }
}
