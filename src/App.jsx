import React, { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { isReminderDueOnDate } from './reminderUtils'
import Meals from './Meals'
import More from './More'
import Grocery from './Grocery'
import Rewards from './Rewards'
import Messages from './Messages'
import Reminders from './Reminders'

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
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [householdId, setHouseholdId] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
    }, [])

  const [active, setActive] = useState('Today')
  const [activeUser, setActiveUser] = useState(family[0])
  const [pendingParent, setPendingParent] = useState(null)
  const [parentPin, setParentPin] = useState('')
  const [parentPinError, setParentPinError] = useState('')
  const [verifyingParentPin, setVerifyingParentPin] = useState(false)

  function handleProfileClick(person) {
    if (person.role === 'Child') {
      setActiveUser(person)
      setPendingParent(null)
      setParentPin('')
      setParentPinError('')
      return
    }

    if (activeUser.role === 'Parent') {
      setActiveUser(person)
      return
    }

    setPendingParent(person)
    setParentPin('')
    setParentPinError('')
  }

  async function handleVerifyParentPin(event) {
    event.preventDefault()

    if (!householdId || !pendingParent) return

    if (!/^[0-9]{4}$/.test(parentPin)) {
      setParentPinError('Enter the 4-digit Parent PIN.')
      return
    }

    setVerifyingParentPin(true)
    setParentPinError('')

    const { data, error } = await supabase.rpc('verify_parent_pin', {
      target_household: householdId,
      candidate_pin: parentPin,
    })

    setParentPin('')
    setVerifyingParentPin(false)

    if (error) {
      console.error('Could not verify Parent PIN:', error)
      setParentPinError('Could not verify the PIN. Please try again.')
      return
    }

    if (data !== true) {
      setParentPinError('Incorrect Parent PIN.')
      return
    }

    setActiveUser(pendingParent)
    setPendingParent(null)
    setParentPinError('')
  }
  useEffect(() => {
  if (!session?.user) {
    setHouseholdId(null)
    return
  }

  async function loadLoggedInProfile() {
    const { data, error } = await supabase
      .from('profiles')
      .select('name, role, emoji, household_id')
      .eq('auth_user_id', session.user.id)
      .single()

    if (error) {
      console.error('Could not load profile:', error)
      return
    }

    setHouseholdId(data.household_id)

    setActiveUser({
      name: data.name,
      role: data.role,
      emoji: data.emoji,
    })
  }

  loadLoggedInProfile()
}, [session])
    const [chores, setChores] = useState([])

  async function refreshChores() {
    if (!householdId) {
      setChores([])
      return
    }

    const [
      { data: choreRows, error: choresError },
      { data: assignmentRows, error: assignmentsError },
      { data: profileRows, error: profilesError },
    ] = await Promise.all([
      supabase
        .from('chores')
        .select('id, title, points, allowance_cents, days, active')
        .eq('household_id', householdId)
        .order('created_at', { ascending: true }),

      supabase
        .from('chore_assignments')
        .select('chore_id, profile_id')
        .eq('household_id', householdId),

      supabase
        .from('profiles')
        .select('id, name')
        .eq('household_id', householdId)
        .eq('active', true),
    ])

    if (choresError || assignmentsError || profilesError) {
      console.error(
        'Could not load chores:',
        choresError || assignmentsError || profilesError
      )
      return
    }

    const profileNames = Object.fromEntries(
      (profileRows || []).map((profile) => [profile.id, profile.name])
    )

    const assignedByChore = {}

    ;(assignmentRows || []).forEach((assignment) => {
      const name = profileNames[assignment.profile_id]

      if (!name) return

      if (!assignedByChore[assignment.chore_id]) {
        assignedByChore[assignment.chore_id] = []
      }

      assignedByChore[assignment.chore_id].push(name)
    })

    const liveChores = (choreRows || []).map((chore) => ({
      id: chore.id,
      title: chore.title,
      assignedTo: assignedByChore[chore.id] || [],
      points: chore.points || 0,
      allowance: (chore.allowance_cents || 0) / 100,
      days: chore.days || [],
      active: chore.active !== false,
    }))

    setChores(liveChores)
  }

  useEffect(() => {
    refreshChores()
  }, [householdId])
  const [celebration, setCelebration] = useState(false)
  const [points, setPoints] = useState({
    Davina: 0,
    Ronin: 0,
  })

  const [allowance, setAllowance] = useState({
    Davina: 0,
    Ronin: 0,
  })

  useEffect(() => {
    if (!householdId) return

    async function loadBalances() {
      const [
        { data: profileRows, error: profilesError },
        { data: adjustmentRows, error: adjustmentsError },
        { data: completionRows, error: completionsError },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name')
          .eq('household_id', householdId)
          .eq('role', 'Child')
          .eq('active', true),

        supabase
          .from('reward_adjustments')
          .select('profile_id, points_delta, allowance_cents_delta')
          .eq('household_id', householdId),

        supabase
          .from('chore_completions')
          .select('profile_id, points_awarded, allowance_cents_awarded')
          .eq('household_id', householdId),
      ])

      if (profilesError || adjustmentsError || completionsError) {
        console.error(
          'Could not load balances:',
          profilesError || adjustmentsError || completionsError
        )
        return
      }

      const profileNames = Object.fromEntries(
        (profileRows || []).map((profile) => [profile.id, profile.name])
      )

      const nextPoints = { Davina: 0, Ronin: 0 }
      const nextAllowanceCents = { Davina: 0, Ronin: 0 }

      ;(adjustmentRows || []).forEach((row) => {
        const name = profileNames[row.profile_id]
        if (!name) return

        nextPoints[name] += row.points_delta || 0
        nextAllowanceCents[name] += row.allowance_cents_delta || 0
      })

      ;(completionRows || []).forEach((row) => {
        const name = profileNames[row.profile_id]
        if (!name) return

        nextPoints[name] += row.points_awarded || 0
        nextAllowanceCents[name] += row.allowance_cents_awarded || 0
      })

      setPoints(nextPoints)

      setAllowance({
        Davina: nextAllowanceCents.Davina / 100,
        Ronin: nextAllowanceCents.Ronin / 100,
      })
    }

    loadBalances()
  }, [householdId])
    // completions: { 'YYYY-MM-DD': { 'chore_id-child': { date, choreId, child, title, points, allowance, completedAt } } }
    const [completions, setCompletions] = useState({})

    useEffect(() => {
      if (!householdId) return

      async function loadCompletions() {
        const [
          { data: completionRows, error: completionsError },
          { data: profileRows, error: profilesError },
        ] = await Promise.all([
          supabase
            .from('chore_completions')
            .select(
              'id, chore_id, profile_id, completion_date, completed_at, points_awarded, allowance_cents_awarded'
            )
            .eq('household_id', householdId),

          supabase
            .from('profiles')
            .select('id, name')
            .eq('household_id', householdId),
        ])

        if (completionsError || profilesError) {
          console.error(
            'Could not load completions:',
            completionsError || profilesError
          )
          return
        }

        const profileNames = Object.fromEntries(
          (profileRows || []).map((profile) => [profile.id, profile.name])
        )

        const nextCompletions = {}

        ;(completionRows || []).forEach((row) => {
          const child = profileNames[row.profile_id]
          const chore = chores.find((item) => item.id === row.chore_id)

          if (!child || !chore) return

          if (!nextCompletions[row.completion_date]) {
            nextCompletions[row.completion_date] = {}
          }

          nextCompletions[row.completion_date][`${row.chore_id}-${child}`] = {
            id: row.id,
            completionId: row.id,
            date: row.completion_date,
            choreId: row.chore_id,
            child,
            title: chore.title,
            points: row.points_awarded || 0,
            allowance: (row.allowance_cents_awarded || 0) / 100,
            completedAt: row.completed_at,
          }
        })

        setCompletions(nextCompletions)
      }

      loadCompletions()
    }, [householdId, chores])

    async function completeChore(choreId, selectedDate, child) {
      const dateStr = getLocalDateString(selectedDate)
      const chore = chores.find((item) => item.id === choreId)

      if (!chore || !householdId) return
      if (completions[dateStr]?.[`${choreId}-${child}`]) return

      const { data: childProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('household_id', householdId)
        .eq('name', child)
        .eq('role', 'Child')
        .single()

      if (profileError || !childProfile) {
        console.error('Could not find child profile:', profileError)
        return
      }

      const completedAt = new Date().toISOString()

      const { data: savedCompletion, error: completionError } =
        await supabase
          .from('chore_completions')
          .insert({
            household_id: householdId,
            chore_id: chore.id,
            profile_id: childProfile.id,
            completion_date: dateStr,
            completed_at: completedAt,
            points_awarded: chore.points,
            allowance_cents_awarded: Math.round(chore.allowance * 100),
          })
          .select(
            'id, completion_date, completed_at, points_awarded, allowance_cents_awarded'
          )
          .single()

      if (completionError) {
        console.error('Could not save completion:', completionError)
        return
      }

      setCompletions((current) => ({
        ...current,
        [dateStr]: {
          ...current[dateStr],
          [`${choreId}-${child}`]: {
            id: savedCompletion.id,
            completionId: savedCompletion.id,
            date: savedCompletion.completion_date,
            choreId,
            child,
            title: chore.title,
            points: savedCompletion.points_awarded || 0,
            allowance:
              (savedCompletion.allowance_cents_awarded || 0) / 100,
            completedAt: savedCompletion.completed_at,
          },
        },
      }))

      setPoints((current) => ({
        ...current,
        [child]:
          current[child] + (savedCompletion.points_awarded || 0),
      }))

      setAllowance((current) => ({
        ...current,
        [child]:
          current[child] +
          (savedCompletion.allowance_cents_awarded || 0) / 100,
      }))

      const audioContext =
        new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(
        660,
        audioContext.currentTime
      )

      gainNode.gain.setValueAtTime(
        0.12,
        audioContext.currentTime
      )
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
    async function undoChore(choreId, selectedDate, child) {
      const dateStr = getLocalDateString(selectedDate)
      const completion =
        completions[dateStr]?.[`${choreId}-${child}`]

      if (!completion || !householdId) return

      const { error } = await supabase
        .from('chore_completions')
        .delete()
        .eq('id', completion.id)
        .eq('household_id', householdId)

      if (error) {
        console.error('Could not undo completion:', error)
        return
      }

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
        [child]: Math.max(
          0,
          current[child] - (completion.points || 0)
        ),
      }))

      setAllowance((current) => ({
        ...current,
        [child]: Math.max(
          0,
          current[child] - (completion.allowance || 0)
        ),
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
  if (authLoading) {
    return (
      <div className="app-shell">
        <main>
          <section className="page">
            <div className="card">
              <p>Loading…</p>
            </div>
          </section>
        </main>
      </div>
    )
  }

  if (!session) {
    return <Login />
  }
  return (
    <div className="app-shell">
      {celebration && (
          <div className="celebration">
            🎉 Great job!
          </div>
        )}
      {pendingParent && (
        <div className="pin-backdrop">
          <form className="pin-dialog" onSubmit={handleVerifyParentPin}>
            <div className="pin-icon">🔒</div>
            <p className="eyebrow">Parent access</p>
            <h2>Enter Parent PIN</h2>
            <p>
              Enter the shared PIN to switch to {pendingParent.name}.
            </p>

            <input
              className="pin-input"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength="4"
              value={parentPin}
              onChange={(event) => {
                const value = event.target.value
                  .replace(/\D/g, '')
                  .slice(0, 4)

                setParentPin(value)
                setParentPinError('')
              }}
              autoFocus
              aria-label="Parent PIN"
            />

            {parentPinError && (
              <p className="form-message error">{parentPinError}</p>
            )}

            <div className="pin-actions">
              <button
                className="action-button secondary"
                type="button"
                onClick={() => {
                  setPendingParent(null)
                  setParentPin('')
                  setParentPinError('')
                }}
              >
                Cancel
              </button>

              <button
                className="action-button"
                type="submit"
                disabled={verifyingParentPin}
              >
                {verifyingParentPin ? 'Checking…' : 'Unlock'}
              </button>
            </div>
          </form>
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
  onClick={() => handleProfileClick(person)}
            >
              <span>{person.emoji}</span>
              <small>{person.name}</small>
            </button>
          ))}
        </div>
        <button
  className="action-button secondary"
  onClick={() => supabase.auth.signOut()}
>
  Sign Out
</button>
      </header>

      <main>
        {active === 'Today' && <Today points={points} setActive={setActive} householdId={householdId} />}
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
            refreshChores={refreshChores}
            householdId={householdId}
          />
        )}
        {active === 'Meals' && (
          <Meals
            householdId={householdId}
            activeUser={activeUser}
          />
        )}

        {active === 'Grocery' && (
          <Grocery
            householdId={householdId}
            activeUser={activeUser}
          />
        )}

        {active === 'Rewards' && (
          <Rewards
            householdId={householdId}
            activeUser={activeUser}
          />
        )}

        {active === 'Messages' && (
          <Messages
            householdId={householdId}
            activeUser={activeUser}
          />
        )}

        {active === 'Reminders' && (
          <Reminders
            householdId={householdId}
            activeUser={activeUser}
          />
        )}

        {active === 'More' && (
          <More
            householdId={householdId}
            activeUser={activeUser}
          />
        )}

        {active !== 'Today' && active !== 'Chores' && active !== 'Meals' && active !== 'Grocery' && active !== 'Rewards' && active !== 'Messages' && active !== 'Reminders' && active !== 'More' && (
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

function Today({ points, setActive, householdId }) {
  const [todayReminders, setTodayReminders] = useState([])

  useEffect(() => {
    if (!householdId) return

    let cancelled = false

    async function loadTodayReminders() {
      const { data, error } = await supabase
        .from('family_reminders')
        .select(
          'id, title, reminder_date, reminder_time, repeat_type, repeat_days, active'
        )
        .eq('household_id', householdId)
        .eq('active', true)

      if (error) {
        console.error('Could not load Today reminders:', error)
        return
      }

      const dueToday = (data || [])
        .filter((reminder) => isReminderDueOnDate(reminder))
        .sort((a, b) =>
          (a.reminder_time || '99:99').localeCompare(
            b.reminder_time || '99:99'
          )
        )

      if (!cancelled) {
        setTodayReminders(dueToday)
      }
    }

    loadTodayReminders()

    return () => {
      cancelled = true
    }
  }, [householdId])
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
        <Card title="Calendar" icon="📅" onClick={() => setActive('Calendar')}>
          <p>No events added yet.</p>
        </Card>

        <Card title="Chores" icon="✅" onClick={() => setActive('Chores')}>
          <p>Tap Chores below to see today’s chores.</p>
        </Card>

        <Card title="Meals" icon="🍽️" onClick={() => setActive('Meals')}>
          <p>Lunch boxes, snacks, after-school lunch and dinner.</p>
        </Card>
        <Card
          title="Grocery"
          icon="🛒"
          onClick={() => setActive('Grocery')}
        >
          <p>Add items and keep the family shopping list up to date.</p>
        </Card>
        <Card
          title="Rewards"
          icon="🎁"
          onClick={() => setActive('Rewards')}
        >
          <p>Spend points on family rewards and treats.</p>
        </Card>

        <Card
        title="Reminders"
        icon="🔔"
        onClick={() => setActive('Reminders')}
      >
        {todayReminders.length === 0 ? (
          <p>No reminders due today.</p>
        ) : (
          <div className="today-reminders-preview">
            {todayReminders.slice(0, 3).map((reminder) => (
              <p key={reminder.id}>
                🔔 <strong>{reminder.title}</strong>
                {reminder.reminder_time
                  ? ` · ${reminder.reminder_time.slice(0, 5)}`
                  : ''}
              </p>
            ))}

            {todayReminders.length > 3 && (
              <p>+{todayReminders.length - 3} more today</p>
            )}
          </div>
        )}
      </Card>

        <Card title="Messages" icon="💬" onClick={() => setActive('Messages')}>
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
  refreshChores,
  householdId,
}) {
    const [activeTab, setActiveTab] = useState('week')
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [weekStart, setWeekStart] = useState(getWeekStart(new Date()))
    const [historyDateView, setHistoryDateView] = useState('date')
    const [historySelectedDate, setHistorySelectedDate] = useState(new Date())
    const [historyWeekStart, setHistoryWeekStart] = useState(getWeekStart(new Date()))
    const [historyChild, setHistoryChild] = useState('Davina')
    const [summaryPeriod, setSummaryPeriod] = useState('week')
    const [editingChoreId, setEditingChoreId] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const [formError, setFormError] = useState('')
    const [formMessage, setFormMessage] = useState('')
    const [choreForm, setChoreForm] = useState({
      title: '',
      assignedTo: [],
      days: [],
      points: 0,
      allowance: 0,
    })

    const isParent = activeUser.role === 'Parent'
    const today = new Date()
    const weekDates = getWeekDates(weekStart)
    const selectedDateStr = getLocalDateString(selectedDate)
    const historySelectedDateStr = getLocalDateString(historySelectedDate)
    const activeChores = chores.filter((chore) => chore.active !== false)
    const choreListForManagement = [...chores].sort((a, b) => a.title.localeCompare(b.title))

    const emptyChoreForm = () => ({
      title: '',
      assignedTo: [],
      days: [],
      points: 0,
      allowance: 0,
    })

    function resetChoreForm() {
      setEditingChoreId(null)
      setChoreForm(emptyChoreForm())
      setFormError('')
      setFormMessage('')
    }

    function editChore(chore) {
      setEditingChoreId(chore.id)
      setChoreForm({
        title: chore.title,
        assignedTo: [...(chore.assignedTo || [])],
        days: [...(chore.days || [])],
        points: chore.points || 0,
        allowance: chore.allowance || 0,
      })
      setFormError('')
      setFormMessage('')
    }

    function toggleAssignment(childName) {
      setChoreForm((current) => ({
        ...current,
        assignedTo: current.assignedTo.includes(childName)
          ? current.assignedTo.filter((name) => name !== childName)
          : [...current.assignedTo, childName],
      }))
      setFormError('')
    }

    function toggleDay(dayName) {
      setChoreForm((current) => ({
        ...current,
        days: current.days.includes(dayName)
          ? current.days.filter((day) => day !== dayName)
          : [...current.days, dayName],
      }))
      setFormError('')
    }

    async function handleToggleChoreActive(chore) {
      if (!householdId) return

      const nextActiveState = chore.active === false
      const { error } = await supabase
        .from('chores')
        .update({ active: nextActiveState })
        .eq('id', chore.id)
        .eq('household_id', householdId)

      if (error) {
        setFormError(`Could not ${nextActiveState ? 'enable' : 'disable'} this chore.`)
        return
      }

      await refreshChores()
    }

    async function handleSaveChore(event) {
      event.preventDefault()

      setFormError('')
      setFormMessage('')

      const trimmedTitle = choreForm.title.trim()
      const parsedPoints = Number(choreForm.points)
      const parsedAllowance = Number(choreForm.allowance)

      if (!trimmedTitle) {
        setFormError('Please enter a chore name.')
        return
      }

      if (choreForm.assignedTo.length === 0) {
        setFormError('Please assign the chore to at least one child.')
        return
      }

      if (choreForm.days.length === 0) {
        setFormError('Please choose at least one day.')
        return
      }

      if (!Number.isFinite(parsedPoints) || parsedPoints < 0) {
        setFormError('Points must be zero or greater.')
        return
      }

      if (!Number.isFinite(parsedAllowance) || parsedAllowance < 0) {
        setFormError('Allowance must be zero or greater.')
        return
      }

      if (!householdId) {
        setFormError('Household not loaded yet.')
        return
      }

      setSubmitting(true)

      const { data: childProfiles, error: childProfilesError } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('household_id', householdId)
        .in('name', ['Davina', 'Ronin'])
        .eq('active', true)

      if (childProfilesError || !childProfiles) {
        console.error('Could not load child profiles:', childProfilesError)
        setFormError('Could not load child profiles.')
        setSubmitting(false)
        return
      }

      const profileIdMap = Object.fromEntries(
        (childProfiles || []).map((profile) => [profile.name, profile.id])
      )

      const selectedProfileIds = choreForm.assignedTo
        .map((name) => profileIdMap[name])
        .filter(Boolean)

      if (selectedProfileIds.length !== choreForm.assignedTo.length) {
        setFormError('One or more selected children could not be found.')
        setSubmitting(false)
        return
      }

      const chorePayload = {
        title: trimmedTitle,
        points: parsedPoints,
        allowance_cents: Math.round(parsedAllowance * 100),
        days: choreForm.days,
        household_id: householdId,
      }

      let choreId = editingChoreId

      try {
        if (editingChoreId) {
          const { error: updateChoreError } = await supabase
            .from('chores')
            .update({
              ...chorePayload,
            })
            .eq('id', editingChoreId)
            .eq('household_id', householdId)

          if (updateChoreError) {
            throw updateChoreError
          }

          const { error: deleteAssignmentsError } = await supabase
            .from('chore_assignments')
            .delete()
            .eq('chore_id', editingChoreId)
            .eq('household_id', householdId)

          if (deleteAssignmentsError) {
            throw deleteAssignmentsError
          }
        } else {
          const { data: insertedChore, error: insertChoreError } = await supabase
            .from('chores')
            .insert({
              ...chorePayload,
              active: true,
            })
            .select('id')
            .single()

          if (insertChoreError || !insertedChore) {
            throw insertChoreError || new Error('Could not save chore.')
          }

          choreId = insertedChore.id
        }

        const { error: insertAssignmentsError } = await supabase
          .from('chore_assignments')
          .insert(
            selectedProfileIds.map((profileId) => ({
              household_id: householdId,
              chore_id: choreId,
              profile_id: profileId,
            }))
          )

        if (insertAssignmentsError) {
          throw insertAssignmentsError
        }

        setFormMessage(editingChoreId ? 'Chore updated.' : 'Chore added.')
        setEditingChoreId(null)
        setChoreForm(emptyChoreForm())
        await refreshChores()
      } catch (error) {
        console.error('Could not save chore:', error)
        setFormError('Could not save chore. Please try again.')
      } finally {
        setSubmitting(false)
      }
    }

    // Get chores for each day in week
    const getChoresForDate = (date) => {
      const dayName = getDayName(date)
      return activeChores.filter((chore) => chore.days.includes(dayName))
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
        activeChores.forEach((chore) => {
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

            {isParent && (
              <div className="card manage-chores">
                <div className="section-heading manage-header">
                  <div>
                    <p className="eyebrow">Parent tools</p>
                    <h3>Manage Chores</h3>
                  </div>
                  <button
                    className="action-button secondary"
                    onClick={resetChoreForm}
                    type="button"
                  >
                    {editingChoreId ? 'Cancel edit' : 'Add chore'}
                  </button>
                </div>

                <form onSubmit={handleSaveChore} className="manage-chores-form">
                  <div className="form-grid">
                    <label>
                      Chore name
                      <input
                        type="text"
                        value={choreForm.title}
                        onChange={(event) => {
                          setChoreForm((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                          setFormError('')
                        }}
                        placeholder="Example: Put toys away"
                      />
                    </label>

                    <div className="checkbox-group">
                      <span>Assign to</span>
                      {['Davina', 'Ronin'].map((childName) => (
                        <label key={childName} className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={choreForm.assignedTo.includes(childName)}
                            onChange={() => toggleAssignment(childName)}
                          />
                          {childName === 'Davina' ? '👧' : '👦'} {childName}
                        </label>
                      ))}
                    </div>

                    <div className="checkbox-group">
                      <span>Days</span>
                      {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((dayName) => (
                        <label key={dayName} className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={choreForm.days.includes(dayName)}
                            onChange={() => toggleDay(dayName)}
                          />
                          {dayName.slice(0, 3)}
                        </label>
                      ))}
                    </div>

                    <label>
                      Points
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={choreForm.points}
                        onChange={(event) => {
                          setChoreForm((current) => ({
                            ...current,
                            points: Number(event.target.value) || 0,
                          }))
                          setFormError('')
                        }}
                      />
                    </label>

                    <label>
                      Allowance
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={choreForm.allowance}
                        onChange={(event) => {
                          setChoreForm((current) => ({
                            ...current,
                            allowance: Number(event.target.value) || 0,
                          }))
                          setFormError('')
                        }}
                      />
                    </label>
                  </div>

                  {formError && <p className="form-message error">{formError}</p>}
                  {formMessage && <p className="form-message success">{formMessage}</p>}

                  <div className="manage-form-actions">
                    <button className="action-button" type="submit" disabled={submitting}>
                      {submitting ? 'Saving…' : editingChoreId ? 'Save chore' : 'Add chore'}
                    </button>
                  </div>
                </form>

                <div className="manage-list">
                  {choreListForManagement.length === 0 ? (
                    <p>No chores yet.</p>
                  ) : (
                    choreListForManagement.map((chore) => (
                      <div key={chore.id} className={`manage-row ${chore.active === false ? 'inactive' : ''}`}>
                        <div>
                          <strong>{chore.title}</strong>
                          <p>
                            {chore.assignedTo.length > 0 ? chore.assignedTo.join(', ') : 'No child assigned'}
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
                        </div>
                        <div className="manage-actions">
                          <button
                            className="action-button secondary"
                            type="button"
                            onClick={() => editChore(chore)}
                          >
                            Edit
                          </button>
                          <button
                            className="action-button secondary"
                            type="button"
                            onClick={() => handleToggleChoreActive(chore)}
                          >
                            {chore.active === false ? 'Enable' : 'Disable'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

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
function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [signingIn, setSigningIn] = useState(false)

  async function handleLogin(event) {
    event.preventDefault()
    setMessage('')
    setSigningIn(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
    }

    setSigningIn(false)
  }

  return (
    <div className="app-shell">
      <main>
        <section className="page">
          <div className="card">
            <p className="eyebrow">Welcome home</p>
            <h1>The Burgess Family App</h1>
            <p>Sign in with your parent account.</p>

            <form onSubmit={handleLogin}>
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>

              <button
                className="action-button"
                type="submit"
                disabled={signingIn}
              >
                {signingIn ? 'Signing in…' : 'Sign In'}
              </button>

              {message && <p>{message}</p>}
            </form>
          </div>
        </section>
      </main>
    </div>
  )
}
function Card({ title, icon, children, onClick }) {
  function handleKeyDown(event) {
    if (!onClick) return

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <article
      className={onClick ? 'card clickable-card' : 'card'}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
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