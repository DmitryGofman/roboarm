import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createIntegrator } from "./integrate.js";
import { solveIK } from "../robot/kinematics.js";

const HOME = new THREE.Vector3(1.6, 1.0, 0);

// Owns the IMU permission flow + event listeners, drives the integrator and IK,
// and writes results into the shared `state` object that RobotArm renders from.
// `onTelemetry` is called on each motion frame with a snapshot for the UI.
export function useMotion(state, onTelemetry) {
  const integ = useRef(createIntegrator());
  const lastBuzz = useRef(0);

  // keep the shared quat reference pointed at the integrator's quat
  useEffect(() => {
    state.quat = integ.current.quat;
  }, [state]);

  useEffect(() => {
    const it = integ.current;

    const onOrient = (e) => it.setOrientation(e);

    const onMotion = (e) => {
      state.hasData = true;
      const accW = it.step(e);
      if (!accW) return;

      state.target.copy(HOME).add(it.pos.clone().multiplyScalar(state.scale));
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

      onTelemetry?.({
        quat: it.quat.toArray(),
        acc: accW.toArray(),
        vel: it.vel.toArray(),
        pos: it.pos.toArray(),
        zupt: it.zupt,
        reachable: ik.reachable,
        angles: ik.angles,
      });
    };

    state._onMotion = onMotion;
    state._onOrient = onOrient;
    return () => {
      window.removeEventListener("devicemotion", onMotion);
      window.removeEventListener("deviceorientation", onOrient);
    };
  }, [state, onTelemetry]);

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
      window.addEventListener("devicemotion", state._onMotion);
      window.addEventListener("deviceorientation", state._onOrient);
      state.live = true;
      return msg;
    } catch (err) {
      return "Couldn't start sensors: " + err.message;
    }
  }

  function recenter() {
    integ.current.recenter();
  }

  return { start, recenter };
}
