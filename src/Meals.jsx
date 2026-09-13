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
  const [copyFromDay, setCopyFromDay] = useState(0)
  const [copyToDay, setCopyToDay] = useState(1)
  const [favorites, setFavorites] = useState([])
  const [newFavorite, setNewFavorite] = useState('')
  const [favoriteError, setFavoriteError] = useState('')
  const [savingFavorite, setSavingFavorite] = useState(false)

  const currentDay = new Date().getDay()
  const defaultWeekdayIndex =
    currentDay >= 1 && currentDay <= 5 ? currentDay - 1 : 0

  const [selectedDayIndex, setSelectedDayIndex] =
    useState(defaultWeekdayIndex)

  const [mealView, setMealView] = useState('day')

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

  async function loadFavorites() {
    if (!householdId) return

    const { data, error } = await supabase
      .from('meal_favorites')
      .select('id, name')
      .eq('household_id', householdId)
      .order('name', { ascending: true })

    if (error) {
      console.error('Could not load meal favourites:', error)
      setFavoriteError('Could not load meal favourites.')
      return
    }

    setFavorites(data || [])
    setFavoriteError('')
  }

  useEffect(() => {
    loadFavorites()
  }, [householdId])

  async function addFavorite(event) {
    event.preventDefault()

    if (!householdId || !isParent) return

    const name = newFavorite.trim()

    if (!name) {
      setFavoriteError('Enter a meal name.')
      return
    }

    setSavingFavorite(true)
    setFavoriteError('')

    const { error } = await supabase
      .from('meal_favorites')
      .insert({
        household_id: householdId,
        name,
      })

    setSavingFavorite(false)

    if (error) {
      if (error.code === '23505') {
        setFavoriteError('That meal is already in your favourites.')
      } else {
        console.error('Could not save meal favourite:', error)
        setFavoriteError('Could not save this favourite.')
      }

      return
    }

    setNewFavorite('')
    await loadFavorites()
  }

  async function removeFavorite(favorite) {
    if (!householdId || !isParent) return

    if (!window.confirm(`Remove "${favorite.name}" from favourites?`)) {
      return
    }

    const { error } = await supabase
      .from('meal_favorites')
      .delete()
      .eq('id', favorite.id)
      .eq('household_id', householdId)

    if (error) {
      console.error('Could not remove meal favourite:', error)
      setFavoriteError('Could not remove this favourite.')
      return
    }

    await loadFavorites()
  }

  function useFavorite(date, type, audience, value) {
    if (!value) return
    updateMeal(date, type, audience, value)
  }
  function copyDay() {
    if (!isParent) return

    if (copyFromDay === copyToDay) {
      setErrorMessage('Choose two different days.')
      setMessage('')
      return
    }

    const sourceDate = mealDates[copyFromDay]
    const targetDate = mealDates[copyToDay]

    const targetHasMeals = mealSlots.some((slot) => {
      const value =
        mealValues[mealKey(targetDate, slot.type, slot.audience)] || ''

      return value.trim()
    })

    if (
      targetHasMeals &&
      !window.confirm(
        `Replace ${getDayName(targetDate)} with ${getDayName(sourceDate)}'s meals?`
      )
    ) {
      return
    }

    setMealValues((current) => {
      const updated = { ...current }

      mealSlots.forEach((slot) => {
        const sourceKey = mealKey(
          sourceDate,
          slot.type,
          slot.audience
        )

        const targetKey = mealKey(
          targetDate,
          slot.type,
          slot.audience
        )

        updated[targetKey] = current[sourceKey] || ''
      })

      return updated
    })

    setErrorMessage('')
    setMessage(
      `${getDayName(sourceDate)} copied to ${getDayName(targetDate)}. Review it, then click Save Week.`
    )
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

      <div className="meal-day-tabs">
        {mealDates.map((date, index) => (
          <button
            key={getLocalDateString(date)}
            type="button"
            className={
              mealView === 'day' && selectedDayIndex === index
                ? 'meal-day-tab active'
                : 'meal-day-tab'
            }
            onClick={() => {
              setSelectedDayIndex(index)
              setMealView('day')
            }}
          >
            <span>{getDayName(date).slice(0, 3)}</span>
            <strong>{date.getDate()}</strong>
          </button>
        ))}

        <button
          type="button"
          className={
            mealView === 'all'
              ? 'meal-day-tab all-week active'
              : 'meal-day-tab all-week'
          }
          onClick={() => setMealView('all')}
        >
          <span>All</span>
          <strong>Week</strong>
        </button>
      </div>

      {isParent && (
        <div className="card meal-favorites-card">
          <div className="meal-favorites-header">
            <div>
              <p className="eyebrow">Quick meals</p>
              <h3>Meal Favourites</h3>
            </div>
          </div>

          <form className="favorite-add-form" onSubmit={addFavorite}>
            <input
              type="text"
              value={newFavorite}
              placeholder="Example: Cheese sandwich"
              onChange={(event) => {
                setNewFavorite(event.target.value)
                setFavoriteError('')
              }}
            />

            <button
              className="action-button"
              type="submit"
              disabled={savingFavorite}
            >
              {savingFavorite ? 'Adding…' : 'Add Favourite'}
            </button>
          </form>

          {favoriteError && (
            <p className="form-message error">{favoriteError}</p>
          )}

          {favorites.length === 0 ? (
            <p className="favorite-empty">
              No favourites yet. Add meals you use often.
            </p>
          ) : (
            <div className="favorite-chips">
              {favorites.map((favorite) => (
                <div className="favorite-chip" key={favorite.id}>
                  <span>{favorite.name}</span>

                  <button
                    type="button"
                    aria-label={`Remove ${favorite.name}`}
                    title="Remove favourite"
                    onClick={() => removeFavorite(favorite)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isParent && (
        <div className="card copy-day-card">
          <div className="copy-day-controls">
            <strong>Copy a day</strong>

            <label>
              From
              <select
                value={copyFromDay}
                onChange={(event) =>
                  setCopyFromDay(Number(event.target.value))
                }
              >
                {mealDates.map((date, index) => (
                  <option value={index} key={`from-${getLocalDateString(date)}`}>
                    {getDayName(date)}
                  </option>
                ))}
              </select>
            </label>

            <span className="copy-day-arrow">→</span>

            <label>
              To
              <select
                value={copyToDay}
                onChange={(event) =>
                  setCopyToDay(Number(event.target.value))
                }
              >
                {mealDates.map((date, index) => (
                  <option value={index} key={`to-${getLocalDateString(date)}`}>
                    {getDayName(date)}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="action-button secondary"
              type="button"
              onClick={copyDay}
            >
              Copy Day
            </button>
          </div>
        </div>
      )}

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
      ) : mealView === 'day' ? (
        <article className="card meal-day-card">
          <div className="card-title">
            <span>🍽️</span>
            <h3>
              {getDayName(mealDates[selectedDayIndex])} ·{' '}
              {formatDate(mealDates[selectedDayIndex])}
            </h3>
          </div>

          <div className="meal-fields">
            {visibleSlots.map((slot) => {
              const date = mealDates[selectedDayIndex]
              const key = mealKey(date, slot.type, slot.audience)
              const value = mealValues[key] || ''

              return (
                <label className="meal-field" key={key}>
                  <span>{slot.label}</span>

                  {isParent ? (
                    <div className="meal-input-stack">
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

                      {favorites.length > 0 && (
                        <select
                          className="favorite-select"
                          value=""
                          onChange={(event) =>
                            useFavorite(
                              date,
                              slot.type,
                              slot.audience,
                              event.target.value
                            )
                          }
                        >
                          <option value="">Use favourite…</option>

                          {favorites.map((favorite) => (
                            <option
                              value={favorite.name}
                              key={favorite.id}
                            >
                              {favorite.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
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
      ) : (
        <div className="meal-overview-scroll">
          <div className="meal-overview-grid">
            {mealDates.map((date) => (
              <article
                className="meal-overview-day"
                key={getLocalDateString(date)}
              >
                <div className="meal-overview-heading">
                  <strong>{getDayName(date)}</strong>
                  <span>{formatDate(date)}</span>
                </div>

                <div className="meal-overview-fields">
                  {visibleSlots.map((slot) => {
                    const key = mealKey(
                      date,
                      slot.type,
                      slot.audience
                    )

                    const value = mealValues[key] || ''

                    return (
                      <label
                        className="meal-overview-field"
                        key={key}
                      >
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
        </div>
      )}
    </section>
  )
}