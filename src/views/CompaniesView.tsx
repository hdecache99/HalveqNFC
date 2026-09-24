import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Building2, LogIn, Pause, Pencil, Play, Plus, Search, Trash2, UserPlus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { errorMessage, formatDate, initials } from '../lib/format'
import type { PlatformWorkspace } from '../types'
import { InviteModal } from './TeamView'

type Props = { notify: (message: string) => void; enterWorkspace: (id: string) => void; refreshWorkspaces: () => Promise<void>; currentWorkspaceId: string | null }

export function CompaniesView({ notify, enterWorkspace, refreshWorkspaces, currentWorkspaceId }: Props) {
  const [companies, setCompanies] = useState<PlatformWorkspace[] | null>(null)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<PlatformWorkspace | 'new' | null>(null)
  const [inviteTo, setInviteTo] = useState<{ id: string; name: string } | null>(null)

  const load = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase.rpc('platform_workspaces')
    if (error) { notify(errorMessage(error)); setCompanies([]); return }
    setCompanies((data ?? []) as PlatformWorkspace[])
  }, [notify])

  useEffect(() => { void load() }, [load])

  const afterChange = async () => { await Promise.all([load(), refreshWorkspaces()]) }

  const toggleStatus = async (company: PlatformWorkspace) => {
    if (!supabase) return
    const next = company.status === 'Activo' ? 'Suspendido' : 'Activo'
    if (next === 'Suspendido' && !window.confirm(`¿Suspender "${company.name}"?\n\n• Su equipo no podrá entrar a la consola.\n• Sus placas NFC mostrarán "Perfil no disponible".\n\nNo se borra nada; puedes reactivarla cuando quieras.`)) return
    const { error } = await supabase.from('workspaces').update({ status: next }).eq('id', company.id)
    if (error) { notify(errorMessage(error)); return }
    notify(next === 'Activo' ? 'Empresa reactivada' : 'Empresa suspendida'); await afterChange()
  }

  const remove = async (company: PlatformWorkspace) => {
    if (!supabase) return
    const typed = window.prompt(`Esto BORRA para siempre "${company.name}" con sus ${company.tags} tags, perfiles, enlaces, estadísticas y accesos.\n\nSi solo quieres pausarla, usa "Suspender".\n\nPara confirmar, escribe el nombre exacto de la empresa:`)
    if (typed === null) return
    if (typed.trim() !== company.name) { notify('El nombre no coincide. No se borró nada.'); return }
    const { error } = await supabase.from('workspaces').delete().eq('id', company.id)
    if (error) { notify(errorMessage(error)); return }
    notify('Empresa eliminada'); await afterChange()
  }

  const filtered = (companies ?? []).filter((company) => `${company.name} ${company.contact_name ?? ''} ${company.contact_email ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  const totals = (companies ?? []).reduce((sum, company) => ({ plates: sum.plates + company.plates_count, tags: sum.tags + Number(company.tags), active: sum.active + (company.status === 'Activo' ? 1 : 0) }), { plates: 0, tags: 0, active: 0 })

  return <div className="admin-page">
    <section className="page-heading"><div><p className="eyebrow">ADMINISTRACIÓN DE LA PLATAFORMA</p><h1>Empresas <span>✦</span></h1><p className="subheading">Da de alta y da mantenimiento a las empresas que compran tus placas NFC.</p></div><button className="primary-button" onClick={() => setEditing('new')}><Plus size={17} /> Nueva empresa</button></section>
    <section className="admin-summary">
      <div><Building2 size={20} /><span><strong>{totals.active} de {companies?.length ?? 0} activas</strong><small>empresas registradas</small></span></div>
      <div><Building2 size={20} /><span><strong>{totals.plates.toLocaleString('es-MX')} placas vendidas</strong><small>según lo registrado</small></span></div>
      <div><Building2 size={20} /><span><strong>{totals.tags.toLocaleString('es-MX')} tags configurados</strong><small>en todas las empresas</small></span></div>
    </section>
    <section className="panel admins-panel">
      <div className="panel-header"><div><h2>Todas las empresas</h2><p>"Entrar" te lleva a la consola de esa empresa para configurarla por ellos.</p></div><label className="search-field"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar empresa o contacto" /></label></div>
      {companies === null ? <p className="empty-state">Cargando empresas...</p> : <div className="table-wrap"><table><thead><tr><th>EMPRESA</th><th>CONTACTO</th><th>PLACAS</th><th>TAGS</th><th>USUARIOS</th><th>ESCANEOS 30D</th><th>ESTADO</th><th /></tr></thead><tbody>
        {filtered.map((company) => <tr key={company.id} className={company.id === currentWorkspaceId ? 'current-row' : ''}>
          <td><div className="admin-name"><span className="admin-avatar">{initials(company.name)}</span><span><strong>{company.name}</strong><small>Desde {formatDate(company.created_at)}</small></span></div></td>
          <td><div className="stacked"><span>{company.contact_name ?? '—'}</span><small>{[company.contact_email, company.contact_phone].filter(Boolean).join(' · ')}</small></div></td>
          <td><strong>{company.plates_count}</strong></td>
          <td>{company.tags}{company.plates_count > 0 && Number(company.tags) < company.plates_count && <small className="warn"> ({company.plates_count - Number(company.tags)} sin configurar)</small>}</td>
          <td>{company.members}</td>
          <td>{company.scans_30d}</td>
          <td><span className={`status ${company.status === 'Activo' ? 'active' : 'paused'}`}><i />{company.status}</span></td>
          <td><div className="row-actions">
            <button className="outline-button" onClick={() => enterWorkspace(company.id)}><LogIn size={13} /> Entrar</button>
            <button className="row-action" onClick={() => setInviteTo(company)} title="Dar acceso a una persona"><UserPlus size={16} /></button>
            <button className="row-action" onClick={() => setEditing(company)} title="Editar datos"><Pencil size={16} /></button>
            <button className="row-action" onClick={() => void toggleStatus(company)} title={company.status === 'Activo' ? 'Suspender' : 'Reactivar'}>{company.status === 'Activo' ? <Pause size={16} /> : <Play size={16} />}</button>
            <button className="row-action danger" onClick={() => void remove(company)} title="Eliminar"><Trash2 size={16} /></button>
          </div></td>
        </tr>)}
      </tbody></table>{!filtered.length && <p className="empty-state">{companies.length ? 'Ninguna empresa coincide con la búsqueda.' : 'Aún no hay empresas. Crea la primera.'}</p>}</div>}
    </section>
    {editing && <CompanyModal company={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={async (message, created) => { notify(message); setEditing(null); await afterChange(); if (created) setInviteTo(created) }} />}
    {inviteTo && <InviteModal workspaceId={inviteTo.id} workspaceName={inviteTo.name} onClose={() => setInviteTo(null)} onDone={(message) => { notify(message); void load() }} />}
  </div>
}

function CompanyModal({ company, onClose, onSaved }: { company: PlatformWorkspace | null; onClose: () => void; onSaved: (message: string, created?: { id: string; name: string }) => void }) {
  const [form, setForm] = useState({ name: company?.name ?? '', contact_name: company?.contact_name ?? '', contact_email: company?.contact_email ?? '', contact_phone: company?.contact_phone ?? '', plates_count: company?.plates_count ?? 0, notes: company?.notes ?? '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const field = (key: keyof typeof form) => ({ value: form[key], onChange: (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: key === 'plates_count' ? Math.max(0, Number(event.target.value) || 0) : event.target.value })) })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    setSaving(true); setError('')
    if (company) {
      const { error: updateError } = await supabase.from('workspaces').update({ name: form.name.trim(), contact_name: form.contact_name.trim() || null, contact_email: form.contact_email.trim().toLowerCase() || null, contact_phone: form.contact_phone.trim() || null, plates_count: form.plates_count, notes: form.notes.trim() || null }).eq('id', company.id)
      setSaving(false)
      if (updateError) { setError(errorMessage(updateError)); return }
      onSaved('Datos de la empresa actualizados')
      return
    }
    const { data, error: rpcError } = await supabase.rpc('create_workspace', { p_name: form.name, p_contact_name: form.contact_name, p_contact_email: form.contact_email, p_contact_phone: form.contact_phone, p_plates: form.plates_count, p_notes: form.notes })
    setSaving(false)
    if (rpcError) { setError(errorMessage(rpcError)); return }
    onSaved(`Empresa "${form.name.trim()}" creada. Ahora dale acceso a su administrador.`, { id: data as string, name: form.name.trim() })
  }

  return <div className="modal-backdrop" onClick={onClose}><form className="invite-modal wide" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
    <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
    <p className="eyebrow">{company ? 'MANTENIMIENTO' : 'ALTA DE CLIENTE'}</p><h2>{company ? `Editar ${company.name}` : 'Nueva empresa'}</h2>
    <p className="modal-copy">{company ? 'Estos datos son internos; la empresa solo ve su nombre.' : 'Crea el espacio de la empresa. En el siguiente paso invitas a su administrador.'}</p>
    <label>Nombre de la empresa<input {...field('name')} required minLength={2} maxLength={120} placeholder="Ej. Tacos El Güero" /></label>
    <div className="form-row"><label>Persona de contacto<input {...field('contact_name')} maxLength={100} /></label><label>Teléfono<input {...field('contact_phone')} maxLength={30} /></label></div>
    <div className="form-row"><label>Correo de contacto<input type="email" {...field('contact_email')} maxLength={254} /></label><label>Placas vendidas<input type="number" min={0} {...field('plates_count')} /></label></div>
    <label>Notas internas<textarea {...field('notes')} rows={3} maxLength={1000} placeholder="Ej. Pagó 20 placas el 12/09. Renovación anual en septiembre." /></label>
    {error && <p className="form-error">{error}</p>}
    <button className="primary-button auth-submit" type="submit" disabled={saving}>{saving ? 'Guardando...' : company ? 'Guardar cambios' : 'Crear empresa'}</button>
  </form></div>
}
