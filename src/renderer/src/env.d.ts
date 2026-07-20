/// <reference types="vite/client" />

interface CrewBridge {
  pickFolder(): Promise<string | null>
  start(folder: string, name: string): Promise<{ link: string; wsUrl: string }>
  join(link: string, folder: string, name: string): Promise<{ wsUrl: string }>
  leave(): Promise<void>
}

interface Window {
  crew: CrewBridge
}
