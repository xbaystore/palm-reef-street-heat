// Headless checks for Palm Reef: the world sim on three seeds, a scripted
// playthrough (start the story, deliver job one, steal the Serrano, deliver it),
// determinism (same seed + same inputs = same state), save/load round-trip, and
// all four screenshot scenes staged and verified. Plain Node, no browser.
//
//   node tools/smoke-test.mjs
import { createWorld, stepWorld } from '../game/src/world.js';
import { stageShot } from '../game/src/shots.js';
import { currentObjective } from '../game/src/missions.js';
import { carInReach } from '../game/src/player.js';
import { serializeRun, saveRun, loadRun, applyRun } from '../game/src/savegame.js';
import { createCamera, centerCamera } from '../game/src/render.js';
import { IDLE_INPUT } from '../game/src/input.js';

let failures = 0;
let checks = 0;

function check(name, ok, detail = '') {
  checks += 1;
  if (ok) console.log(`ok   ${name}`);
  else {
    failures += 1;
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function input(over = {}) {
  return { ...IDLE_INPUT, ...over };
}

function hashState(world) {
  const parts = [
    Math.round(world.player.x),
    Math.round(world.player.y),
    world.player.money,
    Math.round(world.player.health),
    world.story.mission,
    world.story.stage,
    Math.round(world.wanted.heat),
    world.police.length,
    world.traffic.slice(0, 6).map((t) => `${Math.round(t.car.x)},${Math.round(t.car.y)}`).join(';'),
    world.pedestrians.slice(0, 6).map((p) => `${Math.round(p.x)},${Math.round(p.y)},${p.state}`).join(';'),
  ];
  return parts.join('|');
}

function finiteWorld(world, label) {
  const nums = [world.player.x, world.player.y, world.player.health, world.player.money, world.wanted.heat];
  for (const t of world.traffic) nums.push(t.car.x, t.car.y, t.car.speed);
  for (const p of world.pedestrians) nums.push(p.x, p.y);
  check(`${label}: all numbers finite`, nums.every((n) => Number.isFinite(n)));
  check(
    `${label}: player inside the world`,
    world.player.x >= 0 && world.player.x <= 3840 && world.player.y >= 0 && world.player.y <= 2880,
  );
}

// --- 1. The sim runs on three seeds ---------------------------------------
for (const seed of [7, 42, 1234]) {
  const world = createWorld(seed);
  check(`seed ${seed}: 26 traffic cars`, world.traffic.length === 26, `got ${world.traffic.length}`);
  check(`seed ${seed}: 46 pedestrians`, world.pedestrians.length === 46, `got ${world.pedestrians.length}`);
  check(`seed ${seed}: 6 districts of blocks`, world.city.blocks.length === 48, `got ${world.city.blocks.length}`);
  const dirs = ['up', 'right', 'down', 'left'];
  for (let i = 0; i < 600; i += 1) {
    const dir = dirs[Math.floor(i / 150) % 4];
    const step = { up: dir === 'up', down: dir === 'down', left: dir === 'left', right: dir === 'right', run: i % 120 < 60, punch: i % 90 === 0, enter: false };
    stepWorld(world, step);
  }
  finiteWorld(world, `seed ${seed} after 600 steps`);
  check(`seed ${seed}: story started at the garage`, world.story.active === true);
}

// --- 2. Scripted playthrough: job one, theft, job two ----------------------
{
  const world = createWorld(7);
  stepWorld(world, IDLE_INPUT);
  check('playthrough: story starts at the garage', world.story.active && world.story.stage === 1, `active=${world.story.active} stage=${world.story.stage}`);
  check('playthrough: job-one clock is 240 s', world.story.timerLeft > 239 && world.story.timerLeft <= 240, `timer=${world.story.timerLeft}`);
  // Walk the package to the Marina drop (teleported: the walk itself is covered by test 1).
  world.player.x = 2160;
  world.player.y = 2788;
  stepWorld(world, IDLE_INPUT);
  check('playthrough: job one pays $300', world.player.money === 550, `money=${world.player.money}`);
  check('playthrough: job two begins', world.story.mission === 1 && world.story.stage === 0, `mission=${world.story.mission} stage=${world.story.stage}`);
  // Go to the Uptown lot and steal the Serrano.
  world.player.x = 720;
  world.player.y = 740;
  stepWorld(world, IDLE_INPUT);
  check('playthrough: steal stage reached at the lot', world.story.stage === 1, `stage=${world.story.stage}`);
  stepWorld(world, input({ enter: true }));
  check('playthrough: Dario is in the Serrano', world.player.car === world.serrano, `car=${world.player.car?.kind}`);
  check('playthrough: theft raises heat', world.wanted.heat > 0, `heat=${world.wanted.heat}`);
  // Deliver the Serrano to the garage.
  world.serrano.x = 1200;
  world.serrano.y = 2386;
  world.player.x = 1200;
  world.player.y = 2386;
  stepWorld(world, IDLE_INPUT);
  check('playthrough: job two pays $600', world.player.money === 1150, `money=${world.player.money}`);
  check('playthrough: job three begins', world.story.mission === 2, `mission=${world.story.mission}`);
}

// --- 3. Determinism ---------------------------------------------------------
{
  const script = [];
  for (let i = 0; i < 300; i += 1) {
    script.push(input({ up: i < 100, right: i >= 100 && i < 200, down: i >= 200, run: i % 2 === 0, punch: i === 150 }));
  }
  const a = createWorld(99);
  const b = createWorld(99);
  for (const s of script) stepWorld(a, s);
  for (const s of script) stepWorld(b, s);
  check('determinism: same seed + inputs = same state', hashState(a) === hashState(b));
  const c = createWorld(100);
  for (const s of script) stepWorld(c, s);
  check('determinism: a different seed diverges', hashState(a) !== hashState(c));
}

// --- 4. Save / load ---------------------------------------------------------
{
  const backing = new Map();
  const storage = {
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k, v) => { backing.set(k, String(v)); },
    removeItem: (k) => { backing.delete(k); },
  };
  const world = createWorld(5);
  world.player.money = 999;
  world.player.health = 55;
  world.player.x = 1234;
  world.player.y = 1500;
  world.story.active = true;
  world.story.mission = 1;
  world.story.stage = 2;
  check('save/load: saveRun writes', saveRun(storage, world) === true);
  const loaded = loadRun(storage);
  check('save/load: loadRun reads', loaded !== null && loaded.money === 999, `money=${loaded?.money}`);
  const fresh = createWorld(5);
  check('save/load: applyRun restores', applyRun(fresh, loaded) === true);
  check('save/load: money/health/position/story match',
    fresh.player.money === 999 && fresh.player.health === 55 && fresh.player.x === 1234 && fresh.player.y === 1500
    && fresh.story.mission === 1 && fresh.story.stage === 2);
  check('save/load: serializeRun is JSON-stable', JSON.stringify(serializeRun(world)) === JSON.stringify(serializeRun(world)));
}

// --- 5. The four screenshot scenes ------------------------------------------
{
  const scenes = [
    { name: 'chase', seed: 7 },
    { name: 'onfoot', seed: 3 },
    { name: 'drive', seed: 5 },
    { name: 'mission', seed: 9 },
  ];
  for (const { name, seed } of scenes) {
    const world = createWorld(seed);
    stageShot(world, name);
    const obj = currentObjective(world);
    finiteWorld(world, `scene ${name}`);
    if (name === 'chase') {
      check('scene chase: Dario is in the Serrano', world.player.car === world.serrano);
      check('scene chase: four wanted stars', world.wanted.stars === 4, `stars=${world.wanted.stars}`);
      check('scene chase: banner is the Serrano delivery', obj.text === 'Deliver the Serrano GT to the garage', `text=${obj?.text}`);
      check('scene chase: at least three cruisers in frame', world.police.length >= 3, `police=${world.police.length}`);
    }
    if (name === 'onfoot') {
      const car = carInReach(world);
      check('scene onfoot: Dario is on foot', world.player.car === null);
      check('scene onfoot: a taxi is in reach', car !== null && car.kind === 'taxi', `car=${car?.kind}`);
      check('scene onfoot: fresh story banner', obj.text === 'See Marla at her Motorworks', `text=${obj?.text}`);
      check('scene onfoot: ten walkers on the block loop',
        world.pedestrians.slice(0, 10).every((p) => p.block.col === 4 && p.block.row === 1));
    }
    if (name === 'drive') {
      const cam = createCamera();
      centerCamera(cam, world.player.x, world.player.y);
      check('scene drive: Dario is in the teal coupe',
        world.player.car !== null && world.player.car.kind === 'coupe' && world.player.car.color === '#2fb3a8');
      check('scene drive: one wanted star', world.wanted.stars === 1, `stars=${world.wanted.stars}`);
      check('scene drive: camera clamped at the south edge', cam.y >= 2080, `camY=${cam.y}`);
      check('scene drive: the bay is in the bottom of the frame', 2800 - cam.y < 720 && 2800 - cam.y > 0, `waterY=${2800 - cam.y}`);
    }
    if (name === 'mission') {
      check('scene mission: timer reads 3:24', world.story.timerLeft > 203 && world.story.timerLeft <= 204, `timer=${world.story.timerLeft}`);
      check('scene mission: banner is the Marina drop', obj.text === 'Drive the package to the Marina drop', `text=${obj?.text}`);
      check('scene mission: 28 m to the drop', obj.distM >= 20 && obj.distM <= 35, `dist=${obj.distM}`);
      const contact = world.pedestrians[0];
      check('scene mission: contact stands at the marker',
        contact.state === 'stand' && Math.round(contact.x) === 2196 && Math.round(contact.y) === 2762);
    }
  }
}

console.log(`\n${checks - failures}/${checks} checks passed.`);
if (failures > 0) {
  console.log(`${failures} FAILURE(S)`);
  process.exit(1);
}
console.log('smoke test green.');
