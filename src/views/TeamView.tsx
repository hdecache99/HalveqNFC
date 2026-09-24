import { useState, type FormEvent } from 'react'
import { Clock, Info, Plus, ShieldCheck, Trash2, UserCheck, Users, X } from 'lucide-react'
import type { AppContext } from '../appContext'
import { supabase } from '../lib/supabase'
import { errorMessage, formatDate, initials } from '../lib/format'
import type { Invitation, Member, Role } from '../types'

export function TeamView({ app }: { app: AppContext }) {
  const [inviting, setInviting] = useState(false)

  const updateMember = async (member: Member, changes: Partial<Member>, message: string) => {
    if (!supabase) return
    const { error } = await supabase.from('workspace_members').update(changes).eq('id', member.id)
    if (error) { app.notify(errorMessage(error)); return }
    app.setMembers((current) => current.map((item) => item.id === member.id ? { ...item, ...changes } : item)); app.notify(message)
  }

  const removeMember = async (member: Member) => {
    if (!supabase || !window.confirm(`¿Quitar a ${member.name} de ${app.workspace.name}?\n\nPerderá el acceso de inmediato. Su cuenta no se borra: puedes volver a invitarlo cuando quieras.`)) return
    const { error } = await supabase.from('workspace_members').delete().eq('id', member.id)
    if (error) { app.notify(errorMessage(error)); return }
    app.setMembers((current) => current.filter((item) => item.id !== member.id)); app.notify('Acceso eliminado')
  }

  const cancelInvitation = async (invitation: Invitation) => {
    if (!supabase) return
    const { error } = await supabase.from('workspace_invitations').delete().eq('id', invitation.id)
    if (error) { app.notify(errorMessage(error)); return }
    app.setInvitations((current) => current.filter((item) => item.id !== invitation.id)); app.notify('Invitación cancelada')
  }

  const admins = app.members.filter((member) => member.role === 'Administrador' && member.status === 'Activo').length

  return <div className="admin-page">
    <section className="page-heading"><div><p className="eyebrow">ACCESOS DE {app.workspace.name.toUpperCase()}</p><h1>Equipo <span>✦</span></h1><p className="subheading">Personas que pueden entrar a administrar esta empresa.</p></div><button className="primary-button" onClick={() => setInviting(true)}><Plus size={17} /> Invitar persona</button></section>
    <section className="admin-summary">
      <div><Users size={20} /><span><strong>{app.members.length} {app.members.length === 1 ? 'persona' : 'personas'}</strong><small>con cuenta en esta empresa</small></span></div>
      <div><ShieldCheck size={20} /><span><strong>{admins} administradores</strong><small>pueden invitar y cambiar ajustes</small></span></div>
      <div><Clock size={20} /><span><strong>{app.invitations.length} pendientes</strong><small>invitaciones sin registrarse</small></span></div>
    </section>
    <div className="callout"><Info size={16} /><span><strong>Roles:</strong> un <em>Administrador</em> puede todo (tags, perfiles, equipo y datos de la empresa). Un <em>Operador</em> puede crear tags, editar perfiles y ver resultados, pero no gestionar el equipo ni la configuración.</span></div>
    <section className="panel admins-panel">
      <div className="panel-header"><div><h2>Miembros</h2><p>Cambia el rol o el estado directamente en la tabla.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>PERSONA</th><th>ROL</th><th>ESTADO</th><th>DESDE</th><th /></tr></thead><tbody>
        {app.members.map((member) => {
          const isMe = member.user_id === app.session.userId
          return <tr key={member.id}>
            <td><div className="admin-name"><span className="admin-avatar">{initials(member.name)}</span><span><strong>{member.name}{isMe && ' (tú)'}</strong><small>{member.email}</small></span></div></td>
            <td><select className="role-select" value={member.role} disabled={isMe} title={isMe ? 'No puedes cambiar tu propio rol' : undefined} onChange={(event) => void updateMember(member, { role: event.target.value as Role }, 'Rol actualizado')}><option>Administrador</option><option>Operador</option></select></td>
            <td><button className={`status ${member.status === 'Activo' ? 'active' : 'paused'} status-button`} disabled={isMe} title={isMe ? undefined : member.status === 'Activo' ? 'Pausar acceso' : 'Reactivar acceso'} onClick={() => void updateMember(member, { status: member.status === 'Activo' ? 'Pendiente' : 'Activo' }, member.status === 'Activo' ? 'Acceso pausado' : 'Acceso reactivado')}><i />{member.status === 'Activo' ? 'Activo' : 'Pausado'}</button></td>
            <td>{formatDate(member.created_at)}</td>
            <td>{!isMe && <button className="row-action danger" onClick={() => void removeMember(member)} aria-label={`Quitar a ${member.name}`}><Trash2 size={16} /></button>}</td>
          </tr>
        })}
        {app.invitations.map((invitation) => <tr key={invitation.id} className="pending-row">
          <td><div className="admin-name"><span className="admin-avatar pending"><Clock size={12} /></span><span><strong>{invitation.name}</strong><small>{invitation.email}</small></span></div></td>
          <td>{invitation.role}</td>
          <td><span className="status paused"><i />Esperando registro</span></td>
          <td>{formatDate(invitation.created_at)}</td>
          <td><button className="row-action" onClick={() => void cancelInvitation(invitation)} aria-label="Cancelar invitación"><X size={16} /></button></td>
        </tr>)}
      </tbody></table></div>
    </section>
    {inviting && <InviteModal app={app} onClose={() => setInviting(false)} />}
  </div>
}

export function InviteModal({ app, onClose, workspaceId, workspaceName, onDone }: { app?: AppContext; onClose: () => void; workspaceId?: string; workspaceName?: string; onDone?: (message: string) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>(app ? 'Operador' : 'Administrador')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const targetId = workspaceId ?? app?.workspace.id
  const targetName = workspaceName ?? app?.workspace.name

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !targetId) return
    setSaving(true); setError('')
    const { data, error: rpcError } = await supabase.rpc('invite_member', { target_workspace: targetId, member_email: email, member_name: name, member_role: role })
    setSaving(false)
    if (rpcError) { setError(errorMessage(rpcError)); return }
    const message = data === 'added' ? `${name} ya tenía cuenta: ahora tiene acceso a ${targetName}.` : `Invitación creada. Pide a ${name} que se registre con ${email.trim().toLowerCase()}.`
    if (app && supabase) {
      const client = supabase
      const [members, invitations] = await Promise.all([
        client.from('workspace_members').select('id, user_id, name, email, role, status, created_at').eq('workspace_id', targetId).order('created_at'),
        client.from('workspace_invitations').select('id, name, email, role, created_at').eq('workspace_id', targetId).order('created_at'),
      ])
      if (members.data) app.setMembers(members.data as Member[])
      if (invitations.data) app.setInvitations(invitations.data as Invitation[])
      app.notify(message)
    }
    onDone?.(message)
    onClose()
  }

  return <div className="modal-backdrop" onClick={onClose}><form className="invite-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
    <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
    <p className="eyebrow">NUEVO ACCESO · {targetName?.toUpperCase()}</p><h2>Invitar persona</h2>
    <p className="modal-copy">Si el correo ya tiene cuenta, obtiene acceso al instante. Si no, se guarda la invitación y tendrá acceso en cuanto se registre y confirme ese correo.</p>
    <label>Nombre completo<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={100} /></label>
    <label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
    <label>Rol<select value={role} onChange={(event) => setRole(event.target.value as Role)}><option value="Operador">Operador — tags, perfiles y resultados</option><option value="Administrador">Administrador — todo, incluido el equipo</option></select></label>
    {error && <p className="form-error">{error}</p>}
    <button className="primary-button auth-submit" type="submit" disabled={saving}><UserCheck size={16} /> {saving ? 'Enviando...' : 'Dar acceso'}</button>
  </form></div>
}
