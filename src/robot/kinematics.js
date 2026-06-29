import { JOINTS, L, REACH, clampDeg } from "./spec.js";

// ---------- IK (planar 2-link + base yaw) ----------
// Hand-rolled, not a library. Base yaw aims at the target; shoulder/elbow
// reduce to a planar 2-link solution (law of cosines) in the vertical plane;
// wrist does a simple leveling aim. Wrist orientation is approximate.
//
// `prevAngles` supplies the joints this solver doesn't drive (4 and 6) so
// they hold their previous value instead of snapping to zero.
export function solveIK(tx, ty, tz, prevAngles) {
  const j = JOINTS;
  const yaw = (Math.atan2(tz, tx) * 180) / Math.PI;
  const a1 = clampDeg(yaw, j[0]);
  const r = Math.hypot(tx, tz);
  const dy = ty;
  const reachable = Math.hypot(r, dy) <= REACH;
  const dist = Math.min(Math.hypot(r, dy), REACH - 0.001);
  const a = L.upperArm;
  const b = L.foreArm + L.wrist;
  const cosE = (dist * dist - a * a - b * b) / (2 * a * b);
  const elbow = Math.acos(Math.max(-1, Math.min(1, cosE)));
  const phi = Math.atan2(dy, r);
  const psi = Math.atan2(b * Math.sin(elbow), a + b * Math.cos(elbow));
  const a2 = clampDeg(90 - ((phi + psi) * 180) / Math.PI, j[1]);
  const a3 = clampDeg((-elbow * 180) / Math.PI, j[2]);
  const a5 = clampDeg(-(a2 + a3) * 0.5, j[4]);
  return {
    angles: [a1, a2, a3, prevAngles[3], a5, prevAngles[5]],
    reachable,
  };
}
