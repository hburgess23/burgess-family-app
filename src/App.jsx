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

function App() {
  const [active, setActive] = useState('Today')

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Welcome home</p>
          <h1>The Burgess Family App</h1>
        </div>
        <div className="avatars" aria-label="Family members">
          {family.map((person) => (
            <button key={person.name} className="avatar" title={`${person.name} · ${person.role}`}>
              <span>{person.emoji}</span>
              <small>{person.name}</small>
            </button>
          ))}
        </div>
      </header>

      <main>
        {active === 'Today' ? <Today /> : <Placeholder title={active} />}
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

function Today() {
  return (
    <section className="page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Thursday</p>
          <h2>Today</h2>
        </div>
        <div className="points-pill">⭐ Davina 35 · Ronin 28</div>
      </div>

      <div className="card-grid">
        <Card title="Calendar" icon="📅">
          <p>No events added yet.</p>
        </Card>
        <Card title="Chores" icon="✅">
          <p>Today’s chores will appear here.</p>
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

function Card({ title, icon, children }) {
  return (
    <article className="card">
      <div className="card-title"><span>{icon}</span><h3>{title}</h3></div>
      {children}
    </article>
  )
}

function Placeholder({ title }) {
  return (
    <section className="page">
      <p className="eyebrow">Coming next</p>
      <h2>{title}</h2>
      <div className="card"><p>This section is ready for us to build next.</p></div>
    </section>
  )
}

export default App
