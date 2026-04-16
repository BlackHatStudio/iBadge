"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { buildAdminAccessPath, hasAdminAccessSession } from "@/lib/admin-access";

type AdminAccessButtonProps = Omit<ComponentProps<typeof Button>, "asChild"> & {
  redirectTo?: string;
};

export function AdminAccessButton({
  children,
  disabled,
  onClick,
  redirectTo = "/admin",
  ...props
}: AdminAccessButtonProps) {
  const router = useRouter();

  return (
    <Button
      type="button"
      {...props}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || disabled) {
          return;
        }

        router.push(hasAdminAccessSession() ? redirectTo : buildAdminAccessPath(redirectTo));
      }}
    >
      {children}
    </Button>
  );
}
