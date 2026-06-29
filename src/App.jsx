import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { JOINTS } from "./robot/spec.js";
import RobotArm from "./robot/RobotArm.jsx";
import Telemetry from "./ui/Telemetry.jsx";
import { useMotion } from "./sensors/useMotion.js";

const C = {
  panel: "#0f1620",
  line: "#1e2c3a",
  txt: "#c7d4e0",
  dim: "#6b8299",
  accent: "#ff6a13",
  good: "#33ff99",
  warn: "#ff4757",
};

// Small heading indicator. The dial rotates by -heading so the red N needle
// always points to true (magnetic) north relative to the phone's facing.
function Compass({ heading }) {
  const has = heading != null;
  return (
    <div
      style={{
        position: "absolute",
        top: "calc(env(safe-area-inset-top, 0px) + 60px)",
        left: 12,
        width: 64,
        height: 64,
        pointerEvents: "none",
        borderRadius: "50%",
        background: "rgba(10,14,20,.55)",
        border: `1px solid ${C.line}`,
        backdropFilter: "blur(4px)",
      }}
    >
      <svg viewBox="-50 -50 100 100" width="64" height="64">
        <g
          style={{
            transform: has ? `rotate(${-heading}deg)` : "none",
            transition: "transform 0.12s linear",
          }}
        >
          {/* N needle (red), S needle (grey) */}
          <polygon points="0,-34 7,4 -7,4" fill={C.warn} />
          <polygon points="0,34 7,-4 -7,-4" fill="#4a5663" />
          <circle r="3.5" fill={C.txt} />
        </g>
        <text x="0" y="-37" fill={C.txt} fontSize="13" textAnchor="middle" fontFamily="monospace">
          N
        </text>
      </svg>
      <div
        style={{
          position: "absolute",
          bottom: -16,
          width: "100%",
          textAlign: "center",
          fontSize: 10,
          color: has ? C.txt : C.dim,
        }}
      >
        {has ? `${Math.round(heading)}°` : "no mag"}
      </div>
    </div>
  );
}

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

  const { start, recenter } = useMotion(state, onTelemetry);

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
      <RobotArm state={state} />

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

      {live && <Compass heading={tele?.heading} />}

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
        />
      )}
    </>
  );
}
