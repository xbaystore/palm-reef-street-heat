// The one state object and the one fixed step. World step order is fixed: player,
// combat, traffic, police, pedestrians, collisions, missions — then the
// busted/wasted outcomes. The simulation never touches window or document, so the
// smoke test runs it in plain Node, deterministically from a seed.

import { STEP, WORLD } from './config.js';
import { createRandom } from './random.js';
import { createCity, LANDMARKS } from './city.js';
import { createCar, randomCarColor, collideCars, carHitsPoint, damageCar } from './vehicles.js';
import { spawnTraffic, spawnParkedCars, stepTraffic } from './traffic.js';
import { spawnPedestrians, stepPedestrians, knockDown } from './pedestrians.js';
import { createWanted, stepPolice, addCrime } from './police.js';
import { stepCombat } from './combat.js';
import { createPlayer, stepPlayer, hurtPlayer } from './player.js';
import { buildMissions, createStory, stepMissions } from './missions.js';

export function createWorld(seed) {
  const rng = createRandom(seed);
  const city = createCity(seed);
  const player = createPlayer(LANDMARKS.garage.x - 40, LANDMARKS.garage.y + 60);
  // The orange Serrano GT waits in the Uptown lot for HOT WHEELS.
  const serrano = createCar('coupe', LANDMARKS.uptownLot.x, LANDMARKS.uptownLot.y, 0, '#e07a2f');
  serrano.owned = false;

  const world = {
    seed,
    rng,
    city,
    player,
    traffic: spawnTraffic(city, rng),
    parked: spawnParkedCars(city, rng),
    pedestrians: spawnPedestrians(city, rng),
    police: [],
    wanted: createWanted(),
    missions: buildMissions(),
    story: createStory(),
    serrano,
    events: [],
    input: { up: false, down: false, left: false, right: false, run: false, punch: false, enter: false },
    time: 0,
    state: 'title',
    autosaveTimer: 0,
  };
  return world;
}

/** Every car the world simulates, for collision passes. */
function allCars(world) {
  const cars = [];
  if (world.player.car) cars.push(world.player.car);
  for (const t of world.traffic) cars.push(t.car);
  for (const c of world.parked) cars.push(c);
  for (const pc of world.police) cars.push(pc);
  if (world.serrano && world.serrano !== world.player.car) cars.push(world.serrano);
  return cars;
}

function stepCollisions(world) {
  const p = world.player;
  const cars = allCars(world);

  // Car vs car: the player's car against traffic, police and parked cars.
  if (p.car) {
    for (const other of cars) {
      if (other === p.car) continue;
      if (collideCars(p.car, other)) {
        if (Math.abs(p.car.speed) > 60) {
          damageCar(other, 6);
          if (other.kind === 'police') addCrime(world, 'hitPolice', other.x, other.y);
          else addCrime(world, 'hitCar', other.x, other.y);
          world.events.push({ type: 'crash' });
        }
      }
    }
  }

  // Traffic cars nudge each other apart so they never overlap on a rail.
  for (let i = 0; i < world.traffic.length; i += 1) {
    for (let j = i + 1; j < world.traffic.length; j += 1) {
      collideCars(world.traffic[i].car, world.traffic[j].car);
    }
  }

  // Cars vs pedestrians: a car at speed knocks a walker down (a crime if it is
  // the player's car; traffic just scatters them).
  for (const car of cars) {
    if (Math.abs(car.speed) < 60) continue;
    for (const ped of world.pedestrians) {
      if (ped.state === 'down' || ped.state === 'stand') continue;
      if (!carHitsPoint(car, ped.x, ped.y, 9)) continue;
      const downed = knockDown(ped);
      if (car === p.car) {
        addCrime(world, 'hitPedestrian', ped.x, ped.y);
        if (downed) world.events.push({ type: 'pedDown' });
      }
    }
  }

  // A fast car hitting Dario on foot hurts him.
  if (!p.car) {
    for (const car of cars) {
      if (Math.abs(car.speed) < 80) continue;
      if (!carHitsPoint(car, p.x, p.y, 11)) continue;
      hurtPlayer(world, 12);
      // Knock the player clear of the bonnet so one car cannot drain him.
      const dx = p.x - car.x;
      const dy = p.y - car.y;
      const d = Math.hypot(dx, dy) || 1;
      p.x += (dx / d) * 30;
      p.y += (dy / d) * 30;
      break;
    }
  }

  // Police ramming the player's car hurts Dario too.
  if (p.car) {
    for (const pc of world.police) {
      if (collideCars(p.car, pc) && Math.abs(pc.speed) > 120) {
        hurtPlayer(world, 3);
      }
    }
  }
}

function applyOutcomes(world) {
  for (const event of world.events) {
    if (event.type === 'busted') {
      const p = world.player;
      const loss = Math.floor(p.money * 0.15);
      p.money -= loss;
      p.health = 100;
      if (p.car) {
        p.car.owned = false;
        p.car = null;
      }
      p.x = LANDMARKS.garage.x - 40;
      p.y = LANDMARKS.garage.y + 60;
      p.vx = 0;
      p.vy = 0;
      world.wanted.heat = 0;
      world.wanted.stars = 0;
      world.police.length = 0;
      world.state = 'busted';
    } else if (event.type === 'wasted') {
      const p = world.player;
      const loss = Math.floor(p.money * 0.1);
      p.money -= loss;
      p.health = 100;
      if (p.car) {
        p.car.owned = false;
        p.car = null;
      }
      p.x = LANDMARKS.garage.x - 40;
      p.y = LANDMARKS.garage.y + 60;
      p.vx = 0;
      p.vy = 0;
      world.wanted.heat = 0;
      world.wanted.stars = 0;
      world.police.length = 0;
      world.state = 'wasted';
    }
  }
}

export function stepWorld(world, input, dt = STEP) {
  world.input = input;
  world.time += dt;

  stepPlayer(world, input, dt);
  stepCombat(world, dt);
  stepTraffic(world, dt);
  stepPolice(world, dt);
  stepPedestrians(world, dt);
  stepCollisions(world);
  stepMissions(world, dt);
  applyOutcomes(world);

  // Keep the player inside the world even if a shove pushed him out.
  world.player.x = Math.max(11, Math.min(WORLD.w - 11, world.player.x));
  world.player.y = Math.max(11, Math.min(WORLD.h - 11, world.player.y));
}
