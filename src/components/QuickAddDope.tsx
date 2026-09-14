import { useState } from "react";
import {
  createClientId,
  enqueueDope,
} from "../lib/offlineQueue";
import type {
  DopeEntry,
  Location,
  Rifle,
  UnitSystem,
} from "../lib/supabase/types";
import {
  ADD_LOCATION_VALUE,
  ADD_RIFLE_VALUE,
  EntityCreatePanel,
} from "./EntityCreatePanel";

interface QuickAddDopeProps {
  rifle: Rifle;
  rifles: Rifle[];
  locations: Location[];
  lastEntry: DopeEntry | null;
  unitSystem: UnitSystem;
  clickStep: number;
  onClose: () => void;
  onSaved: (entry: DopeEntry) => void;
  onRiflesChange: (rifles: Rifle[]) => void;
  onLocationsChange: (locations: Location[]) => void;
}

const conv = {
  mToYds: 1.09361,
  ydsToM: 0.9144,
};

export function QuickAddDope({
  rifle,
  rifles,
  locations,
  lastEntry,
  unitSystem,
  clickStep,
  onClose,
  onSaved,
  onRiflesChange,
  onLocationsChange,
}: QuickAddDopeProps) {
  const isMetric = unitSystem === "metric";
  const [rifleId, setRifleId] = useState(rifle.id);
  const [locationId, setLocationId] = useState(lastEntry?.location_id ?? "");
  const [createKind, setCreateKind] = useState<"rifle" | "location" | null>(
    null
  );
  const [distanceDisplay, setDistanceDisplay] = useState(() => {
    const m = lastEntry?.distance_m ?? 100;
    return isMetric ? Math.round(m) : Math.round(m * conv.mToYds);
  });
  const [elevation, setElevation] = useState(
    lastEntry?.elevation_correction ?? 0
  );
  const [windage, setWindage] = useState(lastEntry?.windage_correction ?? 0);
  const [showConditions, setShowConditions] = useState(false);
  const [temperature, setTemperature] = useState(
    lastEntry?.temperature_c ?? 15
  );
  const [windSpeed, setWindSpeed] = useState(lastEntry?.wind_speed_ms ?? 0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRifle = rifles.find((r) => r.id === rifleId) ?? rifle;
  const unit = selectedRifle.scope_unit;
  const distLabel = isMetric ? "m" : "yds";
  const distStep = 25;

  const toMeters = (display: number) =>
    isMetric ? display : display * conv.ydsToM;

  const save = async () => {
    setSaving(true);
    setError(null);
    const client_id = createClientId();
    const payload = {
      client_id,
      rifle_id: rifleId,
      location_id: locationId || null,
      distance_m: Number(toMeters(distanceDisplay).toFixed(2)),
      elevation_correction: Number(elevation.toFixed(2)),
      windage_correction: Number(windage.toFixed(2)),
      correction_unit: unit,
      temperature_c: temperature,
      wind_speed_ms: windSpeed,
      altitude_m:
        locations.find((l) => l.id === locationId)?.altitude_m ?? null,
      notes: notes || null,
      shot_at: new Date().toISOString(),
    };

    const optimistic: DopeEntry = {
      id: `pending-${client_id}`,
      user_id: "",
      rifle_id: payload.rifle_id,
      location_id: payload.location_id,
      shot_at: payload.shot_at,
      distance_m: payload.distance_m,
      elevation_correction: payload.elevation_correction,
      windage_correction: payload.windage_correction,
      correction_unit: payload.correction_unit,
      wind_speed_ms: payload.wind_speed_ms,
      wind_angle_deg: null,
      temperature_c: payload.temperature_c,
      altitude_m: payload.altitude_m,
      pressure_hpa: null,
      group_size_mm: null,
      shots: null,
      ammo_lot: null,
      notes: payload.notes,
      client_id,
      created_at: payload.shot_at,
      updated_at: payload.shot_at,
    };

    try {
      if (!navigator.onLine) {
        enqueueDope(payload);
        onSaved(optimistic);
        return;
      }

      const res = await fetch("/api/dope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (!navigator.onLine || res.status >= 500) {
          enqueueDope(payload);
          onSaved(optimistic);
          return;
        }
        setError(data.error || "Failed to save");
        return;
      }
      onSaved(data.entry);
    } catch {
      enqueueDope(payload);
      onSaved(optimistic);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="account-overlay" onClick={onClose}>
      <div
        className="quick-add-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Add DOPE"
      >
        <div className="sheet-handle" />
        <div className="account-panel-header">
          <h2>Log DOPE</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="form-group full">
          <label>Rifle</label>
          <select
            value={rifleId}
            onChange={(e) => {
              const value = e.target.value;
              if (value === ADD_RIFLE_VALUE) {
                setCreateKind("rifle");
                return;
              }
              setRifleId(value);
            }}
          >
            {rifles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
            <option value={ADD_RIFLE_VALUE}>+ Add rifle…</option>
          </select>
        </div>

        <div className="form-group full">
          <label>Location</label>
          <select
            value={locationId}
            onChange={(e) => {
              const value = e.target.value;
              if (value === ADD_LOCATION_VALUE) {
                setCreateKind("location");
                return;
              }
              setLocationId(value);
            }}
          >
            <option value="">None</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
            <option value={ADD_LOCATION_VALUE}>+ Add location…</option>
          </select>
        </div>

        <div className="stepper-block">
          <label>Distance ({distLabel})</label>
          <div className="stepper">
            <button
              type="button"
              onClick={() =>
                setDistanceDisplay((d) => Math.max(distStep, d - distStep))
              }
            >
              −
            </button>
            <input
              type="number"
              value={distanceDisplay}
              onChange={(e) => setDistanceDisplay(Number(e.target.value))}
            />
            <button
              type="button"
              onClick={() => setDistanceDisplay((d) => d + distStep)}
            >
              +
            </button>
          </div>
        </div>

        <div className="stepper-block">
          <label>Elevation ({unit.toUpperCase()}, + up)</label>
          <div className="stepper">
            <button
              type="button"
              onClick={() =>
                setElevation((v) => Number((v - clickStep).toFixed(2)))
              }
            >
              −
            </button>
            <input
              type="number"
              step={clickStep}
              value={elevation}
              onChange={(e) => setElevation(Number(e.target.value))}
            />
            <button
              type="button"
              onClick={() =>
                setElevation((v) => Number((v + clickStep).toFixed(2)))
              }
            >
              +
            </button>
          </div>
        </div>

        <div className="stepper-block">
          <label>Windage ({unit.toUpperCase()}, + right)</label>
          <div className="stepper">
            <button
              type="button"
              onClick={() =>
                setWindage((v) => Number((v - clickStep).toFixed(2)))
              }
            >
              −
            </button>
            <input
              type="number"
              step={clickStep}
              value={windage}
              onChange={(e) => setWindage(Number(e.target.value))}
            />
            <button
              type="button"
              onClick={() =>
                setWindage((v) => Number((v + clickStep).toFixed(2)))
              }
            >
              +
            </button>
          </div>
        </div>

        <button
          type="button"
          className="conditions-toggle"
          onClick={() => setShowConditions((v) => !v)}
        >
          {showConditions ? "Hide conditions" : "Conditions & notes"}
        </button>

        {showConditions && (
          <div className="form-grid">
            <div className="form-group">
              <label>Temp (°C)</label>
              <input
                type="number"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>Wind (m/s)</label>
              <input
                type="number"
                value={windSpeed}
                onChange={(e) => setWindSpeed(Number(e.target.value))}
              />
            </div>
            <div className="form-group full">
              <label>Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}

        <button
          type="button"
          className="auth-submit"
          onClick={save}
          disabled={saving}
        >
          {saving ? "Saving…" : navigator.onLine ? "Save DOPE" : "Queue offline"}
        </button>
      </div>

      {createKind && (
        <EntityCreatePanel
          kind={createKind}
          open
          onClose={() => setCreateKind(null)}
          onCreated={(entity) => {
            if (createKind === "rifle") {
              const created = entity as Rifle;
              onRiflesChange([...rifles, created]);
              setRifleId(created.id);
            } else {
              const created = entity as Location;
              onLocationsChange([...locations, created]);
              setLocationId(created.id);
            }
            setCreateKind(null);
          }}
        />
      )}
    </div>
  );
}
