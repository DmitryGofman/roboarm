# ABB IRB 6700 — Phone Teleop Simulator

**One line:** Hold your phone, move it through the air, and a simulated ABB IRB 6700-150/3.20 robot arm mirrors the motion in real time. Out-of-reach poses buzz the phone.

**Status:** Working single-file prototype (`index.html`). Renders the arm + drives it live from phone IMU. Ready to break into a proper project structure.

---

## 1. What this is

A browser-based teaching/demo tool. The phone's motion sensors drive the end-effector target of a kinematically-accurate model of a specific real robot (ABB IRB 6700-150/3.20). It makes two normally-invisible things visible while you move: **sensor fusion** (how raw IMU becomes orientation + position) and **inverse kinematics** (how a target pose becomes joint angles).

It is a simulator + teaching aid, **not** a robot-programming-grade motion capture system. Position is approximate by design (see §5).

---

## 2. Target robot — ABB IRB 6700-150/3.20

Modeled from ABB's published spec. These numbers are the source of truth for the kinematic model.

| Property | Value |
|---|---|
| Payload | 150 kg |
| Reach | 3200 mm |
| Axes | 6 |
| Axis 1 (base yaw) | ±170° |
| Axis 2 (shoulder) | -65° / +85° |
| Axis 3 (elbow) | -180° / +70° |
| Axis 4 (wrist roll) | ±300° |
| Axis 5 (wrist bend) | ±130° |
| Axis 6 (flange) | ±360° |

Link proportions in the model sum to the real 3.2 m reach. Joint limits are enforced in the IK clamp.

---

## 3. Architecture

### 3.1 Pipeline (one ~60 Hz loop)

```
  SENSORS            STATE                   ROBOT MAP            RENDER
  --------           -----                   ---------            ------
  DeviceMotion   ->   orientation (quat)  ->  IK solver        -> three.js
  DeviceOrient.       position (int int a)    -> joint angles      arm + ghost + target
                      ZUPT / high-pass        out-of-reach? ----> haptic buzz
```

### 3.2 Stages

**Sensor capture** — `DeviceOrientationEvent` (fused orientation) + `DeviceMotionEvent` (`acceleration`, `accelerationIncludingGravity` fallback, `rotationRate`). iOS requires a tap + HTTPS to grant.

**Orientation** *(reliable)* — device Euler -> quaternion. Trusted almost fully; this signal "just works."

**Position** *(approximate — the hard part)* — linear accel rotated into world frame, double-integrated to velocity then position. Drift defenses: high-pass filter on world accel, **ZUPT** (zero-velocity update — when accel and rotation are both near zero for N frames, force velocity to 0), mild velocity decay. Good for short (3–5 s) gestures.

**Robot map** — integrated phone position, scaled and offset to a home pose in front of the robot, becomes the IK target. IK returns joint angles + a reachability flag. Unreachable -> haptic + visual warning.

**Render** — three.js scene graph; arm is a nested group chain (one group per joint). Auto-orbits before going live so the arm is visible on load.

### 3.3 Kinematic chain (group nesting)

```
base (fixed)
\- J1  yaw   (rotation.y)   shoulder turret
   \- J2  pitch (rotation.z)  upper arm
      \- J3  pitch (rotation.z)  forearm (elbow)
         \- J4  roll  (rotation.y)  wrist tube
            \- J5  pitch (rotation.z)  wrist bend
               \- J6  roll (rotation.y)  tool flange
```

Each joint group carries its link geometry. **This nesting is the integration seam for real CAD meshes** — drop a mesh onto the matching group and it inherits correct motion (see §6).

### 3.4 IK approach

Hand-rolled, not a library. Base yaw aims at the target; the shoulder/elbow reduce to a planar 2-link solution (law of cosines) in the vertical plane; wrist does a simple leveling aim. Lightweight, fully in-file, and easy to read for teaching. Trade-off: not a full 6-DOF analytic solver — wrist orientation is approximate. Good enough for the demo; swap for a real solver if exactness is needed.

---

## 4. Current file

- `index.html` — entire app, self-contained. React/three loaded via CDN, no build step. Opens by double-click; works on desktop (view only) and phone (full teleop over HTTPS).

Key sections inside: ABB spec constants -> IK solver -> three.js scene + geometry -> sensor handlers -> permission/start flow -> telemetry UI.

---

## 5. Known limits (state honestly in UI)

- **Position drifts.** Double integration is inherently lossy. RECENTER zeros it; keep gestures short.
- **Browser sensor quality varies** by device and rate.
- **No magnetometer calibration** -> yaw can wander; the orientation API mitigates.
- **iframe sandboxes block iOS motion permission** — must be served from its own HTTPS origin, not embedded.
- **Wrist orientation is approximate** (IK simplification).

---

## 6. Roadmap

**P-now -> next**
- [ ] Move single-file `index.html` into a real project (Vite + React). See §7.
- [ ] OrbitControls for manual camera (currently fixed/auto-orbit).
- [ ] Tune home pose + default scale for natural 1:1-ish feel.

**P-mid**
- [ ] **Real CAD shell** — export SolidWorks parts to glTF/GLB (or STL), load onto joint groups (§3.3). Decimate meshes so phones stay smooth.
- [ ] Record-then-replay: 3-2-1 countdown, capture a path, replay the arm tracing it.
- [ ] Save/load recorded paths (localStorage or file export).

**P-later**
- [ ] Swap hand-rolled IK for a proper 6-DOF solver if accuracy demands.
- [ ] Collision / joint-limit visualization.
- [ ] Multi-robot variants (rest of IRB 6700 family share the chain).

---

## 7. Suggested project structure (for the move to Vite/React)

```
/
|- index.html              # Vite entry (thin)
|- package.json
|- ARCHITECTURE.md         # this file
|- README.md               # quickstart + deploy
|- public/
|  \- models/              # exported glTF/STL meshes go here
\- src/
   |- main.jsx
   |- App.jsx              # layout, UI shell, telemetry panel
   |- robot/
   |  |- spec.js           # ABB IRB6700 joint limits + link lengths (single source of truth)
   |  |- kinematics.js     # solveIK(), clamp, forward helpers
   |  \- RobotArm.jsx      # three.js chain; loads meshes if present, else primitives
   |- sensors/
   |  |- useMotion.js      # devicemotion/orientation hooks + permission flow
   |  \- integrate.js      # quaternion, high-pass, ZUPT, int int -> position
   \- ui/
      \- Telemetry.jsx     # quat/acc/vel/pos/ZUPT/IK/joints readout
```

The single `index.html` maps cleanly onto this: spec constants -> `robot/spec.js`; IK -> `robot/kinematics.js`; geometry -> `robot/RobotArm.jsx`; sensor handlers + integration -> `sensors/`; telemetry DOM -> `ui/Telemetry.jsx`.

---

## 8. Deploy

Needs HTTPS for iOS motion sensors. Options: Netlify (drag-drop or git), Vercel, GitHub Pages. For a build-step project, point the host at the Vite `dist/` output. For quick tests, Netlify Drop with the built files works with zero config.
