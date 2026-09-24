import { useState, type FormEvent } from 'react'
import { Copy, ExternalLink, Info, Pause, Play, Plus, QrCode, Trash2 } from 'lucide-react'
import type { AppContext } from '../appContext'
import { supabase } from '../lib/supabase'
import { errorMessage, publicTagUrl, toSlug } from '../lib/format'
import { PROFILE_COLUMNS, TAG_COLUMNS, type LinktreeProfile, type NfcTag } from '../types'

export function TagsView({ app }: { app: AppContext }) {
  const [name, setName] = useState('')
  const [clientName, setClientName] = useState(app.workspace.name)
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [profileId, setProfileId] = useState<string>(app.profiles[0]?.id ?? 'new')
  const [firstUrl, setFirstUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const createTag = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !app.storeId) { app.notify('Esta empresa no tiene una tienda configurada.'); return }
    const safeSlug = toSlug(slug || name)
    if (!safeSlug) { app.notify('Escribe una dirección válida para el tag.'); return }
    setSaving(true)
    try {
      let targetProfile = profileId
      if (profileId === 'new') {
        const { data, error } = await supabase.from('linktree_profiles').insert({ workspace_id: app.workspace.id, store_id: app.storeId, name: name.trim(), client_name: clientName.trim(), slug: safeSlug }).select(PROFILE_COLUMNS).single()
        if (error) throw error
        app.setProfiles((current) => [data as LinktreeProfile, ...current])
        targetProfile = data.id
        if (firstUrl.trim()) {
          const { data: link, error: linkError } = await supabase.from('nfc_links').insert({ profile_id: targetProfile, label: 'Visítanos', url: firstUrl.trim(), position: 0 }).select('id, tag_id, profile_id, label, url, position, active').single()
          if (linkError) throw linkError
          app.setLinks((current) => [...current, link])
        }
      }
      const { data: tag, error } = await supabase.from('nfc_tags').insert({ workspace_id: app.workspace.id, store_id: app.storeId, profile_id: targetProfile, name: name.trim(), client_name: clientName.trim(), slug: safeSlug, destination_url: `${window.location.origin}/t/${safeSlug}` }).select(TAG_COLUMNS).single()
      if (error) throw error
      app.setTags((current) => [tag as NfcTag, ...current])
      setName(''); setSlug(''); setSlugTouched(false); setFirstUrl('')
      if (profileId === 'new') setProfileId(targetProfile)
      app.notify('Tag creado. Copia su URL y grábala en la placa NFC.')
    } catch (error) {
      app.notify(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const updateTag = async (tag: NfcTag, changes: Partial<NfcTag>, message: string) => {
    if (!supabase) return
    const { error } = await supabase.from('nfc_tags').update(changes).eq('id', tag.id)
    if (error) { app.notify(errorMessage(error)); return }
    app.setTags((current) => current.map((item) => item.id === tag.id ? { ...item, ...changes } : item))
    app.notify(message)
  }

  const deleteTag = async (tag: NfcTag) => {
    if (!supabase || !window.confirm(`¿Eliminar el tag "${tag.name}"?\n\nLa placa física dejará de funcionar y se borrarán sus estadísticas de escaneo. El perfil y sus enlaces se conservan.`)) return
    const { error } = await supabase.from('nfc_tags').delete().eq('id', tag.id)
    if (error) { app.notify(errorMessage(error)); return }
    app.setTags((current) => current.filter((item) => item.id !== tag.id))
    app.notify('Tag eliminado')
  }

  const copy = (tag: NfcTag) => navigator.clipboard?.writeText(publicTagUrl(tag.slug, tag.id)).then(() => app.notify('URL copiada. Pégala en tu app de grabado NFC.'), () => app.notify('No se pudo copiar. Selecciona la URL manualmente.'))

  return <div className="admin-page">
    <section className="page-heading"><div><p className="eyebrow">PLACAS FÍSICAS</p><h1>Tags NFC <span>✦</span></h1><p className="subheading">Cada tag es una placa NFC con su propia dirección. Al acercar un celular, abre el perfil que le asignes.</p></div></section>
    <div className="tag-setup-grid">
      <form className="panel setup-form" onSubmit={createTag}>
        <h2>Crear tag NFC</h2>
        <p className="modal-copy">Registra aquí cada placa antes de grabarla.</p>
        <label>Nombre del tag<input value={name} onChange={(event) => { setName(event.target.value); if (!slugTouched) setSlug(toSlug(event.target.value)) }} placeholder="Ej. Mostrador, Mesa 4, Entrada" required maxLength={80} /><small className="field-hint">Solo lo ves tú, para identificar la placa.</small></label>
        <label>Negocio<input value={clientName} onChange={(event) => setClientName(event.target.value)} required maxLength={80} /><small className="field-hint">Se muestra como título en la página pública.</small></label>
        <label>Dirección (slug)<div className="slug-input"><span>/t/</span><input value={slug} onChange={(event) => { setSlug(event.target.value); setSlugTouched(true) }} onBlur={() => setSlug(toSlug(slug))} placeholder="mostrador-centro" required pattern="[a-zA-Z0-9-]+" maxLength={60} /></div><small className="field-hint">Debe ser única. Solo letras, números y guiones.</small></label>
        <label>Perfil que abrirá<select value={profileId} onChange={(event) => setProfileId(event.target.value)}><option value="new">➕ Crear un perfil nuevo</option>{app.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.client_name} · {profile.name}</option>)}</select><small className="field-hint">Varios tags pueden compartir el mismo perfil.</small></label>
        {profileId === 'new' && <label>Primer enlace (opcional)<input type="url" value={firstUrl} onChange={(event) => setFirstUrl(event.target.value)} placeholder="https://instagram.com/tu-negocio" /></label>}
        <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Crear tag NFC'} <Plus size={16} /></button>
      </form>
      <section className="panel setup-list">
        <div className="panel-header"><div><h2>Tus tags ({app.tags.length})</h2><p>Pausa un tag para que su placa deje de mostrar contenido sin borrarlo.</p></div></div>
        <div className="callout"><Info size={16} /><span><strong>¿Cómo grabo la placa?</strong> Copia la URL del tag, abre una app como <em>NFC Tools</em> en tu celular, elige "Escribir → URL", pega la dirección y acerca la placa. <button className="text-link" onClick={() => app.go('tutorial')}>Ver guía paso a paso</button></span></div>
        {app.tags.map((tag) => {
          const scans = app.scans.filter((scan) => scan.tag_id === tag.id).length
          return <div className="tag-row" key={tag.id}>
            <span className={`tag-icon ${tag.status === 'Activo' ? 'coral' : 'yellow'}`}><QrCode size={16} /></span>
            <div className="tag-row-main">
              <div className="tag-row-title"><strong>{tag.name}</strong><span className={`status ${tag.status === 'Activo' ? 'active' : 'paused'}`}><i />{tag.status}</span><small>{scans} escaneos</small></div>
              <code className="tag-url">{publicTagUrl(tag.slug, tag.id)}</code>
              <select className="inline-select" value={tag.profile_id ?? ''} onChange={(event) => void updateTag(tag, { profile_id: event.target.value || null }, 'Perfil del tag actualizado')} aria-label="Perfil asignado"><option value="">Sin perfil (no muestra nada)</option>{app.profiles.map((profile) => <option key={profile.id} value={profile.id}>Abre: {profile.client_name} · {profile.name}</option>)}</select>
            </div>
            <div className="tag-row-actions">
              <button className="outline-button" onClick={() => void copy(tag)}><Copy size={13} /> Copiar URL</button>
              <a className="row-action" href={publicTagUrl(tag.slug, tag.id)} target="_blank" rel="noreferrer" title="Abrir página pública"><ExternalLink size={16} /></a>
              <button className="row-action" onClick={() => void updateTag(tag, { status: tag.status === 'Activo' ? 'Pausado' : 'Activo' }, tag.status === 'Activo' ? 'Tag pausado' : 'Tag activado')} title={tag.status === 'Activo' ? 'Pausar' : 'Activar'}>{tag.status === 'Activo' ? <Pause size={16} /> : <Play size={16} />}</button>
              <button className="row-action danger" onClick={() => void deleteTag(tag)} title="Eliminar"><Trash2 size={16} /></button>
            </div>
          </div>
        })}
        {!app.tags.length && <p className="empty-state">Aún no hay tags. Crea el primero con el formulario.</p>}
      </section>
    </div>
  </div>
}

