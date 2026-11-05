// All artwork is drawn procedurally with Canvas 2D — no external assets.
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function cloudSprite(tint) {
  const c = document.createElement('canvas');
  c.width = 240;
  c.height = 130;
  const g = c.getContext('2d');
  const puffs = [
    [70, 78, 42, 0.55],
    [112, 62, 54, 0.7],
    [162, 80, 44, 0.55],
    [118, 92, 60, 0.4],
    [38, 92, 30, 0.36],
    [196, 96, 32, 0.32],
  ];
  g.globalCompositeOperation = 'lighter';
  for (const [x, y, r, a] of puffs) {
    const grad = g.createRadialGradient(x, y, r * 0.08, x, y, r);
    grad.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${a})`);
    grad.addColorStop(0.55, `rgba(${tint[0]},${tint[1]},${tint[2]},${a * 0.42})`);
    grad.addColorStop(1, `rgba(${tint[0]},${tint[1]},${tint[2]},0)`);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }
  return c;
}

export function createBackdrop(W, H, stage) {
  const rnd = mulberry32(stage === 1 ? 9182 : 55127);
  const bd = {
    stage,
    W,
    H,
    scroll: 0,
    stars: [],
    clouds: [],
    buildings: [],
    rain: [],
    glints: [],
    cloudSprites: [],
    moon: { x: W * (stage === 1 ? 0.74 : 0.24), y: H * 0.2, r: stage === 1 ? 88 : 62 },
  };
  const starCount = stage === 1 ? 70 : 115;
  for (let i = 0; i < starCount; i++) {
    bd.stars.push({
      x: rnd() * W,
      y: rnd() * H,
      r: 0.5 + rnd() * 1.5,
      a: 0.25 + rnd() * 0.6,
      tw: rnd() * TAU,
      speed: 2 + rnd() * 8,
    });
  }
  bd.cloudSprites = [
    cloudSprite(stage === 1 ? [255, 138, 120] : [88, 175, 210]),
    cloudSprite(stage === 1 ? [210, 110, 180] : [120, 120, 220]),
    cloudSprite(stage === 1 ? [255, 190, 140] : [70, 220, 205]),
  ];
  for (let i = 0; i < 9; i++) {
    bd.clouds.push({
      x: rnd() * W,
      y: rnd() * H,
      s: 0.55 + rnd() * 1.15,
      a: stage === 1 ? 0.1 + rnd() * 0.24 : 0.05 + rnd() * 0.12,
      sp: 9 + rnd() * 26,
      sprite: Math.floor(rnd() * 3),
    });
  }
  if (stage === 2) {
    for (let i = 0; i < 16; i++) {
      const depth = 0.35 + rnd() * 0.9;
      const w = 50 + rnd() * 110;
      const b = {
        x: rnd() * (W + 160) - 80,
        y: rnd() * H,
        w,
        h: 80 + rnd() * 170,
        depth,
        sp: 14 + depth * 34,
        hue: rnd() > 0.5 ? 'cyan' : 'pink',
        windows: [],
      };
      const cols = Math.max(2, Math.floor(w / 18));
      const rows = Math.max(3, Math.floor(b.h / 20));
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rnd() > 0.62) {
            b.windows.push({
              x: 7 + c * ((w - 14) / cols),
              y: 10 + r * ((b.h - 20) / rows),
              w: 3 + rnd() * 3,
              h: 2 + rnd() * 3,
              a: 0.15 + rnd() * 0.55,
              blink: rnd() > 0.85,
            });
          }
        }
      }
      bd.buildings.push(b);
    }
    bd.buildings.sort((a, b) => a.depth - b.depth);
    for (let i = 0; i < 80; i++) {
      bd.rain.push({
        x: rnd() * (W + 100) - 50,
        y: rnd() * H,
        len: 8 + rnd() * 18,
        sp: 420 + rnd() * 320,
        a: 0.08 + rnd() * 0.22,
      });
    }
  }
  for (let i = 0; i < 26; i++) {
    bd.glints.push({
      x: rnd() * W,
      y: rnd() * H,
      r: 1 + rnd() * 2.6,
      sp: 12 + rnd() * 28,
      ph: rnd() * TAU,
      a: 0.15 + rnd() * 0.4,
    });
  }
  return bd;
}

export function updateBackdrop(bd, dt, W, H) {
  bd.W = W;
  bd.H = H;
  bd.scroll += dt * 16;
  for (const s of bd.stars) {
    s.y += s.speed * dt;
    if (s.y > H + 4) {
      s.y = -6;
      s.x = Math.random() * W;
    }
  }
  for (const c of bd.clouds) {
    c.y += c.sp * dt;
    c.x += Math.sin(bd.scroll * 0.01 + c.y * 0.01) * 3 * dt;
    if (c.y > H + 100) {
      c.y = -120;
      c.x = Math.random() * W;
    }
  }
  for (const b of bd.buildings) {
    b.y += b.sp * dt;
    if (b.y > H + b.h + 20) {
      b.y = -b.h - Math.random() * 160;
      b.x = Math.random() * (W + 160) - 80;
    }
  }
  for (const r of bd.rain) {
    r.y += r.sp * dt;
    r.x -= r.sp * 0.16 * dt;
    if (r.y > H + 20) {
      r.y = -20;
      r.x = Math.random() * (W + 120) - 30;
    }
    if (r.x < -30) r.x = W + 20;
  }
  for (const g of bd.glints) {
    g.y += g.sp * dt;
    if (g.y > H + 6) {
      g.y = -6;
      g.x = Math.random() * W;
    }
  }
}

export function drawBackdrop(ctx, bd, W, H, time) {
  const stage = bd.stage;
  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  if (stage === 1) {
    sky.addColorStop(0, '#060417');
    sky.addColorStop(0.32, '#1a0a31');
    sky.addColorStop(0.62, '#3f123f');
    sky.addColorStop(0.84, '#75263f');
    sky.addColorStop(1, '#b04a3d');
  } else {
    sky.addColorStop(0, '#02040d');
    sky.addColorStop(0.4, '#05101d');
    sky.addColorStop(0.75, '#071a29');
    sky.addColorStop(1, '#0a2634');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Moon / distant orb
  const m = bd.moon;
  const mg = ctx.createRadialGradient(m.x, m.y, 2, m.x, m.y, m.r * 2.4);
  if (stage === 1) {
    mg.addColorStop(0, 'rgba(255,214,170,0.95)');
    mg.addColorStop(0.18, 'rgba(255,178,130,0.55)');
    mg.addColorStop(0.55, 'rgba(255,120,90,0.12)');
    mg.addColorStop(1, 'rgba(255,100,80,0)');
  } else {
    mg.addColorStop(0, 'rgba(170,240,255,0.8)');
    mg.addColorStop(0.2, 'rgba(90,200,240,0.3)');
    mg.addColorStop(0.55, 'rgba(60,160,220,0.08)');
    mg.addColorStop(1, 'rgba(40,120,200,0)');
  }
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.arc(m.x, m.y, m.r * 2.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = stage === 1 ? 'rgba(255,206,158,0.36)' : 'rgba(150,225,245,0.2)';
  ctx.beginPath();
  ctx.arc(m.x, m.y, m.r * 0.62, 0, TAU);
  ctx.fill();

  // Stars
  for (const s of bd.stars) {
    const tw = 0.55 + 0.45 * Math.sin(time * 1.6 + s.tw);
    ctx.globalAlpha = s.a * tw;
    ctx.fillStyle = stage === 1 ? '#ffe6c8' : '#c8f6ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Distant glow near bottom
  const glow = ctx.createRadialGradient(W / 2, H * 1.05, 10, W / 2, H * 1.05, H * 0.62);
  glow.addColorStop(0, stage === 1 ? 'rgba(255,108,60,0.25)' : 'rgba(32,180,220,0.16)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  if (stage === 2) {
    // Rooftops / skyline scrolling beneath
    for (const b of bd.buildings) {
      ctx.save();
      ctx.globalAlpha = 0.5 + b.depth * 0.28;
      const grad = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
      grad.addColorStop(0, '#0b1b2a');
      grad.addColorStop(0.6, '#061019');
      grad.addColorStop(1, '#03080f');
      ctx.fillStyle = grad;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = b.hue === 'cyan' ? 'rgba(82,226,255,0.22)' : 'rgba(255,96,180,0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      // roof edge light
      ctx.fillStyle = b.hue === 'cyan' ? 'rgba(110,240,255,0.4)' : 'rgba(255,130,200,0.36)';
      ctx.fillRect(b.x + 3, b.y + 2, b.w - 6, 1.4);
      // vents
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(b.x + b.w * 0.14, b.y + 11, b.w * 0.2, 5);
      ctx.fillRect(b.x + b.w * 0.62, b.y + b.h - 18, b.w * 0.16, 6);
      for (const w of b.windows) {
        let a = w.a;
        if (w.blink) a *= 0.6 + 0.4 * Math.sin(time * 3 + w.x * 0.5);
        ctx.globalAlpha = a * (0.5 + b.depth * 0.3);
        ctx.fillStyle = b.hue === 'cyan' ? '#8ff4ff' : '#ff9edb';
        ctx.fillRect(b.x + w.x, b.y + w.y, w.w, w.h);
      }
      ctx.restore();
    }
    // wet-road light streaks
    ctx.save();
    for (const g of bd.glints) {
      ctx.globalAlpha = g.a * (0.4 + 0.6 * Math.sin(time * 1.4 + g.ph));
      ctx.fillStyle = '#7fe8ff';
      ctx.fillRect(g.x, g.y, 1.4, 12 + g.r * 4);
    }
    ctx.restore();
    // rain
    ctx.save();
    ctx.strokeStyle = 'rgba(150,220,255,0.6)';
    ctx.lineWidth = 1;
    for (const r of bd.rain) {
      ctx.globalAlpha = r.a;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x - r.len * 0.16, r.y + r.len);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Clouds
  for (const c of bd.clouds) {
    const sprite = bd.cloudSprites[c.sprite];
    ctx.save();
    ctx.globalAlpha = c.a;
    ctx.globalCompositeOperation = 'lighter';
    const w = 240 * c.s;
    const h = 130 * c.s;
    ctx.drawImage(sprite, c.x - w / 2, c.y - h / 2, w, h);
    ctx.restore();
  }

  // Floating embers / glints
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const g of bd.glints) {
    const a = g.a * (0.5 + 0.5 * Math.sin(time * 2 + g.ph));
    ctx.globalAlpha = a;
    ctx.fillStyle = stage === 1 ? '#ffb070' : '#6fe6ff';
    ctx.beginPath();
    ctx.arc(g.x + Math.sin(time * 0.7 + g.ph) * 5, g.y, g.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // Soft bottom haze
  const haze = ctx.createLinearGradient(0, H * 0.6, 0, H);
  haze.addColorStop(0, 'rgba(0,0,0,0)');
  haze.addColorStop(1, stage === 1 ? 'rgba(255,110,60,0.08)' : 'rgba(20,190,220,0.07)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, H * 0.6, W, H * 0.4);
}

// ---------------------------------------------------------------- player
export function drawPlayer(ctx, p, t) {
  const s = p.scale || 1;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.tilt || 0);
  ctx.scale(s, s);

  // engine glow
  ctx.globalCompositeOperation = 'lighter';
  const eg = ctx.createRadialGradient(0, 26, 1, 0, 26, 34);
  eg.addColorStop(0, 'rgba(120,245,255,0.5)');
  eg.addColorStop(0.45, 'rgba(50,190,255,0.16)');
  eg.addColorStop(1, 'rgba(20,120,255,0)');
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.arc(0, 26, 34, 0, TAU);
  ctx.fill();

  for (const side of [-1, 1]) {
    const flick = 0.72 + 0.28 * Math.sin(t * 41 + side * 2.1) + 0.08 * Math.sin(t * 77);
    const fg = ctx.createLinearGradient(0, 14, 0, 40);
    fg.addColorStop(0, 'rgba(230,255,255,0.95)');
    fg.addColorStop(0.3, 'rgba(90,235,255,0.85)');
    fg.addColorStop(0.7, 'rgba(40,130,255,0.35)');
    fg.addColorStop(1, 'rgba(20,60,255,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(side * 10 - 4.5, 15);
    ctx.quadraticCurveTo(side * 10 - 1, 26 + 16 * flick, side * 10, 30 + 18 * flick);
    ctx.quadraticCurveTo(side * 10 + 1, 26 + 16 * flick, side * 10 + 4.5, 15);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  // wings
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(0, 4);
    ctx.scale(side, 1);
    const wg = ctx.createLinearGradient(4, -6, 32, 24);
    wg.addColorStop(0, '#173d5e');
    wg.addColorStop(0.55, '#0b243a');
    wg.addColorStop(1, '#071726');
    ctx.fillStyle = wg;
    ctx.strokeStyle = 'rgba(96,235,255,0.72)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(5, -9);
    ctx.lineTo(30, 10);
    ctx.lineTo(37, 22);
    ctx.lineTo(23, 18);
    ctx.lineTo(19, 25);
    ctx.lineTo(10, 13);
    ctx.lineTo(5, 19);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // wing panel line
    ctx.strokeStyle = 'rgba(96,235,255,0.3)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(26, 16);
    ctx.stroke();
    // missile pod
    ctx.fillStyle = '#33506a';
    ctx.fillRect(22, 7, 3.4, 10);
    ctx.fillStyle = '#ff9d4d';
    ctx.fillRect(22, 6, 3.4, 2.4);
    ctx.restore();
  }

  // body
  const bg = ctx.createLinearGradient(0, -34, 0, 26);
  bg.addColorStop(0, '#f4feff');
  bg.addColorStop(0.24, '#bdeeff');
  bg.addColorStop(0.55, '#4f96bb');
  bg.addColorStop(0.82, '#1a3a55');
  bg.addColorStop(1, '#0a1a2a');
  ctx.fillStyle = bg;
  ctx.strokeStyle = 'rgba(160,250,255,0.85)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.quadraticCurveTo(6, -20, 8, -6);
  ctx.quadraticCurveTo(10, 10, 7, 24);
  ctx.lineTo(-7, 24);
  ctx.quadraticCurveTo(-10, 10, -8, -6);
  ctx.quadraticCurveTo(-6, -20, 0, -34);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // center spine
  ctx.fillStyle = 'rgba(240,255,255,0.72)';
  ctx.beginPath();
  ctx.moveTo(0, -30);
  ctx.lineTo(2.2, -8);
  ctx.lineTo(1.6, 14);
  ctx.lineTo(-1.6, 14);
  ctx.lineTo(-2.2, -8);
  ctx.closePath();
  ctx.fill();

  // cockpit
  const cg = ctx.createLinearGradient(0, -16, 0, 2);
  cg.addColorStop(0, '#e8ffff');
  cg.addColorStop(0.35, '#5aeaff');
  cg.addColorStop(1, '#06283c');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.ellipse(0, -7, 4.6, 9.2, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(6,25,40,0.7)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // nose light
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(160,250,255,0.9)';
  ctx.beginPath();
  ctx.arc(0, -31, 2.2, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // tail fins
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#0c2438';
    ctx.strokeStyle = 'rgba(96,235,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(side * 5, 14);
    ctx.lineTo(side * 14, 26);
    ctx.lineTo(side * 11, 28);
    ctx.lineTo(side * 3, 21);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();

  // invulnerability shield
  if (p.invuln > 0) {
    const a = 0.25 + 0.35 * Math.abs(Math.sin(t * 7));
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(110,240,255,${a})`;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([7, 8]);
    ctx.lineDashOffset = -t * 36;
    ctx.beginPath();
    ctx.arc(0, 0, 32 + Math.sin(t * 5) * 2, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- enemies
export function drawEnemy(ctx, e, t) {
  const s = e.size || 1;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.scale(s, s);
  if (e.type === 'imp') {
    const flap = Math.sin(t * 10 + e.seed) * 0.5;
    // wings
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      ctx.rotate(flap * 0.18);
      ctx.fillStyle = 'rgba(116,22,48,0.92)';
      ctx.strokeStyle = 'rgba(255,104,110,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(6, -4);
      ctx.quadraticCurveTo(21, -18, 29, -3);
      ctx.quadraticCurveTo(22, 5, 16, 3);
      ctx.quadraticCurveTo(14, 12, 6, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // body
    const g = ctx.createLinearGradient(0, -18, 0, 18);
    g.addColorStop(0, '#ff6d63');
    g.addColorStop(0.4, '#9a1d3c');
    g.addColorStop(1, '#39091b');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 15, 0, 0, TAU);
    ctx.fill();
    // head
    ctx.fillStyle = '#c23550';
    ctx.beginPath();
    ctx.ellipse(0, -10, 8, 7, 0, 0, TAU);
    ctx.fill();
    // horns
    ctx.fillStyle = '#ffd8b0';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 5, -15);
      ctx.lineTo(side * 9, -24);
      ctx.lineTo(side * 1.5, -16);
      ctx.closePath();
      ctx.fill();
    }
    // eyes
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ffe25e';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * 3.4, -11, 1.9, 2.6, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,120,60,0.8)';
    ctx.beginPath();
    ctx.arc(0, 11, 2.4, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  } else if (e.type === 'diver') {
    ctx.rotate(e.angle || 0);
    ctx.globalCompositeOperation = 'lighter';
    const trail = ctx.createLinearGradient(0, -6, 0, 34);
    trail.addColorStop(0, 'rgba(255,170,60,0.8)');
    trail.addColorStop(1, 'rgba(255,60,30,0)');
    ctx.fillStyle = trail;
    ctx.beginPath();
    ctx.moveTo(-4, 3);
    ctx.lineTo(4, 3);
    ctx.lineTo(0, 36);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createLinearGradient(0, -20, 0, 12);
    g.addColorStop(0, '#ffe6a8');
    g.addColorStop(0.3, '#ff8a3c');
    g.addColorStop(1, '#6b160f');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#ffd08a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.lineTo(12, 4);
    ctx.lineTo(5, 2);
    ctx.lineTo(0, 10);
    ctx.lineTo(-5, 2);
    ctx.lineTo(-12, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff8dd';
    ctx.beginPath();
    ctx.arc(0, -9, 2.2, 0, TAU);
    ctx.fill();
  } else if (e.type === 'drone') {
    const bob = Math.sin(t * 3 + e.seed) * 2;
    ctx.translate(0, bob);
    // side rotors
    ctx.fillStyle = 'rgba(40,120,160,0.5)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * 17, 0, 8, 3, 0, 0, TAU);
      ctx.fill();
    }
    const g = ctx.createLinearGradient(0, -12, 0, 12);
    g.addColorStop(0, '#3b6f86');
    g.addColorStop(0.5, '#122d40');
    g.addColorStop(1, '#050f18');
    ctx.fillStyle = g;
    ctx.strokeStyle = 'rgba(110,235,255,0.7)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // dome
    ctx.fillStyle = 'rgba(90,240,255,0.3)';
    ctx.beginPath();
    ctx.arc(0, -3, 8, Math.PI, TAU);
    ctx.fill();
    // eye
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ff5b4d';
    ctx.beginPath();
    ctx.arc(0, 1, 3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,80,70,0.25)';
    ctx.beginPath();
    ctx.arc(0, 1, 8, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  } else if (e.type === 'gunship') {
    const g = ctx.createLinearGradient(0, -22, 0, 22);
    g.addColorStop(0, '#6a8398');
    g.addColorStop(0.5, '#263c4f');
    g.addColorStop(1, '#0a141f');
    ctx.fillStyle = g;
    ctx.strokeStyle = 'rgba(255,150,80,0.45)';
    ctx.lineWidth = 1.2;
    // hull
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(16, -10);
    ctx.lineTo(34, -4);
    ctx.lineTo(30, 8);
    ctx.lineTo(13, 10);
    ctx.lineTo(8, 22);
    ctx.lineTo(-8, 22);
    ctx.lineTo(-13, 10);
    ctx.lineTo(-30, 8);
    ctx.lineTo(-34, -4);
    ctx.lineTo(-16, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // turrets
    ctx.fillStyle = '#0b151f';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * 16, 0, 5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ff9a52';
      ctx.fillRect(side * 16 - 1.5, 4, 3, 8);
      ctx.fillStyle = '#0b151f';
    }
    // canopy
    ctx.fillStyle = 'rgba(255,120,60,0.5)';
    ctx.beginPath();
    ctx.ellipse(0, -8, 7, 5, 0, 0, TAU);
    ctx.fill();
    // lights
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ff5c4b';
    ctx.beginPath();
    ctx.arc(0, 12, 2, 0, TAU);
    ctx.fill();
    ctx.restore();
    return;
  } else if (e.type === 'turret') {
    const bob = Math.sin(t * 2.4 + e.seed) * 2;
    ctx.translate(0, bob);
    // fins
    ctx.fillStyle = '#182e3d';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 12, -4);
      ctx.lineTo(side * 24, 14);
      ctx.lineTo(side * 10, 16);
      ctx.closePath();
      ctx.fill();
    }
    // pod
    const g = ctx.createLinearGradient(-10, 0, 12, 0);
    g.addColorStop(0, '#4b6172');
    g.addColorStop(0.4, '#243846');
    g.addColorStop(1, '#0a1620');
    ctx.fillStyle = g;
    ctx.strokeStyle = 'rgba(255,140,70,0.4)';
    ctx.lineWidth = 1;
    roundedRect(ctx, -11, -20, 22, 38, 8);
    ctx.fill();
    ctx.stroke();
    // tubes
    ctx.fillStyle = '#050b11';
    const ready = Math.max(0, Math.sin(t * 3 + e.seed));
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const x = -6 + i * 8;
        const y = -13 + j * 10;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, TAU);
        ctx.fill();
        ctx.fillStyle = ready > 0.55 ? '#ff5d35' : '#4a2a22';
        ctx.beginPath();
        ctx.arc(x, y, 1.35, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#050b11';
      }
    }
    // blinking light
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,70,50,${0.35 + 0.5 * Math.abs(Math.sin(t * 5 + e.seed))})`;
    ctx.beginPath();
    ctx.arc(0, 23, 2.2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function rocketBody(ctx, w, l) {
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, '#53616f');
  g.addColorStop(0.35, '#e4edf4');
  g.addColorStop(0.7, '#9aa9b7');
  g.addColorStop(1, '#3a4856');
  ctx.fillStyle = g;
  roundedRect(ctx, -w / 2, -l / 2, w, l, w / 2.6);
  ctx.fill();
  // red nose
  ctx.fillStyle = '#ff4a3a';
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 1, -l / 2 + l * 0.34);
  ctx.quadraticCurveTo(0, -l / 2 - 3, w / 2 - 1, -l / 2 + l * 0.34);
  ctx.closePath();
  ctx.fill();
  // fins
  ctx.fillStyle = '#c9332a';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * (w / 2 - 0.5), l / 2 - 5);
    ctx.lineTo(side * (w / 2 + 5), l / 2);
    ctx.lineTo(side * (w / 2 - 0.5), l / 2);
    ctx.closePath();
    ctx.fill();
  }
  // band
  ctx.fillStyle = '#2a3743';
  ctx.fillRect(-w / 2, l * 0.12, w, 2);
}

export function drawHostile(ctx, b, t) {
  ctx.save();
  ctx.translate(b.x, b.y);
  if (b.kind === 'rocket') {
    ctx.rotate(b.angle + Math.PI / 2);
    // exhaust
    ctx.globalCompositeOperation = 'lighter';
    const fg = ctx.createLinearGradient(0, 9, 0, 28 + Math.sin(t * 40) * 4);
    fg.addColorStop(0, 'rgba(255,240,190,0.95)');
    fg.addColorStop(0.35, 'rgba(255,170,60,0.85)');
    fg.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-3.5, 10);
    ctx.quadraticCurveTo(0, 24, 0, 30 + Math.sin(t * 42) * 4);
    ctx.quadraticCurveTo(0, 24, 3.5, 10);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    rocketBody(ctx, 7, 24);
    // glow warning tip
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,80,60,0.9)';
    ctx.beginPath();
    ctx.arc(0, -11, 1.8, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  } else if (b.kind === 'fire') {
    ctx.globalCompositeOperation = 'lighter';
    const r = b.r * 2.8;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, 'rgba(255,255,220,0.95)');
    g.addColorStop(0.25, 'rgba(255,210,90,0.85)');
    g.addColorStop(0.55, 'rgba(255,110,30,0.55)');
    g.addColorStop(1, 'rgba(255,50,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    // flame tail
    const ang = Math.atan2(-b.vy, -b.vx);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(255,150,50,0.45)';
    ctx.beginPath();
    ctx.moveTo(-b.r * 0.8, -b.r);
    ctx.quadraticCurveTo(b.r * 2.2, 0, -b.r * 0.8, b.r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,250,220,0.9)';
    ctx.beginPath();
    ctx.arc(0, 0, b.r * 0.45, 0, TAU);
    ctx.fill();
  } else if (b.kind === 'laser') {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,60,70,0.9)';
    ctx.beginPath();
    ctx.arc(0, 0, b.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,190,190,0.9)';
    ctx.beginPath();
    ctx.arc(0, 0, b.r * 0.4, 0, TAU);
    ctx.fill();
  } else if (b.kind === 'shard') {
    ctx.globalCompositeOperation = 'lighter';
    ctx.rotate(t * 8);
    ctx.fillStyle = '#ff8a4a';
    ctx.beginPath();
    ctx.moveTo(0, -b.r * 1.6);
    ctx.lineTo(b.r, 0);
    ctx.lineTo(0, b.r * 1.6);
    ctx.lineTo(-b.r, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    // plasma orb
    ctx.globalCompositeOperation = 'lighter';
    const r = b.r * 3;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.22, b.color || 'rgba(255,90,90,0.95)');
    g.addColorStop(0.6, 'rgba(255,60,90,0.28)');
    g.addColorStop(1, 'rgba(255,40,80,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,240,0.95)';
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1.3, b.r * 0.45), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function drawFriendly(ctx, b, t) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 13);
  g.addColorStop(0, 'rgba(180,255,255,0.85)');
  g.addColorStop(0.35, 'rgba(70,230,255,0.45)');
  g.addColorStop(1, 'rgba(40,150,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f2ffff';
  roundedRect(ctx, -2, -8, 4, 17, 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(90,240,255,0.9)';
  roundedRect(ctx, -1.1, -6, 2.2, 12, 1.1);
  ctx.fill();
  ctx.restore();
}

export function drawPickup(ctx, p, t) {
  const colors = {
    power: '#5cf3ff',
    bomb: '#ffb04a',
    heart: '#ff5b78',
  };
  const letters = { power: 'P', bomb: 'B', heart: '♥' };
  const bob = Math.sin(t * 3 + p.seed) * 3;
  ctx.save();
  ctx.translate(p.x, p.y + bob);
  ctx.globalCompositeOperation = 'lighter';
  const c = colors[p.type];
  ctx.fillStyle = c;
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.translate(0, 0);
  ctx.rotate(Math.sin(t * 2 + p.seed) * 0.14);
  ctx.fillStyle = 'rgba(6,14,26,0.9)';
  ctx.strokeStyle = c;
  ctx.lineWidth = 1.6;
  roundedRect(ctx, -12, -12, 24, 24, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = c;
  ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letters[p.type], 0, 1);
  ctx.restore();
}

export function drawParticle(ctx, p) {
  const a = clamp(p.life / p.maxLife, 0, 1);
  if (p.type === 'smoke') {
    ctx.globalAlpha = a * 0.35;
    const r = p.size * (1.8 - a * 0.8);
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, p.color || 'rgba(160,170,190,0.65)');
    g.addColorStop(1, 'rgba(100,110,130,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fill();
  } else if (p.type === 'ring') {
    ctx.globalAlpha = a * 0.8;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = Math.max(0.8, p.size * a * 0.35);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (1 - a) * 3.4 + p.size * 0.25, 0, TAU);
    ctx.stroke();
  } else if (p.type === 'spark') {
    ctx.globalAlpha = a;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = p.color;
    ctx.lineWidth = p.size * 0.5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
    ctx.stroke();
  } else if (p.type === 'debris') {
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
  } else if (p.type === 'flame') {
    ctx.globalAlpha = a * 0.85;
    ctx.globalCompositeOperation = 'lighter';
    const r = p.size * (0.6 + a);
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, p.color || 'rgba(255,240,190,0.9)');
    g.addColorStop(1, 'rgba(255,70,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fill();
  } else {
    ctx.globalAlpha = a;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// ---------------------------------------------------------------- bosses
export function drawDragon(ctx, b, t) {
  const s = b.scale || 1;
  const flap = Math.sin(t * 2.3) * 0.12;
  const bob = Math.sin(t * 1.2) * 5;
  const charging = b.action && (b.action.name === 'breath') && b.action.stage === 'charge';
  const breathing = b.action && (b.action.name === 'breath') && b.action.stage === 'fire';
  const jawOpen = breathing ? 1 : charging ? 0.5 + Math.sin(t * 12) * 0.12 : 0.22;
  ctx.save();
  ctx.translate(b.x, b.y + bob * s);
  ctx.scale(s, s);
  if (b.flash > 0) ctx.filter = `brightness(${1 + b.flash * 1.6}) saturate(${1 - b.flash * 0.4})`;

  // aura
  ctx.globalCompositeOperation = 'lighter';
  const ag = ctx.createRadialGradient(0, 10, 30, 0, 10, 175);
  ag.addColorStop(0, 'rgba(255,90,40,0.16)');
  ag.addColorStop(0.5, 'rgba(190,30,60,0.08)');
  ag.addColorStop(1, 'rgba(120,0,40,0)');
  ctx.fillStyle = ag;
  ctx.beginPath();
  ctx.arc(0, 10, 175, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // tail silhouette behind
  ctx.save();
  ctx.rotate(Math.sin(t * 1.5) * 0.05);
  ctx.fillStyle = '#2c0715';
  ctx.beginPath();
  ctx.moveTo(-18, -54);
  ctx.quadraticCurveTo(-70, -120, -26, -150);
  ctx.quadraticCurveTo(26, -150, 70, -118);
  ctx.quadraticCurveTo(20, -74, 18, -54);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(203,55,78,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // tail spikes
  ctx.fillStyle = '#591027';
  for (let i = 0; i < 4; i++) {
    const px = -30 + i * 20;
    const py = -120 + Math.abs(i - 1.5) * 8;
    ctx.beginPath();
    ctx.moveTo(px - 5, py);
    ctx.lineTo(px, py - 16);
    ctx.lineTo(px + 5, py);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // wings
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 16, -26);
    ctx.scale(side, 1);
    ctx.rotate(flap * 0.7);
    const wg = ctx.createLinearGradient(10, -50, 160, 60);
    wg.addColorStop(0, 'rgba(130,24,56,0.96)');
    wg.addColorStop(0.45, 'rgba(78,10,40,0.96)');
    wg.addColorStop(1, 'rgba(29,4,19,0.98)');
    ctx.fillStyle = wg;
    ctx.strokeStyle = 'rgba(214,62,92,0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.bezierCurveTo(55, -80, 128, -92, 172, -42 + flap * 26);
    ctx.bezierCurveTo(146, -8, 130, 24, 120, 62 + flap * 10);
    ctx.bezierCurveTo(98, 34, 76, 18, 58, 12);
    ctx.bezierCurveTo(36, 30, 20, 26, 4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // membrane lines
    ctx.strokeStyle = 'rgba(236,109,130,0.28)';
    ctx.lineWidth = 1.2;
    for (const [x, y] of [[118, -30], [96, 10], [60, -18]]) {
      ctx.beginPath();
      ctx.moveTo(8, -2);
      ctx.quadraticCurveTo(x * 0.6, y * 0.6, x, y);
      ctx.stroke();
    }
    // wing claw
    ctx.fillStyle = '#e7c7a6';
    ctx.beginPath();
    ctx.moveTo(170, -42 + flap * 26);
    ctx.lineTo(184, -53 + flap * 26);
    ctx.lineTo(174, -34 + flap * 26);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // body
  const bodyG = ctx.createRadialGradient(-12, -22, 4, 0, 0, 76);
  bodyG.addColorStop(0, '#a32644');
  bodyG.addColorStop(0.55, '#63102d');
  bodyG.addColorStop(1, '#260511');
  ctx.fillStyle = bodyG;
  ctx.beginPath();
  ctx.ellipse(0, -6, 46, 62, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(219,79,102,0.4)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // belly plates
  ctx.save();
  ctx.globalAlpha = 0.8;
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(255,139,74,0.22)' : 'rgba(255,180,90,0.32)';
    ctx.beginPath();
    ctx.ellipse(0, 4 + i * 12, 26 - i * 3.5, 5.5, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // neck spikes
  ctx.fillStyle = '#4a0a24';
  for (let i = 0; i < 4; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const y = -32 + Math.floor(i / 2) * 15;
    ctx.beginPath();
    ctx.moveTo(side * 40, y);
    ctx.lineTo(side * 55, y - 9);
    ctx.lineTo(side * 42, y + 5);
    ctx.closePath();
    ctx.fill();
  }

  // chest / shoulders (visible below the head)
  const chestG = ctx.createRadialGradient(-8, 26, 4, 0, 38, 62);
  chestG.addColorStop(0, '#a02a45');
  chestG.addColorStop(0.55, '#6b1230');
  chestG.addColorStop(1, '#2b0714');
  ctx.fillStyle = chestG;
  ctx.beginPath();
  ctx.ellipse(0, 38, 36, 34, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(219,79,102,0.35)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // lower belly plates
  ctx.save();
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(255,139,74,0.18)' : 'rgba(255,180,90,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 44 + i * 10, 22 - i * 4, 4.5, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // head
  const headG = ctx.createLinearGradient(0, -64, 0, 54);
  headG.addColorStop(0, '#b2324c');
  headG.addColorStop(0.45, '#7d1633');
  headG.addColorStop(1, '#330a19');
  ctx.fillStyle = headG;
  ctx.strokeStyle = 'rgba(255,131,131,0.5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, -62);
  ctx.bezierCurveTo(28, -62, 45, -48, 48, -20);
  ctx.bezierCurveTo(52, 12, 36, 38, 23, 43);
  ctx.bezierCurveTo(8, 50, -8, 50, -23, 43);
  ctx.bezierCurveTo(-36, 38, -52, 12, -48, -20);
  ctx.bezierCurveTo(-45, -48, -28, -62, 0, -62);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // forehead plate
  const fg = ctx.createLinearGradient(0, -60, 0, -6);
  fg.addColorStop(0, 'rgba(230,95,105,0.55)');
  fg.addColorStop(1, 'rgba(84,9,31,0.1)');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(0, -58);
  ctx.quadraticCurveTo(24, -52, 26, -16);
  ctx.quadraticCurveTo(13, 8, 0, 12);
  ctx.quadraticCurveTo(-13, 8, -26, -16);
  ctx.quadraticCurveTo(-24, -52, 0, -58);
  ctx.closePath();
  ctx.fill();

  // horns
  for (const side of [-1, 1]) {
    const hg = ctx.createLinearGradient(side * 30, -50, side * 70, -114);
    hg.addColorStop(0, '#c7a684');
    hg.addColorStop(0.5, '#f1ddc0');
    hg.addColorStop(1, '#8f6b4f');
    ctx.fillStyle = hg;
    ctx.strokeStyle = 'rgba(60,35,20,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(side * 26, -52);
    ctx.quadraticCurveTo(side * 58, -84, side * 48, -122);
    ctx.quadraticCurveTo(side * 62, -96, side * 40, -48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // smaller horn
    ctx.fillStyle = '#dcbf9c';
    ctx.beginPath();
    ctx.moveTo(side * 40, -30);
    ctx.quadraticCurveTo(side * 65, -46, side * 62, -68);
    ctx.quadraticCurveTo(side * 56, -44, side * 34, -24);
    ctx.closePath();
    ctx.fill();
  }

  // brow
  ctx.fillStyle = '#4a0a21';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 8, -30);
    ctx.lineTo(side * 39, -35);
    ctx.lineTo(side * 34, -20);
    ctx.lineTo(side * 10, -18);
    ctx.closePath();
    ctx.fill();
  }

  // eyes
  ctx.globalCompositeOperation = 'lighter';
  for (const side of [-1, 1]) {
    const eg = ctx.createRadialGradient(side * 22, -14, 0, side * 22, -14, 19);
    eg.addColorStop(0, 'rgba(255,255,200,0.95)');
    eg.addColorStop(0.25, 'rgba(255,220,80,0.9)');
    eg.addColorStop(0.6, 'rgba(255,100,20,0.28)');
    eg.addColorStop(1, 'rgba(255,60,10,0)');
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.arc(side * 22, -14, 19, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff7b0';
    ctx.beginPath();
    ctx.ellipse(side * 22, -14, 5.4, 4.2, side * 0.24, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1a0508';
    ctx.beginPath();
    ctx.ellipse(side * 22, -14, 1.7, 4, 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  // sharp brow shadows over the eyes
  ctx.fillStyle = 'rgba(24,2,8,0.72)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 6, -22);
    ctx.lineTo(side * 38, -27);
    ctx.lineTo(side * 33, -17);
    ctx.lineTo(side * 9, -16);
    ctx.closePath();
    ctx.fill();
  }

  // scales / cheek plates
  ctx.fillStyle = 'rgba(45,6,18,0.65)';
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(side * (33 + i * 2), 6 + i * 9, 5 - i * 0.8, 2.6, side * 0.4, 0, TAU);
      ctx.fill();
    }
  }

  // mouth
  const mouthY = 31;
  ctx.fillStyle = '#1a0308';
  ctx.beginPath();
  ctx.ellipse(0, mouthY + 4, 21, 9 + jawOpen * 9, 0, 0, TAU);
  ctx.fill();
  // lower jaw first
  ctx.fillStyle = '#5a0d24';
  ctx.beginPath();
  ctx.moveTo(-22, mouthY + 7);
  ctx.quadraticCurveTo(0, mouthY + 24 + jawOpen * 18, 22, mouthY + 7);
  ctx.quadraticCurveTo(0, mouthY + 15 + jawOpen * 12, -22, mouthY + 7);
  ctx.closePath();
  ctx.fill();
  // upper teeth
  ctx.fillStyle = '#f2e2c9';
  for (let i = -2; i <= 2; i++) {
    const x = i * 8;
    const len = 4.5 + (2 - Math.abs(i)) * 1.8;
    ctx.beginPath();
    ctx.moveTo(x - 2.4, mouthY - 3);
    ctx.lineTo(x + 2.4, mouthY - 3);
    ctx.lineTo(x, mouthY - 3 + len);
    ctx.closePath();
    ctx.fill();
  }
  // lower fangs
  ctx.fillStyle = '#e8d2b4';
  for (let i = -1; i <= 1; i++) {
    const x = i * 11;
    ctx.beginPath();
    ctx.moveTo(x - 2, mouthY + 15 + jawOpen * 8);
    ctx.lineTo(x + 2, mouthY + 15 + jawOpen * 8);
    ctx.lineTo(x, mouthY + 8 + jawOpen * 8);
    ctx.closePath();
    ctx.fill();
  }

  // inner fire glow
  const glowAmt = breathing ? 1 : charging ? 0.7 + Math.sin(t * 18) * 0.2 : 0.32;
  ctx.globalCompositeOperation = 'lighter';
  const mg = ctx.createRadialGradient(0, mouthY + 2, 1, 0, mouthY + 2, 30 + jawOpen * 20);
  mg.addColorStop(0, `rgba(255,250,205,${0.95 * glowAmt})`);
  mg.addColorStop(0.3, `rgba(255,190,70,${0.8 * glowAmt})`);
  mg.addColorStop(0.7, `rgba(255,90,20,${0.3 * glowAmt})`);
  mg.addColorStop(1, 'rgba(255,40,10,0)');
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.arc(0, mouthY + 2, 30 + jawOpen * 20, 0, TAU);
  ctx.fill();

  // nostrils
  ctx.fillStyle = `rgba(255,180,70,${0.55 + glowAmt * 0.4})`;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 7, 17, 1.6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // charge telegraph particles are in game.js
}

export function drawRobot(ctx, b, t) {
  const s = b.scale || 1;
  const hover = Math.sin(t * 1.6) * 5;
  const flash = b.flash || 0;
  const phase2 = b.phase >= 2;
  ctx.save();
  ctx.translate(b.x, b.y + hover * s);
  ctx.scale(s, s);
  if (flash > 0) ctx.filter = `brightness(${1 + flash * 1.6}) saturate(${1 - flash * 0.2})`;

  // aura
  ctx.globalCompositeOperation = 'lighter';
  const ag = ctx.createRadialGradient(0, 0, 30, 0, 0, 175);
  ag.addColorStop(0, phase2 ? 'rgba(255,70,40,0.15)' : 'rgba(70,190,255,0.1)');
  ag.addColorStop(0.55, 'rgba(120,30,80,0.06)');
  ag.addColorStop(1, 'rgba(30,10,40,0)');
  ctx.fillStyle = ag;
  ctx.beginPath();
  ctx.arc(0, 0, 175, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // thruster flame
  ctx.globalCompositeOperation = 'lighter';
  for (const x of [-40, 40]) {
    const fl = 0.8 + Math.sin(t * 24 + x) * 0.2;
    const fg = ctx.createLinearGradient(0, 78, 0, 140);
    fg.addColorStop(0, 'rgba(220,250,255,0.9)');
    fg.addColorStop(0.25, 'rgba(90,210,255,0.8)');
    fg.addColorStop(0.65, 'rgba(255,130,60,0.35)');
    fg.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(x - 12, 80);
    ctx.quadraticCurveTo(x - 5, 112 + fl * 20, x, 134 + fl * 22);
    ctx.quadraticCurveTo(x + 5, 112 + fl * 20, x + 12, 80);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  // legs
  ctx.fillStyle = '#20313f';
  ctx.strokeStyle = 'rgba(140,215,240,0.4)';
  ctx.lineWidth = 1.3;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 24, 50);
    ctx.lineTo(side * 44, 72);
    ctx.lineTo(side * 52, 104);
    ctx.lineTo(side * 30, 104);
    ctx.lineTo(side * 18, 68);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // foot thruster
    ctx.fillStyle = '#263746';
    roundedRect(ctx, side * 38 - 9, 98, 18, 12, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,120,60,0.65)';
    ctx.fillRect(side * 38 - 4, 108, 8, 3);
    ctx.fillStyle = '#111b26';
  }

  // arms + cannons
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#2b4054';
    ctx.strokeStyle = 'rgba(140,215,240,0.42)';
    ctx.beginPath();
    ctx.moveTo(side * 64, -30);
    ctx.lineTo(side * 96, -4);
    ctx.lineTo(side * 92, 48);
    ctx.lineTo(side * 66, 40);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // cannon housing
    ctx.fillStyle = '#3d5468';
    roundedRect(ctx, side * 82 - 11, 34, 22, 30, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,150,80,0.3)';
    ctx.stroke();
    // barrels
    ctx.fillStyle = '#0a1118';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(side * 82 - 6 + i * 5, 60, 3, 18);
    }
    // arm warning light
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = phase2 ? '#ff5b3a' : '#ffb35b';
    ctx.beginPath();
    ctx.arc(side * 88, 44, 2.1, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  // shoulder pods
  for (const side of [-1, 1]) {
    const podX = side * 102;
    const podY = -34;
    ctx.save();
    ctx.translate(podX, podY);
    ctx.rotate(side * 0.12);
    const pg = ctx.createLinearGradient(-26, -24, 26, 24);
    pg.addColorStop(0, '#6c8196');
    pg.addColorStop(0.45, '#33495d');
    pg.addColorStop(1, '#111e2a');
    ctx.fillStyle = pg;
    ctx.strokeStyle = 'rgba(150,200,225,0.3)';
    ctx.lineWidth = 1.3;
    roundedRect(ctx, -27, -24, 54, 46, 9);
    ctx.fill();
    ctx.stroke();
    // tubes
    for (let i = 0; i < 3; i++) {
      const tx = -14 + i * 14;
      ctx.fillStyle = '#05090e';
      ctx.beginPath();
      ctx.arc(tx, 8, 5.5, 0, TAU);
      ctx.fill();
      const glow = b.rocketFlash > 0 ? 0.9 : 0.35 + 0.2 * Math.sin(t * 4 + i);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,110,55,${glow})`;
      ctx.beginPath();
      ctx.arc(tx, 8, b.rocketFlash > 0 ? 4.2 : 1.7, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    // pod stripe
    ctx.fillStyle = phase2 ? 'rgba(255,77,52,0.8)' : 'rgba(255,170,70,0.5)';
    ctx.fillRect(-22, -17, 44, 2.4);
    ctx.restore();
  }

  // torso
  const tg = ctx.createLinearGradient(-70, -60, 70, 60);
  tg.addColorStop(0, '#667e93');
  tg.addColorStop(0.35, '#354a5d');
  tg.addColorStop(0.7, '#1a2836');
  tg.addColorStop(1, '#0a131c');
  ctx.fillStyle = tg;
  ctx.strokeStyle = 'rgba(150,205,230,0.35)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-38, -62);
  ctx.lineTo(38, -62);
  ctx.lineTo(66, -26);
  ctx.lineTo(56, 34);
  ctx.lineTo(28, 64);
  ctx.lineTo(-28, 64);
  ctx.lineTo(-56, 34);
  ctx.lineTo(-66, -26);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // rim light
  ctx.save();
  ctx.strokeStyle = 'rgba(130,230,255,0.22)';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(-38, -56);
  ctx.lineTo(-62, -24);
  ctx.lineTo(-50, 30);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,145,90,0.2)';
  ctx.beginPath();
  ctx.moveTo(38, -56);
  ctx.lineTo(62, -24);
  ctx.lineTo(50, 30);
  ctx.stroke();
  ctx.restore();

  // armor panels
  ctx.fillStyle = 'rgba(86,112,133,0.32)';
  ctx.beginPath();
  ctx.moveTo(-38, -56);
  ctx.lineTo(0, -50);
  ctx.lineTo(0, 20);
  ctx.lineTo(-30, 48);
  ctx.lineTo(-48, 22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.moveTo(38, -56);
  ctx.lineTo(0, -50);
  ctx.lineTo(0, 20);
  ctx.lineTo(30, 48);
  ctx.lineTo(48, 22);
  ctx.closePath();
  ctx.fill();

  // chest vents
  ctx.fillStyle = '#050a0f';
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(side * (14 + i * 9) - 3, 30, 5, 16);
    }
  }

  // armour accent strips
  ctx.fillStyle = 'rgba(255,170,90,0.62)';
  for (const side of [-1, 1]) {
    ctx.fillRect(side * 46 - 2, -8, 3, 20);
    ctx.fillRect(side * 46 - 2, 16, 3, 6);
  }
  ctx.fillStyle = 'rgba(120,232,255,0.3)';
  for (const side of [-1, 1]) {
    ctx.fillRect(side * 30 - 6, 56, 12, 2);
  }

  // reactor core
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const coreR = 23 + (phase2 ? Math.sin(t * 6) * 2.5 : Math.sin(t * 3) * 1.5);
  const cg = ctx.createRadialGradient(0, 5, 1, 0, 5, coreR * 1.7);
  cg.addColorStop(0, 'rgba(255,255,235,1)');
  cg.addColorStop(0.22, phase2 ? 'rgba(255,120,60,0.95)' : 'rgba(120,235,255,0.95)');
  cg.addColorStop(0.55, phase2 ? 'rgba(255,50,30,0.4)' : 'rgba(40,160,255,0.32)');
  cg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(0, 5, coreR * 1.7, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = phase2 ? 'rgba(255,180,120,0.8)' : 'rgba(180,245,255,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 5, 17, 0, TAU);
  ctx.stroke();
  ctx.rotate(t * (phase2 ? 2 : 1));
  ctx.setLineDash([5, 9]);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.arc(0, 5, 23, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // head
  ctx.fillStyle = '#3a5267';
  ctx.strokeStyle = 'rgba(160,230,255,0.5)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-36, -58);
  ctx.lineTo(-28, -92);
  ctx.lineTo(0, -100);
  ctx.lineTo(28, -92);
  ctx.lineTo(36, -58);
  ctx.lineTo(20, -44);
  ctx.lineTo(-20, -44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // visor
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const vg = ctx.createLinearGradient(-30, -80, 30, -62);
  vg.addColorStop(0, 'rgba(255,40,60,0.2)');
  vg.addColorStop(0.5, 'rgba(255,70,70,1)');
  vg.addColorStop(1, 'rgba(255,160,80,0.3)');
  ctx.fillStyle = vg;
  roundedRect(ctx, -29, -80, 58, 10, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,235,230,0.95)';
  roundedRect(ctx, -20, -77, 40, 3, 1.5);
  ctx.fill();
  ctx.restore();
  // antenna
  ctx.strokeStyle = '#485e70';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -98);
  ctx.lineTo(0, -122);
  ctx.stroke();
  ctx.fillStyle = '#ff5440';
  ctx.beginPath();
  ctx.arc(0, -124, 3, 0, TAU);
  ctx.fill();

  // shoulder warning stripes
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#ffc46a';
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 55, -48);
    ctx.rotate(side * 0.6);
    for (let i = 0; i < 4; i++) ctx.fillRect(i * 6, 0, 3, 9);
    ctx.restore();
  }
  ctx.restore();

  // small details / rivets
  ctx.fillStyle = 'rgba(180,220,240,0.35)';
  for (const [x, y] of [[-49, -20], [49, -20], [-34, 50], [34, 50]]) {
    ctx.beginPath();
    ctx.arc(x, y, 1.2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function drawFlameBeam(ctx, ox, oy, angle, len, width, t) {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(angle);
  ctx.globalCompositeOperation = 'lighter';
  const wob = Math.sin(t * 30) * 0.06;
  const grad = ctx.createLinearGradient(0, 0, len, 0);
  grad.addColorStop(0, 'rgba(255,255,220,0.95)');
  grad.addColorStop(0.1, 'rgba(255,230,130,0.9)');
  grad.addColorStop(0.45, 'rgba(255,150,50,0.72)');
  grad.addColorStop(0.8, 'rgba(255,80,25,0.35)');
  grad.addColorStop(1, 'rgba(255,50,10,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -width * 0.45);
  ctx.quadraticCurveTo(len * 0.4, -width * (0.8 + wob), len, -width * 0.2);
  ctx.quadraticCurveTo(len * 0.45, 0, len, width * 0.2);
  ctx.quadraticCurveTo(len * 0.4, width * (0.8 - wob), 0, width * 0.45);
  ctx.closePath();
  ctx.fill();
  // hot core
  ctx.strokeStyle = 'rgba(255,255,230,0.8)';
  ctx.lineWidth = width * 0.35;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, wob * len, len * 0.98, 0);
  ctx.stroke();
  // blobs
  const n = 11;
  for (let i = 0; i < n; i++) {
    const p = (i / n + (t * 0.35) % (1 / n)) % 1;
    const x = p * len;
    const r = width * (0.3 + 0.34 * Math.sin(p * Math.PI)) * (0.8 + Math.random() * 0.35);
    ctx.fillStyle = 'rgba(255,200,90,0.22)';
    ctx.beginPath();
    ctx.arc(x, Math.sin(t * 20 + i) * width * 0.2, r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function drawLaserBeam(ctx, ox, oy, angle, len, width, t) {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(angle);
  ctx.globalCompositeOperation = 'lighter';
  // outer glow
  ctx.strokeStyle = 'rgba(255,30,50,0.2)';
  ctx.lineWidth = width * 3.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len, 0);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,70,70,0.7)';
  ctx.lineWidth = width * 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len, 0);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,245,245,0.95)';
  ctx.lineWidth = width * 0.55;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len, 0);
  ctx.stroke();
  // pulses
  for (let i = 0; i < 6; i++) {
    const p = (i / 6 + (t * 0.9) % (1 / 6)) % 1;
    ctx.fillStyle = 'rgba(255,200,190,0.75)';
    ctx.beginPath();
    ctx.arc(p * len, 0, width * 0.45, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function drawBossDeath(ctx, b, t) {
  if (b.kind === 'dragon') drawDragon(ctx, b, t);
  else drawRobot(ctx, b, t);
}

export { roundedRect };
