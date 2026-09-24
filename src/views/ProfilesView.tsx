import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Plus, Save, Trash2, Upload, X } from 'lucide-react'
import type { AppContext } from '../appContext'
import { supabase } from '../lib/supabase'
import { errorMessage, toSlug } from '../lib/format'
import { ProfileCard, profileBackground } from '../components/ProfileCard'
import { LINK_COLUMNS, PROFILE_COLUMNS, type LinktreeProfile, type ManagedLink, type ProfileDesign } from '../types'

const presets: Array<{ name: string; design: Partial<ProfileDesign> }> = [
  { name: 'Arena', design: { bg_style: 'gradient', bg_color: '#f5e6d8', bg_color_2: '#dcece5', text_color: '#292a26', button_color: '#292a26', button_text_color: '#f7f5eb' } },
  { name: 'Noche', design: { bg_style: 'gradient', bg_color: '#1f2230', bg_color_2: '#3b2f4a', text_color: '#f4f1ea', button_color: '#f0a18b', button_text_color: '#1f2230' } },
  { name: 'Océano', design: { bg_style: 'gradient', bg_color: '#d8ecf3', bg_color_2: '#7fb3c8', text_color: '#0f2d3a', button_color: '#0f4c5c', button_text_color: '#ffffff' } },
  { name: 'Bosque', design: { bg_style: 'solid', bg_color: '#e7efe3', bg_color_2: '#e7efe3', text_color: '#1e3a26', button_color: '#2f6b3e', button_text_color: '#ffffff' } },
  { name: 'Rosa', design: { bg_style: 'gradient', bg_color: '#fde2e4', bg_color_2: '#fad2e1', text_color: '#5a2a3a', button_color: '#c2456e', button_text_color: '#ffffff' } },
  { name: 'Minimal', design: { bg_style: 'solid', bg_color: '#ffffff', bg_color_2: '#ffffff', text_color: '#111111', button_color: '#111111', button_text_color: '#ffffff' } },
]
const designKeys: Array<keyof ProfileDesign> = ['logo_url', 'bio', 'bg_style', 'bg_color', 'bg_color_2', 'bg_image_url', 'text_color', 'button_color', 'button_text_color', 'button_shape']
const pickDesign = (profile: LinktreeProfile): ProfileDesign => Object.fromEntries(designKeys.map((key) => [key, profile[key]])) as ProfileDesign

export function ProfilesView({ app }: { app: AppContext }) {
  const [selectedId, setSelectedId] = useState(app.profiles[0]?.id ?? '')
  const [tab, setTab] = useState<'diseno' | 'enlaces' | 'datos'>('diseno')
  const [creating, setCreating] = useState(false)
  const selected = app.profiles.find((profile) => profile.id === selectedId) ?? app.profiles[0]

  useEffect(() => { if (!selected && app.profiles[0]) setSelectedId(app.profiles[0].id) }, [selected, app.profiles])

  return <div className="admin-page">
    <section className="page-heading"><div><p className="eyebrow">LINKTREE</p><h1>Perfiles y enlaces <span>✦</span></h1><p className="subheading">El perfil es la página que ve tu cliente al acercar su celular a la placa. Personalízalo con tu marca.</p></div><button className="primary-button" onClick={() => setCreating(true)}><Plus size={17} /> Nuevo perfil</button></section>
    {app.profiles.length > 1 && <div className="profile-tabs">{app.profiles.map((profile) => <button key={profile.id} className={profile.id === selected?.id ? 'selected' : ''} onClick={() => setSelectedId(profile.id)}>{profile.logo_url ? <img src={profile.logo_url} alt="" /> : <span style={{ background: profile.button_color }} />}{profile.client_name} · {profile.name}{profile.status === 'Pausado' && <em>Pausado</em>}</button>)}</div>}
    {selected ? <ProfileEditor key={selected.id} app={app} profile={selected} tab={tab} setTab={setTab} onDeleted={() => setSelectedId('')} /> : <section className="panel empty-panel"><h2>Aún no tienes perfiles</h2><p className="modal-copy">Crea tu primer perfil para empezar a personalizar la página que verán tus clientes.</p><button className="primary-button" onClick={() => setCreating(true)}><Plus size={16} /> Crear perfil</button></section>}
    {creating && <NewProfileModal app={app} onClose={() => setCreating(false)} onCreated={(id) => { setSelectedId(id); setTab('diseno'); setCreating(false) }} />}
  </div>
}

function ProfileEditor({ app, profile, tab, setTab, onDeleted }: { app: AppContext; profile: LinktreeProfile; tab: 'diseno' | 'enlaces' | 'datos'; setTab: (tab: 'diseno' | 'enlaces' | 'datos') => void; onDeleted: () => void }) {
  const [design, setDesign] = useState<ProfileDesign>(pickDesign(profile))
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(design) !== JSON.stringify(pickDesign(profile))
  const profileLinks = app.links.filter((link) => link.profile_id === profile.id).sort((first, second) => first.position - second.position)
  const usedBy = app.tags.filter((tag) => tag.profile_id === profile.id)
  const update = (changes: Partial<ProfileDesign>) => setDesign((current) => ({ ...current, ...changes }))

  const saveProfile = async (changes: Partial<LinktreeProfile>, message: string) => {
    if (!supabase) return false
    const { error } = await supabase.from('linktree_profiles').update(changes).eq('id', profile.id)
    if (error) { app.notify(errorMessage(error)); return false }
    app.setProfiles((current) => current.map((item) => item.id === profile.id ? { ...item, ...changes } : item))
    app.notify(message)
    return true
  }

  const saveDesign = async () => {
    setSaving(true)
    await saveProfile({ ...design, bio: design.bio?.trim() || null }, 'Diseño guardado. Ya se ve en tus placas.')
    setSaving(false)
  }

  return <div className="profile-editor">
    <div className="profile-editor-main panel">
      <div className="editor-tabs" role="tablist">{([['diseno', 'Diseño'], ['enlaces', `Enlaces (${profileLinks.length})`], ['datos', 'Datos del perfil']] as const).map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'selected' : ''} onClick={() => setTab(key)}>{label}</button>)}</div>
      {tab === 'diseno' && <DesignForm app={app} profile={profile} design={design} update={update} />}
      {tab === 'enlaces' && <LinksEditor app={app} profile={profile} links={profileLinks} />}
      {tab === 'datos' && <ProfileDataForm app={app} profile={profile} usedBy={usedBy.map((tag) => tag.name)} saveProfile={saveProfile} onDeleted={onDeleted} />}
    </div>
    <aside className="profile-preview-column">
      <div className="preview-label"><span>Vista previa</span>{dirty && <em>Cambios sin guardar</em>}</div>
      <div className="phone-frame"><div className="phone-screen" style={profileBackground(design)}><ProfileCard design={design} title={profile.name} businessName={profile.client_name} links={profileLinks.filter((link) => link.active)} onLinkClick={() => undefined} footer={<small className="profile-footer">Enlaces · por PulseTag</small>} /></div></div>
      {tab === 'diseno' && <div className="preview-actions"><button className="primary-button" onClick={() => void saveDesign()} disabled={!dirty || saving}><Save size={15} /> {saving ? 'Guardando...' : 'Guardar diseño'}</button>{dirty && <button className="outline-button" onClick={() => setDesign(pickDesign(profile))}>Descartar</button>}</div>}
      <p className="preview-note">{usedBy.length ? `Lo abren ${usedBy.length} tag${usedBy.length === 1 ? '' : 's'}: ${usedBy.map((tag) => tag.name).join(', ')}` : 'Ningún tag abre este perfil todavía. Asígnalo en "Tags NFC".'}</p>
    </aside>
  </div>
}

function DesignForm({ app, profile, design, update }: { app: AppContext; profile: LinktreeProfile; design: ProfileDesign; update: (changes: Partial<ProfileDesign>) => void }) {
  const [uploading, setUploading] = useState<'logo' | 'fondo' | null>(null)
  const logoInput = useRef<HTMLInputElement>(null)
  const backgroundInput = useRef<HTMLInputElement>(null)

  const upload = async (file: File | undefined, kind: 'logo' | 'fondo') => {
    if (!file || !supabase) return
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) { app.notify('Usa una imagen PNG, JPG, WEBP o GIF.'); return }
    if (file.size > 2 * 1024 * 1024) { app.notify('La imagen debe pesar menos de 2 MB.'); return }
    setUploading(kind)
    const extension = file.type.split('/')[1].replace('jpeg', 'jpg')
    const path = `${app.workspace.id}/${profile.id}/${kind}-${Date.now()}.${extension}`
    const { error } = await supabase.storage.from('brand-assets').upload(path, file, { contentType: file.type, cacheControl: '31536000' })
    setUploading(null)
    if (error) { app.notify(error.message.includes('Bucket not found') ? 'Falta crear el almacenamiento de imágenes (corre la migración en Supabase).' : errorMessage(error)); return }
    const url = supabase.storage.from('brand-assets').getPublicUrl(path).data.publicUrl
    update(kind === 'logo' ? { logo_url: url } : { bg_image_url: url, bg_style: 'image' })
    app.notify(kind === 'logo' ? 'Logo cargado. Pulsa "Guardar diseño" para publicarlo.' : 'Fondo cargado. Pulsa "Guardar diseño" para publicarlo.')
  }

  const color = (label: string, key: 'bg_color' | 'bg_color_2' | 'text_color' | 'button_color' | 'button_text_color') => <label className="color-field">{label}<span><input type="color" value={design[key]} onChange={(event) => update({ [key]: event.target.value })} /><input value={design[key]} onChange={(event) => /^#[0-9a-fA-F]{0,6}$/.test(event.target.value) && update({ [key]: event.target.value })} onBlur={(event) => !/^#[0-9a-fA-F]{6}$/.test(event.target.value) && update({ [key]: profile[key] })} maxLength={7} /></span></label>

  return <div className="design-form">
    <section><h3>Logo de la marca</h3><p className="field-hint">Cuadrado, mínimo 200×200 px. PNG con fondo transparente se ve mejor.</p>
      <div className="logo-uploader">{design.logo_url ? <img src={design.logo_url} alt="Logo" /> : <span className="logo-empty"><ImagePlus size={22} /></span>}<div><button className="outline-button" onClick={() => logoInput.current?.click()} disabled={uploading !== null}><Upload size={13} /> {uploading === 'logo' ? 'Subiendo...' : design.logo_url ? 'Cambiar logo' : 'Subir logo'}</button>{design.logo_url && <button className="text-link" onClick={() => update({ logo_url: null })}>Quitar</button>}</div><input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(event) => { void upload(event.target.files?.[0], 'logo'); event.target.value = '' }} /></div>
    </section>
    <section><h3>Descripción</h3><textarea value={design.bio ?? ''} onChange={(event) => update({ bio: event.target.value.slice(0, 280) })} placeholder="Ej. Tacos al pastor desde 1998 · Abierto todos los días de 1 a 11 pm" rows={3} /><small className="field-hint">{(design.bio ?? '').length}/280 caracteres</small></section>
    <section><h3>Temas rápidos</h3><div className="preset-grid">{presets.map((preset) => <button key={preset.name} onClick={() => update(preset.design)} style={{ background: preset.design.bg_style === 'gradient' ? `linear-gradient(160deg, ${preset.design.bg_color}, ${preset.design.bg_color_2})` : preset.design.bg_color, color: preset.design.text_color }}><i style={{ background: preset.design.button_color }} />{preset.name}</button>)}</div></section>
    <section><h3>Fondo</h3>
      <div className="segmented">{([['solid', 'Color sólido'], ['gradient', 'Degradado'], ['image', 'Imagen']] as const).map(([key, label]) => <button key={key} className={design.bg_style === key ? 'selected' : ''} onClick={() => key === 'image' && !design.bg_image_url ? backgroundInput.current?.click() : update({ bg_style: key })}>{label}</button>)}</div>
      <div className="color-grid">{color(design.bg_style === 'gradient' ? 'Color inicial' : 'Color de fondo', 'bg_color')}{design.bg_style === 'gradient' && color('Color final', 'bg_color_2')}</div>
      {design.bg_style === 'image' && <div className="logo-uploader">{design.bg_image_url && <img className="wide" src={design.bg_image_url} alt="Fondo" />}<button className="outline-button" onClick={() => backgroundInput.current?.click()} disabled={uploading !== null}><Upload size={13} /> {uploading === 'fondo' ? 'Subiendo...' : design.bg_image_url ? 'Cambiar imagen' : 'Subir imagen'}</button>{design.bg_image_url && <button className="text-link" onClick={() => update({ bg_image_url: null, bg_style: 'gradient' })}>Quitar</button>}</div>}
      <input ref={backgroundInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(event) => { void upload(event.target.files?.[0], 'fondo'); event.target.value = '' }} />
    </section>
    <section><h3>Texto y botones</h3>
      <div className="color-grid">{color('Color del texto', 'text_color')}{color('Color de botones', 'button_color')}{color('Texto de botones', 'button_text_color')}</div>
      <p className="field-hint">Forma de los botones</p>
      <div className="segmented">{([['rounded', 'Redondeados'], ['pill', 'Píldora'], ['square', 'Rectos']] as const).map(([key, label]) => <button key={key} className={design.button_shape === key ? 'selected' : ''} onClick={() => update({ button_shape: key })}>{label}</button>)}</div>
    </section>
  </div>
}

function LinksEditor({ app, profile, links }: { app: AppContext; profile: LinktreeProfile; links: ManagedLink[] }) {
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, { label: string; url: string }>>({})

  const normalizeUrl = (value: string) => { const trimmed = value.trim(); return /^(https?:|mailto:|tel:)/i.test(trimmed) ? trimmed : `https://${trimmed}` }

  const addLink = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    setSaving(true)
    const { data, error } = await supabase.from('nfc_links').insert({ profile_id: profile.id, label: label.trim(), url: normalizeUrl(url), position: links.length ? Math.max(...links.map((link) => link.position)) + 1 : 0 }).select(LINK_COLUMNS).single()
    setSaving(false)
    if (error) { app.notify(errorMessage(error)); return }
    app.setLinks((current) => [...current, data as ManagedLink]); setLabel(''); setUrl(''); app.notify('Enlace agregado')
  }

  const updateLink = async (link: ManagedLink, changes: Partial<ManagedLink>, message = 'Enlace actualizado') => {
    if (!supabase) return
    const { error } = await supabase.from('nfc_links').update(changes).eq('id', link.id)
    if (error) { app.notify(errorMessage(error)); return }
    app.setLinks((current) => current.map((item) => item.id === link.id ? { ...item, ...changes } : item)); app.notify(message)
  }

  const saveDraft = (link: ManagedLink) => {
    const draft = drafts[link.id]
    if (!draft) return
    setDrafts(({ [link.id]: _removed, ...rest }) => rest)
    if (!draft.label.trim() || !draft.url.trim()) { app.notify('El texto y la URL no pueden quedar vacíos.'); return }
    const changes = { label: draft.label.trim(), url: normalizeUrl(draft.url) }
    if (changes.label !== link.label || changes.url !== link.url) void updateLink(link, changes)
  }

  const move = async (index: number, direction: -1 | 1) => {
    const target = links[index + direction]
    const link = links[index]
    if (!supabase || !target) return
    const [first, second] = await Promise.all([supabase.from('nfc_links').update({ position: target.position }).eq('id', link.id), supabase.from('nfc_links').update({ position: link.position }).eq('id', target.id)])
    if (first.error || second.error) { app.notify(errorMessage(first.error ?? second.error)); return }
    const swapped = target.position === link.position ? { [link.id]: index + direction, [target.id]: index } : { [link.id]: target.position, [target.id]: link.position }
    app.setLinks((current) => current.map((item) => item.id in swapped ? { ...item, position: swapped[item.id] } : item))
  }

  const deleteLink = async (link: ManagedLink) => {
    if (!supabase || !window.confirm(`¿Eliminar el enlace "${link.label}"?`)) return
    const { error } = await supabase.from('nfc_links').delete().eq('id', link.id)
    if (error) { app.notify(errorMessage(error)); return }
    app.setLinks((current) => current.filter((item) => item.id !== link.id)); app.notify('Enlace eliminado')
  }

  return <div className="links-editor">
    <form className="link-add" onSubmit={addLink}><input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Texto del botón (ej. Instagram)" required maxLength={80} /><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="instagram.com/tu-negocio" required /><button className="primary-button" type="submit" disabled={saving}><Plus size={15} /> Agregar</button></form>
    <p className="field-hint">Tip: para WhatsApp usa <code>wa.me/521XXXXXXXXXX</code>, para llamar <code>tel:+52...</code>. Los cambios en un enlace se guardan al salir del campo.</p>
    <div className="link-list">{links.map((link, index) => {
      const draft = drafts[link.id] ?? { label: link.label, url: link.url }
      const edit = (changes: Partial<typeof draft>) => setDrafts((current) => ({ ...current, [link.id]: { ...draft, ...changes } }))
      return <div className={`link-item ${link.active ? '' : 'inactive'}`} key={link.id}>
        <div className="link-order"><button className="row-action" onClick={() => void move(index, -1)} disabled={index === 0} aria-label="Subir"><ArrowUp size={14} /></button><button className="row-action" onClick={() => void move(index, 1)} disabled={index === links.length - 1} aria-label="Bajar"><ArrowDown size={14} /></button></div>
        <div className="link-fields"><input value={draft.label} onChange={(event) => edit({ label: event.target.value })} onBlur={() => saveDraft(link)} aria-label="Texto" maxLength={80} /><input value={draft.url} onChange={(event) => edit({ url: event.target.value })} onBlur={() => saveDraft(link)} aria-label="URL" /></div>
        <button className="row-action" onClick={() => void updateLink(link, { active: !link.active }, link.active ? 'Enlace oculto' : 'Enlace visible')} title={link.active ? 'Ocultar' : 'Mostrar'}>{link.active ? <Eye size={16} /> : <EyeOff size={16} />}</button>
        <button className="row-action danger" onClick={() => void deleteLink(link)} title="Eliminar"><Trash2 size={16} /></button>
      </div>
    })}{!links.length && <p className="empty-state">Este perfil aún no tiene enlaces. Agrega el primero arriba.</p>}</div>
  </div>
}

function ProfileDataForm({ app, profile, usedBy, saveProfile, onDeleted }: { app: AppContext; profile: LinktreeProfile; usedBy: string[]; saveProfile: (changes: Partial<LinktreeProfile>, message: string) => Promise<boolean>; onDeleted: () => void }) {
  const [name, setName] = useState(profile.name)
  const [clientName, setClientName] = useState(profile.client_name)

  const remove = async () => {
    if (!supabase || !window.confirm(`¿Eliminar el perfil "${profile.name}"?\n\nSe borrarán sus enlaces.${usedBy.length ? ` Los tags ${usedBy.join(', ')} dejarán de mostrar contenido hasta que les asignes otro perfil.` : ''}`)) return
    const { error } = await supabase.from('linktree_profiles').delete().eq('id', profile.id)
    if (error) { app.notify(errorMessage(error)); return }
    app.setProfiles((current) => current.filter((item) => item.id !== profile.id))
    app.setLinks((current) => current.filter((item) => item.profile_id !== profile.id))
    app.setTags((current) => current.map((tag) => tag.profile_id === profile.id ? { ...tag, profile_id: null } : tag))
    app.notify('Perfil eliminado'); onDeleted()
  }

  return <div className="design-form">
    <form className="stack-form" onSubmit={(event) => { event.preventDefault(); void saveProfile({ name: name.trim(), client_name: clientName.trim() }, 'Datos del perfil guardados') }}>
      <label>Nombre del negocio (título público)<input value={clientName} onChange={(event) => setClientName(event.target.value)} required maxLength={80} /></label>
      <label>Nombre interno del perfil<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} /><small className="field-hint">Ej. "Sucursal Centro" o "Menú de temporada". Aparece como subtítulo si es distinto al negocio.</small></label>
      <button className="primary-button" type="submit"><Save size={15} /> Guardar datos</button>
    </form>
    <section><h3>Estado</h3><p className="field-hint">{profile.status === 'Activo' ? 'El perfil está visible para quien escanee sus tags.' : 'El perfil está pausado: sus tags muestran "Perfil no disponible".'}</p><button className="outline-button" onClick={() => void saveProfile({ status: profile.status === 'Activo' ? 'Pausado' : 'Activo' }, profile.status === 'Activo' ? 'Perfil pausado' : 'Perfil activado')}>{profile.status === 'Activo' ? 'Pausar perfil' : 'Activar perfil'}</button></section>
    <section className="danger-zone"><h3>Eliminar perfil</h3><p className="field-hint">Esta acción no se puede deshacer.</p><button className="outline-button danger" onClick={() => void remove()}><Trash2 size={13} /> Eliminar perfil</button></section>
  </div>
}

function NewProfileModal({ app, onClose, onCreated }: { app: AppContext; onClose: () => void; onCreated: (id: string) => void }) {
  const [clientName, setClientName] = useState(app.workspace.name)
  const [name, setName] = useState('Perfil principal')
  const [saving, setSaving] = useState(false)

  const create = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !app.storeId) { app.notify('Esta empresa no tiene una tienda configurada.'); return }
    setSaving(true)
    const slug = `${toSlug(name) || 'perfil'}-${Math.random().toString(36).slice(2, 7)}`
    const { data, error } = await supabase.from('linktree_profiles').insert({ workspace_id: app.workspace.id, store_id: app.storeId, name: name.trim(), client_name: clientName.trim(), slug }).select(PROFILE_COLUMNS).single()
    setSaving(false)
    if (error) { app.notify(errorMessage(error)); return }
    app.setProfiles((current) => [data as LinktreeProfile, ...current]); app.notify('Perfil creado. Ahora personalízalo.'); onCreated(data.id)
  }

  return <div className="modal-backdrop" onClick={onClose}><form className="invite-modal" onSubmit={create} onClick={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button><p className="eyebrow">NUEVO PERFIL</p><h2>Crear perfil</h2><p className="modal-copy">Después podrás subir el logo, cambiar colores y agregar enlaces.</p><label>Nombre del negocio<input value={clientName} onChange={(event) => setClientName(event.target.value)} required maxLength={80} /></label><label>Nombre interno<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} /></label><button className="primary-button auth-submit" type="submit" disabled={saving}>{saving ? 'Creando...' : 'Crear perfil'}</button></form></div>
}
