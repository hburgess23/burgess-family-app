import React, { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

export default function Rewards({ householdId, activeUser }) {
  const [rewards, setRewards] = useState([])
  const [profiles, setProfiles] = useState([])
  const [balances, setBalances] = useState({})
  const [redemptions, setRedemptions] = useState([])
  const [loading, setLoading] = useState(true)

  const [editingId, setEditingId] = useState(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [pointsCost, setPointsCost] = useState(10)

  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [redeemingId, setRedeemingId] = useState(null)

  const isParent = activeUser.role === 'Parent'

  async function loadRewardsData() {
    if (!householdId) return

    setLoading(true)

    const [
      rewardsResult,
      profilesResult,
      adjustmentsResult,
      completionsResult,
      redemptionsResult,
    ] = await Promise.all([
      supabase
        .from('rewards')
        .select('id, name, description, points_cost, active, created_at')
        .eq('household_id', householdId)
        .order('created_at', { ascending: true }),

      supabase
        .from('profiles')
        .select('id, name, role, emoji')
        .eq('household_id', householdId)
        .eq('active', true),

      supabase
        .from('reward_adjustments')
        .select('profile_id, points_delta')
        .eq('household_id', householdId),

      supabase
        .from('chore_completions')
        .select('profile_id, points_awarded')
        .eq('household_id', householdId),

      supabase
        .from('reward_redemptions')
        .select('id, profile_id, reward_name, points_spent, redeemed_at')
        .eq('household_id', householdId)
        .order('redeemed_at', { ascending: false }),
    ])

    const firstError =
      rewardsResult.error ||
      profilesResult.error ||
      adjustmentsResult.error ||
      completionsResult.error ||
      redemptionsResult.error

    if (firstError) {
      console.error('Could not load rewards:', firstError)
      setErrorMessage('Could not load rewards.')
      setLoading(false)
      return
    }

    const nextBalances = {}

    ;(profilesResult.data || [])
      .filter((profile) => profile.role === 'Child')
      .forEach((profile) => {
        nextBalances[profile.id] = 0
      })

    ;(adjustmentsResult.data || []).forEach((row) => {
      if (nextBalances[row.profile_id] === undefined) return
      nextBalances[row.profile_id] += row.points_delta || 0
    })

    ;(completionsResult.data || []).forEach((row) => {
      if (nextBalances[row.profile_id] === undefined) return
      nextBalances[row.profile_id] += row.points_awarded || 0
    })

    setRewards(rewardsResult.data || [])
    setProfiles(profilesResult.data || [])
    setBalances(nextBalances)
    setRedemptions(redemptionsResult.data || [])
    setErrorMessage('')
    setLoading(false)
  }

  useEffect(() => {
    loadRewardsData()
  }, [householdId])

  function resetForm() {
    setEditingId(null)
    setName('')
    setDescription('')
    setPointsCost(10)
    setMessage('')
    setErrorMessage('')
  }

  function editReward(reward) {
    setEditingId(reward.id)
    setName(reward.name)
    setDescription(reward.description || '')
    setPointsCost(reward.points_cost)
    setMessage('')
    setErrorMessage('')
  }

  async function saveReward(event) {
    event.preventDefault()

    const cleanName = name.trim()
    const cost = Number(pointsCost)

    if (!cleanName) {
      setErrorMessage('Enter a reward name.')
      return
    }

    if (!Number.isInteger(cost) || cost < 0) {
      setErrorMessage('Points must be zero or greater.')
      return
    }

    setSaving(true)
    setMessage('')
    setErrorMessage('')

    let error

    if (editingId) {
      ;({ error } = await supabase
        .from('rewards')
        .update({
          name: cleanName,
          description: description.trim() || null,
          points_cost: cost,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId)
        .eq('household_id', householdId))
    } else {
      ;({ error } = await supabase
        .from('rewards')
        .insert({
          household_id: householdId,
          name: cleanName,
          description: description.trim() || null,
          points_cost: cost,
          active: true,
        }))
    }

    setSaving(false)

    if (error) {
      console.error('Could not save reward:', error)
      setErrorMessage('Could not save this reward.')
      return
    }

    setMessage(editingId ? 'Reward updated.' : 'Reward added.')
    setEditingId(null)
    setName('')
    setDescription('')
    setPointsCost(10)

    await loadRewardsData()
  }

  async function toggleReward(reward) {
    if (!isParent) return

    const { error } = await supabase
      .from('rewards')
      .update({
        active: reward.active === false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reward.id)
      .eq('household_id', householdId)

    if (error) {
      setErrorMessage('Could not update this reward.')
      return
    }

    await loadRewardsData()
  }

  async function redeemReward(reward) {
    if (activeUser.role !== 'Child') return

    const profile = profiles.find(
      (item) => item.name === activeUser.name && item.role === 'Child'
    )

    if (!profile) {
      setErrorMessage('Child profile could not be found.')
      return
    }

    setRedeemingId(reward.id)
    setMessage('')
    setErrorMessage('')

    const { data, error } = await supabase.rpc('redeem_reward', {
      target_household: householdId,
      target_profile: profile.id,
      target_reward: reward.id,
    })

    setRedeemingId(null)

    if (error) {
      console.error('Could not redeem reward:', error)

      if (error.message?.includes('Not enough points')) {
        setErrorMessage('Not enough points for this reward.')
      } else {
        setErrorMessage('Could not redeem this reward.')
      }

      return
    }

    setMessage(
      `${data.reward_name} redeemed! ⭐ ${data.points_remaining} points remaining.`
    )

    await loadRewardsData()
  }

  const childProfiles = profiles.filter(
    (profile) => profile.role === 'Child'
  )

  const activeChildProfile = childProfiles.find(
    (profile) => profile.name === activeUser.name
  )

  const activeChildPoints = activeChildProfile
    ? balances[activeChildProfile.id] || 0
    : 0

  const visibleRewards = isParent
    ? rewards
    : rewards.filter((reward) => reward.active !== false)

  return (
    <section className="rewards-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Rewards</p>
          <h2>Family Reward Shop</h2>
        </div>

        {!isParent && (
          <div className="points-pill">
            ⭐ {activeUser.name}: {activeChildPoints}
          </div>
        )}
      </div>

      {message && (
        <p className="form-message success">{message}</p>
      )}

      {errorMessage && (
        <p className="form-message error">{errorMessage}</p>
      )}

      {loading ? (
        <div className="card">
          <p>Loading rewards…</p>
        </div>
      ) : (
        <>
          {isParent && (
            <div className="card reward-manager">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Parent tools</p>
                  <h3>{editingId ? 'Edit Reward' : 'Add Reward'}</h3>
                </div>

                {editingId && (
                  <button
                    className="action-button secondary"
                    type="button"
                    onClick={resetForm}
                  >
                    Cancel
                  </button>
                )}
              </div>

              <form className="reward-form" onSubmit={saveReward}>
                <label>
                  Reward
                  <input
                    type="text"
                    value={name}
                    placeholder="Example: Movie night"
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>

                <label>
                  Description
                  <input
                    type="text"
                    value={description}
                    placeholder="Optional"
                    onChange={(event) =>
                      setDescription(event.target.value)
                    }
                  />
                </label>

                <label>
                  Point cost
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={pointsCost}
                    onChange={(event) =>
                      setPointsCost(Number(event.target.value) || 0)
                    }
                  />
                </label>

                <button
                  className="action-button"
                  type="submit"
                  disabled={saving}
                >
                  {saving
                    ? 'Saving…'
                    : editingId
                      ? 'Save Reward'
                      : 'Add Reward'}
                </button>
              </form>
            </div>
          )}

          <div className="reward-grid">
            {visibleRewards.length === 0 ? (
              <div className="card">
                <p>No rewards available yet.</p>
              </div>
            ) : (
              visibleRewards.map((reward) => (
                <article
                  className={
                    reward.active === false
                      ? 'card reward-card inactive'
                      : 'card reward-card'
                  }
                  key={reward.id}
                >
                  <div className="reward-icon">🎁</div>

                  <h3>{reward.name}</h3>

                  {reward.description && (
                    <p>{reward.description}</p>
                  )}

                  <div className="reward-cost">
                    ⭐ {reward.points_cost} points
                  </div>

                  {isParent ? (
                    <div className="reward-actions">
                      <button
                        className="action-button secondary"
                        type="button"
                        onClick={() => editReward(reward)}
                      >
                        Edit
                      </button>

                      <button
                        className="action-button secondary"
                        type="button"
                        onClick={() => toggleReward(reward)}
                      >
                        {reward.active === false ? 'Enable' : 'Disable'}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="action-button"
                      type="button"
                      disabled={
                        redeemingId === reward.id ||
                        activeChildPoints < reward.points_cost
                      }
                      onClick={() => redeemReward(reward)}
                    >
                      {redeemingId === reward.id
                        ? 'Redeeming…'
                        : activeChildPoints < reward.points_cost
                          ? 'Not enough points'
                          : 'Redeem'}
                    </button>
                  )}
                </article>
              ))
            )}
          </div>

          {isParent && (
            <div className="card reward-history">
              <h3>Redemption History</h3>

              {redemptions.length === 0 ? (
                <p>No rewards redeemed yet.</p>
              ) : (
                redemptions.map((redemption) => {
                  const profile = profiles.find(
                    (item) => item.id === redemption.profile_id
                  )

                  return (
                    <div
                      className="reward-history-row"
                      key={redemption.id}
                    >
                      <div>
                        <strong>
                          {profile?.emoji} {profile?.name || 'Child'}
                        </strong>
                        <span>{redemption.reward_name}</span>
                      </div>

                      <div>
                        ⭐ -{redemption.points_spent}
                        <small>
                          {new Date(
                            redemption.redeemed_at
                          ).toLocaleString()}
                        </small>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}