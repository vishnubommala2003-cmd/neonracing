// Neon GT Racing — Audio Engine & Music System
// Real Studio Songs Playlist + Smooth, Non-Irritating Warm Sports Car Sound

export const PLAYLIST = [
  { id: 'syntheticity', title: 'Syntheticity — Cyber Arcade', artist: 'Tanner Helland', src: '/audio/syntheticity.mp3' },
  { id: 'defiance',     title: 'Defiance — Epic Speed',       artist: 'Tanner Helland', src: '/audio/defiance.mp3' },
  { id: 'dark_knight',  title: 'Dark Knight — Night Cruise',  artist: 'Tanner Helland', src: '/audio/dark_knight.mp3' }
];

export class RaceAudio {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.compressor = null;

    // Smooth, warm engine synthesizer (pleasant tones, zero harsh buzz)
    this.engineLowOsc = null;  // Sub rumble (warm sine)
    this.engineMidOsc = null;  // Cylinder purr (warm triangle)
    this.engineSubOsc = null;  // Deep exhaust resonance (sine)
    this.engineFilter = null;
    this.engineGain = null;

    // Tire drift & nitro thrust
    this.driftGain = null;
    this.driftFilter = null;
    this.nitroGain = null;
    this.nitroFilter = null;

    // Real Songs Player
    this.currentTrackIndex = 0;
    this.audioEl = null;
    this.mediaSource = null;
    this.musicGain = null;
    this.onTrackChangeCallback = null;

    // Gear shift tracking
    this.currentGear = 1;
    this.prevSpeed = 0;

    this.settings = { music: true, sound: true };
    this.inRace = false;
    this.isInitialized = false;
  }

  // Set callback for UI track title updates
  onTrackChange(cb) {
    this.onTrackChangeCallback = cb;
  }

  getCurrentTrack() {
    return PLAYLIST[this.currentTrackIndex];
  }

  start(settings) {
    if (settings) this.settings = { ...settings };

    // 1. Initialize HTML5 Music Player for real songs
    if (!this.audioEl) {
      this._initMusicPlayer();
    }

    // 2. Initialize Web Audio API for smooth SFX & engine
    if (!this.context) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.context = new AudioCtx();

        // Master Limiter / Compressor for clean, pleasant mixing
        this.compressor = this.context.createDynamicsCompressor();
        this.compressor.threshold.value = -12;
        this.compressor.knee.value = 24;
        this.compressor.ratio.value = 6;
        this.compressor.attack.value = 0.005;
        this.compressor.release.value = 0.2;
        this.compressor.connect(this.context.destination);

        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = 0.9;
        this.masterGain.connect(this.compressor);

        // Music bus
        this.musicGain = this.context.createGain();
        this.musicGain.gain.value = this.settings.music ? 0.75 : 0;
        this.musicGain.connect(this.masterGain);

        // Connect HTML5 audio element to Web Audio bus if possible
        try {
          if (!this.mediaSource && this.audioEl) {
            this.mediaSource = this.context.createMediaElementSource(this.audioEl);
            this.mediaSource.connect(this.musicGain);
          }
        } catch (e) {
          // Fallback: audioEl volume controlled directly
        }

        // Initialize smooth engine & noise chains
        this._initSmoothEngine();
        this._initGentleSfxChains();
      }
    }

    if (this.context && this.context.state === 'suspended') {
      this.context.resume().catch(() => {});
    }

    // Start playing background music if enabled
    if (this.settings.music && this.audioEl && this.audioEl.paused) {
      this._playCurrentSong();
    }

    this.setSettings(this.settings);
    this.isInitialized = true;
  }

  _initMusicPlayer() {
    this.audioEl = new Audio();
    this.audioEl.preload = 'auto';
    this.audioEl.volume = 0.7;

    // Load initial track
    this.audioEl.src = PLAYLIST[this.currentTrackIndex].src;

    // When song ends, seamlessly play next song
    this.audioEl.addEventListener('ended', () => {
      this.nextTrack();
    });

    // Notify listeners
    if (this.onTrackChangeCallback) {
      this.onTrackChangeCallback(PLAYLIST[this.currentTrackIndex]);
    }
  }

  _playCurrentSong() {
    if (!this.audioEl) return;
    const track = PLAYLIST[this.currentTrackIndex];
    if (!this.audioEl.src.endsWith(track.src)) {
      this.audioEl.src = track.src;
    }
    this.audioEl.currentTime = 0;
    const playPromise = this.audioEl.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // Autoplay may need user gesture; will start on next tap
      });
    }

    if (this.onTrackChangeCallback) {
      this.onTrackChangeCallback(track);
    }
  }

  nextTrack() {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % PLAYLIST.length;
    this._playCurrentSong();
    return PLAYLIST[this.currentTrackIndex];
  }

  prevTrack() {
    this.currentTrackIndex = (this.currentTrackIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
    this._playCurrentSong();
    return PLAYLIST[this.currentTrackIndex];
  }

  setTrack(index) {
    if (index >= 0 && index < PLAYLIST.length) {
      this.currentTrackIndex = index;
      this._playCurrentSong();
    }
    return PLAYLIST[this.currentTrackIndex];
  }

  // WARM, SMOOTH, NON-IRRITATING SPORTS CAR ENGINE SYNTHESIZER
  // Uses gentle low-passed sine and triangle waves (no harsh clipping, no screaming buzz)
  _initSmoothEngine() {
    const now = this.context.currentTime;

    // Gentle lowpass filter to remove any harshness (warm sports coupe exhaust)
    this.engineFilter = this.context.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 340;
    this.engineFilter.Q.value = 1.0;

    this.engineGain = this.context.createGain();
    this.engineGain.gain.value = 0;

    // 1. Warm low rumble (deep fundamental exhaust note)
    this.engineLowOsc = this.context.createOscillator();
    this.engineLowOsc.type = 'triangle';
    this.engineLowOsc.frequency.value = 46;

    // 2. Smooth cylinder purr (sine wave harmonic)
    this.engineMidOsc = this.context.createOscillator();
    this.engineMidOsc.type = 'sine';
    this.engineMidOsc.frequency.value = 92;

    // 3. Deep sub-bass chest rumble
    this.engineSubOsc = this.context.createOscillator();
    this.engineSubOsc.type = 'sine';
    this.engineSubOsc.frequency.value = 32;

    // Route gentle oscillators into filter and gain
    this.engineLowOsc.connect(this.engineFilter);
    this.engineMidOsc.connect(this.engineFilter);
    this.engineSubOsc.connect(this.engineFilter);

    this.engineFilter.connect(this.engineGain).connect(this.masterGain);

    this.engineLowOsc.start(now);
    this.engineMidOsc.start(now);
    this.engineSubOsc.start(now);
  }

  // GENTLE SFX CHAINS (Soft drift slip and warm nitro thrust)
  _initGentleSfxChains() {
    const now = this.context.currentTime;
    const bufferSize = this.context.sampleRate * 2.0;
    const noiseBuffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

    // Soft pavement drift sound (gentle bandpass, no screech)
    const driftSrc = this.context.createBufferSource();
    driftSrc.buffer = noiseBuffer;
    driftSrc.loop = true;
    this.driftFilter = this.context.createBiquadFilter();
    this.driftFilter.type = 'bandpass';
    this.driftFilter.frequency.value = 850;
    this.driftFilter.Q.value = 2.0;

    this.driftGain = this.context.createGain();
    this.driftGain.gain.value = 0;
    driftSrc.connect(this.driftFilter).connect(this.driftGain).connect(this.masterGain);
    driftSrc.start(now);

    // Warm Nitro rocket swoosh (gentle lowpass rumble)
    const nitroSrc = this.context.createBufferSource();
    nitroSrc.buffer = noiseBuffer;
    nitroSrc.loop = true;
    this.nitroFilter = this.context.createBiquadFilter();
    this.nitroFilter.type = 'lowpass';
    this.nitroFilter.frequency.value = 520;
    this.nitroFilter.Q.value = 1.2;

    this.nitroGain = this.context.createGain();
    this.nitroGain.gain.value = 0;
    nitroSrc.connect(this.nitroFilter).connect(this.nitroGain).connect(this.masterGain);
    nitroSrc.start(now);
  }

  setSettings(settings) {
    if (settings) this.settings = { ...settings };

    // Music volume toggle
    if (this.audioEl) {
      if (this.settings.music) {
        if (this.audioEl.paused) this._playCurrentSong();
        this.audioEl.volume = 0.7;
      } else {
        this.audioEl.pause();
        this.audioEl.volume = 0;
      }
    }

    if (this.musicGain && this.context) {
      const now = this.context.currentTime;
      this.musicGain.gain.setTargetAtTime(this.settings.music ? 0.75 : 0, now, 0.1);
    }

    if (!this.settings.sound && this.context) {
      const now = this.context.currentTime;
      if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, now, 0.05);
      if (this.driftGain) this.driftGain.gain.setTargetAtTime(0, now, 0.05);
      if (this.nitroGain) this.nitroGain.gain.setTargetAtTime(0, now, 0.05);
    }
  }

  setInRace(active) {
    this.inRace = active;
    if (!this.context) return;
    const now = this.context.currentTime;
    if (!active) {
      if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, now, 0.08);
      if (this.driftGain) this.driftGain.gain.setTargetAtTime(0, now, 0.06);
      if (this.nitroGain) this.nitroGain.gain.setTargetAtTime(0, now, 0.06);
    } else {
      // Soft gentle idle purr when on grid
      if (this.engineGain && this.settings.sound) {
        this.engineGain.gain.setTargetAtTime(0.06, now, 0.1);
      }
    }
  }

  // 6-Speed gear RPM simulation
  _getGearRpm(speedKmh) {
    const gears = [
      { min: 0,   max: 48 },
      { min: 42,  max: 92 },
      { min: 86,  max: 142 },
      { min: 136, max: 192 },
      { min: 186, max: 248 },
      { min: 242, max: 350 },
    ];
    for (let i = 0; i < gears.length; i++) {
      const g = gears[i];
      if (speedKmh <= g.max || i === gears.length - 1) {
        const p = Math.max(0, Math.min(1, (speedKmh - g.min) / (g.max - g.min)));
        return { gear: i + 1, rpm: 0.25 + p * 0.75 };
      }
    }
    return { gear: 6, rpm: 1.0 };
  }

  // DYNAMIC SMOOTH SPORTS CAR AUDIO UPDATE
  update(speedKmh, nitroActive, driftIntensity = 0, rawRpmRatio = 0.3) {
    if (!this.context || !this.engineLowOsc) return;
    const now = this.context.currentTime;

    if (!this.settings.sound || !this.inRace) {
      if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, now, 0.06);
      if (this.driftGain) this.driftGain.gain.setTargetAtTime(0, now, 0.05);
      if (this.nitroGain) this.nitroGain.gain.setTargetAtTime(0, now, 0.05);
      return;
    }

    const gearInfo = this._getGearRpm(speedKmh);
    const rpm = gearInfo.rpm;

    // Detect gear shift & trigger subtle bass burble
    if (gearInfo.gear !== this.currentGear) {
      this.currentGear = gearInfo.gear;
      this._smoothGearBurble();
    }

    // Warm purr frequencies (pleasant, soothing low-mid range)
    const baseFreq = 42 + rpm * 68 + (nitroActive ? 12 : 0);

    // Sub fundamental
    this.engineLowOsc.frequency.setTargetAtTime(baseFreq, now, 0.06);
    // Cylinder purr
    this.engineMidOsc.frequency.setTargetAtTime(baseFreq * 2.0, now, 0.06);
    // Sub-bass resonance
    this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.06);

    // Warm filter opens gently with RPM (no piercing treble)
    const targetCutoff = 260 + rpm * 320 + (nitroActive ? 140 : 0);
    this.engineFilter.frequency.setTargetAtTime(targetCutoff, now, 0.08);

    // Smooth, comfortable volume curve (quiet idle 0.05, pleasant cruising 0.12)
    const baseEngineVol = 0.05 + (rpm * 0.08) + (nitroActive ? 0.03 : 0);
    this.engineGain.gain.setTargetAtTime(baseEngineVol, now, 0.06);

    // Gentle tire drift slip (soft, no harsh screech)
    const drift = Math.min(1, Math.max(0, driftIntensity));
    this.driftGain.gain.setTargetAtTime(drift * 0.10, now, 0.05);

    // Warm nitro rocket thrust
    this.nitroGain.gain.setTargetAtTime(nitroActive ? 0.16 : 0, now, 0.06);

    this.prevSpeed = speedKmh;
  }

  // Subtle warm exhaust burble on gear change
  _smoothGearBurble() {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;
    const burble = this.context.createOscillator();
    const bGain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    burble.type = 'triangle';
    burble.frequency.setValueAtTime(85, now);
    burble.frequency.exponentialRampToValueAtTime(38, now + 0.08);

    filter.type = 'lowpass';
    filter.frequency.value = 260;

    bGain.gain.setValueAtTime(0.08, now);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    burble.connect(filter).connect(bGain).connect(this.masterGain);
    burble.start(now);
    burble.stop(now + 0.10);
  }

  // MELODIC, PLEASANT COUNTDOWN CHIMES (Clear musical notes)
  countdownBeep(isGo) {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;

    if (!isGo) {
      // Warm, melodic digital stage chime (A4 - 440 Hz)
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain).connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.24);
    } else {
      // Harmonious green flag victory chime (Major triad: A5 + C#6 + E6)
      [880, 1108.73, 1318.51].forEach((freq) => {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain).connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.48);
      });
    }
  }

  boost() {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.25);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  boostPad() {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(330, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.22);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.27);
  }

  pickup() {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;
    [587.33, 739.99, 880.0].forEach((freq, i) => {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.04);
      gain.gain.setValueAtTime(0.10, now + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.16);
      osc.connect(gain).connect(this.masterGain);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.18);
    });
  }

  lapComplete() {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      gain.gain.setValueAtTime(0.12, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.25);
      osc.connect(gain).connect(this.masterGain);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.28);
    });
  }

  finishFanfare(won) {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;
    const notes = won ? [523.25, 659.25, 783.99, 1046.5, 1318.51] : [392, 440, 523.25];
    notes.forEach((freq, i) => {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.14, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);
      osc.connect(gain).connect(this.masterGain);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.38);
    });
  }

  collision() {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;

    // Soft muffled thud (no harsh metallic shriek)
    const sub = this.context.createOscillator();
    const subGain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    sub.type = 'triangle';
    sub.frequency.setValueAtTime(120, now);
    sub.frequency.exponentialRampToValueAtTime(32, now + 0.14);

    filter.type = 'lowpass';
    filter.frequency.value = 350;

    subGain.gain.setValueAtTime(0.22, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    sub.connect(filter).connect(subGain).connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.18);
  }

  dispose() {
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl = null;
    }
    if (this.context) {
      this.context.close().catch(() => {});
      this.context = null;
    }
  }
}
