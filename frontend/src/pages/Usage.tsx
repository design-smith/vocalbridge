import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import type { UsageRollup, UsageEvent } from '@/api/types'
import { getUsageRollup, getUsageEvents } from '@/api/endpoints'
import { useToast } from '@/components/ToastContext'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Table } from '@/components/Table'
import { Button } from '@/components/Button'
import { SpendLimitGauge } from '@/components/SpendLimitGauge'
import { UsageByMonthChart } from '@/components/UsageByMonthChart'
import { getDateRange, formatDateReadable } from '@/utils/date'
import { formatCurrency, formatNumber, formatTokens } from '@/utils/format'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns'

type PeriodType = 'day' | 'week' | 'month' | 'year' | 'custom'

export function Usage() {
  const [period, setPeriod] = useState<PeriodType>('month')
  const { from: defaultFrom, to: defaultTo } = getDateRange(30)
  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate, setToDate] = useState(defaultTo)
  const [rollup, setRollup] = useState<UsageRollup | null>(null)
  const [events, setEvents] = useState<UsageEvent[]>([])
  const [allTimeTotalCost, setAllTimeTotalCost] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)
  const [showEvents, setShowEvents] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    loadUsage()
    loadAllTimeTotal()
  }, [])

  // Update date range when period changes
  useEffect(() => {
    if (period === 'custom') {
      // Don't auto-update for custom
      return
    }

    const now = new Date()
    let from: Date
    let to: Date = now

    switch (period) {
      case 'day':
        from = startOfDay(now)
        to = endOfDay(now)
        break
      case 'week':
        from = startOfWeek(now, { weekStartsOn: 1 })
        to = endOfWeek(now, { weekStartsOn: 1 })
        break
      case 'month':
        from = startOfMonth(now)
        to = endOfMonth(now)
        break
      case 'year':
        from = startOfYear(now)
        to = endOfYear(now)
        break
      default:
        return
    }

    setFromDate(format(from, 'yyyy-MM-dd'))
    setToDate(format(to, 'yyyy-MM-dd'))
  }, [period])

  const loadUsage = async () => {
    setIsLoading(true)

    try {
      const [rollupResponse, eventsResponse] = await Promise.all([
        getUsageRollup(fromDate, toDate),
        getUsageEvents(fromDate, toDate, 200),
      ])

      if (rollupResponse.data) {
        setRollup(rollupResponse.data)
      } else if (rollupResponse.error) {
        showToast(rollupResponse.error.message || 'Failed to load usage rollup', 'error')
        setRollup(null)
      }

      if (eventsResponse.data) {
        setEvents(eventsResponse.data)
      } else if (eventsResponse.error) {
        showToast(eventsResponse.error.message || 'Failed to load usage events', 'error')
        setEvents([])
      }
    } catch (err) {
      showToast('Failed to load usage data', 'error')
      setRollup(null)
      setEvents([])
    } finally {
      setIsLoading(false)
    }
  }

  const loadAllTimeTotal = async () => {
    // Fetch all-time usage (from a very early date to far future)
    const allTimeRollup = await getUsageRollup('2020-01-01', '2099-12-31')

    if (allTimeRollup.data) {
      setAllTimeTotalCost(allTimeRollup.data.totalCost)
    }
  }

  const handleApply = (e: FormEvent) => {
    e.preventDefault()
    loadUsage()
  }

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPeriod = e.target.value as PeriodType
    setPeriod(newPeriod)
    if (newPeriod !== 'custom') {
      // Date range will be updated by useEffect
      // Load usage after a brief delay to allow state update
      setTimeout(() => loadUsage(), 100)
    }
  }

  const handleExport = () => {
    if (!rollup) {
      showToast('No data to export', 'error')
      return
    }

    // Create CSV content
    const csvRows: string[] = []
    
    // Header
    csvRows.push('Usage Report')
    csvRows.push(`Period: ${fromDate} to ${toDate}`)
    csvRows.push('')

    // Summary
    const totalTokensIn = rollup.providerBreakdown.reduce((sum, p) => sum + p.tokensIn, 0)
    const totalTokensOut = rollup.providerBreakdown.reduce((sum, p) => sum + p.tokensOut, 0)
    csvRows.push('Summary')
    csvRows.push(`Tokens In,${totalTokensIn}`)
    csvRows.push(`Tokens Out,${totalTokensOut}`)
    csvRows.push(`Total Tokens,${rollup.totalTokens}`)
    csvRows.push(`Total Sessions,${rollup.totalSessions}`)
    csvRows.push(`Total Cost,${rollup.totalCost}`)
    csvRows.push('')

    // Provider Breakdown
    csvRows.push('Provider Breakdown')
    csvRows.push('Provider,Sessions,Tokens In,Tokens Out,Total Tokens,Cost')
    rollup.providerBreakdown.forEach((p) => {
      csvRows.push(`${p.provider},${p.sessions},${p.tokensIn},${p.tokensOut},${p.totalTokens},${p.cost}`)
    })
    csvRows.push('')

    // Top Agents
    csvRows.push('Top Agents')
    csvRows.push('Agent Name,Agent ID,Sessions,Tokens Total,Cost')
    rollup.topAgents.forEach((a) => {
      csvRows.push(`${a.agentName},${a.agentId},${a.sessions},${a.tokensTotal},${a.cost}`)
    })

    // Download CSV
    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `usage-report-${fromDate}-to-${toDate}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    showToast('Usage data exported successfully', 'success')
  }

  const getPeriodLabel = (): string => {
    switch (period) {
      case 'day':
        return 'Today'
      case 'week':
        return 'This Week'
      case 'month':
        return 'This Month'
      case 'year':
        return 'This Year'
      case 'custom':
        return 'Custom'
      default:
        return 'This Month'
    }
  }

  const providerBreakdownColumns = [
    { key: 'provider', header: 'Provider' },
    {
      key: 'sessions',
      header: 'Sessions',
      render: (row: unknown) => formatNumber((row as { sessions: number }).sessions),
    },
    {
      key: 'tokensIn',
      header: 'Tokens In',
      render: (row: unknown) => formatTokens((row as { tokensIn: number }).tokensIn),
    },
    {
      key: 'tokensOut',
      header: 'Tokens Out',
      render: (row: unknown) => formatTokens((row as { tokensOut: number }).tokensOut),
    },
    {
      key: 'totalTokens',
      header: 'Total Tokens',
      render: (row: unknown) => formatTokens((row as { totalTokens: number }).totalTokens),
    },
    {
      key: 'cost',
      header: 'Cost',
      render: (row: unknown) => formatCurrency((row as { cost: number }).cost),
    },
  ]

  const topAgentsColumns = [
    {
      key: 'agentId',
      header: 'Agent ID',
      render: (row: unknown) => {
        const agentId = (row as { agentId: string }).agentId
        const preview = agentId.length > 12 ? `${agentId.substring(0, 12)}...` : agentId
        const handleCopy = async () => {
          try {
            await navigator.clipboard.writeText(agentId)
            showToast('Agent ID copied to clipboard', 'success')
          } catch (err) {
            showToast('Failed to copy Agent ID', 'error')
          }
        }
        return (
          <code
            style={{
              fontSize: '0.75rem',
              cursor: 'pointer',
              color: 'var(--color-primary)',
              textDecoration: 'none',
              maxWidth: '120px',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            onClick={handleCopy}
            title={`Click to copy: ${agentId}`}
          >
            {preview}
          </code>
        )
      },
    },
    { key: 'agentName', header: 'Agent Name' },
    {
      key: 'sessions',
      header: 'Sessions',
      render: (row: unknown) => formatNumber((row as { sessions: number }).sessions),
    },
    {
      key: 'tokensTotal',
      header: 'Tokens Total',
      render: (row: unknown) => formatTokens((row as { tokensTotal: number }).tokensTotal),
    },
    {
      key: 'cost',
      header: 'Cost',
      render: (row: unknown) => formatCurrency((row as { cost: number }).cost),
    },
  ]

  const eventsColumns = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      render: (row: unknown) => formatDateReadable((row as UsageEvent).timestamp),
    },
    {
      key: 'sessionId',
      header: 'Session ID',
      render: (row: unknown) => <code style={{ fontSize: '0.75rem' }}>{(row as UsageEvent).sessionId}</code>,
    },
    {
      key: 'agentName',
      header: 'Agent',
      render: (row: unknown) => {
        const event = row as UsageEvent
        return event.agentName || event.agentId
      },
    },
    { key: 'provider', header: 'Provider' },
    {
      key: 'tokens',
      header: 'Tokens',
      render: (row: unknown) => {
        const event = row as UsageEvent
        return `${formatTokens(event.tokensIn)} / ${formatTokens(event.tokensOut)}`
      },
    },
    {
      key: 'cost',
      header: 'Cost',
      render: (row: unknown) => formatCurrency((row as UsageEvent).cost),
    },
  ]

  // Calculate totals for cards
  const totalTokensIn = rollup ? rollup.providerBreakdown.reduce((sum, p) => sum + p.tokensIn, 0) : 0
  const totalTokensOut = rollup ? rollup.providerBreakdown.reduce((sum, p) => sum + p.tokensOut, 0) : 0
  const totalTokens = rollup ? rollup.totalTokens : 0
  const totalCost = rollup ? rollup.totalCost : 0

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
        <h2 style={{ margin: 0, fontFamily: 'inherit', fontSize: '1.5rem', fontWeight: 600 }}>Usage</h2>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
          <select
            value={period}
            onChange={handlePeriodChange}
            style={{
              padding: 'var(--spacing-md)',
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
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 9L1 4h10z'/%3E%3C/svg%3E\")",
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right var(--spacing-md) center',
              paddingRight: 'calc(var(--spacing-md) + 12px + var(--spacing-sm))',
              transition: 'background-color 0.2s',
            }}
            onFocus={(e) => {
              e.target.style.backgroundColor = '#f3f4f6'
            }}
            onBlur={(e) => {
              e.target.style.backgroundColor = '#f9fafb'
            }}
            onMouseEnter={(e) => {
              if (document.activeElement !== e.target) {
                e.currentTarget.style.backgroundColor = '#f3f4f6'
              }
            }}
            onMouseLeave={(e) => {
              if (document.activeElement !== e.target) {
                e.currentTarget.style.backgroundColor = '#f9fafb'
              }
            }}
          >
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
            <option value="custom">Custom</option>
          </select>
          <Button variant="primary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', padding: 'var(--spacing-md)' }}>
            <i className="fa-solid fa-upload" style={{ fontSize: '0.875rem' }} />
            Export
          </Button>
        </div>
      </div>

      {/* Custom Date Range Filter (only shown when period is 'custom') */}
      {period === 'custom' && (
        <div style={{ backgroundColor: '#f9fafb', borderRadius: '0.75rem', padding: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)' }}>
          <form onSubmit={handleApply} style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'end' }}>
            <div style={{ flex: 1 }}>
              <label className="label">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-md)',
                  border: 'none',
                  borderRadius: '0.75rem',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text)',
                  outline: 'none',
                }}
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-md)',
                  border: 'none',
                  borderRadius: '0.75rem',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text)',
                  outline: 'none',
                }}
                required
              />
            </div>
            <Button type="submit" variant="primary" loading={isLoading}>
              Apply
            </Button>
          </form>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          <LoadingSpinner />
        </div>
      ) : rollup ? (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)' }}>
            {/* Tokens In Card */}
            <div
              style={{
                backgroundColor: '#f9fafb',
                borderRadius: '0.75rem',
                padding: 'var(--spacing-lg)',
                position: 'relative',
              }}
            >
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                Tokens In
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--color-text)', fontFamily: 'inherit', marginBottom: 'var(--spacing-xs)' }}>
                {formatTokens(totalTokensIn)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#a78bfa' }}>
                <span>↑ 0%</span>
              </div>
              <div
                style={{
                  position: 'absolute',
                  right: 'var(--spacing-md)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: '#1f2937',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <i className="fa-solid fa-arrow-down" style={{ fontSize: '1.25rem', color: 'white' }} />
              </div>
            </div>

            {/* Tokens Out Card */}
            <div
              style={{
                backgroundColor: '#f9fafb',
                borderRadius: '0.75rem',
                padding: 'var(--spacing-lg)',
                position: 'relative',
              }}
            >
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                Tokens Out
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--color-text)', fontFamily: 'inherit', marginBottom: 'var(--spacing-xs)' }}>
                {formatTokens(totalTokensOut)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#a78bfa' }}>
                <span>↑ 0%</span>
              </div>
              <div
                style={{
                  position: 'absolute',
                  right: 'var(--spacing-md)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: '#1f2937',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <i className="fa-solid fa-arrow-up" style={{ fontSize: '1.25rem', color: 'white' }} />
              </div>
            </div>

            {/* Total Tokens Card */}
            <div
              style={{
                backgroundColor: '#f9fafb',
                borderRadius: '0.75rem',
                padding: 'var(--spacing-lg)',
                position: 'relative',
              }}
            >
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                Total Tokens
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--color-text)', fontFamily: 'inherit', marginBottom: 'var(--spacing-xs)' }}>
                {formatTokens(totalTokens)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>
                <span>↓ 0%</span>
              </div>
              <div
                style={{
                  position: 'absolute',
                  right: 'var(--spacing-md)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: '#1f2937',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <i className="fa-solid fa-box" style={{ fontSize: '1.25rem', color: 'white' }} />
              </div>
            </div>

            {/* Total Cost Card */}
            <div
              style={{
                backgroundColor: '#f9fafb',
                borderRadius: '0.75rem',
                padding: 'var(--spacing-lg)',
                position: 'relative',
              }}
            >
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                Total Cost
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--color-text)', fontFamily: 'inherit', marginBottom: 'var(--spacing-xs)' }}>
                {formatCurrency(totalCost)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                Last period: {formatCurrency(0)}
              </div>
              <div
                style={{
                  position: 'absolute',
                  right: 'var(--spacing-md)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: '#1f2937',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <i className="fa-solid fa-dollar-sign" style={{ fontSize: '1.25rem', color: 'white' }} />
              </div>
            </div>
          </div>

          {/* Provider Breakdown and Top Agents - Side by Side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)' }}>
            {/* Provider Breakdown */}
            <div style={{ backgroundColor: '#f9fafb', borderRadius: '0.75rem', padding: 'var(--spacing-lg)' }}>
              <h3 style={{ margin: 0, marginBottom: 'var(--spacing-md)', fontSize: '1rem', fontFamily: 'inherit' }}>Provider Breakdown</h3>
              {rollup.providerBreakdown.length > 0 ? (
                <Table columns={providerBreakdownColumns} data={rollup.providerBreakdown} />
              ) : (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                  No provider data in this range
                </div>
              )}
            </div>

            {/* Top Agents */}
            <div style={{ backgroundColor: '#f9fafb', borderRadius: '0.75rem', padding: 'var(--spacing-lg)' }}>
              <h3 style={{ margin: 0, marginBottom: 'var(--spacing-md)', fontSize: '1rem', fontFamily: 'inherit' }}>Top Agents</h3>
              {rollup.topAgents.length > 0 ? (
                <Table columns={topAgentsColumns} data={rollup.topAgents} />
              ) : (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                  No agent data in this range
                </div>
              )}
            </div>
          </div>

          {/* Spend Limit and Usage by Month Chart */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)' }}>
            {/* Spend Limit Gauge (25%) */}
            <div style={{ backgroundColor: '#f9fafb', borderRadius: '0.75rem', padding: 'var(--spacing-lg)' }}>
              <SpendLimitGauge
                current={allTimeTotalCost}
                limit={100}
                percentage={(allTimeTotalCost / 100) * 100}
              />
            </div>

            {/* Usage by Month Chart (75%) */}
            <div style={{ backgroundColor: '#f9fafb', borderRadius: '0.75rem', padding: 'var(--spacing-lg)' }}>
              <h3 style={{ margin: 0, marginBottom: 'var(--spacing-md)', fontSize: '1rem', fontFamily: 'inherit' }}>Usage by Month</h3>
              <UsageByMonthChart />
            </div>
          </div>

          {/* Usage Events (Debug) */}
          <div style={{ backgroundColor: '#f9fafb', borderRadius: '0.75rem', padding: 'var(--spacing-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontFamily: 'inherit' }}>Usage Events (Debug)</h3>
              <Button variant="secondary" onClick={() => setShowEvents(!showEvents)}>
                {showEvents ? 'Hide' : 'Show'} Events
              </Button>
            </div>
            {showEvents && (
              <>
                {events.length > 0 ? (
                  <Table columns={eventsColumns} data={events} emptyMessage="No events in this range" />
                ) : (
                  <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                    No usage events in this range
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : (
        <div style={{ backgroundColor: '#f9fafb', borderRadius: '0.75rem', textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          No usage data in this range. Select a date range and click Apply.
        </div>
      )}
    </div>
  )
}
