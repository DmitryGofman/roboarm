# ABB IRB 6700 — Phone Teleop Simulator

Hold your phone, move it through the air, and a simulated **ABB IRB 6700-150/3.20**
robot arm mirrors the motion in real time. Out-of-reach poses buzz the phone.

This is the Vite + React port of the original single-file prototype. See
[`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design.

## Quickstart

```bash
npm install
npm run dev        # serves on http://localhost:5173 (and your LAN IP)
```

Open on **desktop** to watch the arm (auto-orbits, view-only — no sensors).
Open on a **phone**, tap **GRANT SENSORS & START**, allow motion access, then
move the phone to drive the arm.

## iOS / HTTPS note

iOS only delivers `DeviceMotion`/`DeviceOrientation` events over a **secure
(HTTPS) origin** after a user tap. `npm run dev` is plain HTTP, so on iPhone use
one of:

- a tunnel that gives an HTTPS URL (e.g. `cloudflared tunnel --url http://localhost:5173`), or
- a deployed build (see below).

It also must be its **own origin** — iOS blocks motion permission inside iframe
sandboxes.

## Build & deploy

```bash
npm run build      # outputs static site to dist/
npm run preview    # serve the production build locally
```

Deploy `dist/` to any static HTTPS host — Netlify, Vercel, or GitHub Pages.

## Project layout

```
index.html              Vite entry (thin)
src/
  main.jsx              React mount
  App.jsx               UI shell + telemetry wiring
  robot/
    spec.js             ABB IRB6700 joint limits + link lengths (source of truth)
    kinematics.js       solveIK() + clamp
    RobotArm.jsx        three.js joint-group chain
  sensors/
    useMotion.js        devicemotion/orientation hook + permission flow
    integrate.js        quaternion, high-pass, ZUPT, double-integration
  ui/
    Telemetry.jsx       quat/acc/vel/pos/ZUPT/IK/joints readout
public/
  models/              exported glTF/STL meshes go here (CAD shell — roadmap)
```

## Known limits

Position drifts (double integration is lossy — RECENTER zeros it, keep gestures
short); browser sensor quality varies; wrist orientation is approximate (IK
simplification). See `ARCHITECTURE.md §5`.
