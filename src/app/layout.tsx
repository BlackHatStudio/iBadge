import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "iBadge Attendance Kiosk",
  description: "Offline-ready badge attendance kiosk with event-based device logging and admin review.",
  manifest: "/manifest.webmanifest",
  applicationName: "iBadge",
  appleWebApp: {
    capable: true,
    title: "iBadge",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/ibadge-favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/ibadge-favicon.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: "/ibadge-favicon.png",
    apple: "/ibadge-favicon.png",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="min-h-full antialiased">
        <Script id="ibadge-theme-init" strategy="beforeInteractive">
          {`try{var t=localStorage.getItem('ibadge-theme');var d=t!=='light';document.documentElement.classList.toggle('dark',d);document.documentElement.setAttribute('data-theme',t==='light'?'light':t==='dark'?'dark':'dark');}catch(e){document.documentElement.classList.add('dark');document.documentElement.setAttribute('data-theme','dark');}`}
        </Script>
        <Script src="/runtime-config.js" strategy="beforeInteractive" />
        <Script id="ibadge-sw-register" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function (error) { console.warn('Service worker registration failed', error); }); }); }`}
        </Script>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
