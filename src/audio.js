export class RaceAudio {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.screechGain = null;
    this.screechFilter = null;
    this.nitroNoiseGain = null;
    this.musicGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.settings = { music: true, sound: true };
    this.inRace = false;
  }

  start(settings) {
    if (settings) this.settings = { ...settings };
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();

      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.85;
      this.masterGain.connect(this.context.destination);

      // Engine synth (dual sawtooth + triangle sub-octave through lowpass)
      this.engineFilter = this.context.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 340;
      this.engineFilter.Q.value = 2.4;

      this.engineGain = this.context.createGain();
      this.engineGain.gain.value = 0;

      this.engineOsc1 = this.context.createOscillator();
      this.engineOsc1.type = 'sawtooth';
      this.engineOsc1.frequency.value = 60;

      this.engineOsc2 = this.context.createOscillator();
      this.engineOsc2.type = 'triangle';
      this.engineOsc2.frequency.value = 30;

      this.engineOsc1.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain).connect(this.masterGain);
      this.engineOsc1.start();
      this.engineOsc2.start();

      // Shared white noise buffer for tire screech & nitro rocket burn
      const bufferSize = this.context.sampleRate * 1.5;
      const noiseBuffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

      // Tire screech chain
      const screechSrc = this.context.createBufferSource();
      screechSrc.buffer = noiseBuffer;
      screechSrc.loop = true;
      this.screechFilter = this.context.createBiquadFilter();
      this.screechFilter.type = 'bandpass';
      this.screechFilter.frequency.value = 1350;
      this.screechFilter.Q.value = 6.5;
      this.screechGain = this.context.createGain();
      this.screechGain.gain.value = 0;
      screechSrc.connect(this.screechFilter).connect(this.screechGain).connect(this.masterGain);
      screechSrc.start();

      // Nitro whoosh chain
      const nitroSrc = this.context.createBufferSource();
      nitroSrc.buffer = noiseBuffer;
      nitroSrc.loop = true;
      const nitroFilter = this.context.createBiquadFilter();
      nitroFilter.type = 'bandpass';
      nitroFilter.frequency.value = 520;
      nitroFilter.Q.value = 1.4;
      this.nitroNoiseGain = this.context.createGain();
      this.nitroNoiseGain.gain.value = 0;
      nitroSrc.connect(nitroFilter).connect(this.nitroNoiseGain).connect(this.masterGain);
      nitroSrc.start();

      // Music gain bus
      this.musicGain = this.context.createGain();
      this.musicGain.gain.value = 0;
      this.musicGain.connect(this.masterGain);

      this._startMusicSequencer();
    }

    if (this.context.state === 'suspended') {
      this.context.resume();
    }
    this.setSettings(this.settings);
  }

  _startMusicSequencer() {
    if (this.musicTimer) return;
    // Driving synthwave bass + arp pattern at ~132 BPM (113ms 16th notes)
    const bassNotes = [55, 55, 110, 55, 65.41, 65.41, 130.81, 65.41, 73.42, 73.42, 146.83, 73.42, 61.74, 65.41, 82.41, 55];
    const arpNotes = [220, 261.63, 329.63, 440, 261.63, 329.63, 392, 523.25, 293.66, 349.23, 440, 587.33, 246.94, 329.63, 392, 493.88];

    this.musicTimer = window.setInterval(() => {
      if (!this.context || !this.settings.music || this.context.state !== 'running') return;
      const now = this.context.currentTime;
      const step = this.musicStep % 16;
      this.musicStep++;

      // Bass pulse
      const bassOsc = this.context.createOscillator();
      const bassFilter = this.context.createBiquadFilter();
      const bassEnv = this.context.createGain();
      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(bassNotes[step], now);
      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(this.inRace ? 460 : 280, now);
      bassFilter.frequency.exponentialRampToValueAtTime(140, now + 0.1);
      bassEnv.gain.setValueAtTime(this.inRace ? 0.11 : 0.06, now);
      bassEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      bassOsc.connect(bassFilter).connect(bassEnv).connect(this.musicGain);
      bassOsc.start(now);
      bassOsc.stop(now + 0.12);

      // Kick every quarter note during race
      if (this.inRace && step % 4 === 0) {
        const kick = this.context.createOscillator();
        const kickEnv = this.context.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(125, now);
        kick.frequency.exponentialRampToValueAtTime(38, now + 0.09);
        kickEnv.gain.setValueAtTime(0.18, now);
        kickEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        kick.connect(kickEnv).connect(this.musicGain);
        kick.start(now);
        kick.stop(now + 0.11);
      }

      // Subtle high arp on alternating steps
      if (step % 2 === 0) {
        const arp = this.context.createOscillator();
        const arpEnv = this.context.createGain();
        arp.type = 'triangle';
        arp.frequency.setValueAtTime(arpNotes[step], now);
        arpEnv.gain.setValueAtTime(this.inRace ? 0.045 : 0.025, now);
        arpEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        arp.connect(arpEnv).connect(this.musicGain);
        arp.start(now);
        arp.stop(now + 0.17);
      }
    }, 115);
  }

  setSettings(settings) {
    if (settings) this.settings = { ...settings };
    if (!this.context) return;
    const now = this.context.currentTime;
    this.musicGain.gain.setTargetAtTime(this.settings.music ? 0.45 : 0, now, 0.1);
    if (!this.settings.sound) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.05);
      this.screechGain.gain.setTargetAtTime(0, now, 0.05);
      this.nitroNoiseGain.gain.setTargetAtTime(0, now, 0.05);
    }
  }

  setInRace(active) {
    this.inRace = active;
    if (!active && this.context) {
      const now = this.context.currentTime;
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
      this.screechGain.gain.setTargetAtTime(0, now, 0.06);
      this.nitroNoiseGain.gain.setTargetAtTime(0, now, 0.06);
    }
  }

  update(speedKmh, nitroActive, driftIntensity = 0, rpmRatio = 0.3) {
    if (!this.context || !this.engineOsc1) return;
    const now = this.context.currentTime;
    if (!this.settings.sound || !this.inRace) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.06);
      this.screechGain.gain.setTargetAtTime(0, now, 0.05);
      this.nitroNoiseGain.gain.setTargetAtTime(0, now, 0.05);
      return;
    }

    const baseFreq = 52 + rpmRatio * 135 + (nitroActive ? 34 : 0) + speedKmh * 0.14;
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.05);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.05);
    this.engineFilter.frequency.setTargetAtTime(240 + rpmRatio * 900 + (nitroActive ? 450 : 0), now, 0.06);
    this.engineGain.gain.setTargetAtTime(0.032 + Math.min(speedKmh / 350, 1) * 0.035, now, 0.07);

    const screech = Math.min(1, Math.max(0, driftIntensity));
    this.screechGain.gain.setTargetAtTime(screech * 0.055, now, 0.04);
    this.screechFilter.frequency.setTargetAtTime(1150 + screech * 550, now, 0.05);

    this.nitroNoiseGain.gain.setTargetAtTime(nitroActive ? 0.05 : 0, now, 0.06);
  }

  countdownBeep(isGo) {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = isGo ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, now);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.35 : 0.16));
    osc.connect(gain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + (isGo ? 0.37 : 0.18));
  }

  boost() {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(560, now + 0.24);
    gain.gain.setValueAtTime(0.07, now);
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
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.22);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  pickup() {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.045);
      gain.gain.setValueAtTime(0.06, now + i * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.14);
      osc.connect(gain).connect(this.masterGain);
      osc.start(now + i * 0.045);
      osc.stop(now + i * 0.045 + 0.15);
    });
  }

  lapComplete() {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;
    [440, 554.37, 659.25].forEach((freq, i) => {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.07);
      gain.gain.setValueAtTime(0.07, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.2);
      osc.connect(gain).connect(this.masterGain);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.22);
    });
  }

  finishFanfare(won) {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;
    const notes = won ? [523.25, 659.25, 783.99, 1046.5] : [392, 440, 523.25];
    notes.forEach((freq, i) => {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.09);
      gain.gain.setValueAtTime(0.08, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.32);
      osc.connect(gain).connect(this.masterGain);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.35);
    });
  }

  collision() {
    if (!this.settings.sound || !this.context) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(118, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);
    gain.gain.setValueAtTime(0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
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

