"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Activity, BadgeCheck, BadgeX, CloudOff, Shield } from "lucide-react";
import { AdminAccessButton } from "@/components/admin-access-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { appConfig } from "@/lib/app-config";
import type { AttendanceScan, EmployeeRecord, EventRecord } from "@/lib/kiosk-types";
import {
  bootstrapKiosk,
  createScanRecord,
  findSuppressedDuplicate,
  refreshReferenceData,
  retryPendingQueue,
  submitScan,
} from "@/lib/kiosk-data";
import { eventLabel, formatDisplayDate } from "@/lib/kiosk-utils";

type ResultView = {
  state: "idle" | "MATCHED" | "UNKNOWN" | "INACTIVE" | "DUPLICATE";
  title: string;
  detail: string;
  scan?: AttendanceScan;
};

const DEFAULT_RESULT: ResultView = {
  state: "idle",
  title: "Ready to Scan",
  detail: "Scan a badge or type a badge number to log attendance.",
};

function toneForResult(state: ResultView["state"]) {
  if (state === "MATCHED") return { border: "border-emerald-300/35", bg: "bg-emerald-400/15", icon: BadgeCheck, iconColor: "text-emerald-200" };
  if (state === "INACTIVE") return { border: "border-amber-300/35", bg: "bg-amber-400/15", icon: BadgeX, iconColor: "text-amber-100" };
  if (state === "UNKNOWN" || state === "DUPLICATE") return { border: "border-rose-300/35", bg: "bg-rose-400/15", icon: CloudOff, iconColor: "text-rose-100" };
  return { border: "border-white/10", bg: "bg-slate-900/70", icon: Activity, iconColor: "text-cyan-200" };
}

export function KioskPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const deviceRef = useRef<Awaited<ReturnType<typeof bootstrapKiosk>>["device"] | null>(null);
  const [ready, setReady] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [device, setDevice] = useState<Awaited<ReturnType<typeof bootstrapKiosk>>["device"] | null>(null);
  const [pendingScans, setPendingScans] = useState<AttendanceScan[]>([]);
  const [recentScans, setRecentScans] = useState<AttendanceScan[]>([]);
  const [badgeInput, setBadgeInput] = useState("");
  const [result, setResult] = useState<ResultView>(DEFAULT_RESULT);
  const loadKiosk = useCallback(async (forceRefresh = false) => {
    const snapshot = await bootstrapKiosk(forceRefresh);
    setEmployees(snapshot.employees);
    setEvents(snapshot.events);
    setDevice(snapshot.device);
    deviceRef.current = snapshot.device;
    setPendingScans(snapshot.pendingScans);
    setRecentScans(snapshot.recentScans);
    setIsOnline(navigator.onLine);
    setReady(true);
    inputRef.current?.focus();
  }, []);

  const syncQueued = useCallback(async (useRetryEndpoint = false) => {
    const outcome = await retryPendingQueue({ useRetryEndpoint });
    setPendingScans(outcome.pending);
    const refreshed = await bootstrapKiosk(false);
    setRecentScans(refreshed.recentScans);
  }, []);

  const refreshOnReconnect = useCallback(async () => {
    setIsOnline(true);
    const currentDevice = deviceRef.current ?? undefined;
    const refreshed = await refreshReferenceData(true, currentDevice);
    setEmployees(refreshed.employees);
    setEvents(refreshed.events);
    setDevice(refreshed.device);
    deviceRef.current = refreshed.device;
    const queueOutcome = await retryPendingQueue();
    setPendingScans(queueOutcome.pending);
    const latest = await bootstrapKiosk(false);
    deviceRef.current = latest.device;
    setRecentScans(latest.recentScans);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadKiosk(false);
    });

    const handleOnline = () => {
      void refreshOnReconnect();
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [loadKiosk, refreshOnReconnect]);

  useEffect(() => {
    deviceRef.current = device;
  }, [device]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const interval = window.setInterval(() => {
      if (navigator.onLine) {
        void syncQueued(false);
      }
    }, appConfig.queueRetryMinutes * 60 * 1000);

    return () => window.clearInterval(interval);
  }, [ready, syncQueued]);

  useEffect(() => {
    if (result.state === "idle") {
      return;
    }

    const timer = window.setTimeout(() => {
      setResult(DEFAULT_RESULT);
      setBadgeInput("");
      inputRef.current?.focus();
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [result]);

  const currentEventLabel = useMemo(() => eventLabel(events, device?.ActiveEventId ?? null, device?.ActiveEventName ?? null), [device, events]);
  const lastScan = recentScans[0];
  const tone = toneForResult(result.state);
  const ResultIcon = tone.icon;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!device) {
      return;
    }

    const rawBadge = badgeInput.trim();
    if (!rawBadge) {
      return;
    }

    const duplicate = findSuppressedDuplicate(recentScans, {
      badgeRaw: rawBadge,
      deviceId: device.DeviceId,
      eventId: device.ActiveEventId,
    });

    if (duplicate) {
      setResult({
        state: "DUPLICATE",
        title: "Duplicate Suppressed",
        detail: `${duplicate.BadgeNumberRaw} was already captured on this device for ${duplicate.EventNameSnapshot ?? "the active event"} within 30 seconds.`,
        scan: duplicate,
      });
      setBadgeInput("");
      inputRef.current?.focus();
      return;
    }

    const { record, matchedEmployee } = createScanRecord(rawBadge, device, employees, events);
    const savedScan = await submitScan(record);

    const refreshed = await bootstrapKiosk(false);
    setRecentScans(refreshed.recentScans);
    setPendingScans(refreshed.pendingScans);

    if (savedScan.ScanStatus === "MATCHED") {
      setResult({
        state: "MATCHED",
        title: matchedEmployee?.EmployeeName ?? savedScan.EmployeeNameSnapshot ?? "Attendance logged",
        detail:
          savedScan.SyncStatus === "SYNCED"
            ? `Attendance synced immediately for ${savedScan.EventNameSnapshot ?? "the selected event"}.`
            : `Attendance captured and queued for sync to ${savedScan.EventNameSnapshot ?? "the selected event"}.`,
        scan: savedScan,
      });
      return;
    }

    if (savedScan.ScanStatus === "INACTIVE") {
      setResult({
        state: "INACTIVE",
        title: savedScan.EmployeeNameSnapshot ?? "Inactive employee",
        detail: `Badge ${savedScan.BadgeNumberRaw} belongs to an inactive employee record.`,
        scan: savedScan,
      });
      return;
    }

    setResult({
      state: "UNKNOWN",
      title: "Unknown",
      detail: `Badge ${savedScan.BadgeNumberRaw} is not in the cached employee list.`,
      scan: savedScan,
    });
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(155deg,#07121f_0%,#0f2436_32%,#124055_100%)] px-4 py-4 text-slate-100 md:px-8 md:py-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col gap-4">
        <header className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.32)] backdrop-blur md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-cyan-200/80">Attendance Kiosk</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl">{currentEventLabel}</h1>
              <p className="mt-3 max-w-3xl text-base text-slate-300 md:text-lg">Scan your badge to check in.</p>
            </div>

            <AdminAccessButton
              variant="outline"
              className="h-14 rounded-2xl border-white/10 bg-slate-900/80 px-6 text-base font-semibold text-white hover:bg-slate-800"
            >
              <Shield className="size-5" />
              Admin
            </AdminAccessButton>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4">
          <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.32)] backdrop-blur md:p-8">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label htmlFor="badge" className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100">
                Badge Scan
              </label>
              <div className="flex flex-col gap-3 lg:flex-row">
                <Input
                  id="badge"
                  ref={inputRef}
                  value={badgeInput}
                  onChange={(event) => setBadgeInput(event.target.value)}
                  autoFocus
                  inputMode="numeric"
                  placeholder="Scan badge or type badge number"
                  className="h-20 rounded-[1.5rem] border-white/10 bg-slate-900/80 px-6 text-2xl text-white placeholder:text-slate-500 md:text-3xl"
                />
                <Button
                  type="submit"
                  className="h-20 rounded-[1.5rem] bg-cyan-400 px-8 text-xl font-semibold text-slate-950 hover:bg-cyan-300 lg:min-w-64"
                  disabled={!ready}
                >
                  Log Attendance
                </Button>
              </div>
            </form>

            <div className={`mt-6 rounded-[2rem] border ${tone.border} ${tone.bg} p-6 transition-all duration-150 md:p-8`}>
              <div className="flex items-start gap-4">
                <div className={`flex size-14 shrink-0 items-center justify-center rounded-2xl bg-slate-950/40 ${tone.iconColor}`}>
                  <ResultIcon className="size-7" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">Scan Result</p>
                  <h2 className="mt-2 text-4xl font-semibold tracking-tight text-white md:text-5xl">{result.title}</h2>
                  <p className="mt-3 max-w-3xl text-base leading-7 text-slate-100/90 md:text-lg">{result.detail}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Employee</p>
                  <p className="mt-2 text-xl font-semibold text-white">{result.scan?.EmployeeNameSnapshot ?? (result.state === "UNKNOWN" ? "Unknown" : "Waiting")}</p>
                </div>
                <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Badge</p>
                  <p className="mt-2 text-xl font-semibold text-white">{result.scan?.BadgeNumberRaw ?? "No scan yet"}</p>
                </div>
                <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Sync</p>
                  <p className="mt-2 text-xl font-semibold text-white">{result.scan?.SyncStatus ?? "Ready"}</p>
                </div>
              </div>
            </div>

            {!device?.ActiveEventId && (
              <div className="mt-5 rounded-[1.5rem] border border-amber-300/30 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">
                This device does not have an active event yet. Use Admin to assign one before production use.
              </div>
            )}
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.32)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Latest Scan</p>
                <p className="mt-2 text-2xl font-semibold text-white">{lastScan?.EmployeeNameSnapshot ?? "No scans yet"}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${lastScan?.SyncStatus === "SYNCED" ? "bg-emerald-400/15 text-emerald-100" : "bg-amber-400/15 text-amber-100"}`}>
                {lastScan?.SyncStatus ?? "Ready"}
              </span>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p>Badge: {lastScan?.BadgeNumberRaw ?? "Waiting for badge input"}</p>
              <p>Event: {lastScan?.EventNameSnapshot ?? currentEventLabel}</p>
              <p>Time: {formatDisplayDate(lastScan?.ScanUTC)}</p>
            </div>

            {pendingScans.length > 0 && (
              <div className="mt-5 rounded-[1.4rem] border border-amber-300/25 bg-amber-400/10 p-4">
                <p className="text-sm font-semibold text-amber-50">{pendingScans.length} scan{pendingScans.length === 1 ? "" : "s"} waiting for sync.</p>
                <p className="mt-2 text-sm leading-6 text-amber-100/80">
                  The kiosk will retry automatically every {appConfig.queueRetryMinutes} minute{appConfig.queueRetryMinutes === 1 ? "" : "s"} while online.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
