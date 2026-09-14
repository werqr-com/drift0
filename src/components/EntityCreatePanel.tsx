import { useState } from "react";
import type { Location, Rifle, ScopeUnit } from "../lib/supabase/types";

const ADD_RIFLE_VALUE = "__add_rifle__";
const ADD_LOCATION_VALUE = "__add_location__";

export { ADD_RIFLE_VALUE, ADD_LOCATION_VALUE };

const emptyRifle = {
  name: "",
  muzzle_velocity_ms: 823,
  bullet_weight_g: 10.9,
  ballistic_coefficient: 0.462,
  zero_range_m: 91.44,
  sight_height_mm: 38.1,
  click_value: "0.25moa",
  scope_unit: "moa" as ScopeUnit,
  is_default: false,
};

type EntityKind = "rifle" | "location";

interface EntityCreatePanelProps {
  kind: EntityKind;
  open: boolean;
  onClose: () => void;
  onCreated: (entity: Rifle | Location) => void;
}

export function EntityCreatePanel({
  kind,
  open,
  onClose,
  onCreated,
}: EntityCreatePanelProps) {
  const [rifle, setRifle] = useState({ ...emptyRifle });
  const [location, setLocation] = useState({
    name: "",
    altitude_m: 0,
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const title = kind === "rifle" ? "Add rifle" : "Add location";

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      if (kind === "rifle") {
        if (!rifle.name.trim()) {
          setError("Rifle name is required");
          return;
        }
        const res = await fetch("/api/rifles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(rifle),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to save rifle");
          return;
        }
        onCreated(data.rifle as Rifle);
        setRifle({ ...emptyRifle });
        onClose();
        return;
      }

      if (!location.name.trim()) {
        setError("Location name is required");
        return;
      }
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(location),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save location");
        return;
      }
      onCreated(data.location as Location);
      setLocation({ name: "", altitude_m: 0, notes: "" });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  };

  const renderForm = () => {
    switch (kind) {
      case "rifle":
        return (
          <div className="panel-section">
            <div className="form-group full">
              <label>Name</label>
              <input
                type="text"
                value={rifle.name}
                autoFocus
                placeholder="e.g. Rem 700 6.5 CM"
                onChange={(e) => setRifle({ ...rifle, name: e.target.value })}
              />
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>MV (m/s)</label>
                <input
                  type="number"
                  value={rifle.muzzle_velocity_ms}
                  onChange={(e) =>
                    setRifle({
                      ...rifle,
                      muzzle_velocity_ms: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="form-group">
                <label>Weight (g)</label>
                <input
                  type="number"
                  step="0.1"
                  value={rifle.bullet_weight_g}
                  onChange={(e) =>
                    setRifle({
                      ...rifle,
                      bullet_weight_g: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="form-group">
                <label>BC (G1)</label>
                <input
                  type="number"
                  step="0.001"
                  value={rifle.ballistic_coefficient}
                  onChange={(e) =>
                    setRifle({
                      ...rifle,
                      ballistic_coefficient: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="form-group">
                <label>Zero (m)</label>
                <input
                  type="number"
                  value={rifle.zero_range_m}
                  onChange={(e) =>
                    setRifle({
                      ...rifle,
                      zero_range_m: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="form-group">
                <label>Sight height (mm)</label>
                <input
                  type="number"
                  value={rifle.sight_height_mm}
                  onChange={(e) =>
                    setRifle({
                      ...rifle,
                      sight_height_mm: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="form-group">
                <label>Click value</label>
                <select
                  value={rifle.click_value}
                  onChange={(e) => {
                    const click_value = e.target.value;
                    const scope_unit: ScopeUnit = click_value.includes("mil")
                      ? "mil"
                      : "moa";
                    setRifle({ ...rifle, click_value, scope_unit });
                  }}
                >
                  <option value="0.25moa">1/4 MOA</option>
                  <option value="0.5moa">1/2 MOA</option>
                  <option value="1moa">1 MOA</option>
                  <option value="0.1mil">0.1 MIL</option>
                  <option value="0.2mil">0.2 MIL</option>
                </select>
              </div>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={rifle.is_default}
                onChange={(e) =>
                  setRifle({ ...rifle, is_default: e.target.checked })
                }
              />
              Default rifle
            </label>
          </div>
        );
      case "location":
        return (
          <div className="panel-section">
            <div className="form-group full">
              <label>Name</label>
              <input
                type="text"
                value={location.name}
                autoFocus
                placeholder="e.g. Local range"
                onChange={(e) =>
                  setLocation({ ...location, name: e.target.value })
                }
              />
            </div>
            <div className="form-group full">
              <label>Altitude (m)</label>
              <input
                type="number"
                value={location.altitude_m}
                onChange={(e) =>
                  setLocation({
                    ...location,
                    altitude_m: Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="form-group full">
              <label>Notes</label>
              <input
                type="text"
                value={location.notes}
                onChange={(e) =>
                  setLocation({ ...location, notes: e.target.value })
                }
              />
            </div>
          </div>
        );
      default: {
        const _exhaustive: never = kind;
        return _exhaustive;
      }
    }
  };

  return (
    <div
      className="account-overlay"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <aside
        className="account-panel entity-create-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="account-panel-header">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="help-text entity-create-hint">
          {kind === "rifle"
            ? "Saved to your account and available in filters and DOPE logging."
            : "Tag DOPE entries with this range or shooting location."}
        </p>
        {error && <div className="auth-error">{error}</div>}
        {renderForm()}
        <div className="panel-actions">
          <button
            type="button"
            className="auth-submit"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving…" : title}
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </aside>
    </div>
  );
}
