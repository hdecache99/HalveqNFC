import { useState, type FormEvent } from 'react'
import { Building2, KeyRound, Save, UserRound } from 'lucide-react'
import { isAdmin, type AppContext } from '../appContext'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../lib/format'

export function SettingsView({ app }: { app: AppContext }) {
  return <div className="admin-page">
    <section className="page-heading"><div><p className="eyebrow">AJUSTES</p><h1>Configuración <span>✦</span></h1><p className="subheading">Tu cuenta y los datos de {app.workspace.name}.</p></div></section>
    <div className="settings-grid">
      <AccountForm app={app} />
      <PasswordForm app={app} />
      {isAdmin(app) && <CompanyForm app={app} />}
    </div>
  </div>
}

function AccountForm({ app }: { app: AppContext }) {
  const [name, setName] = useState(app.session.name)
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } })
    if (!error) {
      // El nombre del miembro solo lo puede cambiar un administrador; para operadores basta con el de la cuenta.
      const me = app.members.find((member) => member.user_id === app.session.userId)
      if (me && isAdmin(app)) { await supabase.from('workspace_members').update({ name: name.trim() }).eq('id', me.id); app.setMembers((current) => current.map((member) => member.id === me.id ? { ...member, name: name.trim() } : member)) }
      app.setSessionName(name.trim())
    }
    setSaving(false)
    app.notify(error ? errorMessage(error) : 'Nombre actualizado')
  }

  return <form className="panel stack-form" onSubmit={submit}>
    <h2><UserRound size={16} /> Mi cuenta</h2>
    <label>Nombre que se muestra<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={100} /></label>
    <label>Correo<input value={app.session.email} disabled /><small className="field-hint">Para cambiar el correo, contacta a tu proveedor.</small></label>
    <p className="field-hint">Tu rol aquí: <strong>{app.session.isPlatformAdmin ? 'Administrador de la plataforma' : app.role}</strong></p>
    <button className="primary-button" type="submit" disabled={saving}><Save size={15} /> {saving ? 'Guardando...' : 'Guardar'}</button>
  </form>
}

function PasswordForm({ app }: { app: AppContext }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    if (password !== confirmation) { app.notify('Las contraseñas no coinciden.'); return }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,}/.test(password)) { app.notify('Usa al menos 12 caracteres, mayúscula, minúscula, número y símbolo.'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) { app.notify(errorMessage(error)); return }
    setPassword(''); setConfirmation(''); app.notify('Contraseña actualizada')
  }

  return <form className="panel stack-form" onSubmit={submit}>
    <h2><KeyRound size={16} /> Seguridad</h2>
    <label>Nueva contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={12} required /></label>
    <label>Confirmar contraseña<input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={12} required /></label>
    <p className="field-hint">Mínimo 12 caracteres con mayúscula, minúscula, número y símbolo.</p>
    <button className="primary-button" type="submit" disabled={saving}><KeyRound size={15} /> {saving ? 'Guardando...' : 'Cambiar contraseña'}</button>
  </form>
}

function CompanyForm({ app }: { app: AppContext }) {
  const [form, setForm] = useState({ name: app.workspace.name, contact_name: app.workspace.contact_name ?? '', contact_email: app.workspace.contact_email ?? '', contact_phone: app.workspace.contact_phone ?? '' })
  const [saving, setSaving] = useState(false)
  const field = (key: keyof typeof form) => ({ value: form[key], onChange: (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value })) })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    setSaving(true)
    const changes = { name: form.name.trim(), contact_name: form.contact_name.trim() || null, contact_email: form.contact_email.trim().toLowerCase() || null, contact_phone: form.contact_phone.trim() || null }
    const { error } = await supabase.from('workspaces').update(changes).eq('id', app.workspace.id)
    setSaving(false)
    if (error) { app.notify(errorMessage(error)); return }
    app.setWorkspace({ ...app.workspace, ...changes }); app.notify('Datos de la empresa guardados')
  }

  return <form className="panel stack-form wide" onSubmit={submit}>
    <h2><Building2 size={16} /> Empresa</h2>
    <label>Nombre de la empresa<input {...field('name')} required minLength={2} maxLength={120} /></label>
    <div className="form-row"><label>Persona de contacto<input {...field('contact_name')} maxLength={100} /></label><label>Teléfono<input {...field('contact_phone')} maxLength={30} /></label></div>
    <label>Correo de contacto<input type="email" {...field('contact_email')} maxLength={254} /></label>
    <p className="field-hint">Placas contratadas: <strong>{app.workspace.plates_count}</strong> · Estado: <strong>{app.workspace.status}</strong>{!app.session.isPlatformAdmin && ' (los administra tu proveedor)'}</p>
    <button className="primary-button" type="submit" disabled={saving}><Save size={15} /> {saving ? 'Guardando...' : 'Guardar empresa'}</button>
  </form>
}
