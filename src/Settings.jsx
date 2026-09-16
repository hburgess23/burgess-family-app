import React, { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

export default function Settings({ householdId, activeUser }) {
  const [quietStart, setQuietStart] = useState('22:00')
  const [quietEnd, setQuietEnd] = useState('08:00')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification === 'undefined'
      ? 'unsupported'
      : Notification.permission
  )
  const [notificationStatus, setNotificationStatus] = useState('')
  const [notificationError, setNotificationError] = useState('')

  const isParent = activeUser.role === 'Parent'

  useEffect(() => {
    if (!householdId) return

    let cancelled = false

    async function loadSettings() {
      setLoading(true)

      const { data, error } = await supabase
        .from('household_settings')
        .select('quiet_hours_start, quiet_hours_end')
        .eq('household_id', householdId)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        console.error('Could not load household settings:', error)
        setErrorMessage('Could not load household settings.')
        setLoading(false)
        return
      }

      if (data) {
        setQuietStart(
          data.quiet_hours_start
            ? data.quiet_hours_start.slice(0, 5)
            : '22:00'
        )

        setQuietEnd(
          data.quiet_hours_end
            ? data.quiet_hours_end.slice(0, 5)
            : '08:00'
        )
      }

      setLoading(false)
    }

    loadSettings()

    return () => {
      cancelled = true
    }
  }, [householdId])

  async function saveSettings(event) {
    event.preventDefault()

    if (!isParent) return

    setSaving(true)
    setMessage('')
    setErrorMessage('')

    const { error } = await supabase
      .from('household_settings')
      .upsert(
        {
          household_id: householdId,
          quiet_hours_start: quietStart,
          quiet_hours_end: quietEnd,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'household_id',
        }
      )

    setSaving(false)

    if (error) {
      console.error('Could not save household settings:', error)
      setErrorMessage('Could not save household settings.')
      return
    }

    setMessage('Settings saved.')
  }

  async function testNotifications() {
    setNotificationStatus('')
    setNotificationError('')

    if (
      !('Notification' in window) ||
      !('serviceWorker' in navigator)
    ) {
      setNotificationError(
        'Notifications are not supported by this browser.'
      )
      return
    }

    try {
      setNotificationStatus('Preparing notification…')

      await navigator.serviceWorker.register('/sw.js')

      const registration =
        await navigator.serviceWorker.ready

      const permission =
        Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission()

      setNotificationPermission(permission)

      if (permission !== 'granted') {
        setNotificationStatus('')
        setNotificationError(
          permission === 'denied'
            ? 'Notifications are blocked for this site.'
            : 'Notification permission was not enabled.'
        )
        return
      }

      await registration.showNotification(
        'Burgess Family App',
        {
          body: 'Notifications are working on this device.',
          tag: 'burgess-family-notification-test',
        }
      )

      setNotificationStatus('Test notification sent.')
    } catch (error) {
      console.error('Notification test failed:', error)
      setNotificationStatus('')
      setNotificationError(
        `Notification test failed: ${error.message || 'Unknown error'}`
      )
    }
  }
  return (
    <section className="settings-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Household</p>
          <h2>Settings</h2>
        </div>

        <div className="message-sender-pill">
          {activeUser.emoji} {activeUser.name}
        </div>
      </div>

      <div className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Notifications</p>
            <h3>Quiet Hours</h3>
          </div>

          <span>🔕</span>
        </div>

        <p>
          Normal family notifications will be held during quiet
          hours. Urgent notification options can be added later.
        </p>

        {loading ? (
          <p>Loading settings…</p>
        ) : (
          <form onSubmit={saveSettings}>
            <div className="reminder-form">
              <label>
                Quiet hours start
                <input
                  type="time"
                  value={quietStart}
                  disabled={!isParent}
                  onChange={(event) => {
                    setQuietStart(event.target.value)
                    setMessage('')
                  }}
                />
              </label>

              <label>
                Quiet hours end
                <input
                  type="time"
                  value={quietEnd}
                  disabled={!isParent}
                  onChange={(event) => {
                    setQuietEnd(event.target.value)
                    setMessage('')
                  }}
                />
              </label>

              {isParent && (
                <button
                  className="action-button"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save Settings'}
                </button>
              )}
            </div>
          </form>
        )}

        {!isParent && (
          <p className="reminder-note">
            Parents manage household settings.
          </p>
        )}

        {errorMessage && (
          <p className="form-message error">{errorMessage}</p>
        )}

        {message && (
          <p className="form-message success">{message}</p>
        )}
      </div>

      <div className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">This device</p>
            <h3>Notifications</h3>
          </div>

          <span>🔔</span>
        </div>

        <p>
          Enable notifications on this device so family reminders
          and messages can alert you later.
        </p>

        <p className="reminder-note">
          Permission: <strong>{notificationPermission}</strong>
        </p>

        <button
          className="action-button"
          type="button"
          onClick={testNotifications}
        >
          Test Notification
        </button>

        {notificationStatus && (
          <p className="form-message success">
            {notificationStatus}
          </p>
        )}

        {notificationError && (
          <p className="form-message error">
            {notificationError}
          </p>
        )}
      </div>
    </section>
  )
}