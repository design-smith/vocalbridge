import { useState, useEffect } from 'react'
import { Bar, CartesianGrid, Legend, BarChart as RechartsBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format, parse } from 'date-fns'
import { getMonthlyUsage } from '@/api/endpoints'
import type { MonthlyUsage } from '@/api/types'

interface ChartData {
  month: Date
  vendorA: number
  vendorB: number
}

export function UsageByMonthChart() {
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const isDesktop = window.innerWidth >= 1024

  useEffect(() => {
    loadMonthlyUsage()
  }, [])

  const loadMonthlyUsage = async () => {
    setIsLoading(true)
    const response = await getMonthlyUsage()

    if (response.data) {
      // Transform the data: convert month string to Date and convert costs to dollars
      const transformedData: ChartData[] = response.data.map((item: MonthlyUsage) => ({
        month: parse(item.month, 'yyyy-MM', new Date()),
        vendorA: item.vendorA,
        vendorB: item.vendorB,
      }))
      setChartData(transformedData)
    }

    setIsLoading(false)
  }

  if (isLoading) {
    return (
      <div style={{ width: '100%', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--color-text-secondary)' }}>Loading chart data...</div>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div style={{ width: '100%', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--color-text-secondary)' }}>No monthly usage data available</div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '300px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={chartData}
          margin={{
            left: 4,
            right: 0,
            top: isDesktop ? 12 : 6,
            bottom: 18,
          }}
        >
          <CartesianGrid vertical={false} stroke="#e5e7eb" />

          <Legend
            verticalAlign="top"
            align="right"
            layout={isDesktop ? 'vertical' : 'horizontal'}
            wrapperStyle={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}
          />

          <XAxis
            dataKey="month"
            tickFormatter={(value: Date) => format(value, 'MMM')}
            tick={{ fill: 'var(--color-text-secondary)', fontSize: '0.75rem' }}
            axisLine={false}
            tickLine={false}
            tickMargin={11}
            interval="preserveStartEnd"
          />

          <YAxis
            tickFormatter={(value: number) => `$${value.toFixed(2)}`}
            tick={{ fill: 'var(--color-text-secondary)', fontSize: '0.75rem' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />

          <Tooltip
            formatter={(value: number) => `$${value.toFixed(4)}`}
            labelFormatter={(value: Date) => format(value, 'MMM yyyy')}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
            }}
            cursor={{ fill: 'rgba(229, 231, 235, 0.2)' }}
          />

          <Bar
            isAnimationActive={false}
            dataKey="vendorA"
            name="Vendor A"
            stackId="a"
            fill="#3b82f6"
            maxBarSize={isDesktop ? 32 : 16}
          />
          <Bar
            isAnimationActive={false}
            dataKey="vendorB"
            name="Vendor B"
            stackId="a"
            fill="#8b5cf6"
            maxBarSize={isDesktop ? 32 : 16}
            radius={[6, 6, 0, 0]}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}
