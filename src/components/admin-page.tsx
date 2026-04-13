"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, RefreshCcw, Search, Wifi, WifiOff, X } from "lucide-react";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  bootstrapKiosk,
  createAndCacheEvent,
  refreshReferenceData,
  retryPendingQueue,
  updateDeviceConfiguration,
} from "@/lib/kiosk-data";
import type { AttendanceScan, DeviceConfig, EmployeeRecord, EventRecord, SyncMetadata } from "@/lib/kiosk-types";
import { formatDisplayDate } from "@/lib/kiosk-utils";
import { cn } from "@/lib/utils";

type AdminState = {
  employees: EmployeeRecord[];
  events: EventRecord[];
  device: DeviceConfig | null;
  pendingScans: AttendanceScan[];
  recentScans: AttendanceScan[];
  syncMetadata: SyncMetadata | null;
};

const EMPTY_ADMIN_STATE: AdminState = {
  employees: [],
  events: [],
  device: null,
  pendingScans: [],
  recentScans: [],
  syncMetadata: null,
};

function EmployeeSearchField({
  id,
  value,
  onChange,
  placeholder,
  inputClassName,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  inputClassName: string;
}) {
  const hasText = value.length > 0;
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
      <Input
        id={id}
        type="text"
        inputMode="search"
        enterKeyHint="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={cn(inputClassName, "pl-11", hasText ? "pr-[3.25rem]" : "pr-4")}
      />
      {hasText ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-xl border-2 border-white/25 bg-slate-800 text-white shadow-md transition hover:border-cyan-400/50 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/90"
        >
          <X className="size-6" strokeWidth={2.75} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function EmployeeTableRows({ employees }: { employees: EmployeeRecord[] }) {
  return employees.map((employee) => {
    const emailDisplay = (employee.Email ?? "").trim() || "—";
    return (
      <tr key={`${employee.BadgeNumberNormalized}-${employee.EmpID ?? ""}`} className="border-b border-white/5 last:border-b-0">
        <td
          className="max-w-[12rem] truncate px-3 py-2 align-middle font-medium text-white sm:max-w-[14rem]"
          title={employee.EmployeeName}
        >
          {employee.EmployeeName}
        </td>
        <td
          className="max-w-[12rem] truncate px-3 py-2 align-middle text-slate-300 sm:max-w-[18rem]"
          title={emailDisplay === "—" ? undefined : emailDisplay}
        >
          {emailDisplay}
        </td>
        <td className="whitespace-nowrap px-3 py-2 align-middle tabular-nums text-slate-300">{employee.BadgeNumberRaw}</td>
      </tr>
    );
  });
}

export function AdminPage() {
  return (
    <AdminGuard>
      <AdminPageInner />
    </AdminGuard>
  );
}

function AdminPageInner() {
  const [state, setState] = useState<AdminState>(EMPTY_ADMIN_STATE);
  const [isOnline, setIsOnline] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [deviceNameDraft, setDeviceNameDraft] = useState("");
  const [activeEventId, setActiveEventId] = useState("none");
  const [newEventName, setNewEventName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [employeeListOpen, setEmployeeListOpen] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");

  const sortedEmployees = useMemo(
    () => [...state.employees].sort((a, b) => a.EmployeeName.localeCompare(b.EmployeeName, undefined, { sensitivity: "base" })),
    [state.employees]
  );

  const filteredEmployees = useMemo(() => {
    const q = employeeSearchQuery.trim().toLowerCase();
    if (!q) {
      return sortedEmployees;
    }
    return sortedEmployees.filter((employee) => {
      const name = employee.EmployeeName.toLowerCase();
      const email = (employee.Email ?? "").toLowerCase();
      const badge = employee.BadgeNumberRaw.toLowerCase();
      return name.includes(q) || email.includes(q) || badge.includes(q);
    });
  }, [sortedEmployees, employeeSearchQuery]);

  const searchHasFilter = employeeSearchQuery.trim().length > 0;

  const refreshState = useCallback(async (forceRefresh = false) => {
    const snapshot = await bootstrapKiosk(forceRefresh);
    setState({
      employees: snapshot.employees,
      events: snapshot.events,
      device: snapshot.device,
      pendingScans: snapshot.pendingScans,
      recentScans: snapshot.recentScans,
      syncMetadata: snapshot.syncMetadata,
    });
    setDeviceNameDraft(snapshot.device.DeviceName);
    setActiveEventId(snapshot.device.ActiveEventId ?? "none");
    setIsOnline(navigator.onLine);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshState(false);
    });

    const handleOnline = () => {
      setIsOnline(true);
      void refreshState(true);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshState]);

  useEffect(() => {
    if (!employeeListOpen) {
      return;
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEmployeeListOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [employeeListOpen]);

  return (
    <div className="min-h-screen bg-[linear-gradient(155deg,#07121f_0%,#0f2436_35%,#124055_100%)] px-4 py-4 text-slate-100 md:px-8 md:py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <header className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.32)] backdrop-blur md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-cyan-200/80">Admin Console</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl">Attendance control center</h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">
                Manage the assigned event on this kiosk, refresh employee references, retry queued scans, and review attendance history.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="h-12 rounded-2xl border-white/10 bg-slate-900/80 px-5 text-base text-white hover:bg-slate-800">
                <Link href="/">
                  <ArrowLeft className="size-4" />
                  Kiosk
                </Link>
              </Button>
              <Button asChild className="h-12 rounded-2xl bg-cyan-400 px-5 text-base font-semibold text-slate-950 hover:bg-cyan-300">
                <Link href="/admin/review">Open Review</Link>
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Device</p>
              <p className="mt-2 text-lg font-semibold text-white">{state.device?.DeviceName ?? "Preparing kiosk..."}</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Status</p>
              <p className={`mt-2 inline-flex items-center gap-2 text-lg font-semibold ${isOnline ? "text-emerald-200" : "text-amber-200"}`}>
                {isOnline ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
                {isOnline ? "Online" : "Offline"}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Pending Queue</p>
              <p className="mt-2 text-lg font-semibold text-white">{state.pendingScans.length}</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Reference Refresh</p>
              <p className="mt-2 text-sm font-medium text-white">{formatDisplayDate(state.syncMetadata?.LastReferenceRefreshUTC ?? null)}</p>
            </div>
          </div>
        </header>

        {statusMessage && (
          <div className="rounded-[1.5rem] border border-cyan-300/20 bg-cyan-400/10 px-5 py-4 text-sm text-cyan-50">
            {statusMessage}
          </div>
        )}

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.32)] backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Device Settings</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">This kiosk</h2>
                </div>
                <p className="text-sm text-slate-400">Persistent device identity stays cached offline.</p>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
                <div>
                  <label className="text-sm font-medium text-cyan-100">Device name</label>
                  <Input
                    value={deviceNameDraft}
                    onChange={(event) => setDeviceNameDraft(event.target.value)}
                    placeholder="Attendance kiosk name"
                    className="mt-2 h-14 rounded-2xl border-white/10 bg-slate-900/80 px-4 text-base text-white"
                  />
                  <p className="mt-2 text-sm text-slate-400">Use a physical label-friendly name like “North Lobby iPad”.</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-cyan-100">Active event</label>
                  <select
                    value={activeEventId}
                    onChange={(event) => setActiveEventId(event.target.value)}
                    className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 text-base text-white outline-none"
                  >
                    <option value="none">No event selected</option>
                    {state.events.map((event) => (
                      <option key={event.EventId} value={event.EventId}>
                        {event.EventName}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-sm text-slate-400">Each device keeps one active event assignment at a time.</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  className="h-12 rounded-2xl bg-cyan-400 px-5 text-base font-semibold text-slate-950 hover:bg-cyan-300"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const updatedDevice = await updateDeviceConfiguration(
                        deviceNameDraft,
                        activeEventId === "none" ? null : activeEventId,
                        state.events
                      );
                      setStatusMessage(`Device settings saved for ${updatedDevice.DeviceName}.`);
                      await refreshState(false);
                    })
                  }
                >
                  Save Device Settings
                </Button>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Device ID</p>
                  <p className="mt-2 break-all text-sm text-white">{state.device?.DeviceId ?? "Unavailable"}</p>
                </div>
                <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Assigned Event</p>
                  <p className="mt-2 text-sm text-white">{state.device?.ActiveEventName ?? "No event selected"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.32)] backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Event Management</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Central event catalog</h2>
                </div>
                <p className="text-sm text-slate-400">Events are sourced from backend APIs, not typed on the kiosk page.</p>
              </div>

              <div className="mt-6 flex flex-col gap-3 lg:flex-row">
                <Input
                  value={newEventName}
                  onChange={(event) => setNewEventName(event.target.value)}
                  placeholder="Create a new event name"
                  className="h-14 rounded-2xl border-white/10 bg-slate-900/80 px-4 text-base text-white"
                />
                <Button
                  className="h-14 rounded-2xl bg-white text-base font-semibold text-slate-950 hover:bg-slate-200 lg:min-w-52"
                  disabled={isPending || !newEventName.trim() || !isOnline}
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        const result = await createAndCacheEvent(newEventName.trim());
                        setNewEventName("");
                        setStatusMessage(`Created event "${result.created.EventName}".`);
                        await refreshState(true);
                      } catch (error) {
                        setStatusMessage(error instanceof Error ? error.message : "Unable to create event.");
                      }
                    })
                  }
                >
                  Create Event
                </Button>
              </div>

              {!isOnline && (
                <p className="mt-3 text-sm text-amber-100/90">Creating new events requires the backend API to be reachable.</p>
              )}

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {state.events.map((event) => (
                  <div key={event.EventId} className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">{event.EventName}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{event.EventId}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${event.IsActive ? "bg-emerald-400/15 text-emerald-100" : "bg-slate-700 text-slate-300"}`}>
                        {event.IsActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.32)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Sync Controls</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Refresh and retry</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Employee cache refreshes every 12 hours when online and again on reconnect. You can also trigger refresh and queue retry manually here.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between">
                <div className="rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-4 sm:min-w-[12rem]">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Employees in cache</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums text-white">{state.employees.length}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-[3.5rem] rounded-2xl border-white/10 bg-slate-900/80 px-5 py-3 text-base text-white hover:bg-slate-800 sm:self-center"
                  onClick={() => setEmployeeListOpen(true)}
                >
                  View Employee List
                </Button>
              </div>

              <div className="mt-4">
                <label htmlFor="employee-search-sync" className="text-sm font-medium text-cyan-100">
                  Search employees
                </label>
                <div className="mt-2">
                  <EmployeeSearchField
                    id="employee-search-sync"
                    value={employeeSearchQuery}
                    onChange={setEmployeeSearchQuery}
                    placeholder="Start typing name, email, or badge…"
                    inputClassName="h-12 rounded-2xl border-white/10 bg-slate-900/80 py-2 text-base text-white placeholder:text-slate-500"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Partial matches update as you type (name, email, or badge; not case-sensitive).
                </p>
                {searchHasFilter ? (
                  <div
                    role="region"
                    aria-live="polite"
                    aria-label="Live search results"
                    className="mt-3 max-h-64 overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/60 shadow-inner"
                  >
                    {state.employees.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-slate-400">No employees in the local cache yet.</p>
                    ) : filteredEmployees.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-slate-400">No matches yet — keep typing or try another term.</p>
                    ) : (
                      <table className="w-full min-w-[min(100%,28rem)] border-collapse text-left text-sm">
                        <thead className="sticky top-0 z-10 bg-slate-900/95 shadow-[0_1px_0_rgba(255,255,255,0.08)]">
                          <tr className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            <th scope="col" className="px-3 py-2">
                              Name
                            </th>
                            <th scope="col" className="px-3 py-2">
                              Email
                            </th>
                            <th scope="col" className="px-3 py-2">
                              Badge
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <EmployeeTableRows employees={filteredEmployees} />
                        </tbody>
                      </table>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="mt-5 grid gap-3">
                <Button
                  className="h-14 rounded-2xl bg-cyan-400 text-base font-semibold text-slate-950 hover:bg-cyan-300"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const device = state.device;
                      if (!device) {
                        return;
                      }

                      const refreshed = await refreshReferenceData(true, device);
                      setStatusMessage(
                        `Reference data refreshed. ${refreshed.employees.length} employees and ${refreshed.events.length} events are cached on this device.`
                      );
                      await refreshState(false);
                    })
                  }
                >
                  <RefreshCcw className="size-4" />
                  Refresh Employee and Event Cache
                </Button>

                <Button
                  variant="outline"
                  className="h-14 rounded-2xl border-white/10 bg-slate-900/80 text-base text-white hover:bg-slate-800"
                  disabled={isPending || state.pendingScans.length === 0}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await retryPendingQueue({ useRetryEndpoint: true });
                      setStatusMessage(`Retry complete. ${result.synced} scan${result.synced === 1 ? "" : "s"} synced from the local queue.`);
                      await refreshState(false);
                    })
                  }
                >
                  Retry Pending Sync
                </Button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Last Reference Refresh</p>
                  <p className="mt-2 text-sm text-white">{formatDisplayDate(state.syncMetadata?.LastReferenceRefreshUTC ?? null)}</p>
                </div>
                <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Last Queue Sync</p>
                  <p className="mt-2 text-sm text-white">{formatDisplayDate(state.syncMetadata?.LastQueueSyncUTC ?? null)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.32)] backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Queue Snapshot</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Recent device activity</h2>
                </div>
                <p className="text-sm text-slate-400">Local history remains even after successful sync.</p>
              </div>

              <div className="mt-5 space-y-3">
                {state.recentScans.length === 0 ? (
                  <div className="rounded-[1.4rem] border border-dashed border-white/10 px-4 py-5 text-sm text-slate-400">
                    No local scan history has been captured yet.
                  </div>
                ) : (
                  state.recentScans.slice(0, 8).map((scan) => (
                    <div key={scan.DeviceScanGuid} className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-white">{scan.EmployeeNameSnapshot ?? "Unknown"}</p>
                          <p className="mt-1 text-sm text-slate-300">{scan.BadgeNumberRaw}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{scan.EventNameSnapshot ?? "No event"}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${scan.SyncStatus === "SYNCED" ? "bg-emerald-400/15 text-emerald-100" : "bg-amber-400/15 text-amber-100"}`}>
                          {scan.SyncStatus}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-2">
                        <p>Scan status: {scan.ScanStatus}</p>
                        <p>Captured: {formatDisplayDate(scan.ScanUTC)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {employeeListOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setEmployeeListOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-list-title"
            className="flex min-h-0 max-h-[min(85vh,720px)] w-full max-w-4xl flex-col rounded-[1.75rem] border border-white/10 bg-slate-950 shadow-[0_25px_60px_rgba(0,0,0,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <h3 id="employee-list-title" className="text-lg font-semibold text-white">
                  Employee list
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  {searchHasFilter
                    ? `${filteredEmployees.length} of ${state.employees.length} match`
                    : `${state.employees.length} cached on this device`}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white"
                aria-label="Close employee list"
                onClick={() => setEmployeeListOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <div className="border-b border-white/10 px-5 pb-4">
              <label htmlFor="employee-search-modal" className="sr-only">
                Search employees by name or email
              </label>
              <EmployeeSearchField
                id="employee-search-modal"
                value={employeeSearchQuery}
                onChange={setEmployeeSearchQuery}
                placeholder="Filter by name, email, or badge…"
                inputClassName="h-11 rounded-xl border-white/10 bg-slate-900/80 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-1 pb-2 pt-1 sm:px-2">
              <table className="w-full min-w-[min(100%,32rem)] border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-950 shadow-[0_1px_0_rgba(255,255,255,0.08)]">
                  <tr className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    <th scope="col" className="px-3 py-2.5">
                      Name
                    </th>
                    <th scope="col" className="px-3 py-2.5">
                      Email
                    </th>
                    <th scope="col" className="px-3 py-2.5">
                      Badge
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {state.employees.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-8 text-center text-slate-400">
                        No employees in the local cache yet.
                      </td>
                    </tr>
                  ) : filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-8 text-center text-slate-400">
                        No employees match your search.
                      </td>
                    </tr>
                  ) : (
                    <EmployeeTableRows employees={filteredEmployees} />
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
