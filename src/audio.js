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

  // Soft analog saturation curve for aggressive throaty exhaust growl
  _makeSaturationCurve(amount = 9) {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  // AGGRESSIVE SPORTS CAR ENGINE SYNTHESIZER
  _initAggressiveEngine() {
    const now = this.context.currentTime;

    // Analog tube saturation gives that muscular exhaust growl
    this.engineShaper = this.context.createWaveShaper();
    this.engineShaper.curve = this._makeSaturationCurve(10);
    this.engineShaper.oversample = '2x';

    // Resonant lowpass tracking RPM
    this.engineFilter = this.context.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineFilter.Q.value = 2.2;

    // Exhaust chamber acoustic resonance (deep boxer growl boost)
    this.enginePeak = this.context.createBiquadFilter();
    this.enginePeak.type = 'peaking';
    this.enginePeak.frequency.value = 380;
    this.enginePeak.Q.value = 2.4;
    this.enginePeak.gain.value = 5.0;

    this.engineGain = this.context.createGain();
    this.engineGain.gain.value = 0;

    // 1. Crankshaft fundamental roar (sawtooth)
    this.engineOsc1 = this.context.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.value = 52;

    // 2. Detuned cylinder firing harmonic (sawtooth, +7 cents for wide aggressive boxer rumble)
    this.engineOsc2 = this.context.createOscillator();
    this.engineOsc2.type = 'sawtooth';
    this.engineOsc2.frequency.value = 104;
    this.engineOsc2.detune.value = 7;

    // 3. Deep sub-bass chest rumble (triangle, delivers heavy physical bass presence)
    this.engineOsc3 = this.context.createOscillator();
    this.engineOsc3.type = 'triangle';
    this.engineOsc3.frequency.value = 26;

    // 4. Throaty high-rev cam roar (sawtooth, kicks in at high RPM)
    this.engineOsc4 = this.context.createOscillator();
    this.engineOsc4.type = 'sawtooth';
    this.engineOsc4.frequency.value = 156;

    // Route oscillators through saturation, filters, and gain
    this.engineOsc1.connect(this.engineShaper);
    this.engineOsc2.connect(this.engineShaper);
    this.engineOsc4.connect(this.engineShaper);
    this.engineOsc3.connect(this.engineFilter);

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

  // Realistic 6-Speed transmission gear curve
  _getGearRpm(speedKmh) {
    const gears = [
      { min: 0,   max: 48 },
      { min: 42,  max: 94 },
      { min: 88,  max: 145 },
      { min: 138, max: 196 },
      { min: 190, max: 252 },
      { min: 245, max: 360 },
    ];
    for (let i = 0; i < gears.length; i++) {
      const g = gears[i];
      if (speedKmh <= g.max || i === gears.length - 1) {
        const p = Math.max(0, Math.min(1, (speedKmh - g.min) / (g.max - g.min)));
        return { gear: i + 1, rpm: 0.28 + p * 0.72 };
      }
    }
    return { gear: 6, rpm: 1.0 };
  }

  // DYNAMIC AGGRESSIVE SPORTS CAR ENGINE AUDIO UPDATE
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

    // Detect gear shift & trigger aggressive backfire / crackle
    if (gearInfo.gear !== this.currentGear) {
      this.currentGear = gearInfo.gear;
      this._aggressiveExhaustBackfire();
    }

    // Aggressive engine fundamental & harmonics tracking RPM
    const nitroBoost = nitroActive ? 32 : 0;
    const baseFreq = 48 + rpm * 115 + nitroBoost;

    // Crankshaft fundamental
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.04);
    // Cylinder firing harmonic
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 2.0, now, 0.04);
    // Sub-bass exhaust thud
    this.engineOsc3.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.04);
    // High-RPM cam scream
    this.engineOsc4.frequency.setTargetAtTime(baseFreq * 3.0, now, 0.04);

    // Open lowpass filter wide as engine revs (aggressive roar)
    const targetCutoff = 360 + rpm * 1100 + (nitroActive ? 450 : 0);
    this.engineFilter.frequency.setTargetAtTime(targetCutoff, now, 0.05);

    // Dynamic Aggressive Engine Volume (punchy 0.14 at idle up to 0.32 at redline)
    const baseEngineVol = 0.14 + (rpm * 0.16) + (nitroActive ? 0.06 : 0);
    this.engineGain.gain.setTargetAtTime(baseEngineVol, now, 0.05);

    // Aggressive tire drift screech
    const drift = Math.min(1, Math.max(0, driftIntensity));
    this.driftGain.gain.setTargetAtTime(drift * 0.18, now, 0.04);
    this.driftFilter.frequency.setTargetAtTime(1100 + drift * 500, now, 0.05);

    // Aggressive nitro rocket roar
    this.nitroGain.gain.setTargetAtTime(nitroActive ? 0.24 : 0, now, 0.05);
    this.nitroSubGain.gain.setTargetAtTime(nitroActive ? 0.14 : 0, now, 0.05);

    this.prevSpeed = speedKmh;
  }

  // AGGRESSIVE EXHAUST BACKFIRE / CRACKLE ON GEAR SHIFT
  _aggressiveExhaustBackfire() {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;

    // Dual-stage rapid exhaust pop ("pop-pop!")
    [0, 0.055].forEach((offset, idx) => {
      const popTime = now + offset;
      const pop = this.context.createOscillator();
      const popEnv = this.context.createGain();
      const filter = this.context.createBiquadFilter();

      pop.type = 'triangle';
      pop.frequency.setValueAtTime(idx === 0 ? 150 : 190, popTime);
      pop.frequency.exponentialRampToValueAtTime(36, popTime + 0.06);

      filter.type = 'lowpass';
      filter.frequency.value = 480;

      popEnv.gain.setValueAtTime(0.20, popTime);
      popEnv.gain.exponentialRampToValueAtTime(0.001, popTime + 0.07);

      pop.connect(filter).connect(popEnv).connect(this.masterGain);
      pop.start(popTime);
      pop.stop(popTime + 0.08);
    });
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
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      gain.gain.setValueAtTime(0.15, now + i * 0.06);
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
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.16, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);
      osc.connect(gain).connect(this.masterGain);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.38);
    });
  }

  collision() {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;

    // Metallic crunch noise
    const bufferSize = this.context.sampleRate * 0.16;
    const noiseBuf = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const crunch = this.context.createBufferSource();
    crunch.buffer = noiseBuf;

    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 650;

    const crunchGain = this.context.createGain();
    crunchGain.gain.setValueAtTime(0.24, now);
    crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    crunch.connect(filter).connect(crunchGain).connect(this.masterGain);
    crunch.start(now);

    // Heavy barrier impact thud
    const sub = this.context.createOscillator();
    const subGain = this.context.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(140, now);
    sub.frequency.exponentialRampToValueAtTime(32, now + 0.15);

    subGain.gain.setValueAtTime(0.30, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    sub.connect(subGain).connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.2);
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
