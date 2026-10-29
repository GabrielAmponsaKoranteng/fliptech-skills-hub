/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the real API, e.g. https://api.fliptech.com/v1. Unset = in-browser mock API. */
  readonly VITE_API_URL?: string;
  /** Mock API only: milliseconds of simulated latency per call (default 250) */
  readonly VITE_MOCK_LATENCY?: string;
  /** Mock API only: 0–1 chance each call fails, to test error states (default 0) */
  readonly VITE_MOCK_FAIL_RATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
