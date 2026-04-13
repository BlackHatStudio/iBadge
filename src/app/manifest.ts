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
    background_color: "#07121f",
    theme_color: "#22d3ee",
    orientation: "landscape",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
