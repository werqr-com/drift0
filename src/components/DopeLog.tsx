import { useEffect, useMemo, useState } from "react";
import { aggregateDopeCard } from "../lib/dopeAggregate";
import { parseClickValue } from "../lib/clickValue";
import type {
  AuthUser,
  DopeEntry,
  Location,
  Rifle,
  ScopeUnit,
  UnitSystem,
} from "../lib/supabase/types";
import { QuickAddDope } from "./QuickAddDope";

interface DopeLogProps {
  user: AuthUser | null;
  unitSystem: UnitSystem;
  rifles: Rifle[];
  locations: Location[];
  entries: DopeEntry[];
  pendingCount: number;
  onEntriesChange: (entries: DopeEntry[]) => void;
  onRefresh: () => void;
}

type DopeMode = "card" | "entries" | "chart";

const conv = {
  mToYds: 1.09361,
  ydsToM: 0.9144,
  mmToIn: 0.03937,
};

export function DopeLog({
  user,
  unitSystem,
  rifles,
  locations,
  entries,
  pendingCount,
  onEntriesChange,
  onRefresh,
}: DopeLogProps) {
  const [mode, setMode] = useState<DopeMode>("card");
  const [rifleId, setRifleId] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");
  const [unit, setUnit] = useState<ScopeUnit>("moa");
  const [editing, setEditing] = useState<DopeEntry | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [predicted, setPredicted] = useState<{ distance: number; value: number }[]>(
    []
  );

  useEffect(() => {
    if (!rifleId && rifles.length > 0) {
      const def = rifles.find((r) => r.is_default) ?? rifles[0];
      setRifleId(def.id);
      setUnit(def.scope_unit);
    }
  }, [rifles, rifleId]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (rifleId && e.rifle_id !== rifleId) return false;
      if (locationId && e.location_id !== locationId) return false;
      return true;
    });
  }, [entries, rifleId, locationId]);

  const selectedRifle = rifles.find((r) => r.id === rifleId) ?? null;
  const cardRows = useMemo(
    () => aggregateDopeCard(filtered, unit),
    [filtered, unit]
  );

  useEffect(() => {
    if (mode !== "chart" || !selectedRifle) {
      setPredicted([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const mv =
        selectedRifle.trued_muzzle_velocity_ms ??
        selectedRifle.muzzle_velocity_ms;
      const maxDist = Math.max(
        300,
        ...filtered.map((e) => e.distance_m),
        selectedRifle.zero_range_m
      );
      try {
        const res = await fetch("/api/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            muzzleVelocity: mv,
            bulletWeight: selectedRifle.bullet_weight_g,
            ballisticCoefficient: selectedRifle.ballistic_coefficient,
            zeroRange: selectedRifle.zero_range_m,
            targetDistance: maxDist,
            windSpeed: 0,
            windAngle: 90,
            sightHeight: selectedRifle.sight_height_mm,
            temperature: 15,
            altitude: 0,
          }),
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setPredicted(
          (data as { distance: number; moa: number; mil: number }[]).map(
            (r) => ({
              distance: r.distance,
              value: unit === "moa" ? r.moa : r.mil,
            })
          )
        );
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, selectedRifle, filtered, unit]);

  if (!user) {
    return (
      <div className="card dope-signin">
        <h2 className="card-title">DOPE Logbook</h2>
        <p>
          Sign in to record and sync DOPE across devices, filter by location, and
          true your rifle to real data.
        </p>
        <div className="panel-actions">
          <a className="auth-submit" href="/login">
            Sign in
          </a>
          <a className="secondary-link" href="/register">
            Create account
          </a>
        </div>
      </div>
    );
  }

  const isMetric = unitSystem === "metric";
  const displayDist = (m: number) =>
    isMetric ? Math.round(m) : Math.round(m * conv.mToYds);
  const distLabel = isMetric ? "m" : "yds";

  const locationName = (id: string | null) =>
    id ? locations.find((l) => l.id === id)?.name ?? "—" : "—";

  const deleteEntry = async (id: string) => {
    if (!confirm("Delete this DOPE entry?")) return;
    const res = await fetch(`/api/dope/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (res.ok) {
      onEntriesChange(entries.filter((e) => e.id !== id));
      setEditing(null);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const res = await fetch(`/api/dope/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(editing),
    });
    const data = await res.json();
    if (res.ok) {
      onEntriesChange(
        entries.map((e) => (e.id === data.entry.id ? data.entry : e))
      );
      setEditing(null);
    } else {
      alert(data.error || "Failed to save");
    }
  };

  const renderMode = () => {
    switch (mode) {
      case "card":
        return (
          <div className="dope-card-table-wrap">
            <table className="dope-card-table">
              <thead>
                <tr>
                  <th>Distance</th>
                  <th>Elev (latest)</th>
                  <th>Elev (avg)</th>
                  <th>Wind (avg)</th>
                  <th>n</th>
                </tr>
              </thead>
              <tbody>
                {cardRows.map((row) => (
                  <tr key={row.distance_m}>
                    <td>
                      {displayDist(row.distance_m)} {distLabel}
                    </td>
                    <td>
                      {row.latest_elevation > 0 ? "+" : ""}
                      {row.latest_elevation.toFixed(2)} {unit.toUpperCase()}
                    </td>
                    <td>
                      {row.avg_elevation > 0 ? "+" : ""}
                      {row.avg_elevation.toFixed(2)}
                    </td>
                    <td>
                      {row.avg_windage > 0 ? "+" : ""}
                      {row.avg_windage.toFixed(2)}
                    </td>
                    <td>{row.count}</td>
                  </tr>
                ))}
                {cardRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="help-text">
                      No DOPE at this filter yet. Tap + to add a record.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      case "entries":
        return (
          <ul className="dope-entry-list">
            {filtered.map((entry) => (
              <li key={entry.id} className="dope-entry">
                <button
                  type="button"
                  className="dope-entry-main"
                  onClick={() => setEditing(entry)}
                >
                  <div className="dope-entry-top">
                    <strong>
                      {displayDist(entry.distance_m)} {distLabel}
                    </strong>
                    <span>
                      Elev {entry.elevation_correction > 0 ? "+" : ""}
                      {entry.elevation_correction.toFixed(2)}{" "}
                      {entry.correction_unit.toUpperCase()}
                      {" · "}
                      Wind {entry.windage_correction > 0 ? "+" : ""}
                      {entry.windage_correction.toFixed(2)}
                    </span>
                  </div>
                  <div className="dope-entry-meta">
                    <span className="badge">{locationName(entry.location_id)}</span>
                    <span>
                      {new Date(entry.shot_at).toLocaleString()}
                    </span>
                    {entry.notes && <span>{entry.notes}</span>}
                  </div>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="help-text">No entries match these filters.</li>
            )}
          </ul>
        );
      case "chart": {
        const points = filtered.filter((e) => e.correction_unit === unit);
        const maxD = Math.max(
          100,
          ...points.map((p) => p.distance_m),
          ...predicted.map((p) => p.distance)
        );
        const maxV = Math.max(
          1,
          ...points.map((p) => Math.abs(p.elevation_correction)),
          ...predicted.map((p) => Math.abs(p.value))
        );
        const w = 560;
        const h = 240;
        const pad = 32;
        const x = (d: number) => pad + (d / maxD) * (w - pad * 2);
        const y = (v: number) => h / 2 - (v / maxV) * ((h - pad * 2) / 2);
        const predPath = predicted
          .map(
            (p, i) =>
              `${i === 0 ? "M" : "L"} ${x(p.distance).toFixed(1)} ${y(p.value).toFixed(1)}`
          )
          .join(" ");

        return (
          <div className="dope-chart">
            <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="DOPE chart">
              <line
                x1={pad}
                y1={h / 2}
                x2={w - pad}
                y2={h / 2}
                stroke="var(--card-border)"
              />
              <line
                x1={pad}
                y1={pad}
                x2={pad}
                y2={h - pad}
                stroke="var(--card-border)"
              />
              {predPath && (
                <path
                  d={predPath}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  opacity="0.7"
                />
              )}
              {points.map((p) => (
                <circle
                  key={p.id}
                  cx={x(p.distance_m)}
                  cy={y(p.elevation_correction)}
                  r="4"
                  fill="var(--success)"
                />
              ))}
            </svg>
            <div className="dope-chart-legend">
              <span>
                <i className="legend-line" /> Predicted
              </span>
              <span>
                <i className="legend-dot" /> Recorded DOPE
              </span>
            </div>
          </div>
        );
      }
      default: {
        const _exhaustive: never = mode;
        return _exhaustive;
      }
    }
  };

  return (
    <div className="dope-log">
      <div className="dope-toolbar">
        <div className="dope-filters">
          <select
            value={rifleId}
            onChange={(e) => {
              setRifleId(e.target.value);
              const r = rifles.find((x) => x.id === e.target.value);
              if (r) setUnit(r.scope_unit);
            }}
          >
            {rifles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
            {rifles.length === 0 && <option value="">No rifles</option>}
          </select>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <div className="unit-toggle">
            <button
              type="button"
              className={unit === "moa" ? "active" : ""}
              onClick={() => setUnit("moa")}
            >
              MOA
            </button>
            <button
              type="button"
              className={unit === "mil" ? "active" : ""}
              onClick={() => setUnit("mil")}
            >
              MIL
            </button>
          </div>
        </div>
        <div className="display-mode-toggle">
          {(["card", "entries", "chart"] as DopeMode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={mode === m ? "active" : ""}
              onClick={() => setMode(m)}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="pending-badge">
          {pendingCount} pending offline — will sync when online
        </div>
      )}

      <div className="card">{renderMode()}</div>

      <button
        type="button"
        className="dope-fab"
        onClick={() => setQuickOpen(true)}
        aria-label="Add DOPE"
        disabled={!selectedRifle}
      >
        +
      </button>

      {quickOpen && selectedRifle && (
        <QuickAddDope
          rifle={selectedRifle}
          rifles={rifles}
          locations={locations}
          lastEntry={filtered[0] ?? null}
          unitSystem={unitSystem}
          onClose={() => setQuickOpen(false)}
          onSaved={(entry) => {
            onEntriesChange([entry, ...entries.filter((e) => e.id !== entry.id)]);
            onRefresh();
            setQuickOpen(false);
          }}
          clickStep={parseClickValue(selectedRifle.click_value)}
        />
      )}

      {editing && (
        <div className="account-overlay" onClick={() => setEditing(null)}>
          <div
            className="edit-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="account-panel-header">
              <h2>Edit DOPE</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setEditing(null)}
              >
                ×
              </button>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Distance (m)</label>
                <input
                  type="number"
                  value={editing.distance_m}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      distance_m: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="form-group">
                <label>Elevation</label>
                <input
                  type="number"
                  step="0.1"
                  value={editing.elevation_correction}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      elevation_correction: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="form-group">
                <label>Windage</label>
                <input
                  type="number"
                  step="0.1"
                  value={editing.windage_correction}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      windage_correction: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="form-group">
                <label>Location</label>
                <select
                  value={editing.location_id ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      location_id: e.target.value || null,
                    })
                  }
                >
                  <option value="">None</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group full">
                <label>Notes</label>
                <input
                  type="text"
                  value={editing.notes ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, notes: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="panel-actions">
              <button type="button" className="auth-submit" onClick={saveEdit}>
                Save
              </button>
              <button
                type="button"
                className="panel-danger"
                onClick={() => deleteEntry(editing.id)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
