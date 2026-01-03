import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import type { Agent, CreateAgentRequest } from '@/api/types'
import { getAgents, createAgent, updateAgent } from '@/api/endpoints'
import { useToast } from '@/components/ToastContext'
import { Button } from '@/components/Button'
import { FormField } from '@/components/FormField'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Modal } from '@/components/Modal'
import { AgentCard } from '@/components/AgentCard'
import { isRequired, getRequiredError, validateProviders } from '@/utils/validation'

export function Agents() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { showToast } = useToast()

  // Form state
  const [formData, setFormData] = useState<CreateAgentRequest>({
    name: '',
    primaryProvider: 'vendorA',
    fallbackProvider: 'none',
    systemPrompt: '',
    enabledTools: [],
  })
  const [toolsInput, setToolsInput] = useState('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Load agents on mount
  useEffect(() => {
    loadAgents()
  }, [])

  // Update form when agent is selected
  useEffect(() => {
    if (selectedAgent) {
      setFormData({
        name: selectedAgent.name,
        primaryProvider: selectedAgent.primaryProvider,
        fallbackProvider: selectedAgent.fallbackProvider || 'none',
        systemPrompt: selectedAgent.systemPrompt,
        enabledTools: selectedAgent.enabledTools || [],
      })
      setToolsInput((selectedAgent.enabledTools || []).join(', '))
    } else {
      resetForm()
    }
  }, [selectedAgent])

  const loadAgents = async () => {
    setIsLoading(true)
    try {
      const response = await getAgents()
      if (response.data) {
        setAgents(response.data)
      } else if (response.error) {
        showToast(response.error.message || 'Failed to load agents', 'error')
        setAgents([])
      }
    } catch (err) {
      showToast('Failed to load agents', 'error')
      setAgents([])
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      primaryProvider: 'vendorA',
      fallbackProvider: 'none',
      systemPrompt: '',
      enabledTools: [],
    })
    setToolsInput('')
    setFormErrors({})
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const handleToolsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setToolsInput(value)
    // Parse comma-separated tools
    const tools = value
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
    setFormData((prev) => ({ ...prev, enabledTools: tools }))
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!isRequired(formData.name)) {
      errors.name = getRequiredError('Name')
    }

    const providerValidation = validateProviders(
      formData.primaryProvider,
      formData.fallbackProvider
    )
    if (!providerValidation.valid && providerValidation.error) {
      errors.fallbackProvider = providerValidation.error
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validateForm()) {
      return
    }

    setIsSaving(true)

    try {
      // Prepare payload - convert 'none' to null for fallbackProvider
      const payload: CreateAgentRequest = {
        ...formData,
        fallbackProvider: formData.fallbackProvider === 'none' ? null : formData.fallbackProvider,
      }

      if (selectedAgent) {
        // Update existing agent
        const response = await updateAgent(selectedAgent.id, payload)
        if (response.data) {
          showToast('Agent updated successfully', 'success')
          await loadAgents()
          setIsModalOpen(false)
          setSelectedAgent(null)
        } else if (response.error) {
          showToast(response.error.message || 'Failed to update agent', 'error')
        }
      } else {
        // Create new agent
        const response = await createAgent(payload)
        if (response.data) {
          showToast('Agent created successfully', 'success')
          await loadAgents()
          setIsModalOpen(false)
          setSelectedAgent(null)
        } else if (response.error) {
          showToast(response.error.message || 'Failed to create agent', 'error')
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      showToast(errorMessage, 'error')
      console.error('Error saving agent:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setIsModalOpen(false)
    setSelectedAgent(null)
    resetForm()
  }

  const handleCreateNew = () => {
    setSelectedAgent(null)
    resetForm()
    setIsModalOpen(true)
  }

  const handleEdit = (agent: Agent) => {
    setSelectedAgent(agent)
    setIsModalOpen(true)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
        <h2 style={{ margin: 0, fontFamily: 'inherit' }}>Agents</h2>
        <Button variant="primary" onClick={handleCreateNew}>
          + New Agent
        </Button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          <LoadingSpinner />
        </div>
      ) : agents.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          No agents yet. Create one.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 'var(--spacing-lg)',
          }}
        >
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onEdit={handleEdit} />
          ))}
        </div>
      )}

      {/* Agent Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCancel}
        title={selectedAgent ? 'Edit Agent' : 'Create New Agent'}
      >
        <form onSubmit={handleSubmit}>
          <FormField
            label="Name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            error={formErrors.name}
            required
          />

          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <label htmlFor="primaryProvider" className="label">
              Primary Provider <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <select
              id="primaryProvider"
              name="primaryProvider"
              value={formData.primaryProvider}
              onChange={handleInputChange}
              className="input"
              required
            >
              <option value="vendorA">Vendor A</option>
              <option value="vendorB">Vendor B</option>
            </select>
          </div>

          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <label htmlFor="fallbackProvider" className="label">
              Fallback Provider
            </label>
            <select
              id="fallbackProvider"
              name="fallbackProvider"
              value={formData.fallbackProvider}
              onChange={handleInputChange}
              className="input"
            >
              <option value="none">None</option>
              <option value="vendorA">Vendor A</option>
              <option value="vendorB">Vendor B</option>
            </select>
            {formErrors.fallbackProvider && (
              <div className="error-message">{formErrors.fallbackProvider}</div>
            )}
            {formData.fallbackProvider !== 'none' &&
              formData.fallbackProvider === formData.primaryProvider && (
                <div
                  className="error-message"
                  style={{ color: 'var(--color-warning)', marginTop: 'var(--spacing-xs)' }}
                >
                  Warning: Fallback provider should be different from primary provider
                </div>
              )}
          </div>

          <FormField
            label="System Prompt"
            name="systemPrompt"
            value={formData.systemPrompt}
            onChange={handleInputChange}
            textarea
            rows={6}
          />

          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <label htmlFor="enabledTools" className="label">
              Enabled Tools (comma-separated)
            </label>
            <input
              id="enabledTools"
              name="enabledTools"
              type="text"
              value={toolsInput}
              onChange={handleToolsInputChange}
              className="input"
              placeholder="tool1, tool2, tool3"
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)' }}>
              {formData.enabledTools.length} tool(s) configured
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isSaving}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
