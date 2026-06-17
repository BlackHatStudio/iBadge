"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ComponentType, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { AlertCircle, Camera, CheckCircle2, Clock3, Loader2, Mail, QrCode, ScanLine, UserRound, X } from "lucide-react";
import { AdminAccessButton } from "@/components/admin-access-button";
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

type KioskActionButtonProps = {
  "aria-label": string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  active?: boolean;
};

type CheckInResult = {
  status?: string;
  message?: string;
};

type BarcodeDetectorResult = {
  rawValue?: string;
};

type BarcodeDetectorInstance = {
  detect(source: HTMLVideoElement): Promise<BarcodeDetectorResult[]>;
};

type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorInstance;

function KioskHeader() {
  return (
    <header className="relative z-10 flex w-full justify-center pt-16 sm:pt-8">
      <div className="flex items-center justify-center">
        <Image
          src="/ibadge-full.png"
          alt="iBadge"
          width={278}
          height={112}
          priority
          className="h-auto w-[162px] brightness-125 saturate-150 drop-shadow-[0_0_30px_rgba(37,184,255,0.58)] sm:w-[198px]"
        />
      </div>
    </header>
  );
}

function AdminButton() {
  return (
    <AdminAccessButton
      aria-label="Open admin access"
      className="absolute right-4 top-4 z-20 h-[52px] rounded-[0.9rem] border border-cyan-300 bg-[#041632]/62 px-4 text-base font-semibold text-white shadow-[0_0_24px_rgba(25,212,255,0.16),0_0_0_1px_rgba(25,212,255,0.16)_inset] backdrop-blur transition hover:bg-cyan-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#03122b] sm:right-8 sm:top-8 sm:h-16 sm:px-6 sm:text-xl"
    >
      <UserRound className="size-6" aria-hidden="true" />
      Admin
    </AdminAccessButton>
  );
}

function SectionLabel() {
  return (
    <div className="mx-auto mt-7 w-full max-w-[600px] text-center sm:mt-9">
      <div className="flex items-center justify-center gap-4">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-300/58 to-cyan-300/15" />
        <p className="rounded-lg border border-cyan-300/10 bg-[#051b3c]/44 px-8 py-2 text-[0.8rem] font-semibold uppercase text-cyan-200 tracking-[0.46em] shadow-[0_0_22px_rgba(25,212,255,0.12)] drop-shadow-[0_0_14px_rgba(25,212,255,0.9)] sm:text-base">
          Attendance Kiosk
        </p>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent via-cyan-300/58 to-cyan-300/15" />
      </div>
    </div>
  );
}

function ScanPanel({
  mode,
  videoRef,
  cameraError,
  qrStatus,
}: {
  mode: "badge" | "qr";
  videoRef: RefObject<HTMLVideoElement | null>;
  cameraError: string | null;
  qrStatus: string | null;
}) {
  const isQrMode = mode === "qr";

  return (
    <section
      aria-label={isQrMode ? "QR code camera scan area" : "Badge reader scan area"}
      className="relative mx-auto mt-8 flex min-h-[360px] w-full max-w-[760px] flex-col items-center justify-center overflow-hidden rounded-[1.7rem] border border-cyan-300/95 bg-[#041735]/78 px-8 py-10 text-center shadow-[0_0_0_1px_rgba(255,255,255,0.16)_inset,0_0_26px_rgba(25,212,255,0.86),0_0_66px_rgba(37,184,255,0.34)] backdrop-blur-sm sm:mt-10 sm:min-h-[490px] sm:rounded-[2rem] sm:px-14"
    >
      <span className="pointer-events-none absolute -left-1 top-1/2 h-24 w-3 -translate-y-1/2 rounded-r-full border-y border-r border-cyan-100/90 shadow-[0_0_16px_rgba(25,212,255,0.95)]" />
      <span className="pointer-events-none absolute -right-1 top-1/2 h-24 w-3 -translate-y-1/2 rounded-l-full border-y border-l border-cyan-100/90 shadow-[0_0_16px_rgba(25,212,255,0.95)]" />
      <span className="pointer-events-none absolute left-1/2 top-[33%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/14" />
      <span className="pointer-events-none absolute left-1/2 top-[33%] h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/18" />
      {isQrMode ? (
        <>
          <div className="relative z-10 flex size-44 shrink-0 overflow-hidden rounded-full border-2 border-cyan-300 bg-black/45 shadow-[0_0_28px_rgba(25,212,255,0.42)] sm:size-56">
            <video
              ref={videoRef}
              className="h-full w-full scale-x-[-1] object-cover"
              autoPlay
              muted
              playsInline
              aria-label="Front-facing camera preview"
            />
            <div className="pointer-events-none absolute inset-8 rounded-2xl border border-cyan-100/75 shadow-[0_0_18px_rgba(25,212,255,0.45)_inset]" />
            <Camera className="absolute bottom-6 right-6 size-6 text-cyan-100 drop-shadow-[0_0_10px_rgba(25,212,255,0.9)]" aria-hidden="true" />
          </div>
          <div className="relative z-10 mt-12 min-w-0">
            <p className="text-4xl font-bold leading-tight text-white sm:text-[3.55rem]">Scan QR Code</p>
            <p className="mt-4 text-xl font-semibold leading-tight text-white/62 sm:text-[2rem]">
              {cameraError ?? qrStatus ?? "Hold your QR code in front of the camera"}
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="relative z-10 flex size-44 shrink-0 items-center justify-center rounded-full border-2 border-cyan-300 text-cyan-100 shadow-[0_0_28px_rgba(25,212,255,0.5),0_0_52px_rgba(25,212,255,0.16)_inset] sm:size-56">
            <ScanLine className="size-24 stroke-[1.45] drop-shadow-[0_0_20px_rgba(25,212,255,0.95)] sm:size-30" aria-hidden="true" />
          </div>
          <span className="relative z-10 mt-5 h-12 w-px bg-cyan-300/36" />
          <div className="relative z-10 mt-6">
            <p className="text-4xl font-bold leading-tight text-white sm:text-[3.55rem]">Scan Badge</p>
            <p className="mt-3 text-3xl font-semibold leading-tight text-white/62 sm:text-[2.9rem]">on the reader</p>
          </div>
        </>
      )}
    </section>
  );
}

function KioskActionButton({ icon: Icon, onClick, active = false, ...props }: KioskActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative z-20 flex h-[116px] w-full items-center justify-center rounded-[1.2rem] border border-cyan-300 text-cyan-100 shadow-[0_0_20px_rgba(25,212,255,0.22),0_0_0_1px_rgba(25,212,255,0.32)_inset] transition hover:bg-cyan-300/10 hover:shadow-[0_0_28px_rgba(25,212,255,0.38),0_0_0_1px_rgba(25,212,255,0.55)_inset] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#03122b] active:scale-[0.98] sm:h-[128px] ${
        active ? "bg-cyan-300/16 shadow-[0_0_32px_rgba(25,212,255,0.45),0_0_0_1px_rgba(25,212,255,0.75)_inset]" : "bg-[#03122b]/28"
      }`}
      {...props}
    >
      <Icon className="size-14 stroke-[1.8] drop-shadow-[0_0_14px_rgba(25,212,255,0.9)] sm:size-16" aria-hidden="true" />
    </button>
  );
}

function AltCheckinButtons({
  onEmailClick,
  onQrClick,
  qrMode,
}: {
  onEmailClick: () => void;
  onQrClick: () => void;
  qrMode: boolean;
}) {
  return (
    <section className="mt-8 text-center sm:mt-10" aria-label="Alternate check-in options">
      <div className="mx-auto grid w-full max-w-[760px] grid-cols-2 gap-7 sm:gap-8">
        <KioskActionButton aria-label="Check in by email" icon={Mail} onClick={onEmailClick} />
        <KioskActionButton aria-label={qrMode ? "Return to badge scan mode" : "Check in by QR code"} icon={QrCode} onClick={onQrClick} active={qrMode} />
      </div>
    </section>
  );
}

function EmailCheckInModal({
  email,
  status,
  submitting,
  onChange,
  onClose,
  onSubmit,
}: {
  email: string;
  status: CheckInResult | null;
  submitting: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isSuccess = status?.status === "SUCCESS" || status?.status === "ALREADY_CHECKED_IN";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#010713]/72 px-5 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="email-checkin-title">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[520px] rounded-[1.75rem] border border-cyan-300/60 bg-[#061831]/95 p-6 text-left shadow-[0_0_60px_rgba(25,212,255,0.28),0_0_0_1px_rgba(255,255,255,0.12)_inset] sm:p-8"
      >
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/55 bg-cyan-300/10 text-cyan-100 shadow-[0_0_22px_rgba(25,212,255,0.25)]">
            <Mail className="size-8" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="email-checkin-title" className="text-2xl font-semibold text-white sm:text-3xl">
              Email Check-In
            </h2>
            <p className="mt-2 text-base leading-relaxed text-white/68">Enter the attendee email address to check it against the selected event lists.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            aria-label="Close email check-in"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-7">
          <label htmlFor="kiosk-email-checkin" className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
            Email Address
          </label>
          <input
            id="kiosk-email-checkin"
            value={email}
            onChange={(event) => onChange(event.target.value)}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            placeholder="name@example.com"
            className="mt-3 h-16 w-full rounded-2xl border border-cyan-300/35 bg-[#031225]/80 px-5 text-xl text-white outline-none transition placeholder:text-white/35 focus:border-cyan-200 focus:ring-2 focus:ring-cyan-200/50"
            required
          />
        </div>
        {status ? (
          <div
            className={`mt-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-medium ${
              isSuccess ? "border-emerald-300/35 bg-emerald-400/10 text-emerald-100" : "border-amber-300/35 bg-amber-400/10 text-amber-100"
            }`}
            role="status"
          >
            {isSuccess ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" /> : <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />}
            <span>{status.message ?? "Unable to complete check-in."}</span>
          </div>
        ) : null}
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-14 rounded-2xl border border-white/18 bg-white/5 px-6 text-base font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-7 text-base font-bold text-[#031225] shadow-[0_0_26px_rgba(25,212,255,0.34)] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-65"
          >
            {submitting ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
            Check In
          </button>
        </div>
      </form>
    </div>
  );
}

function RecentScanCard() {
  return (
    <section className="mx-auto mt-10 w-full max-w-[760px] sm:mt-12" aria-labelledby="recent-scan-heading">
      <div className="flex items-center justify-center gap-4">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-300/50 to-cyan-300/18" />
        <h2
          id="recent-scan-heading"
          className="flex items-center gap-3 text-[0.82rem] font-semibold uppercase text-cyan-200 tracking-[0.34em] drop-shadow-[0_0_12px_rgba(25,212,255,0.8)] sm:text-base"
        >
          <Clock3 className="size-5 shrink-0" aria-hidden="true" />
          Most Recent Scan
        </h2>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent via-cyan-300/50 to-cyan-300/18" />
      </div>
      <div className="mt-5 flex h-[112px] items-center rounded-[1rem] border border-cyan-100/26 bg-white/[0.055] px-5 shadow-[0_0_34px_rgba(37,184,255,0.1)_inset] backdrop-blur-md sm:h-[132px] sm:px-8">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_0_24px_rgba(37,118,255,0.62)] sm:size-20">
          <UserRound className="size-8 fill-white/95 stroke-[1.7] text-white" aria-hidden="true" />
        </div>
        <p className="ml-6 min-w-0 flex-1 truncate text-2xl font-bold text-white sm:ml-8 sm:text-4xl">Alex Johnson</p>
        <span className="mx-5 hidden h-20 w-px bg-cyan-100/24 sm:block" />
        <time className="text-xl font-bold tabular-nums text-cyan-100 sm:text-3xl">10:24 AM</time>
      </div>
    </section>
  );
}

function KioskFooter() {
  return (
    <footer className="mx-auto mt-10 flex w-full max-w-[620px] items-center justify-center gap-6 pb-2 text-center sm:mt-11">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-300/64 to-cyan-300/20" />
      <p className="text-base font-medium tracking-[0.08em] text-white/55 sm:text-xl">Thank you for checking in!</p>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-cyan-300/64 to-cyan-300/20" />
    </footer>
  );
}

function HiddenBadgeScanner({
  value,
  onChange,
  onSubmit,
  inputRef,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  disabled: boolean;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <form className="sr-only" onSubmit={onSubmit}>
      <label htmlFor="badge-scan">Badge scanner input</label>
      <input
        id="badge-scan"
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        disabled={disabled}
      />
    </form>
  );
}

export function KioskPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const qrSubmittingRef = useRef(false);
  const lastQrTokenRef = useRef<string | null>(null);
  const deviceRef = useRef<Awaited<ReturnType<typeof bootstrapKiosk>>["device"] | null>(null);
  const [ready, setReady] = useState(false);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [device, setDevice] = useState<Awaited<ReturnType<typeof bootstrapKiosk>>["device"] | null>(null);
  const [recentScans, setRecentScans] = useState<AttendanceScan[]>([]);
  const [badgeInput, setBadgeInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailStatus, setEmailStatus] = useState<CheckInResult | null>(null);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [qrMode, setQrMode] = useState(false);
  const [qrCameraError, setQrCameraError] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<string | null>(null);

  const loadKiosk = useCallback(async (forceRefresh = false) => {
    const snapshot = await bootstrapKiosk(forceRefresh);
    setEmployees(snapshot.employees);
    setEvents(snapshot.events);
    setDevice(snapshot.device);
    deviceRef.current = snapshot.device;
    setRecentScans(snapshot.recentScans);
    setReady(true);
  }, []);

  const syncQueued = useCallback(async (useRetryEndpoint = false) => {
    await retryPendingQueue({ useRetryEndpoint });
    const refreshed = await bootstrapKiosk(false);
    setRecentScans(refreshed.recentScans);
  }, []);

  const refreshOnReconnect = useCallback(async () => {
    const currentDevice = deviceRef.current ?? undefined;
    const refreshed = await refreshReferenceData(true, currentDevice);
    setEmployees(refreshed.employees);
    setEvents(refreshed.events);
    setDevice(refreshed.device);
    deviceRef.current = refreshed.device;
    await syncQueued(false);
  }, [syncQueued]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadKiosk(false);
    });

    const handleOnline = () => {
      void refreshOnReconnect();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [loadKiosk, refreshOnReconnect]);

  useEffect(() => {
    deviceRef.current = device;
  }, [device]);

  useEffect(() => {
    if (!ready || emailModalOpen || qrMode) {
      return;
    }

    const id = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 0);

    return () => window.clearTimeout(id);
  }, [ready, isSubmitting, emailModalOpen, qrMode]);

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

  const processBadgeScan = useCallback(async () => {
    if (!device || isSubmitting || qrMode || emailModalOpen) {
      return;
    }

    const rawInput = badgeInput.trim();
    if (!rawInput) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { record, matchedEmployee } = createScanRecord(rawInput, device, employees, events, {
        matchBy: "badge",
      });
      const duplicate = findSuppressedDuplicate(recentScans, {
        badgeRaw: matchedEmployee?.BadgeNumberRaw ?? rawInput,
        eventId: device.ActiveEventId,
        classDurationHours: device.ClassDurationHours,
      });

      setBadgeInput("");

      if (!duplicate) {
        await submitScan(record);
      }

      const refreshed = await bootstrapKiosk(false);
      setRecentScans(refreshed.recentScans);
    } finally {
      setIsSubmitting(false);
    }
  }, [badgeInput, device, employees, events, isSubmitting, recentScans, qrMode, emailModalOpen]);

  useEffect(() => {
    if (!ready || isSubmitting || qrMode || emailModalOpen || !badgeInput.trim()) {
      return;
    }

    const timer = window.setTimeout(() => {
      void processBadgeScan();
    }, 500);

    return () => window.clearTimeout(timer);
  }, [badgeInput, emailModalOpen, isSubmitting, processBadgeScan, qrMode, ready]);

  const submitKioskCheckIn = useCallback(
    async (endpoint: "/api/kiosk/check-in/email" | "/api/kiosk/check-in/qr", body: { email?: string; token?: string }) => {
      if (!device?.ActiveEventId) {
        return {
          status: "FAILED",
          message: "No active event is assigned to this kiosk.",
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          eventId: device.ActiveEventId,
          kioskId: device.DeviceId,
          deviceName: device.DeviceName,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as CheckInResult;

      if (!response.ok) {
        return {
          status: result.status ?? "FAILED",
          message: result.message ?? "Unable to complete check-in. Please see the attendant.",
        };
      }

      const refreshed = await bootstrapKiosk(false);
      setRecentScans(refreshed.recentScans);
      return result;
    },
    [device]
  );

  const submitQrToken = useCallback(
    async (token: string) => {
      if (qrSubmittingRef.current || lastQrTokenRef.current === token) {
        return;
      }

      qrSubmittingRef.current = true;
      lastQrTokenRef.current = token;
      setQrStatus("Checking QR code...");

      try {
        const result = await submitKioskCheckIn("/api/kiosk/check-in/qr", { token });
        setQrStatus(result.message ?? "QR check-in complete.");

        if (result.status === "SUCCESS" || result.status === "ALREADY_CHECKED_IN") {
          window.setTimeout(() => {
            setQrMode(false);
          }, 900);
        } else {
          window.setTimeout(() => {
            lastQrTokenRef.current = null;
          }, 1800);
        }
      } catch {
        setQrStatus("Unable to check QR code. Please see the attendant.");
        window.setTimeout(() => {
          lastQrTokenRef.current = null;
        }, 1800);
      } finally {
        qrSubmittingRef.current = false;
      }
    },
    [submitKioskCheckIn]
  );

  useEffect(() => {
    if (!qrMode) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      return;
    }

    let cancelled = false;
    let animationFrame = 0;

    async function startCamera() {
      setQrCameraError(null);
      setQrStatus("Starting camera...");

      if (!navigator.mediaDevices?.getUserMedia) {
        setQrCameraError("Camera access is not available in this browser.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }

        const Detector = (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
        if (!Detector) {
          setQrStatus("Camera ready. QR detection is not supported in this browser.");
          return;
        }

        const detector = new Detector({ formats: ["qr_code"] });
        setQrStatus("Hold your QR code in front of the camera");

        const scanFrame = async () => {
          if (cancelled || !videoRef.current) {
            return;
          }

          if (videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            try {
              const codes = await detector.detect(videoRef.current);
              const token = codes[0]?.rawValue?.trim();
              if (token) {
                void submitQrToken(token);
              }
            } catch {
              setQrStatus("Camera ready. Align the QR code inside the frame.");
            }
          }

          animationFrame = window.requestAnimationFrame(scanFrame);
        };

        animationFrame = window.requestAnimationFrame(scanFrame);
      } catch {
        setQrCameraError("Camera permission is needed to scan a QR code.");
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [qrMode, submitQrToken]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void processBadgeScan();
  }

  function handleEmailClick() {
    setQrMode(false);
    setEmailInput("");
    setEmailStatus(null);
    setEmailModalOpen(true);
  }

  function handleQrClick() {
    setEmailModalOpen(false);
    setQrCameraError(null);
    setQrStatus(null);
    lastQrTokenRef.current = null;
    setQrMode((current) => !current);
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const email = emailInput.trim();
    if (!email) {
      setEmailStatus({ status: "FAILED", message: "Email is required." });
      return;
    }

    setIsEmailSubmitting(true);
    setEmailStatus(null);

    try {
      const result = await submitKioskCheckIn("/api/kiosk/check-in/email", { email });
      setEmailStatus(result);

      if (result.status === "SUCCESS" || result.status === "ALREADY_CHECKED_IN") {
        window.setTimeout(() => {
          setEmailModalOpen(false);
          setEmailInput("");
          inputRef.current?.focus({ preventScroll: true });
        }, 900);
      }
    } catch {
      setEmailStatus({
        status: "FAILED",
        message: "Unable to complete check-in. Please see the attendant.",
      });
    } finally {
      setIsEmailSubmitting(false);
    }
  }

  function handleEmailClose() {
    setEmailModalOpen(false);
    setEmailStatus(null);
    setEmailInput("");
    window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 0);
  }

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-[#03122b] text-[#f4f7fb]">
      <div className="pointer-events-none absolute inset-0 -z-30 bg-[radial-gradient(ellipse_at_50%_39%,rgba(18,99,174,0.34)_0%,rgba(9,54,111,0.18)_31%,transparent_58%),linear-gradient(180deg,#020b1b_0%,#031632_35%,#041936_60%,#010713_100%)]" />
      <div className="pointer-events-none absolute inset-0 -z-30 bg-[linear-gradient(135deg,rgba(15,71,129,0.24)_0%,rgba(15,71,129,0.11)_17%,transparent_17.2%),linear-gradient(135deg,transparent_0%,transparent_84%,rgba(8,42,83,0.22)_84.2%,rgba(8,42,83,0.05)_100%)]" />
      <div className="pointer-events-none absolute -left-28 top-0 -z-20 h-[530px] w-[470px] rotate-45 bg-gradient-to-b from-[#0a3769]/32 via-[#082a55]/18 to-transparent blur-[1px]" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 -z-20 h-[470px] w-[430px] -rotate-45 bg-gradient-to-t from-[#0a3769]/28 via-[#082a55]/14 to-transparent" />
      <div className="pointer-events-none absolute left-8 top-8 -z-20 grid grid-cols-5 gap-4 opacity-[0.18] sm:left-11 sm:top-10">
        {Array.from({ length: 35 }).map((_, index) => (
          <span key={index} className="size-1 rounded-full bg-[#16bfff]" />
        ))}
      </div>
      <div className="pointer-events-none absolute right-3 top-[54%] -z-20 grid grid-cols-5 gap-4 opacity-[0.2] sm:right-6">
        {Array.from({ length: 40 }).map((_, index) => (
          <span key={index} className="size-1 rounded-full bg-[#16bfff]" />
        ))}
      </div>
      <div className="pointer-events-none absolute left-1/2 top-[48%] -z-20 h-[78vh] w-[92vw] max-w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-[#25b8ff]/18 shadow-[0_0_120px_rgba(37,184,255,0.12)_inset,0_0_42px_rgba(37,184,255,0.12)]" />
      <HiddenBadgeScanner
        value={badgeInput}
        onChange={setBadgeInput}
        onSubmit={handleSubmit}
        inputRef={inputRef}
        disabled={!ready || isSubmitting || emailModalOpen || qrMode}
      />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[900px] flex-col px-5 pb-8 pt-6 sm:px-10">
        <AdminButton />
        <KioskHeader />
        <div className="flex flex-1 flex-col justify-center pb-3 pt-4">
          <SectionLabel />
          <section className="mt-9 text-center sm:mt-12">
            <h1 className="text-[clamp(3.6rem,9.5vw,6.75rem)] font-bold leading-none tracking-normal text-white drop-shadow-[0_12px_20px_rgba(0,0,0,0.48)]">
              Excel Training
            </h1>
            <p className="mt-6 text-2xl font-semibold text-white/66 sm:text-[2rem]">Scan your badge to log attendance</p>
          </section>
          <ScanPanel mode={qrMode ? "qr" : "badge"} videoRef={videoRef} cameraError={qrCameraError} qrStatus={qrStatus} />
          <AltCheckinButtons onEmailClick={handleEmailClick} onQrClick={handleQrClick} qrMode={qrMode} />
          <RecentScanCard />
          <KioskFooter />
        </div>
      </div>
      {emailModalOpen ? (
        <EmailCheckInModal
          email={emailInput}
          status={emailStatus}
          submitting={isEmailSubmitting}
          onChange={setEmailInput}
          onClose={handleEmailClose}
          onSubmit={handleEmailSubmit}
        />
      ) : null}
    </main>
  );
}
