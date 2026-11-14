// Frontend API Client for Apex Rush Node.js Backend

const API_BASE = '/api';

export const BackendAPI = {
  isOnline: false,

  async checkHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        this.isOnline = true;
        return data;
      }
    } catch (e) {
      this.isOnline = false;
    }
    return null;
  },

  async getProfile() {
    try {
      const res = await fetch(`${API_BASE}/profile`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        return data.profile;
      }
    } catch (e) {
      console.warn('[BackendAPI] Could not fetch profile, using local cache:', e);
    }
    return null;
  },

  async saveProfile(profileData) {
    try {
      const res = await fetch(`${API_BASE}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        return data.profile;
      }
    } catch (e) {
      console.warn('[BackendAPI] Could not save profile to backend:', e);
    }
    return null;
  },

  async getLeaderboard(trackId = 'city') {
    try {
      const res = await fetch(`${API_BASE}/leaderboard?track=${encodeURIComponent(trackId)}`, {
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        return data.leaderboard;
      }
    } catch (e) {
      console.warn('[BackendAPI] Could not fetch leaderboard:', e);
    }
    return [];
  },

  async submitRaceScore(scoreData) {
    try {
      const res = await fetch(`${API_BASE}/leaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scoreData),
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('[BackendAPI] Score submission fallback:', e);
    }
    return null;
  },

  async upgradeCar(carId, upgradeType) {
    try {
      const res = await fetch(`${API_BASE}/workshop/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carId, upgradeType }),
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('[BackendAPI] Upgrade fallback:', e);
    }
    return null;
  },

  async claimBonus() {
    try {
      const res = await fetch(`${API_BASE}/reward/bonus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('[BackendAPI] Bonus claim fallback:', e);
    }
    return null;
  },
};

