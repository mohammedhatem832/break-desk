import { createClient } from "@supabase/supabase-js";

// These fallbacks make the static GitHub Pages build work without exposing a
// privileged key. Vite environment variables can still override them locally.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://wgefwqzksxjyrqcclojt.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_sQbQ19xBYOUdkPlVnqEchg_y96ukegV";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export const EMP_KEY = "ebms:employees";
export const REQ_KEY = "ebms:requests";
export const SESSION_KEY = "ebms:session";
export const MIGRATION_KEY = "ebms:supabase-migration-v1";
export const ADMIN_ID = "admin_001";
export const ADMIN_NAME = "Mohamed Hatem";
export const ADMIN_PASSWORD = "Mohamed642002";

function requireNoError(result, operation) {
  if (result.error) {
    throw new Error(`${operation}: ${result.error.message}`);
  }
  return result.data;
}

function asTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function employeeFromRow(row) {
  return {
    id: String(row.id),
    name: row.name,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: asTimestamp(row.created_at) || Date.now(),
  };
}

function employeeToRow(employee) {
  return {
    id: employee.id,
    name: employee.name,
    password_hash: employee.passwordHash,
    role: employee.role,
    created_at: employee.createdAt,
  };
}

function employeeChangesToRow(changes) {
  const row = {};
  if (Object.prototype.hasOwnProperty.call(changes, "name")) row.name = changes.name;
  if (Object.prototype.hasOwnProperty.call(changes, "passwordHash")) row.password_hash = changes.passwordHash;
  if (Object.prototype.hasOwnProperty.call(changes, "role")) row.role = changes.role;
  if (Object.prototype.hasOwnProperty.call(changes, "createdAt")) row.created_at = changes.createdAt;
  return row;
}

function requestFromRow(row) {
  return {
    id: String(row.id),
    employeeId: String(row.employee_id),
    employeeName: row.employee_name,
    requestedMinutes: Number(row.requested_minutes),
    requestTime: asTimestamp(row.request_time),
    status: row.status,
    approvedBy: row.approved_by,
    approvalTime: asTimestamp(row.approval_time),
    breakStartTime: asTimestamp(row.break_start_time),
    breakEndTime: asTimestamp(row.break_end_time),
    actualDuration: row.actual_duration === null ? null : Number(row.actual_duration),
    overtimeDuration: row.overtime_duration === null ? null : Number(row.overtime_duration),
    acknowledged: Boolean(row.acknowledged),
  };
}

function requestToRow(request) {
  return {
    id: request.id,
    employee_id: request.employeeId,
    employee_name: request.employeeName,
    requested_minutes: request.requestedMinutes,
    request_time: request.requestTime,
    status: request.status,
    approved_by: request.approvedBy,
    approval_time: request.approvalTime,
    break_start_time: request.breakStartTime,
    break_end_time: request.breakEndTime,
    actual_duration: request.actualDuration,
    overtime_duration: request.overtimeDuration,
    acknowledged: request.acknowledged,
  };
}

function readLegacyArray(key) {
  const raw = window.localStorage.getItem(key);
  if (raw === null) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`Expected an array in localStorage key "${key}".`);
    }
    return parsed;
  } catch (error) {
    throw new Error(`Could not read legacy data from localStorage key "${key}".`, { cause: error });
  }
}

export function loadSession() {
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error("Could not restore the saved session.", { cause: error });
  }
}

export function saveSession(session) {
  if (session === null) {
    window.localStorage.removeItem(SESSION_KEY);
  } else {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

export async function hashPassword(password) {
  const encoded = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function fetchEmployees() {
  const result = await supabase.from("employees").select("*").order("created_at", { ascending: true });
  return requireNoError(result, "Loading employees").map(employeeFromRow);
}

export async function fetchRequests() {
  const result = await supabase.from("break_requests").select("*").order("request_time", { ascending: true });
  return requireNoError(result, "Loading break requests").map(requestFromRow);
}

export async function insertEmployee(employee) {
  const result = await supabase.from("employees").insert(employeeToRow(employee)).select().single();
  return employeeFromRow(requireNoError(result, "Creating employee"));
}

async function upsertEmployee(employee) {
  const result = await supabase
    .from("employees")
    .upsert(employeeToRow(employee), { onConflict: "id" })
    .select()
    .single();
  return employeeFromRow(requireNoError(result, "Seeding admin employee"));
}

export async function updateEmployee(employeeId, changes) {
  const result = await supabase
    .from("employees")
    .update(employeeChangesToRow(changes))
    .eq("id", employeeId)
    .select()
    .single();
  return employeeFromRow(requireNoError(result, "Updating employee"));
}

export async function upsertEmployees(employees) {
  if (!employees.length) return;
  const result = await supabase.from("employees").upsert(employees.map(employeeToRow), { onConflict: "id" });
  requireNoError(result, "Migrating employees");
}

export async function deleteEmployee(employeeId) {
  const requestResult = await supabase.from("break_requests").delete().eq("employee_id", employeeId);
  requireNoError(requestResult, "Deleting employee break history");
  const employeeResult = await supabase.from("employees").delete().eq("id", employeeId);
  requireNoError(employeeResult, "Deleting employee");
}

export async function insertRequest(request) {
  const result = await supabase.from("break_requests").insert(requestToRow(request)).select().single();
  return requestFromRow(requireNoError(result, "Creating break request"));
}

export async function updateRequest(requestId, changes) {
  const result = await supabase
    .from("break_requests")
    .update(requestToRow({ ...changes, id: requestId }))
    .eq("id", requestId)
    .select()
    .single();
  return requestFromRow(requireNoError(result, "Updating break request"));
}

export async function upsertRequests(requests) {
  if (!requests.length) return;
  const result = await supabase.from("break_requests").upsert(requests.map(requestToRow), { onConflict: "id" });
  requireNoError(result, "Migrating break requests");
}

async function ensureAdmin(employees) {
  const existing = employees.find((employee) => employee.id === ADMIN_ID || employee.name.toLowerCase() === ADMIN_NAME.toLowerCase());
  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  if (!existing) {
    return upsertEmployee({
      id: ADMIN_ID,
      name: ADMIN_NAME,
      passwordHash,
      role: "admin",
      createdAt: Date.now(),
    });
  }

  if (existing.name !== ADMIN_NAME || existing.passwordHash !== passwordHash || existing.role !== "admin") {
    return updateEmployee(existing.id, {
      name: ADMIN_NAME,
      passwordHash,
      role: "admin",
      createdAt: existing.createdAt,
    });
  }
  return existing;
}

export async function initializeData() {
  let employees = await fetchEmployees();
  let requests = await fetchRequests();
  const migrated = window.localStorage.getItem(MIGRATION_KEY) === "complete";

  if (!migrated) {
    const legacyEmployees = readLegacyArray(EMP_KEY);
    const legacyRequests = readLegacyArray(REQ_KEY);
    await upsertEmployees(legacyEmployees);
    await upsertRequests(legacyRequests);
    window.localStorage.setItem(MIGRATION_KEY, "complete");
    employees = await fetchEmployees();
    requests = await fetchRequests();
  }

  const admin = await ensureAdmin(employees);
  if (!employees.some((employee) => employee.id === admin.id)) {
    employees = [...employees, admin];
  } else {
    employees = employees.map((employee) => employee.id === admin.id ? admin : employee);
  }
  return { employees, requests };
}
