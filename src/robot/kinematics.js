import { JOINTS, KIN, clampDeg } from "./spec.js";

const R2D = 180 / Math.PI;
const clamp1 = (x) => Math.max(-1, Math.min(1, x));

// ---------- IK: base yaw + planar 2-link (correct inverse of the renderer) ----------
// Target (tx,ty,tz) is RELATIVE TO THE SHOULDER PIVOT. The renderer builds the
// arm from +Y (up): j2/j3 rotate about Z (bending in a vertical plane), j1
// rotates the whole plane about Y. Forward kinematics of the flange (wrist
// straight, a5=0):
//   reach plane: R = L1·sinφ + L2·sin(φ+ρ),  y = L1·cosφ + L2·cos(φ+ρ)
//   world:       x = -R·cos(a1),  z =  R·sin(a1)   ->  a1 = atan2(tz, -tx)
// φ = a2 (shoulder), ρ = a3 (elbow). Two elbow branches (±ρ); we pick whichever
// lands inside the joint limits and bend the wrist (a5) the rest of the way.

const L1 = KIN.link1;
const L2 = KIN.link2;

// one elbow branch: returns {a2, a3} in degrees for the given elbow sign
function branch(R, y, sign) {
  const D = Math.min(Math.hypot(R, y), L1 + L2 - 1e-4);
  const cosRho = clamp1((D * D - L1 * L1 - L2 * L2) / (2 * L1 * L2));
  const rho = sign * Math.acos(cosRho); // elbow joint angle
  const phi =
    Math.atan2(R, y) - Math.atan2(L2 * Math.sin(rho), L1 + L2 * Math.cos(rho));
  return { a2: phi * R2D, a3: rho * R2D };
}

const inRange = (v, j) => v >= j.min && v <= j.max;

export function solveIK(tx, ty, tz, prevAngles) {
  const j = JOINTS;
  const a1 = clampDeg(Math.atan2(tz, -tx) * R2D, j[0]); // base yaw

  const R = Math.hypot(tx, tz); // horizontal distance from shoulder
  // floor constraint: never command the tip below the ground plane (world y≈0)
  const y = Math.max(ty, -KIN.shoulderY + 0.15); // height relative to shoulder
  const withinReach = Math.hypot(R, y) <= L1 + L2;

  // try both elbow configurations; prefer one whose joints are in range
  const down = branch(R, y, -1); // elbow-down (a3 negative) — natural for this arm
  const up = branch(R, y, 1);
  const downOK = inRange(down.a2, j[1]) && inRange(down.a3, j[2]);
  const upOK = inRange(up.a2, j[1]) && inRange(up.a3, j[2]);
  const pick = downOK || !upOK ? down : up; // default to elbow-down

  const a2 = clampDeg(pick.a2, j[1]);
  const a3 = clampDeg(pick.a3, j[2]);
  const reachable = withinReach && (downOK || upOK);

  // a5 = 0 keeps the wrist straight so the flange sits exactly at the target.
  return { angles: [a1, a2, a3, prevAngles[3], 0, prevAngles[5]], reachable };
}
