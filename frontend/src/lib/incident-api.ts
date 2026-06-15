// Client for the Flask Incident Resolution Recommender backend.
//
// The Lovable preview runs in the cloud — it cannot reach http://localhost:5000
// on your machine. Expose your Flask backend over the public internet
// (ngrok, cloudflared, or a deployed URL) and set the base URL via the
// "API settings" dialog. The value is persisted in localStorage.

const STORAGE_KEY = "incident_api_base_url";
const DEFAULT_BASE =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_INCIDENT_API_BASE_URL) ||
  "http://localhost:5000";

export function getApiBaseUrl(): string {
  if (typeof window === "undefined") return DEFAULT_BASE;
  return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_BASE;
}

export function setApiBaseUrl(url: string) {
  if (typeof window === "undefined") return;
  const trimmed = url.trim().replace(/\/+$/, "");
  if (trimmed) window.localStorage.setItem(STORAGE_KEY, trimmed);
  else window.localStorage.removeItem(STORAGE_KEY);
}

export interface IncidentDetails {
  number?: string;
  short_description?: string;
  description?: string;
  state?: string;
  priority?: string;
  urgency?: string;
  impact?: string;
  category?: string;
  subcategory?: string;
  assignment_group?: string;
  assigned_to?: string;
  opened_by?: string;
  opened_at?: string;
  resolved_by?: string;
  resolved_at?: string;
  closed_by?: string;
  close_notes?: string;
  close_code?: string;
  caller_id?: string;
  is_resolved?: boolean;
  [k: string]: unknown;
}

export interface ActivityItem {
  sys_id?: string;
  type?: "work_note" | "comment" | "attachment" | "field_change" | string;
  value?: string;
  text?: string;
  content?: string;
  field?: string;
  old_value?: string;
  new_value?: string;
  file_name?: string;
  content_type?: string;
  created_on?: string;
  created_by?: string;
  sys_created_on?: string;
  sys_created_by?: string;
}

export interface AnalysisResult {
  journals_summary?: string;
  audit_summary?: string;
  image_analysis?: string;
  recommended_resolution?: string;
}

export interface RecommendResponse {
  incident_number: string;
  incident_details: IncidentDetails;
  activity: ActivityItem[] | { activities: ActivityItem[] };
  is_resolved: boolean;
  analysis: AnalysisResult;
}

export async function recommendResolution(
  incidentNumber: string,
  signal?: AbortSignal,
): Promise<RecommendResponse> {
  const base = getApiBaseUrl();
  const url = `${base}/api/recommend_resolution`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ incident_number: incidentNumber }),
      signal,
    });
  } catch (err: any) {
    throw new Error(
      `Could not reach backend at ${base}. ` +
        `Make sure your Flask server is running and publicly reachable, then check the URL in API Settings. ` +
        `(${err?.message || "network error"})`,
    );
  }

  const text = await res.text();
  let payload: any = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: text };
  }

  if (!res.ok) {
    const msg = payload?.error || `Request failed with status ${res.status}`;
    throw new Error(msg);
  }
  return normalizeResponse(payload) as RecommendResponse;
}

// ServiceNow reference fields come back as { display_value, link } objects.
// Flatten them recursively so React can render them as strings.
function flatten(value: any): any {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(flatten);
  if (typeof value === "object") {
    if ("display_value" in value && ("link" in value || Object.keys(value).length <= 2)) {
      return (value as any).display_value ?? "";
    }
    const out: Record<string, any> = {};
    for (const k of Object.keys(value)) out[k] = flatten((value as any)[k]);
    return out;
  }
  return value;
}

function normalizeResponse(payload: any) {
  if (!payload || typeof payload !== "object") return payload;
  return {
    ...payload,
    incident_details: flatten(payload.incident_details),
    activity: flatten(payload.activity),
  };
}

export async function pingBackend(): Promise<boolean> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/api/health`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}
