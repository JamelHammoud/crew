import { app, Notification } from 'electron'
import type { AgentAlert } from '../shared/alerts'

export function setBadge(count: number): void {
  app.setBadgeCount(Math.max(0, Math.round(count)))
}

export function showAlert(alert: AgentAlert, onClick: () => void): void {
  if (!Notification.isSupported()) return
  const notification = new Notification({ title: alert.title, body: alert.body })
  notification.on('click', onClick)
  notification.show()
}
