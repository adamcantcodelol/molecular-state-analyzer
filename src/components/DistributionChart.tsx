import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { chartColors } from '../viz/chartTheme'

type Props = {
  values: number[]
  label: string
  height?: number
  bins?: number
}

/** Simple histogram of raw numeric values (derived view only). */
export function DistributionChart({
  values,
  label,
  height = 220,
  bins = 20,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    let plot: uPlot | null = null

    if (values.length === 0) {
      el.replaceChildren()
      return
    }

    const colors = chartColors()
    const width = Math.max(320, el.clientWidth || 640)
    const { centers, counts } = buildHistogram(values, bins)

    const data: uPlot.AlignedData = [centers, counts]
    const opts: uPlot.Options = {
      width,
      height,
      scales: {
        x: { time: false },
      },
      axes: [
        {
          stroke: colors.muted,
          grid: { stroke: colors.line, width: 1 },
          ticks: { stroke: colors.line },
          label,
          labelFont: '12px system-ui, sans-serif',
          font: '11px system-ui, sans-serif',
        },
        {
          stroke: colors.muted,
          grid: { stroke: colors.line, width: 1 },
          ticks: { stroke: colors.line },
          label: 'count',
          labelFont: '12px system-ui, sans-serif',
          font: '11px system-ui, sans-serif',
          size: 48,
        },
      ],
      series: [
        { label },
        {
          label: 'count',
          stroke: colors.series[0],
          fill: colors.series[0],
          width: 1,
          points: { show: false },
          paths: uPlot.paths.bars!({ size: [0.8, 100] }),
        },
      ],
      cursor: { show: true },
      legend: { show: true, live: true },
    }

    plot = new uPlot(opts, data, el)

    const ro = new ResizeObserver(() => {
      if (!rootRef.current || !plot) return
      plot.setSize({
        width: Math.max(320, rootRef.current.clientWidth),
        height,
      })
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      plot?.destroy()
    }
  }, [values, label, height, bins])

  if (values.length === 0) {
    return (
      <p className="muted small">No numeric values for the distribution view.</p>
    )
  }

  return (
    <div className="chart-wrap">
      <div className="chart-hint muted small">
        Histogram of raw values currently in the filtered set ({values.length}{' '}
        points). Hover for bin counts.
      </div>
      <div ref={rootRef} className="uplot-host" />
    </div>
  )
}

function buildHistogram(
  values: number[],
  binCount: number,
): { centers: number[]; counts: number[]; width: number } {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { centers: [], counts: [], width: 0 }
  }
  if (min === max) {
    return { centers: [min], counts: [values.length], width: 1 }
  }
  const n = Math.max(1, Math.min(binCount, values.length))
  const width = (max - min) / n
  const counts = new Array<number>(n).fill(0)
  for (const v of values) {
    let idx = Math.floor((v - min) / width)
    if (idx >= n) idx = n - 1
    if (idx < 0) idx = 0
    counts[idx]! += 1
  }
  const centers = counts.map((_, i) => min + (i + 0.5) * width)
  return { centers, counts, width }
}
