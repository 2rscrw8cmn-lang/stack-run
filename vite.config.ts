import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const stackDeploymentEnv =
  process.env.VERCEL_ENV === "production"
    ? "production"
    : process.env.VERCEL_ENV === "preview"
      ? "preview"
      : "development";

export default defineConfig({
  plugins: [react()],
  define: {
    __STACK_DEPLOYMENT_ENV__: JSON.stringify(stackDeploymentEnv),
  },
});
