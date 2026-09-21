import React, { useEffect, useMemo, useState } from "react"
import { supabase } from "./lib/supabase"

const TIMEZONE = "America/Vancouver"

function toLocalInputValue(dateTime) {
  if (!dateTime) return ""
  const d = new Date(dateTime)
  const pad = (n) => String(n).padStart(2, "0")

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function getEventStart(event) {
  if (event.start?.date) {
    return new Date(`${event.start.date}T12:00:00`)
  }

  return new Date(event.start?.dateTime)
}

function getDateBadge(event) {
  const date = getEventStart(event)

  return {
    month: date
      .toLocaleDateString([], { month: "short" })
      .toUpperCase(),
    day: date.getDate(),
  }
}

export default function Calendar({ activeUser }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [editingId, setEditingId] = useState(null)

  const isParent = activeUser?.role === "Parent"

  const [form, setForm] = useState({
    title: "",
    date: "",
    startTime: "",
    endTime: "",
    allDay: false,
    location: "",
    notes: "",
  })

  const range = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)

    const end = new Date()
    end.setMonth(end.getMonth() + 6)

    return {
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
    }
  }, [])

  async function loadEvents() {
    setLoading(true)
    setError("")

    const { data, error } = await supabase.functions.invoke(
      "family-calendar",
      {
        body: {
          action: "list",
          timeMin: range.timeMin,
          timeMax: range.timeMax,
        },
      }
    )

    if (error) {
      console.error(error)
      setError("Unable to load the family calendar.")
      setEvents([])
    } else {
      setEvents(data?.items ?? [])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadEvents()
  }, [])

  function resetForm() {
    setEditingId(null)

    setForm({
      title: "",
      date: "",
      startTime: "",
      endTime: "",
      allDay: false,
      location: "",
      notes: "",
    })
  }

  function editEvent(event) {
    const allDay = Boolean(event.start?.date)

    if (allDay) {
      setForm({
        title: event.summary ?? "",
        date: event.start?.date ?? "",
        startTime: "",
        endTime: "",
        allDay: true,
        location: event.location ?? "",
        notes: event.description ?? "",
      })
    } else {
      const start = toLocalInputValue(event.start?.dateTime)
      const end = toLocalInputValue(event.end?.dateTime)

      setForm({
        title: event.summary ?? "",
        date: start.slice(0, 10),
        startTime: start.slice(11, 16),
        endTime: end.slice(11, 16),
        allDay: false,
        location: event.location ?? "",
        notes: event.description ?? "",
      })
    }

    setEditingId(event.id)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function saveEvent(e) {
    e.preventDefault()

    if (!isParent) return

    if (!form.title.trim() || !form.date) {
      setError("Please enter an event name and date.")
      return
    }

    setSaving(true)
    setError("")

    let event

    if (form.allDay) {
      const end = new Date(`${form.date}T12:00:00`)
      end.setDate(end.getDate() + 1)

      const pad = (n) => String(n).padStart(2, "0")
      const endDate = `${end.getFullYear()}-${pad(
        end.getMonth() + 1
      )}-${pad(end.getDate())}`

      event = {
        summary: form.title.trim(),
        location: form.location.trim() || undefined,
        description: form.notes.trim() || undefined,
        start: { date: form.date },
        end: { date: endDate },
      }
    } else {
      if (!form.startTime || !form.endTime) {
        setError("Please enter both a start and end time.")
        setSaving(false)
        return
      }

      event = {
        summary: form.title.trim(),
        location: form.location.trim() || undefined,
        description: form.notes.trim() || undefined,
        start: {
          dateTime: new Date(
            `${form.date}T${form.startTime}`
          ).toISOString(),
          timeZone: TIMEZONE,
        },
        end: {
          dateTime: new Date(
            `${form.date}T${form.endTime}`
          ).toISOString(),
          timeZone: TIMEZONE,
        },
      }
    }

    const action = editingId ? "update" : "create"

    const { error } = await supabase.functions.invoke(
      "family-calendar",
      {
        body: {
          action,
          eventId: editingId || undefined,
          event,
        },
      }
    )

    if (error) {
      console.error(error)
      setError("Unable to save the event.")
      setSaving(false)
      return
    }

    resetForm()
    await loadEvents()
    setSaving(false)
  }

  async function deleteEvent(eventId) {
    if (!isParent) return

    setError("")

    const { error } = await supabase.functions.invoke(
      "family-calendar",
      {
        body: {
          action: "delete",
          eventId,
        },
      }
    )

    if (error) {
      console.error(error)
      setError("Unable to delete the event.")
      return
    }

    await loadEvents()
  }

  function formatEventDate(event) {
    if (event.start?.date) {
      return new Date(
        `${event.start.date}T12:00:00`
      ).toLocaleDateString([], {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    }

    const start = new Date(event.start?.dateTime)
    const end = new Date(event.end?.dateTime)

    return `${start.toLocaleDateString([], {
      weekday: "long",
      month: "short",
      day: "numeric",
    })} · ${start.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })} – ${end.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`
  }

  return (
    <section className="page calendar-page">
      <div className="section-heading calendar-heading">
        <div>
          <p className="eyebrow">Family</p>
          <h2>Calendar</h2>
          <p className="calendar-subtitle">
            Everything happening with the Burgess family.
          </p>
        </div>

        <div className="calendar-heading-icon">🗓️</div>
      </div>

      {error && (
        <div className="calendar-error">{error}</div>
      )}

      {isParent && (
        <form
          onSubmit={saveEvent}
          className="card calendar-form calendar-form-polished"
        >
          <div className="calendar-form-title">
            <div className="calendar-form-icon">
              {editingId ? "✏️" : "🎉"}
            </div>

            <div>
              <p className="eyebrow">Parent tools</p>
              <h3>
                {editingId
                  ? "Edit family event"
                  : "Add a family event"}
              </h3>
            </div>
          </div>

          <div className="calendar-form-grid">
            <label className="calendar-field full">
              <span className="calendar-label">
                <span>🎈</span>
                Event name
              </span>

              <input
                type="text"
                value={form.title}
                onChange={(e) =>
                  setForm({
                    ...form,
                    title: e.target.value,
                  })
                }
                placeholder="Example: Davina swimming"
              />
            </label>

            <label className="calendar-field">
              <span className="calendar-label">
                <span>📅</span>
                Date
              </span>

              <input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm({
                    ...form,
                    date: e.target.value,
                  })
                }
              />
            </label>

            <label className="calendar-all-day-tile">
              <input
                type="checkbox"
                checked={form.allDay}
                onChange={(e) =>
                  setForm({
                    ...form,
                    allDay: e.target.checked,
                  })
                }
              />

              <span className="calendar-all-day-icon">
                ☀️
              </span>

              <span>
                <strong>All day</strong>
                <small>No start or end time</small>
              </span>
            </label>

            {!form.allDay && (
              <div className="calendar-time-row full">
                <label className="calendar-field">
                  <span className="calendar-label">
                    <span>🕒</span>
                    Starts
                  </span>

                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        startTime: e.target.value,
                      })
                    }
                  />
                </label>

                <label className="calendar-field">
                  <span className="calendar-label">
                    <span>🏁</span>
                    Ends
                  </span>

                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        endTime: e.target.value,
                      })
                    }
                  />
                </label>
              </div>
            )}

            <label className="calendar-field full">
              <span className="calendar-label">
                <span>📍</span>
                Location
              </span>

              <input
                type="text"
                value={form.location}
                onChange={(e) =>
                  setForm({
                    ...form,
                    location: e.target.value,
                  })
                }
                placeholder="School, pool, home, community centre..."
              />
            </label>

            <label className="calendar-field full">
              <span className="calendar-label">
                <span>📝</span>
                Notes
              </span>

              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm({
                    ...form,
                    notes: e.target.value,
                  })
                }
                placeholder="Anything the family should remember?"
                rows={3}
              />
            </label>
          </div>

          <div className="calendar-form-actions">
            <button
              className="action-button calendar-save-button"
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                ? "💾 Save changes"
                : "➕ Add to family calendar"}
            </button>

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
        </form>
      )}

      <div className="calendar-list">
        <div className="calendar-list-heading">
          <div>
            <p className="eyebrow">Coming up</p>
            <h3>Upcoming events</h3>
          </div>

          <button
            className="action-button secondary"
            type="button"
            onClick={loadEvents}
          >
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <div className="calendar-loading-card">
            <span>🗓️</span>
            <p>Checking the family calendar...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="calendar-empty-card">
            <span>🌈</span>
            <strong>No family events yet</strong>
            <p>Add something fun above.</p>
          </div>
        ) : (
          events.map((event) => {
            const badge = getDateBadge(event)

            return (
              <article
                key={event.id}
                className="card calendar-event-card"
              >
                <div className="calendar-event-layout">
                  <div className="calendar-date-badge">
                    <span>{badge.month}</span>
                    <strong>{badge.day}</strong>
                  </div>

                  <div className="calendar-event-copy">
                    <h3>
                      {event.summary || "Untitled event"}
                    </h3>

                    <p className="calendar-event-date">
                      {formatEventDate(event)}
                    </p>

                    {event.location && (
                      <p className="calendar-event-meta">
                        📍 {event.location}
                      </p>
                    )}

                    {event.description && (
                      <p className="calendar-event-meta">
                        📝 {event.description}
                      </p>
                    )}

                    {isParent && (
                      <div className="calendar-event-actions">
                        <button
                          className="action-button secondary"
                          type="button"
                          onClick={() => editEvent(event)}
                        >
                          ✏️ Edit
                        </button>

                        <button
                          className="action-button secondary"
                          type="button"
                          onClick={() =>
                            deleteEvent(event.id)
                          }
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}