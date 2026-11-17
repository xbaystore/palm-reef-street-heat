// Save / continue. The storage object is injected (window.localStorage in the
// browser, a plain map in Node tests), so the simulation stays testable. A run
// keeps money, story progress, health and position; it is written on job
// completion, on busted/wasted, and every few seconds of play.

import { SAVE_KEY } from './config.js';

export function serializeRun(world) {
  return {
    version: 1,
    money: world.player.money,
    health: world.player.health,
    x: Math.round(world.player.x),
    y: Math.round(world.player.y),
    mission: world.story.mission,
    stage: world.story.stage,
    active: world.story.active,
    done: world.story.done,
    time: Math.round(world.time),
  };
}

export function saveRun(storage, world) {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(serializeRun(world)));
    return true;
  } catch {
    return false;
  }
}

export function loadRun(storage) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function applyRun(world, data) {
  if (!data) return false;
  world.player.money = data.money;
  world.player.health = data.health;
  world.player.x = data.x;
  world.player.y = data.y;
  world.player.vx = 0;
  world.player.vy = 0;
  world.player.car = null;
  world.story.mission = Math.min(data.mission, world.missions.length - 1);
  world.story.stage = data.stage;
  world.story.active = !!data.active;
  world.story.done = !!data.done;
  world.story.timerLeft = 0;
  world.time = data.time || 0;
  return true;
}

export function clearRun(storage) {
  if (!storage) return false;
  try {
    storage.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}
