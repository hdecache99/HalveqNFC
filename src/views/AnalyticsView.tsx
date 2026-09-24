import { useState } from 'react'
import { ChevronDown, Download } from 'lucide-react'
import type { AppContext } from '../appContext'
import { buildSeries, TrendChart } from '../components/TrendChart'
import { periodStart } from '../lib/format'
import { periods } from './OverviewView'

const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function AnalyticsView({ app }: { app: AppContext }) {
  const [days, setDays] = useState(30)
  const since = periodStart(days)
  const scans = app.scans.filter((scan) => new Date(scan.scanned_at) >= since)
  const clicks = app.clicks.filter((click) => new Date(click.clicked_at) >= since)
  const series = buildSeries(scans, days)
  const visitors = new Set(scans.map((scan) => scan.visitor_id).filter(Boolean)).size

  const tagRows = app.tags.map((tag) => {
    const tagScans = scans.filter((scan) => scan.tag_id === tag.id)
    return { tag, scans: tagScans.length, visitors: new Set(tagScans.map((scan) => scan.visitor_id).filter(Boolean)).size, last: tagScans[0]?.scanned_at }
  }).sort((first, second) => second.scans - first.scans)
  const profileName = (id: string) => { const profile = app.profiles.find((item) => item.id === id); return profile ? `${profile.client_name} · ${profile.name}` : '—' }
  const linkRows = app.links.map((link) => ({ link, clicks: clicks.filter((click) => click.link_id === link.id).length })).sort((first, second) => second.clicks - first.clicks)
  const byWeekday = weekdays.map((_, day) => scans.filter((scan) => new Date(scan.scanned_at).getDay() === day).length)
  const byHour = Array.from({ length: 24 }, (_, hour) => scans.filter((scan) => new Date(scan.scanned_at).getHours() === hour).length)
  const peakHour = byHour.indexOf(Math.max(...byHour))

  const exportCsv = () => {
    const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
    const rows = [['Tipo', 'Nombre', 'Detalle', 'Total'], ...tagRows.map((row) => ['Tag', row.tag.name, row.tag.client_name, row.scans]), ...linkRows.map((row) => ['Enlace', row.link.label, row.link.url, row.clicks])]
    const blob = new Blob(['﻿' + rows.map((row) => row.map(escape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(blob)
    anchor.download = `analitica-${app.workspace.name.replace(/\s+/g, '-').toLowerCase()}-${days}d.csv`
    anchor.click()
    URL.revokeObjectURL(anchor.href)
  }

  return <div className="admin-page">
    <section className="page-heading"><div><p className="eyebrow">RESULTADOS</p><h1>Analítica <span>✦</span></h1><p className="subheading">Cuántas personas escanean tus placas y qué enlaces les interesan.</p></div><div className="heading-actions"><div className="period-select"><select value={days} onChange={(event) => setDays(Number(event.target.value))} aria-label="Periodo">{periods.map((period) => <option key={period.days} value={period.days}>{period.label}</option>)}</select><ChevronDown size={15} /></div><button className="outline-button" onClick={exportCsv}><Download size={14} /> Exportar CSV</button></div></section>

    <section className="metric-grid">
      <article className="metric-card mint"><div className="metric-top"><span>Escaneos</span></div><div className="metric-value">{scans.length.toLocaleString('es-MX')}</div><div className="metric-hint">en el periodo</div></article>
      <article className="metric-card lavender"><div className="metric-top"><span>Visitantes únicos</span></div><div className="metric-value">{visitors.toLocaleString('es-MX')}</div><div className="metric-hint">por dispositivo</div></article>
      <article className="metric-card peach"><div className="metric-top"><span>Clics en enlaces</span></div><div className="metric-value">{clicks.length.toLocaleString('es-MX')}</div><div className="metric-hint">{scans.length ? `${Math.round((clicks.length / scans.length) * 100)}% de los escaneos` : 'sin escaneos'}</div></article>
      <article className="metric-card yellow"><div className="metric-top"><span>Hora pico</span></div><div className="metric-value">{scans.length ? `${peakHour}:00` : '—'}</div><div className="metric-hint">hora con más escaneos</div></article>
    </section>

    <section className="content-grid">
      <article className="panel trend-panel"><div className="panel-header"><div><h2>Escaneos en el tiempo</h2><p>{periods.find((period) => period.days === days)?.label}</p></div></div><TrendChart values={series.values} labels={series.labels} /></article>
      <article className="panel"><div className="panel-header"><div><h2>Por día de la semana</h2><p>Cuándo te visitan más</p></div></div><div className="bar-columns">{byWeekday.map((count, day) => <div key={day}><span style={{ height: `${(count / Math.max(...byWeekday, 1)) * 100}%` }} title={`${count} escaneos`} /><small>{weekdays[day]}</small></div>)}</div></article>
    </section>

    <section className="panel tags-panel"><div className="panel-header"><div><h2>Por tag</h2><p>Rendimiento de cada placa</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>TAG</th><th>PERFIL</th><th>ESCANEOS</th><th>VISITANTES</th><th>ÚLTIMO ESCANEO</th></tr></thead><tbody>{tagRows.map((row) => <tr key={row.tag.id}><td><strong>{row.tag.name}</strong></td><td>{row.tag.profile_id ? profileName(row.tag.profile_id) : 'Sin perfil'}</td><td><strong>{row.scans}</strong></td><td>{row.visitors}</td><td>{row.last ? new Date(row.last).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td></tr>)}</tbody></table>{!tagRows.length && <p className="empty-state">Sin tags todavía.</p>}</div>
    </section>

    <section className="panel tags-panel spaced"><div className="panel-header"><div><h2>Por enlace</h2><p>Clics en cada botón de tus perfiles</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>ENLACE</th><th>PERFIL</th><th>CLICS</th><th>ESTADO</th></tr></thead><tbody>{linkRows.map((row) => <tr key={row.link.id}><td><strong>{row.link.label}</strong><br /><small className="muted-url">{row.link.url}</small></td><td>{profileName(row.link.profile_id)}</td><td><strong>{row.clicks}</strong></td><td><span className={`status ${row.link.active ? 'active' : 'paused'}`}><i />{row.link.active ? 'Visible' : 'Oculto'}</span></td></tr>)}</tbody></table>{!linkRows.length && <p className="empty-state">Sin enlaces todavía.</p>}</div>
    </section>
  </div>
}
