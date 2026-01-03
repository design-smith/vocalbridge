import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Agent, Session, MessageResponse, VoiceMessageResponse } from '@/api/types'
import { getAgents, createSession, sendMessage } from '@/api/endpoints'
import { useToast } from '@/components/ToastContext'
import { Button } from '@/components/Button'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { VoiceRecorder } from '@/components/VoiceRecorder'
import { formatTokens, formatCurrency, formatLatency } from '@/utils/format'
import { formatDateTime } from '@/utils/date'
import { generateIdempotencyKey } from '@/utils/id'

export function TryIt() {
  const [searchParams] = useSearchParams()
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const [customerId, setCustomerId] = useState<string>('customer_123')
  const [session, setSession] = useState<Session | null>(null)
  const [messages, setMessages] = useState<MessageResponse[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [isLoadingAgents, setIsLoadingAgents] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [useIdempotencyKey, setUseIdempotencyKey] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState(generateIdempotencyKey())
  const { showToast } = useToast()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load agents on mount
  useEffect(() => {
    loadAgents()
  }, [])

  // Set agent from URL query parameter
  useEffect(() => {
    const agentIdFromUrl = searchParams.get('agentId')
    if (agentIdFromUrl && agents.length > 0) {
      // Check if the agent exists in the loaded agents
      const agentExists = agents.some((agent) => agent.id === agentIdFromUrl)
      if (agentExists) {
        setSelectedAgentId(agentIdFromUrl)
      }
    }
  }, [searchParams, agents])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Update idempotency key when checkbox is toggled
  useEffect(() => {
    if (useIdempotencyKey) {
      setIdempotencyKey(generateIdempotencyKey())
    }
  }, [useIdempotencyKey])

  const loadAgents = async () => {
    setIsLoadingAgents(true)
    try {
      const response = await getAgents()
      if (response.data) {
        setAgents(response.data)
        // Only auto-select first agent if no agentId in URL and no agent currently selected
        const agentIdFromUrl = searchParams.get('agentId')
        if (response.data.length > 0 && !selectedAgentId && !agentIdFromUrl) {
          setSelectedAgentId(response.data[0].id)
        }
      } else if (response.error) {
        showToast((response.error as { message?: string })?.message || 'Failed to load agents', 'error')
        setAgents([])
      }
    } catch (err) {
      showToast('Failed to load agents', 'error')
      setAgents([])
    } finally {
      setIsLoadingAgents(false)
    }
  }

  const ensureSession = async (): Promise<Session | null> => {
    if (session) return session

    if (!selectedAgentId) return null

    try {
      const sessionResponse = await createSession({
        agentId: selectedAgentId,
        customerId: customerId.trim() || 'customer_123',
        metadata: { channel: 'chat' },
      })

      if (sessionResponse.data) {
        setSession(sessionResponse.data)
        setMessages([])
        return sessionResponse.data
      } else {
        if (sessionResponse.error) {
          showToast((sessionResponse.error as { message?: string })?.message || 'Failed to start session', 'error')
        }
        return null
      }
    } catch (err) {
      showToast('Failed to start session', 'error')
      return null
    }
  }

  const handleVoiceMessageSent = async (voiceResponse: VoiceMessageResponse) => {
    // Add user message with transcript
    const userMessage: MessageResponse = {
      id: `user-voice-${Date.now()}`,
      role: 'user',
      content: voiceResponse.transcriptText,
      createdAt: new Date().toISOString(),
    }

    // Add assistant response
    const assistantMessage: MessageResponse = {
      id: voiceResponse.assistant.id,
      role: 'assistant',
      content: voiceResponse.assistant.content,
      createdAt: voiceResponse.assistant.createdAt,
      providerUsed: voiceResponse.metadata.providerUsed,
      tokensIn: voiceResponse.metadata.usage.tokensIn,
      tokensOut: voiceResponse.metadata.usage.tokensOut,
      costUsd: voiceResponse.metadata.usage.costUsd,
      latencyMs: voiceResponse.metadata.attempts[0]?.latencyMs,
      fallbackUsed: voiceResponse.metadata.fallbackUsed,
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])

    // Play audio response
    try {
      const audioData = `data:${voiceResponse.audio.mimeType};base64,${voiceResponse.audio.base64}`
      const audio = new Audio(audioData)
      audio.play().catch((err) => {
        console.error('Failed to play audio:', err)
      })
    } catch (err) {
      console.error('Failed to create audio:', err)
    }
  }

  const handleVoiceRecordingStart = async () => {
    // Ensure session exists before starting recording
    const currentSession = await ensureSession()
    if (!currentSession) {
      showToast('Failed to create session. Please select an agent.', 'error')
      return null
    }
    return currentSession.id
  }

  const handleVoiceError = (error: string) => {
    showToast(error, 'error')
  }

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault()
    if (!messageInput.trim() || !selectedAgentId) return

    const content = messageInput.trim()
    setMessageInput('')
    setIsSending(true)

    // If no session exists, create one first
    const currentSession = await ensureSession()
    if (!currentSession) {
      setIsSending(false)
      return
    }

    // Add user message to UI immediately
    const userMessage: MessageResponse = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage])

    try {
      const response = await sendMessage(
        currentSession.id,
        {
          role: 'user',
          content,
        },
        useIdempotencyKey ? idempotencyKey : undefined
      )

      if (response.data) {
        // Keep user message and add assistant response
        setMessages((prev) => {
          // Replace temp user message with a permanent one, then add assistant response
          const filtered = prev.filter((m) => m.id !== userMessage.id)
          const permanentUserMessage: MessageResponse = {
            ...userMessage,
            id: `user-${Date.now()}`, // Use a permanent ID
          }
          return [...filtered, permanentUserMessage, response.data!]
        })
        // Regenerate idempotency key for next message
        if (useIdempotencyKey) {
          setIdempotencyKey(generateIdempotencyKey())
        }
      } else {
        // Remove temp message on error
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id))
        if (response.error) {
          showToast((response.error as { message?: string })?.message || 'Failed to send message', 'error')
        }
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id))
      showToast('Failed to send message', 'error')
    } finally {
      setIsSending(false)
    }
  }


  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: 'var(--spacing-lg)', fontFamily: 'inherit' }}>Try It</h2>


      {/* Top Row: Agent, Customer ID, and Chat Input */}
      <div style={{ marginBottom: 'var(--spacing-lg)', display: 'flex', gap: 'var(--spacing-md)', alignItems: 'end', justifyContent: 'center' }}>
          <div style={{ width: '200px' }}>
            <label className="label">Agent</label>
            {isLoadingAgents ? (
              <LoadingSpinner />
            ) : (
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-md)',
                    paddingRight: 'calc(var(--spacing-md) + 40px)',
                    border: 'none',
                    borderRadius: '0.75rem',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    backgroundColor: '#f9fafb',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    outline: 'none',
                  }}
                >
                  <option value="">Select Agent</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
                <div
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.75rem', color: '#000000' }} />
                </div>
              </div>
            )}
          </div>

          <div style={{ width: '200px' }}>
            <label className="label">Customer ID</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="Customer"
                style={{
                  width: '100%',
                  padding: 'var(--spacing-md)',
                  paddingRight: 'calc(var(--spacing-md) + 40px)',
                  border: 'none',
                  borderRadius: '0.75rem',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  backgroundColor: '#f9fafb',
                  color: 'var(--color-text)',
                  outline: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <i className="fa-solid fa-search" style={{ fontSize: '0.75rem', color: '#000000' }} />
              </div>
            </div>
          </div>
        </div>

      {/* Chat Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: session ? '2fr 1fr' : '1fr', gap: 'var(--spacing-lg)', height: '600px', maxHeight: '600px', overflow: 'hidden' }}>
        {/* Chat Messages Area */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '100%', overflow: 'hidden' }}>
          <div
            style={{
              flex: '1 1 0',
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: 'var(--spacing-xl)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: messages.length === 0 ? 'center' : 'flex-start',
              gap: 'var(--spacing-md)',
              minHeight: 0, // Important for flex scrolling
            }}
          >
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text)', fontSize: '1.5rem', fontWeight: 600, fontFamily: 'inherit' }}>
                What can I help with ?
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    style={{
                      width: '100%',
                      maxWidth: '800px',
                      margin: '0 auto',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '70%',
                        padding: 'var(--spacing-md)',
                        borderRadius: 'var(--border-radius-lg)',
                        backgroundColor:
                          message.role === 'user' ? 'var(--color-primary)' : 'var(--color-surface)',
                        color: message.role === 'user' ? 'white' : 'var(--color-text)',
                      }}
                    >
                      <div style={{ whiteSpace: 'pre-wrap', marginBottom: 'var(--spacing-xs)' }}>
                        {message.content}
                      </div>
                      {message.role === 'assistant' && (
                        <div
                          style={{
                            fontSize: '0.75rem',
                            opacity: 0.8,
                            marginTop: 'var(--spacing-xs)',
                            paddingTop: 'var(--spacing-xs)',
                            borderTop: '1px solid rgba(0,0,0,0.1)',
                          }}
                        >
                          {message.providerUsed && <div>Provider: {message.providerUsed}</div>}
                          {message.tokensIn !== undefined && message.tokensOut !== undefined && (
                            <div>
                              Tokens: {formatTokens(message.tokensIn)} in / {formatTokens(message.tokensOut)} out
                            </div>
                          )}
                          {message.costUsd !== undefined && <div>Cost: {formatCurrency(message.costUsd)}</div>}
                          {message.latencyMs !== undefined && <div>Latency: {formatLatency(message.latencyMs)}</div>}
                          {message.fallbackUsed && <div style={{ color: 'var(--color-warning)' }}>Fallback used</div>}
                        </div>
                      )}
                      <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: 'var(--spacing-xs)' }}>
                        {formatDateTime(message.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Composer */}
          <div style={{ padding: 'var(--spacing-md)', maxWidth: '800px', width: '100%', margin: '0 auto', flexShrink: 0 }}>
            <form onSubmit={handleSendMessage}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                  padding: 'var(--spacing-md)',
                  border: 'none',
                  borderRadius: '0.75rem',
                  backgroundColor: '#f9fafb',
                }}
              >
                <button
                  type="button"
                  style={{
                    padding: 'var(--spacing-sm)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    backgroundColor: 'transparent',
                    color: 'var(--color-text-secondary)',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    // Attach functionality can be added later
                  }}
                >
                  <i className="fa-solid fa-paperclip" style={{ fontSize: '0.875rem' }} />
                </button>
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Ask anything"
                  disabled={isSending}
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    color: 'var(--color-text)',
                    backgroundColor: 'transparent',
                  }}
                />
                {messageInput.trim() ? (
                  <button
                    type="submit"
                    disabled={!messageInput.trim() || isSending || !selectedAgentId}
                    style={{
                      padding: 'var(--spacing-sm)',
                      border: 'none',
                      borderRadius: '0.5rem',
                      backgroundColor: 'transparent',
                      color: 'var(--color-text-secondary)',
                      fontSize: '0.875rem',
                      fontFamily: 'inherit',
                      fontWeight: 400,
                      cursor: !messageInput.trim() || isSending || !selectedAgentId ? 'not-allowed' : 'pointer',
                      opacity: !messageInput.trim() || isSending || !selectedAgentId ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <i className="fa-solid fa-paper-plane" style={{ fontSize: '0.875rem' }} />
                  </button>
                ) : (
                  <VoiceRecorder
                    sessionId={session?.id}
                    onVoiceMessageSent={handleVoiceMessageSent}
                    onError={handleVoiceError}
                    onRecordingStart={handleVoiceRecordingStart}
                    disabled={isSending || !selectedAgentId}
                  />
                )}
              </div>
              <div style={{ marginTop: 'var(--spacing-sm)', display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: '0.75rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={useIdempotencyKey}
                    onChange={(e) => setUseIdempotencyKey(e.target.checked)}
                  />
                  Use idempotency key
                </label>
                {useIdempotencyKey && (
                  <>
                    <input
                      type="text"
                      value={idempotencyKey}
                      onChange={(e) => setIdempotencyKey(e.target.value)}
                      style={{
                        flex: 1,
                        padding: 'var(--spacing-sm)',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        fontSize: '0.75rem',
                        fontFamily: 'inherit',
                        backgroundColor: 'white',
                      }}
                      placeholder="Idempotency Key"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setIdempotencyKey(generateIdempotencyKey())}
                      style={{ fontSize: '0.75rem', padding: 'var(--spacing-sm) var(--spacing-md)', whiteSpace: 'nowrap' }}
                    >
                      Regen
                    </Button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Right Panel - Session Info */}
        {session && (() => {
          const selectedAgent = agents.find((a) => a.id === selectedAgentId)
          return (
            <div style={{ backgroundColor: '#f9fafb', borderRadius: '0.75rem', padding: 'var(--spacing-lg)', height: 'fit-content' }}>
              <h3 style={{ margin: 0, marginBottom: 'var(--spacing-md)', fontSize: '1rem', fontFamily: 'inherit' }}>Session Info</h3>
              {selectedAgent && (
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                    Agent
                  </div>
                  <div style={{ fontWeight: 600 }}>{selectedAgent.name}</div>
                  <code style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{selectedAgent.id}</code>
                </div>
              )}
              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                  Session ID
                </div>
                <code style={{ fontSize: '0.75rem' }}>{session.id}</code>
              </div>
              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                  Customer ID
                </div>
                <div>{session.customerId}</div>
              </div>
              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                  Created
                </div>
                <div>{formatDateTime(session.createdAt)}</div>
              </div>
              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                  Messages
                </div>
                <div>{messages.length}</div>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
