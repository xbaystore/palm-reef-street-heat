// The HUD: health bar and district (top-left), the objective banner (top-centre),
// cash, wanted stars and the bust meter (top-right), the context prompt
// (bottom-centre), speed while driving, and the minimap (bottom-right, via
// minimap.js). Toasts stack under the banner. Title, paused, busted and wasted
// are full-screen panels drawn over the world.

import { PALETTE, VIEW, WANTED } from './config.js';
import { districtAt } from './city.js';
import { drawMinimap } from './minimap.js';

export const SCREEN_W = VIEW.w;
export const SCREEN_H = VIEW.h;

export function createToasts() {
  return {
    list: [],
    push(text) {
      this.list.push({ text, ttl: 3.2 });
      if (this.list.length > 4) this.list.shift();
    },
    step(dt) {
      for (const t of this.list) t.ttl -= dt;
      this.list = this.list.filter((t) => t.ttl > 0);
    },
  };
}

function formatTimer(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, '0')}`;
}

function starRow(ctx, stars, x, y) {
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < WANTED.maxStars; i += 1) {
    ctx.fillStyle = i < stars ? PALETTE.star : PALETTE.starEmpty;
    ctx.fillText('★', x + i * 28, y);
  }
}

export function drawHud(ctx, world, toasts, prompt) {
  const p = world.player;
  const obj = world._objective;
  ctx.textBaseline = 'alphabetic';

  // Top-left: health bar + district name.
  ctx.fillStyle = 'rgba(10, 12, 22, 0.6)';
  ctx.fillRect(14, 14, 210, 46);
  ctx.fillStyle = '#20242e';
  ctx.fillRect(24, 24, 150, 14);
  ctx.fillStyle = p.health > 30 ? PALETTE.health : PALETTE.healthLow;
  ctx.fillRect(24, 24, Math.max(0, 150 * (p.health / 100)), 14);
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.text;
  ctx.textAlign = 'left';
  ctx.fillText(districtAt(p.x, p.y).name, 24, 54);

  // Top-centre: the objective banner.
  if (obj) {
    const title = obj.title;
    const lines = [obj.text];
    if (obj.timerLeft > 0) lines.push(`⏱ ${formatTimer(obj.timerLeft)}`);
    if (obj.distM > 0) lines.push(`${obj.distM} m`);
    const bannerW = 460;
    const bannerH = 30 + lines.length * 22;
    const bx = (VIEW.w - bannerW) / 2;
    ctx.fillStyle = 'rgba(10, 12, 22, 0.72)';
    ctx.fillRect(bx, 12, bannerW, bannerH);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(bx, 12, 4, bannerH);
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.gold;
    ctx.textAlign = 'left';
    ctx.fillText(title, bx + 16, 36);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.text;
    for (let i = 0; i < lines.length; i += 1) {
      ctx.fillText(lines[i], bx + 16, 58 + i * 22);
    }
  }

  // Top-right: cash, stars, bust meter.
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = '#7ee787';
  ctx.textAlign = 'right';
  ctx.fillText(`$${p.money}`, VIEW.w - 24, 38);
  starRow(ctx, world.wanted.stars, VIEW.w - 24 - WANTED.maxStars * 28 + 4, 66);
  if (world.wanted.bust > 0) {
    ctx.fillStyle = 'rgba(10, 12, 22, 0.6)';
    ctx.fillRect(VIEW.w - 174, 76, 150, 10);
    ctx.fillStyle = PALETTE.bust;
    ctx.fillRect(VIEW.w - 174, 76, 150 * (world.wanted.bust / WANTED.bustTime), 10);
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.bust;
    ctx.textAlign = 'right';
    ctx.fillText('BUST', VIEW.w - 24, 74);
  }

  // Toasts under the banner.
  ctx.font = '15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  let ty = 108;
  for (const t of toasts.list) {
    ctx.fillStyle = 'rgba(10, 12, 22, 0.75)';
    const w = ctx.measureText(t.text).width + 24;
    ctx.fillRect((VIEW.w - w) / 2, ty - 18, w, 26);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(t.text, VIEW.w / 2, ty);
    ty += 32;
  }

  // Bottom-centre: the context prompt.
  if (prompt) {
    ctx.font = 'bold 17px system-ui, sans-serif';
    const w = ctx.measureText(prompt).width + 32;
    ctx.fillStyle = PALETTE.promptBg;
    ctx.fillRect((VIEW.w - w) / 2, VIEW.h - 66, w, 34);
    ctx.fillStyle = PALETTE.gold;
    ctx.textAlign = 'center';
    ctx.fillText(prompt, VIEW.w / 2, VIEW.h - 42);
  }

  // Speed while driving.
  if (p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.36);
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.text;
    ctx.textAlign = 'right';
    ctx.fillText(`${kmh} km/h`, VIEW.w - 24, VIEW.h - 200);
    // Car health bar under the speed.
    ctx.fillStyle = '#20242e';
    ctx.fillRect(VIEW.w - 174, VIEW.h - 192, 150, 8);
    ctx.fillStyle = p.car.health > 40 ? PALETTE.health : PALETTE.healthLow;
    ctx.fillRect(VIEW.w - 174, VIEW.h - 192, Math.max(0, 150 * (p.car.health / p.car.maxHealth)), 8);
  }

  drawMinimap(ctx, world, world.time);
}

function panel(ctx, title, lines, prompt) {
  ctx.fillStyle = 'rgba(8, 10, 20, 0.72)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  const w = 620;
  const h = 150 + lines.length * 34;
  const x = (VIEW.w - w) / 2;
  const y = (VIEW.h - h) / 2;
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(x, y, w, 4);
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.text;
  ctx.textAlign = 'center';
  ctx.fillText(title, VIEW.w / 2, y + 72);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.muted;
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], VIEW.w / 2, y + 116 + i * 34);
  }
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(prompt, VIEW.w / 2, y + h - 28);
}

export function drawTitle(ctx, hasSave) {
  // Sunset gradient, sun, skyline silhouette, then the title.
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW.h);
  grad.addColorStop(0, '#2b1e4e');
  grad.addColorStop(0.55, '#c95a3a');
  grad.addColorStop(1, '#f2a54c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.fillStyle = '#ffd97a';
  ctx.beginPath();
  ctx.arc(VIEW.w - 300, 210, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c1230';
  for (let i = 0; i < 22; i += 1) {
    const bw = 34 + ((i * 53) % 46);
    const bh = 90 + ((i * 97) % 150);
    ctx.fillRect(i * 60, VIEW.h - bh - 90, bw, bh);
  }
  ctx.fillStyle = '#140d24';
  ctx.fillRect(0, VIEW.h - 90, VIEW.w, 90);
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('PALM REEF', VIEW.w / 2, 250);
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText('STREET HEAT', VIEW.w / 2, 306);
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillStyle = '#f4f1e6';
  ctx.fillText('Dario Solano owes Marla money. Three jobs. One orange Serrano GT.', VIEW.w / 2, 360);
  ctx.fillText('Steal cars, run the jobs, and outrun the five-star heat.', VIEW.w / 2, 388);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('WASD / arrows — move · Shift — run · E — enter / steal a car · F / Space — punch · P — pause', VIEW.w / 2, 452);
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(hasSave ? 'ENTER to play · C to continue your run' : 'ENTER to play', VIEW.w / 2, 500);
}

export function drawPaused(ctx) {
  panel(ctx, 'PAUSED', ['The streets will wait for you.'], 'Press P to resume');
}

export function drawBusted(ctx, money) {
  panel(ctx, 'BUSTED', [`The Palm Reef PD took 15% of your cash.`, `You wake up at Marla's Motorworks.`, `Cash left: $${money}`], 'Press ENTER to keep going');
}

export function drawWasted(ctx, money) {
  panel(ctx, 'WASTED', [`Dario is down. The crew took 10% of your cash.`, `Cash left: $${money}`], 'Press ENTER to keep going');
}
