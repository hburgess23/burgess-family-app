import React, { useState } from 'react'

const family = [
  { name: 'Harold', role: 'Parent', emoji: '👨🏽' },
  { name: 'Divya', role: 'Parent', emoji: '👩🏽' },
  { name: 'Davina', role: 'Child', emoji: '👧🏽' },
  { name: 'Ronin', role: 'Child', emoji: '👦🏽' },
]

const sections = [
  { label: 'Today', icon: '☀️' },
  { label: 'Calendar', icon: '📅' },
  { label: 'Chores', icon: '✅' },
  { label: 'Meals', icon: '🍽️' },
  { label: 'More', icon: '•••' },
]

const startingChores = [
  {
    id: 1,
    title: 'Make bed',
    assignedTo: ['Davina'],
    points: 5,
    allowance: 0,
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  },
  {
    id: 2,
    title: 'Empty dishwasher',
    assignedTo: ['Ronin'],
    points: 5,
    allowance: 0,
    days: ['Monday', 'Wednesday', 'Friday'],
  },
  {
    id: 3,
    title: 'Put toys away',
    assignedTo: ['Davina', 'Ronin'],
    points: 5,
    allowance: 0.5,
    days: ['Tuesday', 'Thursday'],
  },
]

// Utility to get local date string (YYYY-MM-DD)
function getLocalDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Parse local date string
function parseLocalDateString(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// Get day name from date
function getDayName(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[date.getDay()]
}

// Get week start (Sunday)
function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day
  return new Date(d.setDate(diff))
}

// Get week dates (Sunday - Saturday)
function getWeekDates(weekStart) {
  const dates = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    dates.push(d)
  }
  return dates
}

// Format date for display
function formatDate(date) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${monthNames[date.getMonth()]} ${date.getDate()}`
}

// Format date range for display
function formatWeekRange(weekStart) {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const start = formatDate(weekStart)
  const end = formatDate(weekEnd)
  return `${start} – ${end}`
}
function App() {
  const [active, setActive] = useState('Today')
  const [activeUser, setActiveUser] = useState(family[0])
    const [chores] = useState(startingChores)
  const [celebration, setCelebration] = useState(false)
  const [points, setPoints] = useState({
    Davina: 35,
    Ronin: 28,
  })

    const [allowance, setAllowance] = useState({
  Davina: 0,
  Ronin: 0,
})
    // completions: { 'YYYY-MM-DD': { 'chore_id-child': { date, choreId, child, title, points, allowance, completedAt } } }
    const [completions, setCompletions] = useState({})

    function completeChore(choreId, selectedDate, child) {
      const dateStr = getLocalDateString(selectedDate)
      const chore = chores.find((item) => item.id === choreId)

      if (!chore) return
      if (completions[dateStr] && completions[dateStr][`${choreId}-${child}`]) return

      const completionId = crypto.randomUUID()
      const completedAt = new Date().toISOString()

      setCompletions((current) => ({
        ...current,
        [dateStr]: {
          ...current[dateStr],
          [`${choreId}-${child}`]: {
            id: `${completionId}-${child}`,
            completionId,
            date: dateStr,
            choreId,
            child,
            title: chore.title,
            points: chore.points,
            allowance: chore.allowance,
            completedAt,
          },
        },
      }))

      setPoints((current) => ({
        ...current,
        [child]: current[child] + chore.points,
      }))

      setAllowance((current) => ({
        ...current,
        [child]: current[child] + chore.allowance,
      }))

      // Sound celebration
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(660, audioContext.currentTime)

      gainNode.gain.setValueAtTime(0.12, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.35)

      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.35)

      setCelebration(true)
      setTimeout(() => {
        setCelebration(false)
      }, 1500)
    }

    function undoChore(choreId, selectedDate, child) {
      const dateStr = getLocalDateString(selectedDate)
      const chore = chores.find((item) => item.id === choreId)

      if (!chore) return
      if (!completions[dateStr] || !completions[dateStr][`${choreId}-${child}`]) return

      setCompletions((current) => {
        const updated = { ...current }
        const dateCompletions = { ...updated[dateStr] }
        delete dateCompletions[`${choreId}-${child}`]
        if (Object.keys(dateCompletions).length === 0) {
          delete updated[dateStr]
        } else {
          updated[dateStr] = dateCompletions
        }
        return updated
      })

      setPoints((current) => ({
        ...current,
        [child]: Math.max(0, current[child] - chore.points),
      }))

      setAllowance((current) => ({
        ...current,
        [child]: Math.max(0, current[child] - chore.allowance),
      }))
    }

    function isChoreCompletedOnDate(choreId, date, child) {
      const dateStr = getLocalDateString(date)
      return !!completions[dateStr]?.[`${choreId}-${child}`]
    }

    function getCompletionsByDate(date) {
      const dateStr = getLocalDateString(date)
      return completions[dateStr] || {}
    }

    function getCompletionsByChild(child) {
      const childCompletions = []
      Object.entries(completions).forEach(([dateStr, dateCompletions]) => {
        Object.values(dateCompletions).forEach((completion) => {
          if (completion.child === child) {
            childCompletions.push(completion)
          }
        })
      })
      return childCompletions.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    }

  return (
    <div className="app-shell">
      {celebration && (
          <div className="celebration">
            🎉 Great job!
          </div>
        )}
      <header className="topbar">
        <div>
          <p className="eyebrow">Welcome home</p>
          <h1>The Burgess Family App</h1>
        </div>

        <div className="avatars" aria-label="Family members">
          {family.map((person) => (
            <button
              key={person.name}
              className={
                activeUser.name === person.name
                  ? 'avatar active-avatar'
                  : 'avatar'
              }
  title={`${person.name} · ${person.role}`}
  onClick={() => setActiveUser(person)}
            >
              <span>{person.emoji}</span>
              <small>{person.name}</small>
            </button>
          ))}
        </div>
      </header>

      <main>
        {active === 'Today' && <Today points={points} />}
        {active === 'Chores' && (
          <Chores
            chores={chores}
            points={points}
            allowance={allowance}
            completions={completions}
            activeUser={activeUser}
            completeChore={completeChore}
            undoChore={undoChore}
            isChoreCompletedOnDate={isChoreCompletedOnDate}
            getCompletionsByDate={getCompletionsByDate}
            getCompletionsByChild={getCompletionsByChild}
          />
        )}
        {active !== 'Today' && active !== 'Chores' && (
          <Placeholder title={active} />
        )}
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        {sections.map((item) => (
          <button
            key={item.label}
            className={active === item.label ? 'nav-item active' : 'nav-item'}
            onClick={() => setActive(item.label)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function Today({ points }) {
  return (
    <section className="page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Today</p>
          <h2>Family Dashboard</h2>
        </div>

        <div className="points-pill">
          ⭐ Davina {points.Davina} · Ronin {points.Ronin}
        </div>
      </div>

      <div className="card-grid">
        <Card title="Calendar" icon="📅">
          <p>No events added yet.</p>
        </Card>

        <Card title="Chores" icon="✅">
          <p>Tap Chores below to see today’s chores.</p>
        </Card>

        <Card title="Meals" icon="🍽️">
          <p>Lunch boxes, snacks, after-school lunch and dinner.</p>
        </Card>

        <Card title="Reminders" icon="🔔">
          <p>Family reminders will appear here.</p>
        </Card>

        <Card title="Messages" icon="💬">
          <p>Your family group chat will appear here.</p>
        </Card>
      </div>
    </section>
  )
}

function Chores({
  chores,
  points,
  allowance,
    completions,
  activeUser,
  completeChore,
  undoChore,
    isChoreCompletedOnDate,
    getCompletionsByDate,
    getCompletionsByChild,
}) {
    const [activeTab, setActiveTab] = useState('week')
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [weekStart, setWeekStart] = useState(getWeekStart(new Date()))
    const [historyDateView, setHistoryDateView] = useState('date')
    const [historySelectedDate, setHistorySelectedDate] = useState(new Date())
    const [historyWeekStart, setHistoryWeekStart] = useState(getWeekStart(new Date()))
    const [historyChild, setHistoryChild] = useState('Davina')
    const [summaryPeriod, setSummaryPeriod] = useState('week')

    const isParent = activeUser.role === 'Parent'
    const today = new Date()
    const weekDates = getWeekDates(weekStart)
    const selectedDateStr = getLocalDateString(selectedDate)
    const historySelectedDateStr = getLocalDateString(historySelectedDate)

    // Get chores for each day in week
    const getChoresForDate = (date) => {
      const dayName = getDayName(date)
      return chores.filter((chore) => chore.days.includes(dayName))
    }

    // Get visible chores for selected date
    const choresOnSelected = getChoresForDate(selectedDate)
    const visibleChoresOnDate = isParent
      ? choresOnSelected
      : choresOnSelected.filter((chore) =>
          chore.assignedTo.includes(activeUser.name)
        )

    // Check if date is past
    const isPastDate = (date) => {
      const dateOnly = new Date(date)
      dateOnly.setHours(0, 0, 0, 0)
      const todayOnly = new Date(today)
      todayOnly.setHours(0, 0, 0, 0)
      return dateOnly < todayOnly
    }

    // Get chore status
    const getChoreStatus = (chore, date, child) => {
      if (isChoreCompletedOnDate(chore.id, date, child)) {
        return 'completed'
      }
      if (isPastDate(date) && chore.assignedTo.includes(child)) {
        return 'missed'
      }
      return 'pending'
    }

    // Calculate summary stats
    const calculateSummary = (period) => {
      const childStats = {
        Davina: { scheduled: 0, completed: 0, missed: 0, points: 0, allowance: 0 },
        Ronin: { scheduled: 0, completed: 0, missed: 0, points: 0, allowance: 0 },
      }

      let datesToCheck = []

      if (period === 'week') {
        datesToCheck = getWeekDates(weekStart)
      } else if (period === 'last-week') {
        const lastWeekStart = new Date(weekStart)
        lastWeekStart.setDate(lastWeekStart.getDate() - 7)
        datesToCheck = getWeekDates(lastWeekStart)
      } else {
        Object.keys(completions).forEach((dateStr) => {
          datesToCheck.push(parseLocalDateString(dateStr))
        })
      }

      datesToCheck.forEach((date) => {
        const dayName = getDayName(date)
        chores.forEach((chore) => {
          if (chore.days.includes(dayName)) {
            chore.assignedTo.forEach((child) => {
              childStats[child].scheduled++
              if (isChoreCompletedOnDate(chore.id, date, child)) {
                childStats[child].completed++
                childStats[child].points += chore.points
                childStats[child].allowance += chore.allowance
              } else if (isPastDate(date)) {
                childStats[child].missed++
              }
            })
          }
        })
      })

      return childStats
    }
  return (
    <section className="page">
      <div className="section-heading">
          <div>
            <p className="eyebrow">Chores</p>
            <h2>Family Chores</h2>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab-button ${activeTab === 'week' ? 'active' : ''}`}
            onClick={() => setActiveTab('week')}
          >
            Weekly
          </button>
          {isParent && (
            <>
              <button
                className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                History
              </button>
              <button
                className={`tab-button ${activeTab === 'summary' ? 'active' : ''}`}
                onClick={() => setActiveTab('summary')}
              >
                Summary
              </button>
            </>
          )}
        </div>

        {/* Weekly View */}
        {activeTab === 'week' && (
          <>
            <div className="week-nav">
              <button className="action-button secondary" onClick={() => setWeekStart(new Date(new Date(weekStart).setDate(weekStart.getDate() - 7)))}>← Previous Week</button>
              <button className="action-button secondary" onClick={() => setWeekStart(getWeekStart(today))}>This Week</button>
              <button className="action-button secondary" onClick={() => setWeekStart(new Date(new Date(weekStart).setDate(weekStart.getDate() + 7)))}>Next Week →</button>
            </div>

            <div className="card">
              <p className="week-range">{formatWeekRange(weekStart)}</p>
            </div>

            <div className="day-selector">
              {weekDates.map((date) => {
                const dateStr = getLocalDateString(date)
                const isToday = getLocalDateString(today) === dateStr
                const isSelected = selectedDateStr === dateStr
                const dayName = getDayName(date).slice(0, 3)
                return (
                  <button
                    key={dateStr}
                    className={`day-button ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedDate(date)}
                  >
                    <div className="day-name">{dayName}</div>
                    <div className="day-num">{date.getDate()}</div>
                  </button>
                )
              })}
            </div>

            <div className="card-grid">
              {visibleChoresOnDate.length === 0 ? (
                <div className="card">
                  <p>No chores scheduled for {formatDate(selectedDate)}.</p>
                </div>
              ) : (
                visibleChoresOnDate.map((chore) => {
                  const allAssignedCompleted = chore.assignedTo.every((child) =>
                    isChoreCompletedOnDate(chore.id, selectedDate, child)
                  )

                  return (
                    <article className="card" key={chore.id}>
                      <div className="card-title">
                        <span>{allAssignedCompleted ? '✅' : '🧹'}</span>
                        <h3>{chore.title}</h3>
                      </div>

                      <p>
                        {chore.assignedTo.map((name) => (
                          <span key={name}>
                            {name === 'Davina' ? '👧' : '👦'} {name}{' '}
                          </span>
                        ))}
                      </p>

                      <p>
                        ⭐ {chore.points} points
                        {chore.allowance > 0 && ` · $${chore.allowance.toFixed(2)} allowance`}
                      </p>

                      <p className="repeat-days">
                        🔁 {chore.days.length === 7
                          ? 'Every day'
                          : chore.days.map((day) => day.slice(0, 3)).join(', ')}
                      </p>

                      <div className="chore-actions">
                        {chore.assignedTo
                          .filter((child) => isParent || child === activeUser.name)
                          .map((child) => {
                          const isCompleted = isChoreCompletedOnDate(chore.id, selectedDate, child)
                          const status = getChoreStatus(chore, selectedDate, child)

                          return (
                            <div key={child} className="child-action">
                              {isParent && <small>{child === 'Davina' ? '👧' : '👦'} {child}</small>}
                              {!isCompleted ? (
                                <button className="action-button" onClick={() => completeChore(chore.id, selectedDate, child)}>
                                  Mark Done
                                </button>
                              ) : (
                                <>
                                  <p className="earned">
                                    Earned: ⭐ {chore.points}
                                    {chore.allowance > 0 && ` + $${chore.allowance.toFixed(2)}`}
                                  </p>
                                  <button className="action-button secondary" onClick={() => undoChore(chore.id, selectedDate, child)}>
                                    Undo
                                  </button>
                                </>
                              )}
                              {status === 'missed' && <p className="missed-label">Missed</p>}
                            </div>
                          )
                        })}
                      </div>
                    </article>
                  )
                })
              )}
            </div>

            <div className="card">
              <h3>Current balances</h3>
              <p>👧 Davina: ⭐ {points.Davina} · ${allowance.Davina.toFixed(2)}</p>
              <p>👦 Ronin: ⭐ {points.Ronin} · ${allowance.Ronin.toFixed(2)}</p>
            </div>
          </>
        )}

        {/* History View */}
        {activeTab === 'history' && isParent && (
          <>
            <div className="history-tabs">
              <button className={`history-tab-button ${historyDateView === 'date' ? 'active' : ''}`} onClick={() => setHistoryDateView('date')}>By Day</button>
              <button className={`history-tab-button ${historyDateView === 'child' ? 'active' : ''}`} onClick={() => setHistoryDateView('child')}>By Child</button>
            </div>

            {historyDateView === 'date' && (
              <>
                <div className="week-nav">
                  <button className="action-button secondary" onClick={() => setHistoryWeekStart(new Date(new Date(historyWeekStart).setDate(historyWeekStart.getDate() - 7)))}>← Previous Week</button>
                  <button className="action-button secondary" onClick={() => setHistoryWeekStart(getWeekStart(today))}>This Week</button>
                  <button className="action-button secondary" onClick={() => setHistoryWeekStart(new Date(new Date(historyWeekStart).setDate(historyWeekStart.getDate() + 7)))}>Next Week →</button>
                </div>

                <div className="card">
                  <p className="week-range">{formatWeekRange(historyWeekStart)}</p>
                </div>

                <div className="day-selector">
                  {getWeekDates(historyWeekStart).map((date) => {
                    const dateStr = getLocalDateString(date)
                    const isToday = getLocalDateString(today) === dateStr
                    const isSelected = historySelectedDateStr === dateStr
                    return (
                      <button
                        key={dateStr}
                        className={`day-button ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                        onClick={() => setHistorySelectedDate(date)}
                      >
                        <div className="day-name">{getDayName(date).slice(0, 3)}</div>
                        <div className="day-num">{date.getDate()}</div>
                      </button>
                    )
                  })}
                </div>

                <div className="card">
                  <h3>Chores for {formatDate(historySelectedDate)}</h3>
                  {(() => {
                    const dayName = getDayName(historySelectedDate)
                    const scheduledChores = chores.filter((chore) => chore.days.includes(dayName))
                    const dateCompletions = getCompletionsByDate(historySelectedDate)

                    if (scheduledChores.length === 0) return <p>No chores scheduled for this date.</p>

                    let totalPoints = 0, totalAllowance = 0
                    const items = scheduledChores.flatMap((chore) =>
                      chore.assignedTo.map((child) => {
                        const isCompleted = !!dateCompletions[`${chore.id}-${child}`]
                        const status = getChoreStatus(chore, historySelectedDate, child)
                        if (isCompleted) {
                          totalPoints += chore.points
                          totalAllowance += chore.allowance
                        }
                        return { child, title: chore.title, points: chore.points, allowance: chore.allowance, status, isCompleted }
                      })
                    )

                    return (
                      <>
                        {items.map((item, i) => (
                          <div key={i} className="history-item">
                            <strong>{item.child === 'Davina' ? '👧' : '👦'} {item.child}</strong>
                            <p>{item.title}</p>
                            <p className={`status-${item.status}`}>
                              {item.status === 'completed' && '✅ Completed'}
                              {item.status === 'missed' && '❌ Missed'}
                              {item.status === 'pending' && '⏳ Pending'}
                            </p>
                            {item.isCompleted && (
                              <p>⭐ {item.points}{item.allowance > 0 && ` · $${item.allowance.toFixed(2)}`}</p>
                            )}
                          </div>
                        ))}
                        <div className="history-summary">
                          <p><strong>Earned this day:</strong> ⭐ {totalPoints} + ${totalAllowance.toFixed(2)}</p>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </>
            )}

            {historyDateView === 'child' && (
              <>
                <div className="history-filters">
                  {['Davina', 'Ronin'].map((name) => (
                    <button
                      key={name}
                      className={`action-button ${historyChild === name ? '' : 'secondary'}`}
                      onClick={() => setHistoryChild(name)}
                    >
                      {name === 'Davina' ? '👧' : '👦'} {name}
                    </button>
                  ))}
                </div>

                <div className="card">
                  <h3>{historyChild === 'Davina' ? '👧' : '👦'} {historyChild}'s Completions</h3>
                  {(() => {
                    const childCompletions = getCompletionsByChild(historyChild)
                    if (childCompletions.length === 0) return <p>No completed chores yet for {historyChild}.</p>
                    return (
                      <div>
                        {childCompletions.map((completion) => (
                          <div key={completion.id} className="history-item">
                            <strong>{completion.title}</strong>
                            <p>{completion.date}</p>
                            <p>⭐ {completion.points}{completion.allowance > 0 && ` · $${completion.allowance.toFixed(2)}`}</p>
                            <small>{new Date(completion.completedAt).toLocaleString()}</small>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </>
            )}
          </>
        )}

        {/* Summary View */}
        {activeTab === 'summary' && isParent && (
          <>
            <div className="history-filters">
              {['week', 'last-week', 'all-time'].map((period) => (
                <button
                  key={period}
                  className={`action-button ${summaryPeriod === period ? '' : 'secondary'}`}
                  onClick={() => setSummaryPeriod(period)}
                >
                  {period === 'week' && 'This Week'}
                  {period === 'last-week' && 'Last Week'}
                  {period === 'all-time' && 'All Time'}
                </button>
              ))}
            </div>

            <div className="card-grid">
              {Object.entries(calculateSummary(summaryPeriod)).map(([childName, childStats]) => (
                <div className="card" key={childName}>
                  <h3>{childName === 'Davina' ? '👧' : '👦'} {childName}</h3>
                  <p><strong>Scheduled:</strong> {childStats.scheduled}</p>
                  <p><strong>Completed:</strong> {childStats.completed}</p>
                  <p><strong>Missed:</strong> {childStats.missed}</p>
                  <p><strong>Points:</strong> ⭐ {childStats.points}</p>
                  <p><strong>Allowance:</strong> ${childStats.allowance.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </>
        )}
    </section>
  )
}

function Card({ title, icon, children }) {
  return (
    <article className="card">
      <div className="card-title">
        <span>{icon}</span>
        <h3>{title}</h3>
      </div>
      {children}
    </article>
  )
}

function Placeholder({ title }) {
  return (
    <section className="page">
      <p className="eyebrow">Coming next</p>
      <h2>{title}</h2>
      <div className="card">
        <p>This section is ready for us to build next.</p>
      </div>
    </section>
  )
}

export default App