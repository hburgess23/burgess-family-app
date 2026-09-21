import React, { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { isReminderDueOnDate } from './reminderUtils'

export default function TodayReminders({
  householdId,
  setActive,
}) {
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!householdId) {
      setReminders([])
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadReminders() {
      setLoading(true)

      const { data, error } = await supabase
        .from('family_reminders')
        .select(
          'id, title, reminder_date, reminder_time, repeat_type, repeat_days, active'
        )
        .eq('household_id', householdId)
        .eq('active', true)
        .order('reminder_time', {
          ascending: true,
          nullsFirst: false,
        })

      if (cancelled) return

      if (error) {
        console.error(
          'Could not load dashboard reminders:',
          error
        )
        setReminders([])
        setLoading(false)
        return
      }

      setReminders(
        (data || []).filter((reminder) =>
          isReminderDueOnDate(reminder)
        )
      )

      setLoading(false)
    }

    loadReminders()

    return () => {
      cancelled = true
    }
  }, [householdId])

  return (
    <section className="card today-reminders-card">
      <div className="section-heading today-reminders-heading">
        <div>
          <p className="eyebrow">Today</p>
          <h3>Today's Reminders</h3>
        </div>

        <div className="today-reminders-count">
          🔔 {reminders.length}
        </div>
      </div>

      {loading ? (
        <p className="today-reminders-empty">
          Loading reminders…
        </p>
      ) : reminders.length === 0 ? (
        <div className="today-reminders-empty">
          <span>✨</span>
          <p>No reminders due today.</p>
        </div>
      ) : (
        <div className="today-reminders-list">
          {reminders.slice(0, 4).map((reminder) => (
            <button
              className="today-reminder-item"
              type="button"
              key={reminder.id}
              onClick={() => setActive('Reminders')}
            >
              <span className="today-reminder-bell">
                🔔
              </span>

              <span className="today-reminder-title">
                {reminder.title}
              </span>

              {reminder.reminder_time && (
                <strong className="today-reminder-time">
                  {reminder.reminder_time.slice(0, 5)}
                </strong>
              )}
            </button>
          ))}

          {reminders.length > 4 && (
            <p className="today-reminders-more">
              +{reminders.length - 4} more today
            </p>
          )}
        </div>
      )}

      <button
        className="action-button secondary today-reminders-view-all"
        type="button"
        onClick={() => setActive('Reminders')}
      >
        View all reminders →
      </button>
    </section>
  )
}