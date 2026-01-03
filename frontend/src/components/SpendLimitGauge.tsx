interface SpendLimitGaugeProps {
  current: number
  limit: number
  percentage: number
  change?: number
}

export function SpendLimitGauge({ current, limit, percentage, change }: SpendLimitGaugeProps) {
  const normalizedPercentage = Math.min(Math.max(percentage, 0), 100)
  const angle = (normalizedPercentage / 100) * 180 // Semi-circle is 180 degrees
  const radius = 80
  const centerX = 100
  const centerY = 100

  // Calculate the arc path
  const startAngle = 0
  const endAngle = angle
  const startAngleRad = (startAngle * Math.PI) / 180
  const endAngleRad = (endAngle * Math.PI) / 180

  const x1 = centerX + radius * Math.cos(Math.PI - startAngleRad)
  const y1 = centerY - radius * Math.sin(Math.PI - startAngleRad)
  const x2 = centerX + radius * Math.cos(Math.PI - endAngleRad)
  const y2 = centerY - radius * Math.sin(Math.PI - endAngleRad)

  const largeArcFlag = angle > 180 ? 1 : 0

  const pathData = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-md)', alignSelf: 'flex-start' }}>
        Spend limit
      </div>
      <div style={{ position: 'relative', width: '200px', height: '120px' }}>
        <svg width="200" height="120" viewBox="0 0 200 120" style={{ overflow: 'visible' }}>
          {/* Background arc (unfilled) */}
          <path
            d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Filled arc with gradient */}
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          {normalizedPercentage > 0 && (
            <path
              d={pathData}
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth="12"
              strokeLinecap="round"
            />
          )}
        </svg>
        {/* Percentage text in center */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            marginTop: '10px',
          }}
        >
          <div style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--color-text)', fontFamily: 'inherit' }}>
            {normalizedPercentage.toFixed(2)}%
          </div>
          {change !== undefined && (
            <div style={{ fontSize: '0.75rem', color: '#10b981', fontFamily: 'inherit', marginTop: '4px' }}>
              ↑ {Math.abs(change).toFixed(1)}%
            </div>
          )}
        </div>
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-sm)', alignSelf: 'flex-start' }}>
        ${current.toLocaleString()} / ${limit.toLocaleString()}
      </div>
    </div>
  )
}
