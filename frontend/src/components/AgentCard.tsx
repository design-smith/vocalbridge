import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Agent } from '@/api/types'
import { Button } from './Button'
import { formatDateReadable } from '@/utils/date'
import { useToast } from './ToastContext'

interface AgentCardProps {
  agent: Agent
  onEdit: (agent: Agent) => void
}

export function AgentCard({ agent, onEdit }: AgentCardProps) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [isHoveringId, setIsHoveringId] = useState(false)

  const handleTryIt = () => {
    navigate(`/try?agentId=${encodeURIComponent(agent.id)}`)
  }

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(agent.id)
      showToast('Agent ID copied to clipboard', 'success')
    } catch (err) {
      showToast('Failed to copy Agent ID', 'error')
    }
  }

  // Format updated time (simplified - shows relative time or date)
  const formatUpdatedTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffHours < 1) {
      return 'Updated just now'
    } else if (diffHours < 24) {
      return `Updated ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    } else if (diffDays < 7) {
      return `Updated ${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    } else {
      return formatDateReadable(dateString)
    }
  }

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Top: Agent ID and Updated time */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--spacing-md)',
          fontSize: '0.75rem',
          color: 'var(--color-text-secondary)',
          fontFamily: 'inherit',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)',
            cursor: 'pointer',
            position: 'relative',
          }}
          onMouseEnter={() => setIsHoveringId(true)}
          onMouseLeave={() => setIsHoveringId(false)}
          onClick={handleCopyId}
          title={`Click to copy: ${agent.id}`}
        >
          <code
            style={{
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              color: 'var(--color-text-secondary)',
              maxWidth: '120px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {agent.id.length > 12 ? `${agent.id.substring(0, 12)}...` : agent.id}
          </code>
          {isHoveringId && (
            <i
              className="fa-solid fa-copy"
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-secondary)',
                opacity: 0.7,
              }}
            />
          )}
        </div>
        <span>{formatUpdatedTime(agent.updatedAt)}</span>
      </div>

      {/* Agent Name - Large Title */}
      <h3
        style={{
          margin: 0,
          marginBottom: 'var(--spacing-md)',
          fontSize: '1.5rem',
          fontWeight: 600,
          color: 'var(--color-text)',
          fontFamily: 'inherit',
          lineHeight: 1.2,
        }}
      >
        {agent.name}
      </h3>

      {/* Description (System Prompt) */}
      {agent.systemPrompt && (
        <div
          style={{
            marginBottom: 'var(--spacing-md)',
            fontSize: '0.875rem',
            color: 'var(--color-text-secondary)',
            fontFamily: 'inherit',
            fontStyle: 'italic',
            lineHeight: 1.5,
          }}
        >
          &ldquo;{agent.systemPrompt.length > 150 ? `${agent.systemPrompt.substring(0, 150)}...` : agent.systemPrompt}&rdquo;
        </div>
      )}

      {/* Tools, Primary, Fallback */}
      <div
        style={{
          marginBottom: 'var(--spacing-lg)',
          fontSize: '0.875rem',
          color: 'var(--color-text)',
          fontFamily: 'inherit',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-xs)',
        }}
      >
        <div>
          <strong>Tools:</strong>{' '}
          {agent.enabledTools.length > 0 ? agent.enabledTools.join(', ') : 'None'}
        </div>
        <div>
          <strong>Primary:</strong> {agent.primaryProvider === 'vendorA' ? 'Vendor A' : 'Vendor B'}
        </div>
        <div>
          <strong>Fallback:</strong>{' '}
          {agent.fallbackProvider === 'none' ? 'None' : agent.fallbackProvider === 'vendorA' ? 'Vendor A' : 'Vendor B'}
        </div>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--spacing-md)',
          marginTop: 'auto',
        }}
      >
        <Button
          variant="primary"
          onClick={handleTryIt}
          style={{
            flex: 1,
          }}
        >
          Try It
        </Button>
        <Button
          variant="secondary"
          onClick={() => onEdit(agent)}
          style={{
            flex: 1,
            backgroundColor: '#f3f4f6',
            color: '#000000',
            borderRadius: '0.75rem',
          }}
        >
          Edit
        </Button>
      </div>
    </div>
  )
}
