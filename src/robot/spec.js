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

export const clampDeg = (v, j) => Math.max(j.min, Math.min(j.max, v));
export const d2r = (d) => (d * Math.PI) / 180;
