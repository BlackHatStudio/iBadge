"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, Moon, RefreshCcw, Search, Sun, UserPlus, Wifi, WifiOff, X } from "lucide-react";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createEvent, updateEvent } from "@/lib/api";
import {
  addCardholderAndRefresh,
  bootstrapKiosk,
  refreshReferenceData,
  retryPendingQueue,
  updateDeviceClassDuration,
  updateDeviceConfiguration,
} from "@/lib/kiosk-data";
import type { AttendanceScan, DeviceConfig, EmployeeRecord, EventRecord, SyncMetadata } from "@/lib/kiosk-types";
import { CLASS_DURATION_ONE_MINUTE_HOURS, formatDisplayDate } from "@/lib/kiosk-utils";
import { cn } from "@/lib/utils";
import { useIbadgeTheme } from "@/components/theme-provider";

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

function formatDurationLabel(hours: number) {
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }
  return `${hours % 1 === 0 ? hours.toFixed(0) : hours} hrs`;
}

function AdminThemeToggle() {
  const { theme, setTheme } = useIbadgeTheme();
  const isDark = theme === "dark";

  return (
    <div className="flex items-center justify-end gap-3">
      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Appearance</span>
      <div className="flex items-center gap-2 rounded-2xl border border-slate-100/95 bg-white px-3 py-2 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
        <Sun className={cn("size-5 shrink-0", isDark ? "text-slate-400" : "text-amber-500")} aria-hidden />
        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className={cn(
            "relative inline-flex h-9 w-[3.25rem] shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/80",
            isDark ? "border-slate-600 bg-slate-700" : "border-slate-300 bg-slate-200"
          )}
        >
          <span
            className={cn(
              "pointer-events-none block size-7 rounded-full bg-white shadow-md ring-1 ring-black/5 transition-transform",
              isDark ? "translate-x-[1.35rem]" : "translate-x-0.5"
            )}
          />
        </button>
        <Moon className={cn("size-5 shrink-0", isDark ? "text-indigo-300" : "text-slate-400")} aria-hidden />
      </div>
    </div>
  );
}

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
          className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-xl border-2 border-slate-300 bg-slate-700 text-white shadow-md transition hover:border-cyan-500/50 hover:bg-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/80 dark:border-white/25 dark:bg-slate-800 dark:hover:border-cyan-400/50 dark:hover:bg-slate-700"
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
      <tr key={`${employee.BadgeNumberNormalized}-${employee.EmpID ?? ""}`} className="border-b border-slate-100 last:border-b-0 dark:border-white/5">
        <td
          className="max-w-[12rem] truncate px-3 py-2 align-middle font-medium text-slate-900 dark:text-white sm:max-w-[14rem]"
          title={employee.EmployeeName}
        >
          {employee.EmployeeName}
        </td>
        <td
          className="max-w-[12rem] truncate px-3 py-2 align-middle text-slate-600 dark:text-slate-300 sm:max-w-[18rem]"
          title={emailDisplay === "—" ? undefined : emailDisplay}
        >
          {emailDisplay}
        </td>
        <td className="whitespace-nowrap px-3 py-2 align-middle tabular-nums text-slate-600 dark:text-slate-300">{employee.BadgeNumberRaw}</td>
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
  const [scanListOpen, setScanListOpen] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [classDurationHours, setClassDurationHours] = useState("0.5");
  const [eventFilter, setEventFilter] = useState<"active" | "inactive">("active");
  const [eventListOpen, setEventListOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);
  const [eventEditorOpen, setEventEditorOpen] = useState(false);
  const [eventEditName, setEventEditName] = useState("");
  const [eventEditIsActive, setEventEditIsActive] = useState(true);
  const [cardholderModalOpen, setCardholderModalOpen] = useState(false);
  const [cardholderFirstName, setCardholderFirstName] = useState("");
  const [cardholderLastName, setCardholderLastName] = useState("");
  const [cardholderBadge, setCardholderBadge] = useState("");
  const [cardholderCompany, setCardholderCompany] = useState("");
  const [cardholderEmail, setCardholderEmail] = useState("");

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
  const activeCatalogEvents = useMemo(
    () => state.events.filter((event) => event.IsActive),
    [state.events]
  );
  const inactiveAssignedEvent = useMemo(() => {
    if (activeEventId === "none") {
      return null;
    }
    const match = state.events.find((event) => event.EventId === activeEventId);
    return match && !match.IsActive ? match : null;
  }, [activeEventId, state.events]);
  const filteredEvents = useMemo(
    () => state.events.filter((event) => (eventFilter === "active" ? event.IsActive : !event.IsActive)),
    [eventFilter, state.events]
  );
  const visibleEvents = useMemo(() => filteredEvents.slice(0, 5), [filteredEvents]);
  const currentEventScans = useMemo(() => {
    if (!state.device) {
      return [];
    }

    return state.recentScans.filter(
      (scan) =>
        scan.DeviceId === state.device?.DeviceId &&
        (scan.EventId ?? null) === (state.device?.ActiveEventId ?? null)
    );
  }, [state.device, state.recentScans]);

  const openEventEditor = useCallback((event: EventRecord) => {
    setSelectedEvent(event);
    setEventEditName(event.EventName);
    setEventEditIsActive(event.IsActive);
    setEventEditorOpen(true);
  }, []);

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
    setClassDurationHours(String(snapshot.device.ClassDurationHours ?? 0.5));
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

  useEffect(() => {
    if (!scanListOpen) {
      return;
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setScanListOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [scanListOpen]);

  useEffect(() => {
    if (!eventListOpen && !eventEditorOpen) {
      return;
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEventEditorOpen(false);
        setEventListOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [eventEditorOpen, eventListOpen]);

  useEffect(() => {
    if (!cardholderModalOpen) {
      return;
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCardholderModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [cardholderModalOpen]);

  return (
    <div className="ibadge-shell">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <AdminThemeToggle />
        <header className="ibadge-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-cyan-800/90 dark:text-cyan-200/80">Admin Console</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white md:text-5xl">Attendance control center</h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">
                Manage the assigned event on this kiosk, refresh employee references, retry queued scans, and review attendance history.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                variant="outline"
                className="h-12 rounded-2xl border-slate-100 bg-white px-5 text-base text-slate-900 shadow-sm hover:bg-sky-50/60 dark:border-white/10 dark:bg-slate-900/80 dark:text-white dark:hover:bg-slate-800"
              >
                <Link href="/">
                  <ArrowLeft className="size-4" />
                  Kiosk
                </Link>
              </Button>
              <Button
                asChild
                className="h-12 rounded-2xl bg-cyan-500 px-5 text-base font-semibold text-white shadow-sm hover:bg-cyan-400 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300"
              >
                <Link href="/admin/review">Open Review</Link>
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <div className="ibadge-inset">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Device</p>
              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{state.device?.DeviceName ?? "Preparing kiosk..."}</p>
            </div>
            <div className="ibadge-inset">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Status</p>
              <p
                className={`mt-2 inline-flex items-center gap-2 text-lg font-semibold ${isOnline ? "text-emerald-700 dark:text-emerald-200" : "text-amber-700 dark:text-amber-200"}`}
              >
                {isOnline ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
                {isOnline ? "Online" : "Offline"}
              </p>
            </div>
            <div className="ibadge-inset">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Pending Queue</p>
              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{state.pendingScans.length}</p>
            </div>
            <div className="ibadge-inset">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Reference Refresh</p>
              <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                {formatDisplayDate(state.syncMetadata?.LastReferenceRefreshUTC ?? null)}
              </p>
            </div>
          </div>
        </header>

        {statusMessage && (
          <div className="rounded-[1.5rem] border border-cyan-300/40 bg-cyan-50 px-5 py-4 text-sm text-cyan-950 dark:border-cyan-300/20 dark:bg-cyan-400/10 dark:text-cyan-50">
            {statusMessage}
          </div>
        )}

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="ibadge-card">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Device Settings</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">This kiosk</h2>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Persistent device identity stays cached offline.</p>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.8fr_0.6fr]">
                <div>
                  <label className="text-sm font-medium text-cyan-900 dark:text-cyan-100">Device name</label>
                  <Input
                    value={deviceNameDraft}
                    onChange={(event) => setDeviceNameDraft(event.target.value)}
                    placeholder="Attendance kiosk name"
                    className="mt-2 h-14 rounded-2xl border border-slate-100/90 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-900/80 dark:text-white px-4 text-base"
                  />
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Use a physical label-friendly name like “North Lobby iPad”.</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-cyan-900 dark:text-cyan-100">Active event</label>
                  <select
                    value={activeEventId}
                    onChange={(event) => setActiveEventId(event.target.value)}
                    className="mt-2 h-14 w-full rounded-2xl border border-slate-100 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-900/80 dark:text-white px-4 text-base outline-none"
                  >
                    <option value="none">No event selected</option>
                    {inactiveAssignedEvent ? (
                      <option value={inactiveAssignedEvent.EventId}>
                        {inactiveAssignedEvent.EventName} (inactive assignment)
                      </option>
                    ) : null}
                    {activeCatalogEvents.map((event) => (
                      <option key={event.EventId} value={event.EventId}>
                        {event.EventName}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Each device keeps one active event assignment at a time.</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-cyan-900 dark:text-cyan-100">Event Duration</label>
                  <select
                    value={classDurationHours}
                    onChange={(event) => setClassDurationHours(event.target.value)}
                    className="mt-2 h-14 w-full rounded-2xl border border-slate-100 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-900/80 dark:text-white px-4 text-base outline-none"
                  >
                    <option value={String(CLASS_DURATION_ONE_MINUTE_HOURS)}>{formatDurationLabel(CLASS_DURATION_ONE_MINUTE_HOURS)}</option>
                    {Array.from({ length: 8 }, (_, index) => 0.5 + index * 0.5).map((hours) => (
                      <option key={hours} value={String(hours)}>
                        {formatDurationLabel(hours)}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Duplicate badge scans are blocked only within this event window.</p>
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
                      await updateDeviceClassDuration(Number(classDurationHours));
                      setStatusMessage(`Device settings saved for ${updatedDevice.DeviceName}.`);
                      await refreshState(false);
                    })
                  }
                >
                  Save Device Settings
                </Button>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <div className="ibadge-inset-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Device ID</p>
                  <p className="mt-2 break-all text-sm text-slate-900 dark:text-white">{state.device?.DeviceId ?? "Unavailable"}</p>
                </div>
                <div className="ibadge-inset-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Assigned Event</p>
                  <p className="mt-2 text-sm text-slate-900 dark:text-white">{state.device?.ActiveEventName ?? "No event selected"}</p>
                </div>
                <div className="ibadge-inset-sm md:col-span-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Event Duration</p>
                  <p className="mt-2 text-sm text-slate-900 dark:text-white">{formatDurationLabel(state.device?.ClassDurationHours ?? 0.5)}</p>
                </div>
              </div>
            </div>

            <div className="ibadge-card">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Event Management</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">Central event catalog</h2>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Manage your site event catalog</p>
              </div>

              <div className="mt-6 flex flex-col gap-3 lg:flex-row">
                <Input
                  value={newEventName}
                  onChange={(event) => setNewEventName(event.target.value)}
                  placeholder="Create a new event name"
                  className="h-14 rounded-2xl border border-slate-100/90 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-900/80 dark:text-white px-4 text-base"
                />
                <Button
                  className="h-14 rounded-2xl bg-slate-900 text-base font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 lg:min-w-52"
                  disabled={isPending || !newEventName.trim() || !isOnline}
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        const created = await createEvent(newEventName.trim());
                        setNewEventName("");
                        setStatusMessage(`Created event "${created.EventName}".`);
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
                <p className="mt-3 text-sm text-amber-800 dark:text-amber-100/90">Creating new events requires the backend API to be reachable.</p>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant={eventFilter === "active" ? "default" : "outline"}
                  className={eventFilter === "active" ? "h-11 rounded-2xl bg-cyan-400 px-5 text-slate-950 hover:bg-cyan-300" : "h-11 rounded-2xl border border-slate-100/90 bg-white px-5 text-slate-900 hover:bg-sky-50/70 dark:border-white/10 dark:bg-slate-900/80 dark:text-white dark:hover:bg-slate-800"}
                  onClick={() => setEventFilter("active")}
                >
                  Active Events
                </Button>
                <Button
                  type="button"
                  variant={eventFilter === "inactive" ? "default" : "outline"}
                  className={eventFilter === "inactive" ? "h-11 rounded-2xl bg-cyan-400 px-5 text-slate-950 hover:bg-cyan-300" : "h-11 rounded-2xl border border-slate-100/90 bg-white px-5 text-slate-900 hover:bg-sky-50/70 dark:border-white/10 dark:bg-slate-900/80 dark:text-white dark:hover:bg-slate-800"}
                  onClick={() => setEventFilter("inactive")}
                >
                  Inactive Events
                </Button>
              </div>

              <div className="mt-5 space-y-3">
                {visibleEvents.length === 0 ? (
                  <div className="rounded-[1.4rem] border border-dashed border-slate-300 px-4 py-5 dark:border-white/10 text-sm text-slate-500 dark:text-slate-400">
                    No {eventFilter} events found.
                  </div>
                ) : (
                  visibleEvents.map((event) => (
                    <button
                      key={event.EventId}
                      type="button"
                      onClick={() => openEventEditor(event)}
                      className="flex w-full items-center justify-between gap-3 rounded-[1.2rem] border border-slate-100/90 bg-white px-4 py-3 text-left transition hover:border-cyan-500/40 hover:bg-sky-50/70 dark:border-white/10 dark:bg-white/5 dark:hover:border-cyan-400/35 dark:hover:bg-white/[0.08]"
                    >
                      <p className="truncate text-base font-semibold text-slate-900 dark:text-white">{event.EventName}</p>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${event.IsActive ? "bg-emerald-400/15 text-emerald-100" : "bg-slate-700 text-slate-300"}`}>
                        {event.IsActive ? "Active" : "Inactive"}
                      </span>
                    </button>
                  ))
                )}
              </div>

              {filteredEvents.length > 0 ? (
                <div className="mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-2xl border border-slate-100/90 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-900/80 dark:text-white px-5 text-base hover:bg-sky-50/70 dark:hover:bg-slate-800"
                    onClick={() => setEventListOpen(true)}
                  >
                    View Full Event List
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <div className="ibadge-card">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Sync Controls</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">Refresh and retry</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Employee cache refreshes every 12 hours when online and again on reconnect. You can also trigger refresh and queue retry manually here.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between">
                <div className="ibadge-inset sm:min-w-[12rem]">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Employees in cache</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">{state.employees.length}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto min-h-[3.5rem] rounded-2xl border border-slate-100/90 bg-white px-5 py-3 text-base text-slate-900 hover:bg-sky-50/70 dark:border-white/10 dark:bg-slate-900/80 dark:text-white dark:hover:bg-slate-800"
                    disabled={!isOnline}
                    onClick={() => {
                      setCardholderFirstName("");
                      setCardholderLastName("");
                      setCardholderBadge("");
                      setCardholderCompany("");
                      setCardholderEmail("");
                      setCardholderModalOpen(true);
                    }}
                  >
                    <UserPlus className="size-4" />
                    Add a Cardholder
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto min-h-[3.5rem] rounded-2xl border border-slate-100/90 bg-white px-5 py-3 text-base text-slate-900 hover:bg-sky-50/70 dark:border-white/10 dark:bg-slate-900/80 dark:text-white dark:hover:bg-slate-800"
                    onClick={() => setEmployeeListOpen(true)}
                  >
                    View Employee List
                  </Button>
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="employee-search-sync" className="text-sm font-medium text-cyan-900 dark:text-cyan-100">
                  Search employees
                </label>
                <div className="mt-2">
                  <EmployeeSearchField
                    id="employee-search-sync"
                    value={employeeSearchQuery}
                    onChange={setEmployeeSearchQuery}
                    placeholder="Start typing name, email, or badge…"
                    inputClassName="h-12 rounded-2xl border border-slate-100/90 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-900/80 dark:text-white py-2 text-base placeholder:text-slate-500"
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
                    className="mt-3 max-h-64 overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-inner dark:border-white/10 dark:bg-slate-900/60"
                  >
                    {state.employees.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No employees in the local cache yet.</p>
                    ) : filteredEmployees.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No matches yet — keep typing or try another term.</p>
                    ) : (
                      <table className="w-full min-w-[min(100%,28rem)] border-collapse text-left text-sm">
                        <thead className="sticky top-0 z-10 bg-slate-100/95 shadow-[0_1px_0_rgba(0,0,0,0.06)] dark:bg-slate-900/95 dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]">
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
                  className="h-14 rounded-2xl border border-slate-100/90 bg-white text-base text-slate-900 hover:bg-sky-50/70 dark:border-white/10 dark:bg-slate-900/80 dark:text-white dark:hover:bg-slate-800"
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
                <div className="ibadge-inset-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Last Reference Refresh</p>
                  <p className="mt-2 text-sm text-slate-900 dark:text-white">{formatDisplayDate(state.syncMetadata?.LastReferenceRefreshUTC ?? null)}</p>
                </div>
                <div className="ibadge-inset-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Last Queue Sync</p>
                  <p className="mt-2 text-sm text-slate-900 dark:text-white">{formatDisplayDate(state.syncMetadata?.LastQueueSyncUTC ?? null)}</p>
                </div>
              </div>
            </div>

            <div className="ibadge-card">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Queue Snapshot</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">Recent device activity</h2>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Local history remains even after successful sync.</p>
              </div>

              <div className="mt-5 space-y-3">
                {state.recentScans.length === 0 ? (
                  <div className="rounded-[1.4rem] border border-dashed border-slate-300 px-4 py-5 dark:border-white/10 text-sm text-slate-500 dark:text-slate-400">
                    No local scan history has been captured yet.
                  </div>
                ) : (
                  currentEventScans.slice(0, 3).map((scan) => (
                    <button
                      key={scan.DeviceScanGuid}
                      type="button"
                      onClick={() => setScanListOpen(true)}
                      className="ibadge-inset-sm w-full text-left transition hover:border-cyan-400/35 hover:bg-sky-50/70 dark:hover:bg-white/[0.08]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-slate-900 dark:text-white">{scan.EmployeeNameSnapshot ?? "Unknown"}</p>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{scan.BadgeNumberRaw}</p>
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
                    </button>
                  ))
                )}
              </div>
              {currentEventScans.length > 0 ? (
                <div className="mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 rounded-2xl border border-slate-100/90 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-900/80 dark:text-white px-5 text-base hover:bg-sky-50/70 dark:hover:bg-slate-800"
                    onClick={() => setScanListOpen(true)}
                  >
                    View Full Current Event Scan List
                  </Button>
                </div>
              ) : null}
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
            className="ibadge-modal flex min-h-0 max-h-[min(85vh,720px)] w-full max-w-4xl flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
              <div>
                <h3 id="employee-list-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                  Employee list
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {searchHasFilter
                    ? `${filteredEmployees.length} of ${state.employees.length} match`
                    : `${state.employees.length} cached on this device`}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-xl text-slate-500 hover:bg-sky-50/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Close employee list"
                onClick={() => setEmployeeListOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <div className="border-b border-slate-100 px-5 pb-4 dark:border-white/10">
              <label htmlFor="employee-search-modal" className="sr-only">
                Search employees by name or email
              </label>
              <EmployeeSearchField
                id="employee-search-modal"
                value={employeeSearchQuery}
                onChange={setEmployeeSearchQuery}
                placeholder="Filter by name, email, or badge…"
                inputClassName="h-11 rounded-xl border border-slate-100/90 bg-white py-2 text-sm text-slate-900 placeholder:text-slate-500 dark:border-white/10 dark:bg-slate-900/80 dark:text-white"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-1 pb-2 pt-1 sm:px-2">
              <table className="w-full min-w-[min(100%,32rem)] border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100 shadow-[0_1px_0_rgba(0,0,0,0.06)] dark:bg-slate-950 dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]">
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

      {scanListOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setScanListOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="scan-list-title"
            className="ibadge-modal flex min-h-0 max-h-[min(85vh,720px)] w-full max-w-4xl flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
              <div>
                <h3 id="scan-list-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                  Current event scans
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {state.device?.ActiveEventName ?? "No event selected"} on {state.device?.DeviceName ?? "this kiosk"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-xl text-slate-500 hover:bg-sky-50/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Close scan list"
                onClick={() => setScanListOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
              {currentEventScans.length === 0 ? (
                <div className="rounded-[1.4rem] border border-dashed border-slate-300 px-4 py-5 dark:border-white/10 text-sm text-slate-500 dark:text-slate-400">
                  No scans are currently stored for this event on this kiosk.
                </div>
              ) : (
                <div className="space-y-3">
                  {currentEventScans.map((scan) => (
                    <div key={scan.DeviceScanGuid} className="ibadge-inset-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-slate-900 dark:text-white">{scan.EmployeeNameSnapshot ?? "Unknown"}</p>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{scan.BadgeNumberRaw}</p>
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
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {eventListOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setEventListOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-list-title"
            className="ibadge-modal flex min-h-0 max-h-[min(85vh,720px)] w-full max-w-3xl flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
              <div>
                <h3 id="event-list-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                  {eventFilter === "active" ? "Active" : "Inactive"} events
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{filteredEvents.length} event{filteredEvents.length === 1 ? "" : "s"}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-xl text-slate-500 hover:bg-sky-50/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Close event list"
                onClick={() => setEventListOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
              <div className="space-y-3">
                {filteredEvents.map((event) => (
                  <button
                    key={event.EventId}
                    type="button"
                    onClick={() => {
                      setEventListOpen(false);
                      openEventEditor(event);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-[1.2rem] border border-slate-100/90 bg-white px-4 py-3 text-left transition hover:border-cyan-500/40 hover:bg-sky-50/70 dark:border-white/10 dark:bg-white/5 dark:hover:border-cyan-400/35 dark:hover:bg-white/[0.08]"
                  >
                    <p className="truncate text-base font-semibold text-slate-900 dark:text-white">{event.EventName}</p>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${event.IsActive ? "bg-emerald-400/15 text-emerald-100" : "bg-slate-700 text-slate-300"}`}>
                      {event.IsActive ? "Active" : "Inactive"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {eventEditorOpen && selectedEvent ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setEventEditorOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-editor-title"
            className="ibadge-modal w-full max-w-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
              <div>
                <h3 id="event-editor-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                  Edit event
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{selectedEvent.EventId}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-xl text-slate-500 hover:bg-sky-50/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Close event editor"
                onClick={() => setEventEditorOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <div className="space-y-5 px-5 py-5">
              <div>
                <label className="text-sm font-medium text-cyan-900 dark:text-cyan-100">Event name</label>
                <Input
                  value={eventEditName}
                  onChange={(event) => setEventEditName(event.target.value)}
                  className="mt-2 h-12 rounded-2xl border border-slate-100/90 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-900/80 dark:text-white px-4 text-base"
                />
              </div>
              <div className="flex items-center justify-between rounded-[1.2rem] border border-slate-100/90 bg-white px-4 py-4 dark:border-white/10 dark:bg-white/5">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Event status</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Inactive events stay in the catalog but will not be shown as active.</p>
                </div>
                <Button
                  type="button"
                  variant={eventEditIsActive ? "default" : "outline"}
                  className={eventEditIsActive ? "h-10 rounded-2xl bg-emerald-400 px-4 text-slate-950 hover:bg-emerald-300" : "h-10 rounded-2xl border border-slate-100/90 bg-white px-4 text-slate-900 hover:bg-sky-50/70 dark:border-white/10 dark:bg-slate-900/80 dark:text-white dark:hover:bg-slate-800"}
                  onClick={() => setEventEditIsActive((current) => !current)}
                >
                  {eventEditIsActive ? "Active" : "Inactive"}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 px-5 py-4 dark:border-white/10">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-2xl border border-slate-100/90 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-900/80 dark:text-white px-5 text-base hover:bg-sky-50/70 dark:hover:bg-slate-800"
                onClick={() => setEventEditorOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-11 rounded-2xl bg-cyan-400 px-5 text-base font-semibold text-slate-950 hover:bg-cyan-300"
                disabled={isPending || !eventEditName.trim()}
                onClick={() =>
                  startTransition(async () => {
                    try {
                      const updated = await updateEvent(selectedEvent.EventId, {
                        name: eventEditName.trim(),
                        isActive: eventEditIsActive,
                      });
                      setStatusMessage(`Updated event "${updated.EventName}".`);
                      setEventEditorOpen(false);
                      await refreshState(true);
                    } catch (error) {
                      setStatusMessage(error instanceof Error ? error.message : "Unable to update event.");
                    }
                  })
                }
              >
                Save Event
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {cardholderModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setCardholderModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cardholder-title"
            className="w-full max-w-lg rounded-[1.75rem] border border-sky-200/80 bg-gradient-to-b from-sky-50/95 to-cyan-50/85 shadow-xl shadow-sky-200/25 backdrop-blur dark:border-sky-400/25 dark:from-sky-800/80 dark:to-sky-950/95 dark:shadow-[0_25px_60px_rgba(0,0,0,0.35),0_0_100px_-30px_rgba(56,189,248,0.2)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-sky-200/70 px-5 py-4 dark:border-sky-500/25">
              <div>
                <h3 id="cardholder-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                  Add a cardholder
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Creates or updates <span className="font-medium text-slate-700 dark:text-slate-300">dbo.Employee</span> (name, badge, company, email), then refreshes the local cache.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-xl text-slate-500 hover:bg-sky-50/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Close"
                onClick={() => setCardholderModalOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="cardholder-first" className="text-sm font-medium text-cyan-900 dark:text-cyan-100">
                    First name <span className="text-rose-600 dark:text-rose-300">*</span>
                  </label>
                  <Input
                    id="cardholder-first"
                    value={cardholderFirstName}
                    onChange={(event) => setCardholderFirstName(event.target.value)}
                    placeholder="First name"
                    autoComplete="given-name"
                    className="mt-2 h-12 rounded-2xl border border-slate-100/90 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-900/80 dark:text-white px-4 text-base"
                  />
                </div>
                <div>
                  <label htmlFor="cardholder-last" className="text-sm font-medium text-cyan-900 dark:text-cyan-100">
                    Last name <span className="text-rose-600 dark:text-rose-300">*</span>
                  </label>
                  <Input
                    id="cardholder-last"
                    value={cardholderLastName}
                    onChange={(event) => setCardholderLastName(event.target.value)}
                    placeholder="Last name"
                    autoComplete="family-name"
                    className="mt-2 h-12 rounded-2xl border border-slate-100/90 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-900/80 dark:text-white px-4 text-base"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="cardholder-badge" className="text-sm font-medium text-cyan-900 dark:text-cyan-100">
                  Badge number <span className="text-rose-600 dark:text-rose-300">*</span>
                </label>
                <Input
                  id="cardholder-badge"
                  value={cardholderBadge}
                  onChange={(event) => setCardholderBadge(event.target.value)}
                  placeholder="e.g. 12345"
                  autoComplete="off"
                  className="mt-2 h-12 rounded-2xl border border-slate-100/90 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-900/80 dark:text-white px-4 text-base"
                />
              </div>
              <div>
                <label htmlFor="cardholder-company" className="text-sm font-medium text-cyan-900 dark:text-cyan-100">
                  Company #
                </label>
                <Input
                  id="cardholder-company"
                  value={cardholderCompany}
                  onChange={(event) => setCardholderCompany(event.target.value)}
                  placeholder="Optional"
                  autoComplete="off"
                  className="mt-2 h-12 rounded-2xl border border-slate-100/90 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-900/80 dark:text-white px-4 text-base"
                />
              </div>
              <div>
                <label htmlFor="cardholder-email" className="text-sm font-medium text-cyan-900 dark:text-cyan-100">
                  Email
                </label>
                <Input
                  id="cardholder-email"
                  type="email"
                  value={cardholderEmail}
                  onChange={(event) => setCardholderEmail(event.target.value)}
                  placeholder="Optional"
                  autoComplete="off"
                  className="mt-2 h-12 rounded-2xl border border-slate-100/90 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-900/80 dark:text-white px-4 text-base"
                />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t border-sky-200/70 px-5 py-4 dark:border-sky-500/25">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-2xl border border-sky-200/60 bg-white/90 text-slate-900 dark:border-white/10 dark:bg-slate-900/80 dark:text-white px-5 text-base hover:bg-sky-100/80 dark:hover:bg-slate-800"
                onClick={() => setCardholderModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-11 rounded-2xl bg-cyan-400 px-5 text-base font-semibold text-slate-950 hover:bg-cyan-300"
                disabled={
                  isPending ||
                  !cardholderFirstName.trim() ||
                  !cardholderLastName.trim() ||
                  !cardholderBadge.trim()
                }
                onClick={() =>
                  startTransition(async () => {
                    const device = state.device;
                    if (!device) {
                      setStatusMessage("Device not ready yet.");
                      return;
                    }
                    if (!isOnline) {
                      setStatusMessage("Saving a cardholder requires a connection to the API and database.");
                      return;
                    }
                    try {
                      await addCardholderAndRefresh(
                        {
                          firstName: cardholderFirstName.trim(),
                          lastName: cardholderLastName.trim(),
                          badgeNumber: cardholderBadge.trim(),
                          email: cardholderEmail.trim() || null,
                          companyNum: cardholderCompany.trim() || null,
                        },
                        device
                      );
                      setStatusMessage(
                        `Cardholder saved: ${cardholderFirstName.trim()} ${cardholderLastName.trim()} (${cardholderBadge.trim()}). Employee list updated.`
                      );
                      setCardholderModalOpen(false);
                      setCardholderFirstName("");
                      setCardholderLastName("");
                      setCardholderBadge("");
                      setCardholderCompany("");
                      setCardholderEmail("");
                      await refreshState(false);
                    } catch (error) {
                      setStatusMessage(error instanceof Error ? error.message : "Unable to save cardholder.");
                    }
                  })
                }
              >
                Save to database
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
