import { useState, useEffect, useRef } from "react";
import type { ScopeAdjustmentData } from "./App";
import { createClientId, enqueueDope } from "../lib/offlineQueue";
import type {
  AuthUser,
  DopeEntry,
  Location,
  Rifle,
  UnitSystem,
} from "../lib/supabase/types";

interface ScopeAdjustmentProps {
  unitSystem: UnitSystem;
  onUnitSystemChange: (system: UnitSystem) => void;
  initialData?: ScopeAdjustmentData | null;
  onDataConsumed?: () => void;
  user?: AuthUser | null;
  rifles?: Rifle[];
  locations?: Location[];
  selectedRifleId?: string | null;
  onSelectedRifleIdChange?: (id: string | null) => void;
  onDopeSaved?: (entry: DopeEntry) => void;
}

const conv = {
	inToCm: 2.54,
	cmToIn: 0.3937,
	inToMm: 25.4,
	mmToIn: 0.03937,
	mToYds: 1.09361,
	ydsToM: 0.9144,
};

const targetPresets = {
	ipsc: {
		size: 18,
		name: "IPSC",
		shape: "rect" as const,
		width: 18,
		height: 30,
		gridLines: 6,
	},
	"nra-b8": { size: 5.5, name: "NRA B-8", shape: "circle" as const, gridLines: 5 },
	"moa-grid": { size: 10, name: "1 MOA Grid", shape: "square" as const, gridLines: 10 },
	"steel-12": { size: 12, name: '12" Steel', shape: "circle" as const, gridLines: 6 },
	"steel-8": { size: 8, name: '8" Steel', shape: "circle" as const, gridLines: 4 },
	custom: { size: 18, name: "Custom", shape: "square" as const, gridLines: 6 },
};

export function ScopeAdjustment({
  unitSystem,
  initialData,
  onDataConsumed,
  user = null,
  rifles = [],
  locations = [],
  selectedRifleId = null,
  onSelectedRifleIdChange,
  onDopeSaved,
}: ScopeAdjustmentProps) {
	const [targetType, setTargetType] = useState<keyof typeof targetPresets>(
		"ipsc"
	);
	const [targetSize, setTargetSize] = useState(18);
	const [distance, setDistance] = useState(100);
	const [clickValue, setClickValue] = useState("0.25moa");
	const [offsetX, setOffsetX] = useState(0);
	const [offsetY, setOffsetY] = useState(0);
	const [displayMode, setDisplayMode] = useState<"rings" | "grid">("rings");
  const [shotMarkerVisible, setShotMarkerVisible] = useState(false);
  const [shotMarkerPos, setShotMarkerPos] = useState({ x: 0, y: 0 });
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const targetVisualRef = useRef<HTMLDivElement>(null);
	const ringsRef = useRef<HTMLDivElement>(null);
	const gridRef = useRef<HTMLDivElement>(null);
	const shapeRef = useRef<HTMLDivElement>(null);

	const isMetric = unitSystem === "metric";

	// Apply initial data from calculator
	useEffect(() => {
		if (initialData) {
			// Data comes in metric (mm for offsets, m for distance)
			if (isMetric) {
				setOffsetX(Number(initialData.offsetX.toFixed(1)));
				setOffsetY(Number(initialData.offsetY.toFixed(1)));
				setDistance(Math.round(initialData.distance));
			} else {
				// Convert to imperial (mm to inches, m to yards)
				setOffsetX(Number((initialData.offsetX * conv.mmToIn).toFixed(1)));
				setOffsetY(Number((initialData.offsetY * conv.mmToIn).toFixed(1)));
				setDistance(Math.round(initialData.distance * conv.mToYds));
			}
			setShotMarkerVisible(true);
			onDataConsumed?.();
		}
	}, [initialData]);

	useEffect(() => {
		const preset = targetPresets[targetType];
		let size = preset.size;
		if (isMetric) {
			size = Number((size * conv.inToCm).toFixed(1));
		}
		setTargetSize(size);
		updateTargetVisual();
	}, [targetType, unitSystem, displayMode]);

	useEffect(() => {
		updateTargetVisual();
	}, [displayMode]);

	useEffect(() => {
		updateShotFromInputs();
	}, [offsetX, offsetY, targetSize, distance, unitSystem]);

	const updateTargetVisual = () => {
		const preset = targetPresets[targetType];
		const ringsContainer = ringsRef.current;
		const gridContainer = gridRef.current;
		const shapeEl = shapeRef.current;

		if (!ringsContainer || !gridContainer || !shapeEl) return;

		ringsContainer.innerHTML = "";
		gridContainer.innerHTML = "";
		shapeEl.style.display = "none";

		if (displayMode === "rings") {
			ringsContainer.style.display = "flex";
			gridContainer.style.display = "none";

			const ringCount = preset.gridLines || 4;
			for (let i = 1; i <= ringCount; i++) {
				const ring = document.createElement("div");
				ring.className = "target-ring";
				const pct = (i / ringCount) * 90;
				ring.style.width = pct + "%";
				ring.style.height = pct + "%";
				ringsContainer.appendChild(ring);
			}
		} else {
			ringsContainer.style.display = "none";
			gridContainer.style.display = "block";

			const gridLines = preset.gridLines || 6;
			const visualSize = 200;
			const spacing = visualSize / gridLines;

			for (let i = 0; i <= gridLines; i++) {
				const line = document.createElement("div");
				line.className =
					"target-grid-line h" + (i === gridLines / 2 ? " major" : "");
				line.style.top = i * spacing + "px";
				gridContainer.appendChild(line);
			}

			for (let i = 0; i <= gridLines; i++) {
				const line = document.createElement("div");
				line.className =
					"target-grid-line v" + (i === gridLines / 2 ? " major" : "");
				line.style.left = i * spacing + "px";
				gridContainer.appendChild(line);
			}

			shapeEl.style.display = "block";
			shapeEl.className = "target-shape";

			if (preset.shape === "circle") {
				shapeEl.classList.add("circle");
				shapeEl.style.width = "80%";
				shapeEl.style.height = "80%";
			} else if (preset.shape === "rect" && preset.width && preset.height) {
				const aspect = preset.height / preset.width;
				if (aspect > 1) {
					shapeEl.style.height = "90%";
					shapeEl.style.width = 90 / aspect + "%";
				} else {
					shapeEl.style.width = "90%";
					shapeEl.style.height = 90 * aspect + "%";
				}
			} else {
				shapeEl.style.width = "80%";
				shapeEl.style.height = "80%";
			}
		}
	};

	const handleTargetClick = (e: React.MouseEvent<HTMLDivElement>) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		const centerX = rect.width / 2;
		const centerY = rect.height / 2;

		let targetSizeInches = targetSize;
		if (isMetric) {
			targetSizeInches = targetSize * conv.cmToIn;
		}

		const pixelsPerInch = rect.width / targetSizeInches;
		const offsetXInches = (x - centerX) / pixelsPerInch;
		const offsetYInches = -(y - centerY) / pixelsPerInch;

		setShotMarkerPos({ x, y });
		setShotMarkerVisible(true);

		let dispX = offsetXInches;
		let dispY = offsetYInches;
		if (isMetric) {
			dispX = offsetXInches * conv.inToMm;
			dispY = offsetYInches * conv.inToMm;
		}
		setOffsetX(Number(dispX.toFixed(1)));
		setOffsetY(Number(dispY.toFixed(1)));
	};

	// Calculate zoom scale to fit bullet position when outside target
	const calculateZoomScale = () => {
		let offsetXInches = offsetX;
		let offsetYInches = offsetY;
		if (isMetric) {
			offsetXInches = offsetX * conv.mmToIn;
			offsetYInches = offsetY * conv.mmToIn;
		}

		let targetSizeInches = targetSize;
		if (isMetric) {
			targetSizeInches = targetSize * conv.cmToIn;
		}

		const targetRadius = targetSizeInches / 2;
		const maxOffset = Math.max(
			Math.abs(offsetXInches),
			Math.abs(offsetYInches)
		);

		// If bullet is within target, no zoom needed
		if (maxOffset <= targetRadius) {
			return 1;
		}

		// Calculate scale factor to fit bullet with some margin (20% padding)
		const requiredRadius = maxOffset * 1.2;
		return targetRadius / requiredRadius;
	};

	const zoomScale = calculateZoomScale();

	const updateShotFromInputs = () => {
		let offsetXInches = offsetX;
		let offsetYInches = offsetY;
		if (isMetric) {
			offsetXInches = offsetX * conv.mmToIn;
			offsetYInches = offsetY * conv.mmToIn;
		}

		const visual = targetVisualRef.current;
		if (!visual) return;

		let targetSizeInches = targetSize;
		if (isMetric) {
			targetSizeInches = targetSize * conv.cmToIn;
		}

		// When zoomed out, we scale based on a larger effective target size
		const effectiveTargetSize = targetSizeInches / zoomScale;
		const pixelsPerInch = visual.offsetWidth / effectiveTargetSize;
		const centerX = visual.offsetWidth / 2;
		const centerY = visual.offsetHeight / 2;

		const markerX = centerX + offsetXInches * pixelsPerInch;
		const markerY = centerY - offsetYInches * pixelsPerInch;

		setShotMarkerPos({ x: markerX, y: markerY });
		setShotMarkerVisible(Math.abs(offsetX) > 0.01 || Math.abs(offsetY) > 0.01);
	};

	const calculateAdjustment = () => {
		let offsetXInches = offsetX;
		let offsetYInches = offsetY;
		if (isMetric) {
			offsetXInches = offsetX * conv.mmToIn;
			offsetYInches = offsetY * conv.mmToIn;
		}

		let distanceYards = distance;
		if (isMetric) {
			distanceYards = distance * conv.mToYds;
		}

		const moaPerInchAt100 = 1 / 1.047;
		const milPerInchAt100 = 1 / 3.6;
		const distanceFactor = 100 / distanceYards;

		const moaX = offsetXInches * moaPerInchAt100 * distanceFactor;
		const moaY = offsetYInches * moaPerInchAt100 * distanceFactor;
		const milX = offsetXInches * milPerInchAt100 * distanceFactor;
		const milY = offsetYInches * milPerInchAt100 * distanceFactor;

		let clicksX, clicksY;
		if (clickValue.includes("moa")) {
			const clickMoa = parseFloat(clickValue);
			clicksX = Math.round(moaX / clickMoa);
			clicksY = Math.round(moaY / clickMoa);
		} else {
			const clickMil = parseFloat(clickValue);
			clicksX = Math.round(milX / clickMil);
			clicksY = Math.round(milY / clickMil);
		}

		const horizDir = offsetXInches > 0 ? "Left" : "Right";
		const vertDir = offsetYInches > 0 ? "Down" : "Up";
		const horizArrow = offsetXInches > 0 ? "←" : "→";
		const vertArrow = offsetYInches > 0 ? "↓" : "↑";

		const absClicksX = Math.abs(clicksX);
		const absClicksY = Math.abs(clicksY);

		if (absClicksX === 0 && absClicksY === 0) {
			return (
				<div
					style={{
						textAlign: "center",
						color: "var(--success)",
						fontSize: "0.875rem",
					}}
				>
					✓ Shot is centered - no adjustment needed
				</div>
			);
		}

		return (
			<>
				<div className="adjustment-grid">
					<div className="adjustment-item">
						<div className="arrow">{horizArrow}</div>
						<div className="direction">Windage ({horizDir})</div>
						<div className="value">{absClicksX}</div>
						<div className="unit">clicks</div>
					</div>
					<div className="adjustment-item">
						<div className="arrow">{vertArrow}</div>
						<div className="direction">Elevation ({vertDir})</div>
						<div className="value">{absClicksY}</div>
						<div className="unit">clicks</div>
					</div>
				</div>
				<div className="click-info">
					<strong>{Math.abs(moaX).toFixed(1)} MOA</strong>{" "}
					{horizDir.toLowerCase()} ·
					<strong> {Math.abs(moaY).toFixed(1)} MOA</strong>{" "}
					{vertDir.toLowerCase()}
					<br />
					<span style={{ color: "var(--muted)" }}>
						{Math.abs(milX).toFixed(2)} MIL {horizDir.toLowerCase()} ·{" "}
						{Math.abs(milY).toFixed(2)} MIL {vertDir.toLowerCase()}
					</span>
        </div>
      </>
    );
  };

  const saveAsDope = async () => {
    if (!user || !selectedRifleId) {
      setSaveStatus("Select a rifle (and sign in) to save DOPE");
      return;
    }
    setSaving(true);
    setSaveStatus(null);

    const rifle = rifles.find((r) => r.id === selectedRifleId);
    const unit = rifle?.scope_unit ?? "moa";

    let offsetXInches = offsetX;
    let offsetYInches = offsetY;
    let distanceYards = distance;
    if (isMetric) {
      offsetXInches = offsetX * conv.mmToIn;
      offsetYInches = offsetY * conv.mmToIn;
      distanceYards = distance * conv.mToYds;
    }

    const moaPerInchAt100 = 1 / 1.047;
    const milPerInchAt100 = 1 / 3.6;
    const distanceFactor = 100 / Math.max(distanceYards, 1);
    // OffsetY: + high (above POA) means dial down → negative elevation correction
    // OffsetX: + right means dial left → we store +right as windage correction
    const elevMoa = -offsetYInches * moaPerInchAt100 * distanceFactor;
    const windMoa = offsetXInches * moaPerInchAt100 * distanceFactor;
    const elevMil = -offsetYInches * milPerInchAt100 * distanceFactor;
    const windMil = offsetXInches * milPerInchAt100 * distanceFactor;

    const elevation_correction = Number(
      (unit === "moa" ? elevMoa : elevMil).toFixed(2)
    );
    const windage_correction = Number(
      (unit === "moa" ? windMoa : windMil).toFixed(2)
    );
    const distance_m = isMetric
      ? distance
      : Number((distance * conv.ydsToM).toFixed(2));

    const client_id = createClientId();
    const payload = {
      client_id,
      rifle_id: selectedRifleId,
      location_id: null as string | null,
      distance_m,
      elevation_correction,
      windage_correction,
      correction_unit: unit as "moa" | "mil",
      shot_at: new Date().toISOString(),
    };

    try {
      if (!navigator.onLine) {
        enqueueDope(payload);
        setSaveStatus("Queued offline");
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
        setSaveStatus(data.error || "Failed to save");
        return;
      }
      onDopeSaved?.(data.entry);
      setSaveStatus("Saved to DOPE");
    } catch {
      enqueueDope(payload);
      setSaveStatus("Queued offline");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">Scope Adjustment</h2>
      <p
        style={{
          fontSize: "0.8125rem",
          color: "var(--muted-foreground)",
          margin: "0 0 1.25rem 0",
        }}
      >
        Click on the target where your shot landed to calculate scope
        adjustments.
      </p>

			<div className="target-container">
				<div className="target-wrapper">
					<div className="display-toggle">
						<button
							className={displayMode === "rings" ? "active" : ""}
							onClick={() => setDisplayMode("rings")}
						>
							Rings
						</button>
						<button
							className={displayMode === "grid" ? "active" : ""}
							onClick={() => setDisplayMode("grid")}
						>
							Grid
						</button>
					</div>
					<div
						className="target-visual"
						ref={targetVisualRef}
						onClick={handleTargetClick}
					>
						<div
							className="target-content"
							style={{
								transform: `scale(${zoomScale})`,
								transition: "transform 0.3s ease-out",
							}}
						>
							<div className="target-crosshair h"></div>
							<div className="target-crosshair v"></div>
							<div className="target-rings" ref={ringsRef}></div>
							<div
								className="target-grid"
								ref={gridRef}
								style={{ display: "none" }}
							></div>
							<div
								className="target-shape"
								ref={shapeRef}
								style={{ display: "none" }}
							></div>
						</div>
						{shotMarkerVisible && (
							<div
								className="shot-marker"
								style={{
									left: shotMarkerPos.x + "px",
									top: shotMarkerPos.y + "px",
								}}
							></div>
						)}
						{zoomScale < 1 && (
							<div className="zoom-indicator">
								{Math.round(zoomScale * 100)}%
							</div>
						)}
					</div>
				</div>

				<div className="target-form">
					<div className="form-grid">
						<div className="form-group">
							<label>Target Type</label>
							<select
								value={targetType}
								onChange={(e) =>
									setTargetType(e.target.value as keyof typeof targetPresets)
								}
							>
								<option value="ipsc">IPSC/USPSA (18" × 30")</option>
								<option value="nra-b8">NRA B-8 (5.5" ring)</option>
								<option value="moa-grid">1 MOA Grid</option>
								<option value="steel-12">12" Steel</option>
								<option value="steel-8">8" Steel</option>
								<option value="custom">Custom Size</option>
							</select>
						</div>
						<div className="form-group">
							<label>
								Shot Distance{" "}
								<span className="label-hint">({isMetric ? "m" : "yds"})</span>
							</label>
							<input
								type="number"
								value={distance}
								onChange={(e) => setDistance(Number(e.target.value))}
								step="25"
							/>
						</div>
						<div className="form-group">
							<label>
								Target Size{" "}
								<span className="label-hint">({isMetric ? "cm" : "in"})</span>
							</label>
							<input
								type="number"
								value={targetSize}
								onChange={(e) => setTargetSize(Number(e.target.value))}
								step="1"
							/>
						</div>
          <div className="form-group">
            <label>Click Value</label>
            <select
              value={clickValue}
              onChange={(e) => setClickValue(e.target.value)}
            >
              <option value="0.25moa">1/4 MOA</option>
              <option value="0.5moa">1/2 MOA</option>
              <option value="1moa">1 MOA</option>
              <option value="0.1mil">0.1 MIL</option>
              <option value="0.2mil">0.2 MIL</option>
            </select>
          </div>
          {user && rifles.length > 0 && (
            <div className="form-group full">
              <label>Save to rifle</label>
              <select
                value={selectedRifleId ?? ""}
                onChange={(e) =>
                  onSelectedRifleIdChange?.(e.target.value || null)
                }
              >
                <option value="">Select rifle…</option>
                {rifles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group">
            <label>
              Horizontal Offset{" "}
              <span className="label-hint">({isMetric ? "mm" : "in"})</span>
            </label>
							<input
								type="number"
								value={offsetX}
								onChange={(e) => setOffsetX(Number(e.target.value))}
								step="0.1"
							/>
							<p className="help-text">+ Right, − Left</p>
						</div>
						<div className="form-group">
							<label>
								Vertical Offset{" "}
								<span className="label-hint">({isMetric ? "mm" : "in"})</span>
							</label>
							<input
								type="number"
								value={offsetY}
								onChange={(e) => setOffsetY(Number(e.target.value))}
								step="0.1"
							/>
							<p className="help-text">+ High, − Low</p>
						</div>
					</div>

          <div
            className={`adjustment-result ${
              Math.abs(offsetX) > 0.01 || Math.abs(offsetY) > 0.01
                ? "has-adjustment"
                : ""
            }`}
          >
            {Math.abs(offsetX) < 0.01 && Math.abs(offsetY) < 0.01 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "var(--muted-foreground)",
                  fontSize: "0.875rem",
                }}
              >
                Click on target or enter offset values to see adjustments
              </div>
            ) : (
              calculateAdjustment()
            )}
          </div>

          {user && (
            <div className="save-dope-block">
              <button
                type="button"
                className="scope-adjust-btn"
                disabled={
                  saving ||
                  !selectedRifleId ||
                  (Math.abs(offsetX) < 0.01 && Math.abs(offsetY) < 0.01)
                }
                onClick={saveAsDope}
              >
                {saving ? "Saving…" : "Save as DOPE"}
              </button>
              {locations.length > 0 && (
                <p className="help-text">
                  Tip: tag locations from the DOPE tab for richer records.
                </p>
              )}
              {saveStatus && <p className="help-text">{saveStatus}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
