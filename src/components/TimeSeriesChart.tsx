import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { chartColors } from '../viz/chartTheme'

export type SeriesPoints = {
  id: string
  label: string
  /** Aligned x (time) and y values; null y = gap. */
  xs: number[]
  ys: (number | null)[]
}

type Props = {
  series: SeriesPoints[]
  xLabel: string
  yLabel: string
  /** Height in CSS pixels. */
  height?: number
}

/**
 * Raw time-series plot with drag-zoom and hover cursor.
 * Data must already be filtered by the parent — this component does not mutate sources.
 */
export function TimeSeriesChart({
  series,
  xLabel,
  yLabel,
  height = 280,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef<uPlot | null>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    plotRef.current?.destroy()
    plotRef.current = null

    if (series.length === 0) return

    const colors = chartColors()
    const width = Math.max(320, el.clientWidth || 640)

    // Align all series onto a shared sorted x axis (union of times).
    const xSet = new Set<number>()
    for (const s of series) {
      for (const x of s.xs) xSet.add(x)
    }
    const xs = [...xSet].sort((a, b) => a - b)
    if (xs.length === 0) return

    const data: uPlot.AlignedData = [xs]
    const seriesOpts: uPlot.Series[] = [
      {
        label: xLabel,
      },
    ]

    for (let i = 0; i < series.length; i++) {
      const s = series[i]!
      const map = new Map<number, number | null>()
      for (let j = 0; j < s.xs.length; j++) {
        map.set(s.xs[j]!, s.ys[j] ?? null)
      }
      data.push(xs.map((x) => map.get(x) ?? null))
      seriesOpts.push({
        label: s.label,
        stroke: colors.series[i % colors.series.length],
        width: 2,
        points: { show: xs.length <= 80 },
      })
    }

    const opts: uPlot.Options = {
      width,
      height,
      title: undefined,
      scales: {
        x: { time: false },
      },
      axes: [
        {
          stroke: colors.muted,
          grid: { stroke: colors.line, width: 1 },
          ticks: { stroke: colors.line },
          label: xLabel,
          labelFont: '12px system-ui, sans-serif',
          font: '11px system-ui, sans-serif',
        },
        {
          stroke: colors.muted,
          grid: { stroke: colors.line, width: 1 },
          ticks: { stroke: colors.line },
          label: yLabel,
          labelFont: '12px system-ui, sans-serif',
          font: '11px system-ui, sans-serif',
          size: 56,
        },
      ],
      series: seriesOpts,
      cursor: {
        show: true,
        points: { size: 8 },
      },
      legend: {
        show: true,
        live: true,
      },
      hooks: {},
    }

    const plot = new uPlot(opts, data, el)
    plotRef.current = plot

    const ro = new ResizeObserver(() => {
      if (!rootRef.current || !plotRef.current) return
      plotRef.current.setSize({
        width: Math.max(320, rootRef.current.clientWidth),
        height,
      })
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      plot.destroy()
      plotRef.current = null
    }
  }, [series, xLabel, yLabel, height])

  if (series.length === 0) {
    return (
      <p className="muted small">
        No numeric points to plot for the current filters.
      </p>
    )
  }

  return (
    <div className="chart-wrap">
      <div className="chart-hint muted small">
        Drag horizontally to zoom · double-click to reset · hover for values
      </div>
      <div ref={rootRef} className="uplot-host" />
    </div>
  )
}
