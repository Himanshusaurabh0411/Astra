"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, CloudSun, Landmark, LockKeyhole, LogOut, Mail, Radio, RefreshCw, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import SosEmailStatus from "@/components/SosEmailStatus";
import WorkspaceFrame from "@/components/WorkspaceFrame";
import { friendlyNeed } from "@/lib/briefing";
import { type PortalProvenance, type SOSEmailNotice, type SOSPacket } from "@/lib/terrapulseClient";
import { updateTime, WorkspaceError, workspaceErrorMessage, workspaceRequest } from "@/lib/workspaceApi";

interface Officer { email: string; agency: string }
interface Session { configured: boolean; officer: Officer | null }
interface Overview {
  requests: SOSPacket[];
  sources: Record<string, PortalProvenance>;
  mode: string;
  email?: { mode: "off" | "manual" | "automatic"; recipient: string | null; notices: Record<string, SOSEmailNotice> };
}

const severityOrder = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3 };
const sourceLabels = { live_portal: "Live portal", local_sample: "Local sample", seed_fallback: "Exercise data" };

export default function GovernmentPortal() {
  const [officer, setOfficer] = useState<Officer | null | undefined>();
  const [configured, setConfigured] = useState(true);
  const [overview, setOverview] = useState<Overview>();
  const [checkingSession, setCheckingSession] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [confirm, setConfirm] = useState<string>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void workspaceRequest<Session>("/api/government/session", { signal: controller.signal })
      .then((session) => { setOfficer(session.officer); setConfigured(session.configured); })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(workspaceErrorMessage(reason, "Could not connect to the Government Portal."));
      });
    return () => controller.abort();
  }, [checkingSession]);

  useEffect(() => {
    if (!officer) return;
    const controller = new AbortController();
    setFetching(true);
    void workspaceRequest<Overview>("/api/government/overview", { signal: controller.signal })
      .then(setOverview)
      .catch((reason) => {
        if (controller.signal.aborted) return;
        if (reason instanceof WorkspaceError && reason.status === 401) {
          setOverview(undefined);
          setOfficer(null);
        }
        setError(workspaceErrorMessage(reason, "Could not refresh the response queue."));
      })
      .finally(() => { if (!controller.signal.aborted) setFetching(false); });
    return () => controller.abort();
  }, [officer, refresh]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setError("");
    try {
      setOfficer(await workspaceRequest<Officer>("/api/government/login", {
        method: "POST", body: JSON.stringify({ email: String(fields.get("email") ?? "").trim(), password: fields.get("password") }),
      }));
      form.reset();
    } catch (reason) {
      setError(workspaceErrorMessage(reason, "Could not sign in. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError("");
    try {
      await workspaceRequest<void>("/api/government/logout", { method: "POST" });
      setOfficer(null);
      setOverview(undefined);
      setConfirm(undefined);
      setNotice("");
    } catch (reason) {
      setError(workspaceErrorMessage(reason, "Could not sign out. Try again when you are connected."));
    } finally {
      setBusy(false);
    }
  }

  async function resolve(id: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await workspaceRequest(`/api/sos/${encodeURIComponent(id)}/resolve`, { method: "POST" });
      setOverview((current) => current && { ...current, requests: current.requests.filter(({ sos_id }) => sos_id !== id) });
      setConfirm(undefined);
      setNotice("Exercise request marked resolved.");
    } catch (reason) {
      if (reason instanceof WorkspaceError && reason.status === 401) {
        setOverview(undefined);
        setOfficer(null);
      }
      setError(workspaceErrorMessage(reason, "Could not resolve the request. Try again."));
    } finally {
      setBusy(false);
    }
  }

  const requests = [...(overview?.requests ?? [])].sort((a, b) =>
    severityOrder[a.triage.severity] - severityOrder[b.triage.severity] || b.timestamp.localeCompare(a.timestamp));
  return <WorkspaceFrame active="government">
    {!officer ? <div className="tp-government-login-layout">
      <header className="tp-workspace-heading tp-government-heading">
        <div className="tp-workspace-eyebrow"><Landmark size={20} /> Agency access</div>
        <h1>Government Portal</h1>
        <p>Review SOS exercise requests, coordinate follow-up, and track which disaster data feeds are current.</p>
      </header>
      <section className="tp-card tp-government-login" aria-labelledby="government-signin">
        <span className="tp-workspace-icon"><LockKeyhole size={23} /></span>
        <h2 id="government-signin">Officer sign-in</h2>
        <p>Use the account issued by your TerraPulse administrator.</p>
        {officer === undefined ? <div className="tp-workspace-message" role={error ? "alert" : "status"}>
          {error ? <><p>{error}</p><button className="tp-button" type="button" onClick={() => { setError(""); setCheckingSession(checkingSession + 1); }}>Try again</button></>
            : "Checking portal access…"}</div> : !configured
          ? <p className="tp-workspace-cached" role="status">Government accounts have not been set up for this installation.</p>
          : <form onSubmit={(event) => void login(event)}>
            <label htmlFor="officer-email">Work email</label>
            <input id="officer-email" className="tp-workspace-input" name="email" type="email" autoComplete="username" required maxLength={254} />
            <label htmlFor="officer-password">Password</label>
            <input id="officer-password" className="tp-workspace-input" name="password" type="password" autoComplete="current-password" required maxLength={128} />
            {error && <p className="tp-workspace-inline-error" role="alert">{error}</p>}
            <button className="tp-button tp-workspace-primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"} <ArrowRight size={18} /></button>
          </form>}
      </section>
    </div> : <>
      <header className="tp-workspace-heading tp-government-heading tp-government-session">
        <div className="tp-workspace-eyebrow"><ShieldCheck size={19} /> Government Portal</div>
        <h1>{officer.agency}</h1>
        <p>{officer.email} · Exercise response queue</p>
        <div className="tp-workspace-actions">
          <a className="tp-button" href="/weather"><CloudSun size={17} /> View India Weather</a>
          <button className="tp-button" type="button" disabled={busy} onClick={() => void logout()}><LogOut size={16} /> Sign out</button>
        </div>
      </header>
      {error && <p className="tp-workspace-inline-error" role="alert">{error}</p>}
      {notice && <p className="tp-workspace-confirmed" role="status"><CheckCircle2 size={17} /> {notice}</p>}
      {overview?.email?.recipient && <section className="tp-card tp-exercise-inbox" aria-label="Exercise email routing">
        <Mail size={21} aria-hidden="true" /><div><h2>Exercise inbox</h2><p>{overview.email.recipient}</p></div>
        <span>{overview.email.mode === "automatic" ? "Automatic forwarding" : "Manual Gmail drafts"}</span>
      </section>}
      {overview && <dl className="tp-government-metrics">
        <div className="tp-card"><dt><Radio size={17} /> Open requests</dt><dd>{requests.length}</dd></div>
        <div className="tp-card"><dt><TriangleAlert size={17} /> Critical requests</dt><dd>{requests.filter(({ triage }) => triage.severity === "CRITICAL").length}</dd></div>
        <div className="tp-card"><dt><Users size={17} /> People in requests</dt><dd>{requests.reduce((sum, { triage }) => sum + triage.headcount, 0).toLocaleString("en-IN")}</dd></div>
      </dl>}
      <div className="tp-government-grid">
        <section className="tp-card tp-government-queue" aria-labelledby="government-queue">
          <div className="tp-workspace-panel-head"><div><h2 id="government-queue">Response queue</h2><p>Critical cases appear first.</p></div>
            <button type="button" className="tp-button" disabled={busy || fetching} onClick={() => { setError(""); setRefresh(refresh + 1); }}>
              <RefreshCw size={15} /> {fetching ? "Refreshing…" : "Refresh"}</button></div>
          {overview && requests.length === 0 && <p className="tp-workspace-message">No open exercise requests.</p>}
          {!overview && !error && <p className="tp-workspace-message" role="status">Loading the response queue…</p>}
          <ul className="tp-government-requests">{requests.map(({ sos_id, timestamp, triage, position }) => <li key={sos_id}>
            <div className="tp-government-request-title">
              <span className={`tp-severity tp-severity-${triage.severity.toLowerCase()}`}>{friendlyNeed(triage.severity)}</span>
              <strong>{triage.headcount.toLocaleString("en-IN")} {triage.headcount === 1 ? "person" : "people"}</strong>
            </div>
            <p>{triage.needs.map(friendlyNeed).join(" · ") || "Help requested"}</p>
            {triage.note && <blockquote>{triage.note}</blockquote>}
            <small>{sos_id} · {position.lat.toFixed(4)}° N, {position.lng.toFixed(4)}° E · {updateTime(timestamp)} IST</small>
            {overview?.email?.notices[sos_id] && <SosEmailStatus notice={overview.email.notices[sos_id]} />}
            {confirm === sos_id ? <div className="tp-government-confirm">
              <p>Close this exercise request?</p>
              <button className="tp-button tp-workspace-primary" type="button" disabled={busy} onClick={() => void resolve(sos_id)}>Confirm resolution</button>
              <button className="tp-button" type="button" disabled={busy} onClick={() => setConfirm(undefined)}>Cancel</button>
            </div> : <button className="tp-button" type="button" disabled={busy || fetching} onClick={() => setConfirm(sos_id)}>Mark resolved</button>}
          </li>)}</ul>
        </section>
        {overview && <section className="tp-card tp-government-sources" aria-labelledby="government-sources">
          <div className="tp-workspace-panel-head"><div><h2 id="government-sources">Map data sources</h2><p>Latest available feed for each portal.</p></div></div>
          <ul>{Object.entries(overview.sources).map(([name, source]) => <li key={name}>
            <div><strong>{name}</strong><span className={`tp-source-type tp-source-${source.source_type}`}>{sourceLabels[source.source_type]}</span></div>
            <small>{source.records_ingested.toLocaleString("en-IN")} records · {updateTime(source.last_synced_at)} IST</small>
          </li>)}</ul>
        </section>}
      </div>
    </>}
  </WorkspaceFrame>;
}
