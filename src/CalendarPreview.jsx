import React, { useEffect, useState } from "react"
import { supabase } from "./lib/supabase"

const CACHE_KEY = "burgess-family-calendar-preview-v1"

function getEventDate(event) {
  if (event.start?.date) {
    return new Date(`${event.start.date}T12:00:00`)
  }

  return new Date(event.start?.dateTime)
}

function readCachedEvents() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(CACHE_KEY) || "null"
    )

    if (!Array.isArray(saved?.events)) {
      return []
    }

    const now = new Date()

    return saved.events
      .filter((event) => getEventDate(event) >= now)
      .slice(0, 3)
  } catch {
    return []
  }
}

export default function CalendarPreview() {
  const [events, setEvents] = useState(readCachedEvents)
  const [loading, setLoading] = useState(
    () => readCachedEvents().length === 0
  )

  useEffect(() => {
    let cancelled = false

    async function loadEvents() {
      const start = new Date()
      start.setHours(0, 0, 0, 0)

      const end = new Date()
      end.setMonth(end.getMonth() + 1)

      const { data, error } =
        await supabase.functions.invoke(
          "family-calendar",
          {
            body: {
              action: "list",
              timeMin: start.toISOString(),
              timeMax: end.toISOString(),
            },
          }
        )

      if (cancelled) return

      if (!error) {
        const nextEvents = (data?.items ?? []).slice(0, 3)

        setEvents(nextEvents)

        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              events: nextEvents,
              savedAt: Date.now(),
            })
          )
        } catch {
          // Cache is optional.
        }
      }

      setLoading(false)
    }

    loadEvents()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading && events.length === 0) {
    return (
      <div className="calendar-preview-loading">
        <span>🗓️</span>
        <span>Loading family plans...</span>
      </div>
    )
  }

  if (events.length === 0) {
    return <p>No upcoming family events.</p>
  }

  return (
    <div className="calendar-preview-events">
      {events.map((event) => {
        const date = getEventDate(event)

        return (
          <div
            className="calendar-preview-event"
            key={event.id}
          >
            <span className="calendar-preview-dot" />

            <div>
              <strong>
                {event.summary || "Family event"}
              </strong>

              <small>
                {date.toLocaleDateString([], {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </small>
            </div>
          </div>
        )
      })}
    </div>
  )
}