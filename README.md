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

## Deploy (GitHub Pages — automatic)

This repo ships a GitHub Actions workflow (`.github/workflows/deploy.yml`) that
builds and publishes to **GitHub Pages** on every push. You get a permanent
`https://` URL — exactly what iOS needs for motion sensors.

**One-time setup:** in the GitHub repo, go to **Settings → Pages → Build and
deployment → Source** and select **GitHub Actions**. (You only do this once.)

After that, every push triggers a deploy. The site lands at:

```
https://<your-github-username>.github.io/roboarm/
```

Open **that** URL in iPhone Safari and tap **GRANT SENSORS & START**. Watch the
deploy run under the repo's **Actions** tab; first deploy takes ~1–2 min.

### Other hosts / local build

```bash
npm run build      # outputs static site to dist/
npm run preview    # serve the production build locally
```

`dist/` deploys to any static HTTPS host (Netlify, Vercel). Note the build sets
base path `/roboarm/` for GitHub Pages — if you host at a domain root instead,
adjust `base` in `vite.config.js`.

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
