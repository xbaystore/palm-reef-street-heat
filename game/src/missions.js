// The three-job story for Marla, as stages. The story starts inactive: the banner
// says "See Marla at her Motorworks" until Dario walks into the garage marker.
// Each stage has a target point; the HUD reads currentObjective for its banner.
// Timers run down on timed stages; a blown timer or a wrecked Serrano fails the
// job and sends Dario back to Marla. After the third job: free roam.

import { LANDMARKS } from './city.js';

export function buildMissions() {
  return [
    {
      id: 'first-drop',
      title: 'FIRST DROP',
      pay: 300,
      stages: [
        { id: 'meet', text: 'See Marla at her Motorworks', target: 'garage', timer: 0 },
        { id: 'deliver', text: 'Drive the package to the Marina drop', target: 'marinaDrop', timer: 240 },
      ],
    },
    {
      id: 'hot-wheels',
      title: 'HOT WHEELS',
      pay: 600,
      stages: [
        { id: 'lot', text: 'Go to the Uptown lot', target: 'uptownLot', timer: 0 },
        { id: 'steal', text: 'Steal the orange Serrano GT', target: 'serrano', timer: 0 },
        { id: 'return', text: 'Deliver the Serrano GT to the garage', target: 'garage', timer: 0 },
      ],
    },
    {
      id: 'reef-run',
      title: 'REEF RUN',
      pay: 1000,
      stages: [
        { id: 'pickup', text: 'Pick up the briefcase at the Port yard', target: 'portYard', timer: 0 },
        { id: 'lose-heat', text: 'The pickup is blown — lose the police!', target: null, timer: 0 },
        { id: 'return', text: 'Return to Marla', target: 'garage', timer: 0 },
      ],
    },
  ];
}

export function createStory() {
  return {
    active: false,
    mission: 0,
    stage: 0,
    timerLeft: 0,
    done: false,
    failed: null,
  };
}

function stageTarget(world, stage) {
  if (!stage || !stage.target) return null;
  if (stage.target === 'serrano') {
    return world.serrano ? { x: world.serrano.x, y: world.serrano.y } : null;
  }
  const mark = LANDMARKS[stage.target];
  return mark ? { x: mark.x, y: mark.y } : null;
}

export function currentObjective(world) {
  const story = world.story;
  const missions = world.missions;
  if (story.done) return { title: 'FREE ROAM', text: 'Palm Reef is yours — steal, drive, survive.', target: null, distM: 0, timerLeft: 0 };
  const mission = missions[story.mission];
  if (!mission) return null;
  const stage = mission.stages[story.stage];
  const target = stageTarget(world, stage);
  const p = world.player;
  const distM = target ? Math.round(Math.hypot(target.x - p.x, target.y - p.y) / 10) : 0;
  return {
    title: mission.title,
    text: stage.text,
    target,
    distM,
    timerLeft: story.timerLeft,
  };
}

function completeStage(world, mission, stage) {
  const story = world.story;
  story.stage += 1;
  story.timerLeft = 0;
  if (story.stage >= mission.stages.length) {
    // Job done: pay out and move to the next job.
    world.player.money += mission.pay;
    world.events.push({ type: 'cash', amount: mission.pay, title: mission.title });
    world.story.mission += 1;
    world.story.stage = 0;
    if (world.story.mission >= world.missions.length) {
      world.story.done = true;
      world.events.push({ type: 'storyDone' });
    } else {
      const next = world.missions[world.story.mission];
      world.events.push({ type: 'newJob', title: next.title });
    }
    return;
  }
  const nextStage = mission.stages[story.stage];
  if (nextStage.timer > 0) story.timerLeft = nextStage.timer;
  world.events.push({ type: 'stage', text: nextStage.text });
}

function failJob(world, reason) {
  const story = world.story;
  story.failed = reason;
  story.mission = Math.max(0, story.mission);
  story.stage = 0;
  story.timerLeft = 0;
  story.active = true;
  world.events.push({ type: 'jobFailed', reason });
  // The Serrano is restored at the lot so the job can be tried again.
  if (world.missions[story.mission].id === 'hot-wheels' && world.serrano) {
    world.serrano.x = LANDMARKS.uptownLot.x;
    world.serrano.y = LANDMARKS.uptownLot.y;
    world.serrano.angle = 0;
    world.serrano.speed = 0;
    world.serrano.health = world.serrano.maxHealth;
    world.serrano.owned = false;
    if (world.player.car === world.serrano) world.player.car = null;
  }
}

export function stepMissions(world, dt) {
  const story = world.story;
  if (story.done) return;
  const p = world.player;

  // Starting the story: walk into the garage marker.
  if (!story.active) {
    const g = LANDMARKS.garage;
    if (Math.hypot(p.x - g.x, p.y - g.y) < 80) {
      story.active = true;
      story.stage = 1;
      story.timerLeft = world.missions[0].stages[1].timer;
      world.events.push({ type: 'stage', text: world.missions[0].stages[1].text });
      world.events.push({ type: 'newJob', title: world.missions[0].title });
    }
    return;
  }

  const mission = world.missions[story.mission];
  const stage = mission.stages[story.stage];

  // Timed stage: the clock runs out.
  if (stage.timer > 0) {
    story.timerLeft -= dt;
    if (story.timerLeft <= 0) {
      failJob(world, 'Out of time — Marla wants a word.');
      return;
    }
  }

  // The Serrano must survive HOT WHEELS.
  if (mission.id === 'hot-wheels' && world.serrano && world.serrano.health <= 0) {
    failJob(world, 'The Serrano is wrecked — the job is blown.');
    return;
  }

  // REEF RUN pickup: stepping on the yard blows the pickup — heat jumps to 230.
  if (mission.id === 'reef-run' && stage.id === 'pickup') {
    const target = stageTarget(world, stage);
    if (target && Math.hypot(p.x - target.x, p.y - target.y) < 70) {
      world.wanted.heat = Math.max(world.wanted.heat, 230);
      world.wanted.lastSeen = world.time;
      completeStage(world, mission, stage);
      return;
    }
  }

  // REEF RUN lose-heat: done when the stars fade out.
  if (mission.id === 'reef-run' && stage.id === 'lose-heat') {
    if (world.wanted.stars === 0 && world.wanted.heat < 20) {
      completeStage(world, mission, stage);
      return;
    }
  }

  // Steal stage: done the moment Dario is behind the Serrano's wheel.
  if (mission.id === 'hot-wheels' && stage.id === 'steal') {
    if (p.car === world.serrano) {
      completeStage(world, mission, stage);
      return;
    }
  }

  // Every other stage: arrive at the target (in a car for deliveries).
  const target = stageTarget(world, stage);
  if (target) {
    const radius = stage.target === 'garage' ? 90 : 70;
    if (Math.hypot(p.x - target.x, p.y - target.y) < radius) {
      // Delivery stages need the right car: the Serrano for HOT WHEELS' return.
      if (mission.id === 'hot-wheels' && stage.id === 'return' && p.car !== world.serrano) return;
      completeStage(world, mission, stage);
    }
  }
}
