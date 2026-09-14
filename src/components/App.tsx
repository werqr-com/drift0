import { useState, useEffect, useCallback } from "react";
import { Calculator } from "./Calculator";
import { ScopeAdjustment } from "./ScopeAdjustment";
import { AccountPanel } from "./AccountPanel";
import { DopeLog } from "./DopeLog";
import {
  flushOfflineQueue,
  getOfflineQueue,
} from "../lib/offlineQueue";
import type {
  AuthUser,
  DopeEntry,
  Location,
  Rifle,
  UnitSystem,
} from "../lib/supabase/types";

export interface ScopeAdjustmentData {
  offsetX: number; // horizontal offset in mm
  offsetY: number; // vertical offset in mm (negative = drop)
  distance: number; // distance in meters
}

const APP_STORAGE_KEY = "drift-app-preferences";

function loadAppPreferences() {
  try {
    const saved = localStorage.getItem(APP_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);

      if (typeof parsed !== "object" || parsed === null) {
        return null;
      }

      if (
        parsed.currentView &&
        !["calculator", "adjustment", "dope"].includes(parsed.currentView)
      ) {
        parsed.currentView = "calculator";
      }

      if (
        parsed.unitSystem &&
        !["imperial", "metric"].includes(parsed.unitSystem)
      ) {
        parsed.unitSystem = "imperial";
      }

      return parsed;
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
}

type AppView = "calculator" | "adjustment" | "dope";

interface AppProps {
  user: AuthUser | null;
}

export function App({ user }: AppProps) {
  const saved = loadAppPreferences();
  const [currentView, setCurrentView] = useState<AppView>(
    saved?.currentView ?? "calculator"
  );
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(
    saved?.unitSystem ?? "imperial"
  );
  const [scopeAdjustmentData, setScopeAdjustmentData] =
    useState<ScopeAdjustmentData | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [rifles, setRifles] = useState<Rifle[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [entries, setEntries] = useState<DopeEntry[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedRifleId, setSelectedRifleId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify({
        currentView,
        unitSystem,
      })
    );
  }, [currentView, unitSystem]);

  const refreshData = useCallback(async () => {
    if (!user) {
      setRifles([]);
      setLocations([]);
      setEntries([]);
      return;
    }
    try {
      const [rRes, lRes, dRes] = await Promise.all([
        fetch("/api/rifles", { credentials: "same-origin" }),
        fetch("/api/locations", { credentials: "same-origin" }),
        fetch("/api/dope", { credentials: "same-origin" }),
      ]);
      if (rRes.ok) {
        const data = await rRes.json();
        setRifles(data.rifles ?? []);
        if (!selectedRifleId && data.rifles?.length) {
          const def =
            data.rifles.find((r: Rifle) => r.is_default) ?? data.rifles[0];
          setSelectedRifleId(def.id);
        }
      }
      if (lRes.ok) {
        const data = await lRes.json();
        setLocations(data.locations ?? []);
      }
      if (dRes.ok) {
        const data = await dRes.json();
        setEntries(data.entries ?? []);
      }
    } catch {
      // ignore network errors
    }
  }, [user, selectedRifleId]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    const sync = async () => {
      const result = await flushOfflineQueue();
      setPendingCount(getOfflineQueue().length);
      if (result.synced > 0) {
        refreshData();
      }
    };
    setPendingCount(getOfflineQueue().length);
    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [refreshData]);

  const handleScopeAdjustment = (data: ScopeAdjustmentData) => {
    setScopeAdjustmentData(data);
    setCurrentView("adjustment");
  };

  const renderView = () => {
    switch (currentView) {
      case "calculator":
        return (
          <Calculator
            unitSystem={unitSystem}
            onUnitSystemChange={setUnitSystem}
            onScopeAdjustment={handleScopeAdjustment}
            user={user}
            rifles={rifles}
            entries={entries}
            selectedRifleId={selectedRifleId}
            onSelectedRifleIdChange={setSelectedRifleId}
            onRifleUpdated={(rifle) => {
              setRifles((prev) =>
                prev.map((r) => (r.id === rifle.id ? rifle : r))
              );
            }}
          />
        );
      case "adjustment":
        return (
          <ScopeAdjustment
            unitSystem={unitSystem}
            onUnitSystemChange={setUnitSystem}
            initialData={scopeAdjustmentData}
            onDataConsumed={() => setScopeAdjustmentData(null)}
            user={user}
            rifles={rifles}
            locations={locations}
            selectedRifleId={selectedRifleId}
            onSelectedRifleIdChange={setSelectedRifleId}
            onDopeSaved={(entry) => {
              setEntries((prev) => [entry, ...prev]);
            }}
          />
        );
      case "dope":
        return (
          <DopeLog
            user={user}
            unitSystem={unitSystem}
            rifles={rifles}
            locations={locations}
            entries={entries}
            pendingCount={pendingCount}
            onEntriesChange={setEntries}
            onRefresh={refreshData}
          />
        );
      default: {
        const _exhaustive: never = currentView;
        return _exhaustive;
      }
    }
  };

  const initials =
    user?.display_name?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    null;

  return (
    <div className="container">
      <div className="experimental-banner">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span>
          <strong>Experimental</strong> — This app is still a work in progress.
          Results may not be accurate.
        </span>
      </div>
      <header>
        <div className="logo">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
          <h1>Drift0</h1>
        </div>
        <nav className="nav-tabs">
          <button
            className={`nav-tab ${currentView === "calculator" ? "active" : ""}`}
            onClick={() => setCurrentView("calculator")}
          >
            Calculator
          </button>
          <button
            className={`nav-tab ${currentView === "adjustment" ? "active" : ""}`}
            onClick={() => setCurrentView("adjustment")}
          >
            Scope Adjustment
          </button>
          <button
            className={`nav-tab ${currentView === "dope" ? "active" : ""}`}
            onClick={() => setCurrentView("dope")}
          >
            DOPE
            {pendingCount > 0 && (
              <span className="nav-pending">{pendingCount}</span>
            )}
          </button>
        </nav>
        <div className="header-actions">
          <div className="system-toggle">
            <button
              className={unitSystem === "imperial" ? "active" : ""}
              onClick={() => setUnitSystem("imperial")}
            >
              Imperial
            </button>
            <button
              className={unitSystem === "metric" ? "active" : ""}
              onClick={() => setUnitSystem("metric")}
            >
              Metric
            </button>
          </div>
          {user ? (
            <button
              type="button"
              className="account-btn"
              onClick={() => setAccountOpen(true)}
              aria-label="Account"
            >
              {initials}
            </button>
          ) : (
            <a className="account-signin" href="/login">
              Sign in
            </a>
          )}
        </div>
      </header>

      {renderView()}

      {user && (
        <AccountPanel
          open={accountOpen}
          onClose={() => setAccountOpen(false)}
          user={user}
          unitSystem={unitSystem}
          onUnitSystemChange={setUnitSystem}
          rifles={rifles}
          locations={locations}
          onRiflesChange={setRifles}
          onLocationsChange={setLocations}
        />
      )}
    </div>
  );
}
