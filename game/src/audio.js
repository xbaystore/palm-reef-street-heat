// A pocket WebAudio synth: an engine hum that follows speed, a two-tone siren
// while police are near, and short blips for punches, crashes, cash and news.
// Everything is gesture-gated (the context starts on the first key press) and the
// whole thing no-ops where there is no window, so Node tests can import it safely.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let muted = false;

  function ensure() {
    if (typeof window === 'undefined' || ctx) return;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      sirenOsc.start();
    } catch {
      ctx = null;
    }
  }

  function blip(freq, dur, type = 'square', vol = 0.08) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // Audio is decoration; never let it break the game.
    }
  }

  return {
    ensure,
    setMuted(value) {
      muted = !!value;
    },
    /** speed01 is 0..1 of the car's top speed; 0 silences the hum. */
    engine(speed01) {
      if (!ctx || muted) return;
      try {
        engineGain.gain.setTargetAtTime(speed01 > 0.02 ? 0.03 + speed01 * 0.05 : 0, ctx.currentTime, 0.08);
        engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.08);
      } catch {
        // Ignore.
      }
    },
    /** True while any cruiser is close; the tone alternates twice a second. */
    siren(on) {
      if (!ctx || muted) {
        if (sirenGain) sirenGain.gain.value = 0;
        return;
      }
      try {
        if (on) {
          sirenGain.gain.setTargetAtTime(0.035, ctx.currentTime, 0.1);
          if (sirenTimer === null) {
            let high = false;
            sirenTimer = setInterval(() => {
              high = !high;
              try {
                sirenOsc.frequency.value = high ? 950 : 700;
              } catch {
                // Ignore.
              }
            }, 500);
          }
        } else {
          sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
          if (sirenTimer !== null) {
            clearInterval(sirenTimer);
            sirenTimer = null;
          }
        }
      } catch {
        // Ignore.
      }
    },
    punch() {
      blip(140, 0.08, 'square', 0.09);
    },
    crash() {
      blip(70, 0.25, 'sawtooth', 0.12);
    },
    cash() {
      blip(880, 0.12, 'sine', 0.1);
      setTimeout(() => blip(1320, 0.16, 'sine', 0.1), 90);
    },
    news() {
      blip(520, 0.1, 'triangle', 0.09);
      setTimeout(() => blip(660, 0.12, 'triangle', 0.09), 110);
    },
    hurt() {
      blip(110, 0.18, 'sawtooth', 0.1);
    },
  };
}
