"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { buildAdminAccessPath, hasAdminAccessSession } from "@/lib/admin-access";

export function AdminGuard({
  children,
  title = "Admin Access Required",
}: {
  children: ReactNode;
  title?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (hasAdminAccessSession()) {
      queueMicrotask(() => setAllowed(true));
      return;
    }

    router.replace(buildAdminAccessPath(pathname || "/admin"));
  }, [pathname, router]);

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(155deg,#0c1826_0%,#153248_38%,#1a4f6a_100%)] px-6 py-8 text-slate-100">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-950/70 p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/75">iBadge Admin</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">{title}</h1>
          <p className="mt-3 text-sm text-slate-300">Checking the local admin session and redirecting to the PIN entry screen if needed.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
