import { useRef } from "react";

// MediaPipe HandLandmarker — lazy-loaded (WASM + model from CDN) only when AR
// starts, so it stays out of the main bundle. Runs detection on a <video> each
// frame and reports a normalized hand target.
const WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export function useHandTracker(onResult) {
  const ref = useRef({ landmarker: null, raf: 0, running: false, video: null });

  // returns "" on success, or an error message
  async function start(video) {
    const s = ref.current;
    s.video = video;
    try {
      if (!s.landmarker) {
        const { FilesetResolver, HandLandmarker } = await import(
          "@mediapipe/tasks-vision"
        );
        const fileset = await FilesetResolver.forVisionTasks(WASM);
        s.landmarker = await HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL, delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 1,
        });
      }
    } catch (e) {
      return "Hand tracking failed to load: " + (e.message || e);
    }

    s.running = true;
    let lastTs = -1;
    const loop = () => {
      if (!s.running) return;
      s.raf = requestAnimationFrame(loop);
      const v = s.video;
      if (!v || v.readyState < 2) return;
      const ts = performance.now();
      if (ts <= lastTs) return; // detectForVideo needs strictly increasing ts
      lastTs = ts;
      let res;
      try {
        res = s.landmarker.detectForVideo(v, ts);
      } catch (_) {
        return;
      }
      const lm = res?.landmarks?.[0];
      if (lm && lm.length >= 13) {
        const palm = lm[9]; // middle-finger MCP ≈ palm center
        const wrist = lm[0];
        const size = Math.hypot(palm.x - wrist.x, palm.y - wrist.y);
        onResult({ x: palm.x, y: palm.y, size, present: true });
      } else {
        onResult({ present: false });
      }
    };
    s.raf = requestAnimationFrame(loop);
    return "";
  }

  function stop() {
    const s = ref.current;
    s.running = false;
    cancelAnimationFrame(s.raf);
  }

  return { start, stop };
}
