import { AudioEngine } from './audio.js';
import * as R from './render.js';

const H = 800;
const clamp = R.clamp;
const lerp = R.lerp;
const rand = R.rand;
const TAU = R.TAU;
const BOSS_AT = 21.5;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audio = new AudioEngine();
    this.state = 'menu';
    this.stage = 1;
    this.time = 0;
    this.totalTime = 0;
    this.last = 0;
    this.stateData = null;
    this.onState = null;
    this.onHud = null;

    this.W = 450;
    this.scale = 1;
    this.ox = 0;
    this.oy = 0;
    this.dpr = 1;
    this.cssW = 0;
    this.cssH = 0;
    this.safeTop = 0;
    this.safeBottom = 0;
    this.safeRight = 0;

    this.best = this.loadBest();
    this.debugInvincible = false;

    this.keys = new Set();
    this.drag = null;
    this.bombLock = 0;
    this.hudSig = '';
    this.lastRocketSound = 0;
    this.menuT = 0;

    this.player = this.makePlayer();
    this.resetWorld();
    this.backdrop = R.createBackdrop(this.W, H, 1);

    this.resize();
    this.bindInput();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  loadBest() {
    try {
      return Number(localStorage.getItem('naga_titan_best') || 0) || 0;
    } catch {
      return 0;
    }
  }

  saveBest() {
    if (this.score > this.best) {
      this.best = this.score;
      try {
        localStorage.setItem('naga_titan_best', String(this.best));
      } catch {
        /* storage unavailable */
      }
    }
  }

  makePlayer() {
    return {
      x: this.W / 2,
      y: H - 130,
      px: this.W / 2,
      py: H - 130,
      targetX: this.W / 2,
      targetY: H - 130,
      tilt: 0,
      r: 6,
      lives: 3,
      bombs: 3,
      power: 1,
      fireT: 0,
      invuln: 2.4,
      dead: false,
      deathT: 0,
      scale: clamp(this.W / 450, 0.84, 1.1),
    };
  }

  resetWorld() {
    this.enemies = [];
    this.friendly = [];
    this.hostiles = [];
    this.particles = [];
    this.pickups = [];
    this.floats = [];
    this.rainWarnings = [];
    this.boss = null;
    this.banner = null;
    this.warning = null;
    this.stageTime = 0;
    this.waveIndex = 0;
    this.clearTimer = 0;
    this.deathTimer = 0;
    this.shake = 0;
    this.flash = 0;
    this.damageFlash = 0;
    this.combo = 0;
    this.comboT = 0;
    this.score = 0;
    this.bossDefeatedFlag = false;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.cssW = rect.width || window.innerWidth;
    this.cssH = rect.height || window.innerHeight;
    this.W = clamp((H * this.cssW) / this.cssH, 360, 760);
    this.scale = Math.min(this.cssW / this.W, this.cssH / H);
    this.ox = (this.cssW - this.W * this.scale) / 2;
    this.oy = (this.cssH - H * this.scale) / 2;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    try {
      const cs = getComputedStyle(document.documentElement);
      this.safeTop = parseFloat(cs.getPropertyValue('--safe-top')) || 0;
      this.safeBottom = parseFloat(cs.getPropertyValue('--safe-bottom')) || 0;
      this.safeRight = parseFloat(cs.getPropertyValue('--safe-right')) || 0;
    } catch {
      this.safeTop = 0;
      this.safeBottom = 0;
      this.safeRight = 0;
    }
    if (this.player) {
      this.player.scale = clamp(this.W / 450, 0.84, 1.1);
      this.player.x = clamp(this.player.x, 24, this.W - 24);
      this.player.y = clamp(this.player.y, 80, H - 34);
      this.player.targetX = clamp(this.player.targetX, 24, this.W - 24);
      this.player.targetY = clamp(this.player.targetY, 80, H - 34);
    }
    if (this.backdrop) {
      this.backdrop = R.createBackdrop(this.W, H, this.backdrop.stage || this.stage);
    }
  }

  // ------------------------------------------------------------- input
  bindInput() {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      if (this.state !== 'playing') return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.audio.init();
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      if (c.setPointerCapture) c.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.drag || e.pointerId !== this.drag.id || this.state !== 'playing') return;
      const p = this.player;
      const dx = (e.clientX - this.drag.x) / this.scale;
      const dy = (e.clientY - this.drag.y) / this.scale;
      p.targetX = clamp(p.targetX + dx * 1.18, 24, this.W - 24);
      p.targetY = clamp(p.targetY + dy * 1.18, 80, H - 34);
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
      e.preventDefault();
    });
    const endDrag = (e) => {
      if (this.drag && e.pointerId === this.drag.id) this.drag = null;
    };
    c.addEventListener('pointerup', endDrag);
    c.addEventListener('pointercancel', endDrag);
    c.addEventListener('lostpointercapture', () => {
      this.drag = null;
    });

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].includes(k)) {
        if (this.state === 'playing') e.preventDefault();
      }
      this.keys.add(k);
      if (this.state === 'playing' && (k === ' ' || k === 'b') && !e.repeat) this.useBomb();
      if ((k === 'p' || k === 'escape') && !e.repeat) this.togglePause();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.drag = null;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.togglePause();
    });
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 140));
  }

  loop(ts) {
    if (!this.last) this.last = ts;
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    dt = Math.min(dt, 0.034);
    if (this.state !== 'paused') this.update(dt);
    this.draw();
    requestAnimationFrame(this.loop);
  }

  // ------------------------------------------------------------- states
  emitState() {
    this.stateData = {
      score: this.score,
      best: this.best,
      stage: this.stage,
      time: this.totalTime,
    };
    if (this.onState) this.onState(this.state, this.stateData);
  }

  emitHud() {
    if (!this.player) return;
    const sig = `${this.player.bombs}|${this.player.power}|${this.player.lives}|${this.state}`;
    if (sig === this.hudSig) return;
    this.hudSig = sig;
    if (this.onHud) {
      this.onHud({
        bombs: this.player.bombs,
        power: this.player.power,
        lives: this.player.lives,
        state: this.state,
      });
    }
  }

  openMenu() {
    this.audio.stopMusic();
    this.debugInvincible = false;
    this.state = 'menu';
    this.stage = 1;
    this.score = 0;
    this.totalTime = 0;
    this.player = this.makePlayer();
    this.resetWorld();
    this.backdrop = R.createBackdrop(this.W, H, 1);
    this.emitHud();
    this.emitState();
  }

  startGame() {
    this.audio.init();
    this.debugInvincible = false;
    this.state = 'playing';
    this.score = 0;
    this.totalTime = 0;
    this.player = this.makePlayer();
    this.resetWorld();
    this.hudSig = '';
    this.startStage(1);
    this.emitHud();
    this.emitState();
  }

  startStage(n) {
    this.stage = n;
    this.stageTime = 0;
    this.waveIndex = 0;
    this.enemies = [];
    this.hostiles = [];
    this.friendly = [];
    this.pickups = [];
    this.rainWarnings = [];
    this.boss = null;
    this.warning = null;
    this.clearTimer = 0;
    this.bossDefeatedFlag = false;
    this.player.dead = false;
    this.player.deathT = 0;
    this.player.invuln = 3;
    this.player.x = this.W / 2;
    this.player.y = H - 120;
    this.player.targetX = this.player.x;
    this.player.targetY = this.player.y;
    this.backdrop = R.createBackdrop(this.W, H, n);
    this.banner = {
      kind: 'stage',
      t: 0,
      dur: 3.0,
      title: `STAGE ${n}`,
      sub: n === 1 ? 'LANGIT SENJA  ·  BOS: NAGA MERAH' : 'KOTA BAJA  ·  BOS: TITAN-9',
      color: n === 1 ? '#ffd08a' : '#8ff2ff',
    };
    this.waves = this.stageWaves(n);
    this.audio.startMusic(n);
    this.emitHud();
  }

  stageWaves(stage) {
    if (stage === 1) {
      return [
        { t: 0.8, f: () => this.spawnImps(5) },
        { t: 3.3, f: () => this.spawnImps(5) },
        { t: 5.9, f: () => this.spawnDivers(3) },
        { t: 8.5, f: () => this.spawnImps(6) },
        {
          t: 11.4,
          f: () => {
            this.spawnGunship(this.W * 0.32);
            this.spawnGunship(this.W * 0.68);
          },
        },
        { t: 14.7, f: () => this.spawnDivers(4) },
        { t: 17.2, f: () => this.spawnImps(7) },
        { t: 19.4, f: () => this.spawnDivers(2) },
      ];
    }
    return [
      { t: 0.8, f: () => this.spawnDrones(4) },
      {
        t: 3.3,
        f: () => {
          this.spawnTurret(this.W * 0.35);
          this.spawnTurret(this.W * 0.65);
        },
      },
      { t: 5.9, f: () => this.spawnDrones(6) },
      {
        t: 8.4,
        f: () => {
          this.spawnGunship(this.W * 0.28);
          this.spawnGunship(this.W * 0.72);
        },
      },
      {
        t: 11.5,
        f: () => {
          this.spawnTurret(this.W * 0.22);
          this.spawnTurret(this.W * 0.5);
          this.spawnTurret(this.W * 0.78);
        },
      },
      {
        t: 14.5,
        f: () => {
          this.spawnDrones(5);
          this.spawnDivers(2);
        },
      },
      {
        t: 17.4,
        f: () => {
          this.spawnTurret(this.W * 0.38);
          this.spawnTurret(this.W * 0.62);
        },
      },
      { t: 19.6, f: () => this.spawnDivers(4) },
    ];
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.drag = null;
      this.keys.clear();
      this.audio.pauseMusic(true);
      this.emitState();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.audio.pauseMusic(false);
      this.emitState();
    }
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.audio.pauseMusic(false);
    this.emitState();
  }

  gameOver() {
    this.state = 'gameover';
    this.saveBest();
    this.audio.stopMusic();
    this.audio.playerHit();
    this.emitState();
    this.emitHud();
  }

  victory() {
    this.state = 'victory';
    this.saveBest();
    this.audio.stopMusic();
    this.audio.victory();
    this.emitState();
    this.emitHud();
  }

  // ------------------------------------------------------------- spawning
  spawnImps(n) {
    const margin = 44;
    for (let i = 0; i < n; i++) {
      const x = margin + ((i + 0.5) * (this.W - margin * 2)) / n;
      this.enemies.push({
        type: 'imp',
        x,
        baseX: x,
        y: -46 - Math.abs(i - (n - 1) / 2) * 24,
        t: 0,
        seed: rand(0, TAU),
        speed: rand(72, 100),
        drift: rand(24, 46),
        hp: 20,
        maxHp: 20,
        r: 16,
        size: clamp(this.W / 460, 0.82, 1.06),
        fireT: rand(0.9, 1.9),
        score: 100,
        dead: false,
      });
    }
  }

  spawnDivers(n) {
    for (let i = 0; i < n; i++) {
      const x = rand(40, this.W - 40);
      const y = -34 - i * 40;
      const angle = Math.atan2(this.player.y - y, this.player.x - x) + rand(-0.18, 0.18);
      const sp = rand(290, 360);
      this.enemies.push({
        type: 'diver',
        x,
        y,
        vx: Math.cos(angle) * sp,
        vy: Math.sin(angle) * sp,
        angle: angle - Math.PI / 2,
        t: 0,
        seed: rand(0, TAU),
        hp: 12,
        maxHp: 12,
        r: 14,
        size: clamp(this.W / 470, 0.8, 1.05),
        fireT: 9,
        score: 90,
        dead: false,
      });
    }
  }

  spawnDrones(n) {
    for (let i = 0; i < n; i++) {
      const x = 44 + ((i + 0.5) * (this.W - 88)) / n;
      this.enemies.push({
        type: 'drone',
        x,
        baseX: x,
        y: -40 - (i % 3) * 34,
        hoverY: 100 + (i % 3) * 54,
        t: 0,
        seed: rand(0, TAU),
        hp: 34,
        maxHp: 34,
        r: 18,
        size: clamp(this.W / 470, 0.82, 1.06),
        fireT: rand(1.0, 1.9),
        score: 160,
        dead: false,
      });
    }
  }

  spawnGunship(x) {
    this.enemies.push({
      type: 'gunship',
      x,
      baseX: x,
      y: -56,
      hoverY: 106,
      t: 0,
      seed: rand(0, TAU),
      hp: 82,
      maxHp: 82,
      r: 30,
      size: clamp(this.W / 460, 0.86, 1.08),
      fireT: 1.4,
      score: 380,
      dead: false,
    });
  }

  spawnTurret(x) {
    this.enemies.push({
      type: 'turret',
      x,
      baseX: x,
      y: -44,
      hoverY: 96,
      t: 0,
      seed: rand(0, TAU),
      hp: 58,
      maxHp: 58,
      r: 18,
      size: clamp(this.W / 460, 0.86, 1.06),
      fireT: rand(1.0, 1.8),
      score: 250,
      dead: false,
    });
  }

  spawnBoss(stage) {
    const dragon = stage === 1;
    const s = clamp(this.W / 560, 0.8, 1.05);
    const safe = this.safeTop / this.scale;
    this.boss = {
      kind: dragon ? 'dragon' : 'robot',
      name: dragon ? 'NAGA MERAH' : 'TITAN-9',
      title: dragon ? 'NAGA API PENJAGA LANGIT' : 'ROBOT PERANG PEMBAWA ROKET',
      x: this.W / 2,
      y: -240,
      baseY: (dragon ? 213 : 236) + safe,
      baseX: this.W / 2,
      scale: s,
      hp: dragon ? 2200 : 2850,
      maxHp: dragon ? 2200 : 2850,
      r: (dragon ? 58 : 68) * s,
      t: 0,
      flash: 0,
      rocketFlash: 0,
      phase: 1,
      mode: 'enter',
      action: null,
      attackTimer: 1.1,
      seq: 0,
      beam: null,
      dyingT: 0,
      rocketSfx: 0,
    };
    this.warning = null;
    this.audio.roar();
    this.shake = Math.max(this.shake, 9);
  }

  debugBoss(stage = 1, invincible = true) {
    this.audio.init();
    if (this.state !== 'playing') this.startGame();
    this.startStage(stage);
    this.debugInvincible = invincible;
    this.stageTime = 100;
    this.waves = [];
    this.enemies = [];
    this.spawnBoss(stage);
    this.boss.mode = 'fight';
    this.boss.y = this.boss.baseY;
    this.boss.t = 0;
    this.boss.attackTimer = 0.4;
    this.player.invuln = invincible ? 99999 : 2;
    this.banner = null;
    this.emitState();
  }

  debugAdvance(seconds, step = 1 / 60) {
    const count = Math.max(1, Math.round(seconds / step));
    for (let i = 0; i < count; i++) this.update(step);
    this.draw();
  }

  debugInvincibleOn(on) {
    this.debugInvincible = !!on;
    if (on) this.player.invuln = 99999;
  }

  // ------------------------------------------------------------- helpers
  aimAtPlayer(x, y, spread = 0) {
    return Math.atan2(this.player.y - y, this.player.x - x) + spread;
  }

  hostile(x, y, angle, speed, r, kind = 'orb', extra = {}) {
    this.hostiles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle,
      speed,
      r,
      kind,
      life: 6,
      age: 0,
      dead: false,
      ...extra,
    });
  }

  fireAimed(x, y, spread, speed, r, kind = 'orb') {
    const a = this.aimAtPlayer(x, y, spread);
    this.hostile(x, y, a, speed, r, kind);
    this.audio.enemyShoot();
  }

  spawnRocket(x, y, angle, opts = {}) {
    const speed = opts.speed || 130;
    this.hostiles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle,
      speed,
      maxSpeed: opts.maxSpeed || 260,
      r: opts.r || 9,
      kind: 'rocket',
      life: opts.life || 5.2,
      age: 0,
      dead: false,
      turn: opts.turn === undefined ? 1.05 : opts.turn,
      homeTime: opts.homeTime || 3.2,
      rain: !!opts.rain,
      frags: opts.frags === false ? 0 : 5,
      smokeT: 0,
    });
  }

  addScore(n) {
    this.combo++;
    this.comboT = 3.2;
    const mult = 1 + Math.min(5, Math.floor(this.combo / 6)) * 0.5;
    const pts = Math.round(n * mult);
    this.score += pts;
    return pts;
  }

  floatText(x, y, text, color = '#fff', size = 12) {
    this.floats.push({ x, y, text, color, size, life: 1.1, maxLife: 1.1 });
  }

  vibrate(ms) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch {
      /* haptics unavailable */
    }
  }

  // ------------------------------------------------------------- particles
  spark(x, y, n, color, speed = 180, size = 2) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(speed * 0.25, speed);
      this.particles.push({
        type: 'spark',
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.18, 0.5),
        maxLife: 0.5,
        size: rand(size * 0.6, size * 1.5),
        color,
      });
    }
  }

  smoke(x, y, size = 10, color = 'rgba(150,160,185,0.5)') {
    this.particles.push({
      type: 'smoke',
      x: x + rand(-4, 4),
      y: y + rand(-4, 4),
      vx: rand(-16, 16),
      vy: rand(4, 26),
      life: rand(0.5, 1.1),
      maxLife: 1.1,
      size,
      color,
    });
  }

  ring(x, y, size, color) {
    this.particles.push({
      type: 'ring',
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.45,
      maxLife: 0.45,
      size,
      color,
    });
  }

  explosion(x, y, scale = 1, color = 'rgba(255,170,80,0.9)') {
    const n = Math.round(15 * scale);
    this.spark(x, y, n, color, 250 * scale, 2.4);
    for (let i = 0; i < Math.round(4 * scale); i++) this.smoke(x, y, 9 * scale);
    this.ring(x, y, 26 * scale, 'rgba(255,190,120,0.8)');
    this.particles.push({
      type: 'flame',
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.34,
      maxLife: 0.34,
      size: 34 * scale,
      color: 'rgba(255,240,190,0.9)',
    });
    this.shake = Math.min(26, this.shake + 5 * scale);
    this.audio.explode(scale > 1.4 ? 1 : 0);
  }

  emitHudLater() {
    this.emitHud();
  }

  // ------------------------------------------------------------- update
  update(dt) {
    this.time += dt;
    R.updateBackdrop(this.backdrop, dt, this.W, H);
    this.updateParticles(dt);
    this.updateFloats(dt);
    this.updateEffects(dt);

    if (this.state === 'menu') {
      this.menuT += dt;
      return;
    }
    if (this.state === 'gameover' || this.state === 'victory') {
      if (this.state === 'victory' && Math.random() < dt * 0.8) {
        this.explosion(rand(40, this.W - 40), rand(120, H * 0.55), rand(0.5, 0.9), 'rgba(120,240,255,0.9)');
      }
      return;
    }
    if (this.state !== 'playing') return;

    this.totalTime += dt;
    this.updateStage(dt);
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updateFriendly(dt);
    this.updateHostiles(dt);
    this.updatePickups(dt);
    this.updateRainWarnings(dt);
    this.collide();
    this.checkPlayerState(dt);
    this.emitHud();
  }

  updateStage(dt) {
    if (!this.boss && !this.warning && !this.bossDefeatedFlag) {
      this.stageTime += dt;
      while (this.waveIndex < this.waves.length && this.stageTime >= this.waves[this.waveIndex].t) {
        this.waves[this.waveIndex].f();
        this.waveIndex++;
      }
      if (this.stageTime >= BOSS_AT) {
        this.warning = {
          t: 0,
          dur: 2.9,
          name: this.stage === 1 ? 'NAGA MERAH' : 'TITAN-9',
          sub: this.stage === 1 ? 'NAGA API PENJAGA LANGIT' : 'ROBOT PERANG PEMBAWA ROKET',
        };
        this.audio.warning();
        this.shake = Math.max(this.shake, 6);
      }
    }
    if (this.warning) {
      this.warning.t += dt;
      if (this.warning.t >= this.warning.dur) this.spawnBoss(this.stage);
    }
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t >= this.banner.dur) this.banner = null;
    }
    if (this.clearTimer > 0) {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) {
        if (this.stage === 1) {
          this.player.lives = Math.min(5, this.player.lives + 1);
          this.player.bombs = Math.min(5, this.player.bombs + 1);
          this.player.power = Math.min(4, this.player.power + 1);
          this.flash = 0.7;
          this.startStage(2);
        } else {
          this.victory();
        }
      }
    }
  }

  updatePlayer(dt) {
    const p = this.player;
    if (p.dead) return;
    const keys = this.keys;
    let kx = 0;
    let ky = 0;
    if (keys.has('arrowleft') || keys.has('a')) kx -= 1;
    if (keys.has('arrowright') || keys.has('d')) kx += 1;
    if (keys.has('arrowup') || keys.has('w')) ky -= 1;
    if (keys.has('arrowdown') || keys.has('s')) ky += 1;
    if (kx || ky) {
      const len = Math.hypot(kx, ky) || 1;
      p.targetX += (kx / len) * 430 * dt;
      p.targetY += (ky / len) * 430 * dt;
    }
    p.targetX = clamp(p.targetX, 22, this.W - 22);
    p.targetY = clamp(p.targetY, 82, H - 34);
    p.px = p.x;
    p.py = p.y;
    const k = 1 - Math.exp(-22 * dt);
    p.x += (p.targetX - p.x) * k;
    p.y += (p.targetY - p.y) * k;
    const vx = (p.x - p.px) / Math.max(dt, 0.001);
    const targetTilt = clamp(vx / 1600, -0.24, 0.24);
    p.tilt += (targetTilt - p.tilt) * Math.min(1, dt * 10);

    if (this.debugInvincible) p.invuln = 99999;
    else p.invuln = Math.max(0, p.invuln - dt);

    p.fireT -= dt;
    while (p.fireT <= 0) {
      p.fireT += 0.108;
      this.firePlayer();
    }

    if (Math.random() < 0.55) {
      this.particles.push({
        type: 'flame',
        x: p.x + rand(-7, 7),
        y: p.y + rand(18, 27),
        vx: rand(-8, 8),
        vy: rand(60, 110),
        life: rand(0.12, 0.26),
        maxLife: 0.26,
        size: rand(4, 8),
        color: 'rgba(110,235,255,0.8)',
      });
    }
  }

  firePlayer() {
    const p = this.player;
    const lv = Math.min(4, p.power);
    let shots;
    let dmg;
    if (lv === 1) {
      shots = [[0, 0]];
      dmg = 14;
    } else if (lv === 2) {
      shots = [[-7, 0], [7, 0]];
      dmg = 11;
    } else if (lv === 3) {
      shots = [[-11, -0.045], [0, 0], [11, 0.045]];
      dmg = 10;
    } else {
      shots = [[-15, -0.085], [-5, -0.025], [5, 0.025], [15, 0.085]];
      dmg = 9;
    }
    const speed = 880;
    for (const [off, spread] of shots) {
      const angle = -Math.PI / 2 + spread;
      this.friendly.push({
        x: p.x + off,
        y: p.y - 28,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 4.5,
        dmg,
        life: 1.6,
        dead: false,
      });
      this.spark(p.x + off, p.y - 30, 1, 'rgba(150,250,255,0.9)', 60, 1.4);
    }
    this.audio.shoot();
  }

  updateEnemies(dt) {
    const p = this.player;
    const rate = this.stage === 2 ? 0.86 : 1;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.t += dt;
      if (e.type === 'imp') {
        e.y += e.speed * dt;
        e.x = e.baseX + Math.sin(e.t * 1.7 + e.seed) * e.drift;
      } else if (e.type === 'diver') {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (Math.random() < 0.5) this.smoke(e.x - e.vx * 0.01, e.y - e.vy * 0.01, 5, 'rgba(255,140,90,0.3)');
      } else if (e.type === 'drone') {
        const k = 1 - Math.exp(-2.3 * dt);
        e.y += (e.hoverY - e.y) * k;
        e.x = e.baseX + Math.sin(e.t * 1.3 + e.seed) * 34;
      } else if (e.type === 'gunship') {
        const k = 1 - Math.exp(-1.9 * dt);
        e.y += (e.hoverY - e.y) * k;
        e.x = e.baseX + Math.sin(e.t * 0.75 + e.seed) * Math.min(70, this.W * 0.15);
      } else if (e.type === 'turret') {
        const k = 1 - Math.exp(-2.2 * dt);
        e.y += (e.hoverY - e.y) * k;
        e.x = e.baseX + Math.sin(e.t * 1.15 + e.seed) * 10;
      }

      if (e.y > 8 && e.y < H * 0.76) {
        e.fireT -= dt;
        if (e.fireT <= 0) {
          if (e.type === 'imp') {
            this.fireAimed(e.x, e.y + 12, rand(-0.06, 0.06), 190, 6);
            e.fireT = rand(1.8, 2.3) * rate;
          } else if (e.type === 'drone') {
            const a = this.aimAtPlayer(e.x, e.y + 10);
            this.hostile(e.x, e.y + 10, a - 0.08, 235, 5);
            this.hostile(e.x, e.y + 10, a + 0.08, 235, 5);
            this.audio.enemyShoot();
            e.fireT = rand(1.6, 2.1) * rate;
          } else if (e.type === 'gunship') {
            const base = this.aimAtPlayer(e.x, e.y + 16);
            for (const off of [-0.2, 0, 0.2]) this.hostile(e.x, e.y + 16, base + off, 210, 6);
            this.audio.enemyShoot();
            e.fireT = rand(1.9, 2.4) * rate;
          } else if (e.type === 'turret') {
            const a = this.aimAtPlayer(e.x, e.y + 22, rand(-0.08, 0.08));
            this.spawnRocket(e.x, e.y + 22, a, {
              speed: 110,
              maxSpeed: 235,
              turn: 0.55,
              homeTime: 3.4,
              r: 8,
              frags: 3,
              life: 4.6,
            });
            if (performance.now() - this.lastRocketSound > 170) {
              this.audio.rocket();
              this.lastRocketSound = performance.now();
            }
            this.spark(e.x, e.y + 24, 6, 'rgba(255,160,80,0.9)', 100, 2);
            e.fireT = rand(2.5, 3.1) * rate;
          }
        }
      }

      if (e.y > H + 70 || e.x < -90 || e.x > this.W + 90) e.dead = true;

      if (!p.dead && e.y > 0 && e.y < H + 20) {
        const d = Math.hypot(p.x - e.x, p.y - e.y);
        if (d < e.r + p.r + 5) {
          this.playerHit();
          this.damageEnemy(e, 70, e.x, e.y);
        }
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  damageEnemy(e, dmg, x = e.x, y = e.y) {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = 0.15;
    this.spark(x, y, 3, 'rgba(255,220,160,0.9)', 120, 1.8);
    if (e.hp <= 0) {
      this.killEnemy(e);
    } else {
      this.audio.hit();
    }
  }

  killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    const pts = this.addScore(e.score);
    this.floatText(e.x, e.y - 8, `+${pts}`, '#ffe1a1', 12);
    this.explosion(e.x, e.y, e.type === 'gunship' ? 1.35 : 0.8, 'rgba(255,175,85,0.9)');
    if (Math.random() < 0.12) this.audio.explode(0);
    this.maybeDrop(e.x, e.y);
    if (this.player.lives <= 2 && Math.random() < 0.018) this.dropPickup(e.x, e.y, 'heart');
  }

  maybeDrop(x, y) {
    const r = Math.random();
    if (r < 0.1) this.dropPickup(x, y, 'power');
    else if (r < 0.155) this.dropPickup(x, y, 'bomb');
  }

  dropPickup(x, y, type) {
    this.pickups.push({ x, y, type, vy: 52, t: 0, seed: rand(0, TAU), r: 20 });
  }

  updateBoss(dt) {
    const b = this.boss;
    if (!b) return;
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt * 3.4);
    b.rocketFlash = Math.max(0, b.rocketFlash - dt * 3.2);
    if (b.mode === 'dying') {
      b.dyingT += dt;
      b.y += 10 * dt;
      b.x += Math.sin(b.dyingT * 9) * 26 * dt;
      if (Math.random() < dt * 11) {
        this.explosion(
          b.x + rand(-70, 70) * b.scale,
          b.y + rand(-55, 60) * b.scale,
          rand(0.7, 1.5),
          'rgba(255,170,80,0.95)'
        );
      }
      if (b.dyingT > 2.4) b.beam = null;
      return;
    }
    if (b.mode === 'enter') {
      const k = clamp(b.t / 1.7, 0, 1);
      const e = 1 - Math.pow(1 - k, 3);
      b.y = lerp(-240, b.baseY, e);
      b.x = this.W / 2;
      if (k >= 1) {
        b.mode = 'fight';
        b.t = 0;
        b.attackTimer = 0.9;
        this.shake = Math.max(this.shake, 12);
        this.flash = 0.35;
      }
      return;
    }
    if (b.phase === 1 && b.hp < b.maxHp * 0.5) {
      b.phase = 2;
      b.flash = 1;
      b.action = null;
      b.attackTimer = 0.8;
      this.shake = 22;
      this.flash = 0.6;
      this.audio.roar();
      this.floatText(b.x, b.y + 100, 'PHASE 2', '#ff7a5c', 20);
      this.dropPickup(b.x - 40, b.y + 90, 'power');
      this.dropPickup(b.x + 40, b.y + 90, 'bomb');
      this.hostiles = this.hostiles.filter((h) => h.kind === 'rocket' ? true : false);
    }
    b.beam = null;
    if (b.kind === 'dragon') this.updateDragon(b, dt);
    else this.updateRobot(b, dt);
  }

  // ------------------------------------------------------------- dragon
  dragonMouth(b) {
    return { x: b.x, y: b.y + 34 * b.scale };
  }

  updateDragon(b, dt) {
    b.x = this.W / 2 + Math.sin(b.t * 0.62) * Math.min(this.W * 0.23, 105);
    b.y = b.baseY + Math.sin(b.t * 1.15) * 9;
    if (b.action) {
      this.runDragonAction(b, dt);
      return;
    }
    b.attackTimer -= dt * (b.phase === 2 ? 1.3 : 1);
    if (b.attackTimer <= 0) this.startDragonAttack(b);
  }

  startDragonAttack(b) {
    const seq1 = ['volley', 'fan', 'breath', 'lunge'];
    const seq2 = ['fan', 'volley', 'breath', 'summon', 'lunge', 'volley'];
    const seq = b.phase === 2 ? seq2 : seq1;
    const name = seq[b.seq % seq.length];
    b.seq++;
    if (name === 'volley') {
      b.action = { name, t: 0, next: 0.15, shots: 0, count: b.phase === 2 ? 6 : 5, interval: 0.23 };
    } else if (name === 'fan') {
      b.action = { name, t: 0, dur: 0.85 };
      this.dragonFan(b, b.phase === 2 ? 13 : 9);
    } else if (name === 'breath') {
      const targetX = this.player.x < this.W / 2 ? this.W * 0.73 : this.W * 0.27;
      b.action = {
        name,
        t: 0,
        stage: 'charge',
        charge: 0.95,
        fire: b.phase === 2 ? 1.55 : 1.75,
        targetX,
        side: targetX > this.W / 2 ? 1 : -1,
      };
    } else if (name === 'summon') {
      b.action = { name, t: 0, dur: 0.8 };
      this.spawnImps(3);
      this.spark(b.x, b.y + 40, 22, 'rgba(255,120,50,0.9)', 180, 2.5);
      this.audio.roar();
    } else if (name === 'lunge') {
      b.action = { name, t: 0, dur: 1.5, startX: b.x, targetX: this.player.x, fired: false };
    }
  }

  dragonFan(b, count) {
    const m = this.dragonMouth(b);
    for (let i = 0; i < count; i++) {
      const a = 0.45 + (i / (count - 1)) * 2.25;
      this.hostile(m.x, m.y, a, rand(195, 235), 8, 'fire', { life: 5 });
    }
    this.spark(m.x, m.y, 16, 'rgba(255,180,70,0.9)', 220, 2.4);
    this.audio.enemyShoot();
  }

  runDragonAction(b, dt) {
    const a = b.action;
    a.t += dt;
    if (a.name === 'volley') {
      if (a.shots < a.count && a.t >= a.next) {
        const m = this.dragonMouth(b);
        this.hostile(m.x, m.y, this.aimAtPlayer(m.x, m.y, rand(-0.09, 0.09)), 235, 8, 'fire', { life: 5 });
        this.audio.enemyShoot();
        a.shots++;
        a.next += a.interval;
        this.spark(m.x, m.y, 5, 'rgba(255,200,100,0.9)', 120, 2);
      }
      if (a.shots >= a.count && a.t > a.count * a.interval + 0.35) this.endBossAction(b, 1.0);
    } else if (a.name === 'fan') {
      if (a.t >= a.dur) this.endBossAction(b, 1.15);
    } else if (a.name === 'breath') {
      if (a.stage === 'charge') {
        b.x = lerp(b.x, a.targetX, 1 - Math.exp(-3.2 * dt));
        b.y = lerp(b.y, b.baseY, 1 - Math.exp(-5 * dt));
        if (Math.random() < dt * 40) {
          const m = this.dragonMouth(b);
          this.particles.push({
            type: 'flame',
            x: m.x + rand(-14, 14),
            y: m.y + rand(-4, 8),
            vx: rand(-20, 20),
            vy: rand(-50, -10),
            life: rand(0.15, 0.35),
            maxLife: 0.35,
            size: rand(8, 16),
            color: 'rgba(255,220,120,0.9)',
          });
        }
        if (a.t >= a.charge) {
          a.stage = 'fire';
          a.t = 0;
          this.audio.beam();
          this.shake = Math.max(this.shake, 12);
        }
      } else if (a.stage === 'fire') {
        const p = clamp(a.t / a.fire, 0, 1);
        const start = a.side > 0 ? 0.78 : 2.36;
        const end = a.side > 0 ? 2.36 : 0.78;
        const angle = lerp(start, end, p);
        const m = this.dragonMouth(b);
        b.beam = { x: m.x, y: m.y, angle, len: 1000, width: 48, type: 'flame' };
        this.beamHits(m.x, m.y, angle, 1000, 27);
        for (let i = 0; i < 5; i++) {
          const d = rand(20, 620);
          this.particles.push({
            type: 'flame',
            x: m.x + Math.cos(angle) * d + rand(-18, 18),
            y: m.y + Math.sin(angle) * d + rand(-18, 18),
            vx: Math.cos(angle) * rand(80, 220) + rand(-30, 30),
            vy: Math.sin(angle) * rand(80, 220) + rand(-30, 30),
            life: rand(0.2, 0.5),
            maxLife: 0.5,
            size: rand(10, 24),
            color: 'rgba(255,170,60,0.75)',
          });
        }
        if (p >= 1) {
          a.stage = 'recover';
          a.t = 0;
          b.beam = null;
        }
      } else if (a.stage === 'recover') {
        if (a.t > 0.45) this.endBossAction(b, 1.25);
      }
    } else if (a.name === 'summon') {
      if (a.t >= a.dur) this.endBossAction(b, 1.2);
    } else if (a.name === 'lunge') {
      const p = clamp(a.t / a.dur, 0, 1);
      const ease = Math.sin((p * Math.PI) / 2);
      b.x = lerp(a.startX, a.targetX, p < 0.55 ? ease : 1 - (p - 0.55) / 0.45);
      b.y = b.baseY + Math.sin(p * Math.PI) * 235;
      if (!a.fired && p > 0.48) {
        a.fired = true;
        this.dragonFan(b, 7);
      }
      const m = this.dragonMouth(b);
      if (Math.random() < 0.8) {
        this.particles.push({
          type: 'flame',
          x: m.x + rand(-12, 12),
          y: m.y,
          vx: rand(-40, 40),
          vy: rand(40, 130),
          life: rand(0.2, 0.45),
          maxLife: 0.45,
          size: rand(8, 16),
          color: 'rgba(255,140,50,0.7)',
        });
      }
      if (p >= 1) this.endBossAction(b, 1.2);
    }
  }

  // ------------------------------------------------------------- robot
  updateRobot(b, dt) {
    b.x = this.W / 2 + Math.sin(b.t * 0.53) * Math.min(this.W * 0.21, 96);
    b.y = b.baseY + Math.sin(b.t * 1.35) * 7;
    if (b.action) {
      this.runRobotAction(b, dt);
      return;
    }
    b.attackTimer -= dt * (b.phase === 2 ? 1.3 : 1);
    if (b.attackTimer <= 0) this.startRobotAttack(b);
  }

  startRobotAttack(b) {
    const seq1 = ['rockets', 'rain', 'gatling', 'rockets'];
    const seq2 = ['rain', 'rockets', 'sweep', 'rockets', 'summon', 'gatling'];
    const seq = b.phase === 2 ? seq2 : seq1;
    const name = seq[b.seq % seq.length];
    b.seq++;
    if (name === 'rockets') {
      b.action = {
        name,
        t: 0,
        next: 0.18,
        shots: 0,
        count: b.phase === 2 ? 6 : 4,
        interval: 0.3,
      };
    } else if (name === 'rain') {
      const count = b.phase === 2 ? 7 : 5;
      for (let i = 0; i < count; i++) {
        this.rainWarnings.push({
          x: 38 + ((i + 0.5) * (this.W - 76)) / count + rand(-12, 12),
          t: 0,
          delay: 0.55 + i * 0.13,
          fired: false,
        });
      }
      b.action = { name, t: 0, dur: 1.2 };
      this.audio.warning();
    } else if (name === 'gatling') {
      b.action = { name, t: 0, next: 0.06, shots: 0, count: b.phase === 2 ? 16 : 12, interval: 0.1 };
    } else if (name === 'sweep') {
      const dir = this.player.x < this.W / 2 ? 1 : -1;
      b.action = { name, t: 0, stage: 'charge', charge: 0.8, fire: 1.55, start: dir > 0 ? 0.72 : 2.42, end: dir > 0 ? 2.42 : 0.72 };
    } else if (name === 'summon') {
      b.action = { name, t: 0, dur: 0.9 };
      this.spawnDrones(3);
      this.spark(b.x, b.y + 40, 20, 'rgba(120,235,255,0.85)', 180, 2.4);
      this.audio.roar();
    }
  }

  runRobotAction(b, dt) {
    const a = b.action;
    a.t += dt;
    if (a.name === 'rockets') {
      if (a.shots < a.count && a.t >= a.next) {
        const side = a.shots % 2 === 0 ? -1 : 1;
        const ox = b.x + side * 100 * b.scale;
        const oy = b.y - 12 * b.scale;
        const angle = this.aimAtPlayer(ox, oy, rand(-0.1, 0.1));
        this.spawnRocket(ox, oy, angle, {
          speed: 125,
          maxSpeed: b.phase === 2 ? 300 : 265,
          turn: b.phase === 2 ? 1.2 : 0.95,
          homeTime: 3.4,
          r: 9,
          frags: 5,
          life: 5.2,
        });
        b.rocketFlash = 1;
        this.spark(ox, oy + 12, 8, 'rgba(255,170,80,0.9)', 140, 2.2);
        if (performance.now() - this.lastRocketSound > 160) {
          this.audio.rocket();
          this.lastRocketSound = performance.now();
        }
        a.shots++;
        a.next += a.interval;
      }
      if (a.shots >= a.count && a.t > a.count * a.interval + 0.4) this.endBossAction(b, 1.05);
    } else if (a.name === 'rain') {
      if (a.t >= a.dur) this.endBossAction(b, 0.9);
    } else if (a.name === 'gatling') {
      if (a.shots < a.count && a.t >= a.next) {
        const ox = b.x + (a.shots % 2 ? 88 : -88) * b.scale;
        const oy = b.y + 62 * b.scale;
        const base = this.aimAtPlayer(ox, oy);
        const spread = Math.sin(a.shots * 1.7) * 0.34;
        this.hostile(ox, oy, base + spread, 285, 5, 'laser');
        this.audio.enemyShoot();
        this.spark(ox, oy, 2, 'rgba(255,110,100,0.8)', 100, 1.6);
        a.shots++;
        a.next += a.interval;
      }
      if (a.shots >= a.count && a.t > a.count * a.interval + 0.3) this.endBossAction(b, 1.0);
    } else if (a.name === 'sweep') {
      if (a.stage === 'charge') {
        if (Math.random() < dt * 35) {
          this.particles.push({
            type: 'flame',
            x: b.x + rand(-12, 12),
            y: b.y + 4 * b.scale + rand(-8, 8),
            vx: rand(-26, 26),
            vy: rand(-40, 10),
            life: rand(0.15, 0.3),
            maxLife: 0.3,
            size: rand(5, 11),
            color: 'rgba(255,80,90,0.9)',
          });
        }
        if (a.t >= a.charge) {
          a.stage = 'fire';
          a.t = 0;
          this.audio.laser();
          this.shake = Math.max(this.shake, 10);
        }
      } else if (a.stage === 'fire') {
        const p = clamp(a.t / a.fire, 0, 1);
        const angle = lerp(a.start, a.end, p);
        const ox = b.x;
        const oy = b.y + 4 * b.scale;
        b.beam = { x: ox, y: oy, angle, len: 1000, width: 18, type: 'laser' };
        this.beamHits(ox, oy, angle, 1000, 15);
        if (Math.random() < 0.7) {
          this.spark(ox + Math.cos(angle) * rand(80, 600), oy + Math.sin(angle) * rand(80, 600), 1, 'rgba(255,120,110,0.8)', 80, 1.8);
        }
        if (p >= 1) {
          a.stage = 'recover';
          a.t = 0;
          b.beam = null;
        }
      } else if (a.t > 0.4) {
        this.endBossAction(b, 1.15);
      }
    } else if (a.name === 'summon') {
      if (a.t >= a.dur) this.endBossAction(b, 1.0);
    }
  }

  endBossAction(b, cooldown) {
    b.action = null;
    b.beam = null;
    b.attackTimer = cooldown * (b.phase === 2 ? 0.82 : 1);
  }

  beamHits(ox, oy, angle, len, width) {
    const p = this.player;
    if (p.dead) return false;
    const ex = ox + Math.cos(angle) * len;
    const ey = oy + Math.sin(angle) * len;
    const vx = ex - ox;
    const vy = ey - oy;
    const t = clamp(((p.x - ox) * vx + (p.y - oy) * vy) / (vx * vx + vy * vy), 0, 1);
    const px = ox + vx * t;
    const py = oy + vy * t;
    if (Math.hypot(p.x - px, p.y - py) < width + p.r) {
      this.playerHit();
      return true;
    }
    return false;
  }

  bossDefeated() {
    const b = this.boss;
    if (!b || b.mode === 'dying') return;
    b.mode = 'dying';
    b.dyingT = 0;
    b.action = null;
    b.beam = null;
    this.bossDefeatedFlag = true;
    this.clearTimer = 3.0;
    this.hostiles = [];
    this.rainWarnings = [];
    this.enemies.forEach((e) => (e.dead = true));
    const pts = this.addScore(this.stage === 1 ? 3000 : 5000);
    this.floatText(b.x, b.y + 30, `+${pts}`, '#ffe08a', 20);
    this.flash = 1;
    this.shake = 30;
    this.audio.explode(1);
    this.vibrate(120);
    this.banner = {
      kind: 'clear',
      t: 0,
      dur: 2.3,
      title: this.stage === 1 ? 'NAGA JATUH' : 'TITAN HANCUR',
      sub: this.stage === 1 ? 'STAGE CLEAR  ·  MENUJU KOTA BAJA' : 'MISI SELESAI',
      color: '#ffd784',
    };
    this.saveBest();
    this.emitHud();
  }

  hitBoss(dmg, x, y) {
    const b = this.boss;
    if (!b || b.mode === 'dying') return;
    b.hp -= dmg;
    b.flash = Math.max(b.flash, 0.55);
    this.spark(x, y, 2, 'rgba(255,240,200,0.9)', 100, 1.8);
    this.audio.hit();
    if (b.hp <= 0) this.bossDefeated();
  }

  // ------------------------------------------------------------- projectiles
  updateFriendly(dt) {
    for (const f of this.friendly) {
      if (f.dead) continue;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.life -= dt;
      if (f.life <= 0 || f.y < -30 || f.x < -20 || f.x > this.W + 20) f.dead = true;
    }
    this.friendly = this.friendly.filter((f) => !f.dead);
  }

  updateHostiles(dt) {
    const p = this.player;
    for (const h of this.hostiles) {
      if (h.dead) continue;
      h.age += dt;
      h.life -= dt;
      if (h.kind === 'rocket') {
        if (h.turn > 0 && h.age < h.homeTime) {
          const desired = Math.atan2(p.y - h.y, p.x - h.x);
          let diff = desired - h.angle;
          while (diff > Math.PI) diff -= TAU;
          while (diff < -Math.PI) diff += TAU;
          const maxTurn = h.turn * dt;
          h.angle += clamp(diff, -maxTurn, maxTurn);
        }
        h.speed = Math.min(h.maxSpeed, h.speed + 70 * dt);
        h.vx = Math.cos(h.angle) * h.speed;
        h.vy = Math.sin(h.angle) * h.speed;
        h.smokeT -= dt;
        if (h.smokeT <= 0 && h.y > -20 && h.y < H + 20) {
          h.smokeT = 0.035;
          this.smoke(h.x - Math.cos(h.angle) * 10, h.y - Math.sin(h.angle) * 10, 6, 'rgba(200,195,205,0.32)');
          if (Math.random() < 0.5) {
            this.particles.push({
              type: 'flame',
              x: h.x - Math.cos(h.angle) * 12,
              y: h.y - Math.sin(h.angle) * 12,
              vx: -Math.cos(h.angle) * rand(30, 90),
              vy: -Math.sin(h.angle) * rand(30, 90),
              life: rand(0.1, 0.22),
              maxLife: 0.22,
              size: rand(3, 6),
              color: 'rgba(255,190,90,0.9)',
            });
          }
        }
        if (h.age > 4.2) {
          this.rocketBurst(h);
          h.dead = true;
          continue;
        }
      } else {
        h.x += h.vx * dt;
        h.y += h.vy * dt;
      }
      if (h.life <= 0) {
        if (h.kind === 'rocket') this.rocketBurst(h);
        h.dead = true;
      } else if (h.y > H + 70 || h.x < -80 || h.x > this.W + 80 || (h.kind !== 'rocket' && h.y < -70)) {
        h.dead = true;
      } else if (h.kind === 'rocket' && h.y > H + 50) {
        h.dead = true;
      }
    }
    this.hostiles = this.hostiles.filter((h) => !h.dead);
  }

  rocketBurst(h) {
    if (h.rain) return;
    this.explosion(h.x, h.y, 0.65, 'rgba(255,160,80,0.9)');
    const n = h.frags || 0;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      this.hostile(h.x, h.y, a, rand(110, 175), 4.5, 'shard', { life: 1.15 });
    }
  }

  updatePickups(dt) {
    const p = this.player;
    for (const it of this.pickups) {
      it.t += dt;
      it.y += it.vy * dt;
      it.x += Math.sin(it.t * 2 + it.seed) * 12 * dt;
      if (!p.dead && Math.hypot(p.x - it.x, p.y - it.y) < it.r + 12) {
        it.dead = true;
        this.collect(it);
      }
      if (it.y > H + 40) it.dead = true;
    }
    this.pickups = this.pickups.filter((it) => !it.dead);
  }

  collect(it) {
    const p = this.player;
    if (it.type === 'power') {
      if (p.power < 4) {
        p.power++;
        this.floatText(p.x, p.y - 34, 'POWER UP', '#7ff5ff', 13);
      } else {
        this.score += 300;
        this.floatText(p.x, p.y - 34, '+300', '#7ff5ff', 12);
      }
    } else if (it.type === 'bomb') {
      if (p.bombs < 5) {
        p.bombs++;
        this.floatText(p.x, p.y - 34, '+BOM', '#ffb35e', 13);
      } else {
        this.score += 300;
        this.floatText(p.x, p.y - 34, '+300', '#ffb35e', 12);
      }
    } else {
      p.lives = Math.min(5, p.lives + 1);
      this.floatText(p.x, p.y - 34, '+NYAWA', '#ff7d94', 13);
    }
    this.audio.powerup();
    this.spark(it.x, it.y, 12, 'rgba(160,250,255,0.9)', 170, 2);
    this.emitHud();
  }

  updateRainWarnings(dt) {
    for (const w of this.rainWarnings) {
      w.t += dt;
      if (!w.fired && w.t >= w.delay) {
        w.fired = true;
        this.spawnRocket(w.x, -34, Math.PI / 2, {
          speed: 330,
          maxSpeed: 380,
          turn: 0,
          homeTime: 0,
          r: 9,
          rain: true,
          frags: 0,
          life: 4,
        });
        if (performance.now() - this.lastRocketSound > 120) {
          this.audio.rocket();
          this.lastRocketSound = performance.now();
        }
      }
    }
    this.rainWarnings = this.rainWarnings.filter((w) => w.t < w.delay + 0.5);
  }

  collide() {
    const p = this.player;
    for (const f of this.friendly) {
      if (f.dead) continue;
      const b = this.boss;
      if (b && b.mode !== 'dying' && Math.hypot(f.x - b.x, f.y - b.y) < b.r + f.r + 5) {
        this.hitBoss(f.dmg, f.x, f.y);
        f.dead = true;
        continue;
      }
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (Math.hypot(f.x - e.x, f.y - e.y) < e.r + f.r) {
          this.damageEnemy(e, f.dmg, f.x, f.y);
          f.dead = true;
          break;
        }
      }
    }
    this.friendly = this.friendly.filter((f) => !f.dead);

    if (!p.dead) {
      for (const h of this.hostiles) {
        if (h.dead) continue;
        if (Math.hypot(h.x - p.x, h.y - p.y) < h.r + p.r) {
          if (h.kind === 'rocket') this.rocketBurst(h);
          h.dead = true;
          this.playerHit();
        }
      }
      this.hostiles = this.hostiles.filter((h) => !h.dead);
    }
  }

  playerHit() {
    const p = this.player;
    if (p.dead || this.state !== 'playing') return;
    if (p.invuln > 0) return;
    if (this.debugInvincible) {
      this.flash = 0.16;
      return;
    }
    p.lives--;
    p.invuln = 2.7;
    p.power = Math.max(1, p.power - 1);
    this.combo = 0;
    this.comboT = 0;
    this.damageFlash = 1;
    this.flash = 0.32;
    this.shake = 22;
    this.audio.playerHit();
    this.vibrate(45);
    this.explosion(p.x, p.y, 1.1, 'rgba(255,190,120,0.95)');
    for (const h of this.hostiles) {
      if (h.kind !== 'rocket' && Math.hypot(h.x - p.x, h.y - p.y) < 190) h.dead = true;
    }
    this.hostiles = this.hostiles.filter((h) => !h.dead);
    this.emitHud();
    if (p.lives <= 0) {
      p.dead = true;
      p.deathT = 0;
      this.deathTimer = 1.8;
      this.explosion(p.x, p.y, 2.2, 'rgba(255,170,90,0.95)');
      this.shake = 30;
      this.audio.explode(1);
    } else {
      this.floatText(p.x, p.y - 30, '-1 NYAWA', '#ff8f9f', 13);
    }
  }

  useBomb() {
    const p = this.player;
    if (this.state !== 'playing' || p.dead || p.bombs <= 0 || this.bombLock > 0) return;
    p.bombs--;
    this.bombLock = 0.6;
    this.audio.bomb();
    this.vibrate(70);
    this.flash = 1;
    this.damageFlash = 0;
    this.shake = 27;
    this.ring(p.x, p.y, 220, 'rgba(160,245,255,0.9)');
    for (let i = 0; i < 3; i++) this.ring(p.x, p.y, 90 + i * 60, 'rgba(255,185,90,0.8)');
    this.spark(p.x, p.y, 40, 'rgba(160,245,255,0.95)', 420, 2.6);
    for (const h of this.hostiles) {
      this.spark(h.x, h.y, 2, 'rgba(255,220,160,0.9)', 100, 1.4);
    }
    this.hostiles = [];
    this.rainWarnings = [];
    for (const e of this.enemies) this.damageEnemy(e, 200, e.x, e.y);
    if (this.boss && this.boss.mode !== 'dying') this.hitBoss(300, this.boss.x, this.boss.y + 30);
    this.floatText(p.x, p.y - 44, 'BOM!', '#ffd18a', 20);
    this.emitHud();
  }

  // ------------------------------------------------------------- misc update
  updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'spark') {
        p.vx *= 1 - 2.2 * dt;
        p.vy *= 1 - 2.2 * dt;
      } else if (p.type === 'smoke') {
        p.vx *= 1 - 0.8 * dt;
        p.vy *= 1 - 0.8 * dt;
        p.size += 9 * dt;
      } else if (p.type === 'debris') {
        p.vy += 40 * dt;
      }
    }
    if (this.particles.length > 760) this.particles.splice(0, this.particles.length - 760);
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  updateFloats(dt) {
    for (const f of this.floats) {
      f.life -= dt;
      f.y -= 34 * dt;
    }
    this.floats = this.floats.filter((f) => f.life > 0);
  }

  updateEffects(dt) {
    this.shake *= Math.exp(-6 * dt);
    if (this.shake < 0.12) this.shake = 0;
    this.flash = Math.max(0, this.flash - dt * 3.2);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.1);
    this.bombLock = Math.max(0, this.bombLock - dt);
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
  }

  checkPlayerState(dt) {
    if (this.deathTimer > 0) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) this.gameOver();
    }
  }

  // ------------------------------------------------------------- drawing
  draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const fullBg = ctx.createRadialGradient(
      this.cssW / 2,
      this.cssH * 0.45,
      20,
      this.cssW / 2,
      this.cssH * 0.45,
      Math.max(this.cssW, this.cssH) * 0.8
    );
    fullBg.addColorStop(0, '#0b0a20');
    fullBg.addColorStop(1, '#030209');
    ctx.fillStyle = fullBg;
    ctx.fillRect(0, 0, this.cssW, this.cssH);

    ctx.save();
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.scale, this.scale);
    ctx.beginPath();
    ctx.rect(0, 0, this.W, H);
    ctx.clip();

    if (this.state === 'menu') {
      this.drawMenuScene(ctx);
    } else {
      const shakeX = this.shake ? rand(-this.shake, this.shake) : 0;
      const shakeY = this.shake ? rand(-this.shake, this.shake) : 0;
      ctx.save();
      ctx.translate(shakeX, shakeY);
      this.drawScene(ctx);
      ctx.restore();
      this.drawScreenEffects(ctx);
      if (this.state === 'playing' || this.state === 'paused') {
        this.drawWarning(ctx);
        this.drawBanner(ctx);
        this.drawRainWarnings(ctx);
        this.drawHUD(ctx);
      }
    }

    ctx.restore();

    if (this.ox > 1) {
      const side = ctx.createLinearGradient(0, 0, this.ox, 0);
      side.addColorStop(0, 'rgba(0,0,0,0.72)');
      side.addColorStop(0.55, 'rgba(8,14,30,0.4)');
      side.addColorStop(1, 'rgba(40,120,170,0.08)');
      ctx.fillStyle = side;
      ctx.fillRect(0, 0, this.ox, this.cssH);
      ctx.save();
      ctx.translate(this.cssW, 0);
      ctx.scale(-1, 1);
      ctx.fillStyle = side;
      ctx.fillRect(0, 0, this.ox, this.cssH);
      ctx.restore();
      ctx.strokeStyle = 'rgba(95,220,255,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.ox, 0);
      ctx.lineTo(this.ox, this.cssH);
      ctx.moveTo(this.cssW - this.ox, 0);
      ctx.lineTo(this.cssW - this.ox, this.cssH);
      ctx.stroke();
    }
  }

  drawMenuScene(ctx) {
    R.drawBackdrop(ctx, this.backdrop, this.W, H, this.time);
    const t = this.menuT;
    const dragon = {
      x: this.W / 2 + Math.sin(t * 0.32) * 26,
      y: 102 + Math.sin(t * 0.9) * 7,
      scale: clamp(this.W / 600, 0.48, 0.66),
      flash: 0,
      phase: 1,
      action: null,
    };
    ctx.save();
    ctx.globalAlpha = 0.72;
    R.drawDragon(ctx, dragon, t * 1.4);
    ctx.restore();

    // distant jet flyby
    ctx.save();
    ctx.globalAlpha = 0.4;
    const fx = ((t * 90) % (this.W + 220)) - 110;
    const fake = {
      x: fx,
      y: 230 + Math.sin(t * 0.8) * 10,
      tilt: 0.12,
      invuln: 0,
      scale: 0.45,
    };
    R.drawPlayer(ctx, fake, t);
    ctx.restore();

    const p = {
      x: this.W / 2 + Math.sin(t * 0.55) * this.W * 0.16,
      y: H * 0.78 + Math.sin(t * 1.2) * 7,
      tilt: Math.cos(t * 0.55) * 0.1,
      invuln: 0,
      scale: clamp(this.W / 450, 0.84, 1.08),
    };
    R.drawPlayer(ctx, p, t);
    // engine trail
    if (Math.random() < 0.4) {
      this.particles.push({
        type: 'flame',
        x: p.x + rand(-8, 8),
        y: p.y + rand(18, 28),
        vx: rand(-10, 10),
        vy: rand(50, 90),
        life: rand(0.15, 0.3),
        maxLife: 0.3,
        size: rand(4, 8),
        color: 'rgba(110,235,255,0.7)',
      });
    }
    for (const part of this.particles) R.drawParticle(ctx, part);
  }

  drawScene(ctx) {
    R.drawBackdrop(ctx, this.backdrop, this.W, H, this.time);

    if (this.boss && this.boss.beam) {
      const bm = this.boss.beam;
      if (bm.type === 'flame') R.drawFlameBeam(ctx, bm.x, bm.y, bm.angle, bm.len, bm.width, this.time);
      else R.drawLaserBeam(ctx, bm.x, bm.y, bm.angle, bm.len, bm.width, this.time);
    }
    if (this.boss && this.boss.action) this.drawBossTelegraph(ctx);

    for (const it of this.pickups) R.drawPickup(ctx, it, this.time);

    if (this.boss) {
      if (this.boss.kind === 'dragon') R.drawDragon(ctx, this.boss, this.time);
      else R.drawRobot(ctx, this.boss, this.time);
    }

    for (const e of this.enemies) R.drawEnemy(ctx, e, this.time);

    if (!this.player.dead) R.drawPlayer(ctx, this.player, this.time);

    for (const f of this.friendly) R.drawFriendly(ctx, f, this.time);
    for (const h of this.hostiles) R.drawHostile(ctx, h, this.time);

    for (const p of this.particles) R.drawParticle(ctx, p);

    for (const f of this.floats) {
      const a = clamp(f.life / f.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 ${f.size}px "Trebuchet MS", sans-serif`;
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 10;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }

  drawBossTelegraph(ctx) {
    const b = this.boss;
    const a = b.action;
    if (!a) return;
    let ox;
    let oy;
    let angle;
    let width;
    let color;
    if (b.kind === 'dragon' && a.name === 'breath' && a.stage === 'charge') {
      const m = this.dragonMouth(b);
      ox = m.x;
      oy = m.y;
      angle = a.side > 0 ? 0.78 : 2.36;
      width = 22;
      color = 'rgba(255,120,70,0.4)';
    } else if (b.kind === 'robot' && a.name === 'sweep' && a.stage === 'charge') {
      ox = b.x;
      oy = b.y + 4 * b.scale;
      angle = a.start;
      width = 12;
      color = 'rgba(255,70,80,0.42)';
    } else {
      return;
    }
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([9, 11]);
    ctx.lineDashOffset = -this.time * 80;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(angle) * 720, oy + Math.sin(angle) * 720);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ox, oy, width, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawRainWarnings(ctx) {
    for (const w of this.rainWarnings) {
      if (w.fired) continue;
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 16 + w.x);
      const a = 0.22 + pulse * 0.3;
      ctx.save();
      ctx.strokeStyle = `rgba(255,80,70,${a})`;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([6, 12]);
      ctx.lineDashOffset = -this.time * 70;
      ctx.beginPath();
      ctx.moveTo(w.x, 28);
      ctx.lineTo(w.x, H);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.5 + pulse * 0.5;
      ctx.fillStyle = '#ff5e54';
      const ty = 62 + ((this.time * 90) % 46);
      for (let i = 0; i < 2; i++) {
        const y = ty + i * 18;
        ctx.beginPath();
        ctx.moveTo(w.x - 9, y - 8);
        ctx.lineTo(w.x, y);
        ctx.lineTo(w.x + 9, y - 8);
        ctx.lineTo(w.x + 9, y - 3);
        ctx.lineTo(w.x, y + 5);
        ctx.lineTo(w.x - 9, y - 3);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawScreenEffects(ctx) {
    if (this.damageFlash > 0) {
      const g = ctx.createRadialGradient(this.W / 2, H / 2, H * 0.24, this.W / 2, H / 2, H * 0.7);
      g.addColorStop(0, 'rgba(255,40,60,0)');
      g.addColorStop(1, `rgba(255,30,55,${0.5 * this.damageFlash})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.W, H);
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.32 * this.flash})`;
      ctx.fillRect(0, 0, this.W, H);
    }
    if (this.state === 'playing' && this.player.lives === 1 && !this.player.dead) {
      const a = 0.1 + 0.07 * Math.sin(this.time * 5);
      const g = ctx.createRadialGradient(this.W / 2, H / 2, H * 0.3, this.W / 2, H / 2, H * 0.68);
      g.addColorStop(0, 'rgba(255,40,60,0)');
      g.addColorStop(1, `rgba(255,40,60,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.W, H);
    }
  }

  drawHUD(ctx) {
    const top = 12 + this.safeTop / this.scale;
    const p = this.player;
    ctx.save();
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    // score panel
    ctx.fillStyle = 'rgba(3,8,18,0.46)';
    R.roundedRect(ctx, 10, top - 4, 134, 48, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,225,255,0.13)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(128,226,244,0.78)';
    ctx.font = '700 8px "Trebuchet MS", sans-serif';
    ctx.fillText('SKOR', 18, top + 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 22px "Trebuchet MS", sans-serif';
    ctx.fillText(String(this.score).padStart(7, '0'), 18, top + 13);

    if (this.combo >= 4) {
      const mult = 1 + Math.min(5, Math.floor(this.combo / 6)) * 0.5;
      ctx.fillStyle = '#ffd27d';
      ctx.font = '700 10px "Trebuchet MS", sans-serif';
      ctx.fillText(`COMBO ${this.combo}  x${mult.toFixed(1)}`, 72, top + 33);
    }

    // lives
    const hearts = 5;
    const heartEnd = this.W - 110 - this.safeRight / this.scale;
    for (let i = 0; i < hearts; i++) {
      const x = heartEnd - i * 17;
      this.drawHeart(ctx, x, top + 5, 7, i < p.lives);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(128,226,244,0.65)';
    ctx.font = '700 7px "Trebuchet MS", sans-serif';
    ctx.fillText('NYAWA', heartEnd, top + 26);

    // boss bar
    if (this.boss) {
      const b = this.boss;
      const bx = 12;
      const by = top + 54;
      const bw = this.W - 24;
      const pct = clamp(b.hp / b.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(3,7,16,0.68)';
      R.roundedRect(ctx, bx, by, bw, 38, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,140,90,0.22)';
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.font = '800 10px "Trebuchet MS", sans-serif';
      ctx.fillStyle = '#ffb28a';
      ctx.fillText(b.name, bx + 8, by + 5);
      ctx.textAlign = 'right';
      ctx.font = '700 7px "Trebuchet MS", sans-serif';
      ctx.fillStyle = 'rgba(220,235,245,0.55)';
      ctx.fillText(b.title, bx + bw - 8, by + 7);
      // bar
      const barX = bx + 8;
      const barY = by + 20;
      const barW = bw - 16;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      R.roundedRect(ctx, barX, barY, barW, 10, 5);
      ctx.fill();
      if (pct > 0) {
        const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        grad.addColorStop(0, b.phase === 2 ? '#ff3b3b' : '#ff9b40');
        grad.addColorStop(0.7, b.phase === 2 ? '#ff6b3d' : '#ffd166');
        grad.addColorStop(1, '#fff3c4');
        ctx.fillStyle = grad;
        R.roundedRect(ctx, barX, barY, Math.max(6, barW * pct), 10, 5);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        R.roundedRect(ctx, barX + 1, barY + 1, Math.max(4, barW * pct - 2), 3, 2);
        ctx.fill();
      }
      // phase notch
      ctx.fillStyle = 'rgba(5,8,15,0.8)';
      ctx.fillRect(barX + barW * 0.5 - 1, barY - 1, 2, 12);
      ctx.textAlign = 'right';
      ctx.font = '800 8px "Trebuchet MS", sans-serif';
      ctx.fillStyle = '#ffe1ae';
      ctx.fillText(`${Math.ceil(pct * 100)}%`, barX + barW, barY + 13);
    }

    // stage + power
    const by = H - 28 - this.safeBottom / this.scale;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(3,8,18,0.5)';
    R.roundedRect(ctx, 10, by - 12, 128, 26, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,225,255,0.12)';
    ctx.stroke();
    ctx.font = '800 8px "Trebuchet MS", sans-serif';
    ctx.fillStyle = 'rgba(140,232,250,0.8)';
    ctx.fillText(`STAGE ${this.stage}/2`, 17, by - 7);
    ctx.fillStyle = 'rgba(210,232,245,0.6)';
    ctx.fillText('PWR', 17, by + 5);
    for (let i = 0; i < 4; i++) {
      const px = 45 + i * 18;
      const on = i < p.power;
      ctx.fillStyle = on ? '#57eaff' : 'rgba(120,160,180,0.18)';
      ctx.beginPath();
      ctx.moveTo(px, by + 12);
      ctx.lineTo(px + 6, by + 6);
      ctx.lineTo(px + 12, by + 12);
      ctx.lineTo(px + 6, by + 9);
      ctx.closePath();
      ctx.fill();
      if (on) {
        ctx.shadowColor = '#57eaff';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    ctx.restore();
  }

  drawHeart(ctx, x, y, s, filled) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.34);
    ctx.bezierCurveTo(x, y, x - s * 0.56, y, x - s * 0.56, y + s * 0.44);
    ctx.bezierCurveTo(x - s * 0.56, y + s * 0.9, x, y + s * 1.12, x, y + s * 1.52);
    ctx.bezierCurveTo(x, y + s * 1.12, x + s * 0.56, y + s * 0.9, x + s * 0.56, y + s * 0.44);
    ctx.bezierCurveTo(x + s * 0.56, y, x, y, x, y + s * 0.34);
    ctx.closePath();
    if (filled) {
      const g = ctx.createLinearGradient(x, y, x, y + s * 1.5);
      g.addColorStop(0, '#ff8a9a');
      g.addColorStop(1, '#e3244f');
      ctx.fillStyle = g;
      ctx.shadowColor = '#ff365c';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(255,120,145,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawWarning(ctx) {
    const w = this.warning;
    if (!w) return;
    const cy = H * 0.29;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 12);
    ctx.save();
    ctx.fillStyle = `rgba(255,20,45,${0.05 + pulse * 0.05})`;
    ctx.fillRect(0, 0, this.W, H);
    // stripes
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(255,50,60,0.5)' : 'rgba(12,4,8,0.65)';
      ctx.beginPath();
      const x = (i / 14) * (this.W + 40) - 20;
      ctx.moveTo(x, cy - 74);
      ctx.lineTo(x + 20, cy - 74);
      ctx.lineTo(x + 9, cy - 63);
      ctx.lineTo(x - 11, cy - 63);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, cy + 64);
      ctx.lineTo(x + 20, cy + 64);
      ctx.lineTo(x + 9, cy + 75);
      ctx.lineTo(x - 11, cy + 75);
      ctx.closePath();
      ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const shake = 2.4 * pulse;
    // warning icon
    ctx.save();
    ctx.translate(this.W / 2, cy - 34 + rand(-shake, shake));
    ctx.fillStyle = '#ff344f';
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(18, 14);
    ctx.lineTo(-18, 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#250208';
    ctx.font = '800 19px "Trebuchet MS", sans-serif';
    ctx.fillText('!', 0, 1);
    ctx.restore();
    ctx.fillStyle = '#fff3ee';
    ctx.font = '800 31px "Arial Black", "Trebuchet MS", sans-serif';
    ctx.shadowColor = 'rgba(255,40,60,0.95)';
    ctx.shadowBlur = 22;
    ctx.fillText('WARNING', this.W / 2 + rand(-shake, shake), cy + 6);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffb0a2';
    ctx.font = '800 13px "Trebuchet MS", sans-serif';
    ctx.fillText(w.name, this.W / 2, cy + 34);
    ctx.fillStyle = 'rgba(255,210,196,0.62)';
    ctx.font = '700 8px "Trebuchet MS", sans-serif';
    ctx.fillText(w.sub, this.W / 2, cy + 49);
    ctx.restore();
  }

  drawBanner(ctx) {
    const b = this.banner;
    if (!b) return;
    const a = clamp(b.t / 0.25, 0, 1) * clamp((b.dur - b.t) / 0.35, 0, 1);
    if (a <= 0) return;
    const cy = H * 0.35;
    ctx.save();
    ctx.globalAlpha = a;
    const grad = ctx.createLinearGradient(0, cy - 64, 0, cy + 64);
    grad.addColorStop(0, 'rgba(3,7,18,0)');
    grad.addColorStop(0.25, 'rgba(3,7,18,0.78)');
    grad.addColorStop(0.75, 'rgba(3,7,18,0.78)');
    grad.addColorStop(1, 'rgba(3,7,18,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, cy - 64, this.W, 128);
    ctx.strokeStyle = b.color;
    ctx.globalAlpha = a * 0.45;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.W * 0.08, cy - 33);
    ctx.lineTo(this.W * 0.92, cy - 33);
    ctx.moveTo(this.W * 0.16, cy + 36);
    ctx.lineTo(this.W * 0.84, cy + 36);
    ctx.stroke();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 33px "Arial Black", "Trebuchet MS", sans-serif';
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 18;
    ctx.fillText(b.title, this.W / 2, cy - 3);
    ctx.shadowBlur = 0;
    ctx.fillStyle = b.color;
    ctx.font = '700 9px "Trebuchet MS", sans-serif';
    ctx.fillText(b.sub, this.W / 2, cy + 24);
    ctx.restore();
  }

}
