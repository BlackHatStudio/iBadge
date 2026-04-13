"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { verifyAdminPin } from "@/lib/admin-access";
import { readDeviceConfig } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PinEntryForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const returnTo = searchParams.get("returnTo") || "/admin";

  useEffect(() => {
    let cancelled = false;

    async function loadDevice() {
      const device = await readDeviceConfig();
      if (!cancelled) {
        setDeviceId(device?.DeviceId ?? null);
      }
    }

    void loadDevice();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[linear-gradient(155deg,#0f172a_0%,#0f3b4e_50%,#07121f_100%)] px-6 py-8 text-slate-100 md:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">Attendance Kiosk</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">Admin access</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
              Enter the admin PIN to access event management, device settings, queue controls, and scan review.
            </p>

            <div className="mt-8 rounded-[1.5rem] border border-cyan-300/15 bg-cyan-400/10 p-5">
              <div className="flex items-start gap-4">
                <ShieldCheck className="mt-1 size-6 text-cyan-200" />
                <div>
                  <p className="text-lg font-semibold text-white">Offline-friendly PIN gate</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    When the API is online, the app verifies through `/api/admin/pin/verify`. If the kiosk is offline, it falls back to the locally cached PIN so the device can still be administered.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur md:p-10">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-100">
                <LockKeyhole className="size-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Protected Area</p>
                <p className="text-lg font-semibold text-white">Enter PIN</p>
              </div>
            </div>

            <form
              className="mt-8 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                setMessage(null);

                startTransition(async () => {
                  const ok = await verifyAdminPin(pin, deviceId);
                  if (!ok) {
                    setMessage("PIN verification failed. Check the code and try again.");
                    return;
                  }

                  router.replace(returnTo);
                });
              }}
            >
              <div>
                <label htmlFor="pin" className="text-sm font-medium text-cyan-100">
                  4-digit admin PIN
                </label>
                <Input
                  id="pin"
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  autoFocus
                  maxLength={4}
                  placeholder="••••"
                  className="mt-2 h-16 rounded-2xl border-white/10 bg-slate-900/80 px-5 text-center text-3xl tracking-[0.45em] text-white"
                />
              </div>

              <Button type="submit" className="h-14 w-full rounded-2xl bg-cyan-400 text-lg font-semibold text-slate-950 hover:bg-cyan-300" disabled={isPending}>
                {isPending ? "Verifying..." : "Continue to Admin"}
              </Button>

              {message && <p className="rounded-2xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{message}</p>}
            </form>

            <Button asChild variant="outline" className="mt-6 h-12 w-full rounded-2xl border-white/10 bg-slate-900/80 text-base text-slate-100 hover:bg-slate-800">
              <Link href="/">Return to Kiosk</Link>
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}
