/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_WS_URL: string
  readonly VITE_ROOM_ID: string
  readonly VITE_STUN_URL: string
  readonly VITE_TURN_URL: string
  readonly VITE_TURN_USERNAME: string
  readonly VITE_TURN_PASSWORD: string
  readonly VITE_REPORT_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
