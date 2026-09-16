import type { ColumnMapping, ColumnRole } from '../types/dataset'
import { COLUMN_ROLE_OPTIONS } from '../types/dataset'

type Props = {
  columnNames: string[]
  mapping: ColumnMapping[]
  onChange: (next: ColumnMapping[]) => void
  previewRows: Record<string, string | number | boolean | null>[]
}

export function ColumnMapper({
  columnNames,
  mapping,
  onChange,
  previewRows,
}: Props) {
  function setRole(column: string, role: ColumnRole) {
    onChange(
      mapping.map((m) => (m.column === column ? { ...m, role } : m)),
    )
  }

  return (
    <div className="mapper">
      <h3 className="subheading">Column mapping</h3>
      <p className="muted small">
        Nothing is written to the project until you confirm. Original file text
        stays unchanged; this mapping only labels columns for later use.
      </p>

      <div className="mapper-table-wrap">
        <table className="mapper-table">
          <thead>
            <tr>
              <th scope="col">Column</th>
              <th scope="col">Role</th>
              <th scope="col">Sample</th>
            </tr>
          </thead>
          <tbody>
            {columnNames.map((col) => {
              const m = mapping.find((x) => x.column === col)
              const sample = previewRows
                .slice(0, 3)
                .map((r) => formatSample(r[col]))
                .join(' · ')
              return (
                <tr key={col}>
                  <td>
                    <code>{col}</code>
                  </td>
                  <td>
                    <select
                      className="input select"
                      value={m?.role ?? 'unmapped'}
                      onChange={(e) =>
                        setRole(col, e.target.value as ColumnRole)
                      }
                      aria-label={`Role for column ${col}`}
                    >
                      {COLUMN_ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="muted small sample-cell">{sample || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatSample(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '∅'
  const s = String(v)
  return s.length > 24 ? `${s.slice(0, 24)}…` : s
}
