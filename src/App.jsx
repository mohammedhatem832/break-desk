import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutDashboard, ListChecks, History, BarChart3, Users, LogOut,
  Menu, X, Coffee, Check, XCircle, AlertTriangle, Clock, Lock, User as UserIcon,
  Play, Square, ChevronRight, ShieldCheck, RefreshCw
} from "lucide-react";

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const C = {
  bg: "#121417",
  panel: "#1B1E23",
  panelAlt: "#20242A",
  border: "#2A2E35",
  borderSoft: "#23262C",
  text: "#EDEFF2",
  textMuted: "#8C929B",
  textFaint: "#5C616A",
  ok: "#3ED598",
  okDim: "#1F3D32",
  wait: "#F0A93B",
  waitDim: "#3D3320",
  alert: "#FF6259",
  alertDim: "#3D2422",
  accent: "#5B8CFF",
  accentDim: "#1E2A45",
};

const FONT_UI = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const FONT_MONO = "'JetBrains Mono', 'SF Mono', Consolas, monospace";

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------
const EMP_KEY = "ebms:employees";
const REQ_KEY = "ebms:requests";
const SESSION_KEY = "ebms:session";

// NOTE: This app was originally built against Claude.ai's artifact-only
// `window.storage` API, which does not exist outside claude.ai. These
// helpers reimplement the same async get/set contract on top of the
// browser's localStorage so the app works as a normal deployed website.
//
// Caveat: localStorage is per-browser/per-device, so "shared" data here
// is only shared across tabs on the same browser, not across different
// employees' devices in real life. For real multi-device sync (e.g. an
// employee requesting a break on their phone and an admin approving it
// on a different computer) you'll need a real backend/database — see
// the README for suggestions (Firebase, Supabase, etc).
async function loadShared(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

async function saveShared(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("storage set failed", key, e);
  }
}

async function hashPassword(pw) {
  try {
    const enc = new TextEncoder().encode(pw);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    // Fallback simple hash if subtle crypto unavailable
    let h = 0;
    for (let i = 0; i < pw.length; i++) { h = (h * 31 + pw.charCodeAt(i)) | 0; }
    return "fb" + h.toString(16);
  }
}

function uid(prefix) {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------
function fmtClock(dateObj) {
  return dateObj.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtDate(dateObj) {
  return dateObj.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
function fmtShortDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function dateKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function mmss(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
function minutesBetween(a, b) {
  return Math.round((b - a) / 60000);
}

// ---------------------------------------------------------------------------
// Small UI atoms
// ---------------------------------------------------------------------------
function Badge({ children, tone = "muted" }) {
  const tones = {
    ok: { bg: C.okDim, fg: C.ok },
    wait: { bg: C.waitDim, fg: C.wait },
    alert: { bg: C.alertDim, fg: C.alert },
    accent: { bg: C.accentDim, fg: C.accent },
    muted: { bg: C.panelAlt, fg: C.textMuted },
  };
  const t = tones[tone];
  return (
    <span
      style={{
        background: t.bg, color: t.fg, fontFamily: FONT_UI, fontWeight: 600,
        fontSize: 12, padding: "3px 10px", borderRadius: 20, letterSpacing: 0.2,
        display: "inline-flex", alignItems: "center", gap: 6,
      }}
    >
      {children}
    </span>
  );
}

function Card({ children, style, ...rest }) {
  return (
    <div
      style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

function Button({ children, onClick, variant = "primary", disabled, style, type = "button" }) {
  const variants = {
    primary: { background: C.accent, color: "#0C1220", border: "none" },
    ghost: { background: "transparent", color: C.text, border: `1px solid ${C.border}` },
    ok: { background: C.ok, color: "#0C1220", border: "none" },
    alert: { background: C.alert, color: "#1A0705", border: "none" },
    subtle: { background: C.panelAlt, color: C.textMuted, border: `1px solid ${C.border}` },
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        fontFamily: FONT_UI, fontWeight: 600, fontSize: 13.5, padding: "9px 16px",
        borderRadius: 7, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1, transition: "opacity .15s, transform .1s",
        ...variants[variant], ...style,
      }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = "scale(0.98)"; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      {children}
    </button>
  );
}

function Input({ label, icon: Icon, ...props }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, color: C.textMuted, fontFamily: FONT_UI, fontWeight: 600, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ position: "relative" }}>
        {Icon && <Icon size={15} color={C.textFaint} style={{ position: "absolute", left: 12, top: 12 }} />}
        <input
          {...props}
          style={{
            width: "100%", boxSizing: "border-box", background: C.panelAlt, border: `1px solid ${C.border}`,
            borderRadius: 7, color: C.text, fontFamily: FONT_UI, fontSize: 14, padding: Icon ? "10px 12px 10px 34px" : "10px 12px",
            outline: "none",
          }}
        />
      </div>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Timer computation for a break request
// ---------------------------------------------------------------------------
function computeTimer(req, now) {
  if (!req || req.status !== "approved") return null;
  const elapsedSec = (now - req.breakStartTime) / 1000;
  const allowedSec = req.requestedMinutes * 60;
  const remaining = allowedSec - elapsedSec;
  if (remaining > 0) {
    return { phase: "break", remaining, overtime: 0 };
  }
  return { phase: "overtime", remaining: 0, overtime: -remaining };
}

// ---------------------------------------------------------------------------
// Root App
// ---------------------------------------------------------------------------
export default function BreakManagementApp() {
  const [ready, setReady] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [requests, setRequests] = useState([]);
  const [currentUser, setCurrentUser] = useState(null); // {id, name, role}
  const [authMode, setAuthMode] = useState("login"); // login | register
  const [authError, setAuthError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [view, setView] = useState("dashboard");
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState(null);

  const requestsRef = useRef(requests);
  requestsRef.current = requests;

  // ---- initial load + seed admin -----------------------------------------
  useEffect(() => {
    (async () => {
      let emps = await loadShared(EMP_KEY, null);
      if (!emps) {
        const adminHash = await hashPassword("admin123");
        emps = [{ id: "admin_001", name: "admin", passwordHash: adminHash, role: "admin", createdAt: Date.now() }];
        await saveShared(EMP_KEY, emps);
      }
      const reqs = await loadShared(REQ_KEY, []);
      setEmployees(emps);
      setRequests(reqs);
      const savedSession = await loadShared(SESSION_KEY, null);
      if (savedSession?.id) {
        const savedEmployee = emps.find((emp) => emp.id === savedSession.id);
        if (savedEmployee) {
          setCurrentUser({ id: savedEmployee.id, name: savedEmployee.name, role: savedEmployee.role });
          setView(savedEmployee.role === "admin" ? "overview" : "dashboard");
        } else {
          await saveShared(SESSION_KEY, null);
        }
      }
      setReady(true);
    })();
  }, []);

  // ---- polling refresh (simulates real-time / multi-device sync) --------
  useEffect(() => {
    const poll = setInterval(async () => {
      const emps = await loadShared(EMP_KEY, null);
      const reqs = await loadShared(REQ_KEY, null);
      if (emps) setEmployees(emps);
      if (reqs) setRequests(reqs);
    }, 3500);
    return () => clearInterval(poll);
  }, []);

  // ---- 1s clock tick -------------------------------------------------------
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const persistRequests = useCallback(async (next) => {
    setRequests(next);
    await saveShared(REQ_KEY, next);
  }, []);

  const persistEmployees = useCallback(async (next) => {
    setEmployees(next);
    await saveShared(EMP_KEY, next);
  }, []);

  // ---- auth actions --------------------------------------------------------
  async function handleRegister(name, password) {
    setAuthError("");
    name = name.trim();
    if (!name || !password) { setAuthError("Enter a name and password."); return; }
    if (employees.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
      setAuthError("That name is already taken."); return;
    }
    const passwordHash = await hashPassword(password);
    const emp = { id: uid("emp"), name, passwordHash, role: "employee", createdAt: Date.now() };
    const next = [...employees, emp];
    await persistEmployees(next);
    const session = { id: emp.id, name: emp.name, role: "employee" };
    await saveShared(SESSION_KEY, session);
    setCurrentUser(session);
    setView("dashboard");
  }

  async function handleLogin(name, password) {
    setAuthError("");
    const emp = employees.find((e) => e.name.toLowerCase() === name.trim().toLowerCase());
    if (!emp) { setAuthError("No account found with that name."); return; }
    const hash = await hashPassword(password);
    if (hash !== emp.passwordHash) { setAuthError("Incorrect password."); return; }
    const session = { id: emp.id, name: emp.name, role: emp.role };
    await saveShared(SESSION_KEY, session);
    setCurrentUser(session);
    setView(emp.role === "admin" ? "overview" : "dashboard");
  }

  async function handleLogout() {
    await saveShared(SESSION_KEY, null);
    setCurrentUser(null);
    setAuthMode("login");
  }

  // ---- break actions ---------------------------------------------------
  async function requestBreak(minutes) {
    const nowTs = Date.now();
    const req = {
      id: uid("req"), employeeId: currentUser.id, employeeName: currentUser.name,
      requestedMinutes: minutes, requestTime: nowTs, status: "waiting",
      approvedBy: null, approvalTime: null, breakStartTime: null, breakEndTime: null,
      actualDuration: null, overtimeDuration: null, acknowledged: false,
    };
    await persistRequests([...requestsRef.current, req]);
    setToast({ tone: "accent", text: `Break request sent — ${minutes} min` });
  }

  async function approveRequest(reqId) {
    const nowTs = Date.now();
    const next = requestsRef.current.map((r) =>
      r.id === reqId ? { ...r, status: "approved", approvedBy: currentUser.name, approvalTime: nowTs, breakStartTime: nowTs } : r
    );
    await persistRequests(next);
    setToast({ tone: "ok", text: "Break approved" });
  }

  async function rejectRequest(reqId) {
    const next = requestsRef.current.map((r) =>
      r.id === reqId ? { ...r, status: "rejected" } : r
    );
    await persistRequests(next);
    setToast({ tone: "alert", text: "Break rejected" });
  }

  async function acknowledgeRejection(reqId) {
    const next = requestsRef.current.map((r) => (r.id === reqId ? { ...r, acknowledged: true } : r));
    await persistRequests(next);
  }

  async function endBreak(reqId) {
    const nowTs = Date.now();
    const next = requestsRef.current.map((r) => {
      if (r.id !== reqId) return r;
      const actual = minutesBetween(r.breakStartTime, nowTs);
      const overtime = Math.max(0, actual - r.requestedMinutes);
      return { ...r, status: "completed", breakEndTime: nowTs, actualDuration: actual, overtimeDuration: overtime };
    });
    await persistRequests(next);
    setToast({ tone: "ok", text: "Break ended — logged to history" });
  }

  // -------------------------------------------------------------------------
  if (!ready) {
    return (
      <div style={{ minHeight: 480, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_UI, color: C.textMuted }}>
        <RefreshCw size={18} className="spin" style={{ marginRight: 8 }} /> Loading…
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthScreen
        mode={authMode} setMode={setAuthMode} onLogin={handleLogin} onRegister={handleRegister}
        error={authError} clearError={() => setAuthError("")}
      />
    );
  }

  const myRequests = requests.filter((r) => r.employeeId === currentUser.id);
  const myActive = myRequests.find((r) => r.status === "waiting" || r.status === "approved");
  const myLatestRejected = [...myRequests].reverse().find((r) => r.status === "rejected" && !r.acknowledged);

  const navItems = currentUser.role === "admin"
    ? [
        { id: "overview", label: "Overview", icon: LayoutDashboard },
        { id: "waiting", label: "Waiting List", icon: ListChecks },
        { id: "active", label: "Active Breaks", icon: Coffee },
        { id: "employees", label: "Employees", icon: Users },
        { id: "stats30", label: "30-Day Stats", icon: BarChart3 },
      ]
    : [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "history", label: "My History", icon: History },
      ];

  return (
    <div style={{ fontFamily: FONT_UI, background: C.bg, color: C.text, minHeight: 600, display: "flex", borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}` }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        table { border-collapse: collapse; width: 100%; }
        th, td { text-align: left; padding: 10px 12px; font-size: 13px; }
        tbody tr:hover { background: ${C.panelAlt}; }
        input::placeholder { color: ${C.textFaint}; }
      `}</style>

      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? 226 : 64, transition: "width .18s ease", background: C.panel,
        borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 16px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: C.accentDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Coffee size={16} color={C.accent} />
          </div>
          {sidebarOpen && <div style={{ fontWeight: 800, fontSize: 14.5, letterSpacing: -0.2 }}>BreakDesk</div>}
          <button onClick={() => setSidebarOpen((v) => !v)} style={{ marginLeft: "auto", background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 4 }}>
            <Menu size={16} />
          </button>
        </div>

        <div style={{ padding: "14px 10px", flex: 1 }}>
          {navItems.map((item) => {
            const active = view === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setView(item.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 8,
                  cursor: "pointer", marginBottom: 3, color: active ? C.text : C.textMuted,
                  background: active ? C.panelAlt : "transparent", fontSize: 13.5, fontWeight: active ? 600 : 500,
                }}
              >
                <item.icon size={16} color={active ? C.accent : C.textFaint} style={{ flexShrink: 0 }} />
                {sidebarOpen && <span>{item.label}</span>}
                {active && sidebarOpen && <ChevronRight size={13} style={{ marginLeft: "auto" }} color={C.textFaint} />}
              </div>
            );
          })}
        </div>

        <div style={{ padding: 12, borderTop: `1px solid ${C.border}` }}>
          <div
            onClick={handleLogout}
            style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 8, cursor: "pointer", color: C.textMuted, fontSize: 13.5, fontWeight: 500 }}
          >
            <LogOut size={16} color={C.textFaint} />
            {sidebarOpen && <span>Log out</span>}
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {currentUser.role === "admin" ? "Admin control room" : `Hi, ${currentUser.name}`}
            </div>
            <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2 }}>{fmtDate(new Date(now))}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 15, color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>
              {fmtClock(new Date(now))}
            </div>
            <Badge tone={currentUser.role === "admin" ? "accent" : "muted"}>
              {currentUser.role === "admin" ? <ShieldCheck size={12} /> : <UserIcon size={12} />}
              {currentUser.role === "admin" ? "Admin" : "Employee"}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 24, flex: 1, overflow: "auto" }}>
          {currentUser.role === "employee" && view === "dashboard" && (
            <EmployeeDashboard
              user={currentUser} activeReq={myActive} now={now} onRequestBreak={requestBreak}
              onEndBreak={endBreak} myRequests={myRequests} rejected={myLatestRejected}
              onAckRejected={acknowledgeRejection}
            />
          )}
          {currentUser.role === "employee" && view === "history" && (
            <EmployeeHistory myRequests={myRequests} />
          )}
          {currentUser.role === "admin" && view === "overview" && (
            <AdminOverview requests={requests} employees={employees} now={now} onApprove={approveRequest} onReject={rejectRequest} />
          )}
          {currentUser.role === "admin" && view === "waiting" && (
            <AdminWaitingList requests={requests} now={now} onApprove={approveRequest} onReject={rejectRequest} />
          )}
          {currentUser.role === "admin" && view === "active" && (
            <AdminActiveBreaks requests={requests} now={now} />
          )}
          {currentUser.role === "admin" && view === "employees" && (
            <AdminEmployees employees={employees} requests={requests} now={now} />
          )}
          {currentUser.role === "admin" && view === "stats30" && (
            <Admin30Day employees={employees} requests={requests} />
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, background: C.panel, border: `1px solid ${C.border}`,
          borderLeft: `3px solid ${toast.tone === "ok" ? C.ok : toast.tone === "alert" ? C.alert : C.accent}`,
          borderRadius: 8, padding: "12px 16px", fontSize: 13.5, color: C.text, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}>
          {toast.text}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auth Screen
// ---------------------------------------------------------------------------
function AuthScreen({ mode, setMode, onLogin, onRegister, error, clearError }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    if (mode === "login") await onLogin(name, password);
    else await onRegister(name, password);
    setBusy(false);
  }

  return (
    <div style={{
      fontFamily: FONT_UI, minHeight: 560, background: C.bg, color: C.text, display: "flex",
      alignItems: "center", justifyContent: "center", borderRadius: 12, border: `1px solid ${C.border}`, padding: 24,
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');`}</style>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28, justifyContent: "center" }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: C.accentDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Coffee size={18} color={C.accent} />
          </div>
          <div style={{ fontWeight: 800, fontSize: 19, letterSpacing: -0.3 }}>BreakDesk</div>
        </div>

        <Card style={{ padding: 26 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 20, background: C.panelAlt, padding: 3, borderRadius: 8 }}>
            {["login", "register"].map((m) => (
              <div
                key={m}
                onClick={() => { setMode(m); clearError(); }}
                style={{
                  flex: 1, textAlign: "center", padding: "8px 0", borderRadius: 6, cursor: "pointer",
                  fontSize: 13, fontWeight: 600, background: mode === m ? C.panel : "transparent",
                  color: mode === m ? C.text : C.textMuted,
                }}
              >
                {m === "login" ? "Log in" : "Create account"}
              </div>
            ))}
          </div>

          <form onSubmit={submit}>
            <Input label="Employee name" icon={UserIcon} placeholder="e.g. Ahmed" value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" />
            <Input label="Password" icon={Lock} type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />

            {error && (
              <div style={{ background: C.alertDim, color: C.alert, fontSize: 12.5, padding: "8px 12px", borderRadius: 6, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={13} /> {error}
              </div>
            )}

            <Button type="submit" style={{ width: "100%" }} disabled={busy}>
              {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
            </Button>
          </form>

          <div style={{ marginTop: 16, fontSize: 11.5, color: C.textFaint, lineHeight: 1.5 }}>
            Admin access: sign in with name <span style={{ color: C.textMuted, fontFamily: FONT_MONO }}>admin</span> and password{" "}
            <span style={{ color: C.textMuted, fontFamily: FONT_MONO }}>admin123</span>.
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Employee Dashboard
// ---------------------------------------------------------------------------
function EmployeeDashboard({ user, activeReq, now, onRequestBreak, onEndBreak, myRequests, rejected, onAckRejected }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const timer = computeTimer(activeReq, now);

  const todayKey = dateKey(now);
  const todaysCompleted = myRequests.filter((r) => r.status === "completed" && dateKey(r.breakEndTime) === todayKey);
  const todayRequested = todaysCompleted.reduce((s, r) => s + r.requestedMinutes, 0);
  const todayActual = todaysCompleted.reduce((s, r) => s + r.actualDuration, 0);
  const todayOvertime = todaysCompleted.reduce((s, r) => s + r.overtimeDuration, 0);

  let statusLabel = "Working";
  let statusTone = "ok";
  if (activeReq?.status === "waiting") { statusLabel = "Break Requested"; statusTone = "wait"; }
  else if (activeReq?.status === "approved" && timer?.phase === "break") { statusLabel = "On Break"; statusTone = "accent"; }
  else if (activeReq?.status === "approved" && timer?.phase === "overtime") { statusLabel = "Overtime"; statusTone = "alert"; }

  return (
    <div>
      {rejected && (
        <Card style={{ padding: "12px 16px", marginBottom: 18, borderLeft: `3px solid ${C.alert}`, display: "flex", alignItems: "center", gap: 10 }}>
          <XCircle size={16} color={C.alert} />
          <div style={{ fontSize: 13.5, flex: 1 }}>
            Your {rejected.requestedMinutes}-minute break request was rejected.
          </div>
          <Button variant="subtle" onClick={() => onAckRejected(rejected.id)}>Dismiss</Button>
        </Card>
      )}

      {/* Hero: status + timer */}
      <Card style={{ padding: 28, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 20 }}>
          <div>
            <Badge tone={statusTone}>
              {statusTone === "ok" && <Check size={12} />}
              {statusTone === "wait" && <Clock size={12} />}
              {statusTone === "alert" && <AlertTriangle size={12} />}
              Status: {statusLabel}
            </Badge>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 14, letterSpacing: -0.4 }}>
              {user.name}
            </div>
            <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
              {activeReq ? `Requested duration: ${activeReq.requestedMinutes} minutes` : "No break in progress"}
            </div>
          </div>

          {timer && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11.5, color: C.textMuted, fontWeight: 600, marginBottom: 4 }}>
                {timer.phase === "break" ? "TIME REMAINING" : "OVERTIME"}
              </div>
              <div style={{
                fontFamily: FONT_MONO, fontSize: 44, fontWeight: 700, lineHeight: 1,
                color: timer.phase === "break" ? C.text : C.alert, fontVariantNumeric: "tabular-nums",
              }}>
                {timer.phase === "break" ? mmss(timer.remaining) : mmss(timer.overtime)}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 24, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {!activeReq && !pickerOpen && (
            <Button onClick={() => setPickerOpen(true)}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Coffee size={15} /> Request Break</span>
            </Button>
          )}
          {!activeReq && pickerOpen && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: C.textMuted, marginRight: 4 }}>Choose duration:</span>
              <Button variant="ghost" onClick={() => { onRequestBreak(20); setPickerOpen(false); }}>20 minutes</Button>
              <Button variant="ghost" onClick={() => { onRequestBreak(30); setPickerOpen(false); }}>30 minutes</Button>
              <Button variant="subtle" onClick={() => setPickerOpen(false)}>Cancel</Button>
            </div>
          )}
          {activeReq?.status === "waiting" && (
            <div style={{ fontSize: 13, color: C.wait, display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={14} /> Waiting for admin approval…
            </div>
          )}
          {activeReq?.status === "approved" && (
            <Button variant={timer?.phase === "overtime" ? "alert" : "ok"} onClick={() => onEndBreak(activeReq.id)}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Square size={14} /> End Break</span>
            </Button>
          )}
        </div>
      </Card>

      {/* Today's stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        <StatCard label="Breaks Today" value={todaysCompleted.length} />
        <StatCard label="Requested" value={`${todayRequested} min`} />
        <StatCard label="Actual" value={`${todayActual} min`} />
        <StatCard label="Overtime" value={`${todayOvertime} min`} alert={todayOvertime > 0} />
      </div>
    </div>
  );
}

function StatCard({ label, value, alert }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 11.5, color: C.textMuted, fontWeight: 600, marginBottom: 8 }}>{label.toUpperCase()}</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 24, fontWeight: 700, color: alert ? C.alert : C.text }}>{value}</div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Employee History (daily + 30-day)
// ---------------------------------------------------------------------------
function EmployeeHistory({ myRequests }) {
  const completed = [...myRequests].filter((r) => r.status === "completed").sort((a, b) => b.breakEndTime - a.breakEndTime);
  const days = last30Days();
  const byDay = groupByDay(completed, days);
  const total30Overtime = byDay.reduce((s, d) => s + d.overtime, 0);

  return (
    <div>
      <SectionTitle title="30-day overtime" sub={`Total overtime in the last 30 days: ${total30Overtime} min`} />
      <Card style={{ padding: 0, marginBottom: 24, overflow: "hidden" }}>
        <table>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.textMuted }}>
              <th>Date</th><th>Break Time</th><th>Overtime</th>
            </tr>
          </thead>
          <tbody>
            {byDay.filter((d) => d.count > 0).length === 0 && (
              <tr><td colSpan={3} style={{ color: C.textFaint, padding: 18 }}>No completed breaks yet.</td></tr>
            )}
            {byDay.filter((d) => d.count > 0).map((d) => (
              <tr key={d.key} style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                <td>{d.label}</td>
                <td style={{ fontFamily: FONT_MONO }}>{d.actual} min</td>
                <td style={{ fontFamily: FONT_MONO, color: d.overtime > 0 ? C.alert : C.textMuted }}>{d.overtime} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <SectionTitle title="Break history" />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.textMuted }}>
              <th>Date</th><th>Requested</th><th>Actual</th><th>Overtime</th>
            </tr>
          </thead>
          <tbody>
            {completed.length === 0 && (
              <tr><td colSpan={4} style={{ color: C.textFaint, padding: 18 }}>Nothing here yet — your finished breaks will show up in this table.</td></tr>
            )}
            {completed.map((r) => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                <td>{fmtShortDate(r.breakEndTime)}</td>
                <td>{r.requestedMinutes} min</td>
                <td>{r.actualDuration} min</td>
                <td style={{ color: r.overtimeDuration > 0 ? C.alert : C.textMuted }}>{r.overtimeDuration} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function SectionTitle({ title, sub }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
      {sub && <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function last30Days() {
  const arr = [];
  const nowD = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(nowD);
    d.setDate(d.getDate() - i);
    arr.push(d.getTime());
  }
  return arr;
}

function groupByDay(completedRequests, dayTimestamps) {
  return dayTimestamps.map((ts) => {
    const key = dateKey(ts);
    const matches = completedRequests.filter((r) => dateKey(r.breakEndTime) === key);
    return {
      key, label: fmtShortDate(ts),
      count: matches.length,
      actual: matches.reduce((s, r) => s + r.actualDuration, 0),
      overtime: matches.reduce((s, r) => s + r.overtimeDuration, 0),
    };
  });
}

// ---------------------------------------------------------------------------
// Admin: Overview
// ---------------------------------------------------------------------------
function AdminOverview({ requests, employees, now, onApprove, onReject }) {
  const waiting = requests.filter((r) => r.status === "waiting");
  const active = requests.filter((r) => r.status === "approved");
  const overtimeCount = active.filter((r) => computeTimer(r, now)?.phase === "overtime").length;
  const empCount = employees.filter((e) => e.role !== "admin").length;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard label="Employees" value={empCount} />
        <StatCard label="Waiting for approval" value={waiting.length} />
        <StatCard label="On break" value={active.length} />
        <StatCard label="In overtime" value={overtimeCount} alert={overtimeCount > 0} />
      </div>

      <SectionTitle title="Active breaks" sub="Live view of who's on break right now" />
      <ActiveBreaksTable requests={active} now={now} style={{ marginBottom: 24 }} />

      <SectionTitle title="Break requests" sub="Approve or reject without leaving this page" />
      <WaitingTable requests={waiting} onApprove={onApprove} onReject={onReject} />
    </div>
  );
}

function AdminWaitingList({ requests, now, onApprove, onReject }) {
  const waiting = requests.filter((r) => r.status === "waiting");
  return (
    <div>
      <SectionTitle title="Break waiting list" sub={`${waiting.length} pending request${waiting.length === 1 ? "" : "s"}`} />
      <WaitingTable requests={waiting} onApprove={onApprove} onReject={onReject} />
    </div>
  );
}

function WaitingTable({ requests, onApprove, onReject }) {
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <table>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.textMuted }}>
            <th>Employee</th><th>Duration</th><th>Requested at</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {requests.length === 0 && (
            <tr><td colSpan={5} style={{ color: C.textFaint, padding: 18 }}>No one is waiting for approval.</td></tr>
          )}
          {requests.map((r) => (
            <tr key={r.id} style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
              <td style={{ fontWeight: 600 }}>{r.employeeName}</td>
              <td>{r.requestedMinutes} min</td>
              <td style={{ color: C.textMuted }}>{new Date(r.requestTime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</td>
              <td><Badge tone="wait"><Clock size={11} />Waiting for approval</Badge></td>
              <td>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="ok" onClick={() => onApprove(r.id)} style={{ padding: "6px 12px" }}><Check size={13} /></Button>
                  <Button variant="alert" onClick={() => onReject(r.id)} style={{ padding: "6px 12px" }}><XCircle size={13} /></Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function AdminActiveBreaks({ requests, now }) {
  const active = requests.filter((r) => r.status === "approved");
  return (
    <div>
      <SectionTitle title="Active breaks" sub="Remaining time and overtime, calculated from the stored start time" />
      <ActiveBreaksTable requests={active} now={now} />
    </div>
  );
}

function ActiveBreaksTable({ requests, now, style }) {
  return (
    <Card style={{ padding: 0, overflow: "hidden", ...style }}>
      <table>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.textMuted }}>
            <th>Employee</th><th>Break</th><th>Remaining</th><th>Overtime</th>
          </tr>
        </thead>
        <tbody>
          {requests.length === 0 && (
            <tr><td colSpan={4} style={{ color: C.textFaint, padding: 18 }}>Nobody is on break right now.</td></tr>
          )}
          {requests.map((r) => {
            const t = computeTimer(r, now);
            return (
              <tr key={r.id} style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                <td style={{ fontWeight: 600 }}>{r.employeeName}</td>
                <td>{r.requestedMinutes} min</td>
                <td style={{ fontFamily: FONT_MONO, color: t.phase === "break" ? C.text : C.textFaint }}>
                  {t.phase === "break" ? mmss(t.remaining) : "00:00"}
                </td>
                <td style={{ fontFamily: FONT_MONO, color: t.phase === "overtime" ? C.alert : C.textFaint }}>
                  {t.phase === "overtime" ? mmss(t.overtime) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function AdminEmployees({ employees, requests, now }) {
  const emps = employees.filter((e) => e.role !== "admin");
  return (
    <div>
      <SectionTitle title="Employees" sub={`${emps.length} account${emps.length === 1 ? "" : "s"}`} />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.textMuted }}>
              <th>Name</th><th>Account created</th><th>Current status</th>
            </tr>
          </thead>
          <tbody>
            {emps.length === 0 && (
              <tr><td colSpan={3} style={{ color: C.textFaint, padding: 18 }}>No employee accounts yet.</td></tr>
            )}
            {emps.map((e) => {
              const active = requests.find((r) => r.employeeId === e.id && (r.status === "waiting" || r.status === "approved"));
              const t = computeTimer(active, now);
              let label = "Working", tone = "ok";
              if (active?.status === "waiting") { label = "Break Requested"; tone = "wait"; }
              else if (t?.phase === "break") { label = "On Break"; tone = "accent"; }
              else if (t?.phase === "overtime") { label = "Overtime"; tone = "alert"; }
              return (
                <tr key={e.id} style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                  <td style={{ fontWeight: 600 }}>{e.name}</td>
                  <td style={{ color: C.textMuted }}>{new Date(e.createdAt).toLocaleDateString()}</td>
                  <td><Badge tone={tone}>{label}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Admin30Day({ employees, requests }) {
  const emps = employees.filter((e) => e.role !== "admin");
  const days = last30Days();

  const rows = emps.map((e) => {
    const completed = requests.filter((r) => r.employeeId === e.id && r.status === "completed");
    const byDay = groupByDay(completed, days);
    const totalOvertime = byDay.reduce((s, d) => s + d.overtime, 0);
    const totalActual = byDay.reduce((s, d) => s + d.actual, 0);
    const totalBreaks = completed.length;
    return { name: e.name, totalOvertime, totalActual, totalBreaks };
  }).sort((a, b) => b.totalOvertime - a.totalOvertime);

  return (
    <div>
      <SectionTitle title="30-day statistics" sub="Overtime accumulated by each employee over the last 30 days" />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.textMuted }}>
              <th>Employee</th><th>Breaks</th><th>Total break time</th><th>Total overtime</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4} style={{ color: C.textFaint, padding: 18 }}>No data yet.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.name} style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                <td style={{ fontWeight: 600 }}>{r.name}</td>
                <td>{r.totalBreaks}</td>
                <td style={{ fontFamily: FONT_MONO }}>{r.totalActual} min</td>
                <td style={{ fontFamily: FONT_MONO, color: r.totalOvertime > 0 ? C.alert : C.textMuted }}>{r.totalOvertime} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
