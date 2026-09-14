import { useState, useEffect, useRef } from "react";
import type { BallisticsResult } from "../lib/ballistics";
import type { ScopeAdjustmentData } from "./App";
import { findNearestDope } from "../lib/dopeAggregate";
import type {
  AuthUser,
  DopeEntry,
  Rifle,
  UnitSystem,
} from "../lib/supabase/types";

interface CalculatorProps {
  unitSystem: UnitSystem;
  onUnitSystemChange: (system: UnitSystem) => void;
  onScopeAdjustment?: (data: ScopeAdjustmentData) => void;
  user?: AuthUser | null;
  rifles?: Rifle[];
  entries?: DopeEntry[];
  selectedRifleId?: string | null;
  onSelectedRifleIdChange?: (id: string | null) => void;
  onRifleUpdated?: (rifle: Rifle) => void;
}

interface BallisticsInput {
	muzzleVelocity: number;
	bulletWeight: number;
	ballisticCoefficient: number;
	zeroRange: number;
	targetDistance: number;
	windSpeed: number;
	windAngle: number;
	sightHeight: number;
	temperature: number;
	altitude: number;
}

const STORAGE_KEY = "drift-calculator-values";

const conv = {
	fpsToMs: 0.3048,
	msToFps: 3.28084,
	ydsToM: 0.9144,
	mToYds: 1.09361,
	grToG: 0.0648,
	gToGr: 15.4324,
	ftlbToJ: 1.3558,
	jToFtlb: 0.7376,
	inToCm: 2.54,
	cmToIn: 0.3937,
	mphToMs: 0.44704,
	msToMph: 2.23694,
	ftToM: 0.3048,
	mToFt: 3.28084,
	inToMm: 25.4,
	mmToIn: 0.03937,
};

function fToC(f: number) {
	return ((f - 32) * 5) / 9;
}
function cToF(c: number) {
	return (c * 9) / 5 + 32;
}

const presets = {
	"556": {
		muzzleVelocity: 3100,
		bulletWeight: 62,
		ballisticCoefficient: 0.307,
	},
	"762x39": {
		muzzleVelocity: 2350,
		bulletWeight: 123,
		ballisticCoefficient: 0.3,
	},
	"243": { muzzleVelocity: 3025, bulletWeight: 105, ballisticCoefficient: 0.5 },
	"270": {
		muzzleVelocity: 2950,
		bulletWeight: 150,
		ballisticCoefficient: 0.496,
	},
	"308": {
		muzzleVelocity: 2700,
		bulletWeight: 168,
		ballisticCoefficient: 0.462,
	},
	"762x54r": {
		muzzleVelocity: 2580,
		bulletWeight: 174,
		ballisticCoefficient: 0.4,
	},
	"3006": {
		muzzleVelocity: 2750,
		bulletWeight: 175,
		ballisticCoefficient: 0.505,
	},
	"6.5cm": {
		muzzleVelocity: 2700,
		bulletWeight: 140,
		ballisticCoefficient: 0.61,
	},
	"6.5prc": {
		muzzleVelocity: 2900,
		bulletWeight: 143,
		ballisticCoefficient: 0.625,
	},
	"300wm": {
		muzzleVelocity: 2950,
		bulletWeight: 190,
		ballisticCoefficient: 0.533,
	},
	"300prc": {
		muzzleVelocity: 2880,
		bulletWeight: 225,
		ballisticCoefficient: 0.691,
	},
	"338lm": {
		muzzleVelocity: 2750,
		bulletWeight: 300,
		ballisticCoefficient: 0.768,
	},
	"375ct": {
		muzzleVelocity: 2850,
		bulletWeight: 350,
		ballisticCoefficient: 0.945,
	},
	"50bmg": {
		muzzleVelocity: 2800,
		bulletWeight: 750,
		ballisticCoefficient: 1.05,
	},
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
	"nra-b8": {
		size: 5.5,
		name: "NRA B-8",
		shape: "circle" as const,
		gridLines: 5,
	},
	"moa-grid": {
		size: 10,
		name: "1 MOA Grid",
		shape: "square" as const,
		gridLines: 10,
	},
	"steel-12": {
		size: 12,
		name: '12" Steel',
		shape: "circle" as const,
		gridLines: 6,
	},
	"steel-8": {
		size: 8,
		name: '8" Steel',
		shape: "circle" as const,
		gridLines: 4,
	},
	custom: {
		size: 18,
		name: "Custom",
		shape: "square" as const,
		gridLines: 6,
	},
};

// Load saved values from localStorage
function loadSavedValues() {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			const parsed = JSON.parse(saved);
			
			// Validate parsed data structure
			if (typeof parsed !== 'object' || parsed === null) {
				return null;
			}
			
			// Validate all numeric fields are actually numbers
			const numericFields = [
				'muzzleVelocity', 'bulletWeight', 'ballisticCoefficient',
				'zeroRange', 'sightHeight', 'targetDistance', 'shootingDistance',
				'windSpeed', 'windAngle', 'temperature', 'altitude'
			];
			
			for (const field of numericFields) {
				if (field in parsed && (typeof parsed[field] !== 'number' || !isFinite(parsed[field]))) {
					delete parsed[field]; // Remove invalid field
				}
			}
			
			// Validate string fields
			if (parsed.currentUnit && !['moa', 'mil'].includes(parsed.currentUnit)) {
				delete parsed.currentUnit;
			}
			
			if (parsed.displayMode && !['rings', 'grid'].includes(parsed.displayMode)) {
				delete parsed.displayMode;
			}
			
			if (parsed.targetType && typeof parsed.targetType === 'string') {
				const validTargets = ['ipsc', 'nra-b8', 'moa-grid', 'steel-12', 'steel-8', 'custom'];
				if (!validTargets.includes(parsed.targetType)) {
					delete parsed.targetType;
				}
			}
			
			return parsed;
		}
	} catch {
		// Ignore parsing errors and corrupted data
	}
	return null;
}

export function Calculator({
  unitSystem,
  onScopeAdjustment,
  user = null,
  rifles = [],
  entries = [],
  selectedRifleId = null,
  onSelectedRifleIdChange,
  onRifleUpdated,
}: CalculatorProps) {
	const saved = loadSavedValues();
	const [muzzleVelocity, setMuzzleVelocity] = useState(
		saved?.muzzleVelocity ?? 2700
	);
	const [bulletWeight, setBulletWeight] = useState(saved?.bulletWeight ?? 168);
	const [ballisticCoefficient, setBallisticCoefficient] = useState(
		saved?.ballisticCoefficient ?? 0.462
	);
	const [zeroRange, setZeroRange] = useState(saved?.zeroRange ?? 100);
	const [sightHeight, setSightHeight] = useState(saved?.sightHeight ?? 1.5);
	const [targetDistance, setTargetDistance] = useState(
		saved?.targetDistance ?? 1000
	);
	const [shootingDistance, setShootingDistance] = useState(
		saved?.shootingDistance ?? 500
	);
	const [windSpeed, setWindSpeed] = useState(saved?.windSpeed ?? 10);
	const [windAngle, setWindAngle] = useState(saved?.windAngle ?? 90);
	const [temperature, setTemperature] = useState(saved?.temperature ?? 59);
	const [altitude, setAltitude] = useState(saved?.altitude ?? 0);
	const [results, setResults] = useState<BallisticsResult[] | null>(null);
	const [currentUnit, setCurrentUnit] = useState<"moa" | "mil">(
		saved?.currentUnit ?? "moa"
	);
	const [isCalculating, setIsCalculating] = useState(false);
	const [targetType, setTargetType] = useState<keyof typeof targetPresets>(
		saved?.targetType ?? "ipsc"
	);
	const [displayMode, setDisplayMode] = useState<"rings" | "grid">(
		saved?.displayMode ?? "rings"
	);
  const [selectedPreset, setSelectedPreset] = useState<string>(
    saved?.selectedPreset ?? ""
  );
  const [truingStatus, setTruingStatus] = useState<string | null>(null);
  const [isTruing, setIsTruing] = useState(false);
  const ringsRef = useRef<HTMLDivElement>(null);
	const gridRef = useRef<HTMLDivElement>(null);
	const shapeRef = useRef<HTMLDivElement>(null);
	const prevUnitSystemRef = useRef<"imperial" | "metric">(unitSystem);
	const calculateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null
	);

  const loadPreset = (name: keyof typeof presets) => {
    const preset = presets[name];
    if (preset) {
      let vel = preset.muzzleVelocity;
      let weight = preset.bulletWeight;
      if (unitSystem === "metric") {
        vel = Math.round(vel * conv.fpsToMs);
        weight = Number((weight * conv.grToG).toFixed(1));
      }
      setMuzzleVelocity(vel);
      setBulletWeight(weight);
      setBallisticCoefficient(preset.ballisticCoefficient);
      setSelectedPreset(name);
      onSelectedRifleIdChange?.(null);
    }
  };

  const loadRifle = (rifle: Rifle) => {
    const mv = rifle.trued_muzzle_velocity_ms ?? rifle.muzzle_velocity_ms;
    if (unitSystem === "metric") {
      setMuzzleVelocity(Math.round(mv));
      setBulletWeight(Number(rifle.bullet_weight_g.toFixed(1)));
      setZeroRange(Math.round(rifle.zero_range_m));
      setSightHeight(Number(rifle.sight_height_mm.toFixed(0)));
    } else {
      setMuzzleVelocity(Math.round(mv * conv.msToFps));
      setBulletWeight(Number((rifle.bullet_weight_g * conv.gToGr).toFixed(0)));
      setZeroRange(Math.round(rifle.zero_range_m * conv.mToYds));
      setSightHeight(Number((rifle.sight_height_mm * conv.mmToIn).toFixed(1)));
    }
    setBallisticCoefficient(rifle.ballistic_coefficient);
    setCurrentUnit(rifle.scope_unit);
    setSelectedPreset("");
    onSelectedRifleIdChange?.(rifle.id);
  };

  useEffect(() => {
    if (!selectedRifleId) return;
    const rifle = rifles.find((r) => r.id === selectedRifleId);
    if (rifle) loadRifle(rifle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRifleId]);

  const trueToDope = async (save: boolean) => {
    if (!selectedRifleId || !user) return;
    setIsTruing(true);
    setTruingStatus(null);
    try {
      const res = await fetch("/api/true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ rifle_id: selectedRifleId, save }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTruingStatus(data.error || "Truing failed");
        return;
      }
      const mvMs = data.muzzleVelocity as number;
      if (unitSystem === "metric") {
        setMuzzleVelocity(Math.round(mvMs));
      } else {
        setMuzzleVelocity(Math.round(mvMs * conv.msToFps));
      }
      setTruingStatus(
        `Suggested MV ${
          unitSystem === "metric"
            ? `${Math.round(mvMs)} m/s`
            : `${Math.round(mvMs * conv.msToFps)} fps`
        } (RMS ${data.rmsError} ${currentUnit.toUpperCase()})`
      );
      if (save && onRifleUpdated) {
        const rifle = rifles.find((r) => r.id === selectedRifleId);
        if (rifle) {
          onRifleUpdated({
            ...rifle,
            trued_muzzle_velocity_ms: mvMs,
          });
        }
      }
    } catch (err) {
      setTruingStatus(err instanceof Error ? err.message : "Truing failed");
    } finally {
      setIsTruing(false);
    }
  };

  const calculate = async () => {
		setIsCalculating(true);
		try {
			// Convert to metric for API
			let vel = muzzleVelocity;
			let weight = bulletWeight;
			let zero = zeroRange;
			let sight = sightHeight;
			let dist = Math.max(targetDistance, shootingDistance);
			let wind = windSpeed;
			let temp = temperature;
			let alt = altitude;

			if (unitSystem === "imperial") {
				vel = vel * conv.fpsToMs;
				weight = weight * conv.grToG;
				zero = zero * conv.ydsToM;
				sight = sight * conv.inToMm;
				dist = dist * conv.ydsToM;
				wind = wind * conv.mphToMs;
				temp = fToC(temp);
				alt = alt * conv.ftToM;
			}

			const input: BallisticsInput = {
				muzzleVelocity: vel,
				bulletWeight: weight,
				ballisticCoefficient,
				zeroRange: zero,
				targetDistance: dist,
				windSpeed: wind,
				windAngle,
				sightHeight: sight,
				temperature: temp,
				altitude: alt,
			};

			const res = await fetch("/api/calculate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(input),
			});

			if (!res.ok) throw new Error("Calculation failed");

			const data = await res.json();
			setResults(data);
		} catch (err) {
			alert("Error: " + (err instanceof Error ? err.message : String(err)));
		} finally {
			setIsCalculating(false);
		}
	};

	// Convert values when unit system changes
	useEffect(() => {
		if (prevUnitSystemRef.current === unitSystem) return;

		const toSystem = unitSystem;

		if (toSystem === "metric") {
			setMuzzleVelocity((v: number) => Math.round(v * conv.fpsToMs));
			setBulletWeight((w: number) => Number((w * conv.grToG).toFixed(1)));
			setZeroRange((z: number) => Math.round(z * conv.ydsToM));
			setSightHeight((s: number) => Number((s * conv.inToMm).toFixed(0)));
			setTargetDistance((d: number) => Math.round(d * conv.ydsToM));
			setShootingDistance((d: number) => Math.round(d * conv.ydsToM));
			setWindSpeed((w: number) => Number((w * conv.mphToMs).toFixed(1)));
			setTemperature((t: number) => Math.round(fToC(t)));
			setAltitude((a: number) => Math.round(a * conv.ftToM));
		} else {
			setMuzzleVelocity((v: number) => Math.round(v * conv.msToFps));
			setBulletWeight((w: number) => Number((w * conv.gToGr).toFixed(0)));
			setZeroRange((z: number) => Math.round(z * conv.mToYds));
			setSightHeight((s: number) => Number((s * conv.mmToIn).toFixed(1)));
			setTargetDistance((d: number) => Math.round(d * conv.mToYds));
			setShootingDistance((d: number) => Math.round(d * conv.mToYds));
			setWindSpeed((w: number) => Number((w * conv.msToMph).toFixed(0)));
			setTemperature((t: number) => Math.round(cToF(t)));
			setAltitude((a: number) => Math.round(a * conv.mToFt));
		}

		prevUnitSystemRef.current = unitSystem;
	}, [unitSystem]);

	// Save values to localStorage whenever they change
	useEffect(() => {
		const values = {
			muzzleVelocity,
			bulletWeight,
			ballisticCoefficient,
			zeroRange,
			sightHeight,
			targetDistance,
			shootingDistance,
			windSpeed,
			windAngle,
			temperature,
			altitude,
			currentUnit,
			targetType,
			displayMode,
			selectedPreset,
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
	}, [
		muzzleVelocity,
		bulletWeight,
		ballisticCoefficient,
		zeroRange,
		sightHeight,
		targetDistance,
		shootingDistance,
		windSpeed,
		windAngle,
		temperature,
		altitude,
		currentUnit,
		targetType,
		displayMode,
		selectedPreset,
	]);

	// Auto-calculate with debounce when input values change
	useEffect(() => {
		// Clear any pending calculation
		if (calculateTimeoutRef.current) {
			clearTimeout(calculateTimeoutRef.current);
		}

		// Schedule new calculation with 300ms debounce
		calculateTimeoutRef.current = setTimeout(() => {
			calculate();
		}, 300);

		return () => {
			if (calculateTimeoutRef.current) {
				clearTimeout(calculateTimeoutRef.current);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		muzzleVelocity,
		bulletWeight,
		ballisticCoefficient,
		zeroRange,
		sightHeight,
		targetDistance,
		shootingDistance,
		windSpeed,
		windAngle,
		temperature,
		altitude,
		unitSystem,
	]);

	// Update target visual when type or display mode changes, or when results first become available
	useEffect(() => {
		updateTargetVisual();
	}, [targetType, displayMode, results]);

	const updateTargetVisual = () => {
		const ringsContainer = ringsRef.current;
		const gridContainer = gridRef.current;
		const shapeEl = shapeRef.current;

		if (!ringsContainer || !gridContainer || !shapeEl) return;

		const preset = targetPresets[targetType];

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
			const visualSize = 220;
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

	const isMetric = unitSystem === "metric";
	const distLabel = isMetric ? "m" : "yds";
	const velLabel = isMetric ? "m/s" : "fps";
	const energyLabel = isMetric ? "J" : "ft-lb";
	const dropLabel = isMetric ? "mm" : '"';

	const displayVel = (v: number) =>
		isMetric ? v : Math.round(v * conv.msToFps);
	const displayEnergy = (e: number) =>
		isMetric ? e : Math.round(e * conv.jToFtlb);
	const displayDrop = (d: number) =>
		isMetric ? d : Number((d * conv.mmToIn).toFixed(1));

	// Find result closest to shooting distance
	const getShootingResult = (): BallisticsResult | null => {
		if (!results || results.length === 0) return null;

		// Convert shooting distance to meters for comparison
		const shootingDistMeters = isMetric
			? shootingDistance
			: shootingDistance * conv.ydsToM;

		// Find closest result
		let closest = results[0];
		let minDiff = Math.abs(results[0].distance - shootingDistMeters);

		for (const r of results) {
			const diff = Math.abs(r.distance - shootingDistMeters);
			if (diff < minDiff) {
				minDiff = diff;
				closest = r;
			}
		}

		return closest;
	};

	const shootingResult = getShootingResult();

	// Target visualization calculations
	const preset = targetPresets[targetType];
	const targetSizeInches = preset.size;
	const targetSizeDisplay = isMetric
		? (targetSizeInches * conv.inToCm).toFixed(1)
		: targetSizeInches;

	// Calculate zoom scale to fit bullet position when outside target
	const calculateZoomScale = () => {
		if (!shootingResult) return 1;

		const dropInches = shootingResult.drop * conv.mmToIn;
		const driftInches = shootingResult.windDrift * conv.mmToIn;
		const targetRadius = targetSizeInches / 2;
		const maxOffset = Math.max(Math.abs(dropInches), Math.abs(driftInches));

		// If bullet is within target, no zoom needed
		if (maxOffset <= targetRadius) {
			return 1;
		}

		// Calculate scale factor to fit bullet with some margin (20% padding)
		const requiredRadius = maxOffset * 1.2;
		return targetRadius / requiredRadius;
	};

	const zoomScale = calculateZoomScale();

	const getMarkerPosition = () => {
		if (!shootingResult) return { x: 110, y: 110 };

		const visualSize = 220;
		const centerX = visualSize / 2;
		const centerY = visualSize / 2;

		const dropInches = shootingResult.drop * conv.mmToIn;
		const driftInches = shootingResult.windDrift * conv.mmToIn;

		// When zoomed out, we scale based on a larger effective target size
		const targetVisualDiameter = visualSize * 0.9;
		const effectiveTargetSize = targetSizeInches / zoomScale;
		const pixelsPerInch = targetVisualDiameter / effectiveTargetSize;

		const markerX = centerX + driftInches * pixelsPerInch;
		const markerY = centerY + dropInches * pixelsPerInch;

		return {
			x: markerX,
			y: markerY,
		};
	};

	const markerPos = getMarkerPosition();

	const isOnTarget = () => {
		if (!shootingResult) return false;

		const dropInches = shootingResult.drop * conv.mmToIn;
		const driftInches = shootingResult.windDrift * conv.mmToIn;

		if (preset.shape === "rect" && preset.width && preset.height) {
			return (
				Math.abs(driftInches) <= preset.width / 2 &&
				Math.abs(dropInches) <= preset.height / 2
			);
		}

		const impactRadius = Math.sqrt(
			dropInches * dropInches + driftInches * driftInches
		);
		const targetRadius = targetSizeInches / 2;
		return impactRadius <= targetRadius;
	};

                  const actuallyOnTarget = isOnTarget();

  const nearestDope =
    selectedRifleId && shootingResult
      ? findNearestDope(
          entries.filter((e) => e.rifle_id === selectedRifleId),
          shootingResult.distance,
          currentUnit,
          20
        )
      : [];
  const dopeMatch = nearestDope[0] ?? null;
  const predictedCorrection = shootingResult
    ? currentUnit === "moa"
      ? shootingResult.moa
      : shootingResult.mil
    : null;
  const dopeDelta =
    dopeMatch && predictedCorrection !== null
      ? predictedCorrection - dopeMatch.elevation_correction
      : null;

  return (
		<div className="grid">
			<div className="sidebar">
        <div className="card">
          <h3 className="card-title">Cartridge</h3>

          {user && rifles.length > 0 && (
            <div className="form-group full">
              <label>My Rifle</label>
              <select
                value={selectedRifleId ?? ""}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) {
                    onSelectedRifleIdChange?.(null);
                    return;
                  }
                  const rifle = rifles.find((r) => r.id === id);
                  if (rifle) loadRifle(rifle);
                }}
              >
                <option value="">Use preset / manual…</option>
                {rifles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.trued_muzzle_velocity_ms ? " (trued)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group full">
            <label>Preset</label>
						<select
							value={selectedPreset}
							onChange={(e) => {
								if (e.target.value) {
									loadPreset(e.target.value as keyof typeof presets);
								}
							}}
						>
							<option value="" disabled>
								Select a cartridge...
							</option>
							<option value="556">5.56 NATO</option>
							<option value="762x39">7.62x39</option>
							<option value="308">308 Win</option>
							<option value="762x54r">7.62x54R</option>
							<option value="6.5cm">6.5 Creedmoor</option>
							<option value="6.5prc">6.5 PRC</option>
							<option value="243">243 Win</option>
							<option value="270">270 Win</option>
							<option value="3006">30-06</option>
							<option value="300wm">300 Win Mag</option>
							<option value="300prc">300 PRC</option>
							<option value="338lm">338 Lapua</option>
							<option value="375ct">375 CheyTac</option>
							<option value="50bmg">50 BMG</option>
						</select>
					</div>

					<div className="form-grid">
						<div className="form-group">
							<label>
								Muzzle Velocity{" "}
								<span className="label-hint">({isMetric ? "m/s" : "fps"})</span>
							</label>
							<input
								type="number"
								value={muzzleVelocity}
								onChange={(e) => setMuzzleVelocity(Number(e.target.value))}
								step="10"
							/>
						</div>
						<div className="form-group">
							<label>
								Bullet Weight{" "}
								<span className="label-hint">({isMetric ? "g" : "gr"})</span>
							</label>
							<input
								type="number"
								value={bulletWeight}
								onChange={(e) => setBulletWeight(Number(e.target.value))}
								step="1"
							/>
						</div>
						<div className="form-group full">
							<label>
								Ballistic Coefficient <span className="label-hint">(G1)</span>
							</label>
							<input
								type="number"
								value={ballisticCoefficient}
								onChange={(e) =>
									setBallisticCoefficient(Number(e.target.value))
								}
								step="0.001"
							/>
						</div>
					</div>

					<div className="divider"></div>

					<h3 className="card-title">Rifle Setup</h3>
					<div className="form-grid">
						<div className="form-group">
							<label>
								Zero Range{" "}
								<span className="label-hint">({isMetric ? "m" : "yds"})</span>
							</label>
							<input
								type="number"
								value={zeroRange}
								onChange={(e) => setZeroRange(Number(e.target.value))}
								step="25"
							/>
						</div>
						<div className="form-group">
							<label>
								Sight Height{" "}
								<span className="label-hint">({isMetric ? "mm" : "in"})</span>
							</label>
							<input
								type="number"
								value={sightHeight}
								onChange={(e) => setSightHeight(Number(e.target.value))}
								step="0.1"
							/>
						</div>
					</div>

					<div className="divider"></div>

					<h3 className="card-title">Environment</h3>
					<div className="form-grid">
						<div className="form-group">
							<label>
								Wind Speed{" "}
								<span className="label-hint">({isMetric ? "m/s" : "mph"})</span>
							</label>
							<input
								type="number"
								value={windSpeed}
								onChange={(e) => setWindSpeed(Number(e.target.value))}
								step="1"
								min="0"
							/>
						</div>
						<div className="form-group">
							<label>
								Wind Angle <span className="label-hint">(deg)</span>
							</label>
							<input
								type="number"
								value={windAngle}
								onChange={(e) => setWindAngle(Number(e.target.value))}
								step="15"
								min="0"
								max="360"
							/>
						</div>
					</div>
					<div className="wind-direction-indicator">
						<div className="wind-compass">
							<div className="compass-ring">
								<span className="compass-label top">0°</span>
								<span className="compass-label right">90°</span>
								<span className="compass-label bottom">180°</span>
								<span className="compass-label left">270°</span>
							</div>
							<div
								className="wind-arrow"
								style={{
									transform: `rotate(${windAngle + 180}deg)`,
								}}
							>
								<svg
									viewBox="0 0 24 24"
									fill="currentColor"
									width="20"
									height="20"
								>
									<path
										d="M12 2L8 10h8L12 2zM12 22V10"
										stroke="currentColor"
										strokeWidth="2"
										fill="none"
									/>
								</svg>
							</div>
							<div className="shooter-icon">
								<svg
									viewBox="0 0 24 24"
									fill="currentColor"
									width="16"
									height="16"
								>
									<circle cx="12" cy="8" r="4" />
									<path
										d="M12 12v8M8 16h8"
										stroke="currentColor"
										strokeWidth="2"
										fill="none"
									/>
								</svg>
							</div>
						</div>
						<div className="wind-effect-labels">
							{(() => {
								const angleRad = (windAngle * Math.PI) / 180;
								const headwindComponent = Math.cos(angleRad);
								const crosswindComponent = Math.abs(Math.sin(angleRad));

								const effects = [];

								// Headwind/Tailwind effect (affects velocity/drop)
								if (Math.abs(headwindComponent) > 0.1) {
									if (headwindComponent > 0) {
										effects.push(
											<span key="head" className="wind-effect hindering">
												<svg viewBox="0 0 16 16" width="12" height="12">
													<path
														d="M8 3v10M4 7l4-4 4 4"
														stroke="currentColor"
														strokeWidth="2"
														fill="none"
													/>
												</svg>
												Headwind (
												{Math.round(Math.abs(headwindComponent) * 100)}%) —
												slows bullet, more drop
											</span>
										);
									} else {
										effects.push(
											<span key="tail" className="wind-effect assisting">
												<svg viewBox="0 0 16 16" width="12" height="12">
													<path
														d="M8 13V3M4 9l4 4 4-4"
														stroke="currentColor"
														strokeWidth="2"
														fill="none"
													/>
												</svg>
												Tailwind (
												{Math.round(Math.abs(headwindComponent) * 100)}%) —
												assists bullet, less drop
											</span>
										);
									}
								}

								// Crosswind effect (affects drift)
								if (crosswindComponent > 0.1) {
									const direction = Math.sin(angleRad) > 0 ? "right" : "left";
									effects.push(
										<span key="cross" className="wind-effect crosswind">
											<svg viewBox="0 0 16 16" width="12" height="12">
												<path
													d="M3 8h10M9 4l4 4-4 4"
													stroke="currentColor"
													strokeWidth="2"
													fill="none"
												/>
											</svg>
											Crosswind ({Math.round(crosswindComponent * 100)}%) —
											drifts {direction}
										</span>
									);
								}

								if (effects.length === 0) {
									effects.push(
										<span key="none" className="wind-effect neutral">
											No significant wind effect
										</span>
									);
								}

								return effects;
							})()}
						</div>
					</div>
					<div className="form-grid">
						<div className="form-group">
							<label>
								Temperature{" "}
								<span className="label-hint">({isMetric ? "°C" : "°F"})</span>
							</label>
							<input
								type="number"
								value={temperature}
								onChange={(e) => setTemperature(Number(e.target.value))}
								step="5"
							/>
						</div>
						<div className="form-group">
							<label>
								Altitude{" "}
								<span className="label-hint">({isMetric ? "m" : "ft"})</span>
							</label>
							<input
								type="number"
								value={altitude}
								onChange={(e) => setAltitude(Number(e.target.value))}
								step="500"
							/>
						</div>
					</div>
				</div>
			</div>

			<div className="main">
				<div className="card shot-calculator">
					<div className="shot-header">
						<div className="shot-distance-input">
							<label>Shooting Distance</label>
							<div className="distance-input-wrapper">
								<input
									type="number"
									value={shootingDistance}
									onChange={(e) => setShootingDistance(Number(e.target.value))}
									step={isMetric ? 25 : 25}
									min={0}
									max={999999999}
								/>
								<span className="distance-unit">{distLabel}</span>
							</div>
						</div>
						<div className="unit-toggle">
							<button
								className={currentUnit === "moa" ? "active" : ""}
								onClick={() => setCurrentUnit("moa")}
							>
								MOA
							</button>
							<button
								className={currentUnit === "mil" ? "active" : ""}
								onClick={() => setCurrentUnit("mil")}
							>
								MIL
							</button>
						</div>
					</div>

					{!results || results.length === 0 || !shootingResult ? (
						<div className="empty-state">
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
								<circle cx="12" cy="12" r="3" />
							</svg>
							<p>
								{isCalculating
									? "Calculating trajectory..."
									: "Enter your parameters to view the trajectory"}
							</p>
						</div>
					) : (
						<div className="shot-result-layout">
							<div className="target-section">
								<div className="target-controls">
									<div className="target-select">
										<label>Target</label>
										<select
											value={targetType}
											onChange={(e) =>
												setTargetType(
													e.target.value as keyof typeof targetPresets
												)
											}
										>
											<option value="ipsc">IPSC (18"×30")</option>
											<option value="nra-b8">NRA B-8 (5.5")</option>
											<option value="moa-grid">1 MOA Grid (10")</option>
											<option value="steel-12">12" Steel</option>
											<option value="steel-8">8" Steel</option>
											<option value="custom">Custom (18")</option>
										</select>
									</div>
									<div className="display-mode-toggle">
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
								</div>

								<div className="inline-target-visual">
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
									<div
										className={`drift-marker ${
											actuallyOnTarget ? "on-target" : "off-target"
										}`}
										style={{
											left: markerPos.x + "px",
											top: markerPos.y + "px",
										}}
									></div>
									{zoomScale < 1 && (
										<div className="zoom-indicator">
											{Math.round(zoomScale * 100)}%
										</div>
									)}
								</div>
								<div className="target-size-label">
									{targetSizeDisplay}
									{isMetric ? "cm" : '"'} target
								</div>

								<div
									className={`shot-verdict ${
										actuallyOnTarget ? "hit" : "miss"
									}`}
								>
									{actuallyOnTarget ? (
										<>
											<span className="verdict-icon">✓</span>
											<span>On Target</span>
										</>
									) : (
										<>
											<span className="verdict-icon">✗</span>
											<span>Off Target</span>
										</>
									)}
								</div>
							</div>

							<div className="ballistics-section">
								<div className="shot-stats-grid">
									<div className="shot-stat primary">
										<div className="stat-label">Drop</div>
										<div
											className={`stat-value ${
												Math.abs(shootingResult.drop) > 12.7
													? "negative"
													: "positive"
											}`}
										>
											{shootingResult.drop > 0 ? "+" : ""}
											{displayDrop(shootingResult.drop)}
											{dropLabel}
										</div>
									</div>
									<div className="shot-stat primary">
										<div className="stat-label">Wind Drift</div>
										<div
											className={`stat-value ${
												Math.abs(shootingResult.windDrift) > 12.7
													? "negative"
													: "positive"
											}`}
										>
											{shootingResult.windDrift > 0 ? "+" : ""}
											{displayDrop(shootingResult.windDrift)}
											{dropLabel}
										</div>
									</div>
                  <div className="shot-stat">
                    <div className="stat-label">Correction</div>
                    <div className="stat-value accent">
                      {(currentUnit === "moa"
                        ? shootingResult.moa
                        : shootingResult.mil) > 0
                        ? "+"
                        : ""}
                      {currentUnit === "moa"
                        ? shootingResult.moa
                        : shootingResult.mil}{" "}
                      {currentUnit.toUpperCase()}
                    </div>
                    {dopeMatch && (
                      <div className="dope-overlay">
                        <div className="dope-overlay-label">Your DOPE</div>
                        <div>
                          {dopeMatch.elevation_correction > 0 ? "+" : ""}
                          {dopeMatch.elevation_correction.toFixed(2)}{" "}
                          {dopeMatch.correction_unit.toUpperCase()}
                        </div>
                        {dopeDelta !== null && (
                          <div
                            className={`dope-delta ${
                              Math.abs(dopeDelta) < 0.25 ? "ok" : "warn"
                            }`}
                          >
                            Δ {dopeDelta > 0 ? "+" : ""}
                            {dopeDelta.toFixed(2)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
									<div className="shot-stat">
										<div className="stat-label">Time of Flight</div>
										<div className="stat-value">
											{shootingResult.timeOfFlight}s
										</div>
									</div>
									<div className="shot-stat">
										<div className="stat-label">Velocity</div>
										<div className="stat-value">
											{displayVel(shootingResult.velocity)} {velLabel}
										</div>
									</div>
									<div className="shot-stat">
										<div className="stat-label">Energy</div>
										<div className="stat-value">
											{displayEnergy(shootingResult.energy)} {energyLabel}
										</div>
									</div>
								</div>

                {onScopeAdjustment && (
                  <button
                    className="scope-adjust-btn"
                    onClick={() => {
                      onScopeAdjustment({
                        offsetX: shootingResult.windDrift,
                        offsetY: -shootingResult.drop,
                        distance: shootingResult.distance,
                      });
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      width="16"
                      height="16"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="3" />
                      <line x1="12" y1="2" x2="12" y2="6" />
                      <line x1="12" y1="18" x2="12" y2="22" />
                      <line x1="2" y1="12" x2="6" y2="12" />
                      <line x1="18" y1="12" x2="22" y2="12" />
                    </svg>
                    Get Scope Adjustment
                  </button>
                )}

                {user && selectedRifleId && (
                  <div className="truing-actions">
                    <button
                      type="button"
                      className="scope-adjust-btn secondary"
                      disabled={isTruing}
                      onClick={() => trueToDope(false)}
                    >
                      {isTruing ? "Truing…" : "True to DOPE"}
                    </button>
                    <button
                      type="button"
                      className="scope-adjust-btn secondary"
                      disabled={isTruing}
                      onClick={() => trueToDope(true)}
                    >
                      True & save
                    </button>
                    {truingStatus && (
                      <p className="help-text truing-status">{truingStatus}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
