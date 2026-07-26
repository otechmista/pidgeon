/// <reference types="svelte" />
/// <reference types="vite/client" />

import type { PidgeonApi } from "@pidgeon/shared";

declare global {
  interface Window {
    pidgeon: PidgeonApi;
  }
}

export {};
