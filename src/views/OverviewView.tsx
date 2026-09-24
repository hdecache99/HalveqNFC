import { useState } from 'react'
import { ArrowUpRight, BookOpen, Check, ChevronDown, ExternalLink, MousePointerClick, Palette, Plus, Smartphone, Tags, Users } from 'lucide-react'
import { isAdmin, type AppContext } from '../appContext'
import { buildSeries, TrendChart } from '../components/TrendChart'
import { periodStart, publicTagUrl } from '../lib/format'
import { DEFAULT_DESIGN } from '../types'

export const periods = [{ label: 'Últimos 7 días', days: 7 }, { label: 'Últimos 30 días', days: 30 }, { label: 'Último año', days: 365 }]

export function OverviewView({ app }: { app: AppContext }) {
  const [days, setDays] = useState(7)
  const since = periodStart(days)
  const scans = app.scans.filter((scan) => new Date(scan.scanned_at) >= since)
  const clicks = app.clicks.filter((click) => new Date(click.clicked_at) >= since)
  const visitors = new Set(scans.map((scan) => scan.visitor_id).filter(Boolean)).size
  const series = buildSeries(scans, days)

  const customized = app.profiles.some((profile) => profile.logo_url || profile.bio || profile.bg_color !== DEFAULT_DESIGN.bg_color || profile.button_color !== DEFAULT_DESIGN.button_color)
  const steps = [
    { done: app.tags.length > 0, title: 'Crea tu primer tag NFC', text: 'Cada placa física corresponde a un tag con su propia dirección.', view: 'tags' as const, icon: Tags },
    { done: customized, title: 'Personaliza tu perfil', text: 'Sube tu logo y elige colores y fondo para tu página de enlaces.', view: 'perfiles' as const, icon: Palette },
    { done: app.links.length > 1, title: 'Agrega tus enlaces', text: 'Instagram, WhatsApp, menú, reseñas de Google… lo que quieras mostrar.', view: 'perfiles' as const, icon: MousePointerClick },
    { done: app.scans.length > 0, title: 'Graba la placa y pruébala', text: 'Copia la URL del tag, grábala en la placa y acércala a tu celular.', view: 'tutorial' as const, icon: Smartphone },
    ...(isAdmin(app) ? [{ done: app.members.length > 1, title: 'Invita a tu equipo', text: 'Da acceso a las personas que te ayudan a administrar.', view: 'equipo' as const, icon: Users }] : []),
  ]
  const completed = steps.filter((step) => step.done).length

  const tagStats = app.tags.map((tag) => ({ tag, count: scans.filter((scan) => scan.tag_id === tag.id).length })).sort((first, second) => second.count - first.count)
  const linkStats = app.links.map((link) => ({ link, count: clicks.filter((click) => click.link_id === link.id).length })).filter((item) => item.count > 0).sort((first, second) => second.count - first.count).slice(0, 5)
  const metrics = [
    { label: 'Escaneos', value: scans.length, hint: 'veces que acercaron una placa', tone: 'mint' },
    { label: 'Visitantes únicos', value: visitors, hint: 'personas distintas', tone: 'lavender' },
    { label: 'Clics en enlaces', value: clicks.length, hint: 'botones pulsados en tus perfiles', tone: 'peach' },
    { label: 'Tags activos', value: app.tags.filter((tag) => tag.status === 'Activo').length, hint: `de ${app.tags.length} registrados`, tone: 'yellow' },
  ]

  return <>
    <section className="page-heading"><div><p className="eyebrow">PANEL DE {app.workspace.name.toUpperCase()}</p><h1>Hola, {app.session.name.split(' ')[0]} <span>✦</span></h1><p className="subheading">Así van los tags NFC de {app.workspace.name}.</p></div><button className="primary-button" onClick={() => app.go('tags')}><Plus size={17} /> Nuevo tag NFC</button></section>

    {completed < steps.length && <section className="panel onboarding">
      <div className="panel-header"><div><h2>Primeros pasos · {completed} de {steps.length}</h2><p>Completa esta guía para dejar tus placas funcionando.</p></div><button className="outline-button" onClick={() => app.go('tutorial')}><BookOpen size={14} /> Ver tutorial completo</button></div>
      <div className="progress"><i style={{ width: `${(completed / steps.length) * 100}%` }} /></div>
      <div className="onboarding-steps">{steps.map((step, index) => <button key={step.title} className={`onboarding-step ${step.done ? 'done' : ''}`} onClick={() => app.go(step.view)}><span className="step-check">{step.done ? <Check size={14} /> : index + 1}</span><span><strong>{step.title}</strong><small>{step.text}</small></span><ArrowUpRight size={15} /></button>)}</div>
    </section>}

    <div className="section-toolbar"><h2>Resultados</h2><div className="period-select"><select value={days} onChange={(event) => setDays(Number(event.target.value))} aria-label="Periodo">{periods.map((period) => <option key={period.days} value={period.days}>{period.label}</option>)}</select><ChevronDown size={15} /></div></div>
    <section className="metric-grid">{metrics.map((metric) => <article className={`metric-card ${metric.tone}`} key={metric.label}><div className="metric-top"><span>{metric.label}</span></div><div className="metric-value">{metric.value.toLocaleString('es-MX')}</div><div className="metric-hint">{metric.hint}</div></article>)}</section>

    <section className="content-grid">
      <article className="panel trend-panel"><div className="panel-header"><div><h2>Actividad de escaneos</h2><p>{periods.find((period) => period.days === days)?.label}</p></div></div><TrendChart values={series.values} labels={series.labels} /><div className="chart-footer"><span className="legend-dot" /> Escaneos <strong>{scans.length.toLocaleString('es-MX')}</strong></div></article>
      <article className="panel distribution-panel"><div className="panel-header"><div><h2>Enlaces más visitados</h2><p>Lo que más pulsan tus clientes</p></div></div>
        <div className="rank-list">{linkStats.map(({ link, count }) => <div key={link.id}><span>{link.label}</span><div className="rank-bar"><i style={{ width: `${(count / linkStats[0].count) * 100}%` }} /></div><strong>{count}</strong></div>)}{!linkStats.length && <p className="empty-state">Aún no hay clics en este periodo.</p>}</div>
        <button className="text-button" onClick={() => app.go('analitica')}>Ver analítica completa <ArrowUpRight size={15} /></button>
      </article>
    </section>

    <section className="panel tags-panel"><div className="panel-header"><div><h2>Tags con más actividad</h2><p>Tus placas más escaneadas en el periodo</p></div><button className="outline-button" onClick={() => app.go('tags')}>Ver todos <ArrowUpRight size={15} /></button></div>
      {app.tags.length ? <div className="table-wrap"><table><thead><tr><th>TAG</th><th>NEGOCIO</th><th>ESCANEOS</th><th>ESTADO</th><th /></tr></thead><tbody>{tagStats.slice(0, 6).map(({ tag, count }) => <tr key={tag.id}><td><div className="tag-name"><span className="tag-icon coral"><Tags size={15} /></span><strong>{tag.name}</strong></div></td><td>{tag.client_name}</td><td><strong>{count.toLocaleString('es-MX')}</strong></td><td><span className={`status ${tag.status === 'Activo' ? 'active' : 'paused'}`}><i />{tag.status}</span></td><td><a className="row-action" href={publicTagUrl(tag.slug, tag.id)} target="_blank" rel="noreferrer" aria-label={`Abrir ${tag.name}`}><ExternalLink size={16} /></a></td></tr>)}</tbody></table></div> : <p className="empty-state">Todavía no tienes tags. <button className="text-link" onClick={() => app.go('tags')}>Crea el primero</button></p>}
    </section>
  </>
}
