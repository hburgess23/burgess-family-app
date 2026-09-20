import React, { useEffect, useMemo, useState } from "react"
import { supabase } from "./lib/supabase"

const TIMEZONE = "America/Vancouver"

function toLocalInputValue(dateTime) {
  if (!dateTime) return ""
  const d = new Date(dateTime)
  const pad = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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
    start.setDate(start.getDate() - 30)

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

    const { data, error } = await supabase.functions.invoke("family-calendar", {
      body: {
        action: "list",
        timeMin: range.timeMin,
        timeMax: range.timeMax,
      },
    })

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
      const endDate = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`

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
          dateTime: new Date(`${form.date}T${form.startTime}`).toISOString(),
          timeZone: TIMEZONE,
        },
        end: {
          dateTime: new Date(`${form.date}T${form.endTime}`).toISOString(),
          timeZone: TIMEZONE,
        },
      }
    }

    const action = editingId ? "update" : "create"

    const { error } = await supabase.functions.invoke("family-calendar", {
      body: {
        action,
        eventId: editingId || undefined,
        event,
      },
    })

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
    if (!window.confirm("Delete this family event?")) return

    setError("")

    const { error } = await supabase.functions.invoke("family-calendar", {
      body: {
        action: "delete",
        eventId,
      },
    })

    if (error) {
      console.error(error)
      setError("Unable to delete the event.")
      return
    }

    await loadEvents()
  }

  function formatEventDate(event) {
    if (event.start?.date) {
      return new Date(`${event.start.date}T12:00:00`).toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    }

    const start = new Date(event.start?.dateTime)
    const end = new Date(event.end?.dateTime)

    return `${start.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    })} · ${start.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}–${end.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`
  }

  return (
    <section className="page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Family</p>
          <h2>Calendar</h2>
          <p>Synced with the Burgess Family Google Calendar.</p>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
          {error}
        </div>
      )}

      {isParent && (
        <form
          onSubmit={saveEvent}
          style={{
            display: "grid",
            gap: 12,
            padding: 16,
            marginBottom: 24,
            border: "1px solid #e5e5e5",
            borderRadius: 16,
            background: "white",
          }}
        >
          <h3 style={{ margin: 0 }}>
            {editingId ? "Edit family event" : "Add family event"}
          </h3>

          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Event name"
          />

          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />

          <label>
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => setForm({ ...form, allDay: e.target.checked })}
            />{" "}
            All day
          </label>

          {!form.allDay && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              />

              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              />
            </div>
          )}

          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="Location (optional)"
          />

          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notes (optional)"
            rows={3}
          />

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save changes" : "Add event"}
            </button>

            {editingId && (
              <button type="button" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Upcoming events</h3>
          <button type="button" onClick={loadEvents}>
            Refresh
          </button>
        </div>

        {loading ? (
          <p>Loading calendar...</p>
        ) : events.length === 0 ? (
          <p>No family events found.</p>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              style={{
                padding: 14,
                border: "1px solid #e5e5e5",
                borderRadius: 14,
                background: "white",
              }}
            >
              <strong>{event.summary || "Untitled event"}</strong>
              <div style={{ marginTop: 4 }}>{formatEventDate(event)}</div>

              {event.location && (
                <div style={{ marginTop: 4 }}>Location: {event.location}</div>
              )}

              {event.description && (
                <div style={{ marginTop: 4 }}>{event.description}</div>
              )}

              {isParent && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button type="button" onClick={() => editEvent(event)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => deleteEvent(event.id)}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
