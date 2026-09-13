import React, { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

function getLocalDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getWeekStart(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function getDayName(date) {
  return [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ][date.getDay()]
}

function formatDate(date) {
  return date.toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
  })
}

export default function Meals({ householdId, activeUser }) {
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()))
  const [mealValues, setMealValues] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const isParent = activeUser.role === 'Parent'

  const mealDates = [1, 2, 3, 4, 5].map((offset) => {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + offset)
    return date
  })

  const mealSlots = [
    { type: 'Lunch Box', audience: 'Davina', label: '👧 Davina lunch box' },
    { type: 'Lunch Box', audience: 'Ronin', label: '👦 Ronin lunch box' },
    { type: 'Snack Box', audience: 'Davina', label: '👧 Davina snack box' },
    { type: 'Snack Box', audience: 'Ronin', label: '👦 Ronin snack box' },
    { type: 'After School', audience: 'Davina', label: '👧 Davina after-school lunch' },
    { type: 'After School', audience: 'Ronin', label: '👦 Ronin after-school lunch' },
    { type: 'Dinner', audience: 'Kids', label: '🧒 Kids dinner' },
    { type: 'Dinner', audience: 'Parents', label: '👨‍👩 Parents dinner' },
  ]

  function mealKey(date, type, audience) {
    return `${getLocalDateString(date)}|${type}|${audience}`
  }

  useEffect(() => {
    if (!householdId) return

    async function loadMeals() {
      setLoading(true)
      setErrorMessage('')
      setMessage('')

      const { data, error } = await supabase
        .from('meal_entries')
        .select('meal_date, meal_type, audience, meal_text')
        .eq('household_id', householdId)
        .gte('meal_date', getLocalDateString(mealDates[0]))
        .lte('meal_date', getLocalDateString(mealDates[4]))

      if (error) {
        console.error('Could not load meals:', error)
        setErrorMessage('Could not load this week’s meals.')
        setLoading(false)
        return
      }

      const next = {}

      ;(data || []).forEach((row) => {
        next[`${row.meal_date}|${row.meal_type}|${row.audience}`] =
          row.meal_text || ''
      })

      setMealValues(next)
      setLoading(false)
    }

    loadMeals()
  }, [householdId, weekStart])

  function updateMeal(date, type, audience, value) {
    setMealValues((current) => ({
      ...current,
      [mealKey(date, type, audience)]: value,
    }))

    setMessage('')
    setErrorMessage('')
  }

  async function saveWeek() {
    if (!householdId || !isParent) return

    setSaving(true)
    setMessage('')
    setErrorMessage('')

    const rows = []

    mealDates.forEach((date) => {
      mealSlots.forEach((slot) => {
        rows.push({
          household_id: householdId,
          meal_date: getLocalDateString(date),
          meal_type: slot.type,
          audience: slot.audience,
          meal_text:
            mealValues[mealKey(date, slot.type, slot.audience)] || '',
          updated_at: new Date().toISOString(),
        })
      })
    })

    const { error } = await supabase
      .from('meal_entries')
      .upsert(rows, {
        onConflict: 'household_id,meal_date,meal_type,audience',
      })

    setSaving(false)

    if (error) {
      console.error('Could not save meals:', error)
      setErrorMessage('Could not save the meal plan.')
      return
    }

    setMessage('Meal plan saved.')
  }

  async function copyPreviousWeek() {
    if (!householdId || !isParent) return

    const hasCurrentMeals = Object.values(mealValues).some(
      (value) => value && value.trim()
    )

    if (
      hasCurrentMeals &&
      !window.confirm(
        'Replace the current week with meals from the previous week?'
      )
    ) {
      return
    }

    setMessage('')
    setErrorMessage('')

    const previousDates = mealDates.map((date) => {
      const previous = new Date(date)
      previous.setDate(previous.getDate() - 7)
      return previous
    })

    const { data, error } = await supabase
      .from('meal_entries')
      .select('meal_date, meal_type, audience, meal_text')
      .eq('household_id', householdId)
      .gte('meal_date', getLocalDateString(previousDates[0]))
      .lte('meal_date', getLocalDateString(previousDates[4]))

    if (error) {
      console.error('Could not copy previous week:', error)
      setErrorMessage('Could not load the previous week.')
      return
    }

    const previousValues = {}

    ;(data || []).forEach((row) => {
      previousValues[
        `${row.meal_date}|${row.meal_type}|${row.audience}`
      ] = row.meal_text || ''
    })

    const copiedValues = {}

    mealDates.forEach((currentDate, index) => {
      const previousDate = previousDates[index]

      mealSlots.forEach((slot) => {
        const previousKey =
          `${getLocalDateString(previousDate)}|${slot.type}|${slot.audience}`

        copiedValues[
          mealKey(currentDate, slot.type, slot.audience)
        ] = previousValues[previousKey] || ''
      })
    })

    setMealValues(copiedValues)
    setMessage('Previous week copied. Review it, then click Save Week.')
  }
  const visibleSlots = isParent
    ? mealSlots
    : mealSlots.filter(
        (slot) =>
          slot.audience === activeUser.name ||
          (slot.type === 'Dinner' && slot.audience === 'Kids')
      )

  return (
    <section className="page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Meals</p>
          <h2>Weekly Meal Plan</h2>
        </div>

        {isParent && (
          <div className="meal-header-actions">
            <button
              className="action-button secondary"
              type="button"
              onClick={copyPreviousWeek}
              disabled={saving}
            >
              Copy Previous Week
            </button>

            <button
              className="action-button"
              type="button"
              onClick={saveWeek}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Week'}
            </button>
          </div>
        )}
      </div>

      <div className="week-nav">
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            const previous = new Date(weekStart)
            previous.setDate(previous.getDate() - 7)
            setWeekStart(previous)
          }}
        >
          ← Previous Week
        </button>

        <button
          className="action-button secondary"
          type="button"
          onClick={() => setWeekStart(getWeekStart(new Date()))}
        >
          This Week
        </button>

        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            const next = new Date(weekStart)
            next.setDate(next.getDate() + 7)
            setWeekStart(next)
          }}
        >
          Next Week →
        </button>
      </div>

      <div className="card">
        <p className="week-range">
          {formatDate(mealDates[0])} – {formatDate(mealDates[4])}
        </p>
      </div>

      {errorMessage && (
        <p className="form-message error">{errorMessage}</p>
      )}

      {message && (
        <p className="form-message success">{message}</p>
      )}

      {loading ? (
        <div className="card">
          <p>Loading meals…</p>
        </div>
      ) : (
        <div className="meal-week-grid">
          {mealDates.map((date) => (
            <article
              className="card meal-day-card"
              key={getLocalDateString(date)}
            >
              <div className="card-title">
                <span>🍽️</span>
                <h3>{getDayName(date)} · {formatDate(date)}</h3>
              </div>

              <div className="meal-fields">
                {visibleSlots.map((slot) => {
                  const key = mealKey(date, slot.type, slot.audience)
                  const value = mealValues[key] || ''

                  return (
                    <label className="meal-field" key={key}>
                      <span>{slot.label}</span>

                      {isParent ? (
                        <input
                          type="text"
                          value={value}
                          placeholder="Add meal..."
                          onChange={(event) =>
                            updateMeal(
                              date,
                              slot.type,
                              slot.audience,
                              event.target.value
                            )
                          }
                        />
                      ) : (
                        <div className="meal-readonly">
                          {value || 'Not planned yet'}
                        </div>
                      )}
                    </label>
                  )
                })}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}