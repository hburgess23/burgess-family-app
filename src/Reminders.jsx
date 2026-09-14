import React, { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { isReminderDueOnDate } from './reminderUtils'

const weekDays = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

export default function Reminders({ householdId, activeUser }) {
  const [reminders, setReminders] = useState([])
  const [profiles, setProfiles] = useState([])
  const [title, setTitle] = useState('')
  const [reminderDate, setReminderDate] = useState('')
  const [reminderTime, setReminderTime] = useState('')
  const [repeatType, setRepeatType] = useState('none')
  const [repeatDays, setRepeatDays] = useState([])
  const [editingId, setEditingId] = useState(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const isParent = activeUser.role === 'Parent'

  async function loadReminders() {
    if (!householdId) return

    setLoading(true)

    const [remindersResult, profilesResult] = await Promise.all([
      supabase
        .from('family_reminders')
        .select(
          'id, created_by_profile_id, title, reminder_date, reminder_time, repeat_type, repeat_days, active, created_at'
        )
        .eq('household_id', householdId)
        .eq('active', true)
        .order('reminder_date', { ascending: true, nullsFirst: false })
        .order('reminder_time', { ascending: true, nullsFirst: false }),

      supabase
        .from('profiles')
        .select('id, name, emoji, role')
        .eq('household_id', householdId)
        .eq('active', true),
    ])

    const firstError =
      remindersResult.error ||
      profilesResult.error

    if (firstError) {
      console.error('Could not load reminders:', firstError)
      setErrorMessage('Could not load reminders.')
      setLoading(false)
      return
    }

    setReminders(remindersResult.data || [])
    setProfiles(profilesResult.data || [])
    setErrorMessage('')
    setLoading(false)
  }

  useEffect(() => {
    loadReminders()
  }, [householdId])

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setReminderDate('')
    setReminderTime('')
    setRepeatType('none')
    setRepeatDays([])
    setMessage('')
    setErrorMessage('')
  }

  function toggleDay(day) {
    setRepeatDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day]
    )
  }

  function editReminder(reminder) {
    if (!isParent) return

    setEditingId(reminder.id)
    setTitle(reminder.title)
    setReminderDate(reminder.reminder_date || '')
    setReminderTime(
      reminder.reminder_time
        ? reminder.reminder_time.slice(0, 5)
        : ''
    )
    setRepeatType(reminder.repeat_type || 'none')
    setRepeatDays(reminder.repeat_days || [])
    setMessage('')
    setErrorMessage('')
  }

  async function saveReminder(event) {
    event.preventDefault()

    const cleanTitle = title.trim()

    if (!cleanTitle) {
      setErrorMessage('Enter a reminder.')
      return
    }

    if (!isParent && repeatType !== 'none') {
      setErrorMessage('Only parents can create repeating reminders.')
      return
    }

    if (
      repeatType === 'selected_days' &&
      repeatDays.length === 0
    ) {
      setErrorMessage('Choose at least one day.')
      return
    }

    const creator = profiles.find(
      (profile) => profile.name === activeUser.name
    )

    if (!creator) {
      setErrorMessage('Could not find the active family profile.')
      return
    }

    setSaving(true)
    setMessage('')
    setErrorMessage('')

    const payload = {
      household_id: householdId,
      created_by_profile_id: creator.id,
      title: cleanTitle,
      reminder_date: reminderDate || null,
      reminder_time: reminderTime || null,
      repeat_type: isParent ? repeatType : 'none',
      repeat_days:
        isParent && repeatType === 'selected_days'
          ? repeatDays
          : [],
      updated_at: new Date().toISOString(),
    }

    let error

    if (editingId && isParent) {
      ;({ error } = await supabase
        .from('family_reminders')
        .update(payload)
        .eq('id', editingId)
        .eq('household_id', householdId))
    } else {
      ;({ error } = await supabase
        .from('family_reminders')
        .insert({
          ...payload,
          active: true,
        }))
    }

    setSaving(false)

    if (error) {
      console.error('Could not save reminder:', error)
      setErrorMessage('Could not save this reminder.')
      return
    }

    setMessage(
      editingId ? 'Reminder updated.' : 'Reminder added.'
    )

    setEditingId(null)
    setTitle('')
    setReminderDate('')
    setReminderTime('')
    setRepeatType('none')
    setRepeatDays([])

    await loadReminders()
  }

  async function removeReminder(reminder) {
    if (!isParent) return

    setReminders((current) =>
      current.filter((item) => item.id !== reminder.id)
    )

    const { error } = await supabase
      .from('family_reminders')
      .update({
        active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reminder.id)
      .eq('household_id', householdId)

    if (error) {
      console.error('Could not remove reminder:', error)
      setErrorMessage('Could not remove this reminder.')
      await loadReminders()
    }
  }

  function repeatLabel(reminder) {
    if (reminder.repeat_type === 'daily') {
      return 'Every day'
    }

    if (reminder.repeat_type === 'weekly') {
      return 'Weekly'
    }

    if (reminder.repeat_type === 'selected_days') {
      return (reminder.repeat_days || [])
        .map((day) => day.slice(0, 3))
        .join(', ')
    }

    return 'One time'
  }

  const todaysReminders = reminders.filter((reminder) =>
    isReminderDueOnDate(reminder)
  )
  function creatorFor(reminder) {
    return profiles.find(
      (profile) =>
        profile.id === reminder.created_by_profile_id
    )
  }

  return (
    <section className="reminders-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Family reminders</p>
          <h2>Reminders</h2>
        </div>

        <div className="message-sender-pill">
          {activeUser.emoji} {activeUser.name}
        </div>
      </div>

      <div className="card reminder-today-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Today</p>
            <h3>Due Today</h3>
          </div>

          <strong>{todaysReminders.length}</strong>
        </div>

        {todaysReminders.length === 0 ? (
          <p>No reminders due today.</p>
        ) : (
          <div className="reminder-today-list">
            {todaysReminders.map((reminder) => (
              <div
                className="reminder-today-item"
                key={reminder.id}
              >
                <span>🔔</span>

                <div>
                  <strong>{reminder.title}</strong>

                  {reminder.reminder_time && (
                    <small>
                      {reminder.reminder_time.slice(0, 5)}
                    </small>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card reminder-form-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              {editingId ? 'Edit reminder' : 'New reminder'}
            </p>
            <h3>
              {editingId
                ? 'Update Reminder'
                : 'Add Family Reminder'}
            </h3>
          </div>

          {editingId && (
            <button
              className="action-button secondary"
              type="button"
              onClick={resetForm}
            >
              Cancel
            </button>
          )}
        </div>

        <form className="reminder-form" onSubmit={saveReminder}>
          <label className="reminder-title-field">
            Reminder
            <input
              type="text"
              value={title}
              placeholder="Example: Bring library books"
              onChange={(event) => {
                setTitle(event.target.value)
                setErrorMessage('')
              }}
            />
          </label>

          <label>
            Date
            <input
              type="date"
              value={reminderDate}
              onChange={(event) =>
                setReminderDate(event.target.value)
              }
            />
          </label>

          <label>
            Time
            <input
              type="time"
              value={reminderTime}
              onChange={(event) =>
                setReminderTime(event.target.value)
              }
            />
          </label>

          {isParent && (
            <label>
              Repeat
              <select
                value={repeatType}
                onChange={(event) => {
                  setRepeatType(event.target.value)

                  if (
                    event.target.value !== 'selected_days'
                  ) {
                    setRepeatDays([])
                  }
                }}
              >
                <option value="none">One time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="selected_days">
                  Selected days
                </option>
              </select>
            </label>
          )}

          <button
            className="action-button"
            type="submit"
            disabled={saving}
          >
            {saving
              ? 'Saving…'
              : editingId
                ? 'Save Reminder'
                : 'Add Reminder'}
          </button>
        </form>

        {isParent && repeatType === 'selected_days' && (
          <div className="reminder-days">
            {weekDays.map((day) => (
              <button
                key={day}
                type="button"
                className={
                  repeatDays.includes(day)
                    ? 'reminder-day active'
                    : 'reminder-day'
                }
                onClick={() => toggleDay(day)}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        )}

        {!isParent && (
          <p className="reminder-note">
            Child profiles can add one-time family reminders.
            Parents manage repeating reminders.
          </p>
        )}

        <p className="reminder-note">
          🔕 Normal reminder notifications will respect quiet
          hours from 10 PM to 8 AM.
        </p>

        {errorMessage && (
          <p className="form-message error">{errorMessage}</p>
        )}

        {message && (
          <p className="form-message success">{message}</p>
        )}
      </div>

      <div className="reminder-list">
        {loading ? (
          <div className="card">
            <p>Loading reminders…</p>
          </div>
        ) : reminders.length === 0 ? (
          <div className="card">
            <p>No family reminders yet.</p>
          </div>
        ) : (
          reminders.map((reminder) => {
            const creator = creatorFor(reminder)

            return (
              <article
                className="card reminder-card"
                key={reminder.id}
              >
                <div className="reminder-icon">🔔</div>

                <div className="reminder-details">
                  <h3>{reminder.title}</h3>

                  <div className="reminder-meta">
                    {reminder.reminder_date && (
                      <span>📅 {reminder.reminder_date}</span>
                    )}

                    {reminder.reminder_time && (
                      <span>
                        🕒 {reminder.reminder_time.slice(0, 5)}
                      </span>
                    )}

                    <span>🔁 {repeatLabel(reminder)}</span>
                  </div>

                  {creator && (
                    <small>
                      Added by {creator.emoji} {creator.name}
                    </small>
                  )}
                </div>

                {isParent && (
                  <div className="reminder-actions">
                    <button
                      className="action-button secondary"
                      type="button"
                      onClick={() => editReminder(reminder)}
                    >
                      Edit
                    </button>

                    <button
                      className="action-button secondary"
                      type="button"
                      onClick={() => removeReminder(reminder)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}