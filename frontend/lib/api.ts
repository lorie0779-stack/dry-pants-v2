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
