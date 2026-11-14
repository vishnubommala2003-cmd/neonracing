import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Persistent JSON Database Path
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial Seed Database
const INITIAL_DB = {
  profile: {
    username: 'ApexRacer',
    credits: 2500,
    currentLevel: 1,
    unlockedLevel: 1,
    levelStars: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
    ownedCars: ['triumph', 'vortex'],
    upgrades: {
      triumph: { speed: 0, nitro: 0, handling: 0, accel: 0 },
      vortex: { speed: 0, nitro: 0, handling: 0, accel: 0 },
    },
    customs: {
      triumph: { color: 0x1856e8, underglow: 0x00f0ff },
      vortex: { color: 0xff4030, underglow: 0x38f5c2 },
    },
    bestTimes: {},
    totalRaces: 0,
    totalWins: 0,
    totalDriftDistance: 0,
  },
  leaderboard: {
    city: [
      { rank: 1, name: 'ApexGhost', car: 'Viper GT', time: 74.2, date: '2026-11-12' },
      { rank: 2, name: 'ShadowRacer', car: 'Triumph', time: 76.5, date: '2026-11-12' },
      { rank: 3, name: 'NeonPulse', car: 'Vortex', time: 78.1, date: '2026-11-13' },
      { rank: 4, name: 'CyberDrifter', car: 'Titan RS', time: 80.4, date: '2026-11-13' },
    ],
    london: [
      { rank: 1, name: 'BigBenRacer', car: 'Triumph', time: 78.4, date: '2026-11-12' },
      { rank: 2, name: 'RoyalApex', car: 'Phantom', time: 80.1, date: '2026-11-12' },
      { rank: 3, name: 'ThamesDrift', car: 'Blade R', time: 82.5, date: '2026-11-13' },
      { rank: 4, name: 'SpeedKingUK', car: 'Specter', time: 84.9, date: '2026-11-13' },
    ],
    desert: [
      { rank: 1, name: 'RedlineOutlaw', car: 'Titan RS', time: 82.0, date: '2026-11-11' },
      { rank: 2, name: 'CanyonStorm', car: 'Viper GT', time: 83.8, date: '2026-11-12' },
      { rank: 3, name: 'DuneRider', car: 'Triumph', time: 85.2, date: '2026-11-13' },
    ],
    tokyo: [
      { rank: 1, name: 'ShutoDemon', car: 'Phantom', time: 77.2, date: '2026-11-12' },
      { rank: 2, name: 'MidnightWangan', car: 'Vortex', time: 79.0, date: '2026-11-12' },
      { rank: 3, name: 'TokyoApex', car: 'Triumph', time: 81.3, date: '2026-11-13' },
    ],
    coastal: [
      { rank: 1, name: 'PacificDrift', car: 'Blade R', time: 71.5, date: '2026-11-11' },
      { rank: 2, name: 'OceanBreeze', car: 'Triumph', time: 73.8, date: '2026-11-12' },
      { rank: 3, name: 'CliffHanger', car: 'Specter', time: 75.4, date: '2026-11-13' },
    ],
    alpine: [
      { rank: 1, name: 'MountainKing', car: 'Viper GT', time: 80.5, date: '2026-11-12' },
      { rank: 2, name: 'SnowDrifter', car: 'Triumph', time: 82.9, date: '2026-11-12' },
      { rank: 3, name: 'AlpineApex', car: 'Titan RS', time: 85.1, date: '2026-11-13' },
    ],
    cyber: [
      { rank: 1, name: 'NeoGridMaster', car: 'Phantom', time: 76.8, date: '2026-11-12' },
      { rank: 2, name: 'SynthRunner', car: 'Vortex', time: 78.9, date: '2026-11-12' },
      { rank: 3, name: 'CyberRacerX', car: 'Triumph', time: 80.7, date: '2026-11-13' },
    ],
    orbital: [
      { rank: 1, name: 'HyperionChamp', car: 'Phantom', time: 84.1, date: '2026-11-11' },
      { rank: 2, name: 'CosmicRider', car: 'Titan RS', time: 86.4, date: '2026-11-12' },
      { rank: 3, name: 'SpaceVelocity', car: 'Triumph', time: 88.2, date: '2026-11-13' },
    ],
  },
  raceHistory: [],
};

// Database helper functions
function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      writeDb(INITIAL_DB);
      return INITIAL_DB;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Error reading db.json, returning initial seed:', err);
    return INITIAL_DB;
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing to db.json:', err);
  }
}

// 1. Health & Server Info
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    server: 'Node.js / Express',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    features: ['profiles', 'leaderboard', 'level-progression', 'workshop-sync'],
  });
});

// 2. Player Profile (Get & Save)
app.get('/api/profile', (req, res) => {
  const db = readDb();
  res.json({ success: true, profile: db.profile });
});

app.post('/api/profile', (req, res) => {
  const db = readDb();
  const incoming = req.body || {};
  db.profile = {
    ...db.profile,
    ...incoming,
    upgrades: { ...db.profile.upgrades, ...(incoming.upgrades || {}) },
    customs: { ...db.profile.customs, ...(incoming.customs || {}) },
    levelStars: { ...db.profile.levelStars, ...(incoming.levelStars || {}) },
    bestTimes: { ...db.profile.bestTimes, ...(incoming.bestTimes || {}) },
  };
  writeDb(db);
  res.json({ success: true, profile: db.profile });
});

// 3. Leaderboard (Get by Track/Level & Submit Time)
app.get('/api/leaderboard', (req, res) => {
  const db = readDb();
  const track = req.query.track || 'city';
  const list = db.leaderboard[track] || [];
  res.json({
    success: true,
    track,
    leaderboard: list.slice(0, 10),
  });
});

app.post('/api/leaderboard', (req, res) => {
  const { trackId = 'city', playerName = 'ApexRacer', carName = 'Triumph', time = 0, driftDistance = 0, position = 1 } = req.body;
  const db = readDb();

  if (!db.leaderboard[trackId]) {
    db.leaderboard[trackId] = [];
  }

  const newEntry = {
    name: playerName,
    car: carName,
    time: parseFloat(time.toFixed(2)),
    driftDistance: Math.round(driftDistance),
    position,
    date: new Date().toISOString().split('T')[0],
  };

  db.leaderboard[trackId].push(newEntry);
  // Sort fastest lap time first
  db.leaderboard[trackId].sort((a, b) => a.time - b.time);
  // Re-rank
  db.leaderboard[trackId].forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  // Track player stats in db.profile
  db.profile.totalRaces = (db.profile.totalRaces || 0) + 1;
  if (position === 1) db.profile.totalWins = (db.profile.totalWins || 0) + 1;
  db.profile.totalDriftDistance = (db.profile.totalDriftDistance || 0) + Math.round(driftDistance);

  // Keep race history
  db.raceHistory = db.raceHistory || [];
  db.raceHistory.unshift({ ...newEntry, trackId, timestamp: new Date().toISOString() });
  if (db.raceHistory.length > 50) db.raceHistory = db.raceHistory.slice(0, 50);

  writeDb(db);

  const playerRank = db.leaderboard[trackId].findIndex((e) => e === newEntry) + 1;
  res.json({
    success: true,
    playerRank,
    entry: newEntry,
    leaderboard: db.leaderboard[trackId].slice(0, 10),
  });
});

// 4. Workshop Quick Upgrade
app.post('/api/workshop/upgrade', (req, res) => {
  const { carId = 'triumph', upgradeType = 'speed' } = req.body;
  const db = readDb();

  if (!db.profile.upgrades[carId]) {
    db.profile.upgrades[carId] = { speed: 0, nitro: 0, handling: 0, accel: 0 };
  }

  const curLevel = db.profile.upgrades[carId][upgradeType] || 0;
  if (curLevel >= 2) {
    return res.status(400).json({ success: false, message: 'Max upgrade level reached' });
  }

  if (db.profile.credits < 50) {
    return res.status(400).json({ success: false, message: 'Insufficient cash (50 💵 required)' });
  }

  db.profile.credits -= 50;
  db.profile.upgrades[carId][upgradeType] = curLevel + 1;
  writeDb(db);

  res.json({
    success: true,
    credits: db.profile.credits,
    upgrades: db.profile.upgrades[carId],
    message: `Upgraded ${upgradeType} to Stage ${curLevel + 1}`,
  });
});

// 5. Claim Workshop +200 FREE Reward
app.post('/api/reward/bonus', (req, res) => {
  const db = readDb();
  const reward = 200;
  db.profile.credits = (db.profile.credits || 0) + reward;
  writeDb(db);

  res.json({
    success: true,
    reward,
    credits: db.profile.credits,
    message: `+${reward} cash claimed successfully`,
  });
});

// 6. Overall Stats
app.get('/api/stats', (req, res) => {
  const db = readDb();
  res.json({
    success: true,
    stats: {
      totalRaces: db.profile.totalRaces || 0,
      totalWins: db.profile.totalWins || 0,
      totalDriftDistance: db.profile.totalDriftDistance || 0,
      unlockedLevels: db.profile.unlockedLevel || 1,
      credits: db.profile.credits || 0,
    },
  });
});

// Start Express Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Apex Rush Backend] Node.js Express server running at http://localhost:${PORT}/`);
  console.log(`[Apex Rush Backend] Endpoints: /api/health, /api/profile, /api/leaderboard, /api/workshop/upgrade`);
});

