/* EarthPlay — synthesised sound effects and ambience (WebAudio, no asset files). */
(function () {
'use strict';
const EP = globalThis.EP;

class AudioFX {
    constructor() {
        this.enabled = true; this.volume = 0.6; this.ctx = null; this.last = {};
        try { const s = JSON.parse(localStorage.getItem('earthplay.audio') || 'null'); if (s) { this.enabled = s.enabled; this.volume = s.volume; } } catch (e) { /* ignore */ }
    }
    save() { try { localStorage.setItem('earthplay.audio', JSON.stringify({ enabled: this.enabled, volume: this.volume })); } catch (e) { /* ignore */ } }
    ensure() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        const ctx = this.ctx = new AC();
        this.master = ctx.createGain(); this.master.gain.value = this.enabled ? this.volume : 0; this.master.connect(ctx.destination);
        const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
        // Ambient bed: filtered noise for wind / surf
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        this.ambFilter = ctx.createBiquadFilter(); this.ambFilter.type = 'lowpass'; this.ambFilter.frequency.value = 500;
        this.ambGain = ctx.createGain(); this.ambGain.gain.value = 0;
        src.connect(this.ambFilter).connect(this.ambGain).connect(this.master); src.start();
        return true;
    }
    setEnabled(on) { this.enabled = on; if (this.master) this.master.gain.value = on ? this.volume : 0; this.save(); }
    setVolume(v) { this.volume = v; if (this.master && this.enabled) this.master.gain.value = v; this.save(); }
    ambient(zoom, rain) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const g = 0.025 + EP.clamp(zoom / 6, 0, 0.05) + rain * 0.08;
        this.ambGain.gain.setTargetAtTime(g, t, 0.5);
        this.ambFilter.frequency.setTargetAtTime(380 + rain * 1600 + Math.sin(t * 0.3) * 120, t, 0.8);
    }

    tone(f, dur, type = 'sine', vol = 0.2, f2 = null, delay = 0) {
        const c = this.ctx, t = c.currentTime + delay;
        const o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t);
        if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
    }
    noise(dur, vol = 0.3, freq = 1000, type = 'lowpass', f2 = null, delay = 0, q = 1) {
        const c = this.ctx, t = c.currentTime + delay;
        const s = c.createBufferSource(); s.buffer = this.noiseBuf;
        const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
        if (f2) f.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f).connect(g).connect(this.master);
        s.start(t, Math.random()); s.stop(t + dur + 0.05);
    }
    play(name, vol = 1) {
        if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
        const now = performance.now();
        const gap = { chop: 120, build: 150, spawn: 60, fire: 200, thunder: 120, explosion: 80, firework: 90, zap: 120 }[name] || 50;
        if (this.last[name] && now - this.last[name] < gap) return;
        this.last[name] = now;
        const v = vol;
        switch (name) {
            case 'click': this.tone(1200, 0.04, 'square', 0.04 * v); break;
            case 'select': this.tone(660, 0.07, 'triangle', 0.08 * v, 990); break;
            case 'spawn': this.tone(520, 0.1, 'sine', 0.1 * v, 820); this.tone(820, 0.1, 'sine', 0.06 * v, 1240, 0.06); break;
            case 'build': this.noise(0.06, 0.12 * v, 1400, 'bandpass', null, 0, 3); this.tone(180, 0.06, 'square', 0.04 * v); break;
            case 'chop': this.noise(0.05, 0.08 * v, 2200, 'bandpass', null, 0, 4); break;
            case 'thunder': this.noise(0.15, 0.5 * v, 4000, 'highpass'); this.noise(1.8, 0.55 * v, 900, 'lowpass', 90, 0.05); break;
            case 'explosion': this.noise(1.4, 0.8 * v, 700, 'lowpass', 50); this.tone(90, 0.8, 'sine', 0.5 * v, 30); break;
            case 'nuke': this.noise(3.5, 1 * v, 500, 'lowpass', 30); this.tone(60, 2.5, 'sine', 0.7 * v, 18); this.noise(0.4, 0.6 * v, 3000, 'highpass'); break;
            case 'fire': this.noise(0.5, 0.18 * v, 900, 'bandpass', 400, 0, 0.7); break;
            case 'fireball': this.noise(0.35, 0.18 * v, 500, 'bandpass', 1500, 0, 1); break;
            case 'whoosh': this.noise(0.9, 0.22 * v, 300, 'bandpass', 2200, 0, 2); break;
            case 'quake': this.noise(2.6, 0.6 * v, 140, 'lowpass', 60); this.tone(42, 2, 'sine', 0.35 * v, 30); break;
            case 'rumble': this.noise(1.2, 0.3 * v, 120, 'lowpass', 60); break;
            case 'wind': this.noise(3, 0.3 * v, 300, 'bandpass', 1200, 0, 3); break;
            case 'rain': this.noise(2.5, 0.18 * v, 3500, 'highpass'); break;
            case 'collapse': this.noise(0.7, 0.3 * v, 600, 'lowpass', 120); break;
            case 'bless': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.07 * v, null, i * 0.06)); break;
            case 'curse': this.tone(220, 0.8, 'sawtooth', 0.08 * v, 110); this.tone(233, 0.8, 'sawtooth', 0.06 * v, 104); break;
            case 'plague': this.tone(170, 0.6, 'square', 0.05 * v, 120); this.noise(0.6, 0.1 * v, 600, 'bandpass', 300); break;
            case 'war': this.tone(110, 0.9, 'sawtooth', 0.12 * v); this.tone(165, 0.9, 'sawtooth', 0.08 * v, null, 0.12); this.noise(0.15, 0.2 * v, 200, 'lowpass', null, 0.0); break;
            case 'peace': this.tone(660, 0.6, 'sine', 0.08 * v); this.tone(880, 0.8, 'sine', 0.07 * v, null, 0.15); break;
            case 'age': [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.08 * v, null, i * 0.11)); break;
            case 'found': [440, 554, 659].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.07 * v, null, i * 0.09)); break;
            case 'fall': [392, 311, 262].forEach((f, i) => this.tone(f, 0.45, 'triangle', 0.08 * v, null, i * 0.16)); break;
            case 'conquest': this.noise(0.12, 0.3 * v, 180, 'lowpass'); this.noise(0.12, 0.3 * v, 180, 'lowpass', null, 0.18); this.tone(147, 0.7, 'sawtooth', 0.09 * v, null, 0.3); break;
            case 'firework': this.tone(500, 0.35, 'sine', 0.04 * v, 1900); this.noise(0.12, 0.35 * v, 900, 'lowpass', null, 0.35); this.noise(0.9, 0.12 * v, 5000, 'highpass', null, 0.4); break;
            case 'zap': this.tone(1500, 0.22, 'square', 0.04 * v, 260); this.tone(1100, 0.22, 'sawtooth', 0.025 * v, 180, 0.03); break;
            case 'freeze': this.tone(1700, 0.45, 'triangle', 0.05 * v, 2600); this.noise(0.6, 0.1 * v, 6000, 'highpass'); break;
            case 'acid': this.noise(0.7, 0.14 * v, 1800, 'bandpass', 500, 0, 2); this.tone(300, 0.4, 'sine', 0.03 * v, 120); break;
            case 'mad': this.tone(320, 0.18, 'sawtooth', 0.06 * v, 160); this.tone(340, 0.18, 'sawtooth', 0.05 * v, 150, 0.12); break;
            case 'notify':this.tone(880, 0.06, 'sine', 0.06 * v); this.tone(1320, 0.1, 'sine', 0.05 * v, null, 0.06); break;
        }
    }
}
EP.AudioFX = AudioFX;
})();
