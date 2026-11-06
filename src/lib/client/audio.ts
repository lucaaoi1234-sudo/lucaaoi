/**
 * Âm thanh tổng hợp bằng Web Audio API (không cần file âm thanh ngoài).
 * AudioContext chỉ được tạo/mở khóa sau cử chỉ người dùng (click), theo chính sách của trình duyệt.
 */

type Ctx = AudioContext;

export class SfxPlayer {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private volume = 0.6;

  setVolume(percent: number): void {
    this.volume = Math.min(1, Math.max(0, percent / 100));
    if (this.master) this.master.gain.value = this.volume * 0.5;
  }

  /** Gọi trong handler click/keydown để mở khóa âm thanh. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume * 0.5;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      // Trình duyệt không hỗ trợ âm thanh: game vẫn chạy bình thường.
      this.ctx = null;
    }
  }

  playShot(): void {
    this.tone(180, 90, 0.12, "square", 0);
  }

  playHit(): void {
    this.tone(880, 1320, 0.14, "sine", 0);
    this.tone(1320, 1760, 0.1, "triangle", 0.04);
  }

  playMiss(): void {
    this.tone(160, 60, 0.1, "sawtooth", 0);
  }

  playStart(): void {
    this.tone(440, 440, 0.12, "sine", 0);
    this.tone(660, 660, 0.12, "sine", 0.14);
  }

  private tone(fromHz: number, toHz: number, durationSec: number, type: OscillatorType, delaySec: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || ctx.state !== "running") return;
    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fromHz, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, toHz), now + durationSec);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(1, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }
}
