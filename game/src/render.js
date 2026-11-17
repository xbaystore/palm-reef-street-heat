// Camera and world drawing: ground, roads, buildings, parks, the bay, cars,
// walkers, the player and the objective marker. Pixels out, no rules in — the
// renderer reads the world and paints it. The canvas is the fixed 1280x720 view
// and the camera follows the player, clamped to the map edge.

import { CITY, DISTRICTS, PALETTE, VIEW, WORLD } from './config.js';
import { hash2 } from './city.js';

export const SCREEN_W = VIEW.w;
export const SCREEN_H = VIEW.h;

const PITCH = CITY.pitch;
const HALF = CITY.roadHalf;

export function createCamera() {
  return { x: 0, y: 0 };
}

export function centerCamera(camera, x, y) {
  camera.x = Math.max(0, Math.min(WORLD.w - VIEW.w, x - VIEW.w / 2));
  camera.y = Math.max(0, Math.min(WORLD.h - VIEW.h, y - VIEW.h / 2));
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function text(value, x, y, size, color, align = 'left', weight = 'bold') {
    ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function drawGround(world, cam) {
    // District ground tints.
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.ground;
      ctx.fillRect(d.x0 - cam.x, d.y0 - cam.y, d.x1 - d.x0, d.y1 - d.y0);
    }
    // Roads: asphalt bands on every grid line, with centre dashes. The
    // southernmost road (y=2880) is skipped: the bay owns the south edge.
    ctx.fillStyle = PALETTE.road;
    for (let i = 0; i <= 8; i += 1) {
      ctx.fillRect(i * PITCH - HALF - cam.x, 0 - cam.y, HALF * 2, WORLD.h);
    }
    for (let i = 0; i <= 5; i += 1) {
      ctx.fillRect(0 - cam.x, i * PITCH - HALF - cam.y, WORLD.w, HALF * 2);
    }
    ctx.fillStyle = PALETTE.roadDash;
    for (let i = 0; i <= 8; i += 1) {
      for (let d = 0; d < WORLD.h; d += 64) {
        ctx.fillRect(i * PITCH - 2 - cam.x, d - cam.y, 4, 28);
        ctx.fillRect(d - cam.x, i * PITCH - 2 - cam.y, 28, 4);
      }
    }
  }

  function drawBlocks(world, cam) {
    for (const block of world.city.blocks) {
      const r = block.rect;
      const x = r.x - cam.x;
      const y = r.y - cam.y;
      if (x > VIEW.w || y > VIEW.h || x + r.w < 0 || y + r.h < 0) continue;
      if (block.type === 'park') {
        ctx.fillStyle = PALETTE.park;
        ctx.fillRect(x, y, r.w, r.h);
        ctx.fillStyle = PALETTE.parkDark;
        ctx.fillRect(x + 24, y + 24, r.w - 48, r.h - 48);
      } else if (block.type === 'parking') {
        ctx.fillStyle = PALETTE.parking;
        ctx.fillRect(x, y, r.w, r.h);
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 2;
        for (const spot of block.spots) {
          ctx.beginPath();
          ctx.moveTo(spot.x - 16 - cam.x, spot.y - cam.y);
          ctx.lineTo(spot.x + 16 - cam.x, spot.y - cam.y);
          ctx.stroke();
        }
      }
      for (const b of block.buildings) {
        const shade = b.shade;
        ctx.fillStyle = shadeColor(b.roof, shade);
        ctx.fillRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
        ctx.strokeStyle = PALETTE.buildingLine;
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
        // Lit-window grid, hashed from the building's seed so it never flickers.
        const cols = Math.max(2, Math.floor(b.w / 34));
        const rows = Math.max(2, Math.floor(b.h / 34));
        for (let cx = 0; cx < cols; cx += 1) {
          for (let cy = 0; cy < rows; cy += 1) {
            const lit = hash2(Math.floor(b.seed * 1000) + cx * 7, Math.floor(b.seed * 1000) + cy * 13) > 0.45;
            ctx.fillStyle = lit ? PALETTE.windowLit : PALETTE.windowDark;
            ctx.fillRect(b.x + 10 + cx * ((b.w - 20) / cols) - cam.x, b.y + 10 + cy * ((b.h - 20) / rows) - cam.y, 12, 14);
          }
        }
      }
      if (block.sign) {
        text(block.sign, r.x + r.w / 2 - cam.x, r.y + 22 - cam.y, 15, '#ffffff', 'center');
      }
    }
    // Palms: trunk line and a star of leaves.
    for (const palm of world.city.palms) {
      const px = palm.x - cam.x;
      const py = palm.y - cam.y;
      if (px < -20 || px > VIEW.w + 20 || py < -20 || py > VIEW.h + 20) continue;
      ctx.strokeStyle = PALETTE.palmTrunk;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + 3, py - 14);
      ctx.stroke();
      ctx.fillStyle = PALETTE.palmLeaf;
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(px + 3 + Math.cos(a) * 9, py - 14 + Math.sin(a) * 9, 9, 4, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function shadeColor(hex, factor) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
    const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
    const b = Math.min(255, Math.round((n & 255) * factor));
    return `rgb(${r},${g},${b})`;
  }

  function drawCar(car, cam, time) {
    const x = car.x - cam.x;
    const y = car.y - cam.y;
    if (x < -80 || x > VIEW.w + 80 || y < -80 || y > VIEW.h + 80) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(car.angle);
    const len = car.len;
    const wid = car.wid;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-len / 2 + 2, -wid / 2 + 3, len, wid);
    ctx.fillStyle = car.color;
    roundRect(-len / 2, -wid / 2, len, wid, 7);
    ctx.fill();
    // Windshield and rear window.
    ctx.fillStyle = '#202835';
    ctx.fillRect(len / 2 - 16, -wid / 2 + 3, 10, wid - 6);
    ctx.fillRect(-len / 2 + 6, -wid / 2 + 3, 8, wid - 6);
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(len / 2 - 2, -wid / 2 + 2, 3, 5);
    ctx.fillRect(len / 2 - 2, wid / 2 - 7, 3, 5);
    if (car.kind === 'police') {
      // Black-and-white cruiser with a flashing light bar (phase from the id).
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(-len / 2 + 14, -wid / 2, len - 28, wid);
      ctx.fillStyle = '#202835';
      ctx.fillRect(-len / 2 + 16, -wid / 2 + 3, 12, wid - 6);
      const phase = Math.sin(time * 6 + car.sirenPhase) > 0;
      ctx.fillStyle = phase ? PALETTE.policeLightRed : PALETTE.policeLightBlue;
      ctx.beginPath();
      ctx.arc(-2, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (car.kind === 'taxi') {
      ctx.fillStyle = '#1c1e26';
      text('TAXI', 0, 4, 9, '#1c1e26', 'center');
    }
    ctx.restore();
    // Wreck smoke.
    if (car.health < car.maxHealth * 0.4 && car.health > 0) {
      ctx.fillStyle = 'rgba(60,60,60,0.5)';
      ctx.beginPath();
      ctx.arc(x + Math.sin(time * 3 + car.id) * 4, y - 8, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPedestrians(world, cam) {
    for (const ped of world.pedestrians) {
      const x = ped.x - cam.x;
      const y = ped.y - cam.y;
      if (x < -20 || x > VIEW.w + 20 || y < -20 || y > VIEW.h + 20) continue;
      if (ped.state === 'down') {
        ctx.fillStyle = ped.shirt;
        ctx.beginPath();
        ctx.ellipse(x, y, 12, 6, 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e8b48a';
        ctx.beginPath();
        ctx.arc(x + 12, y - 2, 5, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      const bob = ped.state === 'walk' ? Math.sin(ped.bob) * 1.5 : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(x, y + 8, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.arc(x, y + bob, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8b48a';
      ctx.beginPath();
      ctx.arc(x, y - 9 + bob, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayer(world, cam, time) {
    const p = world.player;
    if (p.car) return;
    const x = p.x - cam.x;
    const y = p.y - cam.y;
    // White ring + bobbing arrow so Dario never blends into a crowd.
    ctx.strokeStyle = PALETTE.playerRing;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.stroke();
    const arrowY = y - 26 - Math.sin(time * 4) * 4;
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.moveTo(x, arrowY + 8);
    ctx.lineTo(x - 7, arrowY - 4);
    ctx.lineTo(x + 7, arrowY - 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2f6fb3';
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b48a';
    ctx.beginPath();
    ctx.arc(x, y - 11, 5, 0, Math.PI * 2);
    ctx.fill();
    // Punch swing.
    if (p.punchAnim > 0) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 26, p.angle - 0.6, p.angle + 0.6);
      ctx.stroke();
    }
  }

  /** The coast: a sand strip and the bay along the south edge, painted over the
   * bottom of the southern blocks so the waterfront reads as a beach, not a
   * strip of road. The Marina drop marker sits on this sand. */
  function drawCoast(world, cam) {
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0 - cam.x, WORLD.sandTop - cam.y, WORLD.w, WORLD.waterTop - WORLD.sandTop);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(0 - cam.x, WORLD.waterTop - cam.y, WORLD.w, WORLD.h - WORLD.waterTop);
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(0 - cam.x, WORLD.waterTop + 40 - cam.y, WORLD.w, WORLD.h - WORLD.waterTop - 40);
    ctx.strokeStyle = PALETTE.wave;
    ctx.lineWidth = 3;
    for (let x = 40; x < WORLD.w; x += 140) {
      const wob = Math.sin(x * 0.01) * 6;
      ctx.beginPath();
      ctx.moveTo(x - cam.x, WORLD.waterTop + 22 + wob - cam.y);
      ctx.lineTo(x + 46 - cam.x, WORLD.waterTop + 22 + wob - cam.y);
      ctx.stroke();
    }
  }

  function drawMarker(world, cam, time) {
    const obj = world._objective;
    if (!obj || !obj.target) return;
    const x = obj.target.x - cam.x;
    const y = obj.target.y - cam.y;
    const pulse = 1 + Math.sin(time * 4) * 0.15;
    ctx.strokeStyle = PALETTE.objective;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 217, 74, 0.25)';
    ctx.beginPath();
    ctx.arc(x, y, 34 * pulse, 0, Math.PI * 2);
    ctx.fill();
    // Light beacon rising from the marker.
    const grad = ctx.createLinearGradient(x, y, x, y - 150);
    grad.addColorStop(0, 'rgba(255, 217, 74, 0.5)');
    grad.addColorStop(1, 'rgba(255, 217, 74, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - 5, y - 150, 10, 150);
    text('▼ OBJECTIVE', x, y - 52, 14, PALETTE.objective, 'center');
  }

  /** Paint one frame of the world (no HUD, no screens — hud.js owns those). */
  function drawWorld(world, cam) {
    const time = world.time;
    drawGround(world, cam);
    drawBlocks(world, cam);
    drawCoast(world, cam);
    drawMarker(world, cam, time);
    for (const c of world.parked) drawCar(c, cam, time);
    if (world.serrano) drawCar(world.serrano, cam, time);
    for (const t of world.traffic) drawCar(t.car, cam, time);
    for (const pc of world.police) drawCar(pc, cam, time);
    if (world.player.car) drawCar(world.player.car, cam, time);
    drawPedestrians(world, cam);
    drawPlayer(world, cam, time);
  }

  return { drawWorld, text, ctx };
}
