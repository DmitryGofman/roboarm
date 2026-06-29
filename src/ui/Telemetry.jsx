const C = {
  panel: "#0f1620",
  line: "#1e2c3a",
  txt: "#c7d4e0",
  dim: "#6b8299",
  accent: "#ff6a13",
  good: "#33ff99",
  warn: "#ff4757",
};

const fmt = (arr) => arr.map((n) => +n.toFixed(2)).join(" ");

const POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const compassPoint = (deg) => POINTS[Math.round((deg % 360) / 45) % 8];

function Row({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: C.dim }}>{label}</span>
      <span style={{ color: color || C.txt }}>{value}</span>
    </div>
  );
}

// quat/acc/vel/pos/ZUPT/IK/joints readout + hold / recenter / view controls.
export default function Telemetry({
  t,
  scale,
  onScale,
  onRecenter,
  paused,
  onHold,
  onResetView,
  stabilize,
  onStabilize,
  invert,
  onInvert,
  mode,
  onMode,
  reach,
  onReach,
}) {
  const aim = mode === "aim";
  const d = t || {
    quat: [0, 0, 0, 1],
    acc: [0, 0, 0],
    vel: [0, 0, 0],
    pos: [0, 0, 0],
    zupt: false,
    reachable: true,
    angles: [0, 0, 0, 0, 0, 0],
    samples: 0,
    hz: 0,
  };

  const btn = (active) => ({
    background: active ? C.accent : "transparent",
    color: active ? "#0a0e14" : C.txt,
    border: `1px solid ${active ? C.accent : C.line}`,
    padding: "6px 12px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 11,
    fontWeight: active ? 700 : 400,
  });

  return (
    <div
      style={{
        // pinned to the visible bottom edge so iOS Safari's toolbar / dynamic
        // viewport can't push it off-screen; scrolls if it ever gets tall.
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 5,
        maxHeight: "62vh",
        overflowY: "auto",
        pointerEvents: "auto",
        borderTop: `1px solid ${C.line}`,
        background: C.panel,
        padding: "10px 14px",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        fontSize: 11,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
          paddingBottom: 6,
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <span style={{ color: C.dim }}>SENSOR FEED</span>
        <span
          style={{
            color: paused ? C.accent : d.samples > 0 ? C.good : C.warn,
          }}
        >
          {paused
            ? `❚❚ HOLD · ${d.hz} Hz`
            : d.samples > 0
            ? `● ${d.hz} Hz · ${d.samples} samples`
            : "○ waiting for motion…"}
        </span>
      </div>
      <div
        style={{
          marginBottom: 10,
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={onMode}
          style={btn(aim)}
          title="AIM: point the phone, slider sets reach. MOVE: integrated position."
        >
          {aim ? "MODE: AIM" : "MODE: MOVE"}
        </button>
        <button onClick={onHold} style={btn(paused)}>
          {paused ? "▶ RESUME" : "❚❚ HOLD"}
        </button>
        {!aim && (
          <button onClick={onRecenter} style={btn(false)}>
            RECENTER
          </button>
        )}
        {!aim && (
          <button
            onClick={onStabilize}
            style={btn(!stabilize)}
            title="Off = no auto-return; you zero manually with RECENTER"
          >
            {stabilize ? "DRIFT-STOP: ON" : "DRIFT-STOP: OFF"}
          </button>
        )}
        {!aim && (
          <button onClick={onInvert} style={btn(invert)}>
            {invert ? "INVERT: ON" : "INVERT: OFF"}
          </button>
        )}
        <button onClick={onResetView} style={btn(false)}>
          RESET VIEW
        </button>
        <label
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            color: C.dim,
            marginLeft: "auto",
          }}
        >
          {aim ? (
            <>
              REACH <span>{reach.toFixed(1)}m</span>
              <input
                type="range"
                min="0.3"
                max="2.6"
                step="0.05"
                value={reach}
                onChange={(e) => onReach(+e.target.value)}
                style={{ accentColor: C.accent }}
              />
            </>
          ) : (
            <>
              SCALE ×<span>{scale}</span>
              <input
                type="range"
                min="1"
                max="15"
                step="1"
                value={scale}
                onChange={(e) => onScale(+e.target.value)}
                style={{ accentColor: C.accent }}
              />
            </>
          )}
        </label>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "4px 18px",
        }}
      >
        <Row label="QUAT" value={fmt(d.quat)} />
        <Row label="ACC m/s²" value={fmt(d.acc)} />
        <Row label="VEL m/s" value={fmt(d.vel)} />
        <Row label="POS m" value={fmt(d.pos)} />
        <Row
          label="ZUPT"
          value={d.zupt ? "ACTIVE (vel=0)" : "—"}
          color={d.zupt ? C.good : C.txt}
        />
        <Row
          label="IK"
          value={d.reachable ? "SOLVED" : "NO SOLUTION"}
          color={d.reachable ? C.good : C.warn}
        />
        <Row
          label="HEADING"
          value={
            d.heading == null ? "no compass" : `${Math.round(d.heading)}° ${compassPoint(d.heading)}`
          }
          color={d.heading == null ? C.dim : C.txt}
        />
      </div>
      <div style={{ marginTop: 6, color: C.dim }}>
        JOINTS°{"  "}
        {d.angles.map((a, i) => `J${i + 1}:${a.toFixed(0)}`).join(" ")}
      </div>
    </div>
  );
}
