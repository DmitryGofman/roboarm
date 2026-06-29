import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { JOINTS, MAXREACH } from "./robot/spec.js";
import { solveIK } from "./robot/kinematics.js";
import RobotArm from "./robot/RobotArm.jsx";
import Telemetry from "./ui/Telemetry.jsx";
import { useMotion } from "./sensors/useMotion.js";
import CameraBackground from "./ar/CameraBackground.jsx";
import { useHandTracker } from "./ar/useHandTracker.js";

const C = {
  panel: "#0f1620",
  line: "#1e2c3a",
  txt: "#c7d4e0",
  dim: "#6b8299",
  accent: "#ff6a13",
  good: "#33ff99",
  warn: "#ff4757",
};

export default function App() {
  // shared mutable state the render loop reads from (kept out of React state
  // so 60 Hz updates don't trigger re-renders).
  const state = useMemo(
    () => ({
      angles: JOINTS.map((j) => j.home),
      target: new THREE.Vector3(),
      quat: null,
      scale: 6,
      live: false,
      paused: false,
      stabilize: true,
      invert: false,
      mode: "aim", // "aim" (orientation + reach) | "move" (integrated position)
      reach: 1.6, // metres along the aim vector
      aimDir: new THREE.Vector3(1, 0, 0),
      ar: false, // camera/hand-tracking AR mode
      hasData: false,
    }),
    []
  );

  const [tele, setTele] = useState(null);
  const [scale, setScaleState] = useState(6);
  const [live, setLive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [stabilize, setStabilize] = useState(true);
  const [invert, setInvert] = useState(false);
  const [mode, setMode] = useState("aim");
  const [reach, setReachState] = useState(1.6);
  const [acousticOn, setAcousticOn] = useState(false);
  const [arOn, setArOn] = useState(false);
  const [handPresent, setHandPresent] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [msg, setMsg] = useState("");

  // throttle telemetry React updates to ~20 Hz; the 3D arm still runs at 60.
  const lastTele = useRef(0);
  const onTelemetry = (snap) => {
    const now = performance.now();
    if (now - lastTele.current < 50) return;
    lastTele.current = now;
    setTele(snap);
  };

  const { start, recenter, toggleAcoustic } = useMotion(state, onTelemetry);

  // ---- AR: camera hand-tracking drives the arm ----
  // map a normalized hand position -> aim direction + reach -> IK -> arm.
  const HAND_YAW = THREE.MathUtils.degToRad(70); // left/right swing
  const HAND_PITCH = THREE.MathUtils.degToRad(55); // up/down swing
  const handPresentRef = useRef(false);
  const onHand = (h) => {
    if (!h.present) {
      if (handPresentRef.current) {
        handPresentRef.current = false;
        setHandPresent(false);
      }
      return;
    }
    if (!handPresentRef.current) {
      handPresentRef.current = true;
      setHandPresent(true);
    }
    // rear camera is not mirrored; image x grows to the right, y grows downward
    const yaw = (h.x - 0.5) * 2 * HAND_YAW;
    const pitch = -(h.y - 0.5) * 2 * HAND_PITCH;
    const dir = state.aimDir.set(
      Math.cos(pitch) * Math.cos(yaw),
      Math.sin(pitch),
      Math.cos(pitch) * Math.sin(yaw)
    );
    // hand size (closer hand = bigger) -> reach along the ray
    const reachM = THREE.MathUtils.clamp(
      THREE.MathUtils.mapLinear(h.size, 0.08, 0.34, 0.8, MAXREACH),
      0.6,
      MAXREACH
    );
    state.target.copy(dir).multiplyScalar(reachM);
    const ik = solveIK(state.target.x, state.target.y, state.target.z, state.angles);
    state.angles = ik.angles;
  };
  const tracker = useHandTracker(onHand);

  const onCamReady = async (video) => {
    const m = await tracker.start(video);
    if (m) setMsg(m);
  };
  const onCamError = (e) => {
    // fall back to the existing (non-camera) mode
    state.ar = false;
    setArOn(false);
    setMsg("Camera unavailable — using sensor mode. " + (e?.message || ""));
  };
  const onAR = () => {
    const v = !arOn;
    state.ar = v;
    setArOn(v);
    setMsg("");
    if (!v) {
      tracker.stop();
      setHandPresent(false);
    }
  };

  const onScale = (v) => {
    state.scale = v;
    setScaleState(v);
  };

  const onHold = () => {
    const v = !paused;
    state.paused = v;
    setPaused(v);
  };

  const onStabilize = () => {
    const v = !stabilize;
    state.stabilize = v;
    setStabilize(v);
  };

  const onInvert = () => {
    const v = !invert;
    state.invert = v;
    setInvert(v);
  };

  const onMode = () => {
    const v = mode === "aim" ? "move" : "aim";
    state.mode = v;
    setMode(v);
  };

  const onReach = (v) => {
    state.reach = v;
    setReachState(v);
  };

  const onAcoustic = async () => {
    const m = await toggleAcoustic();
    if (m) setMsg(m);
    setAcousticOn((v) => !v);
  };

  const onResetView = () => state.resetView?.();

  const onStart = async () => {
    setMsg("");
    const m = await start();
    setMsg(m);
    setLive(true);
  };

  const reachable = tele ? tele.reachable : true;

  return (
    <>
      {arOn && (
        <CameraBackground
          facingMode="environment"
          onReady={onCamReady}
          onError={onCamError}
        />
      )}

      <RobotArm state={state} />

      {/* center reticle (AR aiming) */}
      {arOn && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%,-50%)",
            width: 18,
            height: 18,
            border: `2px solid ${handPresent ? C.good : C.txt}`,
            borderRadius: "50%",
            boxShadow: `0 0 8px ${handPresent ? C.good : "transparent"}`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* header */}
      <div
        style={{
          pointerEvents: "auto",
          padding: "10px 14px",
          borderBottom: `1px solid ${C.line}`,
          display: "flex",
          gap: 12,
          alignItems: "center",
          background: "rgba(10,14,20,.6)",
          backdropFilter: "blur(4px)",
        }}
      >
        <b style={{ color: C.accent, letterSpacing: 1 }}>IRB 6700-150/3.20</b>
        <span style={{ fontSize: 11, color: C.dim }}>
          PHONE TELEOP SIM · 150kg · 3.2m
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: live ? C.good : C.dim,
          }}
        >
          {live ? "● LIVE" : "○ IDLE"}
        </span>
        <button
          onClick={() => setPanelOpen((v) => !v)}
          style={{
            background: panelOpen ? C.accent : "transparent",
            color: panelOpen ? "#0a0e14" : C.txt,
            border: `1px solid ${panelOpen ? C.accent : C.line}`,
            padding: "5px 10px",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {panelOpen ? "▾ PANEL" : "▸ PANEL"}
        </button>
      </div>

      <div style={{ flex: 1 }} />

      {/* out-of-reach badge */}
      {!reachable && (
        <div
          style={{
            position: "absolute",
            top: 56,
            left: "50%",
            transform: "translateX(-50%)",
            background: C.warn,
            color: "#0a0e14",
            padding: "4px 12px",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          ⚠ OUT OF REACH
        </div>
      )}

      {/* start overlay */}
      {!live && (
        <div
          style={{
            pointerEvents: "auto",
            position: "absolute",
            left: 0,
            right: 0,
            top: 46,
            bottom: 150,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            textAlign: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: C.dim,
              maxWidth: 340,
              lineHeight: 1.6,
            }}
          >
            This is the ABB IRB 6700 modelled with its real joint limits and
            3.2 m reach. On a phone, tap below, allow motion access, then move
            the phone — the arm mirrors you. On desktop you can watch the arm;
            sensors are phone-only.
          </div>
          <button
            onClick={onStart}
            style={{
              pointerEvents: "auto",
              background: C.accent,
              color: "#0a0e14",
              border: "none",
              padding: "12px 26px",
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            GRANT SENSORS & START
          </button>
          <div style={{ fontSize: 12, color: C.warn, minHeight: 16 }}>{msg}</div>
        </div>
      )}

      {live && msg && (
        <div
          style={{
            position: "absolute",
            top: 56,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 12,
            color: C.warn,
            pointerEvents: "none",
          }}
        >
          {msg}
        </div>
      )}

      {panelOpen && (
        <Telemetry
          t={tele}
          scale={scale}
          onScale={onScale}
          onRecenter={recenter}
          paused={paused}
          onHold={onHold}
          onResetView={onResetView}
          stabilize={stabilize}
          onStabilize={onStabilize}
          invert={invert}
          onInvert={onInvert}
          mode={mode}
          onMode={onMode}
          reach={reach}
          onReach={onReach}
          acousticOn={acousticOn}
          onAcoustic={onAcoustic}
          arOn={arOn}
          onAR={onAR}
          handPresent={handPresent}
        />
      )}
    </>
  );
}
