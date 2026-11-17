// The corner minimap: district tints, the road grid, the bay, the gold objective
// pulse, flashing red/blue police blips and the white player arrow. It reads the
// world and paints a 228x172 box in the bottom-right corner of the view.

import { CITY, DISTRICTS, PALETTE, VIEW, WORLD } from './config.js';

export const MAP = { w: 228, h: 172, x: VIEW.w - 228 - 12, y: VIEW.h - 172 - 12 };

const SX = MAP.w / WORLD.w;
const SY = MAP.h / WORLD.h;

export function drawMinimap(ctx, world, time) {
  const mx = MAP.x;
  const my = MAP.y;
  // Frame.
  ctx.fillStyle = 'rgba(10, 12, 22, 0.85)';
  ctx.fillRect(mx - 3, my - 3, MAP.w + 6, MAP.h + 6);
  ctx.fillStyle = '#20242e';
  ctx.fillRect(mx, my, MAP.w, MAP.h);
  // District tints.
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.fillRect(mx + d.x0 * SX, my + d.y0 * SY, (d.x1 - d.x0) * SX, (d.y1 - d.y0) * SY);
  }
  // The bay.
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(mx, my + 2800 * SY, MAP.w, (WORLD.h - 2800) * SY);
  // Road grid.
  ctx.strokeStyle = 'rgba(20, 22, 30, 0.7)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(mx + i * CITY.pitch * SX, my);
    ctx.lineTo(mx + i * CITY.pitch * SX, my + MAP.h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx, my + i * CITY.pitch * SY);
    ctx.lineTo(mx + MAP.w, my + i * CITY.pitch * SY);
    ctx.stroke();
  }
  // Objective: a pulsing gold dot.
  const obj = world._objective;
  if (obj && obj.target) {
    const pulse = 4 + Math.sin(time * 5) * 2;
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(mx + obj.target.x * SX, my + obj.target.y * SY, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police blips flash red/blue with the world clock.
  const red = Math.sin(time * 6) > 0;
  for (const pc of world.police) {
    ctx.fillStyle = red ? PALETTE.policeLightRed : PALETTE.policeLightBlue;
    ctx.beginPath();
    ctx.arc(mx + pc.x * SX, my + pc.y * SY, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player: a white arrow pointing where Dario faces.
  const p = world.player;
  const px = mx + p.x * SX;
  const py = my + p.y * SY;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -4.5);
  ctx.lineTo(-5, 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
