// Every tuning number and colour for Palm Reef in one place. The view is a fixed
// 1280x720 logical area; the world is 3840x2880, blocks on a 480 pitch, roads on the
// multiples of 480. Nothing here depends on the screen size or the wall clock.

export const VIEW = { w: 1280, h: 720 };
export const STEP = 1 / 60;

export const CITY = { pitch: 480, cols: 8, rows: 6, roadHalf: 56, lane: 26, kerb: 50 };
export const WORLD = { w: 3840, h: 2880, sandTop: 2720, waterTop: 2800 };

export const PLAYER = {
  radius: 11,
  walk: 155,
  run: 250,
  punchRange: 40,
  punchArc: 1.9,
  punchCooldown: 0.38,
  enterRange: 52,
  startMoney: 250,
  startHealth: 100,
};

export const CAR = { accel: 300, brake: 420, drag: 0.55, steer: 2.6, reverseTop: 120 };

export const CAR_KINDS = {
  sedan: { top: 320, health: 100, len: 46, wid: 22 },
  taxi: { top: 320, health: 100, len: 46, wid: 22 },
  coupe: { top: 385, health: 90, len: 44, wid: 21 },
  van: { top: 285, health: 150, len: 52, wid: 24 },
  truck: { top: 265, health: 190, len: 58, wid: 26 },
  police: { top: 405, health: 160, len: 48, wid: 23 },
};

export const TRAFFIC = { count: 26, turnChance: 0.35, brakeGap: 58, minSpeed: 110, maxSpeed: 200 };

export const PEDESTRIANS = { count: 46, walk: 52, flee: 165, knockTime: 6, punchesToDown: 2 };

export const WANTED = {
  perStar: 100,
  maxStars: 5,
  decay: 7,
  unseenDelay: 4,
  witnessPed: 170,
  witnessPolice: 320,
  bustTime: 2.5,
  bustCashLoss: 0.15,
  wastedCashLoss: 0.1,
  crimes: {
    theft: 120,
    hitPedestrian: 150,
    punchPedestrian: 100,
    hitPolice: 110,
    hitCar: 55,
    punchCar: 35,
  },
};

export const DISTRICTS = [
  { name: 'UPTOWN', x0: 0, y0: 0, x1: 1280, y1: 1440, ground: '#b3add9', roofs: ['#8f88c4', '#7d76b3', '#a39ed0'] },
  { name: 'DOWNTOWN', x0: 1280, y0: 0, x1: 2560, y1: 1440, ground: '#9fc3d8', roofs: ['#5f89a8', '#4e7391', '#739db8'] },
  { name: 'THE PORT', x0: 2560, y0: 0, x1: 3840, y1: 1440, ground: '#c99a7a', roofs: ['#a8764f', '#96683f', '#bd8a62'] },
  { name: 'OLD TOWN', x0: 0, y0: 1440, x1: 1280, y1: 2880, ground: '#d8a078', roofs: ['#b5764a', '#a5663c', '#c98a5c'] },
  { name: 'MARINA', x0: 1280, y0: 1440, x1: 2560, y1: 2880, ground: '#a8c8b8', roofs: ['#6fa08d', '#5c8d7a', '#84b39e'] },
  { name: 'CORAL BAY', x0: 2560, y0: 1440, x1: 3840, y1: 2880, ground: '#e0a8b8', roofs: ['#c07a90', '#ab6880', '#d18ea2'] },
];

export const SHOP_SIGNS = [
  'CAFÉ AZUL', 'HOTEL REEF', 'TACO SOL', 'BANCO DEL MAR', 'CINEMA LUZ',
  "MARLA'S MOTORWORKS", 'PIZZA PALMA', 'SURF SHOP', 'LAUNDRY LUNA', 'BAR EL FARO',
  'FISH MARKET', 'GYM TITAN', 'HOTEL CORAL', 'BAKERY SOL', 'PHARMACY VIDA',
];

export const PALETTE = {
  road: '#3a3f4a',
  roadEdge: '#2c3038',
  roadDash: '#d8d2a0',
  sidewalk: '#8d8d84',
  park: '#5d8a4f',
  parkDark: '#4c7442',
  parking: '#6f7076',
  sand: '#e8d8a8',
  water: '#2f7fb8',
  waterDeep: '#256a9e',
  wave: '#bfe0f2',
  buildingLine: 'rgba(0,0,0,0.25)',
  windowLit: '#ffd97a',
  windowDark: '#2e3440',
  palmTrunk: '#7a5a38',
  palmLeaf: '#3f8a4f',
  gold: '#f2c94c',
  objective: '#ffd94a',
  playerRing: '#ffffff',
  health: '#58d068',
  healthLow: '#e5534b',
  text: '#f4f1e6',
  muted: '#b9b3a3',
  panel: 'rgba(12, 14, 26, 0.88)',
  star: '#ffd94a',
  starEmpty: 'rgba(255,255,255,0.35)',
  bust: '#ff5a4e',
  promptBg: 'rgba(12, 14, 26, 0.85)',
  policeLightRed: '#ff3b30',
  policeLightBlue: '#3b82ff',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const SAVE_KEY = 'palm-reef-street-heat.save.v1';
