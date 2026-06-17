"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition, type ComponentProps, type ReactNode } from "react";
import {
  ArrowLeft,
  Bell,
  ListChecks,
  Moon,
  RefreshCcw,
  Search,
  Settings,
  Sun,
  UserCircle2,
  UserPlus,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIbadgeTheme } from "@/components/theme-provider";
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
import { clampClassDurationHours, formatDisplayDate } from "@/lib/kiosk-utils";
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

const FALLBACK_EVENTS = [
  { id: "test-111", name: "Test 111", status: "Active", kiosks: 3, start: "8:00 AM", duration: "15 min" },
  { id: "tuesday-class", name: "Tuesday Class", status: "Active", kiosks: 5, start: "9:00 AM", duration: "1 hr" },
  { id: "excel-training", name: "Excel Training", status: "Active", kiosks: 8, start: "10:00 AM", duration: "30 min" },
];

const FALLBACK_PENDING = [
  { id: "p1", name: "Alex Johnson", event: "Excel Training", time: "10:24 AM" },
  { id: "p2", name: "Maria Gonzalez", event: "Excel Training", time: "10:23 AM" },
  { id: "p3", name: "David Kim", event: "Test 111", time: "10:22 AM" },
  { id: "p4", name: "Taylor Smith", event: "Excel Training", time: "10:21 AM" },
  { id: "p5", name: "Jordan Lee", event: "Tuesday Class", time: "10:20 AM" },
];

const FALLBACK_ACTIVITY = [
  { id: "a1", device: "Attendance Kiosk E57F", event: "Excel Training", action: "Scan synced", detail: "Alex Johnson", time: "10:24:31 AM", status: "Success" },
  { id: "a2", device: "Attendance Kiosk B21A", event: "Test 111", action: "Cache refreshed", detail: "171 employees", time: "10:23:02 AM", status: "Success" },
  { id: "a3", device: "Attendance Kiosk C33B", event: "Tuesday Class", action: "Device online", detail: "Connection restored", time: "10:22:11 AM", status: "Info" },
  { id: "a4", device: "Attendance Kiosk D44C", event: "Excel Training", action: "Queue retry completed", detail: "3 items synced", time: "10:21:45 AM", status: "Success" },
  { id: "a5", device: "Attendance Kiosk E57F", event: "Excel Training", action: "Scan queued", detail: "Maria Gonzalez", time: "10:21:09 AM", status: "Pending" },
];

function formatDurationLabel(hours: number) {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return hours % 1 === 0 ? `${hours.toFixed(0)} hr${hours === 1 ? "" : "s"}` : `${hours} hrs`;
}

function formatTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function AdminThemeToggle() {
  const { theme, setTheme } = useIbadgeTheme();
  const isDark = theme === "dark";

  return (
    <div className="flex items-center justify-end gap-3">
      <span className="hidden text-sm font-medium text-white/68 sm:inline">Appearance</span>
      <div className="flex items-center gap-2 rounded-2xl border border-cyan-300/15 bg-[#071a33]/70 px-3 py-2 shadow-[0_0_24px_rgba(25,212,255,0.08)] backdrop-blur">
        <Sun className={cn("size-5 shrink-0", isDark ? "text-white/40" : "text-cyan-200")} aria-hidden />
        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className={cn(
            "relative inline-flex h-9 w-[3.25rem] shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#031225]",
            isDark ? "border-cyan-300/20 bg-[#031225]" : "border-cyan-300/50 bg-cyan-300/20"
          )}
        >
          <span
            className={cn(
              "pointer-events-none block size-7 rounded-full bg-white shadow-[0_0_16px_rgba(25,212,255,0.5)] ring-1 ring-cyan-200/40 transition-transform",
              isDark ? "translate-x-[1.35rem]" : "translate-x-0.5"
            )}
          />
        </button>
        <Moon className={cn("size-5 shrink-0", isDark ? "text-cyan-200" : "text-white/40")} aria-hidden />
      </div>
    </div>
  );
}

function PanelCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "rounded-[1.6rem] border border-[rgba(64,148,255,0.25)] bg-[#071a33]/78 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22),0_0_64px_rgba(25,212,255,0.045)_inset] backdrop-blur",
        className
      )}
    >
      {children}
    </section>
  );
}

function PanelHeading({ label, title, description }: { label: string; title: string; description?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-cyan-100/62 tracking-[0.24em]">{label}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-normal text-white">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-white/68">{description}</p> : null}
    </div>
  );
}

function StatusPill({ tone, children }: { tone: "success" | "info" | "pending" | "muted"; children: ReactNode }) {
  const styles = {
    success: "border-emerald-300/20 bg-emerald-400/12 text-emerald-300",
    info: "border-cyan-300/20 bg-cyan-400/12 text-cyan-200",
    pending: "border-amber-300/20 bg-amber-400/12 text-amber-300",
    muted: "border-white/10 bg-white/8 text-white/64",
  };

  return <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold", styles[tone])}>{children}</span>;
}

function GlowButton({ children, className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      className={cn(
        "h-12 rounded-2xl bg-cyan-400 px-5 text-base font-semibold text-slate-950 shadow-[0_0_24px_rgba(25,212,255,0.22)] hover:bg-cyan-300 focus-visible:ring-cyan-300 focus-visible:ring-offset-[#031225]",
        className
      )}
    >
      {children}
    </Button>
  );
}

function OutlineGlowButton({ children, className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      variant={props.variant ?? "outline"}
      className={cn(
        "h-12 rounded-2xl border border-cyan-300/20 bg-[#071a33]/70 px-5 text-base font-semibold text-white shadow-[0_0_22px_rgba(25,212,255,0.06)] hover:border-cyan-300/45 hover:bg-cyan-300/10 focus-visible:ring-cyan-300 focus-visible:ring-offset-[#031225]",
        className
      )}
    >
      {children}
    </Button>
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
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-cyan-100/50" aria-hidden />
      <Input
        id={id}
        type="text"
        inputMode="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={cn(inputClassName, "pl-11")}
      />
    </div>
  );
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
  const [eventListOpen, setEventListOpen] = useState(false);
  const [eventEditorOpen, setEventEditorOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);
  const [eventEditName, setEventEditName] = useState("");
  const [eventEditIsActive, setEventEditIsActive] = useState(true);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [eventFilter, setEventFilter] = useState<"active" | "inactive">("active");
  const [classDurationHours, setClassDurationHours] = useState("0.5");
  const [cardholderModalOpen, setCardholderModalOpen] = useState(false);
  const [cardholderFirstName, setCardholderFirstName] = useState("");
  const [cardholderLastName, setCardholderLastName] = useState("");
  const [cardholderBadge, setCardholderBadge] = useState("");
  const [cardholderCompany, setCardholderCompany] = useState("");
  const [cardholderEmail, setCardholderEmail] = useState("");

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
    setClassDurationHours(String(clampClassDurationHours(snapshot.device?.ClassDurationHours ?? 0.5)));
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

  const filteredEmployees = useMemo(() => {
    const q = employeeSearchQuery.trim().toLowerCase();
    const employees = [...state.employees].sort((a, b) => a.EmployeeName.localeCompare(b.EmployeeName));
    if (!q) return employees;
    return employees.filter((employee) => {
      return (
        employee.EmployeeName.toLowerCase().includes(q) ||
        (employee.Email ?? "").toLowerCase().includes(q) ||
        employee.BadgeNumberRaw.toLowerCase().includes(q)
      );
    });
  }, [employeeSearchQuery, state.employees]);

  const filteredEvents = useMemo(() => state.events.filter((event) => (eventFilter === "active" ? event.IsActive : !event.IsActive)), [eventFilter, state.events]);
  const activeEventName = state.device?.ActiveEventName ?? "Excel Training";
  const referenceRefreshLabel = formatDisplayDate(state.syncMetadata?.LastReferenceRefreshUTC ?? "2026-04-27T23:00:47.000Z");
  const queueSyncLabel = formatDisplayDate(state.syncMetadata?.LastQueueSyncUTC ?? null);
  const eventRows =
    filteredEvents.length > 0
      ? filteredEvents.slice(0, 3).map((event, index) => ({
          id: event.EventId,
          name: event.EventName,
          status: event.IsActive ? "Active" : "Inactive",
          kiosks: [3, 5, 8][index] ?? 1,
          start: ["8:00 AM", "9:00 AM", "10:00 AM"][index] ?? "10:00 AM",
          duration: formatDurationLabel(index === 0 ? 0.25 : index === 1 ? 1 : state.device?.ClassDurationHours ?? 0.5),
          source: event,
        }))
      : FALLBACK_EVENTS.map((event) => ({ ...event, source: null }));
  const pendingRows =
    state.pendingScans.length > 0
      ? state.pendingScans.slice(0, 5).map((scan) => ({
          id: scan.DeviceScanGuid,
          name: scan.EmployeeNameSnapshot ?? "Unknown",
          event: scan.EventNameSnapshot ?? activeEventName,
          time: formatTime(scan.ScanUTC).replace(/:\d{2}\s/, " "),
        }))
      : FALLBACK_PENDING;
  const activityRows =
    state.recentScans.length > 0
      ? state.recentScans.slice(0, 5).map((scan) => ({
          id: scan.DeviceScanGuid,
          device: scan.DeviceDisplayName || state.device?.DeviceName || "Attendance Kiosk E57F",
          event: scan.EventNameSnapshot ?? activeEventName,
          action: scan.SyncStatus === "SYNCED" ? "Scan synced" : "Scan queued",
          detail: scan.EmployeeNameSnapshot ?? scan.BadgeNumberRaw,
          time: formatTime(scan.ScanUTC),
          status: scan.SyncStatus === "SYNCED" ? "Success" : "Pending",
        }))
      : FALLBACK_ACTIVITY;

  function openEventEditor(event: EventRecord) {
    setSelectedEvent(event);
    setEventEditName(event.EventName);
    setEventEditIsActive(event.IsActive);
    setEventEditorOpen(true);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#031225] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(25,212,255,0.12),transparent_34%),linear-gradient(160deg,#031225_0%,#041a33_55%,#020817_100%)]" />
      <div className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-6 py-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Image
            src="/ibadge-full.png"
            alt="iBadge"
            width={210}
            height={84}
            priority
            className="h-auto w-[170px] brightness-125 saturate-150 drop-shadow-[0_0_26px_rgba(37,184,255,0.32)]"
          />
          <div className="flex items-center gap-3">
            <OutlineGlowButton asChild>
              <Link href="/">
                <ArrowLeft className="size-4" aria-hidden />
                Kiosk
              </Link>
            </OutlineGlowButton>
            <GlowButton asChild>
              <Link href="/admin/review">Open Review</Link>
            </GlowButton>
            <OutlineGlowButton asChild>
              <Link href="/admin/attendees">Attendee Page</Link>
            </OutlineGlowButton>
            <AdminThemeToggle />
            <OutlineGlowButton type="button" size="icon" aria-label="Notifications" className="size-12 p-0">
              <Bell className="size-5" aria-hidden />
            </OutlineGlowButton>
            <OutlineGlowButton type="button" className="gap-2">
              <UserCircle2 className="size-5" aria-hidden />
              Admin
            </OutlineGlowButton>
          </div>
        </header>

        <section className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div>
            <p className="text-xs font-semibold uppercase text-cyan-100/62 tracking-[0.32em]">Admin Console</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-normal text-white md:text-5xl">Operations Control Center</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-white/72">
              Monitor attendance kiosks, manage events, and maintain system operations across your organization.
            </p>
          </div>
        </section>

        {statusMessage ? (
          <div className="rounded-[1.25rem] border border-cyan-300/30 bg-cyan-400/10 px-5 py-4 text-sm text-cyan-50 shadow-[0_0_28px_rgba(25,212,255,0.08)]">
            {statusMessage}
          </div>
        ) : null}

        <div className="flex flex-col gap-4 rounded-[1.35rem] border border-cyan-300/15 bg-[#071a33]/64 px-6 py-4 text-sm text-white/68 shadow-[0_0_34px_rgba(25,212,255,0.06)_inset] md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 font-semibold text-emerald-300">
            <span className="size-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(40,224,112,0.9)]" aria-hidden />
            {isOnline ? "All systems normal" : "Offline mode active"}
          </div>
          <p>Last reference refresh: {referenceRefreshLabel}</p>
          <p>Auto-refresh <span className="ml-4 text-white">30s</span></p>
        </div>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <PanelCard>
            <div className="flex items-start justify-between gap-4">
              <PanelHeading label="Active Kiosk" title={state.device?.DeviceName ?? "Attendance Kiosk E57F"} />
              <div className={cn("inline-flex items-center gap-2 font-semibold", isOnline ? "text-emerald-300" : "text-amber-300")}>
                {isOnline ? <Wifi className="size-5" aria-hidden /> : <WifiOff className="size-5" aria-hidden />}
                {isOnline ? "Online" : "Offline"}
              </div>
            </div>
            <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
              <div className="flex justify-center">
                <div className="relative h-[300px] w-[168px] rounded-[1.4rem] border-4 border-white/35 bg-[#04152d] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.4),0_0_44px_rgba(25,212,255,0.16)]">
                  <div className="flex h-full items-center justify-center rounded-[1rem] border border-cyan-300/10 bg-[radial-gradient(circle_at_50%_40%,rgba(25,212,255,0.16),transparent_45%),#061a36]">
                    <Image src="/ibadge-favicon.png" alt="" width={80} height={80} className="h-20 w-20 object-contain brightness-125 saturate-150" />
                  </div>
                  <span className="absolute -bottom-8 left-1/2 h-8 w-20 -translate-x-1/2 rounded-b-xl bg-slate-800 shadow-[0_0_18px_rgba(25,212,255,0.5)]" />
                </div>
              </div>
              <dl className="grid content-start gap-x-8 gap-y-6 sm:grid-cols-2">
                {[
                  ["Device ID", state.device?.DeviceId ?? "2011"],
                  ["Location", "North Lobby"],
                  ["Active Event", activeEventName],
                  ["Event Duration", formatDurationLabel(state.device?.ClassDurationHours ?? 0.5)],
                  ["Last Seen", "Just now"],
                  ["IP Address", "10.1.4.57"],
                  ["Firmware", "v2.4.1"],
                  ["Uptime", "2d 14h 32m"],
                ].map(([label, value]) => (
                  <div key={label} className="border-b border-white/8 pb-4">
                    <dt className="text-xs font-semibold uppercase text-white/48 tracking-[0.18em]">{label}</dt>
                    <dd className={cn("mt-2 break-all text-base font-semibold text-white", label === "Active Event" && "text-cyan-300")}>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <GlowButton
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const updatedDevice = await updateDeviceConfiguration(deviceNameDraft, activeEventId === "none" ? null : activeEventId, state.events);
                    await updateDeviceClassDuration(Number(classDurationHours));
                    setStatusMessage(`Device settings saved for ${updatedDevice.DeviceName}.`);
                    await refreshState(false);
                  })
                }
              >
                <Settings className="size-4" aria-hidden />
                Edit Device Settings
              </GlowButton>
              <OutlineGlowButton type="button" onClick={() => setStatusMessage(`Device ${state.device?.DeviceId ?? "2011"} is assigned to ${activeEventName}.`)}>
                View Device Details
              </OutlineGlowButton>
            </div>
          </PanelCard>

          <PanelCard>
            <PanelHeading
              label="Sync Controls"
              title="Refresh and Retry"
              description="Employee cache refreshes every 12 hours when online and again on reconnect. Trigger refresh or queue retry manually here."
            />
            <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
              <div className="rounded-[1rem] border border-cyan-300/12 bg-white/[0.045] p-4">
                <p className="text-xs font-semibold uppercase text-white/48 tracking-[0.16em]">Employees in Cache</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums">{state.employees.length || 171}</p>
              </div>
              <OutlineGlowButton
                type="button"
                disabled={!isOnline}
                className="h-full min-h-16"
                onClick={() => {
                  setCardholderFirstName("");
                  setCardholderLastName("");
                  setCardholderBadge("");
                  setCardholderCompany("");
                  setCardholderEmail("");
                  setCardholderModalOpen(true);
                }}
              >
                <UserPlus className="size-4" aria-hidden />
                Add a Cardholder
              </OutlineGlowButton>
              <OutlineGlowButton type="button" className="h-full min-h-16" onClick={() => setEmployeeListOpen(true)}>
                <ListChecks className="size-4" aria-hidden />
                View Employee List
              </OutlineGlowButton>
            </div>
            <div className="mt-6">
              <label htmlFor="employee-search-sync" className="text-sm font-medium text-white/82">
                Search employees
              </label>
              <EmployeeSearchField
                id="employee-search-sync"
                value={employeeSearchQuery}
                onChange={setEmployeeSearchQuery}
                placeholder="Start typing name, email, or badge..."
                inputClassName="mt-2 h-14 rounded-2xl border border-cyan-300/15 bg-[#031225]/65 py-2 text-base text-white placeholder:text-white/42"
              />
            </div>
            <div className="mt-6 grid gap-3">
              <GlowButton
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const device = state.device;
                    if (!device) return;
                    const refreshed = await refreshReferenceData(true, device);
                    setStatusMessage(`Reference data refreshed. ${refreshed.employees.length} employees and ${refreshed.events.length} events are cached on this device.`);
                    await refreshState(false);
                  })
                }
              >
                <RefreshCcw className="size-4" aria-hidden />
                Refresh Employee and Event Cache
              </GlowButton>
              <OutlineGlowButton
                type="button"
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
              </OutlineGlowButton>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div className="rounded-[1rem] border border-cyan-300/12 bg-white/[0.045] p-4">
                <p className="text-xs font-semibold uppercase text-white/48 tracking-[0.16em]">Last Reference Refresh</p>
                <p className="mt-2 text-sm font-medium text-white">{referenceRefreshLabel}</p>
              </div>
              <div className="rounded-[1rem] border border-cyan-300/12 bg-white/[0.045] p-4">
                <p className="text-xs font-semibold uppercase text-white/48 tracking-[0.16em]">Last Queue Sync</p>
                <p className="mt-2 text-sm font-medium text-white">{queueSyncLabel}</p>
              </div>
            </div>
          </PanelCard>

          <PanelCard>
            <PanelHeading label="Event Management" title="Central event catalog" description="Create and manage events across all kiosks." />
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Input
                aria-label="Create a new event name"
                value={newEventName}
                onChange={(event) => setNewEventName(event.target.value)}
                placeholder="Create a new event name"
                className="h-14 rounded-2xl border border-cyan-300/15 bg-[#031225]/65 px-4 text-base text-white placeholder:text-white/42"
              />
              <GlowButton
                type="button"
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
              </GlowButton>
            </div>
            <div className="mt-6 flex gap-3">
              <GlowButton type="button" className={cn("h-11", eventFilter !== "active" && "bg-cyan-400/12 text-cyan-200 hover:bg-cyan-400/18")} onClick={() => setEventFilter("active")}>
                Active Events
              </GlowButton>
              <OutlineGlowButton type="button" className="h-11" onClick={() => setEventFilter("inactive")}>
                Inactive Events
              </OutlineGlowButton>
            </div>
            <div className="mt-6 overflow-hidden rounded-[1rem] border border-cyan-300/12">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#031225]/70 text-xs uppercase text-white/48 tracking-[0.12em]">
                  <tr>
                    <th className="px-4 py-3">Event Name</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Kiosks</th>
                    <th className="px-4 py-3">Start Time</th>
                    <th className="px-4 py-3">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {eventRows.map((event) => (
                    <tr key={event.id} className="cursor-pointer border-t border-white/8 text-white/82 hover:bg-cyan-300/[0.035]" onClick={() => event.source && openEventEditor(event.source)}>
                      <td className="px-4 py-4 font-semibold text-white">{event.name}</td>
                      <td className="px-4 py-4"><StatusPill tone={event.status === "Active" ? "success" : "muted"}>{event.status}</StatusPill></td>
                      <td className="px-4 py-4">{event.kiosks}</td>
                      <td className="px-4 py-4">{event.start}</td>
                      <td className="px-4 py-4">{event.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <OutlineGlowButton type="button" className="mt-6 w-full" onClick={() => setEventListOpen(true)}>
              View Full Event List
            </OutlineGlowButton>
          </PanelCard>

          <PanelCard>
            <PanelHeading label="Queue Snapshot" title="Pending scans" description="Scans awaiting sync to server." />
            <div className="mt-6 flex items-end gap-3">
              <p className="text-5xl font-semibold tabular-nums">{state.pendingScans.length || 5}</p>
              <p className="pb-2 text-white/54">Total pending</p>
            </div>
            <div className="mt-7 rounded-[1rem] border border-cyan-300/12">
              <p className="border-b border-white/8 px-4 py-3 text-xs font-semibold uppercase text-white/48 tracking-[0.16em]">Pending Items</p>
              <div className="divide-y divide-white/8">
                {pendingRows.map((scan) => (
                  <div key={scan.id} className="grid grid-cols-[1fr_1fr_auto] gap-4 px-4 py-3 text-sm text-white/78">
                    <span className="font-semibold text-white">{scan.name}</span>
                    <span>{scan.event}</span>
                    <span>{scan.time}</span>
                  </div>
                ))}
              </div>
            </div>
            <OutlineGlowButton type="button" className="mt-6 w-full" onClick={() => setScanListOpen(true)}>
              View Full Queue
            </OutlineGlowButton>
          </PanelCard>

          <PanelCard className="xl:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <PanelHeading label="Recent Device Activity" title="Live system activity feed" />
              <OutlineGlowButton type="button" onClick={() => setScanListOpen(true)}>View Full Activity Log</OutlineGlowButton>
            </div>
            <div className="mt-6 overflow-x-auto rounded-[1rem] border border-cyan-300/12">
              <table className="w-full min-w-[900px] text-left text-sm">
                <tbody className="divide-y divide-white/8">
                  {activityRows.map((row) => (
                    <tr key={row.id} className="bg-white/[0.025] text-white/76">
                      <td className="px-4 py-4 font-semibold text-white">{row.device}</td>
                      <td className="px-4 py-4">{row.event}</td>
                      <td className="px-4 py-4">{row.action}</td>
                      <td className="px-4 py-4">{row.detail}</td>
                      <td className="px-4 py-4 tabular-nums">{row.time}</td>
                      <td className="px-4 py-4">
                        <StatusPill tone={row.status === "Success" ? "success" : row.status === "Info" ? "info" : "pending"}>{row.status}</StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PanelCard>
        </section>

        <footer className="grid gap-4 rounded-[1.25rem] border border-cyan-300/12 bg-[#071a33]/70 px-6 py-4 text-sm text-white/66 md:grid-cols-4">
          <p><span className="text-emerald-300">System Status: Healthy</span></p>
          <p>All services operational</p>
          <p>Uptime: 15d 7h 42m</p>
          <p className="md:text-right">Version: 2.4.1</p>
        </footer>
      </div>

      {employeeListOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="presentation" onClick={() => setEmployeeListOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="employee-list-title" className="flex min-h-0 max-h-[min(85vh,720px)] w-full max-w-4xl flex-col rounded-[1.75rem] border border-cyan-300/20 bg-[#071a33] text-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-cyan-300/12 px-5 py-4">
              <div>
                <h3 id="employee-list-title" className="text-lg font-semibold">Employee list</h3>
                <p className="mt-1 text-sm text-white/60">{filteredEmployees.length} of {state.employees.length || 171} cached employees</p>
              </div>
              <OutlineGlowButton type="button" size="icon" className="size-10 p-0" aria-label="Close employee list" onClick={() => setEmployeeListOpen(false)}>
                <X className="size-5" />
              </OutlineGlowButton>
            </div>
            <div className="border-b border-cyan-300/12 px-5 pb-4">
              <label htmlFor="employee-search-modal" className="sr-only">Search employees</label>
              <EmployeeSearchField
                id="employee-search-modal"
                value={employeeSearchQuery}
                onChange={setEmployeeSearchQuery}
                placeholder="Filter by name, email, or badge..."
                inputClassName="h-11 rounded-xl border border-cyan-300/15 bg-[#031225]/65 py-2 text-sm text-white placeholder:text-white/42"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="text-xs uppercase text-white/48 tracking-[0.16em]">
                  <tr><th className="py-2">Name</th><th>Email</th><th>Badge</th></tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {(filteredEmployees.length ? filteredEmployees : []).map((employee) => (
                    <tr key={`${employee.BadgeNumberNormalized}-${employee.EmpID ?? ""}`}>
                      <td className="py-3 font-semibold">{employee.EmployeeName}</td>
                      <td className="py-3 text-white/68">{employee.Email ?? "Not available"}</td>
                      <td className="py-3 text-white/68">{employee.BadgeNumberRaw}</td>
                    </tr>
                  ))}
                  {filteredEmployees.length === 0 ? <tr><td colSpan={3} className="py-8 text-center text-white/50">No employees match your search.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {scanListOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="presentation" onClick={() => setScanListOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="scan-list-title" className="flex min-h-0 max-h-[min(85vh,720px)] w-full max-w-4xl flex-col rounded-[1.75rem] border border-cyan-300/20 bg-[#071a33] text-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-cyan-300/12 px-5 py-4">
              <div>
                <h3 id="scan-list-title" className="text-lg font-semibold">Current event scans</h3>
                <p className="mt-1 text-sm text-white/60">{activeEventName} on {state.device?.DeviceName ?? "this kiosk"}</p>
              </div>
              <OutlineGlowButton type="button" size="icon" className="size-10 p-0" aria-label="Close scan list" onClick={() => setScanListOpen(false)}>
                <X className="size-5" />
              </OutlineGlowButton>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
              <div className="space-y-3">
                {(state.pendingScans.length ? state.pendingScans : state.recentScans).slice(0, 30).map((scan) => (
                  <div key={scan.DeviceScanGuid} className="rounded-2xl border border-cyan-300/12 bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{scan.EmployeeNameSnapshot ?? "Unknown"}</p>
                        <p className="mt-1 text-sm text-white/60">{scan.EventNameSnapshot ?? activeEventName}</p>
                      </div>
                      <StatusPill tone={scan.SyncStatus === "SYNCED" ? "success" : "pending"}>{scan.SyncStatus}</StatusPill>
                    </div>
                  </div>
                ))}
                {state.pendingScans.length === 0 && state.recentScans.length === 0 ? <p className="rounded-2xl border border-dashed border-cyan-300/20 p-5 text-white/55">No local scan history has been captured yet.</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {eventListOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="presentation" onClick={() => setEventListOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="event-list-title" className="flex min-h-0 max-h-[min(85vh,720px)] w-full max-w-3xl flex-col rounded-[1.75rem] border border-cyan-300/20 bg-[#071a33] text-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-cyan-300/12 px-5 py-4">
              <div>
                <h3 id="event-list-title" className="text-lg font-semibold">{eventFilter === "active" ? "Active" : "Inactive"} events</h3>
                <p className="mt-1 text-sm text-white/60">{filteredEvents.length} event{filteredEvents.length === 1 ? "" : "s"}</p>
              </div>
              <OutlineGlowButton type="button" size="icon" className="size-10 p-0" aria-label="Close event list" onClick={() => setEventListOpen(false)}>
                <X className="size-5" />
              </OutlineGlowButton>
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
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-cyan-300/12 bg-white/[0.04] px-4 py-3 text-left hover:bg-cyan-300/10"
                  >
                    <span className="font-semibold">{event.EventName}</span>
                    <StatusPill tone={event.IsActive ? "success" : "muted"}>{event.IsActive ? "Active" : "Inactive"}</StatusPill>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {eventEditorOpen && selectedEvent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="presentation" onClick={() => setEventEditorOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="event-editor-title" className="w-full max-w-2xl rounded-[1.75rem] border border-cyan-300/20 bg-[#071a33] text-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-cyan-300/12 px-5 py-4">
              <div>
                <h3 id="event-editor-title" className="text-lg font-semibold">Edit event</h3>
                <p className="mt-1 text-sm text-white/60">{selectedEvent.EventId}</p>
              </div>
              <OutlineGlowButton type="button" size="icon" className="size-10 p-0" aria-label="Close event editor" onClick={() => setEventEditorOpen(false)}>
                <X className="size-5" />
              </OutlineGlowButton>
            </div>
            <div className="space-y-5 px-5 py-5">
              <div>
                <label htmlFor="event-name" className="text-sm font-medium text-white/82">Event name</label>
                <Input id="event-name" value={eventEditName} onChange={(event) => setEventEditName(event.target.value)} className="mt-2 h-12 rounded-2xl border border-cyan-300/15 bg-[#031225]/65 px-4 text-base text-white" />
              </div>
              <OutlineGlowButton type="button" onClick={() => setEventEditIsActive((current) => !current)}>
                {eventEditIsActive ? "Active" : "Inactive"}
              </OutlineGlowButton>
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t border-cyan-300/12 px-5 py-4">
              <OutlineGlowButton type="button" onClick={() => setEventEditorOpen(false)}>Cancel</OutlineGlowButton>
              <GlowButton
                type="button"
                disabled={isPending || !eventEditName.trim()}
                onClick={() =>
                  startTransition(async () => {
                    try {
                      const updated = await updateEvent(selectedEvent.EventId, { name: eventEditName.trim(), isActive: eventEditIsActive });
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
              </GlowButton>
            </div>
          </div>
        </div>
      ) : null}

      {cardholderModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="presentation" onClick={() => setCardholderModalOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="cardholder-title" className="w-full max-w-lg rounded-[1.75rem] border border-cyan-300/20 bg-[#071a33] text-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-cyan-300/12 px-5 py-4">
              <div>
                <h3 id="cardholder-title" className="text-lg font-semibold">Add a cardholder</h3>
                <p className="mt-1 text-sm text-white/60">Creates or updates the employee record, then refreshes the local cache.</p>
              </div>
              <OutlineGlowButton type="button" size="icon" className="size-10 p-0" aria-label="Close" onClick={() => setCardholderModalOpen(false)}>
                <X className="size-5" />
              </OutlineGlowButton>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input aria-label="First name" value={cardholderFirstName} onChange={(event) => setCardholderFirstName(event.target.value)} placeholder="First name" className="h-12 rounded-2xl border border-cyan-300/15 bg-[#031225]/65 px-4 text-base text-white placeholder:text-white/42" />
                <Input aria-label="Last name" value={cardholderLastName} onChange={(event) => setCardholderLastName(event.target.value)} placeholder="Last name" className="h-12 rounded-2xl border border-cyan-300/15 bg-[#031225]/65 px-4 text-base text-white placeholder:text-white/42" />
              </div>
              <Input aria-label="Badge number" value={cardholderBadge} onChange={(event) => setCardholderBadge(event.target.value)} placeholder="Badge number" className="h-12 rounded-2xl border border-cyan-300/15 bg-[#031225]/65 px-4 text-base text-white placeholder:text-white/42" />
              <Input aria-label="Company number" value={cardholderCompany} onChange={(event) => setCardholderCompany(event.target.value)} placeholder="Company # (optional)" className="h-12 rounded-2xl border border-cyan-300/15 bg-[#031225]/65 px-4 text-base text-white placeholder:text-white/42" />
              <Input aria-label="Email" type="email" value={cardholderEmail} onChange={(event) => setCardholderEmail(event.target.value)} placeholder="Email (optional)" className="h-12 rounded-2xl border border-cyan-300/15 bg-[#031225]/65 px-4 text-base text-white placeholder:text-white/42" />
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t border-cyan-300/12 px-5 py-4">
              <OutlineGlowButton type="button" onClick={() => setCardholderModalOpen(false)}>Cancel</OutlineGlowButton>
              <GlowButton
                type="button"
                disabled={isPending || !cardholderFirstName.trim() || !cardholderLastName.trim() || !cardholderBadge.trim()}
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
                      setStatusMessage(`Cardholder saved: ${cardholderFirstName.trim()} ${cardholderLastName.trim()} (${cardholderBadge.trim()}). Employee list updated.`);
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
              </GlowButton>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
