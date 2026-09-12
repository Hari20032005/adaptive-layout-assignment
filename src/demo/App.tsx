import { useState, useEffect, useRef } from "react";
import { adSpec, surfaceProfiles, type SurfaceKey } from "./sample-ad";
import { useLiveLayout } from "./AdCanvas";
import { renderToDom } from "../render/render-dom";
import { renderToCanvas } from "../render/render-canvas";
import { selectAxis } from "../engine/band";
import { workingArea } from "../engine/geometry";
import "./demo.css";

const DISPLAY_SCALE: Record<SurfaceKey, number> = {
  mobilePortrait: 1,
  mobileLandscape: 1,
  broadcastLowerThird: 0.55,
  retailKiosk: 0.42,
  kioskCompact: 0.45,
};

const REPO_URL = "https://github.com/Hari20032005/adaptive-layout-assignment";

function deviceClass(surfaceKey: SurfaceKey): string {
  if (surfaceKey.startsWith("mobile")) return "device device--phone";
  if (surfaceKey.startsWith("kiosk")) return "device device--kiosk";
  return "device device--bar";
}

function Chip({ tone, children }: { tone: "ok" | "warn" | "danger" | "neutral"; children: React.ReactNode }) {
  return <span className={`chip chip--${tone}`}>{children}</span>;
}

export default function App() {
  const [surfaceKey, setSurfaceKey] = useState<SurfaceKey>("mobilePortrait");
  const [heightOverride, setHeightOverride] = useState<number | null>(null);
  const [backend, setBackend] = useState<"dom" | "canvas">("dom");
  const [debug, setDebug] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { surface, layout } = useLiveLayout(surfaceKey, heightOverride);
  const scale = DISPLAY_SCALE[surfaceKey];
  const baseHeight = surfaceProfiles[surfaceKey].height;
  const minHeight = Math.min(240, baseHeight);
  const height = heightOverride ?? baseHeight;
  const sliderFill = `${((height - minHeight) / Math.max(1, baseHeight - minHeight)) * 100}%`;

  const area = workingArea(surface, surface.safeArea);
  const axis = selectAxis(area);

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
  const placedCount = layout.elements.filter((e) => e.status !== "dropped").length;
  const sortedSurfaces = Object.keys(surfaceProfiles) as SurfaceKey[];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand__mark" aria-hidden="true">FL</div>
          <div>
            <h1 className="brand__title">Adaptive Layout Engine</h1>
            <p className="brand__sub">
              One ad spec, resolved across every surface by a priority-ordered constraint algorithm.
            </p>
          </div>
        </div>
        <div className="topbar__links">
          <a className="link-pill" href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <span className="link-pill" aria-hidden="true">
            {adSpec.elements.length} elements · {sortedSurfaces.length} surfaces
          </span>
        </div>
      </header>

      <div className="workspace">
        <section className="stage-card" aria-label="Resolved ad preview">
          <div className="stage-card__head">
            <span className="stage-card__title">{surface.label}</span>
            <span className="stage-card__meta">
              {surface.width} × {surface.height} · {axis === "row" ? "stacked" : "side-by-side"}
            </span>
          </div>
          <div className="stage">
            <div>
              <div className={deviceClass(surfaceKey)}>
                <div
                  className="device__screen"
                  style={{ width: surface.width * scale, height: surface.height * scale }}
                >
                  {backend === "canvas" ? (
                    <canvas
                      ref={canvasRef}
                      style={{ display: "block", width: surface.width * scale, height: surface.height * scale }}
                    />
                  ) : (
                    <div ref={hostRef} style={{ position: "relative", width: "100%", height: "100%" }} />
                  )}
                </div>
              </div>
              <div className="device__caption">
                working area <code>{Math.round(area.width)}×{Math.round(area.height)}</code>
                {scale !== 1 && <> · shown at {(scale * 100).toFixed(0)}%</>}
              </div>
            </div>
          </div>
        </section>

        <aside className="rail">
          <div className="rail-card">
            <h2 className="rail-card__title">Surface profile</h2>
            <div className="surface-list" role="group" aria-label="Surface profile">
              {sortedSurfaces.map((key) => {
                const profile = surfaceProfiles[key];
                return (
                  <button
                    key={key}
                    className="surface-option"
                    aria-pressed={key === surfaceKey}
                    onClick={() => {
                      setSurfaceKey(key);
                      setHeightOverride(null);
                    }}
                  >
                    <span className="surface-option__label">{profile.label}</span>
                    <span className="surface-option__dims">
                      {profile.width}×{profile.height}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rail-card">
            <h2 className="rail-card__title">Renderer</h2>
            <div className="segmented" role="group" aria-label="Renderer backend">
              {(["dom", "canvas"] as const).map((b) => (
                <button key={b} aria-pressed={backend === b} onClick={() => setBackend(b)}>
                  {b.toUpperCase()}
                </button>
              ))}
            </div>
            <p className="hint">Both backends consume the exact same resolved layout.</p>
          </div>

          <div className="rail-card">
            <h2 className="rail-card__title">Resolution diagnostics</h2>
            <div className="diag">
              <div className="diag__row">
                <span className="diag__key">CTA (priority 2)</span>
                <Chip tone={cta?.status === "dropped" ? "danger" : "ok"}>{cta?.status ?? "missing"}</Chip>
              </div>
              <div className="diag__row">
                <span className="diag__key">Hard constraints</span>
                <Chip tone={layout.diagnostics.passes ? "ok" : "danger"}>
                  {layout.diagnostics.passes ? "satisfied" : "unresolved"}
                </Chip>
              </div>
              <div className="diag__row">
                <span className="diag__key">Placed</span>
                <Chip tone="neutral">
                  <code>
                    {placedCount}/{layout.elements.length}
                  </code>
                </Chip>
              </div>
              <div className="diag__row">
                <span className="diag__key">Dropped</span>
                <Chip tone={layout.diagnostics.dropped.length ? "warn" : "neutral"}>
                  {layout.diagnostics.dropped.length ? layout.diagnostics.dropped.join(", ") : "none"}
                </Chip>
              </div>
              <div className="diag__row">
                <span className="diag__key">Scaled · truncated</span>
                <Chip tone="neutral">
                  <code>
                    {layout.diagnostics.scaled.length} · {layout.diagnostics.truncated.length}
                  </code>
                </Chip>
              </div>
            </div>
          </div>

          <div className="rail-card">
            <h2 className="rail-card__title">Priority degradation</h2>
            <div className="slider-head">
              <label className="slider-label" htmlFor="height">
                Surface height
              </label>
              <span className="slider-value">{height}px</span>
            </div>
            <input
              id="height"
              type="range"
              min={minHeight}
              max={baseHeight}
              value={height}
              style={{ ["--fill" as string]: sliderFill }}
              onChange={(e) => setHeightOverride(Number(e.target.value))}
            />
            <div className="btn-row">
              <button className="btn" onClick={() => setHeightOverride(null)}>
                Reset height
              </button>
            </div>
            <p className="hint">
              Shrink the surface: the lowest-priority element degrades first — scale, then truncate, then drop —
              while the CTA stays intact and nothing ever overlaps.
            </p>
          </div>

          <div className="rail-card">
            <label className="switch">
              <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} />
              Show debug markers
            </label>
          </div>
        </aside>
      </div>

      <footer className="footer">
        <span>
          Same spec resolved live: <code>{placedCount}/{layout.elements.length}</code> elements placed
        </span>
        <span>Real canvas text metrics · DOM &amp; Canvas renderers share one resolver</span>
      </footer>
    </div>
  );
}
