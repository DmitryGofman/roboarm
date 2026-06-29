// ---------- acoustic Doppler motion sensor (experimental) ----------
// Emits a quiet near-ultrasonic tone from the speaker and watches the mic
// spectrum. A moving hand/body Doppler-shifts the reflection, spreading energy
// into side-bands around the carrier. The side-band/carrier ratio is a
// motion signal (0 = still, higher = moving) that is independent of the IMU —
// useful as a drift "still" detector. It measures *motion*, not position.
//
// Honest caveats: phone speakers/mics roll off above ~20 kHz, the carrier
// leaks heavily, and rooms echo — so the metric is relative and needs the
// volume/threshold tuned per device. The UI shows the raw value so you can see
// whether it is actually responding.

const FREQ = 19500; // Hz — near-ultrasonic: mostly inaudible to adults

export function createAcoustic() {
  let ctx, osc, gain, analyser, stream, src, data;
  let carrierBin = 0;
  let running = false;
  let motion = 0; // smoothed 0..~1 motion energy
  let level = -120; // carrier level in dB (sanity check the tone is heard)

  async function start() {
    if (running) return "";
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      await ctx.resume();

      // emit the carrier tone (ramp in to avoid a click)
      osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = FREQ;
      gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start();

      // capture the mic with all processing OFF (it would kill ultrasound)
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      src = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0.3;
      src.connect(analyser);
      data = new Float32Array(analyser.frequencyBinCount);
      const binHz = ctx.sampleRate / analyser.fftSize;
      carrierBin = Math.round(FREQ / binHz);
      running = true;
      return "";
    } catch (e) {
      stop();
      return "Acoustic start failed: " + (e.message || e);
    }
  }

  // call regularly (e.g. each motion frame) to refresh the metric
  function update() {
    if (!running || !analyser) return;
    analyser.getFloatFrequencyData(data); // dB values
    level = data[carrierBin];

    const lin = (db) => Math.pow(10, db / 10);
    const carrierLin = lin(level) + 1e-12;
    // side-bands: skip ±2 bins of leakage, sum a Doppler window either side
    const lo = 3,
      hi = 40;
    let energy = 0,
      n = 0;
    for (let k = lo; k <= hi; k++) {
      const a = carrierBin - k,
        b = carrierBin + k;
      if (a >= 0) energy += lin(data[a]);
      if (b < data.length) energy += lin(data[b]);
      n += 2;
    }
    const ratio = energy / n / carrierLin; // motion ↑ as side-bands grow
    const m = Math.min(1, ratio * 60);
    motion = motion * 0.7 + m * 0.3; // smooth
  }

  function stop() {
    running = false;
    try {
      osc && osc.stop();
    } catch (_) {}
    try {
      stream && stream.getTracks().forEach((t) => t.stop());
    } catch (_) {}
    try {
      ctx && ctx.close();
    } catch (_) {}
    osc = gain = analyser = src = stream = ctx = data = null;
    motion = 0;
    level = -120;
  }

  return {
    start,
    stop,
    update,
    get running() {
      return running;
    },
    get motion() {
      return motion;
    },
    get level() {
      return level;
    },
  };
}
