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
  slot_order: number[];
  courage_bands?: number;
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

// ── Patrol Log ────────────────────────────────────────────────────────────────

export type BlockResult = "clean" | "accident_told" | "accident_silent";

export type PatrolLogDTO = {
  id: number;
  log_date: string;
  block_1: BlockResult;
  block_2: BlockResult;
  block_3: BlockResult;
  regular_stamps: number;
  courage_stamps: number;
  encounter_tier: string | null;
  pokemon_index: number | null;
  claimed: boolean;
  created_at: string;
};

export async function submitPatrolLog(payload: {
  log_date: string;
  block_1: BlockResult;
  block_2: BlockResult;
  block_3: BlockResult;
}): Promise<PatrolLogDTO> {
  const res = await fetch(`${getApiBase()}/api/patrol-log`, {
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

export async function redeemCourageBand(): Promise<CollectionStateDTO> {
  const res = await fetch(`${getApiBase()}/api/patrol-log/courage-redeem`, {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `兌換失敗：${res.status}`);
  }
  return res.json();
}

export async function claimPatrolEncounter(): Promise<CollectionStateDTO> {
  const res = await fetch(`${getApiBase()}/api/patrol-log/claim`, {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `領取失敗：${res.status}`);
  }
  return res.json();
}

export async function fetchTodayPatrolLog(): Promise<PatrolLogDTO | null> {
  const res = await fetch(`${getApiBase()}/api/patrol-log/today`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`載入今日巡邏失敗：${res.status}`);
  return res.json();
}

export async function fetchCourageTotal(): Promise<number> {
  const res = await fetch(`${getApiBase()}/api/patrol-log/courage-total`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`載入勇氣印章失敗：${res.status}`);
  const data = (await res.json()) as { total_courage: number };
  return data.total_courage;
}
