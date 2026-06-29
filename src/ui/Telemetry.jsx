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

function Row({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: C.dim }}>{label}</span>
      <span style={{ color: color || C.txt }}>{value}</span>
    </div>
  );
}

// quat/acc/vel/pos/ZUPT/IK/joints readout + recenter & scale controls.
export default function Telemetry({ t, scale, onScale, onRecenter }) {
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

  return (
    <div
      style={{
        pointerEvents: "auto",
        borderTop: `1px solid ${C.line}`,
        background: C.panel,
        padding: "10px 14px",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
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
        <span style={{ color: d.samples > 0 ? C.good : C.warn }}>
          {d.samples > 0
            ? `● ${d.hz} Hz · ${d.samples} samples`
            : "○ waiting for motion…"}
        </span>
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
      </div>
      <div style={{ marginTop: 6, color: C.dim }}>
        JOINTS°{"  "}
        {d.angles.map((a, i) => `J${i + 1}:${a.toFixed(0)}`).join(" ")}
      </div>
      <div
        style={{
          marginTop: 10,
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={onRecenter}
          style={{
            background: "transparent",
            color: C.txt,
            border: `1px solid ${C.line}`,
            padding: "6px 12px",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 11,
          }}
        >
          RECENTER (zero drift)
        </button>
        <label
          style={{ display: "flex", gap: 8, alignItems: "center", color: C.dim }}
        >
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
        </label>
      </div>
    </div>
  );
}
