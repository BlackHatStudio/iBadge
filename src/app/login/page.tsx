"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(140deg,#082f49_0%,#0f172a_50%,#111827_100%)] px-6 py-10 text-slate-100">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <div className="rounded-3xl border border-cyan-300/20 bg-slate-950/60 p-8">
          <h1 className="text-4xl font-semibold text-white">Operator Login</h1>
          <p className="mt-2 text-sm text-slate-300">
            Login is currently disabled while kiosk mode is active. Badge registration continues offline without interruption.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-cyan-100">Employee ID</label>
              <Input disabled placeholder="Enter employee number" className="mt-2 h-12 bg-slate-900/60" />
            </div>
            <div>
              <label className="text-sm font-medium text-cyan-100">Password</label>
              <Input disabled type="password" placeholder="Enter password" className="mt-2 h-12 bg-slate-900/60" />
            </div>
          </div>

          <Button className="mt-6 h-12 w-full text-base" disabled>
            Login (Disabled)
          </Button>
        </div>

        <Button asChild variant="outline" className="h-12 border-cyan-200/40 bg-slate-900/60 text-cyan-100 hover:bg-slate-800">
          <Link href="/">Return to Kiosk</Link>
        </Button>
      </div>
    </div>
  );
}
