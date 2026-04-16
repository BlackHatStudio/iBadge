import { Suspense } from "react";
import { PinEntryForm } from "@/components/pin-entry-form";

export const dynamic = "force-dynamic";

export default function AdminAccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" aria-hidden />}>
      <PinEntryForm />
    </Suspense>
  );
}
