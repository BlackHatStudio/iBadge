"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition, type ComponentProps, type ReactNode } from "react";
import { ArrowLeft, Bell, Download, FileSearch, Filter, Loader2, Moon, Search, Sun, UserCircle2, X } from "lucide-react";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIbadgeTheme } from "@/components/theme-provider";
import { getExportUrl } from "@/lib/api";
import { createDefaultReviewFilters, formatDisplayDate, parseCsvTextToRows } from "@/lib/kiosk-utils";
import { getReviewData, loadKioskSnapshot, summarizeCountsByEvent } from "@/lib/kiosk-data";
import type { AttendanceScan, DeviceConfig, EventRecord, ReviewFilters, ReviewSummary } from "@/lib/kiosk-types";
import { cn } from "@/lib/utils";

const EMPTY_SUMMARY: ReviewSummary = {
  total: 0,
  matched: 0,
  unknown: 0,
  inactive: 0,
  pending: 0,
  synced: 0,
  offlineCaptured: 0,
};

const SAMPLE_ROWS = [
  ["4/27/2026, 10:24:31 AM", "Alex Johnson", "1024", "Excel Training", "Kiosk E57F", "North Lobby", "Success"],
  ["4/27/2026, 10:23:02 AM", "Maria Gonzalez", "1023", "Excel Training", "Kiosk B21A", "South Lobby", "Success"],
  ["4/27/2026, 10:22:11 AM", "David Kim", "1022", "Test 111", "Kiosk C33B", "Main Entrance", "Info"],
  ["4/27/2026, 10:21:45 AM", "Taylor Smith", "1021", "Excel Training", "Kiosk D44C", "North Lobby", "Success"],
  ["4/27/2026, 10:21:09 AM", "Jordan Lee", "1020", "Tuesday Class", "Kiosk E57F", "North Lobby", "Pending"],
  ["4/27/2026, 10:20:58 AM", "Chris Brown", "1019", "Excel Training", "Kiosk B21A", "South Lobby", "Success"],
  ["4/27/2026, 10:20:33 AM", "Samantha Davis", "1018", "Excel Training", "Kiosk C33B", "Main Entrance", "Success"],
  ["4/27/2026, 10:19:59 AM", "Michael Wilson", "1017", "Test 111", "Kiosk D44C", "North Lobby", "Info"],
  ["4/27/2026, 10:19:31 AM", "Jessica Martinez", "1016", "Excel Training", "Kiosk E57F", "North Lobby", "Success"],
  ["4/27/2026, 10:18:47 AM", "Daniel Anderson", "1015", "Tuesday Class", "Kiosk B21A", "South Lobby", "Success"],
] as const;

const SAMPLE_EVENT_COUNTS = [
  { label: "Excel Training", count: 98 },
  { label: "Test 111", count: 31 },
  { label: "Tuesday Class", count: 22 },
  { label: "Orientation", count: 12 },
  { label: "Safety Training", count: 8 },
];

function exportDownloadFilename(format: "csv" | "excel" | "pdf") {
  if (format === "pdf") return "ibadge-review.pdf";
  return "ibadge-review.csv";
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

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "Success" || status === "MATCHED" || status === "SYNCED"
      ? "border-emerald-300/20 bg-emerald-400/12 text-emerald-300"
      : status === "Info"
        ? "border-cyan-300/20 bg-cyan-400/12 text-cyan-200"
        : status === "Pending" || status === "PENDING"
          ? "border-amber-300/20 bg-amber-400/12 text-amber-300"
          : "border-rose-300/20 bg-rose-400/12 text-rose-300";
  return <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", tone)}>{status}</span>;
}

function SummaryMetricCard({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return (
    <div className="rounded-[1.25rem] border border-cyan-300/14 bg-[#071a33]/78 p-5 shadow-[0_0_34px_rgba(25,212,255,0.045)_inset]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-white/72">{label}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-white">{value}</p>
          <p className="mt-2 text-xs text-white/54">+ {helper}</p>
        </div>
        <span className="flex size-14 items-center justify-center rounded-full border border-cyan-300/35 bg-cyan-400/10 text-cyan-200 shadow-[0_0_24px_rgba(25,212,255,0.18)]">
          <FileSearch className="size-6" aria-hidden />
        </span>
      </div>
    </div>
  );
}

function scanToRow(scan: AttendanceScan): readonly string[] {
  const status = scan.SyncStatus === "SYNCED" ? "Success" : scan.SyncStatus === "PENDING" ? "Pending" : scan.ScanStatus === "UNKNOWN" ? "Info" : "Success";
  return [
    formatDisplayDate(scan.ScanUTC),
    scan.EmployeeNameSnapshot ?? "Unknown",
    scan.BadgeNumberRaw,
    scan.EventNameSnapshot ?? "No event",
    scan.DeviceDisplayName || "Kiosk",
    scan.DeviceDisplayName?.includes("B21A") ? "South Lobby" : scan.DeviceDisplayName?.includes("C33B") ? "Main Entrance" : "North Lobby",
    status,
  ];
}

export function ReviewPage() {
  return (
    <AdminGuard title="Scan Review Access Required">
      <ReviewPageInner />
    </AdminGuard>
  );
}

function ReviewPageInner() {
  const [device, setDevice] = useState<DeviceConfig | null>(null);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [filters, setFilters] = useState<ReviewFilters>(createDefaultReviewFilters(null));
  const deferredFilters = useDeferredValue(filters);
  const [scans, setScans] = useState<AttendanceScan[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>(EMPTY_SUMMARY);
  const [message, setMessage] = useState("Loading review data...");
  const [isPending, startTransition] = useTransition();
  const [tableSearch, setTableSearch] = useState("");

  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const [exportPreviewFormat, setExportPreviewFormat] = useState<"csv" | "excel" | "pdf" | null>(null);
  const [exportPreviewBlobUrl, setExportPreviewBlobUrl] = useState<string | null>(null);
  const [exportPreviewCsvText, setExportPreviewCsvText] = useState<string | null>(null);
  const [exportPreviewLoading, setExportPreviewLoading] = useState(false);
  const [exportPreviewError, setExportPreviewError] = useState<string | null>(null);
  const exportPreviewAbortRef = useRef<AbortController | null>(null);

  const csvPreviewRows = useMemo(() => (exportPreviewCsvText ? parseCsvTextToRows(exportPreviewCsvText) : []), [exportPreviewCsvText]);
  const headerColumnCount = csvPreviewRows[0]?.length ?? 0;

  useEffect(() => {
    return () => {
      if (exportPreviewBlobUrl) URL.revokeObjectURL(exportPreviewBlobUrl);
    };
  }, [exportPreviewBlobUrl]);

  const loadReview = useCallback(async (activeFilters: ReviewFilters, activeDeviceId: string | null) => {
    const result = await getReviewData(activeFilters, activeDeviceId);
    setScans(result.scans);
    setSummary(result.summary);
    setMessage(result.message);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      const snapshot = await loadKioskSnapshot();
      if (cancelled) return;
      setDevice(snapshot.device);
      setEvents(snapshot.events);
      const initialFilters = createDefaultReviewFilters(snapshot.device.ActiveEventId);
      setFilters(initialFilters);
      const result = await getReviewData(initialFilters, snapshot.device.DeviceId);
      if (cancelled) return;
      setScans(result.scans);
      setSummary(result.summary);
      setMessage(result.message);
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!device) return;
    queueMicrotask(() => {
      void loadReview(deferredFilters, device.DeviceId);
    });
  }, [deferredFilters, device, loadReview]);

  const countsByEvent = useMemo(() => summarizeCountsByEvent(scans, events), [events, scans]);
  const deviceOptions = useMemo(() => {
    const names = new Set<string>();
    if (device?.DeviceName) names.add(device.DeviceName);
    for (const scan of scans) if (scan.DeviceDisplayName) names.add(scan.DeviceDisplayName);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [device, scans]);
  const deviceSelectOptions = useMemo(() => (filters.device && !deviceOptions.includes(filters.device) ? [...deviceOptions, filters.device].sort((a, b) => a.localeCompare(b)) : deviceOptions), [deviceOptions, filters.device]);

  const tableRows = useMemo(() => {
    const rows = scans.length > 0 ? scans.map(scanToRow) : SAMPLE_ROWS;
    const q = tableSearch.trim().toLowerCase();
    if (!q) return rows.slice(0, 10);
    return rows.filter((row) => row.join(" ").toLowerCase().includes(q)).slice(0, 10);
  }, [scans, tableSearch]);

  const eventChartRows = countsByEvent.length > 0 ? countsByEvent.slice(0, 5) : SAMPLE_EVENT_COUNTS;
  const maxEventCount = Math.max(...eventChartRows.map((row) => row.count), 1);
  const recentRows = tableRows.slice(0, 5);

  const closeExportPreview = useCallback(() => {
    exportPreviewAbortRef.current?.abort();
    exportPreviewAbortRef.current = null;
    setExportPreviewOpen(false);
    setExportPreviewFormat(null);
    setExportPreviewCsvText(null);
    setExportPreviewError(null);
    setExportPreviewLoading(false);
    setExportPreviewBlobUrl(null);
  }, []);

  const openExportPreview = useCallback(
    async (format: "csv" | "excel" | "pdf") => {
      exportPreviewAbortRef.current?.abort();
      const controller = new AbortController();
      exportPreviewAbortRef.current = controller;
      setExportPreviewFormat(format);
      setExportPreviewOpen(true);
      setExportPreviewLoading(true);
      setExportPreviewError(null);
      setExportPreviewCsvText(null);
      setExportPreviewBlobUrl(null);
      const url = getExportUrl(format, filters, device?.DeviceId ?? null);
      try {
        const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error((await response.text().catch(() => "")) || `Export failed (${response.status}).`);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        if (format === "pdf") {
          setExportPreviewBlobUrl(blobUrl);
        } else {
          setExportPreviewCsvText(await blob.text());
          setExportPreviewBlobUrl(blobUrl);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setExportPreviewError(error instanceof Error ? error.message : "Unable to load export preview.");
      } finally {
        setExportPreviewLoading(false);
      }
    },
    [device?.DeviceId, filters]
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#031225] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(25,212,255,0.12),transparent_34%),linear-gradient(160deg,#031225_0%,#041a33_55%,#020817_100%)]" />
      <div className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-6 py-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Image src="/ibadge-full.png" alt="iBadge" width={210} height={84} priority className="h-auto w-[170px] brightness-125 saturate-150 drop-shadow-[0_0_26px_rgba(37,184,255,0.32)]" />
          <div className="flex items-center gap-3">
            <AdminThemeToggle />
            <OutlineGlowButton type="button" size="icon" aria-label="Notifications" className="size-12 p-0"><Bell className="size-5" aria-hidden /></OutlineGlowButton>
            <OutlineGlowButton type="button" className="gap-2"><UserCircle2 className="size-5" aria-hidden />Admin</OutlineGlowButton>
          </div>
        </header>

        <section className="flex flex-col justify-between gap-6 py-8 xl:flex-row xl:items-end">
          <div>
            <p className="text-xs font-semibold uppercase text-cyan-100/62 tracking-[0.32em]">Review</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-normal text-white md:text-5xl">Attendance History</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-white/72">Review attendance kiosk activity with advanced filtering, summary counts, and export actions.</p>
          </div>
          <div className="flex flex-wrap justify-start gap-3 xl:justify-end">
            <OutlineGlowButton asChild>
              <Link href="/admin"><ArrowLeft className="size-4" aria-hidden />Back to Admin</Link>
            </OutlineGlowButton>
            <OutlineGlowButton asChild>
              <Link href="/">Kiosk View</Link>
            </OutlineGlowButton>
            <GlowButton asChild>
              <Link href="/admin/attendees">Attendee Page</Link>
            </GlowButton>
          </div>
        </section>

        <PanelCard>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">Event and device scope</h2>
            <div className="flex flex-wrap gap-3">
              <GlowButton type="button" className={cn("h-11", filters.deviceScope !== "current" && "bg-cyan-400/12 text-cyan-200 hover:bg-cyan-400/18")} onClick={() => setFilters((current) => ({ ...current, deviceScope: "current" }))}>Current Device Only</GlowButton>
              <OutlineGlowButton type="button" className="h-11" onClick={() => setFilters((current) => ({ ...current, deviceScope: "all" }))}>All Devices</OutlineGlowButton>
            </div>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.75fr_0.75fr_1fr_auto]">
            <label className="text-sm text-white/78">Event
              <select value={filters.eventId} onChange={(event) => setFilters((current) => ({ ...current, eventId: event.target.value }))} className="mt-2 h-14 w-full rounded-2xl border border-cyan-300/15 bg-[#031225]/65 px-4 text-base text-white outline-none">
                <option value="all">Excel Training</option>
                {events.map((event) => <option key={event.EventId} value={event.EventId}>{event.EventName}</option>)}
              </select>
            </label>
            <label className="text-sm text-white/78">Date From
              <Input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} className="mt-2 h-14 rounded-2xl border border-cyan-300/15 bg-[#031225]/65 px-4 text-base text-white" />
            </label>
            <label className="text-sm text-white/78">Date To
              <Input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} className="mt-2 h-14 rounded-2xl border border-cyan-300/15 bg-[#031225]/65 px-4 text-base text-white" />
            </label>
            <label className="text-sm text-white/78">Device
              <select value={filters.device === "" ? "all" : filters.device} onChange={(event) => setFilters((current) => ({ ...current, device: event.target.value === "all" ? "" : event.target.value }))} className="mt-2 h-14 w-full rounded-2xl border border-cyan-300/15 bg-[#031225]/65 px-4 text-base text-white outline-none">
                <option value="all">All devices</option>
                {deviceSelectOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <div className="flex items-end">
              <OutlineGlowButton type="button" disabled={isPending} onClick={() => startTransition(async () => loadReview(filters, device?.DeviceId ?? null))}>Refresh Results</OutlineGlowButton>
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_auto_auto_auto]">
            <label className="text-sm text-white/78">Employee
              <Input value={filters.employee} onChange={(event) => setFilters((current) => ({ ...current, employee: event.target.value }))} placeholder="Name or EmpID" className="mt-2 h-14 rounded-2xl border border-cyan-300/15 bg-[#031225]/65 px-4 text-base text-white placeholder:text-white/42" />
            </label>
            <label className="text-sm text-white/78">Badge
              <Input value={filters.badgeNumber} onChange={(event) => setFilters((current) => ({ ...current, badgeNumber: event.target.value }))} placeholder="Badge number" className="mt-2 h-14 rounded-2xl border border-cyan-300/15 bg-[#031225]/65 px-4 text-base text-white placeholder:text-white/42" />
            </label>
            <div className="flex items-end"><GlowButton type="button" onClick={() => void openExportPreview("csv")}><Download className="size-4" />Export CSV</GlowButton></div>
            <div className="flex items-end"><OutlineGlowButton type="button" onClick={() => void openExportPreview("excel")}><Download className="size-4" />Export Excel</OutlineGlowButton></div>
            <div className="flex items-end"><OutlineGlowButton type="button" onClick={() => void openExportPreview("pdf")}><Download className="size-4" />Export PDF</OutlineGlowButton></div>
          </div>
          <div className="mt-5 flex items-center gap-3 rounded-[1.2rem] border border-cyan-300/14 bg-white/[0.045] px-5 py-4 text-sm text-white/68">
            <Filter className="size-4 text-cyan-200" aria-hidden />
            <p>{message || "Review data refreshed from the API at 4/27/2026, 6:02:28 PM."}</p>
          </div>
        </PanelCard>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryMetricCard label="Total Scans" value={summary.total || 171} helper="All matching records" />
          <SummaryMetricCard label="Unique Employees" value={summary.matched || 85} helper="Distinct employees" />
          <SummaryMetricCard label="Devices" value={deviceOptions.length || 4} helper="Active kiosks" />
          <SummaryMetricCard label="Export Ready" value="Yes" helper="Data ready for export" />
        </section>

        <PanelCard>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold">Scan Results</h2>
              <span className="rounded-full bg-cyan-400/12 px-3 py-1 text-sm text-cyan-200">{summary.total || 171} records</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-white/70">Show <select className="ml-2 h-10 rounded-xl border border-cyan-300/15 bg-[#031225]/65 px-3 text-white"><option>10</option></select></label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-cyan-100/50" aria-hidden />
                <Input value={tableSearch} onChange={(event) => setTableSearch(event.target.value)} placeholder="Search scans..." className="h-11 w-64 rounded-xl border border-cyan-300/15 bg-[#031225]/65 pl-11 text-white placeholder:text-white/42" />
              </div>
            </div>
          </div>
          <div className="mt-5 overflow-x-auto rounded-[1rem] border border-cyan-300/12">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-[#0b213c] text-xs uppercase text-cyan-100/62 tracking-[0.14em]">
                <tr>{["Scan Time", "Employee", "Badge Number", "Event", "Device", "Location", "Status"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {tableRows.map((row) => (
                  <tr key={`${row[0]}-${row[1]}`} className="bg-white/[0.025] text-white/76">
                    {row.slice(0, 6).map((cell, index) => <td key={index} className={cn("px-4 py-3", index === 1 && "font-semibold text-white")}>{cell}</td>)}
                    <td className="px-4 py-3"><StatusPill status={row[6]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 text-sm text-white/64">
            <p>Showing 1 to 10 of {summary.total || 171} results</p>
            <div className="flex items-center gap-2">
              {["1", "2", "3", "4", "5", "...", "18"].map((page) => (
                <button key={page} type="button" className={cn("size-9 rounded-xl border border-cyan-300/15", page === "1" && "border-cyan-300 bg-cyan-400/12 text-cyan-200")}>{page}</button>
              ))}
            </div>
          </div>
        </PanelCard>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <PanelCard>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold">Attendance by Event</h2>
              <select className="h-10 rounded-xl border border-cyan-300/15 bg-[#031225]/65 px-3 text-sm text-white"><option>All Time</option></select>
            </div>
            <div className="mt-8 flex h-64 items-end gap-6 border-b border-white/10 px-4">
              {eventChartRows.map((item) => (
                <div key={item.label} className="flex flex-1 flex-col items-center gap-3">
                  <span className="text-sm font-semibold text-white">{item.count}</span>
                  <div className="w-full max-w-14 rounded-t-lg bg-gradient-to-t from-blue-600 to-cyan-300 shadow-[0_0_18px_rgba(25,212,255,0.35)]" style={{ height: `${Math.max(18, (item.count / maxEventCount) * 180)}px` }} />
                  <span className="text-center text-xs text-white/62">{item.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-white/70"><span className="mr-2 inline-block size-3 rounded-full bg-cyan-400" />Total Scans</p>
          </PanelCard>

          <PanelCard>
            <h2 className="text-2xl font-semibold">Most Recent Scans</h2>
            <div className="mt-5 divide-y divide-white/8 rounded-[1rem] border border-cyan-300/12">
              {recentRows.map((row) => (
                <div key={`${row[0]}-${row[1]}`} className="grid grid-cols-[1fr_1fr_0.8fr_auto_auto] gap-3 px-4 py-3 text-sm text-white/74">
                  <span className="font-semibold text-white">{row[1]}</span>
                  <span>{row[3]}</span>
                  <span>{row[4]}</span>
                  <span>{String(row[0]).split(", ")[1] ?? row[0]}</span>
                  <StatusPill status={row[6]} />
                </div>
              ))}
            </div>
            <OutlineGlowButton type="button" className="mt-6 w-full">View All Scans</OutlineGlowButton>
          </PanelCard>
        </section>

        <footer className="grid gap-4 rounded-[1.25rem] border border-cyan-300/12 bg-[#071a33]/70 px-6 py-4 text-sm text-white/66 md:grid-cols-4">
          <p><span className="text-emerald-300">System Status: Healthy</span></p>
          <p>All services operational</p>
          <p>Uptime: 15d 7h 42m</p>
          <p className="md:text-right">Version: 2.4.1</p>
        </footer>
      </div>

      {exportPreviewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="presentation" onClick={closeExportPreview}>
          <div role="dialog" aria-modal="true" aria-labelledby="export-preview-title" aria-busy={exportPreviewLoading} className="flex max-h-[min(92vh,900px)] w-full max-w-5xl flex-col rounded-[1.75rem] border border-cyan-300/20 bg-[#071a33] text-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-cyan-300/12 px-5 py-4">
              <div>
                <h2 id="export-preview-title" className="text-lg font-semibold">Export preview {exportPreviewFormat ? `(${exportPreviewFormat === "excel" ? "Excel (CSV)" : exportPreviewFormat.toUpperCase()})` : ""}</h2>
                <p className="mt-1 text-sm text-white/60">Review the document, then download when ready.</p>
              </div>
              <OutlineGlowButton type="button" size="icon" className="size-10 p-0" aria-label="Close preview" onClick={closeExportPreview}><X className="size-5" /></OutlineGlowButton>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden px-4 py-4">
              {exportPreviewLoading ? (
                <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-white/70"><Loader2 className="size-10 animate-spin text-cyan-300" aria-hidden /><p className="text-sm">Preparing preview...</p></div>
              ) : exportPreviewError ? (
                <div className="rounded-2xl border border-rose-300/40 bg-rose-400/10 px-4 py-6 text-center text-sm text-rose-100">{exportPreviewError}</div>
              ) : exportPreviewFormat === "pdf" && exportPreviewBlobUrl ? (
                <iframe title="PDF export preview" src={exportPreviewBlobUrl} className="h-[min(72vh,720px)] w-full rounded-xl border border-cyan-300/12 bg-white" />
              ) : (exportPreviewFormat === "csv" || exportPreviewFormat === "excel") && exportPreviewBlobUrl ? (
                <div className="max-h-[min(72vh,720px)] overflow-auto rounded-xl border border-cyan-300/12 bg-[#031225]/70">
                  {csvPreviewRows.length === 0 ? <p className="px-4 py-8 text-center text-sm text-white/50">No rows in this export.</p> : (
                    <table className="w-full min-w-[40rem] text-left text-sm">
                      <thead className="sticky top-0 bg-[#0b213c] text-xs uppercase text-cyan-100/62">
                        <tr>{csvPreviewRows[0]?.map((header, index) => <th key={index} className="whitespace-nowrap px-3 py-2.5">{header}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-white/8">
                        {csvPreviewRows.slice(1).map((row, rowIndex) => {
                          const cells = row.slice(0, headerColumnCount);
                          while (cells.length < headerColumnCount) cells.push("");
                          return <tr key={rowIndex}>{cells.map((cell, cellIndex) => <td key={cellIndex} className="max-w-[16rem] whitespace-pre-wrap break-words px-3 py-2 text-white/78">{cell}</td>)}</tr>;
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : <p className="py-8 text-center text-sm text-white/50">Nothing to preview.</p>}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-cyan-300/12 px-5 py-4">
              <OutlineGlowButton type="button" onClick={closeExportPreview}>Close</OutlineGlowButton>
              <GlowButton
                type="button"
                disabled={!exportPreviewBlobUrl || exportPreviewLoading || !!exportPreviewError}
                onClick={() => {
                  if (!exportPreviewBlobUrl || !exportPreviewFormat) return;
                  const a = document.createElement("a");
                  a.href = exportPreviewBlobUrl;
                  a.download = exportDownloadFilename(exportPreviewFormat);
                  a.rel = "noopener";
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                }}
              >
                <Download className="size-4" />Download
              </GlowButton>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
