/**
 * Gunshot.js — Synthesized revolver shot (Web Audio, no sound file)
 *
 * A burst of filtered noise for the crack, a falling sine for the thump and a
 * short feedback delay for the saloon's echo.
 */

export class Gunshot {
  constructor() {
    this._ctx = null;
    this._noise = null;
  }

  /** Create / resume the audio context. Call from a user-driven code path. */
  unlock() {
    if (!this._ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this._ctx = new Ctx();
      this._noise = this._makeNoise();
      this._buildBus();
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
  }

  play() {
    this.unlock();
    const ctx = this._ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const pitch = 0.9 + Math.random() * 0.2;

    // Crack
    const noise = ctx.createBufferSource();
    noise.buffer = this._noise;
    noise.playbackRate.value = pitch;
    const band = ctx.createBiquadFilter();
    band.type = 'lowpass';
    band.frequency.setValueAtTime(6000, now);
    band.frequency.exponentialRampToValueAtTime(700, now + 0.25);
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.9, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    noise.connect(band).connect(crackGain).connect(this._bus);
    noise.start(now);
    noise.stop(now + 0.4);

    // Thump
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.18);
    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0.8, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(thumpGain).connect(this._bus);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  _buildBus() {
    const ctx = this._ctx;
    this._bus = ctx.createGain();
    this._bus.gain.value = 0.35;

    // Room echo
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.11;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    const echoFilter = ctx.createBiquadFilter();
    echoFilter.type = 'lowpass';
    echoFilter.frequency.value = 1800;

    this._bus.connect(ctx.destination);
    this._bus.connect(delay);
    delay.connect(echoFilter).connect(feedback).connect(delay);
    echoFilter.connect(ctx.destination);
  }

  _makeNoise() {
    const ctx = this._ctx;
    const length = Math.floor(ctx.sampleRate * 0.4);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
}
