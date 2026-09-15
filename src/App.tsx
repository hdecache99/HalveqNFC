import { FormEvent, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  Menu,
  MoreHorizontal,
  Plus,
  QrCode,
  ShieldCheck,
  Settings,
  Smartphone,
  Store,
  Tags,
  Users,
  X,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type AdminUser = { id: string; name: string; email: string; role: 'Administrador' | 'Operador'; status: 'Activo' | 'Pendiente' }
type NfcTag = { id: string; name: string; client_name: string; destination_url: string; status: 'Activo' | 'Pausado'; scans: number; slug?: string; store_id?: string }
type Scan = { id: string; tag_id: string; scanned_at: string; source: string; visitor_id: string | null }
type PublicLink = { id: string; label: string; url: string }
type ManagedLink = PublicLink & { tag_id: string; position: number; active: boolean }

type Metric = {
  label: string
  value: string
  change: string
  direction: 'up' | 'down'
  tone: string
}

const navItems = [
  { label: 'Resumen', icon: LayoutDashboard },
  { label: 'Clientes', icon: Users },
  { label: 'Tags NFC', icon: Tags },
  { label: 'Enlaces', icon: Link2 },
  { label: 'Analítica', icon: BarChart3 },
]

function TrendChart({ values, labels }: { values: number[]; labels: string[] }) {
  const maxValue = Math.max(...values, 1)
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 700},${207 - (value / maxValue) * 175}`).join(' ')
  return (
    <div className="trend-chart" aria-label="Tendencia real de escaneos">
      <div className="chart-y-axis"><span>3k</span><span>2k</span><span>1k</span><span>0</span></div>
      <svg viewBox="0 0 700 220" preserveAspectRatio="none" role="img">
        <defs>
          <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#e28c79" stopOpacity=".28" />
            <stop offset="1" stopColor="#e28c79" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="12" x2="700" y2="12" className="grid-line" />
        <line x1="0" y1="77" x2="700" y2="77" className="grid-line" />
        <line x1="0" y1="142" x2="700" y2="142" className="grid-line" />
        <line x1="0" y1="207" x2="700" y2="207" className="grid-line" />
        <polyline points={`${points} 700,220 0,220`} fill="url(#fill)" stroke="none" />
        <polyline points={points} fill="none" stroke="#d87661" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {values.map((value, index) => <circle key={`${value}-${index}`} cx={(index / Math.max(values.length - 1, 1)) * 700} cy={207 - (value / maxValue) * 175} r="4" fill="#fffdf8" stroke="#d87661" strokeWidth="2" />)}
      </svg>
      <div className="chart-x-axis">{labels.map((label) => <span key={label}>{label}</span>)}</div>
    </div>
  )
}

function PublicTagPage({ slug }: { slug: string }) {
  const [profile, setProfile] = useState<{ tag: { name: string; client_name: string }; links: PublicLink[] } | null>(null)
  const [error, setError] = useState('')
  const [nfcStatus, setNfcStatus] = useState('')

  useEffect(() => {
    if (!supabase) return
    const visitorKey = localStorage.getItem('pulsetag-visitor') ?? crypto.randomUUID()
    localStorage.setItem('pulsetag-visitor', visitorKey)
    void supabase.rpc('register_nfc_scan', { tag_slug: slug, visitor: visitorKey })
    supabase.rpc('get_public_tag', { tag_slug: slug }).then(({ data, error: rpcError }) => {
      if (rpcError || !data) setError('Este perfil no existe o está pausado.')
      else setProfile(data as { tag: { name: string; client_name: string }; links: PublicLink[] })
    })
  }, [slug])

  useEffect(() => {
    if (!('NDEFReader' in window)) {
      setNfcStatus('NFC no disponible aquí. Usa Chrome en Android y prueba acercando un tag.')
      return
    }

    const controller = new AbortController()
    const { signal } = controller
    const runNfcReader = async () => {
      try {
        const NDEFReaderCtor = (window as typeof window & { NDEFReader?: new () => { scan: () => Promise<void>; onreading: ((event: { message: { records: Array<{ recordType?: string; data?: ArrayBuffer; mediaType?: string; id?: string }> } }) => void) | null } }).NDEFReader
        if (!NDEFReaderCtor) {
          setNfcStatus('NFC no disponible aquí. Usa Chrome en Android y prueba acercando un tag.')
          return
        }

        const reader = new NDEFReaderCtor()
        await reader.scan()
        setNfcStatus('NFC listo: acerca tu etiqueta a la parte trasera del móvil.')

        reader.onreading = ({ message }) => {
          const urlRecord = message.records.find((record) => record.recordType === 'url' || record.mediaType === 'text/plain')
          if (!urlRecord || !urlRecord.data) return

          const decoder = new TextDecoder()
          const maybeUrl = decoder.decode(urlRecord.data)
          const normalized = maybeUrl.startsWith('http') ? maybeUrl : `https://${maybeUrl}`
          const targetUrl = `${window.location.origin}/t/${encodeURIComponent(slug)}`

          if (normalized === targetUrl || normalized.includes(`/t/${slug}`) || normalized === `${window.location.origin}/t/${slug}`) {
            window.location.href = targetUrl
            return
          }

          if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
            window.location.href = normalized
          }
        }
      } catch {
        setNfcStatus('NFC disponible solo en Chrome Android. En desktop no se activa al acercar el móvil.')
      }
    }

    void runNfcReader()
    return () => controller.abort()
  }, [slug])

  if (error) return <main className="public-tag-page"><div className="public-card"><span className="brand-mark"><QrCode size={21} /></span><h1>Perfil no disponible</h1><p>{error}</p></div></main>
  if (!profile) return <main className="public-tag-page"><div className="public-card"><span className="brand-mark"><QrCode size={21} /></span><p>Cargando perfil...</p></div></main>
  return <main className="public-tag-page"><div className="public-card"><span className="public-logo"><QrCode size={20} /></span><p className="eyebrow">{profile.tag.client_name}</p><h1>{profile.tag.name}</h1><p className="public-subtitle">Encuéntranos en nuestros canales oficiales</p>{nfcStatus && <p className="public-subtitle" style={{ fontSize: 12, marginTop: 8, opacity: 0.8 }}>{nfcStatus}</p>}<div className="public-links">{profile.links.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer" onClick={() => void supabase?.rpc('register_link_click', { link: link.id, visitor: localStorage.getItem('pulsetag-visitor') })}>{link.label}<ArrowUpRight size={16} /></a>)}</div><small>Enlaces · por PulseTag</small></div></main>
}

function TagSetupView({ workspaceId, storeId, tags, setTags, showNotice }: { workspaceId: string | null; storeId: string | null; tags: NfcTag[]; setTags: Dispatch<SetStateAction<NfcTag[]>>; showNotice: (message: string) => void }) {
  const [name, setName] = useState('')
  const [clientName, setClientName] = useState('')
  const [slug, setSlug] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const createTag = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !workspaceId || !storeId) return
    const safeSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
    setSaving(true)
    const { data: tag, error } = await supabase.from('nfc_tags').insert({ workspace_id: workspaceId, store_id: storeId, name, client_name: clientName, slug: safeSlug, destination_url: url || `${window.location.origin}/t/${safeSlug}` }).select('id, name, client_name, destination_url, status, slug, store_id').single()
    if (error || !tag) { showNotice(error?.message ?? 'No se pudo crear el tag'); setSaving(false); return }
    if (url) await supabase.from('nfc_links').insert({ tag_id: tag.id, label: 'Visitar enlace', url, position: 0 })
    setTags((current) => [{ ...tag, scans: 0 } as NfcTag, ...current]); setName(''); setClientName(''); setSlug(''); setUrl(''); setSaving(false); showNotice('Tag creado. Usa su URL pública para configurar el NFC.')
  }
  return <div className="admin-page"><section className="page-heading"><div><p className="eyebrow">CONFIGURACIÓN NFC</p><h1>{tags.length ? 'Mis tags NFC' : 'Configura tu primer tag'} <span>✦</span></h1><p className="subheading">Cada tag abre una página de enlaces configurable y cuenta sus visitas.</p></div></section><div className="tag-setup-grid"><form className="panel setup-form" onSubmit={createTag}><h2>Crear página de enlaces</h2><p className="modal-copy">El NFC debe apuntar a la URL pública que se genera aquí.</p><label>Nombre del perfil<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Menú principal" required /></label><label>Negocio<input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="La Esquina del Sabor" required /></label><label>Slug público<input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="la-esquina" pattern="[a-zA-Z0-9-]+" required /></label><label>Primer enlace<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://instagram.com/negocio" required /></label><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Crear página de enlaces'} <Plus size={16} /></button></form><section className="panel setup-list"><div className="panel-header"><div><h2>Páginas de enlaces configuradas</h2><p>Comparte la URL pública con la tienda.</p></div></div>{tags.map((tag) => <div className="setup-tag" key={tag.id}><span className="tag-icon coral"><QrCode size={16} /></span><span><strong>{tag.name}</strong><small>{window.location.origin}/t/{(tag as NfcTag & { slug?: string }).slug ?? tag.id}</small></span><button className="outline-button" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/t/${(tag as NfcTag & { slug?: string }).slug ?? tag.id}`).then(() => showNotice('URL copiada'))}>Copiar URL</button></div>)}{!tags.length && <p className="empty-state">Aún no hay páginas de enlaces configuradas.</p>}</section></div></div>
}

function LinksView({ tags, links, setLinks, showNotice }: { tags: NfcTag[]; links: ManagedLink[]; setLinks: Dispatch<SetStateAction<ManagedLink[]>>; showNotice: (message: string) => void }) {
  const [selectedTag, setSelectedTag] = useState(tags[0]?.id ?? '')
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const saveLink = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !selectedTag) return
    setSaving(true)
    const { data, error } = await supabase.from('nfc_links').insert({ tag_id: selectedTag, label: label.trim(), url: url.trim(), position: links.filter((item) => item.tag_id === selectedTag).length }).select('id, tag_id, label, url, position, active').single()
    if (error || !data) { showNotice(error?.message ?? 'No se pudo guardar el enlace'); setSaving(false); return }
    setLinks((current) => [...current, data as ManagedLink]); setLabel(''); setUrl(''); setSaving(false); showNotice('Enlace agregado')
  }
  const updateLink = async (link: ManagedLink, changes: Partial<ManagedLink>) => {
    if (!supabase) return
    const { error } = await supabase.from('nfc_links').update(changes).eq('id', link.id)
    if (error) { showNotice(error.message); return }
    setLinks((current) => current.map((item) => item.id === link.id ? { ...item, ...changes } : item)); showNotice('Enlace actualizado')
  }
  const deleteLink = async (link: ManagedLink) => {
    if (!supabase) return
    const { error } = await supabase.from('nfc_links').delete().eq('id', link.id)
    if (error) { showNotice(error.message); return }
    setLinks((current) => current.filter((item) => item.id !== link.id)); showNotice('Enlace eliminado')
  }
  return <div className="admin-page"><section className="page-heading"><div><p className="eyebrow">CONTENIDO POR TIENDA</p><h1>Enlaces <span>✦</span></h1><p className="subheading">Administra los destinos que aparecen al escanear cada tag.</p></div></section><div className="links-layout"><form className="panel link-form" onSubmit={saveLink}><h2>Agregar enlace</h2><p className="modal-copy">Solo los usuarios autorizados de la tienda pueden modificar estos enlaces.</p><label>Tag NFC<select value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)} required>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.client_name} · {tag.name}</option>)}</select></label><label>Texto del enlace<input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Instagram" required maxLength={80} /></label><label>URL<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://instagram.com/negocio" required /></label><button className="primary-button" type="submit" disabled={saving || !tags.length}>{saving ? 'Guardando...' : 'Agregar enlace'} <Plus size={16} /></button></form><section className="panel managed-links"><div className="panel-header"><div><h2>Enlaces publicados</h2><p>{links.length} enlaces configurados en tus tiendas autorizadas.</p></div></div>{tags.map((tag) => <div className="link-group" key={tag.id}><div className="link-group-heading"><div><strong>{tag.client_name}</strong><small>{tag.name}</small></div><span>{links.filter((link) => link.tag_id === tag.id).length} enlaces</span></div>{links.filter((link) => link.tag_id === tag.id).map((link) => <div className="managed-link" key={link.id}><input value={link.label} onChange={(event) => setLinks((current) => current.map((item) => item.id === link.id ? { ...item, label: event.target.value } : item))} onBlur={() => void updateLink(link, { label: link.label })} /><input value={link.url} onChange={(event) => setLinks((current) => current.map((item) => item.id === link.id ? { ...item, url: event.target.value } : item))} onBlur={() => void updateLink(link, { url: link.url })} /><button className="row-action" onClick={() => void updateLink(link, { active: !link.active })} aria-label="Activar o pausar enlace"><i className={`link-state ${link.active ? 'on' : 'off'}`} /></button><button className="row-action" onClick={() => void deleteLink(link)} aria-label="Eliminar enlace"><X size={16} /></button></div>)}</div>)}{!tags.length && <p className="empty-state">Primero configura un tag NFC.</p>}</section></div></div>
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) {
      setError('Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para iniciar sesión.')
      return
    }
    if (mode === 'signup' && password !== confirmation) { setError('Las contraseñas no coinciden.'); return }
    if (mode === 'signup' && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,}/.test(password)) { setError('Usa al menos 12 caracteres, mayúscula, minúscula, número y símbolo.'); return }
    setLoading(true); setError('')
    const authResult = mode === 'signup'
      ? await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin } })
      : await supabase.auth.signInWithPassword({ email, password })
    const authError = authResult.error
    setLoading(false)
    if (authError) { setError(authError.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : authError.message); return }
    if (mode === 'signup') { setError('Cuenta creada. Revisa tu correo para confirmar la dirección antes de iniciar sesión.'); setMode('login'); return }
    onLogin()
  }

  return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><span className="brand-mark"><QrCode size={21} /></span><span>pulsetag</span></div><div className="auth-heading"><span className="auth-lock"><ShieldCheck size={22} /></span><p className="eyebrow">CONSOLA DE ADMINISTRACIÓN</p><h1>{mode === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}</h1><p>{mode === 'login' ? 'Administra tus clientes, tags NFC y resultados desde un solo lugar.' : 'Registra el propietario inicial de tu workspace PulseTag.'}</p></div><form onSubmit={submit} className="auth-form">{mode === 'signup' && <label>Nombre completo<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" minLength={2} required /></label>}<label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={12} required /></label>{mode === 'signup' && <label>Confirmar contraseña<input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={12} required /></label>}{error && <p className={`form-error ${error.startsWith('Cuenta creada') ? 'form-success' : ''}`}>{error}</p>}<button className="primary-button auth-submit" type="submit" disabled={loading}>{loading ? 'Procesando...' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'} {!loading && <ArrowUpRight size={16} />}</button></form>{!isSupabaseConfigured && <div className="demo-hint"><ShieldCheck size={14} /> Falta configurar la conexión con Supabase.</div>}<button className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setPassword(''); setConfirmation('') }}>{mode === 'login' ? '¿Aún no tienes cuenta? Crear cuenta' : '¿Ya tienes cuenta? Iniciar sesión'}</button><p className="auth-footer">Usamos confirmación de correo y políticas de acceso por workspace.</p></section><aside className="auth-aside"><div className="auth-aside-copy"><p className="eyebrow">CONTROL EN CADA TOQUE</p><h2>Convierte cada escaneo en una mejor decisión.</h2><p>Una vista clara para impulsar los negocios que confían en PulseTag.</p></div><div className="auth-stat"><strong>PulseTag</strong><span>control operativo para tu negocio</span></div></aside></main>
}

function AdminsView({ admins, setAdmins, showNotice, workspaceId }: { admins: AdminUser[]; setAdmins: Dispatch<SetStateAction<AdminUser[]>>; showNotice: (message: string) => void; workspaceId: string | null }) {
  const [newAdmin, setNewAdmin] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AdminUser['role']>('Operador')

  const addAdmin = async (event: FormEvent) => {
    event.preventDefault()
    if (!workspaceId || !supabase) return
    const { error } = await supabase.functions.invoke('invite-user', { body: { workspaceId, name, email, role } })
    if (error) { showNotice(error.message); return }
    setName(''); setEmail(''); setNewAdmin(false); showNotice('Invitación enviada correctamente')
  }

  const updateMember = async (id: string, changes: Partial<AdminUser>) => {
    if (!supabase) return
    const { error } = await supabase.from('workspace_members').update(changes).eq('id', id)
    if (error) { showNotice(error.message); return }
    setAdmins((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item))
  }

  return <div className="admin-page"><section className="page-heading"><div><p className="eyebrow">SEGURIDAD Y ACCESOS</p><h1>Administradores <span>✦</span></h1><p className="subheading">Controla quién puede operar tu workspace.</p></div><button className="primary-button" onClick={() => setNewAdmin(true)}><Plus size={17} /> Invitar administrador</button></section><section className="admin-summary"><div><ShieldCheck size={20} /><span><strong>{admins.length} usuarios</strong><small>con acceso al workspace</small></span></div><div><Users size={20} /><span><strong>2 roles</strong><small>Administrador y Operador</small></span></div><div><Activity size={20} /><span><strong>Seguridad activa</strong><small>Datos protegidos por Supabase</small></span></div></section><section className="panel admins-panel"><div className="panel-header"><div><h2>Usuarios del workspace</h2><p>Invita, modifica o revoca accesos.</p></div><button className="outline-button" onClick={() => showNotice('La exportación estará disponible próximamente')}><ExternalLink size={14} /> Exportar</button></div><div className="table-wrap"><table><thead><tr><th>USUARIO</th><th>ROL</th><th>ESTADO</th><th>REGISTRO</th><th /></tr></thead><tbody>{admins.map((admin) => <tr key={admin.id}><td><div className="admin-name"><span className="admin-avatar">{admin.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><span><strong>{admin.name}</strong><small>{admin.email}</small></span></div></td><td><select className="role-select" value={admin.role} onChange={(event) => void updateMember(admin.id, { role: event.target.value as AdminUser['role'] })}><option>Administrador</option><option>Operador</option></select></td><td><button className={`status ${admin.status === 'Activo' ? 'active' : 'paused'} status-button`} onClick={() => void updateMember(admin.id, { status: admin.status === 'Activo' ? 'Pendiente' : 'Activo' })}><i />{admin.status}</button></td><td>{new Date().toLocaleDateString('es-MX')}</td><td><button className="row-action" onClick={() => void updateMember(admin.id, { status: 'Pendiente' })} aria-label={`Revocar acceso a ${admin.name}`}><X size={16} /></button></td></tr>)}</tbody></table></div></section>{newAdmin && <div className="modal-backdrop" onClick={() => setNewAdmin(false)}><form className="invite-modal" onSubmit={addAdmin} onClick={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setNewAdmin(false)} aria-label="Cerrar"><X size={18} /></button><p className="eyebrow">NUEVO ACCESO</p><h2>Invitar administrador</h2><p className="modal-copy">La invitación real requiere una Edge Function para crear el usuario Auth de forma segura.</p><label>Nombre completo<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Rol<select value={role} onChange={(event) => setRole(event.target.value as AdminUser['role'])}><option>Operador</option><option>Administrador</option></select></label><button className="primary-button auth-submit" type="submit">Configurar invitación <ArrowUpRight size={16} /></button></form></div>}</div>
}

function DashboardApp() {
  const [authenticated, setAuthenticated] = useState(false)
  const [activeNav, setActiveNav] = useState('Resumen')
  const [period, setPeriod] = useState('Últimos 7 días')
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [workspaceName, setWorkspaceName] = useState('Mi workspace')
  const [currentRole, setCurrentRole] = useState<AdminUser['role'] | null>(null)
  const [fetchedTags, setFetchedTags] = useState<NfcTag[]>([])
  const [links, setLinks] = useState<ManagedLink[]>([])
  const [scans, setScans] = useState<Scan[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState('')

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setAuthenticated(Boolean(data.session)))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setAuthenticated(Boolean(session)))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!authenticated || !supabase) return
    const client = supabase
    const loadWorkspace = async () => {
      setDataLoading(true); setDataError('')
      const { data: userData } = await client.auth.getUser()
      if (!userData.user) return
      const { data: membership, error: membershipError } = await client.from('workspace_members').select('workspace_id, role, workspaces(name)').eq('user_id', userData.user.id).eq('status', 'Activo').limit(1).maybeSingle()
      if (membershipError || !membership) { setDataError(membershipError?.message ?? 'Tu usuario aún no pertenece a un workspace.'); setDataLoading(false); return }
      setWorkspaceId(membership.workspace_id)
      setCurrentRole(membership.role as AdminUser['role'])
      const workspace = membership.workspaces as unknown as { name: string } | null
      if (workspace?.name) setWorkspaceName(workspace.name)
      const { data: store, error: storeError } = await client.from('stores').select('id').eq('workspace_id', membership.workspace_id).limit(1).maybeSingle()
      if (storeError || !store) { setDataError(storeError?.message ?? 'Tu usuario aún no tiene una tienda configurada.'); setDataLoading(false); return }
      setStoreId(store.id)
      const [membersResult, tagsResult] = await Promise.all([
        client.from('workspace_members').select('id, name, email, role, status').eq('workspace_id', membership.workspace_id).order('created_at'),
        (membership.role === 'Administrador' ? client.from('nfc_tags').select('id, name, client_name, destination_url, status, slug, store_id').eq('workspace_id', membership.workspace_id) : client.from('nfc_tags').select('id, name, client_name, destination_url, status, slug, store_id').eq('store_id', store.id)).order('created_at', { ascending: false }),
      ])
      if (membersResult.error || tagsResult.error) { setDataError(membersResult.error?.message ?? tagsResult.error?.message ?? 'No se pudieron cargar los datos.'); setDataLoading(false); return }
      const tags = (tagsResult.data ?? []) as NfcTag[]
      setAdmins((membersResult.data ?? []) as AdminUser[])
      setFetchedTags(tags)
      if (tags.length) {
        const { data: linkRows, error: linksError } = await client.from('nfc_links').select('id, tag_id, label, url, position, active').in('tag_id', tags.map((tag) => tag.id)).order('position')
        if (linksError) setDataError(linksError.message)
        setLinks((linkRows ?? []) as ManagedLink[])
      } else setLinks([])
      if (tags.length) {
        const { data: scanRows, error: scansError } = await client.from('nfc_scans').select('id, tag_id, scanned_at, source, visitor_id').in('tag_id', tags.map((tag) => tag.id)).order('scanned_at', { ascending: false })
        if (scansError) setDataError(scansError.message)
        setScans((scanRows ?? []) as Scan[])
      }
      setDataLoading(false)
    }
    void loadWorkspace()
  }, [authenticated])

  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }

  if (!authenticated) return <LoginScreen onLogin={() => setAuthenticated(true)} />

  const logout = () => {
    void supabase?.auth.signOut()
    setAuthenticated(false)
  }

  const mobileNavItems = navItems.filter(({ label }) => currentRole === 'Administrador' || label !== 'Clientes').slice(0, 4)

  const totalScans = scans.length
  const uniqueVisitors = new Set(scans.map((scan) => scan.visitor_id).filter(Boolean)).size
  const activeTags = fetchedTags.filter((tag) => tag.status === 'Activo').length
  const interactionRate = totalScans ? Math.round((uniqueVisitors / totalScans) * 1000) / 10 : 0
  const chartLabels = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() - (6 - index));
    return date.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }).replace('.', '')
  })
  const chartValues = chartLabels.map((_, index) => {
    const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index))
    const next = new Date(date); next.setDate(next.getDate() + 1)
    return scans.filter((scan) => { const scannedAt = new Date(scan.scanned_at); return scannedAt >= date && scannedAt < next }).length
  })
  const channelCounts = scans.reduce<Record<string, number>>((counts, scan) => { counts[scan.source] = (counts[scan.source] ?? 0) + 1; return counts }, {})
  const topChannels = Object.entries(channelCounts).sort(([, first], [, second]) => second - first).slice(0, 4)
  const channelTotal = Math.max(scans.length, 1)
  const liveMetrics: Metric[] = [
    { label: 'Escaneos totales', value: totalScans.toLocaleString('es-MX'), change: 'Datos reales', direction: 'up', tone: 'mint' },
    { label: 'Visitantes únicos', value: uniqueVisitors.toLocaleString('es-MX'), change: 'Datos reales', direction: 'up', tone: 'lavender' },
    { label: 'Tags activos', value: activeTags.toLocaleString('es-MX'), change: 'Datos reales', direction: 'up', tone: 'peach' },
    { label: 'Tasa de interacción', value: `${interactionRate}%`, change: 'Calculada', direction: 'up', tone: 'yellow' },
  ]

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand"><span className="brand-mark"><QrCode size={21} strokeWidth={2.5} /></span><span>pulsetag</span></div>
        <button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X size={20} /></button>
        <div className="workspace-switcher"><span className="workspace-avatar">{workspaceName.slice(0, 1).toUpperCase()}</span><span><strong>{workspaceName}</strong><small>Workspace activo</small></span><ChevronDown size={15} /></div>
        <nav>
          <p className="nav-label">GESTIÓN</p>
          {navItems.filter(({ label }) => currentRole === 'Administrador' || label !== 'Clientes').map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeNav === label ? 'selected' : ''}`} onClick={() => { setActiveNav(label); setMenuOpen(false) }}><Icon size={18} /><span>{currentRole === 'Operador' && label === 'Tags NFC' ? 'Mis tags NFC' : label}</span>{label === 'Clientes' && <em>{admins.length}</em>}</button>)}
          <p className="nav-label second">CONFIGURACIÓN</p>
          {currentRole === 'Administrador' && <button className={`nav-item ${activeNav === 'Administradores' ? 'selected' : ''}`} onClick={() => { setActiveNav('Administradores'); setMenuOpen(false) }}><ShieldCheck size={18} /><span>Administradores</span></button>}
          <button className="nav-item"><Settings size={18} /><span>Configuración</span></button>
          <button className="nav-item"><LifeBuoy size={18} /><span>Centro de ayuda</span></button>
        </nav>
        <div className="sidebar-bottom"><div className="upgrade-card"><div className="upgrade-icon"><Activity size={17} /></div><strong>Haz crecer tus datos</strong><p>Activa reportes avanzados para tus clientes.</p><button onClick={() => showNotice('Próximamente: reportes avanzados')}>Ver opciones <ArrowUpRight size={14} /></button></div><div className="user-card"><div className="user-avatar">MP</div><span><strong>María Pérez</strong><small>Administrador</small></span><button className="logout-button" onClick={logout} aria-label="Cerrar sesión"><MoreHorizontal size={18} /></button></div></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu size={21} /></button><div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{activeNav}</strong></div><div className="top-actions"><button className="icon-button" onClick={() => showNotice('No tienes notificaciones nuevas')} aria-label="Notificaciones"><Bell size={19} /><i /></button><button className="help-button"><CircleHelp size={17} /><span>Ayuda</span></button><div className="mini-avatar">MP</div></div></header>
        <div className="page-wrap">
          {dataError && <div className="data-error">{dataError}</div>}{dataLoading && <div className="data-loading">Cargando datos reales...</div>}{activeNav === 'Administradores' ? <AdminsView admins={admins} setAdmins={setAdmins} showNotice={showNotice} workspaceId={workspaceId} /> : activeNav === 'Tags NFC' ? <TagSetupView workspaceId={workspaceId} storeId={storeId} tags={fetchedTags} setTags={setFetchedTags} showNotice={showNotice} /> : activeNav === 'Enlaces' ? <LinksView tags={fetchedTags} links={links} setLinks={setLinks} showNotice={showNotice} /> : <>
          <section className="page-heading"><div><p className="eyebrow">PANEL DE {currentRole === 'Administrador' ? 'ADMINISTRACIÓN' : 'TU NEGOCIO'}</p><h1>{currentRole === 'Administrador' ? 'Resumen de PulseTag' : `Resumen de ${workspaceName}`} <span>✦</span></h1><p className="subheading">{currentRole === 'Administrador' ? 'Monitorea todos los negocios conectados.' : 'Revisa el impacto de tus tags y clientes.'}</p></div>{currentRole === 'Administrador' && <button className="primary-button" onClick={() => showNotice('Flujo de alta de tag NFC listo para conectar')}><Plus size={17} /> Nuevo tag NFC</button>}</section>
          {notice && <div className="toast">{notice}</div>}
          <section className="metric-grid">{liveMetrics.map((metric) => <article className={`metric-card ${metric.tone}`} key={metric.label}><div className="metric-top"><span>{metric.label}</span><button aria-label="Más opciones"><MoreHorizontal size={17} /></button></div><div className="metric-value">{metric.value}</div><div className={`metric-change ${metric.direction}`} >{metric.direction === 'up' ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}{metric.change}<span>desde Supabase</span></div></article>)}</section>
          <section className="content-grid"><article className="panel trend-panel"><div className="panel-header"><div><h2>Actividad de escaneos</h2><p>Interacciones reales con tus tags</p></div><div className="period-select"><select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Periodo de actividad"><option>Últimos 7 días</option><option>Últimos 30 días</option><option>Este año</option></select><ChevronDown size={15} /></div></div><TrendChart values={chartValues} labels={chartLabels} /><div className="chart-footer"><span className="legend-dot" /> Escaneos <strong>{totalScans.toLocaleString('es-MX')}</strong><span className="footer-muted">Datos sincronizados desde Supabase</span></div></article><article className="panel distribution-panel"><div className="panel-header"><div><h2>Distribución por canal</h2><p>Origen de tus escaneos</p></div><button className="dots-button" aria-label="Más opciones"><MoreHorizontal size={18} /></button></div><div className="donut-wrap"><div className="donut"><div><strong>{totalScans.toLocaleString('es-MX')}</strong><span>escaneos</span></div></div><div className="distribution-list">{topChannels.map(([source, count], index) => <div key={source}><span className={`channel-dot ${['coral', 'blue', 'yellow', 'green'][index]}`} /> {source} <strong>{Math.round((count / channelTotal) * 100)}%</strong></div>)}{topChannels.length === 0 && <div>Sin escaneos registrados aún</div>}</div></div><button className="text-button" onClick={() => setActiveNav('Analítica')}>Ver analítica completa <ArrowUpRight size={15} /></button></article></section>
          <section className="panel tags-panel"><div className="panel-header"><div><h2>Tags con más actividad</h2><p>Tus puntos de contacto más visitados</p></div><button className="outline-button" onClick={() => setActiveNav('Tags NFC')}>Ver todos <ArrowUpRight size={15} /></button></div><div className="table-wrap"><table><thead><tr><th>TAG</th><th>CLIENTE</th><th>ESCANEOS</th><th>ESTADO</th><th /></tr></thead><tbody>{fetchedTags.map((tag, index) => { const Icon = index % 3 === 0 ? Store : index % 3 === 1 ? Smartphone : Link2; const color = index % 3 === 0 ? 'coral' : index % 3 === 1 ? 'blue' : 'green'; const tagScans = scans.filter((scan) => scan.tag_id === tag.id).length; return <tr key={tag.id}><td><div className="tag-name"><span className={`tag-icon ${color}`}><Icon size={16} /></span><strong>{tag.name}</strong></div></td><td>{tag.client_name}</td><td><strong>{tagScans.toLocaleString('es-MX')}</strong></td><td><span className={`status ${tag.status === 'Activo' ? 'active' : 'paused'}`}><i />{tag.status}</span></td><td><button className="row-action" aria-label={`Abrir ${tag.name}`} onClick={() => window.open(tag.destination_url, '_blank', 'noopener,noreferrer')}><ExternalLink size={16} /></button></td></tr> })}</tbody></table></div></section>
          <footer><span>PulseTag Console <b>•</b> v0.1 beta</span><span>Última sincronización: hace 2 min</span></footer></>}
        </div>
      </main>
      <nav className="mobile-bottom-nav" aria-label="Navegación principal">{mobileNavItems.map(({ label, icon: Icon }) => <button key={label} className={activeNav === label ? 'selected' : ''} onClick={() => setActiveNav(label)}><Icon size={19} /><span>{label === 'Tags NFC' ? 'Tags' : label === 'Analítica' ? 'Datos' : label}</span></button>)}{currentRole === 'Administrador' && <button className={activeNav === 'Administradores' ? 'selected' : ''} onClick={() => setActiveNav('Administradores')}><ShieldCheck size={19} /><span>Equipo</span></button>}</nav>
    </div>
  )
}

function App() {
  const publicSlug = window.location.pathname.match(/^\/t\/([^/]+)/)?.[1]
  return publicSlug ? <PublicTagPage slug={decodeURIComponent(publicSlug)} /> : <DashboardApp />
}

export default App
