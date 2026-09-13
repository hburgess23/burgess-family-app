import React, { useState } from 'react'
import Grocery from './Grocery'

export default function More({ householdId, activeUser }) {
  const [section, setSection] = useState('menu')

  if (section === 'grocery') {
    return (
      <section className="page">
        <button
          className="action-button secondary more-back-button"
          type="button"
          onClick={() => setSection('menu')}
        >
          ← More
        </button>

        <Grocery
          householdId={householdId}
          activeUser={activeUser}
        />
      </section>
    )
  }

  return (
    <section className="page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Family tools</p>
          <h2>More</h2>
        </div>
      </div>

      <div className="more-grid">
        <button
          className="card more-card"
          type="button"
          onClick={() => setSection('grocery')}
        >
          <span className="more-card-icon">🛒</span>
          <div>
            <h3>Grocery</h3>
            <p>Shared family shopping list</p>
          </div>
        </button>

        <button className="card more-card disabled" type="button" disabled>
          <span className="more-card-icon">🎁</span>
          <div>
            <h3>Rewards</h3>
            <p>Coming next</p>
          </div>
        </button>

        <button className="card more-card disabled" type="button" disabled>
          <span className="more-card-icon">💬</span>
          <div>
            <h3>Messages</h3>
            <p>Coming next</p>
          </div>
        </button>

        <button className="card more-card disabled" type="button" disabled>
          <span className="more-card-icon">⚙️</span>
          <div>
            <h3>Settings</h3>
            <p>Coming next</p>
          </div>
        </button>
      </div>
    </section>
  )
}