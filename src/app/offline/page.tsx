import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(155deg,#0c1826_0%,#153248_38%,#1a4f6a_100%)] px-6 py-8 text-slate-100">
      <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-slate-950/75 p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.34em] text-cyan-200/80">Offline Mode</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">The kiosk shell is still available</h1>
        <p className="mt-4 text-base leading-7 text-slate-300">
          Cached employee, event, device, and scan data remain available on this device. New scans will continue to queue locally and retry when connectivity returns.
        </p>
        <Button asChild className="mt-8 h-12 rounded-2xl bg-cyan-400 px-6 text-base font-semibold text-slate-950 hover:bg-cyan-300">
          <Link href="/">Return to Kiosk</Link>
        </Button>
      </div>
    </div>
  );
}
