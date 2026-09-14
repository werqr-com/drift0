import { useEffect, useState } from "react";
import type {
  AuthUser,
  Location,
  Profile,
  Rifle,
  UnitSystem,
} from "../lib/supabase/types";

interface AccountPanelProps {
  open: boolean;
  onClose: () => void;
  user: AuthUser;
  unitSystem: UnitSystem;
  onUnitSystemChange: (system: UnitSystem) => void;
  rifles: Rifle[];
  locations: Location[];
  onRiflesChange: (rifles: Rifle[]) => void;
  onLocationsChange: (locations: Location[]) => void;
}

type PanelTab = "profile" | "rifles" | "locations";

const emptyRifle = {
  name: "",
  muzzle_velocity_ms: 823,
  bullet_weight_g: 10.9,
  ballistic_coefficient: 0.462,
  zero_range_m: 91.44,
  sight_height_mm: 38.1,
  click_value: "0.25moa",
  scope_unit: "moa" as const,
  is_default: false,
};

export function AccountPanel({
  open,
  onClose,
  user,
  unitSystem,
  onUnitSystemChange,
  rifles,
  locations,
  onRiflesChange,
  onLocationsChange,
}: AccountPanelProps) {
  const [tab, setTab] = useState<PanelTab>("profile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState(user.display_name ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingRifle, setEditingRifle] = useState<Partial<Rifle> | null>(null);
  const [editingLocation, setEditingLocation] = useState<Partial<Location> | null>(
    null
  );

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await fetch("/api/profile", { credentials: "same-origin" });
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);
          setDisplayName(data.profile?.display_name ?? user.display_name ?? "");
          if (data.profile?.unit_system) {
            onUnitSystemChange(data.profile.unit_system);
          }
        }
      } catch {
        // ignore
      }
    })();
  }, [open]);

  if (!open) return null;

  const saveProfile = async () => {
    setError(null);
    setStatus(null);
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        display_name: displayName,
        unit_system: unitSystem,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to save profile");
      return;
    }
    setProfile(data.profile);
    setStatus("Profile saved");
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    window.location.href = "/";
  };

  const saveRifle = async () => {
    if (!editingRifle?.name?.trim()) {
      setError("Rifle name is required");
      return;
    }
    setError(null);
    const isNew = !editingRifle.id;
    const res = await fetch(
      isNew ? "/api/rifles" : `/api/rifles/${editingRifle.id}`,
      {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(editingRifle),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to save rifle");
      return;
    }
    if (isNew) {
      onRiflesChange([...rifles, data.rifle]);
    } else {
      onRiflesChange(
        rifles.map((r) => (r.id === data.rifle.id ? data.rifle : r))
      );
    }
    setEditingRifle(null);
    setStatus("Rifle saved");
  };

  const deleteRifle = async (id: string) => {
    if (!confirm("Delete this rifle and its DOPE entries?")) return;
    const res = await fetch(`/api/rifles/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (res.ok) {
      onRiflesChange(rifles.filter((r) => r.id !== id));
    }
  };

  const saveLocation = async () => {
    if (!editingLocation?.name?.trim()) {
      setError("Location name is required");
      return;
    }
    setError(null);
    const isNew = !editingLocation.id;
    const res = await fetch(
      isNew ? "/api/locations" : `/api/locations/${editingLocation.id}`,
      {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(editingLocation),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to save location");
      return;
    }
    if (isNew) {
      onLocationsChange([...locations, data.location]);
    } else {
      onLocationsChange(
        locations.map((l) => (l.id === data.location.id ? data.location : l))
      );
    }
    setEditingLocation(null);
    setStatus("Location saved");
  };

  const deleteLocation = async (id: string) => {
    if (!confirm("Delete this location?")) return;
    const res = await fetch(`/api/locations/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (res.ok) {
      onLocationsChange(locations.filter((l) => l.id !== id));
    }
  };

  const renderTab = () => {
    switch (tab) {
      case "profile":
        return (
          <div className="panel-section">
            <div className="form-group full">
              <label>Email</label>
              <input type="text" value={user.email ?? ""} disabled />
            </div>
            <div className="form-group full">
              <label>Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="form-group full">
              <label>Preferred units</label>
              <div className="unit-toggle">
                <button
                  type="button"
                  className={unitSystem === "imperial" ? "active" : ""}
                  onClick={() => onUnitSystemChange("imperial")}
                >
                  Imperial
                </button>
                <button
                  type="button"
                  className={unitSystem === "metric" ? "active" : ""}
                  onClick={() => onUnitSystemChange("metric")}
                >
                  Metric
                </button>
              </div>
            </div>
            <button type="button" className="auth-submit" onClick={saveProfile}>
              Save profile
            </button>
            <button type="button" className="panel-danger" onClick={signOut}>
              Sign out
            </button>
            {profile && (
              <p className="help-text">
                Member since {new Date(profile.created_at).toLocaleDateString()}
              </p>
            )}
          </div>
        );
      case "rifles":
        return (
          <div className="panel-section">
            {editingRifle ? (
              <div className="panel-editor">
                <div className="form-group full">
                  <label>Name</label>
                  <input
                    type="text"
                    value={editingRifle.name ?? ""}
                    onChange={(e) =>
                      setEditingRifle({ ...editingRifle, name: e.target.value })
                    }
                  />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>MV (m/s)</label>
                    <input
                      type="number"
                      value={editingRifle.muzzle_velocity_ms ?? 823}
                      onChange={(e) =>
                        setEditingRifle({
                          ...editingRifle,
                          muzzle_velocity_ms: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Weight (g)</label>
                    <input
                      type="number"
                      value={editingRifle.bullet_weight_g ?? 10.9}
                      step="0.1"
                      onChange={(e) =>
                        setEditingRifle({
                          ...editingRifle,
                          bullet_weight_g: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>BC (G1)</label>
                    <input
                      type="number"
                      value={editingRifle.ballistic_coefficient ?? 0.462}
                      step="0.001"
                      onChange={(e) =>
                        setEditingRifle({
                          ...editingRifle,
                          ballistic_coefficient: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Zero (m)</label>
                    <input
                      type="number"
                      value={editingRifle.zero_range_m ?? 91.44}
                      onChange={(e) =>
                        setEditingRifle({
                          ...editingRifle,
                          zero_range_m: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Sight height (mm)</label>
                    <input
                      type="number"
                      value={editingRifle.sight_height_mm ?? 38.1}
                      onChange={(e) =>
                        setEditingRifle({
                          ...editingRifle,
                          sight_height_mm: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Click value</label>
                    <select
                      value={editingRifle.click_value ?? "0.25moa"}
                      onChange={(e) =>
                        setEditingRifle({
                          ...editingRifle,
                          click_value: e.target.value,
                        })
                      }
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
                    checked={Boolean(editingRifle.is_default)}
                    onChange={(e) =>
                      setEditingRifle({
                        ...editingRifle,
                        is_default: e.target.checked,
                      })
                    }
                  />
                  Default rifle
                </label>
                <div className="panel-actions">
                  <button type="button" className="auth-submit" onClick={saveRifle}>
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingRifle(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="auth-submit"
                  onClick={() => setEditingRifle({ ...emptyRifle })}
                >
                  Add rifle
                </button>
                <ul className="panel-list">
                  {rifles.map((rifle) => (
                    <li key={rifle.id}>
                      <div>
                        <strong>{rifle.name}</strong>
                        {rifle.is_default && (
                          <span className="badge">Default</span>
                        )}
                        <div className="help-text">
                          {Math.round(rifle.muzzle_velocity_ms)} m/s · BC{" "}
                          {rifle.ballistic_coefficient}
                          {rifle.trued_muzzle_velocity_ms
                            ? ` · Trued ${Math.round(rifle.trued_muzzle_velocity_ms)} m/s`
                            : ""}
                        </div>
                      </div>
                      <div className="panel-item-actions">
                        <button
                          type="button"
                          onClick={() => setEditingRifle(rifle)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="danger-text"
                          onClick={() => deleteRifle(rifle.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                  {rifles.length === 0 && (
                    <li className="help-text">No rifles yet</li>
                  )}
                </ul>
              </>
            )}
          </div>
        );
      case "locations":
        return (
          <div className="panel-section">
            {editingLocation ? (
              <div className="panel-editor">
                <div className="form-group full">
                  <label>Name</label>
                  <input
                    type="text"
                    value={editingLocation.name ?? ""}
                    onChange={(e) =>
                      setEditingLocation({
                        ...editingLocation,
                        name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group full">
                  <label>Altitude (m)</label>
                  <input
                    type="number"
                    value={editingLocation.altitude_m ?? 0}
                    onChange={(e) =>
                      setEditingLocation({
                        ...editingLocation,
                        altitude_m: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="form-group full">
                  <label>Notes</label>
                  <input
                    type="text"
                    value={editingLocation.notes ?? ""}
                    onChange={(e) =>
                      setEditingLocation({
                        ...editingLocation,
                        notes: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="panel-actions">
                  <button
                    type="button"
                    className="auth-submit"
                    onClick={saveLocation}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingLocation(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="auth-submit"
                  onClick={() =>
                    setEditingLocation({ name: "", altitude_m: 0, notes: "" })
                  }
                >
                  Add location
                </button>
                <ul className="panel-list">
                  {locations.map((loc) => (
                    <li key={loc.id}>
                      <div>
                        <strong>{loc.name}</strong>
                        <div className="help-text">
                          {Math.round(loc.altitude_m)} m
                          {loc.notes ? ` · ${loc.notes}` : ""}
                        </div>
                      </div>
                      <div className="panel-item-actions">
                        <button
                          type="button"
                          onClick={() => setEditingLocation(loc)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="danger-text"
                          onClick={() => deleteLocation(loc.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                  {locations.length === 0 && (
                    <li className="help-text">No locations yet</li>
                  )}
                </ul>
              </>
            )}
          </div>
        );
      default: {
        const _exhaustive: never = tab;
        return _exhaustive;
      }
    }
  };

  return (
    <div className="account-overlay" onClick={onClose}>
      <aside
        className="account-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Account"
      >
        <div className="account-panel-header">
          <h2>Account</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="panel-tabs">
          {(["profile", "rifles", "locations"] as PanelTab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={tab === t ? "active" : ""}
              onClick={() => {
                setTab(t);
                setError(null);
                setStatus(null);
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        {error && <div className="auth-error">{error}</div>}
        {status && <div className="auth-message">{status}</div>}
        {renderTab()}
      </aside>
    </div>
  );
}
