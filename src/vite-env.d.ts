/// <reference types="vite/client" />

type StackBackendEnv = "production" | "preview";
type StackDeploymentEnv = "production" | "preview" | "development";

declare const __STACK_DEPLOYMENT_ENV__: StackDeploymentEnv;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_STACK_BACKEND_ENV?: StackBackendEnv;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
