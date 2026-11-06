import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // The same name everywhere: in the app and under the home-screen icon.
    name: "GymJourno",
    short_name: "GymJourno",
    description: "Plan your workouts and log what you actually do.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // The app's own light background (layout.tsx themeColor, globals.css --background).
    background_color: "#f6f6f7",
    theme_color: "#f6f6f7",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
