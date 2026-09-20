import React, { useEffect, useState } from "react"
import { supabase } from "./lib/supabase"

export default function CalendarPreview() {
  const [events, setEvents] = useState([])

  useEffect(() => {
    let cancelled = false

    async function loadEvents() {
      const start = new Date()
      start.setHours(0, 0, 0, 0)

      const end = new Date()
      end.setMonth(end.getMonth() + 1)

      const { data, error } = await supabase.functions.invoke("family-calendar", {
        body: {
          action: "list",
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
        },
      })

      if (!cancelled && !error) {
        setEvents((data?.items ?? []).slice(0, 3))
      }
    }

    loadEvents()

    return () => {
      cancelled = true
    }
  }, [])

  if (events.length === 0) {
    return <p>No upcoming family events.</p>
  }

  return (
    <div>
      {events.map((event) => {
        const date = event.start?.date
          ? new Date(`${event.start.date}T12:00:00`)
          : new Date(event.start?.dateTime)

        return (
          <p key={event.id}>
            <strong>{event.summary || "Family event"}</strong>
            <br />
            {date.toLocaleDateString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </p>
        )
      })}
    </div>
  )
}
