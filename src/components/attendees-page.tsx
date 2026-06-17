"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition, type ComponentProps, type ReactNode } from "react";
import { ArrowLeft, Bell, Download, Moon, QrCode, RefreshCcw, Search, Send, ShieldOff, Sun, Trash2, Upload, UserCircle2, UserPlus } from "lucide-react";
import { AdminGuard } from "@/components/admin-guard";
import { useIbadgeTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createAttendee,
  createAttendeeList,
  getAttendeeCsvTemplateUrl,
  getAttendeeLists,
  getAttendees,
  regenerateAttendeeQr,
  removeAttendee,
  revokeAttendeeQr,
  sendAttendeeListQr,
  sendAttendeeQr,
  setAttendeeListActive,
  updateAttendee,
  uploadAttendeeCsv,
} from "@/lib/api";
import type { AttendeeDetail, AttendeeListSummary } from "@/lib/attendees/types";
import { cn } from "@/lib/utils";

type AttendeeDraft = {
  attendeeId?: number;
  badgeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  company: string;
};

const EMPTY_DRAFT: AttendeeDraft = {
  badgeNumber: "",
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  company: "",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Not sent";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function parseApiError(error: unknown) {
  if (!(error instanceof Error)) return "Request failed.";
  try {
    const parsed = JSON.parse(error.message) as { error?: { message?: string } };
    return parsed.error?.message ?? error.message;
  } catch {
    return error.message;
  }
}

function HeaderButton({ children, className, ...props }: ComponentProps<typeof Button>) {
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

function HeaderPrimaryButton({ children, className, ...props }: ComponentProps<typeof Button>) {
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

function PanelHeading({ label, title, description }: { label: string; title: string; description?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-cyan-100/62 tracking-[0.24em]">{label}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-normal text-white">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-white/68">{description}</p> : null}
    </div>
  );
}

function StatusPill({ tone, children }: { tone: "success" | "pending" | "muted"; children: ReactNode }) {
  const styles = {
    success: "border-emerald-300/20 bg-emerald-400/12 text-emerald-300",
    pending: "border-amber-300/20 bg-amber-400/12 text-amber-300",
    muted: "border-white/10 bg-white/8 text-white/64",
  };

  return <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold", styles[tone])}>{children}</span>;
}

const formInputClassName = "h-12 rounded-2xl border border-cyan-300/15 bg-[#031225]/65 px-4 text-base text-white placeholder:text-white/42 focus-visible:ring-cyan-300 focus-visible:ring-offset-[#031225]";
const tableActionButtonClassName = "h-9 rounded-xl border-cyan-300/20 bg-[#071a33]/70 px-3 text-white hover:border-cyan-300/45 hover:bg-cyan-300/10";

function AttendeesThemeToggle() {
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

export function AttendeesPage() {
  return (
    <AdminGuard>
      <AttendeesPageInner />
    </AdminGuard>
  );
}

function AttendeesPageInner() {
  const [lists, setLists] = useState<AttendeeListSummary[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [attendees, setAttendees] = useState<AttendeeDetail[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [listName, setListName] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<AttendeeDraft>(EMPTY_DRAFT);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isPending, startTransition] = useTransition();

  const selectedList = lists.find((list) => list.attendeeListId === selectedListId) ?? null;

  const refreshLists = useCallback(async () => {
    const nextLists = await getAttendeeLists();
    setLists(nextLists);
    setSelectedListId((current) => current ?? nextLists[0]?.attendeeListId ?? null);
  }, []);

  const refreshAttendees = useCallback(async (attendeeListId: number | null) => {
    if (!attendeeListId) {
      setAttendees([]);
      return;
    }
    setAttendees(await getAttendees(attendeeListId));
    setSelectedIds([]);
  }, []);

  useEffect(() => {
    void refreshLists();
  }, [refreshLists]);

  useEffect(() => {
    void refreshAttendees(selectedListId);
  }, [refreshAttendees, selectedListId]);

  const filteredAttendees = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return attendees;
    return attendees.filter((attendee) =>
      [
        attendee.firstName,
        attendee.lastName,
        attendee.email,
        attendee.badgeNumber ?? "",
        attendee.company ?? "",
      ].some((value) => value.toLowerCase().includes(q))
    );
  }, [attendees, query]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  function runAction(action: () => Promise<void>) {
    startTransition(async () => {
      try {
        await action();
      } catch (error) {
        setStatusMessage(parseApiError(error));
      }
    });
  }

  function saveDraft() {
    if (!selectedListId) {
      setStatusMessage("Create or select an attendee list first.");
      return;
    }
    runAction(async () => {
      const payload = {
        badgeNumber: draft.badgeNumber || null,
        firstName: draft.firstName,
        lastName: draft.lastName,
        email: draft.email,
        phoneNumber: draft.phoneNumber || null,
        company: draft.company || null,
      };
      if (draft.attendeeId) {
        await updateAttendee(draft.attendeeId, payload);
        setStatusMessage("Attendee updated. Existing QR token was preserved.");
      } else {
        await createAttendee(selectedListId, payload);
        setStatusMessage("Attendee added.");
      }
      setDraft(EMPTY_DRAFT);
      await refreshAttendees(selectedListId);
      await refreshLists();
    });
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
            <HeaderButton asChild>
              <Link href="/admin">
                <ArrowLeft className="size-4" aria-hidden />
                Admin
              </Link>
            </HeaderButton>
            <HeaderButton asChild>
              <Link href="/">Kiosk</Link>
            </HeaderButton>
            <HeaderPrimaryButton asChild>
              <Link href="/admin/review">Open Review</Link>
            </HeaderPrimaryButton>
            <AttendeesThemeToggle />
            <HeaderButton type="button" size="icon" aria-label="Notifications" className="size-12 p-0">
              <Bell className="size-5" aria-hidden />
            </HeaderButton>
            <HeaderButton type="button" className="gap-2">
              <UserCircle2 className="size-5" aria-hidden />
              Admin
            </HeaderButton>
          </div>
        </header>

        <section className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div>
            <p className="text-xs font-semibold uppercase text-cyan-100/62 tracking-[0.32em]">Admin Console</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-normal text-white md:text-5xl">Attendee Management</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-white/72">
              Manage reusable attendee lists, CSV imports, attendee records, and reusable QR credentials.
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
            Attendee records ready
          </div>
          <p>{lists.length} attendee list{lists.length === 1 ? "" : "s"}</p>
          <p>{attendees.length} attendee{attendees.length === 1 ? "" : "s"} in selected list</p>
        </div>

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-6">
            <div className="rounded-[1.6rem] border border-[rgba(64,148,255,0.25)] bg-[#071a33]/78 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22),0_0_64px_rgba(25,212,255,0.045)_inset] backdrop-blur">
              <PanelHeading label="Lists" title="Create attendee list" description="Start a reusable attendee list for event QR check-in." />
              <div className="mt-4 space-y-3">
                <Input value={listName} onChange={(event) => setListName(event.target.value)} placeholder="List name" className={formInputClassName} />
                <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" className={formInputClassName} />
                <HeaderPrimaryButton
                  type="button"
                  disabled={isPending || !listName.trim()}
                  onClick={() =>
                    runAction(async () => {
                      const created = await createAttendeeList({ listName, description: description || null });
                      setListName("");
                      setDescription("");
                      setSelectedListId(created.attendeeListId);
                      setStatusMessage(`Created attendee list "${created.listName}".`);
                      await refreshLists();
                    })
                  }
                >
                  <UserPlus className="size-4" />
                  Create List
                </HeaderPrimaryButton>
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-[rgba(64,148,255,0.25)] bg-[#071a33]/78 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22),0_0_64px_rgba(25,212,255,0.045)_inset] backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <PanelHeading label="Directory" title="Attendee lists" />
                <HeaderButton asChild className="h-10 rounded-2xl">
                  <a href={getAttendeeCsvTemplateUrl()}>
                    <Download className="size-4" />
                    Template
                  </a>
                </HeaderButton>
              </div>
              <div className="mt-4 space-y-3">
                {lists.map((list) => (
                  <button
                    key={list.attendeeListId}
                    type="button"
                    onClick={() => setSelectedListId(list.attendeeListId)}
                    className={cn(
                      "w-full rounded-[1.2rem] border px-4 py-3 text-left transition hover:bg-cyan-300/10",
                      selectedListId === list.attendeeListId
                        ? "border-cyan-300/45 bg-cyan-400/10 shadow-[0_0_22px_rgba(25,212,255,0.1)]"
                        : "border-cyan-300/12 bg-white/[0.035]"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-white">{list.listName}</p>
                      <StatusPill tone={list.isActive ? "success" : "muted"}>{list.isActive ? "Active" : "Inactive"}</StatusPill>
                    </div>
                    <p className="mt-2 text-sm text-white/68">{list.description || "No description"}</p>
                    <p className="mt-2 text-xs text-white/48">
                      {list.attendeeCount} attendees · Last upload {formatDate(list.lastUploadedAt)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[1.6rem] border border-[rgba(64,148,255,0.25)] bg-[#071a33]/78 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22),0_0_64px_rgba(25,212,255,0.045)_inset] backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-cyan-100/62 tracking-[0.24em]">Selected list</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-normal text-white">{selectedList?.listName ?? "No list selected"}</h2>
                </div>
                {selectedList ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-2xl border-cyan-300/20 bg-[#071a33]/70 text-white hover:border-cyan-300/45 hover:bg-cyan-300/10"
                      onClick={() =>
                        runAction(async () => {
                          await setAttendeeListActive(selectedList.attendeeListId, !selectedList.isActive);
                          setStatusMessage(`${selectedList.isActive ? "Deactivated" : "Activated"} attendee list.`);
                          await refreshLists();
                        })
                      }
                    >
                      <ShieldOff className="size-4" />
                      {selectedList.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <HeaderPrimaryButton
                      type="button"
                      className="h-11 px-4"
                      onClick={() =>
                        runAction(async () => {
                          const result = await sendAttendeeListQr(selectedList.attendeeListId, { sendAll: true });
                          setStatusMessage(`QR send complete: ${result.sent} sent, ${result.failed} failed.`);
                          await refreshAttendees(selectedList.attendeeListId);
                        })
                      }
                    >
                      <Send className="size-4" />
                      Send All
                    </HeaderPrimaryButton>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-2xl border-cyan-300/20 bg-[#071a33]/70 text-white hover:border-cyan-300/45 hover:bg-cyan-300/10"
                      disabled={selectedIds.length === 0}
                      onClick={() =>
                        runAction(async () => {
                          const result = await sendAttendeeListQr(selectedList.attendeeListId, { attendeeIds: selectedIds });
                          setStatusMessage(`Selected QR send complete: ${result.sent} sent, ${result.failed} failed.`);
                          await refreshAttendees(selectedList.attendeeListId);
                        })
                      }
                    >
                      <QrCode className="size-4" />
                      Send Selected
                    </Button>
                  </div>
                ) : null}
              </div>

              {selectedList ? (
                <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
                  <label className="flex h-12 cursor-pointer items-center gap-3 rounded-2xl border border-cyan-300/15 bg-[#031225]/65 px-4 text-sm font-medium text-white shadow-sm hover:bg-cyan-300/10">
                    <Upload className="size-4" />
                    Upload CSV
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.currentTarget.value = "";
                        if (!file) return;
                        runAction(async () => {
                          const result = await uploadAttendeeCsv(selectedList.attendeeListId, file);
                          setStatusMessage(`Imported ${result.imported} attendees. Upload batch ${result.uploadBatchId}.`);
                          await refreshAttendees(selectedList.attendeeListId);
                          await refreshLists();
                        });
                      }}
                    />
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-cyan-100/50" />
                    <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search attendees" className={cn(formInputClassName, "pl-11")} />
                  </div>
                </div>
              ) : null}
            </div>

            {selectedList ? (
              <div className="rounded-[1.6rem] border border-[rgba(64,148,255,0.25)] bg-[#071a33]/78 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22),0_0_64px_rgba(25,212,255,0.045)_inset] backdrop-blur">
                <PanelHeading label="Attendee record" title={draft.attendeeId ? "Edit attendee" : "Add attendee"} />
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <Input value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} placeholder="First name" className={formInputClassName} />
                  <Input value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} placeholder="Last name" className={formInputClassName} />
                  <Input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder="Email" className={formInputClassName} />
                  <Input value={draft.badgeNumber} onChange={(event) => setDraft({ ...draft, badgeNumber: event.target.value })} placeholder="Badge number" className={formInputClassName} />
                  <Input value={draft.phoneNumber} onChange={(event) => setDraft({ ...draft, phoneNumber: event.target.value })} placeholder="Phone number" className={formInputClassName} />
                  <Input value={draft.company} onChange={(event) => setDraft({ ...draft, company: event.target.value })} placeholder="Company" className={formInputClassName} />
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <HeaderPrimaryButton type="button" disabled={isPending} onClick={saveDraft} className="h-11 px-5">
                    {draft.attendeeId ? "Save Attendee" : "Add Attendee"}
                  </HeaderPrimaryButton>
                  {draft.attendeeId ? (
                    <HeaderButton type="button" variant="outline" className="h-11 rounded-2xl" onClick={() => setDraft(EMPTY_DRAFT)}>
                      Cancel
                    </HeaderButton>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-[1.6rem] border border-[rgba(64,148,255,0.25)] bg-[#071a33]/78 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22),0_0_64px_rgba(25,212,255,0.045)_inset] backdrop-blur">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <PanelHeading label="Attendees" title="Current list records" description="Search, edit, send, regenerate, revoke, and remove attendees." />
              </div>
              <div className="overflow-auto rounded-[1rem] border border-cyan-300/12">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-[#031225]/70">
                    <tr className="border-b border-white/8 text-left text-xs uppercase tracking-[0.16em] text-white/48">
                      <th className="px-3 py-3">Select</th>
                      <th className="px-3 py-3">Name</th>
                      <th className="px-3 py-3">Email</th>
                      <th className="px-3 py-3">Badge</th>
                      <th className="px-3 py-3">QR status</th>
                      <th className="px-3 py-3">Last sent</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttendees.map((attendee) => (
                      <tr key={attendee.attendeeId} className="border-b border-white/8 bg-white/[0.025] text-white/76 last:border-b-0 hover:bg-cyan-300/[0.035]">
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            className="size-5 accent-cyan-500"
                            checked={selectedSet.has(attendee.attendeeId)}
                            onChange={() =>
                              setSelectedIds((current) =>
                                current.includes(attendee.attendeeId)
                                  ? current.filter((id) => id !== attendee.attendeeId)
                                  : [...current, attendee.attendeeId]
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-3 font-semibold text-white">{attendee.firstName} {attendee.lastName}</td>
                        <td className="px-3 py-3 text-white/68">{attendee.email}</td>
                        <td className="px-3 py-3 text-white/68">{attendee.badgeNumber || "None"}</td>
                        <td className="px-3 py-3 text-white/68">{attendee.lastSendStatus || (attendee.hasQrToken ? "NOT_SENT" : "NO_TOKEN")}</td>
                        <td className="px-3 py-3 text-white/68">{formatDate(attendee.lastSentAtUtc)}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="outline" className={tableActionButtonClassName} onClick={() => setDraft({
                              attendeeId: attendee.attendeeId,
                              badgeNumber: attendee.badgeNumber ?? "",
                              firstName: attendee.firstName,
                              lastName: attendee.lastName,
                              email: attendee.email,
                              phoneNumber: attendee.phoneNumber ?? "",
                              company: attendee.company ?? "",
                            })}>
                              Edit
                            </Button>
                            <Button type="button" variant="outline" className={tableActionButtonClassName} onClick={() => selectedListId && runAction(async () => {
                              await sendAttendeeQr(attendee.attendeeId);
                              setStatusMessage(`QR sent to ${attendee.email}.`);
                              await refreshAttendees(selectedListId);
                            })}>
                              <Send className="size-4" />
                            </Button>
                            <Button type="button" variant="outline" className={tableActionButtonClassName} onClick={() => selectedListId && runAction(async () => {
                              await regenerateAttendeeQr(attendee.attendeeId);
                              setStatusMessage("QR token regenerated. Send it before using at a kiosk.");
                              await refreshAttendees(selectedListId);
                            })}>
                              <RefreshCcw className="size-4" />
                            </Button>
                            <Button type="button" variant="outline" className={tableActionButtonClassName} onClick={() => selectedListId && runAction(async () => {
                              await revokeAttendeeQr(attendee.attendeeId);
                              setStatusMessage("QR token revoked.");
                              await refreshAttendees(selectedListId);
                            })}>
                              Revoke
                            </Button>
                            <Button type="button" variant="destructive" className="h-9 rounded-xl px-3" onClick={() => selectedListId && runAction(async () => {
                              await removeAttendee(attendee.attendeeId);
                              setStatusMessage("Attendee removed. Historical check-ins remain.");
                              await refreshAttendees(selectedListId);
                              await refreshLists();
                            })}>
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
        <footer className="grid gap-4 rounded-[1.25rem] border border-cyan-300/12 bg-[#071a33]/70 px-6 py-4 text-sm text-white/66 md:grid-cols-4">
          <p><span className="text-emerald-300">Attendee Status: Ready</span></p>
          <p>Lists: {lists.length}</p>
          <p>Selected attendees: {selectedIds.length}</p>
          <p className="md:text-right">QR management enabled</p>
        </footer>
      </div>
    </main>
  );
}
