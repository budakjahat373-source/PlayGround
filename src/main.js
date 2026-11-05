import { Game } from './game.js';

const canvas = document.getElementById('game');
const overlay = document.getElementById('overlay');
const screen = document.getElementById('screen');
const bombBtn = document.getElementById('bombBtn');
const bombCount = document.getElementById('bombCount');
const soundBtn = document.getElementById('soundBtn');
const pauseBtn = document.getElementById('pauseBtn');

const game = new Game(canvas);

let muted = false;
try {
  muted = localStorage.getItem('naga_titan_muted') === '1';
} catch {
  muted = false;
}

function applyMute() {
  game.audio.setMuted(muted);
  soundBtn.classList.toggle('off', muted);
  soundBtn.textContent = muted ? '\u2715' : '\u266a';
  soundBtn.setAttribute('aria-label', muted ? 'Nyalakan suara' : 'Matikan suara');
  soundBtn.title = muted ? 'Nyalakan suara' : 'Matikan suara';
  try {
    localStorage.setItem('naga_titan_muted', muted ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function startWithAudio() {
  game.audio.init();
  applyMute();
  game.startGame();
}

function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function menuMarkup() {
  return `
    <div class="card">
      <p class="eyebrow">ARCADE JET TEMBAK · 2D</p>
      <h1 class="title">NAGA <span class="amp">&amp;</span><span class="line2">TITAN</span></h1>
      <p class="tagline">Dua langit. Dua bos. Satu jet tempur.<br />Jatuhkan Naga Merah, lalu hancurkan Titan-9.</p>
      <div class="boss-chips">
        <div class="chip dragon"><span class="n">STAGE 1</span><span class="v">NAGA MERAH</span></div>
        <div class="chip robot"><span class="n">STAGE 2</span><span class="v">TITAN-9</span></div>
      </div>
      <button class="primary" data-act="start">MULAI MISI <span aria-hidden="true">▸</span></button>
      <div class="howto">
        <div><span class="k">↔</span><span><b>Geser di mana saja</b> — jet mengikuti gerakan jari.</span></div>
        <div><span class="k">✦</span><span><b>Tembak otomatis.</b> Fokus menghindar dan ambil power-up.</span></div>
        <div><span class="k">◉</span><span><b>Tombol BOM</b> menghapus peluru musuh di layar.</span></div>
        <div><span class="k">⌨</span><span><b>Keyboard:</b> WASD / panah · Spasi bom · P jeda.</span></div>
      </div>
      <p class="fineprint">SKOR TERBAIK ${String(game.best).padStart(7, '0')} · SENTUH UNTUK MULAI</p>
    </div>`;
}

function pauseMarkup() {
  return `
    <div class="card">
      <div class="pause-badge" aria-hidden="true">⏸</div>
      <p class="eyebrow">MISI DIJEDA</p>
      <h2 class="result-title">TARIK NAFAS</h2>
      <p class="result-sub">Langit masih menunggu. Lanjutkan misi saat kamu siap.</p>
      <button class="primary blue" data-act="resume">LANJUTKAN</button>
      <button class="ghost" data-act="retry">ULANGI MISI</button>
      <button class="ghost" data-act="menu">KEMBALI KE MENU</button>
    </div>`;
}

function gameOverMarkup(data) {
  const stageName = data.stage >= 2 ? 'KOTA BAJA' : 'LANGIT SENJA';
  return `
    <div class="card">
      <p class="eyebrow">MISI GAGAL</p>
      <h2 class="result-title red">JET JATUH</h2>
      <p class="result-tag bad">STAGE ${data.stage} · ${stageName}</p>
      <div class="scoreboard">
        <div class="stat"><div class="label">SKOR</div><div class="value orange">${String(data.score).padStart(6, '0')}</div></div>
        <div class="stat"><div class="label">TERBAIK</div><div class="value">${String(data.best).padStart(6, '0')}</div></div>
      </div>
      <p class="result-sub">${data.stage === 1 ? 'Naga Merah masih menguasai langit. Naikkan power-up dan coba lagi.' : 'Titan-9 masih meluncurkan roketnya. Hancurkan pod roketnya lebih dulu.'}</p>
      <button class="primary" data-act="retry">ULANGI MISI</button>
      <button class="ghost" data-act="menu">KEMBALI KE MENU</button>
    </div>`;
}

function victoryMarkup(data) {
  return `
    <div class="card">
      <p class="eyebrow">MISI SELESAI</p>
      <h2 class="result-title gold">KEMENANGAN</h2>
      <p class="result-tag">NAGA &amp; TITAN DIKALAHKAN</p>
      <div class="scoreboard">
        <div class="stat"><div class="label">SKOR</div><div class="value orange">${String(data.score).padStart(6, '0')}</div></div>
        <div class="stat"><div class="label">WAKTU</div><div class="value">${fmtTime(data.time)}</div></div>
      </div>
      <p class="result-sub">Langit kembali aman. Dua bos jatuh di tanganmu — skor terbaik ${String(data.best).padStart(6, '0')}.</p>
      <button class="primary" data-act="retry">MAIN LAGI</button>
      <button class="ghost" data-act="menu">KEMBALI KE MENU</button>
    </div>`;
}

function showOverlay(markup, dim) {
  screen.innerHTML = markup;
  overlay.classList.remove('hidden');
  overlay.classList.toggle('dim', !!dim);
}

function hideOverlay() {
  overlay.classList.add('hidden');
  overlay.classList.remove('dim');
}

game.onState = (state, data) => {
  if (state === 'menu') {
    showOverlay(menuMarkup(), false);
    bombBtn.classList.remove('show');
    pauseBtn.classList.add('gone');
    overlay.classList.remove('dim');
  } else if (state === 'playing') {
    hideOverlay();
    bombBtn.classList.add('show');
    pauseBtn.classList.remove('gone');
  } else if (state === 'paused') {
    showOverlay(pauseMarkup(), true);
    bombBtn.classList.remove('show');
    pauseBtn.classList.remove('gone');
  } else if (state === 'gameover') {
    showOverlay(gameOverMarkup(data), true);
    bombBtn.classList.remove('show');
    pauseBtn.classList.add('gone');
  } else if (state === 'victory') {
    showOverlay(victoryMarkup(data), true);
    bombBtn.classList.remove('show');
    pauseBtn.classList.add('gone');
  }
};

game.onHud = (hud) => {
  bombCount.textContent = String(hud.bombs);
  bombBtn.classList.toggle('empty', hud.bombs <= 0);
  bombBtn.disabled = hud.bombs <= 0;
  if (hud.state === 'playing' || hud.state === 'paused') bombBtn.classList.add('show');
};

screen.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  game.audio.init();
  applyMute();
  game.audio.ui();
  if (act === 'start') startWithAudio();
  else if (act === 'resume') game.resume();
  else if (act === 'retry') startWithAudio();
  else if (act === 'menu') game.openMenu();
});

bombBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  game.audio.init();
  game.useBomb();
});

pauseBtn.addEventListener('click', () => {
  game.audio.init();
  game.togglePause();
});

soundBtn.addEventListener('click', () => {
  game.audio.init();
  muted = !muted;
  applyMute();
  if (!muted) game.audio.ui();
});

window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'm' && !e.repeat) {
    muted = !muted;
    game.audio.init();
    applyMute();
  }
  if (e.key === 'Enter' && !e.repeat) {
    if (game.state === 'menu') startWithAudio();
    else if (game.state === 'gameover' || game.state === 'victory') startWithAudio();
  }
});

function syncInsets() {
  document.documentElement.style.setProperty('--play-right', `${Math.max(0, Math.round(game.ox))}px`);
  document.documentElement.style.setProperty('--play-bottom', `${Math.max(0, Math.round(game.oy))}px`);
}

window.addEventListener('resize', syncInsets);
window.addEventListener('orientationchange', () => setTimeout(syncInsets, 160));
syncInsets();

// Initial state
applyMute();
game.openMenu();

// Debug / capture helpers: ?play=1&stage=2&boss=1&invincible=1
const params = new URLSearchParams(location.search);
if (params.get('play') === '1') {
  game.audio.init();
  applyMute();
  game.startGame();
  const stage = Math.max(1, Math.min(2, Number(params.get('stage') || 1)));
  if (params.get('boss') === '1') game.debugBoss(stage, params.get('invincible') !== '0');
  else if (stage === 2) {
    game.startStage(2);
  }
}

window.__GAME = game;
window.__START = () => startWithAudio();
window.__MUTE = (on) => {
  muted = !!on;
  applyMute();
};
