"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, Download, Filter, Loader2, RefreshCcw, X } from "lucide-react";
import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getExportUrl } from "@/lib/api";
import { createDefaultReviewFilters, formatDisplayDate, parseCsvTextToRows } from "@/lib/kiosk-utils";
import { getReviewData, loadKioskSnapshot, summarizeCountsByEvent } from "@/lib/kiosk-data";
import type { AttendanceScan, DeviceConfig, EventRecord, ReviewFilters, ReviewSummary } from "@/lib/kiosk-types";

const EMPTY_SUMMARY: ReviewSummary = {
  total: 0,
  matched: 0,
  unknown: 0,
  inactive: 0,
  pending: 0,
  synced: 0,
  offlineCaptured: 0,
};

function exportDownloadFilename(format: "csv" | "excel" | "pdf") {
  if (format === "pdf") {
    return "ibadge-review.pdf";
  }
  return "ibadge-review.csv";
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

  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const [exportPreviewFormat, setExportPreviewFormat] = useState<"csv" | "excel" | "pdf" | null>(null);
  const [exportPreviewBlobUrl, setExportPreviewBlobUrl] = useState<string | null>(null);
  const [exportPreviewCsvText, setExportPreviewCsvText] = useState<string | null>(null);
  const [exportPreviewLoading, setExportPreviewLoading] = useState(false);
  const [exportPreviewError, setExportPreviewError] = useState<string | null>(null);
  const exportPreviewAbortRef = useRef<AbortController | null>(null);

  const csvPreviewRows = useMemo(
    () => (exportPreviewCsvText ? parseCsvTextToRows(exportPreviewCsvText) : []),
    [exportPreviewCsvText]
  );

  useEffect(() => {
    return () => {
      if (exportPreviewBlobUrl) {
        URL.revokeObjectURL(exportPreviewBlobUrl);
      }
    };
  }, [exportPreviewBlobUrl]);

  const headerColumnCount = csvPreviewRows[0]?.length ?? 0;

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
      if (cancelled) {
        return;
      }

      setDevice(snapshot.device);
      setEvents(snapshot.events);
      const initialFilters = createDefaultReviewFilters(snapshot.device.ActiveEventId);
      setFilters(initialFilters);
      const result = await getReviewData(initialFilters, snapshot.device.DeviceId);
      if (cancelled) {
        return;
      }

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
    if (!device) {
      return;
    }

    queueMicrotask(() => {
      void loadReview(deferredFilters, device.DeviceId);
    });
  }, [deferredFilters, device, loadReview]);

  const countsByEvent = useMemo(() => summarizeCountsByEvent(scans, events), [events, scans]);

  const deviceOptions = useMemo(() => {
    const names = new Set<string>();
    if (device?.DeviceName) {
      names.add(device.DeviceName);
    }
    for (const scan of scans) {
      if (scan.DeviceDisplayName) {
        names.add(scan.DeviceDisplayName);
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [device, scans]);

  const deviceSelectOptions = useMemo(() => {
    if (filters.device && !deviceOptions.includes(filters.device)) {
      return [...deviceOptions, filters.device].sort((a, b) => a.localeCompare(b));
    }
    return deviceOptions;
  }, [deviceOptions, filters.device]);

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
        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          throw new Error(errText || `Export failed (${response.status}).`);
        }
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        if (format === "pdf") {
          setExportPreviewBlobUrl(blobUrl);
        } else {
          const text = await blob.text();
          setExportPreviewCsvText(text);
          setExportPreviewBlobUrl(blobUrl);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        setExportPreviewError(error instanceof Error ? error.message : "Unable to load export preview.");
      } finally {
        setExportPreviewLoading(false);
      }
    },
    [device?.DeviceId, filters]
  );

  useEffect(() => {
    if (!exportPreviewOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeExportPreview();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [exportPreviewOpen, closeExportPreview]);

  return (
    <div className="ibadge-shell">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <header className="ibadge-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-cyan-800/90 dark:text-cyan-200/80">Scan Review</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white md:text-5xl">Attendance History</h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">
                Review kiosk attendance with device scope controls, event-based filtering, summary counts, and export actions that call the backend reporting endpoints.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                variant="outline"
                className="h-12 rounded-2xl border-slate-100 bg-white px-5 text-base text-slate-900 shadow-sm hover:bg-sky-50/60 dark:border-white/10 dark:bg-slate-900/80 dark:text-white dark:hover:bg-slate-800"
              >
                <Link href="/admin">
                  <ArrowLeft className="size-4" />
                  Back to Admin
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-12 rounded-2xl border-slate-100 bg-white px-5 text-base text-slate-900 shadow-sm hover:bg-sky-50/60 dark:border-white/10 dark:bg-slate-900/80 dark:text-white dark:hover:bg-slate-800"
              >
                <Link href="/">Kiosk</Link>
              </Button>
            </div>
          </div>
        </header>

        <section className="ibadge-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Event and device scope</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant={filters.deviceScope === "current" ? "default" : "outline"}
                className={`h-12 rounded-2xl px-5 text-base ${filters.deviceScope === "current" ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300" : "border border-slate-100/90 bg-white text-slate-900 hover:bg-sky-50/70 dark:border-white/10 dark:bg-slate-900/80 dark:text-white dark:hover:bg-slate-800"}`}
                onClick={() => setFilters((current) => ({ ...current, deviceScope: "current" }))}
              >
                Current Device Only
              </Button>
              <Button
                variant={filters.deviceScope === "all" ? "default" : "outline"}
                className={`h-12 rounded-2xl px-5 text-base ${filters.deviceScope === "all" ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300" : "border border-slate-100/90 bg-white text-slate-900 hover:bg-sky-50/70 dark:border-white/10 dark:bg-slate-900/80 dark:text-white dark:hover:bg-slate-800"}`}
                onClick={() => setFilters((current) => ({ ...current, deviceScope: "all" }))}
              >
                All Devices
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <div>
              <label className="text-sm font-medium text-cyan-900 dark:text-cyan-100">Event</label>
              <select
                value={filters.eventId}
                onChange={(event) => setFilters((current) => ({ ...current, eventId: event.target.value }))}
                className="mt-2 h-14 w-full rounded-2xl border border-slate-100 bg-white px-4 text-base text-slate-900 outline-none dark:border-white/10 dark:bg-slate-900/80 dark:text-white"
              >
                <option value="all">All events</option>
                {events.map((event) => (
                  <option key={event.EventId} value={event.EventId}>
                    {event.EventName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-cyan-900 dark:text-cyan-100">Date From</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                className="mt-2 h-14 rounded-2xl border border-slate-100/90 bg-white px-4 text-base text-slate-900 dark:border-white/10 dark:bg-slate-900/80 dark:text-white"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-cyan-900 dark:text-cyan-100">Date To</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
                className="mt-2 h-14 rounded-2xl border border-slate-100/90 bg-white px-4 text-base text-slate-900 dark:border-white/10 dark:bg-slate-900/80 dark:text-white"
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                className="h-14 w-full rounded-2xl border border-slate-100/90 bg-white text-base text-slate-900 hover:bg-sky-50/70 dark:border-white/10 dark:bg-slate-900/80 dark:text-white dark:hover:bg-slate-800"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await loadReview(filters, device?.DeviceId ?? null);
                  })
                }
              >
                <RefreshCcw className="size-4" />
                Refresh Results
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label className="text-sm font-medium text-cyan-900 dark:text-cyan-100">Employee</label>
              <Input
                value={filters.employee}
                onChange={(event) => setFilters((current) => ({ ...current, employee: event.target.value }))}
                placeholder="Name or EmpID"
                className="mt-2 h-14 rounded-2xl border border-slate-100/90 bg-white px-4 text-base text-slate-900 dark:border-white/10 dark:bg-slate-900/80 dark:text-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-cyan-900 dark:text-cyan-100">Badge</label>
              <Input
                value={filters.badgeNumber}
                onChange={(event) => setFilters((current) => ({ ...current, badgeNumber: event.target.value }))}
                placeholder="Badge number"
                className="mt-2 h-14 rounded-2xl border border-slate-100/90 bg-white px-4 text-base text-slate-900 dark:border-white/10 dark:bg-slate-900/80 dark:text-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-cyan-900 dark:text-cyan-100">Device</label>
              <select
                value={filters.device === "" ? "all" : filters.device}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    device: event.target.value === "all" ? "" : event.target.value,
                  }))
                }
                className="mt-2 h-14 w-full rounded-2xl border border-slate-100 bg-white px-4 text-base text-slate-900 outline-none dark:border-white/10 dark:bg-slate-900/80 dark:text-white"
              >
                <option value="all">All devices</option>
                {deviceSelectOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              className="h-12 rounded-2xl bg-cyan-400 px-5 text-base font-semibold text-slate-950 hover:bg-cyan-300"
              onClick={() => void openExportPreview("csv")}
            >
              <Download className="size-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              className="h-12 rounded-2xl border border-slate-100/90 bg-white px-5 text-base text-slate-900 hover:bg-sky-50/70 dark:border-white/10 dark:bg-slate-900/80 dark:text-white dark:hover:bg-slate-800"
              onClick={() => void openExportPreview("excel")}
            >
              <Download className="size-4" />
              Export Excel
            </Button>
            <Button
              variant="outline"
              className="h-12 rounded-2xl border border-slate-100/90 bg-white px-5 text-base text-slate-900 hover:bg-sky-50/70 dark:border-white/10 dark:bg-slate-900/80 dark:text-white dark:hover:bg-slate-800"
              onClick={() => void openExportPreview("pdf")}
            >
              <Download className="size-4" />
              Export PDF
            </Button>
          </div>

          <div className="ibadge-inset mt-5 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-3">
              <Filter className="mt-0.5 size-4 text-cyan-600 dark:text-cyan-200" />
              <p>{message}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            <div className="ibadge-card">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Summary</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="ibadge-inset-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Total</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{summary.total}</p>
                </div>
              </div>
            </div>

            <div className="ibadge-card">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Attendance By Event</p>
              <div className="mt-4 space-y-3">
                {countsByEvent.length === 0 ? (
                  <div className="rounded-[1.4rem] border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                    No attendance records match the current filters.
                  </div>
                ) : (
                  countsByEvent.map((item) => (
                    <div key={item.label} className="ibadge-inset-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-base font-semibold text-slate-900 dark:text-white">{item.label}</p>
                        <span className="rounded-full bg-cyan-100 px-3 py-1 text-sm font-semibold text-cyan-900 dark:bg-cyan-400/15 dark:text-cyan-100">
                          {item.count}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="ibadge-card">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Scans</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">Read-only results</h2>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{scans.length} result{scans.length === 1 ? "" : "s"}</p>
            </div>

            <div className="mt-5 space-y-3">
              {scans.length === 0 ? (
                <div className="rounded-[1.4rem] border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                  No scans match the current filters.
                </div>
              ) : (
                scans.map((scan) => (
                  <article key={scan.DeviceScanGuid} className="ibadge-inset-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-slate-900 dark:text-white">{scan.EmployeeNameSnapshot ?? "Unknown"}</p>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{scan.BadgeNumberRaw}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                            scan.ScanStatus === "MATCHED"
                              ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-100"
                              : scan.ScanStatus === "INACTIVE"
                                ? "bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-100"
                                : "bg-rose-100 text-rose-900 dark:bg-rose-400/15 dark:text-rose-100"
                          }`}
                        >
                          {scan.ScanStatus}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                            scan.SyncStatus === "SYNCED"
                              ? "bg-cyan-100 text-cyan-900 dark:bg-cyan-400/15 dark:text-cyan-100"
                              : "bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-100"
                          }`}
                        >
                          {scan.SyncStatus}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-2 xl:grid-cols-3">
                      <p><span className="text-slate-500">Scan time:</span> {formatDisplayDate(scan.ScanUTC)}</p>
                      <p><span className="text-slate-500">Event:</span> {scan.EventNameSnapshot ?? "No event"}</p>
                      <p><span className="text-slate-500">Device:</span> {scan.DeviceDisplayName}</p>
                      <p><span className="text-slate-500">EmpID:</span> {scan.EmpID ?? "Not matched"}</p>
                      <p><span className="text-slate-500">Offline captured:</span> {scan.IsOfflineCaptured ? "Yes" : "No"}</p>
                      <p><span className="text-slate-500">Last sync attempt:</span> {formatDisplayDate(scan.LastSyncAttemptUTC)}</p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      {exportPreviewOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={closeExportPreview}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-preview-title"
            aria-busy={exportPreviewLoading}
            className="ibadge-modal flex max-h-[min(92vh,900px)] w-full max-w-5xl flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
              <div>
                <h2 id="export-preview-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                  Export preview
                  {exportPreviewFormat ? (
                    <span className="ml-2 text-base font-normal text-slate-400">
                      ({exportPreviewFormat === "excel" ? "Excel (CSV)" : exportPreviewFormat.toUpperCase()})
                    </span>
                  ) : null}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Review the document, then download when ready.</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-xl text-slate-500 hover:bg-sky-50/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Close preview"
                onClick={closeExportPreview}
              >
                <X className="size-5" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden px-2 py-3 sm:px-4">
              {exportPreviewLoading ? (
                <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-600 dark:text-slate-300">
                  <Loader2 className="size-10 animate-spin text-cyan-600 dark:text-cyan-300" aria-hidden />
                  <p className="text-sm">Preparing preview…</p>
                </div>
              ) : exportPreviewError ? (
                <div className="rounded-2xl border border-rose-300/60 bg-rose-50 px-4 py-6 text-center text-sm text-rose-800 dark:border-rose-400/30 dark:bg-rose-950/40 dark:text-rose-100">
                  {exportPreviewError}
                </div>
              ) : exportPreviewFormat === "pdf" && exportPreviewBlobUrl ? (
                <iframe
                  title="PDF export preview"
                  src={exportPreviewBlobUrl}
                  className="h-[min(72vh,720px)] w-full rounded-xl border border-slate-100 bg-white dark:border-white/10"
                />
              ) : (exportPreviewFormat === "csv" || exportPreviewFormat === "excel") && exportPreviewBlobUrl ? (
                <div className="max-h-[min(72vh,720px)] overflow-auto rounded-xl border border-slate-100 bg-white dark:border-white/10 dark:bg-slate-900/50">
                  {csvPreviewRows.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-slate-400">No rows in this export.</p>
                  ) : (
                    <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-100/95 shadow-[0_1px_0_rgba(0,0,0,0.06)] dark:bg-slate-800/95 dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]">
                        <tr className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 dark:text-slate-300">
                          {csvPreviewRows[0]?.map((header, index) => (
                            <th key={index} scope="col" className="whitespace-nowrap px-3 py-2.5">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreviewRows.slice(1).map((row, rowIndex) => {
                          const cells = row.slice(0, headerColumnCount);
                          while (cells.length < headerColumnCount) {
                            cells.push("");
                          }
                          return (
                            <tr key={rowIndex} className="border-b border-slate-100 odd:bg-white dark:border-white/5 dark:odd:bg-white/[0.03]">
                              {cells.map((cell, cellIndex) => (
                                <td key={cellIndex} className="max-w-[16rem] whitespace-pre-wrap break-words px-3 py-2 text-slate-800 dark:text-slate-200">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-slate-400">Nothing to preview.</p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 px-5 py-4 dark:border-white/10">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-2xl border border-slate-100/90 bg-white px-5 text-base text-slate-900 hover:bg-sky-50/70 dark:border-white/10 dark:bg-slate-900/80 dark:text-white dark:hover:bg-slate-800"
                onClick={closeExportPreview}
              >
                Close
              </Button>
              <Button
                type="button"
                className="h-11 rounded-2xl bg-cyan-400 px-5 text-base font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
                disabled={!exportPreviewBlobUrl || exportPreviewLoading || !!exportPreviewError}
                onClick={() => {
                  if (!exportPreviewBlobUrl || !exportPreviewFormat) {
                    return;
                  }
                  const a = document.createElement("a");
                  a.href = exportPreviewBlobUrl;
                  a.download = exportDownloadFilename(exportPreviewFormat);
                  a.rel = "noopener";
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                }}
              >
                <Download className="size-4" />
                Download
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
