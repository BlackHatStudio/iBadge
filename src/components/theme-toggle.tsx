"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Theme = "" | "dark" | "turnaround" | "turnaround dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("");

  useEffect(() => {
    const root = document.documentElement;
    root.className = theme;
  }, [theme]);

  const themes: { label: string; value: Theme }[] = [
    { label: "Light", value: "" },
    { label: "Dark", value: "dark" },
    { label: "Turnaround", value: "turnaround" },
    { label: "Turnaround Dark", value: "turnaround dark" },
  ];

  return (
    <div className="flex gap-2 flex-wrap">
      {themes.map((t) => (
        <Button
          key={t.value}
          variant={theme === t.value ? "default" : "outline"}
          size="sm"
          onClick={() => setTheme(t.value)}
        >
          {t.label}
        </Button>
      ))}
    </div>
  );
}
