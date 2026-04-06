export const SOUND_EFFECTS_STORAGE_KEY = 'lu_settings_sound_effects';

export function getSoundEffectsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const v = localStorage.getItem(SOUND_EFFECTS_STORAGE_KEY);
  if (v === null) return true;
  return v === '1';
}

export function setSoundEffectsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SOUND_EFFECTS_STORAGE_KEY, enabled ? '1' : '0');
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      audioCtx = new AC();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

/**
 * Short UI beep using Web Audio (no asset files). Respects Settings → Sound effects.
 * Call from click handlers so AudioContext can resume after user gesture.
 */
export function playUiSound(variant: 'tap' | 'toggleOn' = 'tap'): void {
  if (!getSoundEffectsEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const run = () => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    const freq = variant === 'toggleOn' ? 720 : 540;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.055, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    osc.start(t);
    osc.stop(t + 0.1);
  };

  if (ctx.state === 'suspended') {
    void ctx.resume().then(run);
  } else {
    run();
  }
}
