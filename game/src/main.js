// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between
// title, play, paused, busted and wasted; events from the world drive sounds,
// toasts and autosaves. ?seed=N fixes the city; ?shot=chase|onfoot|drive|mission
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { STEP, VIEW } from './config.js';
import { createWorld, stepWorld } from './world.js';
import { createInput, ACTION_CONFIRM, ACTION_CONTINUE, ACTION_PAUSE, IDLE_INPUT } from './input.js';
import { createRenderer, createCamera, centerCamera } from './render.js';
import { createToasts, drawHud, drawTitle, drawPaused, drawBusted, drawWasted } from './hud.js';
import { currentObjective } from './missions.js';
import { carInReach } from './player.js';
import { loadRun, saveRun, applyRun, clearRun } from './savegame.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const AUTOSAVE_EVERY = 5;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const camera = createCamera();
const toasts = createToasts();
const audio = createAudio();
const input = createInput();
input.attach();

let world = createWorld(seed);
let screen = 'title';

function announce(message) {
  status.textContent = message;
}

function kindLabel(kind) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function currentPrompt() {
  if (screen !== 'play') return null;
  const p = world.player;
  if (p.car) return '[E] Get out';
  const car = carInReach(world);
  if (!car) return null;
  if (car === world.serrano && !car.owned) return '[E] STEAL the Serrano GT';
  return `[E] Enter the ${kindLabel(car.kind)}`;
}

function handleEvents() {
  for (const event of world.events) {
    if (event.type === 'punch') audio.punch();
    else if (event.type === 'crash') audio.crash();
    else if (event.type === 'hurt') audio.hurt();
    else if (event.type === 'cash') {
      audio.cash();
      toasts.push(`Job complete: ${event.title} — +$${event.amount}`);
      saveRun(window.localStorage, world);
    } else if (event.type === 'newJob') {
      audio.news();
      toasts.push(`New job: ${event.title}`);
    } else if (event.type === 'stage') {
      toasts.push(event.text);
    } else if (event.type === 'jobFailed') {
      audio.news();
      toasts.push(event.reason);
    } else if (event.type === 'steal') {
      audio.news();
      toasts.push(`Stole the ${kindLabel(event.kind)} — the law noticed`);
    } else if (event.type === 'enterCar') audio.news();
    else if (event.type === 'pedDown') toasts.push('Pedestrian down — witnesses will talk');
    else if (event.type === 'storyDone') {
      audio.cash();
      toasts.push('All three jobs done. Palm Reef is yours.');
    }
  }
  if (world.state === 'busted') {
    screen = 'busted';
    audio.hurt();
    saveRun(window.localStorage, world);
    announce(`Busted. Cash left $${world.player.money}.`);
  } else if (world.state === 'wasted') {
    screen = 'wasted';
    audio.hurt();
    saveRun(window.localStorage, world);
    announce(`Wasted. Cash left $${world.player.money}.`);
  }
  world.events.length = 0;
}

function paint() {
  world._objective = currentObjective(world);
  centerCamera(camera, world.player.x, world.player.y);
  renderer.drawWorld(world, camera);
  if (screen === 'title') drawTitle(renderer.ctx, loadRun(window.localStorage) !== null);
  else if (screen === 'play') drawHud(renderer.ctx, world, toasts, currentPrompt());
  else if (screen === 'paused') {
    drawHud(renderer.ctx, world, toasts, null);
    drawPaused(renderer.ctx);
  } else if (screen === 'busted') {
    drawHud(renderer.ctx, world, toasts, null);
    drawBusted(renderer.ctx, world.player.money);
  } else if (screen === 'wasted') {
    drawHud(renderer.ctx, world, toasts, null);
    drawWasted(renderer.ctx, world.player.money);
  }
}

function startFresh() {
  world = createWorld(seed);
  toasts.list.length = 0;
  clearRun(window.localStorage);
  world.state = 'play';
  screen = 'play';
  announce('Playing. See Marla at her Motorworks.');
}

function continueRun() {
  const data = loadRun(window.localStorage);
  if (!data) return;
  world = createWorld(seed);
  applyRun(world, data);
  toasts.list.length = 0;
  world.state = 'play';
  screen = 'play';
  announce('Continuing your run.');
}

function resumeFromOutcome() {
  world.state = 'play';
  screen = 'play';
  announce('Back on the streets.');
}

function runShot(name) {
  stageShot(world, name);
  screen = 'play';
  let painted = 0;
  function paintOnce() {
    paint();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paintOnce);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paintOnce);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (screen === 'title') startFresh();
      else if (screen === 'busted' || screen === 'wasted') resumeFromOutcome();
      else if (screen === 'paused') {
        screen = 'play';
        announce('Playing.');
      }
    }
    if (actions & ACTION_CONTINUE && screen === 'title') continueRun();
    if (actions & ACTION_PAUSE) {
      if (screen === 'play') {
        screen = 'paused';
        announce('Paused.');
      } else if (screen === 'paused') {
        screen = 'play';
        announce('Playing.');
      }
    }
  }

  function step() {
    const stepInput = screen === 'play' ? input.read() : IDLE_INPUT;
    if (screen === 'play') {
      audio.ensure();
      stepWorld(world, stepInput, STEP);
      toasts.step(STEP);
      world.autosaveTimer += STEP;
      if (world.autosaveTimer >= AUTOSAVE_EVERY) {
        world.autosaveTimer = 0;
        saveRun(window.localStorage, world);
      }
      // Engine hum follows speed; the siren sounds while a cruiser is close.
      const p = world.player;
      audio.engine(p.car ? Math.abs(p.car.speed) / p.car.top : 0);
      const near = world.police.some((pc) => Math.hypot(pc.x - p.x, pc.y - p.y) < 600);
      audio.siren(near);
      handleEvents();
    } else {
      // Title backdrop: the city idles behind the panel.
      input.read();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === 'title' || screen === 'play') {
      while (accumulator >= STEP && (screen === 'title' || screen === 'play')) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    paint();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      announce('Paused.');
    }
  });

  announce('Palm Reef: Street Heat. Press Enter to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
