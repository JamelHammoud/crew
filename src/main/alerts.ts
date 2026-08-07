import { app, Notification } from 'electron'
import type { AgentAlert } from '../shared/alerts'

const KEPT = 32
const holder = globalThis as typeof globalThis & { crewAlertsStanding?: Notification[] }
const standing: Notification[] = (holder.crewAlertsStanding ??= [])

export function setBadge(count: number): void {
  app.setBadgeCount(Math.max(0, Math.round(count)))
}

export function alertsStanding(): number {
  return standing.length
}

export function showAlert(alert: AgentAlert, onClick: () => void): void {
  if (!Notification.isSupported()) return
  const notification = new Notification({ title: alert.title, body: alert.body, silent: true })
  const forget = () => {
    const at = standing.indexOf(notification)
    if (at >= 0) standing.splice(at, 1)
  }
  notification.on('click', () => {
    forget()
    onClick()
  })
  notification.on('close', forget)
  notification.on('failed', forget)
  standing.push(notification)
  if (standing.length > KEPT) standing.shift()
  notification.show()
}
