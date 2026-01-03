/**
 * Voice Recorder Component
 * Handles voice message recording and upload
 */

import { useState, useRef } from 'react'
import { sendVoiceMessage } from '@/api/endpoints'
import type { VoiceMessageResponse } from '@/api/types'

export interface VoiceRecorderProps {
  sessionId?: string
  onVoiceMessageSent: (response: VoiceMessageResponse) => void
  onError: (error: string) => void
  onRecordingStart?: () => Promise<string | null>
  disabled?: boolean
}

type RecordingState = 'idle' | 'recording' | 'uploading' | 'error'

export function VoiceRecorder({ sessionId, onVoiceMessageSent, onError, onRecordingStart, disabled }: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle')
  const [recordingTime, setRecordingTime] = useState(0)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(sessionId || null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const recordingStartTimeRef = useRef<number | null>(null)

  const startRecording = async () => {
    try {
      // Get or create session if needed
      let currentSessionId = sessionId || activeSessionId
      if (!currentSessionId && onRecordingStart) {
        currentSessionId = await onRecordingStart()
        if (!currentSessionId) {
          setState('error')
          setTimeout(() => setState('idle'), 2000)
          return
        }
        setActiveSessionId(currentSessionId)
      }

      if (!currentSessionId) {
        onError('No session available. Please try again.')
        setState('error')
        setTimeout(() => setState('idle'), 2000)
        return
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      })

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      // Collect audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      // Handle recording stop
      mediaRecorder.onstop = async () => {
        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop())

        // Clear timer
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }

        // Calculate actual recording duration
        const durationMs = recordingStartTimeRef.current
          ? Date.now() - recordingStartTimeRef.current
          : recordingTime * 1000

        // Create blob from chunks
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })

        // Upload to backend (use current session ID)
        setState('uploading')
        const response = await sendVoiceMessage(currentSessionId!, audioBlob, durationMs)

        if (response.error) {
          setState('error')
          const errorMessage = (response.error as { message?: string })?.message || 'Failed to send voice message'
          onError(errorMessage)
          setTimeout(() => setState('idle'), 2000)
        } else if (response.data) {
          setState('idle')
          setRecordingTime(0)
          onVoiceMessageSent(response.data)
        }
      }

      // Start recording
      mediaRecorder.start()
      setState('recording')
      setRecordingTime(0)
      recordingStartTimeRef.current = Date.now()

      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (error) {
      setState('error')
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          onError('Microphone access denied. Please allow microphone access to use voice messages.')
        } else if (error.name === 'NotFoundError') {
          onError('No microphone found. Please connect a microphone to use voice messages.')
        } else {
          onError(`Failed to start recording: ${error.message}`)
        }
      } else {
        onError('Failed to start recording')
      }
      setTimeout(() => setState('idle'), 2000)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const isDisabled = disabled || state === 'uploading' || state === 'error'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
      {state === 'idle' && (
        <button
          onClick={startRecording}
          disabled={isDisabled}
          title="Record voice message"
          style={{
            padding: 'var(--spacing-sm)',
            border: 'none',
            borderRadius: '0.5rem',
            backgroundColor: 'transparent',
            color: 'var(--color-text-secondary)',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            opacity: isDisabled ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <i className="fa-solid fa-microphone" style={{ fontSize: '0.875rem' }} />
        </button>
      )}

      {state === 'recording' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <button
            onClick={stopRecording}
            title="Stop recording"
            style={{
              padding: 'var(--spacing-sm)',
              border: 'none',
              borderRadius: '0.5rem',
              backgroundColor: 'transparent',
              color: '#ef4444',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <i className="fa-solid fa-stop" style={{ fontSize: '0.875rem' }} />
          </button>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
              fontSize: '0.875rem',
              color: 'var(--color-text-secondary)',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
            <span>{formatTime(recordingTime)}</span>
          </div>
        </div>
      )}

      {state === 'uploading' && (
        <div
          style={{
            padding: 'var(--spacing-md)',
            fontSize: '0.875rem',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)',
          }}
        >
          <div className="loading-spinner" />
          <span>Sending...</span>
        </div>
      )}

      {state === 'error' && (
        <div
          style={{
            padding: 'var(--spacing-md)',
            fontSize: '0.875rem',
            color: 'var(--color-error)',
          }}
        >
          Error
        </div>
      )}

      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.3;
            }
          }
        `}
      </style>
    </div>
  )
}
