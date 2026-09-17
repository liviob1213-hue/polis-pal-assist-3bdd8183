import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "br.com.democrat.app",
  appName: "Democrat",
  webDir: "dist",
  server: {
    url: "https://9ef8834b-8b62-4712-96cb-5d61226138a1.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
};

export default config;
