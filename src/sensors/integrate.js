import * as THREE from "three";

// ---------- sensor fusion: orientation + position estimation ----------
// Position is the hard part: linear accel rotated into the world frame, then
// double-integrated to velocity and position. Drift defenses: high-pass filter
// on world accel, ZUPT (zero-velocity update), and a mild velocity decay.
// Good for short (3-5 s) gestures.

export function createIntegrator() {
  const quat = new THREE.Quaternion();
  const vel = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const hp = new THREE.Vector3(); // high-pass running mean of world accel
  let still = 0;

  // device Euler -> quaternion (the reliable signal; trusted almost fully)
  function setOrientation(e) {
    const a = ((e.alpha || 0) * Math.PI) / 180;
    const b = ((e.beta || 0) * Math.PI) / 180;
    const g = ((e.gamma || 0) * Math.PI) / 180;
    quat.setFromEuler(new THREE.Euler(b, a, -g, "YXZ"));
  }

  // Advance the position estimate from one DeviceMotion event.
  // Returns the high-passed world-frame acceleration, or null if the event
  // carried no usable acceleration data.
  function step(e) {
    const dt = e.interval && e.interval > 0 ? e.interval : 1 / 60;
    let ax, ay, az;
    if (e.acceleration && e.acceleration.x != null) {
      ax = e.acceleration.x;
      ay = e.acceleration.y;
      az = e.acceleration.z;
    } else if (e.accelerationIncludingGravity) {
      const gv = new THREE.Vector3(0, 0, 9.81).applyQuaternion(
        quat.clone().invert()
      );
      ax = (e.accelerationIncludingGravity.x || 0) - gv.x;
      ay = (e.accelerationIncludingGravity.y || 0) - gv.y;
      az = (e.accelerationIncludingGravity.z || 0) - gv.z;
    } else {
      return null;
    }

    const accW = new THREE.Vector3(ax, ay, az).applyQuaternion(quat);
    hp.lerp(accW, 0.02);
    accW.sub(hp);

    const rot = e.rotationRate
      ? Math.hypot(
          e.rotationRate.alpha || 0,
          e.rotationRate.beta || 0,
          e.rotationRate.gamma || 0
        )
      : 0;
    const isStill = accW.length() < 0.18 && rot < 8;
    still = isStill ? still + 1 : 0;
    if (still > 6) {
      vel.multiplyScalar(0); // ZUPT
    } else {
      vel.addScaledVector(accW, dt);
      vel.multiplyScalar(0.96);
      pos.addScaledVector(vel, dt);
    }
    return accW;
  }

  function recenter() {
    vel.set(0, 0, 0);
    pos.set(0, 0, 0);
    hp.set(0, 0, 0);
  }

  return {
    quat,
    vel,
    pos,
    setOrientation,
    step,
    recenter,
    get still() {
      return still;
    },
    get zupt() {
      return still > 6;
    },
  };
}
