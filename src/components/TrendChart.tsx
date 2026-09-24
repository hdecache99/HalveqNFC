import type { Scan } from '../types'
import { periodStart } from '../lib/format'

// Agrupa escaneos por día (≤31 días) o por mes (periodos largos).
export function buildSeries(scans: Scan[], days: number) {
  if (days > 31) {
    const months = Array.from({ length: 12 }, (_, index) => { const date = new Date(); date.setDate(1); date.setHours(0, 0, 0, 0); date.setMonth(date.getMonth() - (11 - index)); return date })
    return {
      labels: months.map((date) => date.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')),
      values: months.map((date) => { const next = new Date(date); next.setMonth(next.getMonth() + 1); return scans.filter((scan) => { const at = new Date(scan.scanned_at); return at >= date && at < next }).length }),
    }
  }
  const start = periodStart(days)
  const dates = Array.from({ length: days }, (_, index) => { const date = new Date(start); date.setDate(date.getDate() + index); return date })
  return {
    labels: dates.map((date) => date.toLocaleDateString('es-MX', days > 7 ? { day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric' }).replace('.', '')),
    values: dates.map((date) => { const next = new Date(date); next.setDate(next.getDate() + 1); return scans.filter((scan) => { const at = new Date(scan.scanned_at); return at >= date && at < next }).length }),
  }
}

export function TrendChart({ values, labels }: { values: number[]; labels: string[] }) {
  const maxValue = Math.max(...values, 4)
  const x = (index: number) => (index / Math.max(values.length - 1, 1)) * 700
  const y = (value: number) => 207 - (value / maxValue) * 175
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(' ')
  const ticks = [maxValue, Math.round(maxValue * 2 / 3), Math.round(maxValue / 3), 0]
  const labelStep = Math.ceil(labels.length / 8)
  return (
    <div className="trend-chart" aria-label="Tendencia de escaneos">
      <div className="chart-y-axis">{ticks.map((tick, index) => <span key={index}>{tick.toLocaleString('es-MX')}</span>)}</div>
      <svg viewBox="0 0 700 220" preserveAspectRatio="none" role="img">
        <defs>
          <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#e28c79" stopOpacity=".28" />
            <stop offset="1" stopColor="#e28c79" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[12, 77, 142, 207].map((lineY) => <line key={lineY} x1="0" y1={lineY} x2="700" y2={lineY} className="grid-line" />)}
        <polyline points={`${points} 700,220 0,220`} fill="url(#fill)" stroke="none" />
        <polyline points={points} fill="none" stroke="#d87661" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {values.length <= 31 && values.map((value, index) => <circle key={index} cx={x(index)} cy={y(value)} r="4" fill="#fffdf8" stroke="#d87661" strokeWidth="2" vectorEffect="non-scaling-stroke"><title>{`${labels[index]}: ${value}`}</title></circle>)}
      </svg>
      <div className="chart-x-axis">{labels.map((label, index) => <span key={index} style={{ visibility: index % labelStep === 0 ? 'visible' : 'hidden' }}>{label}</span>)}</div>
    </div>
  )
}
