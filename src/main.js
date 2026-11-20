import { CAR_DATA, RacingGame } from './game.js';
import { TRACKS, LEVELS } from './tracks.js';
import { RaceAudio } from './audio.js';
import { BackendAPI } from './api.js';
import './style.css';

const STORAGE_KEY = 'neon-gt-racing-save-v1';
const defaults = {
  music: true,
  sound: true,
  quality: 'high',
  steeringMode: 'buttons',
  haptics: true,
  coins: 542,
  gems: 0,
  currentLevel: 1,
  unlockedLevel: 1,
  levelStars: { 1: 3, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
  upgrades: {
    triumph: { speed: 0, nitro: 0, handling: 0, accel: 0 },
  },
  customs: {
    triumph: { color: 0x0099ff },
  },
  bestTimes: {
    london: '00:51:72',
    city: '00:48:35',
  },
};

let saved;
try {
  saved = { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  if (typeof saved.coins !== 'number') saved.coins = 542;
  if (typeof saved.gems !== 'number') saved.gems = 0;
  if (typeof saved.currentLevel !== 'number') saved.currentLevel = 1;
  if (typeof saved.unlockedLevel !== 'number') saved.unlockedLevel = 1;
  if (!saved.levelStars) saved.levelStars = { 1: 3 };
  if (!saved.upgrades) saved.upgrades = { triumph: { speed: 0, nitro: 0, handling: 0, accel: 0 } };
  if (!saved.customs || !saved.customs.triumph || !saved.customs.triumph.color) {
    saved.customs = { triumph: { color: 0x0099ff } };
  }
  if (!saved.bestTimes) saved.bestTimes = { london: '00:51:72' };
} catch (e) {
  console.warn('Fallback to default game state', e);
  saved = { ...defaults };
}

let selectedCarIndex = 0;
let selectedTrackKey = 'london';
let currentScreen = 'garage';
let lastRaceResult = null;

const $ = (s) => document.querySelector(s);
const screens = [...document.querySelectorAll('.screen')];
const navButtons = [...document.querySelectorAll('.top-links button')];
const sceneRoot = $('#scene-root');
const minimapCanvas = $('#minimap-canvas');
const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

function triggerHaptic(pattern = 20) {
  if (saved && saved.haptics !== false && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern); } catch (e) {}
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch (e) {
    console.warn('Failed to save state to localStorage', e);
  }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toFixed(2).padStart(5, '0');
  return `${m}:${s}`;
}

function ordinal(pos) {
  return `${pos}${pos === 1 ? 'ST' : pos === 2 ? 'ND' : pos === 3 ? 'RD' : 'TH'}`;
}

function showScreen(id) {
  currentScreen = id;
  screens.forEach((s) => s.classList.toggle('active', s.id === id));
  navButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.screen === id));
  document.body.classList.toggle('in-race', id === 'race');

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (id === 'race') {
    requestAnimationFrame(() => {
      game.resize();
      window.dispatchEvent(new Event('resize'));
    });
  }
  if (id === 'leaderboard') {
    renderLeaderboard();
  }
}

// Global button click navigation for any [data-screen]
document.querySelectorAll('[data-screen]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    showScreen(btn.dataset.screen);
  });
});

const audio = new RaceAudio();

const game = new RacingGame(sceneRoot, {
  onRaceStart(track) {
    audio.start({ music: saved.music, sound: saved.sound });
    audio.setInRace(true);

    const curLvl = LEVELS.find((l) => l.trackKey === selectedTrackKey) || LEVELS[0];
    const trackTitle = curLvl.roadName ? `${curLvl.roadName.toUpperCase()} — ${curLvl.name.toUpperCase()}` : track.name.toUpperCase();

    if ($('#hud-track-title')) $('#hud-track-title').textContent = trackTitle;
    if ($('#hud-lap')) $('#hud-lap').textContent = `1 / ${track.laps}`;
    if ($('#position')) $('#position').textContent = '1 / 8';
    if ($('#speed')) $('#speed').textContent = '0';
    if ($('#drift-dist')) $('#drift-dist').textContent = '0 m';

    const skyline = $('#race-skyline');
    if (skyline) skyline.textContent = `${curLvl.name.toUpperCase()} • ${curLvl.roadName ? curLvl.roadName.toUpperCase() : 'CIRCUIT'}`;

    const msg = $('#race-message');
    if (msg) msg.textContent = 'READY? TAP ACCELERATE OR PRESS W';

    const cd = $('#countdown');
    if (cd) cd.classList.remove('go', 'visible');

    showScreen('race');
  },

  onCountdown(val) {
    const cd = $('#countdown');
    const cdNum = $('#countdown-number');
    const cdStage = $('#countdown-stage');
    const msg = $('#race-message');
    const p3 = $('#pip-3');
    const p2 = $('#pip-2');
    const p1 = $('#pip-1');
    if (!cd) return;

    // Trigger pop-anim reflow for crisp number punch
    if (cdNum) {
      cdNum.classList.remove('pop-anim');
      void cdNum.offsetWidth;
      cdNum.classList.add('pop-anim');
    }

    if (val > 0) {
      if (cdNum) cdNum.textContent = val;
      cd.classList.add('visible');
      cd.classList.remove('go');
      audio.countdownBeep(false);
      triggerHaptic(30);

      if (val === 3) {
        if (cdStage) cdStage.textContent = 'STAGE 1 • GET READY';
        if (msg) msg.textContent = '🏁 READY... 3';
        p3?.classList.add('active');
        p2?.classList.remove('active');
        p1?.classList.remove('active');
      } else if (val === 2) {
        if (cdStage) cdStage.textContent = 'STAGE 2 • REV ENGINES';
        if (msg) msg.textContent = '🔥 REV ENGINES... 2';
        p3?.classList.add('active');
        p2?.classList.add('active');
        p1?.classList.remove('active');
      } else if (val === 1) {
        if (cdStage) cdStage.textContent = 'STAGE 3 • GET SET';
        if (msg) msg.textContent = '⚡ GET SET... 1';
        p3?.classList.add('active');
        p2?.classList.add('active');
        p1?.classList.add('active');
      }
    } else {
      if (cdNum) cdNum.textContent = 'GO!';
      if (cdStage) cdStage.textContent = 'GREEN FLAG • FLOOR IT!';
      cd.classList.add('go', 'visible');
      p3?.classList.add('active');
      p2?.classList.add('active');
      p1?.classList.add('active');
      audio.countdownBeep(true);
      triggerHaptic(100);
      if (msg) msg.textContent = '🏁 GO! HIT ACCELERATE & NITRO!';
      window.setTimeout(() => {
        cd.classList.remove('visible', 'go');
        if (msg) msg.textContent = 'DRIFT INTO CORNERS TO BUILD DISTANCE!';
      }, 1400);
    }
  },

  onUpdate(state) {
    if ($('#speed')) $('#speed').textContent = Math.round(state.speed);
    if ($('#position')) $('#position').textContent = `${state.position} / 8`;
    if ($('#hud-lap')) $('#hud-lap').textContent = `${state.lap} / ${state.totalLaps}`;
    if ($('#drift-dist')) $('#drift-dist').textContent = `${state.driftDistance || 0} m`;

    const msg = $('#race-message');
    if (msg && state.speed > 5) {
      if (state.nitroActive) {
        msg.textContent = '⚡ NITRO BOOST ACTIVE! SPEED SURGE!';
      } else if (state.isDrifting) {
        msg.textContent = `🔥 DRIFTING! DISTANCE: ${state.driftDistance} m`;
      } else if (state.speed > 180) {
        msg.textContent = 'MAXIMUM VELOCITY! HOLD THE APEX!';
      }
    }

    // Audio update
    audio.update(state.speed, state.nitroActive, state.isDrifting ? 1.0 : 0.0, state.speed / 280, state.isSlowMo);

    // Mini-map radar
    if (minimapCtx && state.trackMinimapPoints) {
      drawMinimap(state);
    }
  },

  onLap(lapNumber) {
    audio.lapComplete();
    showToast(`LAP ${lapNumber} COMPLETED!`);
    triggerHaptic([35, 25, 60]);
  },

  onBoostPad() {
    audio.boostPad();
    showToast('⚡ BOOST PAD ACTIVATED! +240 KM/H!');
    triggerHaptic(40);
  },

  onPickup() {
    audio.pickup();
    showToast('🔋 N₂O NITRO TANK REFILLED!');
    triggerHaptic(20);
  },

  onDashTakedown(data) {
    audio.dashTakedown();
    triggerHaptic([80, 50, 100, 60, 120]);
    const bonus = data.coins || 250;
    saved.coins += bonus;
    persist();
    updateWalletUI();

    const overlay = $('#dash-takedown-overlay');
    if (overlay) {
      overlay.classList.add('active');
      const title = overlay.querySelector('.takedown-title');
      if (title) title.textContent = '💥 DASH TAKEDOWN!';
      const sub = overlay.querySelector('.takedown-sub');
      if (sub) sub.textContent = `+${bonus} 🪙 REWARD • FULL NITRO REFILL!`;
    }
    const bars = $('#cinematic-bars');
    if (bars) bars.classList.add('active');

    const msg = $('#race-message');
    if (msg) msg.textContent = `💥 RIVAL TAKEDOWN! +${bonus} COINS • NITRO REFILLED!`;
  },

  onDashEnd() {
    const overlay = $('#dash-takedown-overlay');
    if (overlay) overlay.classList.remove('active');
    const bars = $('#cinematic-bars');
    if (bars) bars.classList.remove('active');
  },

  onCollision(type) {
    audio.collision();
    if (type === 'wall') {
      showToast('⚠️ BARRIER CONTACT — SPEED RESET!');
      const msg = $('#race-message');
      if (msg) msg.textContent = '⚠️ IMPACT! HIT ACCELERATE TO RESUME SPEED!';
    } else {
      showToast('⚠️ VEHICLE CONTACT');
    }
    triggerHaptic([45, 30, 50]);
  },

  onWallHit(side) {
    audio.collision();
    showToast(`⚠️ ${side.toUpperCase()} BARRIER HIT — SPEED RESET!`);
    const msg = $('#race-message');
    if (msg) msg.textContent = '⚠️ IMPACT! HIT ACCELERATE TO RESUME SPEED!';
    triggerHaptic([50, 40, 60]);
  },

  onDriftComplete(dist) {
    const bonus = dist * 5;
    saved.coins += bonus;
    persist();
    updateWalletUI();
    showToast(`DRIFT ${dist} m! +${bonus} 🪙 COINS`);
    triggerHaptic([30, 20, 50]);
  },

  onFinish(res) {
    audio.setInRace(false);
    audio.finishFanfare(res.won);

    const curLvl = LEVELS.find((l) => l.trackKey === selectedTrackKey) || LEVELS[0];
    const playerStanding = res.standings.find((s) => s.isPlayer);
    const playerPos = playerStanding ? playerStanding.position : 1;
    const isFirst = playerPos === 1;

    let starsEarned = 1;
    if (playerPos === 1) starsEarned = 3;
    else if (playerPos <= 3) starsEarned = 2;

    const prevStars = saved.levelStars[curLvl.level] || 0;
    if (starsEarned > prevStars) {
      saved.levelStars[curLvl.level] = starsEarned;
    }

    if (playerPos <= 3 && curLvl.level < LEVELS.length && saved.unlockedLevel <= curLvl.level) {
      saved.unlockedLevel = curLvl.level + 1;
    }

    const coinReward = 120 + (isFirst ? 80 : 40);
    saved.coins += coinReward;

    // Track best time
    const prevBest = saved.bestTimes[selectedTrackKey];
    const timeFormatted = formatTime(res.time);
    if (!prevBest || res.time < 52) {
      saved.bestTimes[selectedTrackKey] = timeFormatted;
    }

    lastRaceResult = {
      ...res,
      playerPos,
      timeFormatted,
      coinReward,
      starsEarned,
      curLvl,
    };

    persist();
    updateWalletUI();
    updateCarStatsUI();
    renderEvents();
    renderLevels();

    // Populate Results Screen
    if ($('#result-title')) $('#result-title').textContent = isFirst ? 'VICTORY!' : 'FINISH!';
    if ($('#result-rank')) $('#result-rank').textContent = ordinal(playerPos) + ' PLACE';
    if ($('#result-time')) $('#result-time').textContent = timeFormatted;
    if ($('#result-coins')) $('#result-coins').textContent = `+${coinReward} 🪙`;
    if ($('#result-stars')) $('#result-stars').textContent = '★'.repeat(starsEarned) + '☆'.repeat(3 - starsEarned);

    // Sync with Node.js Express backend
    BackendAPI.submitRaceScore({
      trackId: selectedTrackKey,
      playerName: 'You (Apex GT)',
      carName: 'Apex GT',
      time: res.time,
      driftDistance: res.driftBonus ? res.driftBonus * 2 : 140,
      position: playerPos,
    });
    BackendAPI.saveProfile(saved);

    showScreen('results');
  },
});

function showToast(text) {
  const toast = $('#race-toast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add('visible');
  window.clearTimeout(toast._timer);
  toast._timer = window.setTimeout(() => toast.classList.remove('visible'), 1200);
}

function drawMinimap(state) {
  if (!minimapCanvas || !minimapCtx) return;
  const w = minimapCanvas.width;
  const h = minimapCanvas.height;
  minimapCtx.clearRect(0, 0, w, h);

  // Background radar grid
  minimapCtx.strokeStyle = 'rgba(56, 245, 194, 0.15)';
  minimapCtx.lineWidth = 1;
  minimapCtx.strokeRect(3, 3, w - 6, h - 6);

  // Track loop
  minimapCtx.beginPath();
  const pts = state.trackMinimapPoints;
  for (let i = 0; i < pts.length; i++) {
    const px = (pts[i].x + 0.5) * (w - 20) + 10;
    const py = (pts[i].y + 0.5) * (h - 20) + 10;
    if (i === 0) minimapCtx.moveTo(px, py);
    else minimapCtx.lineTo(px, py);
  }
  minimapCtx.closePath();
  minimapCtx.strokeStyle = 'rgba(124, 232, 255, 0.6)';
  minimapCtx.lineWidth = 3;
  minimapCtx.stroke();

  // Draw AI Blips
  state.minimapAI.forEach((ai) => {
    const ax = (ai.coord.x + 0.5) * (w - 20) + 10;
    const ay = (ai.coord.y + 0.5) * (h - 20) + 10;
    minimapCtx.beginPath();
    minimapCtx.arc(ax, ay, 2.5, 0, Math.PI * 2);
    minimapCtx.fillStyle = `#${ai.color.toString(16).padStart(6, '0')}`;
    minimapCtx.fill();
  });

  // Draw Player Blip
  const p = state.minimapPlayer;
  const px = (p.x + 0.5) * (w - 20) + 10;
  const py = (p.y + 0.5) * (h - 20) + 10;
  minimapCtx.beginPath();
  minimapCtx.arc(px, py, 4, 0, Math.PI * 2);
  minimapCtx.fillStyle = '#ffc928';
  minimapCtx.shadowColor = '#ffc928';
  minimapCtx.shadowBlur = 8;
  minimapCtx.fill();
  minimapCtx.shadowBlur = 0;
}

function updateWalletUI() {
  if ($('#coins')) $('#coins').textContent = saved.coins.toLocaleString();
  if ($('#gems')) $('#gems').textContent = (saved.gems || 0).toString();

  let totalStars = 0;
  Object.values(saved.levelStars || {}).forEach((s) => (totalStars += s));
  if ($('#stars')) $('#stars').textContent = totalStars.toString();
  if ($('#champ-total-stars')) $('#champ-total-stars').textContent = `${totalStars} / 24 ⭐`;
  if ($('#champ-current-lvl')) $('#champ-current-lvl').textContent = `LEVEL ${saved.unlockedLevel || 1}`;
}

function updateCarStatsUI() {
  const up = saved.upgrades.triumph || { speed: 0, nitro: 0, handling: 0, accel: 0 };

  const topSpeed = 188 + (up.speed || 0) * 8;
  const nitroSec = 7 + (up.nitro || 0) * 2;
  const accelVal = 15 + (up.accel || 0) * 5;
  const handlingVal = 30 + (up.handling || 0) * 6;
  const rating = (240.0 + (up.speed || 0) * 6 + (up.nitro || 0) * 4 + (up.handling || 0) * 4 + (up.accel || 0) * 3).toFixed(1);

  if ($('#car-rating')) $('#car-rating').textContent = rating;
  if ($('#select-car-rating')) $('#select-car-rating').textContent = rating;
  if ($('#footer-car-rating')) $('#footer-car-rating').textContent = rating;

  if ($('#garage-speed-text')) $('#garage-speed-text').textContent = `${topSpeed} km/h`;
  if ($('#garage-speed-bar')) $('#garage-speed-bar').style.width = `${Math.min(100, Math.round((topSpeed / 240) * 100))}%`;

  if ($('#garage-nitro-text')) $('#garage-nitro-text').textContent = `${nitroSec} s`;
  if ($('#garage-nitro-bar')) $('#garage-nitro-bar').style.width = `${Math.min(100, Math.round((nitroSec / 15) * 100))}%`;

  if ($('#garage-accel-text')) $('#garage-accel-text').textContent = `${accelVal} km/h`;
  if ($('#garage-accel-bar')) $('#garage-accel-bar').style.width = `${Math.min(100, Math.round((accelVal / 35) * 100))}%`;

  if ($('#garage-handling-text')) $('#garage-handling-text').textContent = `${handlingVal} ss`;
  if ($('#garage-handling-bar')) $('#garage-handling-bar').style.width = `${Math.min(100, Math.round((handlingVal / 55) * 100))}%`;

  // Select stats
  if ($('#sel-stat-speed')) $('#sel-stat-speed').textContent = `${topSpeed} km/h`;
  if ($('#sel-meter-speed')) $('#sel-meter-speed').style.width = `${Math.min(100, Math.round((topSpeed / 240) * 100))}%`;

  if ($('#sel-stat-nitro')) $('#sel-stat-nitro').textContent = `${nitroSec} seconds`;
  if ($('#sel-meter-nitro')) $('#sel-meter-nitro').style.width = `${Math.min(100, Math.round((nitroSec / 15) * 100))}%`;

  if ($('#sel-stat-accel')) $('#sel-stat-accel').textContent = `${accelVal} km/h`;
  if ($('#sel-meter-accel')) $('#sel-meter-accel').style.width = `${Math.min(100, Math.round((accelVal / 35) * 100))}%`;

  if ($('#sel-stat-handling')) $('#sel-stat-handling').textContent = `${handlingVal}`;
  if ($('#sel-meter-handling')) $('#sel-meter-handling').style.width = `${Math.min(100, Math.round((handlingVal / 55) * 100))}%`;

  if ($('#upgrade-message')) $('#upgrade-message').textContent = `Your current rating is ${rating}.`;
}

function renderEvents() {
  const container = $('#events-grid');
  if (!container) return;

  container.innerHTML = '';

  const themeClasses = ['london', 'bridge', 'tokyo', 'desert', 'coastal', 'alpine', 'cyber', 'orbital'];
  const flagIcons = ['🇬🇧', '🇬🇧', '🇯🇵', '🏜️', '🌊', '🏔️', '🌆', '🚀'];

  LEVELS.forEach((lvl, idx) => {
    const isUnlocked = lvl.level <= saved.unlockedLevel;
    const isChosen = lvl.trackKey === selectedTrackKey;
    const stars = saved.levelStars[lvl.level] || 0;
    const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    const themeClass = themeClasses[idx % themeClasses.length];

    const card = document.createElement('button');
    card.className = `event-card ${isChosen ? 'chosen' : ''} ${!isUnlocked ? 'locked' : ''}`;
    card.dataset.trackKey = lvl.trackKey;
    card.dataset.level = lvl.level;

    card.innerHTML = `
      <div class="event-thumb ${themeClass}">
        ${!isUnlocked ? '🔒' : flagIcons[idx] + ' ' + (lvl.roadName ? lvl.roadName.split(' ')[0].toUpperCase() : lvl.name.toUpperCase())}
      </div>
      <b>${lvl.name}</b>
      <span>${isUnlocked ? `Apex GT · ${starStr}` : `${lvl.level * 3} ⭐ REQUIRED`}</span>
      <small>${lvl.roadName || 'Circuit run'}</small>
    `;

    if (isUnlocked) {
      card.addEventListener('click', () => {
        document.querySelectorAll('.event-card').forEach((c) => c.classList.remove('chosen'));
        card.classList.add('chosen');
        selectedTrackKey = lvl.trackKey;
        saved.currentLevel = lvl.level;
        persist();

        if ($('#selected-event')) $('#selected-event').textContent = lvl.name;
        if ($('#selected-event-desc')) {
          $('#selected-event-desc').innerHTML = `Road: <b>${lvl.roadName}</b> · Target: <b>Top ${lvl.targetPosition}</b>`;
        }
      });
    }

    container.appendChild(card);
  });

  const activeLevel = LEVELS.find((l) => l.trackKey === selectedTrackKey) || LEVELS[0];
  if ($('#selected-event')) $('#selected-event').textContent = activeLevel.name;
  if ($('#selected-event-desc')) {
    $('#selected-event-desc').innerHTML = `Road: <b>${activeLevel.roadName}</b> · Target: <b>Top ${activeLevel.targetPosition}</b>`;
  }
}

function renderLevels() {
  const grid = $('#levels-grid-cards');
  if (!grid) return;
  grid.innerHTML = '';

  LEVELS.forEach((lvl) => {
    const isUnlocked = lvl.level <= saved.unlockedLevel;
    const isCurrent = lvl.level === saved.currentLevel;
    const stars = saved.levelStars[lvl.level] || 0;

    const card = document.createElement('div');
    card.className = `level-card ${isCurrent ? 'active-level' : ''} ${!isUnlocked ? 'locked' : ''}`;

    card.innerHTML = `
      <div class="level-card-top">
        <span class="level-num-pill">LEVEL ${lvl.level} OF 8</span>
        <span class="level-stars-display">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>
      </div>
      <h3>${lvl.name}</h3>
      <p class="level-road-tag">🛣️ ${lvl.roadName}</p>
      <div class="level-prize">REWARD: +${lvl.reward} 🪙</div>
      <button class="small-btn" style="margin-top:6px;width:100%" ${!isUnlocked ? 'disabled' : ''}>
        ${!isUnlocked ? '🔒 LOCKED' : isCurrent ? 'CURRENT RACE ▶' : 'SELECT LEVEL'}
      </button>
    `;

    if (isUnlocked) {
      card.addEventListener('click', () => {
        saved.currentLevel = lvl.level;
        selectedTrackKey = lvl.trackKey;
        persist();
        renderLevels();
        renderEvents();
        showScreen('car-select');
      });
    }

    grid.appendChild(card);
  });
}

async function renderLeaderboard() {
  const tbody = $('#lb-table-body');
  if (!tbody) return;

  try {
    const data = await BackendAPI.fetchLeaderboard(selectedTrackKey);
    const records = data.records || [];
    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--muted)">No records yet. Be the first to set a lap!</td></tr>';
      return;
    }

    tbody.innerHTML = records
      .map(
        (r, i) => `
        <tr>
          <td>#${i + 1}</td>
          <td><b>${r.playerName || 'Racer'}</b></td>
          <td>${r.carName || 'Apex GT'}</td>
          <td>${r.trackId.toUpperCase()}</td>
          <td><b style="color:var(--gold)">${typeof r.time === 'number' ? formatTime(r.time) : r.time}</b></td>
          <td>${r.driftDistance || 0} m</td>
        </tr>
      `
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#ff6b6b">Could not connect to Node.js Leaderboard API.</td></tr>';
  }
}

// Fullscreen Management for Mobile & Desktop
function requestFullscreenSafe() {
  const docEl = document.documentElement;
  const rfs = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
  if (rfs && !document.fullscreenElement && !document.webkitFullscreenElement) {
    rfs.call(docEl).catch(() => {});
  }
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(() => {});
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    requestFullscreenSafe();
  } else {
    const efs = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
    if (efs) efs.call(document).catch(() => {});
  }
}

$('#btn-fullscreen-top')?.addEventListener('click', (e) => {
  e.preventDefault();
  toggleFullscreen();
});

$('#btn-fullscreen-hud')?.addEventListener('click', (e) => {
  e.preventDefault();
  toggleFullscreen();
});

$('#btn-exit-race')?.addEventListener('click', (e) => {
  e.preventDefault();
  audio.setInRace(false);
  game.clearRaceVehicles();
  showScreen('garage');
});

// Music Song Player Controls & UI Synchronization
function updateTrackUi(track) {
  if (!track) return;
  const shortTitle = track.title.split('—')[0].trim();
  const topName = $('#top-track-name');
  if (topName) topName.textContent = shortTitle;
  const hudName = $('#hud-track-name');
  if (hudName) hudName.textContent = shortTitle;
}

audio.onTrackChange((track) => {
  updateTrackUi(track);
});

$('#btn-next-track')?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  audio.start({ music: saved.music, sound: saved.sound });
  const t = audio.nextTrack();
  updateTrackUi(t);
});

$('#btn-prev-track')?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  audio.start({ music: saved.music, sound: saved.sound });
  const t = audio.prevTrack();
  updateTrackUi(t);
});

$('#btn-hud-next-track')?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  audio.start({ music: saved.music, sound: saved.sound });
  const t = audio.nextTrack();
  updateTrackUi(t);
});

$('#music-pill')?.addEventListener('click', (e) => {
  if (e.target && e.target.closest('button')) return;
  e.preventDefault();
  audio.start({ music: saved.music, sound: saved.sound });
  const t = audio.nextTrack();
  updateTrackUi(t);
});

// Mobile Device Orientation & Landscape Management
function checkOrientation() {
  const isMobileOrTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.innerWidth <= 900;
  const isPortrait = window.innerHeight > window.innerWidth;
  const rotateOverlay = $('#rotate-overlay');
  if (rotateOverlay) {
    if (isMobileOrTouch && isPortrait) {
      rotateOverlay.classList.add('active');
    } else {
      rotateOverlay.classList.remove('active');
    }
  }
}

$('#btn-rotate-enter')?.addEventListener('click', (e) => {
  e.preventDefault();
  requestFullscreenSafe();
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(() => {});
  }
});

['fullscreenchange', 'webkitfullscreenchange', 'orientationchange', 'resize'].forEach((ev) => {
  window.addEventListener(ev, () => {
    checkOrientation();
    requestAnimationFrame(() => {
      game.resize();
    });
  });
});

// Start Race Trigger
function launchRace() {
  // Automatically activate immersive fullscreen on mobile / touch
  requestFullscreenSafe();

  const curLvl = LEVELS.find((l) => l.trackKey === selectedTrackKey) || LEVELS.find((l) => l.level === saved.currentLevel) || LEVELS[0];
  selectedTrackKey = curLvl.trackKey || 'london';

  const customOpts = (saved.customs && saved.customs.triumph) || { color: 0x0099ff };
  const upgrades = (saved.upgrades && saved.upgrades.triumph) || {};

  showScreen('race');

  requestAnimationFrame(() => {
    game.resize();
    window.dispatchEvent(new Event('resize'));
  });

  game.startRace(selectedCarIndex, selectedTrackKey, upgrades, customOpts, {
    laps: curLvl.laps || 3,
    aiSpeedScale: curLvl.aiSpeed || 1.0,
  });
}

$('#start-race')?.addEventListener('click', (e) => {
  e.preventDefault();
  launchRace();
});

$('#choose-car')?.addEventListener('click', (e) => {
  e.preventDefault();
  showScreen('car-select');
});

$('#enter-event-btn')?.addEventListener('click', (e) => {
  e.preventDefault();
  showScreen('car-select');
});

// Mode card RACING shortcut
document.querySelector('.mode-card[data-mode="racing"]')?.addEventListener('click', (e) => {
  e.preventDefault();
  showScreen('car-select');
});

$('#again')?.addEventListener('click', (e) => {
  e.preventDefault();
  launchRace();
});

$('#next-level-btn')?.addEventListener('click', (e) => {
  e.preventDefault();
  if (saved.currentLevel < LEVELS.length) {
    saved.currentLevel += 1;
    if (saved.unlockedLevel < saved.currentLevel) {
      saved.unlockedLevel = saved.currentLevel;
    }
    const nxt = LEVELS.find((l) => l.level === saved.currentLevel);
    if (nxt) selectedTrackKey = nxt.trackKey;
    persist();
  }
  launchRace();
});

// Color Swatches Selection for GT 86
const colorFilters = {
  '0x0099ff': 'none',
  '0xe62e2e': 'hue-rotate(155deg) saturate(1.2)',
  '0xffb800': 'hue-rotate(185deg) saturate(1.4) brightness(1.05)',
  '0x15191e': 'grayscale(0.9) brightness(0.65) contrast(1.2)',
  '0x00e6a8': 'hue-rotate(65deg) saturate(1.15)',
  '0x9d4edd': 'hue-rotate(240deg) saturate(1.25)',
};

function applyCarColorFilter(rawColor) {
  const filterVal = colorFilters[rawColor] || 'none';
  const heroImg = document.getElementById('hero-car-img');
  const selectImg = document.getElementById('select-car-img');
  if (heroImg) heroImg.style.filter = filterVal;
  if (selectImg) selectImg.style.filter = filterVal;
}

document.querySelectorAll('#color-swatches .color-dot').forEach((dot) => {
  dot.addEventListener('click', () => {
    document.querySelectorAll('#color-swatches .color-dot').forEach((d) => d.classList.remove('active'));
    dot.classList.add('active');

    const rawColor = dot.dataset.color;
    const hexColor = parseInt(rawColor, 16);
    saved.customs.triumph = { color: hexColor };
    persist();

    applyCarColorFilter(rawColor);
  });
});

// Workshop Upgrades with Node.js Backend Integration
document.querySelectorAll('[data-upgrade]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const upgradeName = btn.dataset.upgrade;
    let cost = 100;
    let typeKey = 'speed';

    if (upgradeName === 'Engine tune') {
      cost = 100;
      typeKey = 'speed';
    } else if (upgradeName === 'Nitro kit') {
      cost = 120;
      typeKey = 'nitro';
    } else if (upgradeName === 'Handling tyres') {
      cost = 90;
      typeKey = 'handling';
    } else if (upgradeName === 'Aero bodykit') {
      cost = 110;
      typeKey = 'accel';
    }

    if (saved.coins < cost) {
      if ($('#upgrade-message')) $('#upgrade-message').textContent = '⚠️ Not enough coins for this upgrade. Win more races!';
      return;
    }

    saved.coins -= cost;
    saved.upgrades.triumph[typeKey] = (saved.upgrades.triumph[typeKey] || 0) + 1;
    persist();

    updateWalletUI();
    updateCarStatsUI();

    btn.textContent = 'INSTALLED ✓';
    btn.disabled = true;
    window.setTimeout(() => {
      btn.disabled = false;
      btn.textContent = `UPGRADE · ${cost} 🪙`;
    }, 2500);

    // Call Node.js Backend API
    try {
      await BackendAPI.upgradeCar('triumph', typeKey);
      await BackendAPI.saveProfile(saved);
      if ($('#upgrade-message')) {
        $('#upgrade-message').textContent = `✓ ${upgradeName} installed successfully! Synced with Node.js database.`;
      }
    } catch (e) {
      if ($('#upgrade-message')) {
        $('#upgrade-message').textContent = `✓ ${upgradeName} applied locally!`;
      }
    }
  });
});

// Daily Rewards Claim with Node.js Backend
$('#claim')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  if (btn.disabled) return;

  const bonusCoins = 50;
  saved.coins += bonusCoins;
  persist();
  updateWalletUI();

  btn.disabled = true;
  btn.textContent = 'CLAIMED ✓';
  if ($('#reward-message')) $('#reward-message').textContent = `✓ +${bonusCoins} coins added to your wallet!`;

  try {
    await BackendAPI.claimDailyBonus(bonusCoins);
  } catch (err) {
    console.log('Reward claimed offline');
  }
});

// ON-SCREEN TOUCH & MOUSE CONTROLS (LEFT ON LEFT, RIGHT ON RIGHT)
function bindButton(btnId, onDown, onUp) {
  const el = $(btnId);
  if (!el) return;

  const handleDown = (e) => {
    e.preventDefault();
    el.classList.add('pressed');
    onDown();
  };

  const handleUp = (e) => {
    e.preventDefault();
    el.classList.remove('pressed');
    onUp();
  };

  el.addEventListener('pointerdown', handleDown);
  el.addEventListener('pointerup', handleUp);
  el.addEventListener('pointercancel', handleUp);
  el.addEventListener('pointerleave', handleUp);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

bindButton(
  '#steer-left',
  () => game.setTouch('left', true),
  () => game.setTouch('left', false)
);

bindButton(
  '#steer-right',
  () => game.setTouch('right', true),
  () => game.setTouch('right', false)
);

bindButton(
  '#accelerate',
  () => game.setTouch('accelerate', true),
  () => game.setTouch('accelerate', false)
);

bindButton(
  '#brake',
  () => game.setTouch('brake', true),
  () => game.setTouch('brake', false)
);

bindButton(
  '#nitro',
  () => game.setTouch('nitro', true),
  () => game.setTouch('nitro', false)
);

// KEYBOARD CONTROLS (WASD / ARROWS / SPACE / SHIFT / C)
window.addEventListener('keydown', (e) => {
  if (currentScreen !== 'race') return;
  const key = e.key.toLowerCase();
  game.setKey(key, true);

  if (key === 'c') {
    game.toggleCamera();
  }

  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  if (currentScreen !== 'race') return;
  game.setKey(e.key.toLowerCase(), false);
});

// INITIALIZATION
async function init() {
  updateWalletUI();
  updateCarStatsUI();
  renderEvents();
  renderLevels();

  // Initialize saved car color filter on GT 86 photo
  const curColorHex = (saved.customs && saved.customs.triumph && saved.customs.triumph.color) || 0x0099ff;
  const rawKey = '0x' + curColorHex.toString(16).padStart(6, '0');
  applyCarColorFilter(rawKey);

  document.querySelectorAll('#color-swatches .color-dot').forEach((dot) => {
    dot.classList.toggle('active', dot.dataset.color.toLowerCase() === rawKey.toLowerCase());
  });

  // Try fetching backend profile on launch
  try {
    const profile = await BackendAPI.fetchProfile();
    if (profile && profile.credits) {
      saved.coins = Math.max(saved.coins, profile.credits);
      persist();
      updateWalletUI();
    }
  } catch (e) {
    console.log('Backend sync offline fallback');
  }

  showScreen('garage');
  updateTrackUi(audio.getCurrentTrack());
  initSplashScreen();
  checkOrientation();
}

// Game Startup Splash Screen Logic (GT NEON RACING logo)
function initSplashScreen() {
  const splash = $('#splash-screen');
  const barFill = $('#splash-bar-fill');
  const statusText = $('#splash-status');
  const enterBtn = $('#splash-enter-btn');

  if (!splash) return;

  const stages = [
    { p: 25, msg: 'INITIALIZING 3D ENGINE...' },
    { p: 55, msg: 'TUNING APEX GT V8 TWIN-TURBO...' },
    { p: 85, msg: 'LOADING HIGH-OCTANE TRACKS...' },
    { p: 100, msg: 'READY TO RACE!' },
  ];

  let stageIdx = 0;
  const interval = setInterval(() => {
    if (stageIdx < stages.length) {
      const s = stages[stageIdx];
      if (barFill) barFill.style.width = `${s.p}%`;
      if (statusText) statusText.textContent = s.msg;
      stageIdx++;
    } else {
      clearInterval(interval);
      if (enterBtn) enterBtn.classList.add('ready');
      if (statusText) statusText.textContent = 'PRESS ANYWHERE TO ENTER RACING';
    }
  }, 220);

  const dismissSplash = (e) => {
    if (splash.classList.contains('splash-fade-out')) return;
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    unlockAudio();

    splash.classList.add('splash-fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
    }, 550);
  };

  enterBtn?.addEventListener('click', dismissSplash);
  splash.addEventListener('click', dismissSplash);
}

// Unlock AudioContext on first user interaction (touch, click, or key)
const unlockAudio = () => {
  audio.start({ music: saved.music, sound: saved.sound });
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
  window.removeEventListener('touchstart', unlockAudio);
};
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });
window.addEventListener('touchstart', unlockAudio, { once: true });

init();
