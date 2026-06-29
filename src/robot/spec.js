// ===== ABB IRB 6700-150/3.20 kinematic data (official ABB spec) =====
// Single source of truth for joint limits + link proportions.

export const JOINTS = [
  { name: "Axis 1", min: -170, max: 170, home: 0 },
  { name: "Axis 2", min: -65, max: 85, home: 0 },
  { name: "Axis 3", min: -180, max: 70, home: 0 },
  { name: "Axis 4", min: -300, max: 300, home: 0 },
  { name: "Axis 5", min: -130, max: 130, home: 0 },
  { name: "Axis 6", min: -360, max: 360, home: 0 },
];

// Link proportions sum to the real 3.2 m reach.
export const L = { base: 0.78, upperArm: 1.28, foreArm: 1.14, wrist: 0.2 };
export const REACH = L.upperArm + L.foreArm + L.wrist;

// Kinematic parameters that MUST match the RobotArm geometry so the IK target
// (green dot) lands on the actual end-effector. The shoulder pitch pivot (j2)
// sits 0.46 above the base turret; the forearm carries a 0.28 wrist-tube offset
// plus the 0.20 flange, all collinear when the wrist bend (a5) is 0.
export const KIN = {
  shoulderY: L.base + 0.46, // 1.24  height of the shoulder pitch pivot
  link1: L.upperArm, // 1.28  shoulder -> elbow
  link2: L.foreArm + 0.28 + L.wrist, // 1.62  elbow -> flange (wrist straight)
};
export const MAXREACH = KIN.link1 + KIN.link2; // 2.90

export const clampDeg = (v, j) => Math.max(j.min, Math.min(j.max, v));
export const d2r = (d) => (d * Math.PI) / 180;
