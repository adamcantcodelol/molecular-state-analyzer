import { useMemo, useState } from 'react'
import {
  asFiniteNumber,
  isMissing,
  loadTabularTable,
  roleColumns,
} from '../data/tabular'
import type { ImportedDataset } from '../types/dataset'
import { DistributionChart } from './DistributionChart'
import { QualityReport } from './QualityReport'
import { TimeSeriesChart, type SeriesPoints } from './TimeSeriesChart'

type Props = {
  datasets: ImportedDataset[]
}

type ViewMode = 'timeseries' | 'distribution'

/**
 * Dashboard explorer for committed datasets: quality warnings + raw plots.
 * Filters apply only to the derived view used for rendering — stored data is untouched.
 */
export function RawDataExplorer({ datasets }: Props) {
  const plottableIds = useMemo(() => {
    const ids = new Set<string>()
    for (const d of datasets) {
      if (
        (d.format === 'csv' || d.format === 'json') &&
        d.columnMapping &&
        d.columnMapping.some((m) => m.role === 'time') &&
        d.columnMapping.some((m) => m.role === 'value')
      ) {
        ids.add(d.id)
      }
    }
    return ids
  }, [datasets])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('timeseries')
  const [valueCol, setValueCol] = useState<string>('')
  const [seriesFilter, setSeriesFilter] = useState<string>('__all__')
  const [timeMin, setTimeMin] = useState<string>('')
  const [timeMax, setTimeMax] = useState<string>('')

  const firstPlottable = datasets.find((d) => plottableIds.has(d.id))
  const activeId =
    selectedId && datasets.some((d) => d.id === selectedId)
      ? selectedId
      : (firstPlottable?.id ?? datasets[0]?.id ?? null)

  const dataset = datasets.find((d) => d.id === activeId) ?? null

  const derived = useMemo(() => {
    if (!dataset) {
      return {
        table: null as ReturnType<typeof loadTabularTable>,
        timeCol: undefined as string | undefined,
        valueCols: [] as string[],
        seriesCol: undefined as string | undefined,
        seriesValues: [] as string[],
        activeValue: '',
        filteredCount: 0,
        totalCount: 0,
        plotSeries: [] as SeriesPoints[],
        distValues: [] as number[],
      }
    }

    const table = loadTabularTable(dataset)
    const timeCol = roleColumns(dataset.columnMapping, 'time')[0]
    const valueCols = roleColumns(dataset.columnMapping, 'value')
    const seriesCol = roleColumns(dataset.columnMapping, 'series')[0]
    const activeValue =
      valueCol && valueCols.includes(valueCol) ? valueCol : (valueCols[0] ?? '')

    const seriesValues: string[] = []
    if (table && seriesCol) {
      const set = new Set<string>()
      for (const row of table.rows) {
        const v = row[seriesCol]
        if (!isMissing(v)) set.add(String(v))
      }
      seriesValues.push(...[...set].sort())
    }

    const tMin = timeMin.trim() === '' ? null : Number(timeMin)
    const tMax = timeMax.trim() === '' ? null : Number(timeMax)

    const filtered =
      table && timeCol
        ? table.rows.filter((row) => {
            if (seriesCol && seriesFilter !== '__all__') {
              if (String(row[seriesCol] ?? '') !== seriesFilter) return false
            }
            const t = asFiniteNumber(row[timeCol])
            if (t === null) return false
            if (tMin !== null && Number.isFinite(tMin) && t < tMin) return false
            if (tMax !== null && Number.isFinite(tMax) && t > tMax) return false
            return true
          })
        : []

    const plotSeries: SeriesPoints[] = []
    if (timeCol && activeValue) {
      const groups = new Map<string, { xs: number[]; ys: (number | null)[] }>()
      for (const row of filtered) {
        const t = asFiniteNumber(row[timeCol])
        if (t === null) continue
        const yRaw = row[activeValue]
        const y = isMissing(yRaw) ? null : asFiniteNumber(yRaw)
        const key = seriesCol ? String(row[seriesCol] ?? '(blank)') : 'all'
        const g = groups.get(key) ?? { xs: [], ys: [] }
        g.xs.push(t)
        g.ys.push(y)
        groups.set(key, g)
      }
      for (const [id, g] of groups) {
        plotSeries.push({
          id,
          label: id === 'all' ? activeValue : id,
          xs: g.xs,
          ys: g.ys,
        })
      }
    }

    const distValues: number[] = []
    if (activeValue) {
      for (const row of filtered) {
        const n = asFiniteNumber(row[activeValue])
        if (n !== null) distValues.push(n)
      }
    }

    return {
      table,
      timeCol,
      valueCols,
      seriesCol,
      seriesValues,
      activeValue,
      filteredCount: filtered.length,
      totalCount: table?.rows.length ?? 0,
      plotSeries,
      distValues,
    }
  }, [dataset, valueCol, seriesFilter, timeMin, timeMax])

  if (datasets.length === 0) {
    return (
      <section className="panel" aria-labelledby="explore-heading">
        <h2 id="explore-heading" className="panel-title">
          Raw data explorer
        </h2>
        <p className="muted">
          Import and commit a dataset to inspect quality warnings and plot raw
          values. No charts are invented without data.
        </p>
      </section>
    )
  }

  return (
    <section className="panel explore-panel" aria-labelledby="explore-heading">
      <div className="panel-head">
        <h2 id="explore-heading" className="panel-title">
          Raw data explorer
        </h2>
      </div>
      <p className="muted">
        Quality checks and plots use a derived view of each committed original.
        Filters change what you see — they do not rewrite stored project data.
      </p>

      <div className="explore-controls">
        <label className="field">
          <span className="field-label">Dataset</span>
          <select
            className="input select"
            value={activeId ?? ''}
            onChange={(e) => {
              setSelectedId(e.target.value)
              setSeriesFilter('__all__')
              setTimeMin('')
              setTimeMax('')
              setValueCol('')
            }}
          >
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fileName} ({d.format})
                {plottableIds.has(d.id) ? '' : ' — limited'}
              </option>
            ))}
          </select>
        </label>
      </div>

      {dataset && <QualityReport dataset={dataset} />}

      {dataset && (!derived.timeCol || derived.valueCols.length === 0) && (
        <p className="muted small explore-note">
          Time-series plots need a committed column mapping with at least one
          Time and one Value role (CSV/JSON). Structure-only formats show quality
          notes above.
        </p>
      )}

      {dataset && derived.timeCol && derived.valueCols.length > 0 && (
        <>
          <div className="explore-controls plot-controls">
            <label className="field">
              <span className="field-label">View</span>
              <select
                className="input select"
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as ViewMode)}
              >
                <option value="timeseries">Time series</option>
                <option value="distribution">Distribution</option>
              </select>
            </label>

            <label className="field">
              <span className="field-label">Value column</span>
              <select
                className="input select"
                value={derived.activeValue}
                onChange={(e) => setValueCol(e.target.value)}
              >
                {derived.valueCols.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            {derived.seriesCol && (
              <label className="field">
                <span className="field-label">
                  Filter series ({derived.seriesCol})
                </span>
                <select
                  className="input select"
                  value={seriesFilter}
                  onChange={(e) => setSeriesFilter(e.target.value)}
                >
                  <option value="__all__">All series</option>
                  {derived.seriesValues.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="field">
              <span className="field-label">Time min</span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                placeholder="−∞"
                value={timeMin}
                onChange={(e) => setTimeMin(e.target.value)}
              />
            </label>

            <label className="field">
              <span className="field-label">Time max</span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                placeholder="+∞"
                value={timeMax}
                onChange={(e) => setTimeMax(e.target.value)}
              />
            </label>
          </div>

          <p className="muted small">
            Showing {derived.filteredCount.toLocaleString()} of{' '}
            {derived.totalCount.toLocaleString()} rows (filter view only).
          </p>

          {viewMode === 'timeseries' ? (
            <TimeSeriesChart
              series={derived.plotSeries}
              xLabel={derived.timeCol}
              yLabel={derived.activeValue}
            />
          ) : (
            <DistributionChart
              values={derived.distValues}
              label={derived.activeValue}
            />
          )}
        </>
      )}
    </section>
  )
}
