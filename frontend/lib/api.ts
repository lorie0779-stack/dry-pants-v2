const DEFAULT_API = "http://localhost:8000";

export function getApiBase(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  return DEFAULT_API;
}

export type ErrorReasonDTO = {
  id: number;
  reason_text: string;
};

export type ErrorRecordDTO = {
  id: number;
  type: string;
  location: string;
  time_of_day: string;
  incident_date: string | null;
  reason_id: number;
  created_at: string;
};

export type ErrorCreatePayload = {
  type: string;
  location: string;
  time_of_day: string;
  incident_date?: string | null;
  reason: string;
};

export type ErrorRecordCreated = ErrorRecordDTO & { reason_text: string };

export async function fetchErrorReasons(): Promise<ErrorReasonDTO[]> {
  const res = await fetch(`${getApiBase()}/api/error-reasons`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`載入失誤原因失敗：${res.status}`);
  }
  return res.json();
}

export async function fetchErrorRecords(): Promise<ErrorRecordDTO[]> {
  const res = await fetch(`${getApiBase()}/api/errors`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`載入失誤紀錄失敗：${res.status}`);
  }
  return res.json();
}

export async function createErrorRecord(
  payload: ErrorCreatePayload,
): Promise<ErrorRecordCreated> {
  const res = await fetch(`${getApiBase()}/api/errors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `送出失敗：${res.status}`);
  }
  return res.json();
}

// ── Collection State ──────────────────────────────────────────────────────────

export type CollectionStateDTO = {
  energy: number;
  unlocked_count: number;
  coins: number;
};

export type HonorEntryDTO = {
  id: number;
  entry_time: string;
  entry_text: string;
};

export async function fetchCollectionState(): Promise<CollectionStateDTO> {
  const res = await fetch(`${getApiBase()}/api/collection-state`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`載入收集狀態失敗：${res.status}`);
  return res.json();
}

export async function saveCollectionState(
  state: CollectionStateDTO,
): Promise<void> {
  await fetch(`${getApiBase()}/api/collection-state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
}

export async function fetchHonorEntries(): Promise<HonorEntryDTO[]> {
  const res = await fetch(`${getApiBase()}/api/honor-entries`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`載入榮譽榜失敗：${res.status}`);
  return res.json();
}

export async function addHonorEntry(entry: {
  entry_time: string;
  entry_text: string;
}): Promise<HonorEntryDTO> {
  const res = await fetch(`${getApiBase()}/api/honor-entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error(`新增榮譽榜失敗：${res.status}`);
  return res.json();
}

export async function resetCollectionState(): Promise<void> {
  await fetch(`${getApiBase()}/api/collection-state/reset`, {
    method: "POST",
  });
}
