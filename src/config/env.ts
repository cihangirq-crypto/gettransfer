type ClientEnv = {
  VITE_API_URL?: string
  MODE: string
}

const raw = import.meta.env as unknown as ClientEnv

export const ENV = {
  apiUrl: raw.VITE_API_URL || '/api',
  mode: raw.MODE || 'development',
}
