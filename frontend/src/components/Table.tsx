interface TableProps {
  columns: Array<{ key: string; header: string; render?: (row: unknown) => React.ReactNode }>
  data: unknown[]
  emptyMessage?: string
  onRowClick?: (row: unknown) => void
}

export function Table({ columns, data, emptyMessage = 'No data available', onRowClick }: TableProps) {
  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: 0,
          backgroundColor: 'transparent',
        }}
      >
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: 'var(--spacing-md)',
                  textAlign: 'left',
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'inherit',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  backgroundColor: 'transparent',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={idx}
              onClick={() => onRowClick?.(row)}
              style={{
                backgroundColor: idx % 2 === 0 ? 'transparent' : '#f9fafb',
                cursor: onRowClick ? 'pointer' : 'default',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'transparent' : '#f9fafb'
              }}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    padding: 'var(--spacing-md)',
                    fontSize: '0.875rem',
                    color: 'var(--color-text)',
                    fontFamily: 'inherit',
                    whiteSpace: col.key === 'agentId' ? 'nowrap' : 'nowrap',
                    maxWidth: col.key === 'agentId' ? '120px' : 'none',
                  }}
                >
                  {col.render ? col.render(row) : (row as Record<string, unknown>)[col.key]?.toString() || ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
