import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createIntegrator } from "./integrate.js";
import { createAcoustic } from "./acoustic.js";
import { solveIK } from "../robot/kinematics.js";

const HOME = new THREE.Vector3(1.6, 1.0, 0);
// Phone's local +Y (top edge) is the "pointing" axis in AIM mode — point the
// top of the phone where you want the end-effector to go.
const AIM_AXIS = new THREE.Vector3(0, 1, 0);

// Owns the IMU permission flow + event listeners, drives the integrator and IK,
// and writes results into the shared `state` object that RobotArm renders from.
// `onTelemetry` is called on each motion frame with a snapshot for the UI.
//
// The sensor handlers are created ONCE (stable refs) and attached imperatively
// in start(). The teardown effect has empty deps so a re-render never removes a
// live listener — earlier this tore the listener down the instant start() ran.
export function useMotion(state, onTelemetry) {
  const integ = useRef(createIntegrator());
  const acoustic = useRef(createAcoustic());
  const lastBuzz = useRef(0);
  const samples = useRef(0);

  // keep the latest onTelemetry reachable without re-creating handlers
  const onTeleRef = useRef(onTelemetry);
  onTeleRef.current = onTelemetry;

  // point the shared quat reference at the integrator's quat once
  if (state.quat == null) state.quat = integ.current.quat;

  // stable handlers, built exactly once
  const handlers = useRef(null);
  if (handlers.current === null) {
    const it = integ.current;
    handlers.current = {
      onOrient: (e) => it.setOrientation(e),
      onMotion: (e) => {
        state.hasData = true;
        samples.current += 1;

        // refresh the acoustic Doppler metric (if running)
        const ac = acoustic.current;
        ac.update();
        const acMotion = ac.running ? ac.motion : null;
        // acoustic drift-reset: when sound says "still", zero the velocity so
        // integrated position stops creeping (a cross-check on the IMU's ZUPT).
        if (state.mode !== "aim" && ac.running && ac.motion < 0.12) {
          it.zeroVel();
        }

        // HOLD / clutch: keep the feed alive and the ghost following, but
        // freeze the arm so the phone can be repositioned without driving it.
        if (state.paused) {
          it.zeroVel();
          const hz =
            e.interval && e.interval > 0 ? Math.round(1 / e.interval) : 0;
          onTeleRef.current?.({
            quat: it.quat.toArray(),
            acc: [0, 0, 0],
            vel: it.vel.toArray(),
            pos: it.pos.toArray(),
            zupt: it.zupt,
            reachable: true,
            angles: state.angles,
            samples: samples.current,
            hz,
            heading: it.heading,
            acoustic: acMotion,
            paused: true,
          });
          return;
        }

        const accW = it.step(e, state.stabilize !== false);
        if (!accW) return;

        // AR mode: the camera hand-tracker drives the arm, not the IMU. Keep the
        // orientation/telemetry alive but don't fight it for state.angles.
        if (state.ar) {
          const hz = e.interval && e.interval > 0 ? Math.round(1 / e.interval) : 0;
          onTeleRef.current?.({
            quat: it.quat.toArray(),
            acc: accW.toArray(),
            vel: it.vel.toArray(),
            pos: it.pos.toArray(),
            zupt: it.zupt,
            reachable: true,
            angles: state.angles,
            samples: samples.current,
            hz,
            heading: it.heading,
            acoustic: acMotion,
          });
          return;
        }

        if (state.mode === "aim") {
          // AIM: phone orientation is a unit direction; the slider sets how far
          // along it the end-effector sits. Drift-free (orientation only).
          state.aimDir.copy(AIM_AXIS).applyQuaternion(it.quat).normalize();
          state.target.copy(state.aimDir).multiplyScalar(state.reach);
        } else {
          // MOVE: integrated phone displacement -> IK target. INVERT flips the
          // horizontal plane so the arm follows the same direction you move.
          const s = state.scale;
          const f = state.invert ? -1 : 1;
          const p = it.pos;
          state.target.set(
            HOME.x + p.x * s * f,
            HOME.y + p.y * s,
            HOME.z + p.z * s * f
          );
        }
        const ik = solveIK(
          state.target.x,
          state.target.y,
          state.target.z,
          state.angles
        );
        state.angles = ik.angles;

        if (
          !ik.reachable &&
          navigator.vibrate &&
          performance.now() - lastBuzz.current > 350
        ) {
          navigator.vibrate(40);
          lastBuzz.current = performance.now();
        }

        const hz = e.interval && e.interval > 0 ? Math.round(1 / e.interval) : 0;
        onTeleRef.current?.({
          quat: it.quat.toArray(),
          acc: accW.toArray(),
          vel: it.vel.toArray(),
          pos: it.pos.toArray(),
          zupt: it.zupt,
          reachable: ik.reachable,
          angles: ik.angles,
          samples: samples.current,
          hz,
          heading: it.heading,
          acoustic: acMotion,
        });
      },
    };
  }

  // detach only on unmount
  useEffect(() => {
    const h = handlers.current;
    const ac = acoustic.current;
    return () => {
      window.removeEventListener("devicemotion", h.onMotion);
      window.removeEventListener("deviceorientation", h.onOrient);
      ac.stop();
    };
  }, []);

  // Returns a status message (empty on success) so the caller can surface it.
  async function start() {
    const secure = window.isSecureContext;
    try {
      if (
        typeof DeviceMotionEvent !== "undefined" &&
        typeof DeviceMotionEvent.requestPermission === "function"
      ) {
        if (!secure) {
          return "iOS needs HTTPS. Host over https:// (e.g. Netlify / a tunnel) and reopen.";
        }
        const r = await DeviceMotionEvent.requestPermission();
        if (typeof DeviceOrientationEvent.requestPermission === "function") {
          try {
            await DeviceOrientationEvent.requestPermission();
          } catch (_) {
            /* orientation permission optional */
          }
        }
        if (r !== "granted") return "Motion access denied. Reload and allow it.";
      }
      let msg = "";
      if (typeof DeviceMotionEvent === "undefined") {
        msg = "No motion sensors here — open on a phone to drive the arm.";
      }
      window.addEventListener("devicemotion", handlers.current.onMotion);
      window.addEventListener("deviceorientation", handlers.current.onOrient);
      state.live = true;
      return msg;
    } catch (err) {
      return "Couldn't start sensors: " + err.message;
    }
  }

  function recenter() {
    integ.current.recenter();
  }

  // toggle the acoustic Doppler sensor; returns a status message ("" on success)
  async function toggleAcoustic() {
    const ac = acoustic.current;
    if (ac.running) {
      ac.stop();
      return "";
    }
    return ac.start();
  }

  return { start, recenter, toggleAcoustic };
}
