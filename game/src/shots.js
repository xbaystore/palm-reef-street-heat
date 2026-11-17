// The four deterministic screenshot scenes behind ?shot=chase|onfoot|drive|mission
// (with &seed=N). Each one arranges the real world — the real cars, the real
// wanted level, the real story stage — and runs the real step for a second or
// two, so the frame is what a short game really looks like and the same seed
// always gives the same frame. main.js paints twice and sets window.__shotReady.

import { STEP } from './config.js';
import { LANDMARKS } from './city.js';
import { createCar } from './vehicles.js';
import { stepWorld } from './world.js';
import { IDLE_INPUT } from './input.js';
import { loopPoint } from './pedestrians.js';

function throttleInput() {
  return { up: true, down: false, left: false, right: false, run: false, punch: false, enter: false };
}

function runSteps(world, input, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) stepWorld(world, input, STEP);
}

function addTrafficCar(world, x, y, angle, dir, horizontal, speed) {
  const car = createCar('sedan', x, y, angle, '#4f7ec9');
  car.speed = speed;
  world.traffic.push({ car, horizontal, dir, speed, targetSpeed: speed });
  return car;
}

function stageChase(world) {
  // Player in the Serrano, eastbound at 235 on the Downtown avenue (road y=480).
  const serrano = world.serrano;
  serrano.x = 1560;
  serrano.y = 506;
  serrano.angle = 0;
  serrano.speed = 235;
  serrano.health = serrano.maxHealth;
  serrano.owned = true;
  const p = world.player;
  p.car = serrano;
  p.x = serrano.x;
  p.y = serrano.y;
  p.angle = 0;
  // Three cruisers: two behind on the avenue, one coming up the cross road.
  world.police = [];
  const c1 = createCar('police', 1330, 506, 0, '#1c1e26');
  c1.speed = 300;
  const c2 = createCar('police', 1240, 454, Math.PI, '#1c1e26');
  c2.speed = 280;
  const c3 = createCar('police', 1920, 712, -Math.PI / 2, '#1c1e26');
  c3.speed = 300;
  world.police.push(c1, c2, c3);
  // Four stars of heat.
  world.wanted.heat = 390;
  world.wanted.stars = 4;
  world.wanted.lastSeen = world.time;
  // Story: Mission 2, "Deliver the Serrano GT".
  world.story.active = true;
  world.story.mission = 1;
  world.story.stage = 2;
  world.story.timerLeft = 0;
  // Traffic both ways on the avenue.
  addTrafficCar(world, 1000, 506, 0, 1, true, 150);
  addTrafficCar(world, 2200, 506, 0, 1, true, 160);
  addTrafficCar(world, 1800, 454, Math.PI, -1, true, 150);
  addTrafficCar(world, 900, 454, Math.PI, -1, true, 140);
  runSteps(world, throttleInput(), 1.3);
  // The chase may have added crimes mid-run; the frame is four stars, so pin
  // the heat back to 390 and keep the four closest cruisers.
  world.wanted.heat = 390;
  world.wanted.stars = 4;
  world.wanted.lastSeen = world.time;
  while (world.police.length > 4) {
    let far = 0;
    let farD = -1;
    for (let i = 0; i < world.police.length; i += 1) {
      const d = Math.hypot(world.police[i].x - world.player.x, world.police[i].y - world.player.y);
      if (d > farD) {
        farD = d;
        far = i;
      }
    }
    world.police.splice(far, 1);
  }
}

function stageOnFoot(world) {
  // Dario on foot, facing a parked taxi — the [E] Enter the Taxi prompt shows.
  const p = world.player;
  p.car = null;
  p.x = 2070;
  p.y = 912;
  p.angle = Math.atan2(950 - 912, 2105 - 2070);
  p.vx = 0;
  p.vy = 0;
  const taxi = createCar('taxi', 2105, 950, 0, '#f2c94c');
  world.parked.push(taxi);
  world.parked.push(createCar('sedan', 1995, 954, 0, '#c94f43'));
  world.parked.push(createCar('sedan', 2235, 954, 0, '#4f7ec9'));
  // Ten pedestrians retargeted to block (4,1)'s sidewalk loop, around the player.
  const block = world.city.blocks.find((b) => b.col === 4 && b.row === 1);
  const loop = { x: block.rect.x - 12, y: block.rect.y - 12, w: block.rect.w + 24, h: block.rect.h + 24 };
  for (let i = 0; i < 10 && i < world.pedestrians.length; i += 1) {
    const ped = world.pedestrians[i];
    ped.block = { col: 4, row: 1 };
    ped.t = i * 156;
    ped.state = 'walk';
    ped.downTimer = 0;
    const at = loopPoint(loop, ped.t);
    ped.x = at.x;
    ped.y = at.y;
  }
  // Traffic passing on road y=960.
  addTrafficCar(world, 1500, 986, 0, 1, true, 150);
  addTrafficCar(world, 2400, 934, Math.PI, -1, true, 150);
  // Fresh story: the banner says "See Marla at her Motorworks".
  world.story.active = false;
  world.story.mission = 0;
  world.story.stage = 0;
  runSteps(world, IDLE_INPUT, 0.9);
}

function stageDrive(world) {
  // Dario in a teal coupe, southbound on the coast road (x=2400) at 250, a
  // cruiser behind, the bay at the bottom of the frame after the run.
  const coupe = createCar('coupe', 2374, 2150, Math.PI / 2, '#2fb3a8');
  coupe.speed = 250;
  coupe.owned = true;
  const p = world.player;
  p.car = coupe;
  p.x = coupe.x;
  p.y = coupe.y;
  p.angle = Math.PI / 2;
  world.police = [];
  const cruiser = createCar('police', 2374, 1900, Math.PI / 2, '#1c1e26');
  cruiser.speed = 250;
  world.police.push(cruiser);
  world.wanted.heat = 90;
  world.wanted.stars = 1;
  world.wanted.lastSeen = world.time;
  // Traffic ahead (southbound) and northbound on the other lane.
  addTrafficCar(world, 2374, 2650, Math.PI / 2, 1, false, 150);
  addTrafficCar(world, 2426, 2300, -Math.PI / 2, -1, false, 150);
  addTrafficCar(world, 2426, 2600, -Math.PI / 2, -1, false, 140);
  runSteps(world, throttleInput(), 1.3);
  // Pin the frame to one star even if the cruiser clipped the coupe mid-run.
  world.wanted.heat = 90;
  world.wanted.stars = 1;
  world.wanted.lastSeen = world.time;
}

function stageMission(world) {
  // Dario in a white van beside the Marina drop; Mission 1 stage 2 with 204 s
  // left on the clock (banner: 3:24, 28 m); a contact stands at the marker.
  const van = createCar('van', 1894, 2690, Math.PI / 2, '#e8e8e8');
  van.speed = 0;
  van.owned = true;
  const p = world.player;
  p.car = van;
  p.x = van.x;
  p.y = van.y;
  p.angle = Math.PI / 2;
  world.story.active = true;
  world.story.mission = 0;
  world.story.stage = 1;
  world.story.timerLeft = 204;
  // A contact pedestrian standing at the marker.
  const contact = world.pedestrians[0];
  contact.state = 'stand';
  contact.x = 2196;
  contact.y = 2762;
  runSteps(world, IDLE_INPUT, 0.7);
}

/** Set `world` to the named scene (chase, onfoot, drive or mission; any other name is chase). */
export function stageShot(world, name) {
  world.state = 'play';
  if (name === 'onfoot') stageOnFoot(world);
  else if (name === 'drive') stageDrive(world);
  else if (name === 'mission') stageMission(world);
  else stageChase(world);
  world.events.length = 0;
  return world;
}
