import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "br.com.democrat.app",
  appName: "Democrat",
  webDir: "dist",
  server: {
    url: "https://polis-pal-assist.lovable.app/login",
    cleartext: false,
  },
};

export default config;
