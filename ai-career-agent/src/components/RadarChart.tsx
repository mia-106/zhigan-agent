'use client'

import { useEffect, useRef } from 'react'
import { Chart, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, RadarController } from 'chart.js'
import type { TooltipItem } from 'chart.js'

Chart.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, RadarController)

interface RadarChartProps {
  data: {
    score: number
    matchAnalysis: Array<{
      dimension: string
      score: number
      analysis: string
    }>
  }
}

export function RadarChart({ data }: RadarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || !data) return

    // Ensure we have matchAnalysis data to render
    const analysisData = Array.isArray(data) ? data : (data.matchAnalysis || [])
    if (analysisData.length === 0) return

    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    const chartData = {
      labels: analysisData.map(item => item.dimension),
      datasets: [
        {
          label: '匹配度得分',
          data: analysisData.map(item => item.score),
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          borderColor: 'rgba(99, 102, 241, 1)',
          borderWidth: 2,
          pointBackgroundColor: 'rgba(99, 102, 241, 1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(99, 102, 241, 1)'
        }
      ]
    }

    const config = {
      type: 'radar' as const,
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: {
              display: true,
              color: 'rgba(0, 0, 0, 0.1)'
            },
            suggestedMin: 0,
            suggestedMax: 40,
            pointLabels: {
              font: {
                size: 12,
                family: "'Inter', sans-serif"
              }
            },
            ticks: {
              stepSize: 10,
              backdropColor: 'transparent'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context: TooltipItem<'radar'>) {
                return `${context.dataset.label}: ${context.parsed.r} 分`
              }
            }
          }
        }
      }
    }

    const chart = new Chart(ctx, config)

    return () => {
      chart.destroy()
    }
  }, [data])

  return (
    <div className="relative h-[400px] w-full">
      <canvas ref={canvasRef} />
    </div>
  )
}
