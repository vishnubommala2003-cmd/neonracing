// Neon GT Racing — Audio Engine & Music System
// Real Studio Songs Playlist + Aggressive, Throaty Sports Car Racing Engine

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

    // Aggressive Sports Car Engine Synthesizer
    this.engineOsc1 = null;    // Fundamental crankshaft roar (sawtooth)
    this.engineOsc2 = null;    // Detuned cylinder firing harmonic (sawtooth, boxer rumble)
    this.engineOsc3 = null;    // Deep sub-bass exhaust thud (triangle)
    this.engineOsc4 = null;    // High-RPM cam roar (sawtooth)
    this.engineShaper = null;  // Analog tube saturation for aggressive exhaust growl
    this.engineFilter = null;  // Resonant lowpass tracking revs
    this.enginePeak = null;    // Exhaust chamber resonance
    this.engineGain = null;

    // Tire drift & nitro thrust
    this.driftGain = null;
    this.driftFilter = null;
    this.nitroGain = null;
    this.nitroFilter = null;
    this.nitroSubOsc = null;
    this.nitroSubGain = null;

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

    // 2. Initialize Web Audio API for aggressive car engine & SFX
    if (!this.context) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.context = new AudioCtx();

        // Master Compressor: Keeps audio punchy, loud, and crisp without distortion
        this.compressor = this.context.createDynamicsCompressor();
        this.compressor.threshold.value = -12;
        this.compressor.knee.value = 20;
        this.compressor.ratio.value = 8;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.15;
        this.compressor.connect(this.context.destination);

        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = 1.0;
        this.masterGain.connect(this.compressor);

        // Music bus (balanced with engine roar)
        this.musicGain = this.context.createGain();
        this.musicGain.gain.value = this.settings.music ? 0.70 : 0;
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

        // Initialize aggressive engine & sfx
        this._initAggressiveEngine();
        this._initSfxChains();
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
    this.audioEl.volume = 0.70;

    // Load initial track
    this.audioEl.src = PLAYLIST[this.currentTrackIndex].src;

    // When song ends, seamlessly play next song
    this.audioEl.addEventListener('ended', () => {
      this.nextTrack();
    });

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
      playPromise.catch(() => {});
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

  // Warm analog tube saturation curve for throaty sports car exhaust growl
  _makeWarmSaturationCurve(amount = 2.4) {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  // AUTHENTIC SPORTS CAR ENGINE SYNTHESIZER (V8 / BOXER PURR & GROWL)
  _initAggressiveEngine() {
    const now = this.context.currentTime;

    // 1. Warm Analog Tube Saturation (Subtle harmonic warmth, zero harsh fuzz)
    this.engineShaper = this.context.createWaveShaper();
    this.engineShaper.curve = this._makeWarmSaturationCurve(2.4);
    this.engineShaper.oversample = '2x';

    // 2. Resonant Lowpass tracking engine RPM (Smooth throatiness, no ear-piercing whistle)
    this.engineFilter = this.context.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineFilter.Q.value = 1.15;

    // 3. Exhaust Chamber Resonance Peak EQ (Rich low-mid boxer/V8 purr boost)
    this.enginePeak = this.context.createBiquadFilter();
    this.enginePeak.type = 'peaking';
    this.enginePeak.frequency.value = 280;
    this.enginePeak.Q.value = 1.2;
    this.enginePeak.gain.value = 1.8;

    this.engineGain = this.context.createGain();
    this.engineGain.gain.value = 0;

    // Sub-mix summing bus for engine oscillators
    this.engineOscMix = this.context.createGain();
    this.engineOscMix.gain.value = 0.85;

    // Individual oscillator gain stages to prevent clipping & achieve perfect sports car timbre:
    // A. Crankshaft Fundamental (Deep warm body)
    this.engineOsc1 = this.context.createOscillator();
    this.engineOsc1.type = 'triangle';
    this.engineOsc1.frequency.value = 44;
    this.engineOsc1Gain = this.context.createGain();
    this.engineOsc1Gain.gain.value = 0.38;
    this.engineOsc1.connect(this.engineOsc1Gain).connect(this.engineOscMix);

    // B. Cylinder Firing Secondary Harmonic (+3.5 cents detune for exotic European sports car purr)
    this.engineOsc2 = this.context.createOscillator();
    this.engineOsc2.type = 'sawtooth';
    this.engineOsc2.frequency.value = 88;
    this.engineOsc2.detune.value = 3.5;
    this.engineOsc2Filter = this.context.createBiquadFilter();
    this.engineOsc2Filter.type = 'lowpass';
    this.engineOsc2Filter.frequency.value = 850;
    this.engineOsc2Gain = this.context.createGain();
    this.engineOsc2Gain.gain.value = 0.24;
    this.engineOsc2.connect(this.engineOsc2Filter).connect(this.engineOsc2Gain).connect(this.engineOscMix);

    // C. Deep Sub-Bass Exhaust Thud (Punchy low rumble that you feel)
    this.engineOsc3 = this.context.createOscillator();
    this.engineOsc3.type = 'sine';
    this.engineOsc3.frequency.value = 22;
    this.engineOsc3Gain = this.context.createGain();
    this.engineOsc3Gain.gain.value = 0.35;
    this.engineOsc3.connect(this.engineOsc3Gain).connect(this.engineFilter);

    // D. High-RPM Cam Rush & Induction Fifth (Chordal harmonic richness)
    this.engineOsc4 = this.context.createOscillator();
    this.engineOsc4.type = 'triangle';
    this.engineOsc4.frequency.value = 66;
    this.engineOsc4Gain = this.context.createGain();
    this.engineOsc4Gain.gain.value = 0.16;
    this.engineOsc4.connect(this.engineOsc4Gain).connect(this.engineOscMix);

    // Route: Oscillators -> Saturator -> Lowpass Filter -> Exhaust Chamber Peak -> Engine Gain -> Master
    this.engineOscMix.connect(this.engineShaper);
    this.engineShaper.connect(this.engineFilter);
    this.engineFilter.connect(this.enginePeak);
    this.enginePeak.connect(this.engineGain).connect(this.masterGain);

    this.engineOsc1.start(now);
    this.engineOsc2.start(now);
    this.engineOsc3.start(now);
    this.engineOsc4.start(now);
  }

  // AGGRESSIVE SFX CHAINS (Smoking drift friction & roaring nitro jet)
  _initSfxChains() {
    const now = this.context.currentTime;
    const bufferSize = this.context.sampleRate * 2.0;
    const noiseBuffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

    // Gritty tire drift screech (smoking asphalt friction)
    const driftSrc = this.context.createBufferSource();
    driftSrc.buffer = noiseBuffer;
    driftSrc.loop = true;
    this.driftFilter = this.context.createBiquadFilter();
    this.driftFilter.type = 'bandpass';
    this.driftFilter.frequency.value = 1200;
    this.driftFilter.Q.value = 3.2;

    this.driftGain = this.context.createGain();
    this.driftGain.gain.value = 0;
    driftSrc.connect(this.driftFilter).connect(this.driftGain).connect(this.masterGain);
    driftSrc.start(now);

    // Aggressive Nitro rocket thruster (roaring jet burn)
    const nitroSrc = this.context.createBufferSource();
    nitroSrc.buffer = noiseBuffer;
    nitroSrc.loop = true;
    this.nitroFilter = this.context.createBiquadFilter();
    this.nitroFilter.type = 'lowpass';
    this.nitroFilter.frequency.value = 750;
    this.nitroFilter.Q.value = 1.8;

    this.nitroGain = this.context.createGain();
    this.nitroGain.gain.value = 0;
    nitroSrc.connect(this.nitroFilter).connect(this.nitroGain).connect(this.masterGain);
    nitroSrc.start(now);

    // Nitro sub jet burn
    this.nitroSubOsc = this.context.createOscillator();
    this.nitroSubOsc.type = 'sawtooth';
    this.nitroSubOsc.frequency.value = 68;
    this.nitroSubGain = this.context.createGain();
    this.nitroSubGain.gain.value = 0;
    this.nitroSubOsc.connect(this.nitroSubGain).connect(this.masterGain);
    this.nitroSubOsc.start(now);
  }

  setSettings(settings) {
    if (settings) this.settings = { ...settings };

    // Music volume toggle
    if (this.audioEl) {
      if (this.settings.music) {
        if (this.audioEl.paused) this._playCurrentSong();
        this.audioEl.volume = 0.70;
      } else {
        this.audioEl.pause();
        this.audioEl.volume = 0;
      }
    }

    if (this.musicGain && this.context) {
      const now = this.context.currentTime;
      this.musicGain.gain.setTargetAtTime(this.settings.music ? 0.70 : 0, now, 0.1);
    }

    if (!this.settings.sound && this.context) {
      const now = this.context.currentTime;
      if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, now, 0.05);
      if (this.driftGain) this.driftGain.gain.setTargetAtTime(0, now, 0.05);
      if (this.nitroGain) this.nitroGain.gain.setTargetAtTime(0, now, 0.05);
      if (this.nitroSubGain) this.nitroSubGain.gain.setTargetAtTime(0, now, 0.05);
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
      if (this.nitroSubGain) this.nitroSubGain.gain.setTargetAtTime(0, now, 0.06);
    } else {
      // Throaty, aggressive idle rumble when waiting on grid
      if (this.engineGain && this.settings.sound) {
        this.engineGain.gain.setTargetAtTime(0.14, now, 0.1);
      }
    }
  }

  // Realistic 6-Speed transmission gear curve with hysteresis to prevent shift jitter
  _getGearRpm(speedKmh) {
    const gears = [
      { min: 0,   max: 52 },
      { min: 46,  max: 98 },
      { min: 92,  max: 148 },
      { min: 142, max: 198 },
      { min: 192, max: 255 },
      { min: 248, max: 360 },
    ];

    let gear = this.currentGear || 1;
    const curIdx = gear - 1;

    // Upshift hysteresis
    if (curIdx < gears.length - 1 && speedKmh > gears[curIdx].max + 3) {
      gear = Math.min(gears.length, gear + 1);
    }
    // Downshift hysteresis
    else if (curIdx > 0 && speedKmh < gears[curIdx].min - 5) {
      gear = Math.max(1, gear - 1);
    }

    const g = gears[gear - 1];
    const p = Math.max(0, Math.min(1, (speedKmh - g.min) / (g.max - g.min)));
    return { gear, rpm: 0.28 + p * 0.72 };
  }

  // DYNAMIC AUTHENTIC SPORTS CAR ENGINE AUDIO UPDATE
  update(speedKmh, nitroActive, driftIntensity = 0, rawRpmRatio = 0.3) {
    if (!this.context || !this.engineOsc1) return;
    const now = this.context.currentTime;

    if (!this.settings.sound || !this.inRace) {
      if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, now, 0.06);
      if (this.driftGain) this.driftGain.gain.setTargetAtTime(0, now, 0.05);
      if (this.nitroGain) this.nitroGain.gain.setTargetAtTime(0, now, 0.05);
      if (this.nitroSubGain) this.nitroSubGain.gain.setTargetAtTime(0, now, 0.05);
      return;
    }

    const gearInfo = this._getGearRpm(speedKmh);
    const rpm = gearInfo.rpm;

    // Detect gear shift & trigger subtle sports car exhaust backfire
    if (gearInfo.gear !== this.currentGear) {
      const isDownshift = gearInfo.gear < this.currentGear;
      this.currentGear = gearInfo.gear;
      this._aggressiveExhaustBackfire(isDownshift);
    }

    // Authentic engine fundamental & harmonics tracking RPM smoothly
    const nitroBoost = nitroActive ? 24 : 0;
    const baseFreq = 44 + rpm * 88 + nitroBoost;

    // Crankshaft fundamental
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.05);
    // Cylinder firing secondary harmonic (V8/Boxer growl)
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 2.0, now, 0.05);
    // Sub-bass exhaust thud
    this.engineOsc3.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.05);
    // High-RPM cam singing fifth
    this.engineOsc4.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.05);

    // Smooth lowpass filter tracking revs (warm 320 Hz to 880 Hz, never piercing)
    const targetCutoff = 320 + rpm * 560 + (nitroActive ? 220 : 0);
    this.engineFilter.frequency.setTargetAtTime(targetCutoff, now, 0.06);

    // Clean, punchy engine volume (0.09 at idle, up to 0.20 at redline)
    const baseEngineVol = 0.09 + (rpm * 0.10) + (nitroActive ? 0.03 : 0);
    this.engineGain.gain.setTargetAtTime(baseEngineVol, now, 0.05);

    // Realistic tire drift friction (muffled rubber scrub)
    const drift = Math.min(1, Math.max(0, driftIntensity));
    this.driftGain.gain.setTargetAtTime(drift * 0.12, now, 0.04);
    this.driftFilter.frequency.setTargetAtTime(950 + drift * 350, now, 0.05);

    // Nitro thruster rush
    this.nitroGain.gain.setTargetAtTime(nitroActive ? 0.15 : 0, now, 0.05);
    this.nitroSubGain.gain.setTargetAtTime(nitroActive ? 0.09 : 0, now, 0.05);

    this.prevSpeed = speedKmh;
  }

  // AUTHENTIC SPORTS CAR EXHAUST POP / CRACKLE (Rate-limited, never over-noise)
  _aggressiveExhaustBackfire(isDownshift = false) {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;
    if (this._lastBackfireTime && now - this._lastBackfireTime < 0.85) return;
    this._lastBackfireTime = now;

    const pop = this.context.createOscillator();
    const popEnv = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    pop.type = 'triangle';
    pop.frequency.setValueAtTime(isDownshift ? 160 : 130, now);
    pop.frequency.exponentialRampToValueAtTime(32, now + 0.07);

    filter.type = 'lowpass';
    filter.frequency.value = 420;

    popEnv.gain.setValueAtTime(0.08, now);
    popEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    pop.connect(filter).connect(popEnv).connect(this.masterGain);
    pop.start(now);
    pop.stop(now + 0.09);
  }

  // COUNTDOWN CHIMES
  countdownBeep(isGo) {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;

    if (!isGo) {
      // Crisp digital countdown tone (A4 - 440 Hz)
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.20, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain).connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.24);
    } else {
      // Powerful green flag fanfare (Major triad)
      [880, 1108.73, 1318.51].forEach((freq) => {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.16, now);
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
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.25);
    gain.gain.setValueAtTime(0.16, now);
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
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.22);
    gain.gain.setValueAtTime(0.18, now);
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
      gain.gain.setValueAtTime(0.12, now + i * 0.04);
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
      osc.frequency.setValueAtTime(freq, now + i * 0.05);
      gain.gain.setValueAtTime(0.09, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.20);
      osc.connect(gain).connect(this.masterGain);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.22);
    });
  }

  finishFanfare(won) {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;
    const notes = won ? [523.25, 659.25, 783.99, 1046.5, 1318.51] : [392, 440, 523.25];
    notes.forEach((freq, i) => {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.12, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.30);
      osc.connect(gain).connect(this.masterGain);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.32);
    });
  }

  collision() {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;
    if (this._lastCollisionTime && now - this._lastCollisionTime < 0.45) return;
    this._lastCollisionTime = now;

    // Metallic crunch noise (rate-limited and normalized)
    const bufferSize = Math.floor(this.context.sampleRate * 0.12);
    const noiseBuf = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const crunch = this.context.createBufferSource();
    crunch.buffer = noiseBuf;

    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;

    const crunchGain = this.context.createGain();
    crunchGain.gain.setValueAtTime(0.12, now);
    crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    crunch.connect(filter).connect(crunchGain).connect(this.masterGain);
    crunch.start(now);

    // Heavy barrier impact thud
    const sub = this.context.createOscillator();
    const subGain = this.context.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(30, now + 0.14);

    subGain.gain.setValueAtTime(0.15, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    sub.connect(subGain).connect(this.masterGain);
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
