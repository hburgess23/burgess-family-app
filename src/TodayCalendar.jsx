import React, { useEffect, useMemo, useState } from "react"
import { supabase } from "./lib/supabase"

const CACHE_KEY = "burgess-family-today-calendar-v1"

const DEFAULT_DAY_START_MINUTES = 14 * 60
const DAY_END_MINUTES = 20 * 60
const SLOT_MINUTES = 30
const SLOT_HEIGHT = 34

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfWeek(date) {
  const d = startOfDay(date)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addDays(date, amount) {
  const d = new Date(date)
  d.setDate(d.getDate() + amount)
  return d
}

function eventStart(event) {
  if (event.start?.date) {
    return new Date(`${event.start.date}T12:00:00`)
  }

  return new Date(event.start?.dateTime)
}

function eventEnd(event) {
  if (event.end?.date) {
    return new Date(`${event.end.date}T12:00:00`)
  }

  return event.end?.dateTime
    ? new Date(event.end.dateTime)
    : null
}

function eventKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")

  return `${y}-${m}-${d}`
}

function sameDay(a, b) {
  return eventKey(a) === eventKey(b)
}

function formatEventTime(event) {
  if (event.start?.date) {
    return "All day"
  }

  return eventStart(event).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })
}

function getEventCategory(event) {
  const text = [
    event.summary,
    event.location,
    event.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  const medicalKeywords = [
    "doctor",
    "dr.",
    "dentist",
    "dental",
    "clinic",
    "hospital",
    "medical",
    "pediatrician",
    "paediatrician",
    "physio",
    "physiotherapy",
    "specialist",
    "optometrist",
    "eye doctor",
    "appointment",
  ]

  if (medicalKeywords.some((word) => text.includes(word))) {
    return "medical"
  }

  const hasDavina = text.includes("davina")
  const hasRonin = text.includes("ronin")

  if (
    (hasDavina && hasRonin) ||
    text.includes("both kids") ||
    text.includes("both children")
  ) {
    return "both"
  }

  if (hasDavina) return "davina"
  if (hasRonin) return "ronin"

  return "family"
}

function getChoreCategory(chore) {
  const assigned = chore.assignedTo || []

  if (
    assigned.includes("Davina") &&
    assigned.includes("Ronin")
  ) {
    return "both"
  }

  if (assigned.includes("Davina")) {
    return "davina"
  }

  if (assigned.includes("Ronin")) {
    return "ronin"
  }

  return "family"
}

function getChoreMinutes(chore) {
  if (!chore.scheduledTime) return null

  const [hours, minutes] = chore.scheduledTime
    .split(":")
    .map(Number)

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return null
  }

  return hours * 60 + minutes
}

function isChoreDueOnDate(chore, date) {
  if (chore.active === false) return false

  return (chore.days || []).includes(
    DAY_NAMES[date.getDay()]
  )
}

function isChoreCompleted(chore, date, completions) {
  const assigned = chore.assignedTo || []

  if (assigned.length === 0) return false

  const dateCompletions =
    completions?.[eventKey(date)] || {}

  return assigned.every(
    (child) =>
      Boolean(
        dateCompletions[`${chore.id}-${child}`]
      )
  )
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes()
}

function formatMinutes(minutes) {
  const hour24 = Math.floor(minutes / 60)
  const minute = minutes % 60

  const date = new Date()
  date.setHours(hour24, minute, 0, 0)

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })
}

function loadCachedEvents() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(CACHE_KEY) || "null"
    )

    return Array.isArray(saved?.events)
      ? saved.events
      : []
  } catch {
    return []
  }
}

export default function TodayCalendar({
  setActive,
  chores = [],
  completions = {},
}) {
  const [view, setView] = useState("week")
  const [cursorDate, setCursorDate] = useState(
    () => new Date()
  )
  const [events, setEvents] =
    useState(loadCachedEvents)
  const [refreshing, setRefreshing] =
    useState(false)

  const visibleDays = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(cursorDate)

      return Array.from(
        { length: 7 },
        (_, index) => addDays(start, index)
      )
    }

    const monthStart = startOfMonth(cursorDate)
    const gridStart = startOfWeek(monthStart)

    return Array.from(
      { length: 42 },
      (_, index) => addDays(gridStart, index)
    )
  }, [cursorDate, view])

  const fetchRange = useMemo(() => {
    const first = visibleDays[0]
    const last =
      visibleDays[visibleDays.length - 1]

    return {
      timeMin: startOfDay(first).toISOString(),
      timeMax: addDays(
        startOfDay(last),
        1
      ).toISOString(),
    }
  }, [visibleDays])

  useEffect(() => {
    let cancelled = false

    async function refreshEvents() {
      setRefreshing(true)

      const { data, error } =
        await supabase.functions.invoke(
          "family-calendar",
          {
            body: {
              action: "list",
              timeMin: fetchRange.timeMin,
              timeMax: fetchRange.timeMax,
            },
          }
        )

      if (cancelled) return

      if (!error) {
        const nextEvents =
          data?.items ?? []

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

      setRefreshing(false)
    }

    refreshEvents()

    return () => {
      cancelled = true
    }
  }, [
    fetchRange.timeMin,
    fetchRange.timeMax,
  ])

  const eventsByDay = useMemo(() => {
    const map = new Map()

    events.forEach((event) => {
      const key = eventKey(
        eventStart(event)
      )

      const list = map.get(key) ?? []
      list.push(event)
      map.set(key, list)
    })

    return map
  }, [events])

  const visibleStartMinutes = useMemo(() => {
    const visibleDayKeys = new Set(
      visibleDays.map((day) =>
        eventKey(day)
      )
    )

    let earliest =
      DEFAULT_DAY_START_MINUTES

    events.forEach((event) => {
      if (!event.start?.dateTime) return

      const start = eventStart(event)

      if (
        !visibleDayKeys.has(
          eventKey(start)
        )
      ) {
        return
      }

      const minutes =
        minutesSinceMidnight(start)

      if (minutes < earliest) {
        earliest =
          Math.floor(
            minutes / SLOT_MINUTES
          ) * SLOT_MINUTES
      }
    })

    visibleDays.forEach((day) => {
      chores.forEach((chore) => {
        if (
          !isChoreDueOnDate(
            chore,
            day
          )
        ) {
          return
        }

        const minutes =
          getChoreMinutes(chore)

        if (
          minutes !== null &&
          minutes < earliest
        ) {
          earliest =
            Math.floor(
              minutes / SLOT_MINUTES
            ) * SLOT_MINUTES
        }
      })
    })

    return earliest
  }, [events, visibleDays, chores])

  const timeSlots = useMemo(() => {
    const slots = []

    for (
      let minutes = visibleStartMinutes;
      minutes < DAY_END_MINUTES;
      minutes += SLOT_MINUTES
    ) {
      slots.push(minutes)
    }

    return slots
  }, [visibleStartMinutes])

  function goPrevious() {
    setCursorDate((current) => {
      const next = new Date(current)

      if (view === "week") {
        next.setDate(
          next.getDate() - 7
        )
      } else {
        next.setMonth(
          next.getMonth() - 1
        )
      }

      return next
    })
  }

  function goNext() {
    setCursorDate((current) => {
      const next = new Date(current)

      if (view === "week") {
        next.setDate(
          next.getDate() + 7
        )
      } else {
        next.setMonth(
          next.getMonth() + 1
        )
      }

      return next
    })
  }

  const heading =
    view === "week"
      ? `${visibleDays[0].toLocaleDateString([], {
          month: "short",
          day: "numeric",
        })} – ${visibleDays[6].toLocaleDateString([], {
          month: "short",
          day: "numeric",
        })}`
      : cursorDate.toLocaleDateString([], {
          month: "long",
          year: "numeric",
        })

  return (
    <section className="today-calendar card">
<div className="today-calendar-header">
        <div>
          <p className="eyebrow">
            Family Calendar
          </p>

          <h2>{heading}</h2>
        </div>

        <div className="today-calendar-controls">
          <div className="today-calendar-toggle">
            <button
              type="button"
              className={
                view === "week"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setView("week")
              }
            >
              Week
            </button>

            <button
              type="button"
              className={
                view === "month"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setView("month")
              }
            >
              Month
            </button>
          </div>

          <button
            type="button"
            className="action-button secondary"
            onClick={() =>
              setCursorDate(new Date())
            }
          >
            Today
          </button>
        </div>
      </div>

      <div className="today-calendar-nav">
        <button
          type="button"
          className="action-button secondary"
          onClick={goPrevious}
        >
          ←
        </button>

        <span>
          {refreshing
            ? "Updating…"
            : "Live with Google Calendar"}
        </span>

        <button
          type="button"
          className="action-button secondary"
          onClick={goNext}
        >
          →
        </button>
      </div>

      {view === "week" ? (
        <div className="today-week-scroll">
          <div className="today-week-calendar">
            <div className="today-week-header">
              <div className="today-week-time-spacer" />

              {visibleDays.map((day) => (
                <div
                  key={eventKey(day)}
                  className={[
                    "today-week-day-header",
                    sameDay(
                      day,
                      new Date()
                    )
                      ? "today"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span>
                    {day.toLocaleDateString([], {
                      weekday: "short",
                    })}
                  </span>

                  <strong>
                    {day.getDate()}
                  </strong>
                </div>
              ))}
            </div>

            <div className="today-week-all-day chore-all-day-row">
              <div className="today-week-all-day-label">
                Chores
              </div>

              {visibleDays.map((day) => {
                const allDayChores =
                  chores.filter(
                    (chore) =>
                      chore.allDay === true &&
                      isChoreDueOnDate(
                        chore,
                        day
                      )
                  )

                return (
                  <div
                    key={`chores-${eventKey(day)}`}
                    className="today-week-all-day-cell chore-all-day-cell"
                  >
                    {allDayChores.map(
                      (chore) => {
                        const completed =
                          isChoreCompleted(
                            chore,
                            day,
                            completions
                          )

                        return (
                          <button
                            type="button"
                            key={`all-day-chore-${chore.id}`}
                            className={`today-week-all-day-event event-${getChoreCategory(
                              chore
                            )} ${
                              completed
                                ? "calendar-chore-completed"
                                : ""
                            }`}
                            onClick={() =>
                              setActive(
                                "Chores"
                              )
                            }
                          >
                            {completed
                              ? "✓ "
                              : "🧹 "}
                            {chore.title}
                          </button>
                        )
                      }
                    )}
                  </div>
                )
              })}
            </div>

            <div className="today-week-all-day calendar-all-day-row">
              <div className="today-week-all-day-label">
                All day
              </div>

              {visibleDays.map((day) => {
                const dayEvents =
                  eventsByDay.get(
                    eventKey(day)
                  ) ?? []

                const allDayEvents =
                  dayEvents.filter(
                    (event) =>
                      Boolean(
                        event.start?.date
                      )
                  )

                return (
                  <div
                    key={`events-${eventKey(day)}`}
                    className="today-week-all-day-cell"
                  >
                    {allDayEvents.map(
                      (event) => (
                        <button
                          type="button"
                          className={`today-week-all-day-event event-${getEventCategory(
                            event
                          )}`}
                          key={event.id}
                          onClick={() =>
                            setActive(
                              "Calendar"
                            )
                          }
                        >
                          {event.summary ||
                            "Family event"}
                        </button>
                      )
                    )}
                  </div>
                )
              })}
            </div>

            <div className="today-week-body">
              <div className="today-week-times">
                {timeSlots.map(
                  (minutes) => (
                    <div
                      className="today-week-time"
                      key={minutes}
                      style={{
                        height: `${SLOT_HEIGHT}px`,
                      }}
                    >
                      {formatMinutes(
                        minutes
                      )}
                    </div>
                  )
                )}
              </div>

              {visibleDays.map((day) => {
                const dayEvents =
                  eventsByDay.get(
                    eventKey(day)
                  ) ?? []

                const timedEvents =
                  dayEvents.filter(
                    (event) =>
                      !event.start?.date &&
                      event.start
                        ?.dateTime
                  )

                const dayChores =
                  chores.filter(
                    (chore) =>
                      chore.allDay !== true &&
                      isChoreDueOnDate(
                        chore,
                        day
                      )
                  )

                return (
                  <div
                    key={eventKey(day)}
                    className={[
                      "today-week-day-column",
                      sameDay(
                        day,
                        new Date()
                      )
                        ? "today"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {timeSlots.map(
                      (minutes) => (
                        <div
                          className="today-week-slot"
                          key={minutes}
                          style={{
                            height: `${SLOT_HEIGHT}px`,
                          }}
                        />
                      )
                    )}

                    {timedEvents.map(
                      (event) => {
                        const start =
                          eventStart(event)

                        const end =
                          eventEnd(event) ??
                          new Date(
                            start.getTime() +
                              SLOT_MINUTES *
                                60000
                          )

                        const startMinutes =
                          minutesSinceMidnight(
                            start
                          )

                        const endMinutes =
                          minutesSinceMidnight(
                            end
                          )

                        if (
                          endMinutes <=
                            visibleStartMinutes ||
                          startMinutes >=
                            DAY_END_MINUTES
                        ) {
                          return null
                        }

                        const clippedStart =
                          Math.max(
                            startMinutes,
                            visibleStartMinutes
                          )

                        const clippedEnd =
                          Math.min(
                            endMinutes,
                            DAY_END_MINUTES
                          )

                        const top =
                          ((clippedStart -
                            visibleStartMinutes) /
                            SLOT_MINUTES) *
                          SLOT_HEIGHT

                        const height =
                          Math.max(
                            ((clippedEnd -
                              clippedStart) /
                              SLOT_MINUTES) *
                              SLOT_HEIGHT,
                            28
                          )

                        return (
                          <button
                            type="button"
                            key={event.id}
                            className={`today-week-event-block event-${getEventCategory(
                              event
                            )}`}
                            style={{
                              top: `${top}px`,
                              height: `${height}px`,
                            }}
                            onClick={() =>
                              setActive(
                                "Calendar"
                              )
                            }
                          >
                            <small>
                              {formatEventTime(
                                event
                              )}
                            </small>

                            <strong>
                              {event.summary ||
                                "Family event"}
                            </strong>
                          </button>
                        )
                      }
                    )}

                    {dayChores.map(
                      (chore) => {
                        const minutes =
                          getChoreMinutes(
                            chore
                          )

                        if (
                          minutes === null ||
                          minutes <
                            visibleStartMinutes ||
                          minutes >=
                            DAY_END_MINUTES
                        ) {
                          return null
                        }

                        const top =
                          ((minutes -
                            visibleStartMinutes) /
                            SLOT_MINUTES) *
                          SLOT_HEIGHT

                        const completed =
                          isChoreCompleted(
                            chore,
                            day,
                            completions
                          )

                        return (
                          <button
                            type="button"
                            key={`chore-${chore.id}`}
                            className={`today-week-chore-block event-${getChoreCategory(
                              chore
                            )} ${
                              completed
                                ? "calendar-chore-completed"
                                : ""
                            }`}
                            style={{
                              top: `${top}px`,
                              height: `${SLOT_HEIGHT - 4}px`,
                            }}
                            onClick={() =>
                              setActive(
                                "Chores"
                              )
                            }
                          >
                            <small>
                              {formatMinutes(
                                minutes
                              )}
                            </small>

                            <strong>
                              {completed
                                ? "✓ "
                                : "🧹 "}
                              {chore.title}
                            </strong>
                          </button>
                        )
                      }
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="today-calendar-grid month">
          {visibleDays.map((day) => {
            const key =
              eventKey(day)

            const dayEvents =
              eventsByDay.get(key) ?? []

            const dayChores =
              chores.filter(
                (chore) =>
                  isChoreDueOnDate(
                    chore,
                    day
                  )
              )

            const monthItems = [
              ...dayEvents.map(
                (event) => ({
                  type: "event",
                  id: event.id,
                  time:
                    event.start?.date
                      ? 0
                      : minutesSinceMidnight(
                          eventStart(
                            event
                          )
                        ),
                  title:
                    event.summary ||
                    "Family event",
                  label:
                    formatEventTime(
                      event
                    ),
                  category:
                    getEventCategory(
                      event
                    ),
                  completed: false,
                })
              ),

              ...dayChores.map(
                (chore) => ({
                  type: "chore",
                  id: `chore-${chore.id}`,
                  time:
                    chore.allDay
                      ? 0
                      : getChoreMinutes(
                          chore
                        ) ?? 0,
                  title: chore.title,
                  label:
                    chore.allDay
                      ? "All day"
                      : getChoreMinutes(
                          chore
                        ) === null
                        ? ""
                        : formatMinutes(
                            getChoreMinutes(
                              chore
                            )
                          ),
                  category:
                    getChoreCategory(
                      chore
                    ),
                  completed:
                    isChoreCompleted(
                      chore,
                      day,
                      completions
                    ),
                })
              ),
            ].sort(
              (a, b) =>
                a.time - b.time
            )

            const isToday =
              sameDay(
                day,
                new Date()
              )

            const outsideMonth =
              day.getMonth() !==
              cursorDate.getMonth()

            return (
              <button
                type="button"
                className={[
                  "today-calendar-day",
                  isToday
                    ? "today"
                    : "",
                  outsideMonth
                    ? "outside-month"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={key}
                onClick={() =>
                  setActive(
                    "Calendar"
                  )
                }
              >
                <div className="today-calendar-day-heading">
                  <span>
                    {day.toLocaleDateString([], {
                      weekday:
                        "short",
                    })}
                  </span>

                  <strong>
                    {day.getDate()}
                  </strong>
                </div>

                <div className="today-calendar-day-events">
                  {monthItems.length ===
                  0 ? (
                    <span className="today-calendar-empty">
                      —
                    </span>
                  ) : (
                    monthItems
                      .slice(0, 3)
                      .map((item) => (
                        <span
                          className={`today-calendar-event event-${item.category} ${
                            item.completed
                              ? "calendar-chore-completed"
                              : ""
                          }`}
                          key={item.id}
                        >
                          <small>
                            {item.label}
                          </small>

                          <strong>
                            {item.type ===
                            "chore"
                              ? "🧹 "
                              : ""}
                            {item.title}
                          </strong>
                        </span>
                      ))
                  )}

                  {monthItems.length >
                    3 && (
                    <span className="today-calendar-more">
                      +
                      {monthItems.length -
                        3}{" "}
                      more
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      <button
        type="button"
        className="today-calendar-open"
        onClick={() =>
          setActive("Calendar")
        }
      >
        Open full calendar →
      </button>
    </section>
  )
}