import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'

export default function Messages({ householdId, activeUser }) {
  const [messages, setMessages] = useState([])
  const [profiles, setProfiles] = useState([])
  const [messageText, setMessageText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const profileMap = useMemo(
    () =>
      Object.fromEntries(
        profiles.map((profile) => [profile.id, profile])
      ),
    [profiles]
  )

  async function loadMessages() {
    if (!householdId) return

    const [
      profilesResult,
      messagesResult,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, name, emoji, role')
        .eq('household_id', householdId)
        .eq('active', true),

      supabase
        .from('family_messages')
        .select('id, sender_profile_id, message_text, created_at')
        .eq('household_id', householdId)
        .order('created_at', { ascending: true }),
    ])

    const firstError =
      profilesResult.error ||
      messagesResult.error

    if (firstError) {
      console.error('Could not load messages:', firstError)
      setErrorMessage('Could not load family messages.')
      setLoading(false)
      return
    }

    setProfiles(profilesResult.data || [])
    setMessages(messagesResult.data || [])
    setErrorMessage('')
    setLoading(false)
  }

  useEffect(() => {
    if (!householdId) return

    async function startMessages() {
      setLoading(true)

      const { error } = await supabase.rpc(
        'cleanup_old_family_messages',
        {
          target_household: householdId,
        }
      )

      if (error) {
        console.error('Could not clean old messages:', error)
      }

      await loadMessages()
    }

    startMessages()
  }, [householdId])

  async function sendMessage(event) {
    event.preventDefault()

    const cleanMessage = messageText.trim()

    if (!cleanMessage || !householdId) return

    const sender = profiles.find(
      (profile) => profile.name === activeUser.name
    )

    if (!sender) {
      setErrorMessage('Could not find the active family profile.')
      return
    }

    setSending(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('family_messages')
      .insert({
        household_id: householdId,
        sender_profile_id: sender.id,
        message_text: cleanMessage,
      })
      .select('id, sender_profile_id, message_text, created_at')
      .single()

    setSending(false)

    if (error) {
      console.error('Could not send message:', error)
      setErrorMessage('Could not send the message.')
      return
    }

    setMessages((current) => [...current, data])
    setMessageText('')
  }

  function formatMessageTime(value) {
    return new Date(value).toLocaleString([], {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <section className="messages-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Family chat</p>
          <h2>Messages</h2>
        </div>

        <div className="message-sender-pill">
          {activeUser.emoji} {activeUser.name}
        </div>
      </div>

      <div className="card messages-card">
        {errorMessage && (
          <p className="form-message error">{errorMessage}</p>
        )}

        {loading ? (
          <p>Loading messages…</p>
        ) : messages.length === 0 ? (
          <div className="messages-empty">
            <span>💬</span>
            <h3>Start the family chat</h3>
            <p>Messages automatically expire after 7 days.</p>
          </div>
        ) : (
          <div className="message-list">
            {messages.map((message) => {
              const sender = profileMap[message.sender_profile_id]
              const isCurrent =
                sender?.name === activeUser.name

              return (
                <div
                  className={
                    isCurrent
                      ? 'message-row own-message'
                      : 'message-row'
                  }
                  key={message.id}
                >
                  <div className="message-avatar">
                    {sender?.emoji || '👤'}
                  </div>

                  <div className="message-content">
                    <div className="message-meta">
                      <strong>
                        {sender?.name || 'Family'}
                      </strong>
                      <span>
                        {formatMessageTime(message.created_at)}
                      </span>
                    </div>

                    <div className="message-bubble">
                      {message.message_text}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <form className="message-compose" onSubmit={sendMessage}>
          <input
            type="text"
            value={messageText}
            maxLength="2000"
            placeholder={`Message as ${activeUser.name}…`}
            onChange={(event) =>
              setMessageText(event.target.value)
            }
          />

          <button
            className="action-button"
            type="submit"
            disabled={sending || !messageText.trim()}
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
      </div>
    </section>
  )
}