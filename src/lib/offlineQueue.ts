export interface QueuedDopePayload {
  client_id: string;
  rifle_id: string;
  location_id?: string | null;
  shot_at?: string;
  distance_m: number;
  elevation_correction: number;
  windage_correction?: number;
  correction_unit?: "moa" | "mil";
  wind_speed_ms?: number | null;
  wind_angle_deg?: number | null;
  temperature_c?: number | null;
  altitude_m?: number | null;
  pressure_hpa?: number | null;
  group_size_mm?: number | null;
  shots?: number | null;
  ammo_lot?: string | null;
  notes?: string | null;
  _queued_at: string;
}

const QUEUE_KEY = "drift-dope-offline-queue";

function readQueue(): QueuedDopePayload[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedDopePayload[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export function getOfflineQueue(): QueuedDopePayload[] {
  return readQueue();
}

export function enqueueDope(payload: Omit<QueuedDopePayload, "_queued_at">) {
  const queue = readQueue();
  const existing = queue.findIndex((q) => q.client_id === payload.client_id);
  const item: QueuedDopePayload = {
    ...payload,
    _queued_at: new Date().toISOString(),
  };
  if (existing >= 0) {
    queue[existing] = item;
  } else {
    queue.push(item);
  }
  writeQueue(queue);
  return item;
}

export function removeFromQueue(clientId: string) {
  writeQueue(readQueue().filter((q) => q.client_id !== clientId));
}

export async function flushOfflineQueue(): Promise<{
  synced: number;
  failed: number;
}> {
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  const queue = readQueue();
  let synced = 0;
  let failed = 0;
  const remaining: QueuedDopePayload[] = [];

  for (const item of queue) {
    const { _queued_at, ...payload } = item;
    try {
      const res = await fetch("/api/dope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
      });
      if (res.ok) {
        synced++;
      } else if (res.status === 401) {
        remaining.push(item);
        failed++;
      } else {
        remaining.push(item);
        failed++;
      }
    } catch {
      remaining.push(item);
      failed++;
    }
  }

  writeQueue(remaining);
  return { synced, failed };
}

export function createClientId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
