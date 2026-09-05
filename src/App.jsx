import React, { useState } from 'react'

const family = [
  { name: 'Harold', role: 'Parent', emoji: '👨' },
  { name: 'Divya', role: 'Parent', emoji: '👩' },
  { name: 'Davina', role: 'Child', emoji: '👧' },
  { name: 'Ronin', role: 'Child', emoji: '👦' },
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
    completed: false,
  },
  {
    id: 2,
    title: 'Empty dishwasher',
    assignedTo: ['Ronin'],
    points: 5,
    allowance: 0,
    days: ['Monday', 'Wednesday', 'Friday'],
    completed: false,
  },
  {
    id: 3,
    title: 'Put toys away',
    assignedTo: ['Davina', 'Ronin'],
    points: 5,
    allowance: 0.5,
    days: ['Tuesday', 'Thursday'],
    completed: false,
  },
]

function App() {
  const [active, setActive] = useState('Today')
  const [chores, setChores] = useState(startingChores)
  const [celebration, setCelebration] = useState(false)
  const [points, setPoints] = useState({
    Davina: 35,
    Ronin: 28,
  })

 const [allowance, setAllowance] = useState({
  Davina: 0,
  Ronin: 0,
})

const [choreHistory, setChoreHistory] = useState([])

function completeChore(id) {
  const chore = chores.find((item) => item.id === id)

  if (!chore || chore.completed) return

  const completionId = crypto.randomUUID()
  setChores((current) =>
    current.map((item) =>
      item.id === id ? { ...item, completed: true, completionId } : item
    )
  )

  setPoints((current) => {
    const updated = { ...current }

    chore.assignedTo.forEach((name) => {
      updated[name] = updated[name] + chore.points
    })

    return updated
  })

  setAllowance((current) => {
    const updated = { ...current }

    chore.assignedTo.forEach((name) => {
      updated[name] = updated[name] + chore.allowance
    })

    return updated
  })
  const completedAt = new Date().toISOString()

setChoreHistory((current) => [
  ...current,
  ...chore.assignedTo.map((name) => ({
    id: `${completionId}-${name}`,
    completionId,
    choreId: chore.id,
    title: chore.title,
    child: name,
    points: chore.points,
    allowance: chore.allowance,
    completedAt,
  })),
])
  const audioContext = new (window.AudioContext || window.webkitAudioContext)()
const oscillator = audioContext.createOscillator()
const gainNode = audioContext.createGain()

oscillator.connect(gainNode)
gainNode.connect(audioContext.destination)

oscillator.type = 'sine'
oscillator.frequency.setValueAtTime(660, audioContext.currentTime)

gainNode.gain.setValueAtTime(0.12, audioContext.currentTime)
gainNode.gain.exponentialRampToValueAtTime(
  0.001,
  audioContext.currentTime + 0.35
)

oscillator.start()
oscillator.stop(audioContext.currentTime + 0.35)
  setCelebration(true)

setTimeout(() => {
  setCelebration(false)
}, 1500)
}

function undoChore(id) {
  const chore = chores.find((item) => item.id === id)

  if (!chore || !chore.completed) return

  const completionId = chore.completionId

  setChores((current) =>
    current.map((item) =>
      item.id === id
        ? { ...item, completed: false, completionId: null }
        : item
    )
  )

  setPoints((current) => {
    const updated = { ...current }

    chore.assignedTo.forEach((name) => {
      updated[name] = Math.max(0, updated[name] - chore.points)
    })

    return updated
  })

  setAllowance((current) => {
    const updated = { ...current }

    chore.assignedTo.forEach((name) => {
      updated[name] = Math.max(
        0,
        updated[name] - chore.allowance
      )
    })

    return updated
  })

  if (completionId) {
    setChoreHistory((current) =>
      current.filter(
        (entry) => entry.completionId !== completionId
      )
    )
  }
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
              className="avatar"
              title={`${person.name} · ${person.role}`}
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
  choreHistory={choreHistory}
  completeChore={completeChore}
  undoChore={undoChore}
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
  choreHistory,
  completeChore,
  undoChore,
}) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const todaysChores = chores.filter((chore) => chore.days.includes(today))
const [showHistory, setShowHistory] = useState(false)
const [historyChild, setHistoryChild] = useState('All')
const [historyDate, setHistoryDate] = useState('Today')
  return (
    <section className="page">
      <div className="section-heading">
  <div>
    <p className="eyebrow">Today</p>
    <h2>Chores</h2>
  </div>

  <button
    className="action-button secondary"
    onClick={() => setShowHistory(!showHistory)}
  >
    {showHistory ? 'Back to Today' : 'History'}
  </button>
</div>
{showHistory && (
  <div className="card">
    <h3>Chore History</h3>
<div className="history-filters">
  {['All', 'Davina', 'Ronin'].map((name) => (
    <button
      key={name}
      className={
        historyChild === name
          ? 'action-button'
          : 'action-button secondary'
      }
      onClick={() => setHistoryChild(name)}
    >
      {name}
    </button>
  ))}
</div>

<div className="history-filters">
  {['Today', 'Last 7 Days', 'All'].map((range) => (
    <button
      key={range}
      className={
        historyDate === range
          ? 'action-button'
          : 'action-button secondary'
      }
      onClick={() => setHistoryDate(range)}
    >
      {range}
    </button>
  ))}
</div>
    {choreHistory.length === 0 ? (
      <p>No completed chores yet.</p>
    ) : (
choreHistory
  .filter(
    (entry) =>
      historyChild === 'All' ||
      entry.child === historyChild
  )
  .filter((entry) => {
    if (historyDate === 'All') return true

    const completed = new Date(entry.completedAt)
    const now = new Date()

    if (historyDate === 'Today') {
      return completed.toDateString() === now.toDateString()
    }

    if (historyDate === 'Last 7 Days') {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(now.getDate() - 6)
      sevenDaysAgo.setHours(0, 0, 0, 0)

      return completed >= sevenDaysAgo
    }

    return true
  })
  .slice()
  .reverse()
  .map((entry) => (
          <div key={entry.id} className="history-item">
            <strong>
              {entry.child === 'Davina' ? '👧' : '👦'} {entry.child}
            </strong>

            <p>{entry.title}</p>

            <p>
              ⭐ {entry.points}
              {entry.allowance > 0 &&
                ` · $${entry.allowance.toFixed(2)}`}
            </p>

            <small>
              {new Date(entry.completedAt).toLocaleString()}
            </small>
          </div>
        ))
    )}
  </div>
)}
      {!showHistory && (
  <div className="card-grid">
    {todaysChores.map((chore) => (
          <article className="card" key={chore.id}>
            <div className="card-title">
              <span>{chore.completed ? '✅' : '🧹'}</span>
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
              {chore.allowance > 0 &&
                ` · $${chore.allowance.toFixed(2)} allowance`}
            </p>
<p className="repeat-days">
  🔁 {chore.days.length === 7
    ? 'Every day'
    : chore.days
        .map((day) => day.slice(0, 3))
        .join(', ')}
</p>
            {!chore.completed ? (
              <button
                className="action-button"
                onClick={() => completeChore(chore.id)}
              >
                Mark Done
              </button>
            ) : (
              <>
                <p>
                  Earned: ⭐ {chore.points}
                  {chore.allowance > 0 &&
                    ` + $${chore.allowance.toFixed(2)}`}
                </p>

                <button
                  className="action-button secondary"
                  onClick={() => undoChore(chore.id)}
                >
                  Undo
                </button>
              </>
            )}
          </article>
        ))}
      </div>
)}
      <div className="card">
        <h3>Current balances</h3>
        <p>
          👧 Davina: ⭐ {points.Davina} · $
          {allowance.Davina.toFixed(2)}
        </p>
        <p>
          👦 Ronin: ⭐ {points.Ronin} · $
          {allowance.Ronin.toFixed(2)}
        </p>
      </div>
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