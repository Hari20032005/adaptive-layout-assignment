import { useState, useEffect, useRef } from "react";
import { adSpec, surfaceProfiles, type SurfaceKey } from "./sample-ad";
import { useLiveLayout } from "./AdCanvas";
import { renderToDom } from "../render/render-dom";
import { renderToCanvas } from "../render/render-canvas";

const DISPLAY_SCALE: Record<SurfaceKey, number> = {
  mobilePortrait: 1,
  mobileLandscape: 1,
  broadcastLowerThird: 0.55,
  retailKiosk: 0.42,
  kioskCompact: 0.45,
};

export default function App() {
  const [surfaceKey, setSurfaceKey] = useState<SurfaceKey>("mobilePortrait");
  const [heightOverride, setHeightOverride] = useState<number | null>(null);
  const [backend, setBackend] = useState<"dom" | "canvas">("dom");
  const [debug, setDebug] = useState(true);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { surface, layout } = useLiveLayout(surfaceKey, heightOverride);
  const scale = DISPLAY_SCALE[surfaceKey];
  const baseHeight = surfaceProfiles[surfaceKey].height;

  useEffect(() => {
    if (backend === "canvas") {
      if (canvasRef.current) renderToCanvas(adSpec, layout, surface, canvasRef.current, { debug });
      if (hostRef.current) hostRef.current.replaceChildren();
      return;
    }
    if (hostRef.current) {
      renderToDom(adSpec, layout, surface, hostRef.current, { debug, displayScale: scale });
    }
  }, [layout, surface, debug, scale, backend]);

  const cta = layout.elements.find((e) => e.id === "cta");

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Adaptive Layout Engine — multi-surface ad demo</h1>
        <p style={{ color: "#555", margin: "4px 0 0", fontSize: 14 }}>
          One ad spec + one surface profile → constraint resolver → resolved layout. No per-surface code paths.
        </p>
      </header>

      <nav style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        {(Object.keys(surfaceProfiles) as SurfaceKey[]).map((key) => (
          <button
            key={key}
            onClick={() => {
              setSurfaceKey(key);
              setHeightOverride(null);
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: key === surfaceKey ? "2px solid #1971c2" : "1px solid #ccc",
              background: key === surfaceKey ? "#e7f1ff" : "#fff",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {surfaceProfiles[key].label}
          </button>
        ))}
        <span style={{ marginLeft: 8, fontSize: 12, color: "#555" }}>backend:</span>
        {(["dom", "canvas"] as const).map((b) => (
          <button
            key={b}
            onClick={() => setBackend(b)}
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid #999",
              background: backend === b ? "#12b886" : "#f1f3f5",
              color: backend === b ? "#fff" : "#333",
              cursor: "pointer",
            }}
          >
            {b.toUpperCase()}
          </button>
        ))}
      </nav>

      <main style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <section style={{ flex: "0 0 auto" }}>
          {backend === "canvas" ? (
            <canvas
              ref={canvasRef}
              style={{ width: surface.width * scale, height: surface.height * scale, border: "1px solid #bbb" }}
            />
          ) : (
            <div ref={hostRef} style={{ border: "1px solid #bbb", position: "relative" }} />
          )}
          <div style={{ marginTop: 8, fontSize: 13, color: "#666" }}>
            surface: {surface.width}×{surface.height}px
            {scale !== 1 && <> · displayed at {(scale * 100).toFixed(0)}%</>}
          </div>
        </section>

        <section style={{ flex: "1 1 280px", minWidth: 260 }}>
          <h2 style={{ fontSize: 14, margin: "0 0 6px" }}>Resolution diagnostics</h2>
          <ul style={{ fontSize: 13, paddingLeft: 18, margin: 0, lineHeight: 1.7 }}>
            <li>
              CTA (priority 2):{" "}
              <strong style={{ color: cta?.status === "dropped" ? "#e03131" : "#2f9e44" }}>{cta?.status ?? "missing"}</strong>
            </li>
            <li>dropped: {layout.diagnostics.dropped.length ? layout.diagnostics.dropped.join(", ") : "none"}</li>
            <li>scaled: {layout.diagnostics.scaled.length ? layout.diagnostics.scaled.join(", ") : "none"}</li>
            <li>truncated: {layout.diagnostics.truncated.length ? layout.diagnostics.truncated.join(", ") : "none"}</li>
            <li>hard constraints: {layout.diagnostics.passes ? "satisfied ✓" : "unresolved ✗"}</li>
          </ul>

          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 13 }}>
              Surface height: {surface.height}px
              <input
                type="range"
                min={Math.min(200, baseHeight)}
                max={baseHeight}
                value={heightOverride ?? baseHeight}
                onChange={(e) => setHeightOverride(Number(e.target.value))}
                style={{ display: "block", width: "100%" }}
              />
            </label>
            <button onClick={() => setHeightOverride(null)} style={{ fontSize: 12, padding: "4px 8px", cursor: "pointer" }}>
              reset height
            </button>
            <p style={{ fontSize: 12, color: "#888", margin: "4px 0 0" }}>
              Drag to shrink — the lowest-priority element (branding, then promo) degrades through scale → truncate → drop,
              while the CTA stays intact. Never overlaps.
            </p>
          </div>

          <label style={{ display: "block", marginTop: 12, fontSize: 13 }}>
            <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} /> show debug markers
          </label>
        </section>
      </main>

      <footer style={{ marginTop: 24, fontSize: 12, color: "#888" }}>
        Same ad spec resolved live: {layout.elements.filter((e) => e.status !== "dropped").length}/{layout.elements.length} elements
        placed · real canvas text metrics
      </footer>
    </div>
  );
}
