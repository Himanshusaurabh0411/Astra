"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Check, ChevronDown, CloudOff, Crosshair, Droplets, HeartPulse, Home, MapPin, Minus, Plus,
  Radio, Route, Satellite, ShieldCheck, Soup, TriangleAlert, Users, Wifi,
} from "lucide-react";
import Brand from "@/components/Brand";
import CommandMap, { type MapTarget } from "@/components/CommandMap";
import { formatNumber, friendlyNeed, timeOf } from "@/lib/briefing";
import { DEFAULT_LAYERS, LABELS } from "@/lib/layers";
import { getNavicFix, getQueuedOfflineSOS, saveNavicFix, type NavicFixData } from "@/lib/offlineStore";
import { distanceKm, getRegion, INDIA, INDIA_REGIONS, inBounds, nearestRegion, type Place, type Point } from "@/lib/regions";
import {
  compileLocalState, featurePoint, fetchState, routePair, submitSOSPacket, subscribeToTelemetry,
  syncQueuedSOS, type HazardSeverity, type SOSPacket,
} from "@/lib/terrapulseClient";

const NEEDS = [
  { value: "MEDICAL", label: "Medical", icon: HeartPulse },
  { value: "BOAT_RESCUE", label: "Boat rescue", icon: Route },
  { value: "WATER", label: "Water", icon: Droplets },
  { value: "FOOD", label: "Food", icon: Soup },
  { value: "SAFE_SHELTER", label: "Safe shelter", icon: ShieldCheck },
] as const;
const URGENCY = [
  { value: "CRITICAL", label: "Critical", description: "Immediate danger" },
  { value: "HIGH", label: "High", description: "Help needed soon" },
  { value: "MODERATE", label: "Moderate", description: "Safe for now" },
] as const;
const PLACES = INDIA_REGIONS.flatMap((region) => region.places.map((place) => ({ ...place, region })));
const FIELD_LAYERS = { ...DEFAULT_LAYERS, mosdac_rain: false, sos_mesh: false };

function presetFix(place: Place): NavicFixData {
  return { lat: place.center[1], lng: place.center[0], accuracy_m: 4.5, navic_band: "L5+S_PASSIVE",
    locked_at: new Date().toISOString(), is_simulated: true };
}

function shortId(): string {
  return [...crypto.getRandomValues(new Uint8Array(8))].map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase();
}

type Delivery = { kind: "queued" | "received"; message: string; time: string } | { kind: "error"; message: string };

export default function FieldResponder() {
  const [state, setState] = useState(compileLocalState);
  const [preset, setPreset] = useState(PLACES[0].name);
  const [fix, setFix] = useState<NavicFixData>();
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [offline, setOffline] = useState(false);
  const [ready, setReady] = useState(false);
  const [urgency, setUrgency] = useState<HazardSeverity>("HIGH");
  const [people, setPeople] = useState("1");
  const [needs, setNeeds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [queued, setQueued] = useState<SOSPacket[]>([]);
  const [delivery, setDelivery] = useState<Delivery>();
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const sendLock = useRef(false);
  const syncLock = useRef(false);

  const blackout = state.mode === "CELL_BLACKOUT_MESH_ACTIVE";
  const linked = state.connection === "api" && !offline && !blackout;

  const refresh = useCallback(async () => {
    if (syncLock.current) return;
    syncLock.current = true;
    try {
      setOffline(!navigator.onLine);
      const snapshot = await fetchState();
      setState(snapshot);
      const pending = await getQueuedOfflineSOS();
      setQueued(pending);
      if (pending.length && snapshot.connection === "api" && snapshot.mode !== "CELL_BLACKOUT_MESH_ACTIVE" && navigator.onLine) {
        setSyncing(true);
        const delivered = await syncQueuedSOS();
        setQueued(await getQueuedOfflineSOS());
        if (delivered.length) {
          setDelivery({ kind: "received", message: `${delivered.length} queued ${delivered.length === 1 ? "request synced" : "requests synced"} to TerraPulse.`,
            time: new Date().toISOString() });
        }
      }
    } catch {
      setDelivery({ kind: "error", message: "Sync is delayed. Saved help requests will retry when the connection returns." });
    } finally {
      setSyncing(false);
      syncLock.current = false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const requested = getRegion(new URLSearchParams(window.location.search).get("region"));
    const location = requested.places[0] && requested.id !== INDIA.id ? requested.places[0] : PLACES[0];
    setPreset(location.name);
    setFix(presetFix(location));
    if (requested.id === INDIA.id) void getNavicFix().then((cached) => {
      if (active && cached && inBounds([cached.lng, cached.lat], INDIA.bbox)) {
        setFix(cached);
        setPreset(PLACES.find((p) => p.center[0] === cached.lng && p.center[1] === cached.lat)?.name ?? "");
      }
    });

    void refresh();
    const unsubscribe = subscribeToTelemetry((event) => {
      if (event.event === "offline") setOffline(true);
      else void refresh();
    });

    const serviceWorker = "serviceWorker" in navigator ? navigator.serviceWorker : undefined;
    const prepared = (event: MessageEvent) => {
      if (event.data?.type === "OFFLINE_READY") setReady(true);
      if (event.data?.type === "SOS_SYNCED" && event.data.count > 0) {
        const count = Number(event.data.count);
        setDelivery({ kind: "received", message: `${count} queued ${count === 1 ? "request synced" : "requests synced"} to TerraPulse.`,
          time: new Date().toISOString() });
        void getQueuedOfflineSOS().then(setQueued);
      }
    };
    serviceWorker?.addEventListener("message", prepared);
    if (serviceWorker?.controller) setReady(true);
    void serviceWorker?.ready.then(() => { if (active) setReady(true); });
    return () => { active = false; unsubscribe(); serviceWorker?.removeEventListener("message", prepared); };
  }, [refresh]);

  const place = PLACES.find((item) => item.name === preset);
  const point = useMemo<Point>(() => fix ? [fix.lng, fix.lat] : PLACES[0].center, [fix]);
  const area = place?.region ?? nearestRegion(point);
  const pair = routePair(state, area.id, undefined, point);
  const dispatch = state.dispatches.filter((item) => distanceKm([item.safe_asset.lng, item.safe_asset.lat], point) <= 95)
    .sort((a, b) => Date.parse(b.issued_at) - Date.parse(a.issued_at))[0];
  const resources = state.features.features.filter((feature) =>
    feature.geometry.type === "Point" && ["SHELTER", "HOSPITAL", "SCHOOL", "GRAM_PANCHAYAT"].includes(feature.properties.asset_type ?? "")
    && distanceKm(featurePoint(feature), point) <= 60)
    .sort((a, b) => distanceKm(featurePoint(a), point) - distanceKm(featurePoint(b), point)).slice(0, 4);
  const localRoute = pair && distanceKm(featurePoint(pair.route), point) <= 95 ? pair : undefined;
  const mapTarget = useMemo<MapTarget>(() => ({
    center: point, zoom: 10, label: place?.name ?? "my location",
    bbox: [point[0] - .21, point[1] - .17, point[0] + .21, point[1] + .17],
  }), [point, place?.name]);

  function usePreset(value: string) {
    const next = PLACES.find((item) => item.name === value);
    if (!next) return;
    const current = presetFix(next);
    setPreset(value);
    setFix(current);
    setLocationMessage(`Using the ${next.name} exercise location.`);
    void saveNavicFix(current);
  }

  function locate() {
    if (!navigator.geolocation) {
      setLocationMessage("Device location is unavailable. Choose an exercise location below.");
      return;
    }
    setLocating(true);
    setLocationMessage("");
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setLocating(false);
      if (!inBounds([coords.longitude, coords.latitude], INDIA.bbox)) {
        setLocationMessage("The device is outside the India map area. Choose an exercise location below.");
        return;
      }
      const location = {
        lat: coords.latitude, lng: coords.longitude, accuracy_m: Math.max(1, coords.accuracy),
        navic_band: "DEVICE_GPS", locked_at: new Date().toISOString(), is_simulated: false,
      };
      setPreset("");
      setFix(location);
      setLocationMessage("Device location found. Check the accuracy before sending.");
    }, () => {
      setLocating(false);
      setLocationMessage("Couldn’t get a device location. Check location permission or choose an exercise location.");
    }, { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 });
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendLock.current || !fix) return;
    if (!needs.length) {
      setDelivery({ kind: "error", message: "Choose at least one kind of help before sending." });
      return;
    }
    sendLock.current = true;
    setSending(true);
    setDelivery(undefined);
    try {
      const id = shortId();
      const packet: SOSPacket = {
        sos_id: `SOS-${id}`,
        device_id: `FIELD-${id.slice(0, 8)}`,
        timestamp: new Date().toISOString(),
        position: { lat: fix.lat, lng: fix.lng, accuracy_m: Math.min(100000, fix.accuracy_m), navic_band: fix.navic_band },
        triage: { severity: urgency, headcount: Number(people), needs, note: note.trim() || undefined },
        mesh: { transport: "LORA_865", hop_count: 0, max_hops: 7, relay_path: [], sync_status: "QUEUED_OFFLINE" },
      };
      const saved = await submitSOSPacket(packet, !navigator.onLine || blackout);
      const waiting = saved.mesh.sync_status !== "SYNCED_COMMAND";
      const message = waiting
        ? "Help request saved on this device. It will sync when TerraPulse reconnects."
        : "TerraPulse received your exercise help request.";
      setDelivery({ kind: waiting ? "queued" : "received", message, time: saved.timestamp });
      setQueued(await getQueuedOfflineSOS());
      setNote("");
      setNeeds([]);
      if (waiting && navigator.onLine && !blackout) void refresh();
    } catch (error) {
      setDelivery({ kind: "error", message: error instanceof Error && error.name !== "AbortError"
        ? error.message : "The request could not be saved. Check browser storage and try again." });
    } finally {
      setSending(false);
      sendLock.current = false;
    }
  }

  const routeName = dispatch?.safe_asset.name ?? localRoute?.asset.properties.title;
  const adjustHeadcount = (delta: number) => {
    setPeople((current) => String(Math.min(10000, Math.max(1, Math.trunc(Number(current) || 1) + delta))));
  };

  return <div className="tp-field">
    <a className="tp-skip" href="#field-content">Skip to responder controls</a>
    <header className="tp-field-header">
      <a href="/" aria-label="TerraPulse dashboard"><Brand /></a>
      <div>
        <span className={`tp-live ${!linked ? "tp-live-offline" : ""}`} role="status"><i />{blackout ? "Offline Mesh" : linked ? "Live" : "Offline"}</span>
        <a href="/" className="tp-button"><Home size={17} /> Dashboard</a>
      </div>
    </header>
    <main className="tp-field-content" id="field-content">
      <div className="tp-field-intro">
        <div className="tp-page-heading">
          <div className="tp-context"><Radio size={15} /> Rescue exercise<span />{ready ? "Available offline" : "Offline setup pending"}</div>
          <h1>Field Responder</h1>
          <p>Find your location, ask for help and check nearby places to take shelter.</p>
        </div>
        <nav className="tp-field-quick" aria-label="Responder shortcuts">
          <a className="tp-button tp-sos-button" href="#sos-heading"><Radio size={18} /> Send SOS</a>
          <a className="tp-button" href="#routes-heading"><Route size={18} /> Find shelter</a>
        </nav>
      </div>
      <div className="tp-field-banner" role="status">
        {linked ? <Wifi size={18} /> : <CloudOff size={18} />}
        <div><strong>{linked ? "Connected to TerraPulse" : blackout ? "Mobile outage exercise active" : "Working offline"}</strong>
          <p>{linked ? "Help requests can sync to the dashboard." : "You can save a help request here. TerraPulse syncs it when the connection returns."}</p>
        </div>
        <span>{queued.length} queued</span>
      </div>

      <div className="tp-field-grid">
        <div className="tp-field-forms">
          <section className="tp-card tp-field-card" aria-labelledby="location-heading">
            <div className="tp-field-title"><span><Satellite size={21} /></span><div>
              <h2 id="location-heading">My Location</h2><p>Use your device location or choose an exercise preset.</p>
            </div></div>
            <div className="tp-location-reading">
              <div><small>Latitude</small><strong>{fix ? fix.lat.toFixed(5) : "—"}</strong></div>
              <div><small>Longitude</small><strong>{fix ? fix.lng.toFixed(5) : "—"}</strong></div>
              <div><small>Accuracy</small><strong>{fix ? `±${formatNumber(fix.accuracy_m, 1)} m` : "—"}</strong></div>
            </div>
            <div className="tp-field-location-controls">
              <button type="button" className="tp-button" onClick={locate} disabled={locating}><Crosshair size={17} />
                {locating ? "Finding location…" : "Use my location"}</button>
              <label className="tp-region-select"><MapPin size={16} />
                <select aria-label="Exercise location in India" value={preset} onChange={(event) => usePreset(event.target.value)}>
                  <option value="" disabled>Choose a location</option>
                  {INDIA_REGIONS.map((region) => <optgroup label={region.short_name} key={region.id}>
                    {region.places.map((p) => <option value={p.name} key={p.name}>{p.name}, {p.state}</option>)}
                  </optgroup>)}
                </select><ChevronDown size={14} /></label>
            </div>
            <p className="tp-field-hint" role="status">{locationMessage || (fix?.is_simulated ? "NavIC exercise position · L5 + S band" : "Device-reported position")}</p>
          </section>

          <section className="tp-card tp-field-card" aria-labelledby="sos-heading">
            <div className="tp-field-title tp-field-title-sos"><span><Radio size={21} /></span><div>
              <h2 id="sos-heading">Send SOS Help Request</h2><p>Choose the urgency and the kind of help you need.</p>
            </div></div>
            <form className="tp-sos-form" onSubmit={(event) => void send(event)}>
              <fieldset><legend>Urgency</legend><div className="tp-urgency">
                {URGENCY.map(({ value, label, description }) => (
                  <label className={`tp-urgency-${value.toLowerCase()}`} key={value}>
                    <input type="radio" name="urgency" value={value} checked={urgency === value} onChange={() => setUrgency(value)} />
                    <span><strong>{label}</strong><small>{description}</small></span>
                  </label>
                ))}
              </div></fieldset>
              <div className="tp-people-input">
                <label htmlFor="field-headcount"><Users size={17} /> Number of people</label>
                <div className="tp-count-control">
                  <button type="button" aria-label="Fewer people" disabled={Number(people) <= 1} onClick={() => adjustHeadcount(-1)}><Minus size={18} /></button>
                  <input id="field-headcount" type="number" min={1} max={10000} required inputMode="numeric" value={people}
                    onChange={(event) => setPeople(event.target.value)} />
                  <button type="button" aria-label="More people" disabled={Number(people) >= 10000} onClick={() => adjustHeadcount(1)}><Plus size={18} /></button>
                </div>
              </div>
              <fieldset><legend>Help needed</legend><div className="tp-needs">
                {NEEDS.map(({ value, label, icon: Icon }) => <label key={value}>
                  <input type="checkbox" checked={needs.includes(value)} onChange={() =>
                    setNeeds((current) => current.includes(value) ? current.filter((need) => need !== value) : [...current, value])} />
                  <span><Icon size={17} /> {label}</span>
                </label>)}
              </div></fieldset>
              <label className="tp-note-input"><span>Short note <small>Optional</small></span>
                <textarea maxLength={240} value={note} onChange={(event) => setNote(event.target.value)}
                  placeholder="For example, two people need help near the school. Use exercise details." rows={3} />
              </label>
              <button type="submit" className="tp-button tp-sos-button tp-field-send" disabled={sending || !fix}>
                <Radio size={19} /> {sending ? "Saving request…" : "Send SOS Help Request"}
              </button>
            </form>

            {delivery && <div className={`tp-field-delivery tp-field-delivery-${delivery.kind}`} role={delivery.kind === "error" ? "alert" : "status"}>
              {delivery.kind === "error" ? <TriangleAlert size={17} /> : <Check size={17} />}
              <p>{delivery.message}</p>
            </div>}
            {(delivery?.kind === "queued" || delivery?.kind === "received" || queued.length > 0) && (
              <div className="tp-relay">
                <h3>Radio relay exercise</h3>
                <ol aria-label="Simulated radio hops">
                  <li><span /><strong>Hop 1</strong><small>Field relay</small></li>
                  <li><span /><strong>Hop 2</strong><small>Regional relay</small></li>
                  <li><span /><strong>Rescue Gateway</strong><small>{delivery?.kind === "received" ? "Synced" : "Waiting to sync"}</small></li>
                </ol>
              </div>
            )}
            {queued.length > 0 && <div className="tp-queue">
              <h3>Saved on this device</h3>
              <ul>{queued.map((packet) => <li key={packet.sos_id}>
                <strong>{friendlyNeed(packet.triage.severity)} · {packet.triage.headcount} {packet.triage.headcount === 1 ? "person" : "people"}</strong>
                <span>{timeOf(packet.timestamp)} IST</span>
              </li>)}</ul>
              {linked && <button type="button" className="tp-button" disabled={syncing} onClick={() => void refresh()}>{syncing ? "Syncing…" : "Sync now"}</button>}
            </div>}
            <p className="tp-field-hint">Radio hops are simulated with LoRa and BLE. Use exercise details in your request.</p>
          </section>
        </div>

        <section className="tp-card tp-field-card tp-field-route" aria-labelledby="routes-heading">
          <div className="tp-field-title"><span><Route size={21} /></span><div>
            <h2 id="routes-heading">Safe Route &amp; Nearby Shelters</h2>
            <p>{place?.name ?? "Your location"} · {linked ? "Latest map" : "Offline map"}</p>
          </div></div>
          <CommandMap target={mapTarget} features={state.features.features} activeLayers={FIELD_LAYERS}
            dispatches={dispatch ? [dispatch] : []} offline={offline || blackout} location={point} />
          <div className="tp-field-route-summary">
            <span className="tp-list-icon"><ShieldCheck size={19} /></span>
            <div><h3>{routeName ?? "No route nearby"}</h3>
              <p>{dispatch ? dispatch.alert_headline : localRoute ? "Follow the marked higher-ground route to this relief point."
                : "Choose a nearby exercise location to see available routes."}</p>
              {routeName && <small>Confirm route conditions with local responders.</small>}
            </div>
          </div>
          <h3 className="tp-field-resources-heading">Nearby Relief Points</h3>
          <ul className="tp-field-resources">
            {resources.map((feature, i) => <li key={feature.id ?? i}>
              <MapPin size={17} /><div><strong>{feature.properties.title}</strong><small>{LABELS[feature.properties.asset_type ?? "NONE"]}</small></div>
              <span>{formatNumber(distanceKm(featurePoint(feature), point), 1)} km</span>
            </li>)}
            {!resources.length && <li>No mapped relief points within 60 km.</li>}
          </ul>
        </section>
      </div>
    </main>
  </div>;
}
