import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "iBadge Attendance Kiosk",
    short_name: "iBadge",
    description: "Attendance kiosk with offline queueing, event-based device logging, and admin review.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0c1826",
    theme_color: "#22d3ee",
    orientation: "landscape",
    icons: [
      {
        src: "/ibadge-favicon.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/ibadge-favicon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };
}
