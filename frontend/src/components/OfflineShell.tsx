"use client";

import { useEffect } from "react";

export default function OfflineShell() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const prepare = (registration: ServiceWorkerRegistration) =>
      registration.active?.postMessage({ type: "PREPARE_OFFLINE" });
    const warm = () => { void navigator.serviceWorker.ready.then(prepare); };
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(warm).catch(() => {
      // When service workers are blocked, the running page can still use its bundled data.
    });
    window.addEventListener("online", warm);
    return () => window.removeEventListener("online", warm);
  }, []);
  return null;
}
