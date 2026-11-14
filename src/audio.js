export class RaceAudio {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.compressor = null;

    // Multi-layer Sports Car Engine Synthesizer
    this.engineOsc1 = null; // Fundamental crankshaft
    this.engineOsc2 = null; // 2x cylinder firing harmonic
    this.engineOsc3 = null; // Sub-bass rumble
    this.engineOsc4 = null; // High-RPM acoustic intake wail
    this.turboOsc = null;   // Turbocharger spool whine
    this.turboGain = null;
    this.engineFilter = null;
    this.enginePeak = null;
    this.engineShaper = null;
    this.engineGain = null;

    // Tire Screech & Nitro Chains
    this.screechGain = null;
    this.screechFilter = null;
    this.nitroNoiseGain = null;
    this.nitroSubOsc = null;
    this.nitroSubGain = null;

    // Music Synthesizer & Sequencer
    this.musicGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.currentGear = 1;
    this.prevSpeed = 0;
    this.lastShiftTime = 0;

    this.settings = { music: true, sound: true };
    this.inRace = false;
  }

  start(settings) {
    if (settings) this.settings = { ...settings };
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();

      // Master Compressor / Limiter (Arcade loudness & punch without digital clipping)
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.value = -10;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 8;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.15;
      this.compressor.connect(this.context.destination);

      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.compressor);

      // 1. ENGINE ROAR SYNTHESIZER
      this._initEngineSynth();

      // 2. NOISE CHAINS (Tire Screech & Nitro Rocket)
      this._initNoiseChains();

      // 3. BACKGROUND MUSIC SYNTHESIZER BUS
      this.musicGain = this.context.createGain();
      this.musicGain.gain.value = 0.72;
      this.musicGain.connect(this.masterGain);

      this._startMusicSequencer();
    }

    if (this.context.state === 'suspended') {
      this.context.resume().catch(() => {});
    }
    this.setSettings(this.settings);
  }

  _makeDistortionCurve(amount = 25) {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  _initEngineSynth() {
    const now = this.context.currentTime;

    // Throaty Waveshaper Overdrive (gives aggressive exhaust growl)
    this.engineShaper = this.context.createWaveShaper();
    this.engineShaper.curve = this._makeDistortionCurve(18);
    this.engineShaper.oversample = '2x';

    // Lowpass filter tracking engine revs
    this.engineFilter = this.context.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 350;
    this.engineFilter.Q.value = 2.8;

    // Peaking filter for the characteristic sports exhaust resonance
    this.enginePeak = this.context.createBiquadFilter();
    this.enginePeak.type = 'peaking';
    this.enginePeak.frequency.value = 1100;
    this.enginePeak.Q.value = 3.2;
    this.enginePeak.gain.value = 6.0;

    this.engineGain = this.context.createGain();
    this.engineGain.gain.value = 0;

    // Osc 1: Crankshaft fundamental (Sawtooth)
    this.engineOsc1 = this.context.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.value = 54;

    // Osc 2: Cylinder firing harmonic (Sawtooth, detuned for raw boxer chorus)
    this.engineOsc2 = this.context.createOscillator();
    this.engineOsc2.type = 'sawtooth';
    this.engineOsc2.frequency.value = 108;
    this.engineOsc2.detune.value = 7;

    // Osc 3: Sub-bass chest rumble (Triangle)
    this.engineOsc3 = this.context.createOscillator();
    this.engineOsc3.type = 'triangle';
    this.engineOsc3.frequency.value = 27;

    // Osc 4: High RPM screaming intake wail
    this.engineOsc4 = this.context.createOscillator();
    this.engineOsc4.type = 'sawtooth';
    this.engineOsc4.frequency.value = 216;

    // Turbocharger spool whine (high-pitch turbine whistle)
    this.turboOsc = this.context.createOscillator();
    this.turboOsc.type = 'sine';
    this.turboOsc.frequency.value = 1500;
    this.turboGain = this.context.createGain();
    this.turboGain.gain.value = 0;
    this.turboOsc.connect(this.turboGain).connect(this.masterGain);

    // Route engine oscillators through shaper, filters and gain
    this.engineOsc1.connect(this.engineShaper);
    this.engineOsc2.connect(this.engineShaper);
    this.engineOsc3.connect(this.engineFilter);
    this.engineOsc4.connect(this.engineShaper);

    this.engineShaper.connect(this.engineFilter);
    this.engineFilter.connect(this.enginePeak);
    this.enginePeak.connect(this.engineGain).connect(this.masterGain);

    this.engineOsc1.start(now);
    this.engineOsc2.start(now);
    this.engineOsc3.start(now);
    this.engineOsc4.start(now);
    this.turboOsc.start(now);
  }

  _initNoiseChains() {
    const now = this.context.currentTime;
    const bufferSize = this.context.sampleRate * 2.0;
    const noiseBuffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

    // Tire Screech Chain (Loud, gritty smoking friction)
    const screechSrc = this.context.createBufferSource();
    screechSrc.buffer = noiseBuffer;
    screechSrc.loop = true;
    this.screechFilter = this.context.createBiquadFilter();
    this.screechFilter.type = 'bandpass';
    this.screechFilter.frequency.value = 1450;
    this.screechFilter.Q.value = 5.5;
    this.screechGain = this.context.createGain();
    this.screechGain.gain.value = 0;
    screechSrc.connect(this.screechFilter).connect(this.screechGain).connect(this.masterGain);
    screechSrc.start(now);

    // Nitro Rocket Thrust Chain (Roaring jet burn + sub-bass rumble)
    const nitroSrc = this.context.createBufferSource();
    nitroSrc.buffer = noiseBuffer;
    nitroSrc.loop = true;
    const nitroFilter = this.context.createBiquadFilter();
    nitroFilter.type = 'lowpass';
    nitroFilter.frequency.value = 850;
    nitroFilter.Q.value = 2.0;
    this.nitroNoiseGain = this.context.createGain();
    this.nitroNoiseGain.gain.value = 0;
    nitroSrc.connect(nitroFilter).connect(this.nitroNoiseGain).connect(this.masterGain);
    nitroSrc.start(now);

    // Nitro sub jet tone
    this.nitroSubOsc = this.context.createOscillator();
    this.nitroSubOsc.type = 'sawtooth';
    this.nitroSubOsc.frequency.value = 65;
    this.nitroSubGain = this.context.createGain();
    this.nitroSubGain.gain.value = 0;
    this.nitroSubOsc.connect(this.nitroSubGain).connect(this.masterGain);
    this.nitroSubOsc.start(now);
  }

  // HIGH-ENERGY 138 BPM ARCADE STREET RACING SOUNDTRACK
  _startMusicSequencer() {
    if (this.musicTimer) return;

    // 4-Bar High-Adrenaline Progression: F#m ➔ D ➔ A ➔ E
    const chords = [
      { root: 46.25, name: 'F#m', scale: [185.00, 220.00, 277.18, 370.00, 440.00, 554.37] },
      { root: 36.71, name: 'D',   scale: [146.83, 185.00, 220.00, 293.66, 370.00, 440.00] },
      { root: 55.00, name: 'A',   scale: [220.00, 277.18, 329.63, 440.00, 554.37, 659.25] },
      { root: 41.20, name: 'E',   scale: [164.81, 207.65, 246.94, 329.63, 415.30, 493.88] },
    ];

    const stepDuration = 108; // ~138 BPM (16th note in milliseconds)

    this.musicTimer = window.setInterval(() => {
      if (!this.context || !this.settings.music || this.context.state !== 'running') return;
      const now = this.context.currentTime;
      const step = this.musicStep % 64;
      const barIdx = Math.floor(step / 16);
      const beatInBar = step % 16;
      const chord = chords[barIdx % 4];
      this.musicStep++;

      // 1. PUNCHY 909 CYBER KICK DRUM (Every beat: 0, 4, 8, 12)
      if (beatInBar % 4 === 0) {
        const kick = this.context.createOscillator();
        const kickEnv = this.context.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(175, now);
        kick.frequency.exponentialRampToValueAtTime(42, now + 0.08);

        // Click transient
        const click = this.context.createOscillator();
        const clickEnv = this.context.createGain();
        click.type = 'triangle';
        click.frequency.setValueAtTime(650, now);
        click.frequency.exponentialRampToValueAtTime(120, now + 0.02);
        clickEnv.gain.setValueAtTime(0.25, now);
        clickEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
        click.connect(clickEnv).connect(this.musicGain);
        click.start(now);
        click.stop(now + 0.03);

        const kickVol = this.inRace ? 0.35 : 0.18;
        kickEnv.gain.setValueAtTime(kickVol, now);
        kickEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
        kick.connect(kickEnv).connect(this.musicGain);
        kick.start(now);
        kick.stop(now + 0.11);
      }

      // 2. CRISP CYBER SNARE & CLAP (Beats 2 and 4: steps 4 and 12)
      if (beatInBar === 4 || beatInBar === 12) {
        // Noise burst
        const bufferSize = this.context.sampleRate * 0.12;
        const noiseBuf = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.context.createBufferSource();
        noise.buffer = noiseBuf;

        const snareFilter = this.context.createBiquadFilter();
        snareFilter.type = 'bandpass';
        snareFilter.frequency.value = 1800;
        snareFilter.Q.value = 2.2;

        const snareEnv = this.context.createGain();
        const snareVol = this.inRace ? 0.26 : 0.12;
        snareEnv.gain.setValueAtTime(snareVol, now);
        snareEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

        // Tonal body
        const tone = this.context.createOscillator();
        const toneEnv = this.context.createGain();
        tone.type = 'triangle';
        tone.frequency.setValueAtTime(240, now);
        tone.frequency.exponentialRampToValueAtTime(110, now + 0.06);
        toneEnv.gain.setValueAtTime(snareVol * 0.7, now);
        toneEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

        noise.connect(snareFilter).connect(snareEnv).connect(this.musicGain);
        tone.connect(toneEnv).connect(this.musicGain);
        noise.start(now);
        tone.start(now);
        tone.stop(now + 0.08);
      }

      // 3. DRIVING HI-HATS (16th notes + Open hat on upbeats)
      if (this.inRace || beatInBar % 2 === 0) {
        const hatBuf = this.context.createBuffer(1, this.context.sampleRate * 0.06, this.context.sampleRate);
        const hdata = hatBuf.getChannelData(0);
        for (let i = 0; i < hdata.length; i++) hdata[i] = Math.random() * 2 - 1;
        const hat = this.context.createBufferSource();
        hat.buffer = hatBuf;

        const hatFilter = this.context.createBiquadFilter();
        hatFilter.type = 'highpass';
        hatFilter.frequency.value = 7500;

        const isOpen = (beatInBar === 2 || beatInBar === 6 || beatInBar === 10 || beatInBar === 14);
        const hatEnv = this.context.createGain();
        const hatVol = isOpen ? (this.inRace ? 0.16 : 0.08) : (this.inRace ? 0.09 : 0.04);
        hatEnv.gain.setValueAtTime(hatVol, now);
        hatEnv.gain.exponentialRampToValueAtTime(0.001, now + (isOpen ? 0.065 : 0.025));

        hat.connect(hatFilter).connect(hatEnv).connect(this.musicGain);
        hat.start(now);
      }

      // 4. ROLLING CYBER SYNTH BASSLINE (16th note groove)
      const bassFreq = (beatInBar % 2 === 0) ? chord.root : chord.root * 2;
      const bassOsc = this.context.createOscillator();
      const bassFilter = this.context.createBiquadFilter();
      const bassEnv = this.context.createGain();

      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(bassFreq, now);

      bassFilter.type = 'lowpass';
      const cutoff = this.inRace ? 650 : 380;
      bassFilter.frequency.setValueAtTime(cutoff, now);
      bassFilter.frequency.exponentialRampToValueAtTime(140, now + 0.09);
      bassFilter.Q.value = 3.5;

      // Sidechain compression feel: slightly duck bass volume on kick beats
      const isKickStep = (beatInBar % 4 === 0);
      const bassVol = (this.inRace ? 0.28 : 0.15) * (isKickStep ? 0.55 : 1.0);
      bassEnv.gain.setValueAtTime(bassVol, now);
      bassEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      bassOsc.connect(bassFilter).connect(bassEnv).connect(this.musicGain);
      bassOsc.start(now);
      bassOsc.stop(now + 0.11);

      // 5. ENERGETIC MELODIC LEAD ARPEGGIO
      const noteIdx = (beatInBar * 3 + barIdx) % chord.scale.length;
      const arpFreq = chord.scale[noteIdx];

      const arpOsc = this.context.createOscillator();
      const arpFilter = this.context.createBiquadFilter();
      const arpEnv = this.context.createGain();

      arpOsc.type = 'sawtooth';
      arpOsc.frequency.setValueAtTime(arpFreq, now);

      arpFilter.type = 'bandpass';
      arpFilter.frequency.setValueAtTime(this.inRace ? 1600 : 950, now);
      arpFilter.Q.value = 2.0;

      const arpVol = this.inRace ? 0.08 : 0.045;
      arpEnv.gain.setValueAtTime(arpVol, now);
      arpEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      arpOsc.connect(arpFilter).connect(arpEnv).connect(this.musicGain);
      arpOsc.start(now);
      arpOsc.stop(now + 0.15);
    }, stepDuration);
  }

  setSettings(settings) {
    if (settings) this.settings = { ...settings };
    if (!this.context) return;
    const now = this.context.currentTime;
    this.musicGain.gain.setTargetAtTime(this.settings.music ? 0.75 : 0, now, 0.1);
    if (!this.settings.sound) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.05);
      this.screechGain.gain.setTargetAtTime(0, now, 0.05);
      this.nitroNoiseGain.gain.setTargetAtTime(0, now, 0.05);
      this.nitroSubGain.gain.setTargetAtTime(0, now, 0.05);
      this.turboGain.gain.setTargetAtTime(0, now, 0.05);
    }
  }

  setInRace(active) {
    this.inRace = active;
    if (!this.context) return;
    const now = this.context.currentTime;
    if (!active) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
      this.screechGain.gain.setTargetAtTime(0, now, 0.06);
      this.nitroNoiseGain.gain.setTargetAtTime(0, now, 0.06);
      this.nitroSubGain.gain.setTargetAtTime(0, now, 0.06);
      this.turboGain.gain.setTargetAtTime(0, now, 0.06);
    } else {
      // Idle rumble when sitting on starting grid
      this.engineGain.gain.setTargetAtTime(0.12, now, 0.08);
    }
  }

  // REALISTIC 6-SPEED TRANSMISSION RPM CURVE
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
        return { gear: i + 1, rpm: 0.28 + p * 0.72 };
      }
    }
    return { gear: 6, rpm: 1.0 };
  }

  // DYNAMIC SPORTS CAR RACE ENGINE AUDIO UPDATE
  update(speedKmh, nitroActive, driftIntensity = 0, rawRpmRatio = 0.3) {
    if (!this.context || !this.engineOsc1) return;
    const now = this.context.currentTime;

    if (!this.settings.sound || !this.inRace) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.06);
      this.screechGain.gain.setTargetAtTime(0, now, 0.05);
      this.nitroNoiseGain.gain.setTargetAtTime(0, now, 0.05);
      this.nitroSubGain.gain.setTargetAtTime(0, now, 0.05);
      this.turboGain.gain.setTargetAtTime(0, now, 0.05);
      return;
    }

    // Realistic gear RPM calculation
    const gearInfo = this._getGearRpm(speedKmh);
    const rpm = gearInfo.rpm;

    // Detect gear shifts & trigger exhaust pop
    if (gearInfo.gear !== this.currentGear) {
      this.currentGear = gearInfo.gear;
      this._exhaustPop();
    }

    // Throaty Boxer fundamental & harmonics tracking RPM
    const nitroFreqBoost = nitroActive ? 28 : 0;
    const baseFreq = 48 + rpm * 145 + nitroFreqBoost;

    // Crank fundamental
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.04);
    // 2x cylinder firing harmonic
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 2.0, now, 0.04);
    // Sub-bass exhaust thud
    this.engineOsc3.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.04);
    // High RPM acoustic scream
    this.engineOsc4.frequency.setTargetAtTime(baseFreq * 3.0, now, 0.04);

    // Open lowpass exhaust filter wide as engine revs
    const targetCutoff = 320 + rpm * 2600 + (nitroActive ? 800 : 0);
    this.engineFilter.frequency.setTargetAtTime(targetCutoff, now, 0.05);

    // Dynamic Engine Volume (Thumping 0.14 at idle up to 0.29 at redline)
    const baseEngineVol = 0.14 + (rpm * 0.12) + (nitroActive ? 0.04 : 0);
    this.engineGain.gain.setTargetAtTime(baseEngineVol, now, 0.05);

    // Turbocharger Spool Whine (whistles higher as speed and boost increase)
    const turboFreq = 1400 + (speedKmh * 8.5) + (nitroActive ? 500 : 0);
    this.turboOsc.frequency.setTargetAtTime(turboFreq, now, 0.06);
    const turboVol = Math.min(0.08, (speedKmh / 220) * 0.05 + (nitroActive ? 0.04 : 0));
    this.turboGain.gain.setTargetAtTime(turboVol, now, 0.06);

    // Tire Screech (Loud, smoking drift friction)
    const screech = Math.min(1, Math.max(0, driftIntensity));
    this.screechGain.gain.setTargetAtTime(screech * 0.18, now, 0.04);
    this.screechFilter.frequency.setTargetAtTime(1300 + screech * 600, now, 0.05);

    // Nitro Rocket Thrust
    this.nitroNoiseGain.gain.setTargetAtTime(nitroActive ? 0.22 : 0, now, 0.05);
    this.nitroSubGain.gain.setTargetAtTime(nitroActive ? 0.12 : 0, now, 0.05);

    this.prevSpeed = speedKmh;
  }

  _exhaustPop() {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;
    const pop = this.context.createOscillator();
    const popEnv = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    pop.type = 'triangle';
    pop.frequency.setValueAtTime(160, now);
    pop.frequency.exponentialRampToValueAtTime(45, now + 0.05);

    filter.type = 'lowpass';
    filter.frequency.value = 450;

    popEnv.gain.setValueAtTime(0.18, now);
    popEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    pop.connect(filter).connect(popEnv).connect(this.masterGain);
    pop.start(now);
    pop.stop(now + 0.07);
  }

  countdownBeep(isGo) {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;

    if (!isGo) {
      // Punchy digital arcade tick (520 Hz)
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(520, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain).connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.19);
    } else {
      // Explosive green flag major chord fanfare on GO! (880 Hz + 1100 Hz + 1320 Hz)
      [880, 1108.73, 1318.51].forEach((freq, i) => {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        osc.connect(gain).connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.45);
      });
    }
  }

  boost() {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.26);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  boostPad() {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.24);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  pickup() {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;
    [587.33, 739.99, 880.0].forEach((freq, i) => {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.045);
      gain.gain.setValueAtTime(0.12, now + i * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.16);
      osc.connect(gain).connect(this.masterGain);
      osc.start(now + i * 0.045);
      osc.stop(now + i * 0.045 + 0.18);
    });
  }

  lapComplete() {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.07);
      gain.gain.setValueAtTime(0.14, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.22);
      osc.connect(gain).connect(this.masterGain);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.25);
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
      osc.frequency.setValueAtTime(freq, now + i * 0.09);
      gain.gain.setValueAtTime(0.16, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.38);
      osc.connect(gain).connect(this.masterGain);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.42);
    });
  }

  collision() {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;

    // Metallic crunch noise
    const bufferSize = this.context.sampleRate * 0.18;
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
    crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    crunch.connect(filter).connect(crunchGain).connect(this.masterGain);
    crunch.start(now);

    // Deep sub-bass barrier impact thud
    const sub = this.context.createOscillator();
    const subGain = this.context.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(145, now);
    sub.frequency.exponentialRampToValueAtTime(32, now + 0.15);
    subGain.gain.setValueAtTime(0.32, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    sub.connect(subGain).connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.2);
  }

  dispose() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.context) {
      this.context.close().catch(() => {});
      this.context = null;
    }
  }
}
