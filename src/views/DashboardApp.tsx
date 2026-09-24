import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { BarChart3, BookOpen, Building2, ChevronDown, CircleHelp, LayoutDashboard, LogOut, Menu, Palette, QrCode, RefreshCw, Settings, Tags, Users, X, type LucideIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { initials, periodStart } from '../lib/format'
import type { AppContext } from '../appContext'
import { LINK_COLUMNS, PROFILE_COLUMNS, TAG_COLUMNS, type Invitation, type LinkClick, type LinktreeProfile, type ManagedLink, type Member, type NfcTag, type Scan, type Session, type ViewKey, type Workspace, type WorkspaceSummary } from '../types'
import { LoginScreen } from './LoginScreen'
import { OverviewView } from './OverviewView'
import { TagsView } from './TagsView'
import { ProfilesView } from './ProfilesView'
import { AnalyticsView } from './AnalyticsView'
import { TeamView } from './TeamView'
import { CompaniesView } from './CompaniesView'
import { SettingsView } from './SettingsView'
import { TutorialView } from './TutorialView'

type NavItem = { key: ViewKey; label: string; short: string; icon: LucideIcon }
const managementNav: NavItem[] = [
  { key: 'resumen', label: 'Resumen', short: 'Inicio', icon: LayoutDashboard },
  { key: 'tags', label: 'Tags NFC', short: 'Tags', icon: Tags },
  { key: 'perfiles', label: 'Perfiles y enlaces', short: 'Perfiles', icon: Palette },
  { key: 'analitica', label: 'Analítica', short: 'Datos', icon: BarChart3 },
]
const labels: Record<ViewKey, string> = { resumen: 'Resumen', tags: 'Tags NFC', perfiles: 'Perfiles y enlaces', analitica: 'Analítica', equipo: 'Equipo', empresas: 'Empresas', configuracion: 'Configuración', tutorial: 'Tutorial' }
const WORKSPACE_KEY = 'pulsetag-workspace'

const readStored = () => { try { return localStorage.getItem(WORKSPACE_KEY) } catch { return null } }
const store = (id: string) => { try { localStorage.setItem(WORKSPACE_KEY, id) } catch { /* almacenamiento bloqueado */ } }

// PostgREST devuelve como máximo 1000 filas por consulta; se pagina para no perder escaneos.
async function fetchAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) return rows
  }
}

export function DashboardApp() {
  const [authState, setAuthState] = useState<'checking' | 'out' | 'in'>('checking')
  const [session, setSession] = useState<Session | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [tags, setTags] = useState<NfcTag[]>([])
  const [profiles, setProfiles] = useState<LinktreeProfile[]>([])
  const [links, setLinks] = useState<ManagedLink[]>([])
  const [scans, setScans] = useState<Scan[]>([])
  const [clicks, setClicks] = useState<LinkClick[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [view, setView] = useState<ViewKey>('resumen')
  const [menuOpen, setMenuOpen] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const notify = useCallback((message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 3200) }, [])

  useEffect(() => {
    if (!supabase) { setAuthState('out'); return }
    supabase.auth.getSession().then(({ data }) => setAuthState(data.session ? 'in' : 'out'))
    const { data: listener } = supabase.auth.onAuthStateChange((event, current) => {
      setAuthState(current ? 'in' : 'out')
      if (event === 'PASSWORD_RECOVERY') { setView('configuracion'); notify('Escribe tu nueva contraseña en "Seguridad".') }
    })
    return () => listener.subscription.unsubscribe()
  }, [notify])

  const refreshWorkspaces = useCallback(async () => {
    if (!supabase) return
    const { data, error: rpcError } = await supabase.rpc('my_workspaces')
    if (rpcError) { setError(rpcError.message.includes('my_workspaces') ? 'Falta aplicar la migración de la base de datos (supabase/migrations) en el SQL Editor de Supabase.' : rpcError.message); setWorkspaces([]); return }
    const list = (data ?? []) as WorkspaceSummary[]
    setWorkspaces(list)
    setWorkspaceId((current) => list.some((item) => item.id === current) ? current : list.find((item) => item.id === readStored())?.id ?? list[0]?.id ?? null)
  }, [])

  // Sesión: reclama invitaciones pendientes y carga las empresas disponibles.
  useEffect(() => {
    if (authState !== 'in' || !supabase) { setSession(null); setWorkspaces(null); return }
    const client = supabase
    void (async () => {
      const { data: userData } = await client.auth.getUser()
      if (!userData.user) return
      await client.rpc('claim_invitations')
      const { data: platformAdmin } = await client.rpc('is_platform_admin')
      const user = userData.user
      setSession({ userId: user.id, email: user.email ?? '', name: (user.user_metadata?.full_name as string | undefined)?.trim() || (user.email ?? '').split('@')[0], isPlatformAdmin: Boolean(platformAdmin) })
      await refreshWorkspaces()
    })()
  }, [authState, refreshWorkspaces])

  const retryAccess = async () => { setError(''); await supabase?.rpc('claim_invitations'); await refreshWorkspaces() }

  // Datos de la empresa seleccionada. Depende solo de lo que cambia el acceso, no del nombre.
  const selected = workspaces?.find((item) => item.id === workspaceId)
  const selectedStatus = selected?.status
  const selectedRole = selected?.role
  const userId = session?.userId
  const platformAdmin = session?.isPlatformAdmin ?? false
  useEffect(() => {
    if (!supabase || !userId || !workspaceId || !selectedStatus) return
    const client = supabase
    if (selectedStatus === 'Suspendido' && !platformAdmin) return
    let cancelled = false
    store(workspaceId)
    setLoading(true); setError('')
    void (async () => {
      try {
        const [workspaceResult, storeResult, membersResult, tagsResult, profilesResult] = await Promise.all([
          client.from('workspaces').select('id, name, status, contact_name, contact_email, contact_phone, plates_count, notes').eq('id', workspaceId).single(),
          client.from('stores').select('id').eq('workspace_id', workspaceId).order('created_at').limit(1).maybeSingle(),
          client.from('workspace_members').select('id, user_id, name, email, role, status, created_at').eq('workspace_id', workspaceId).order('created_at'),
          client.from('nfc_tags').select(TAG_COLUMNS).eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
          client.from('linktree_profiles').select(PROFILE_COLUMNS).eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
        ])
        const failure = workspaceResult.error ?? storeResult.error ?? membersResult.error ?? tagsResult.error ?? profilesResult.error
        if (failure) throw failure
        const loadedTags = (tagsResult.data ?? []) as NfcTag[]
        const loadedProfiles = (profilesResult.data ?? []) as LinktreeProfile[]
        const profileIds = loadedProfiles.map((profile) => profile.id)
        const tagIds = loadedTags.map((tag) => tag.id)
        const since = periodStart(365).toISOString()
        const [loadedLinks, loadedScans] = await Promise.all([
          profileIds.length ? fetchAll<ManagedLink>((from, to) => client.from('nfc_links').select(LINK_COLUMNS).in('profile_id', profileIds).order('position').range(from, to)) : Promise.resolve([]),
          tagIds.length ? fetchAll<Scan>((from, to) => client.from('nfc_scans').select('id, tag_id, scanned_at, source, visitor_id').in('tag_id', tagIds).gte('scanned_at', since).order('scanned_at', { ascending: false }).range(from, to)) : Promise.resolve([]),
        ])
        const linkIds = loadedLinks.map((link) => link.id)
        const loadedClicks = linkIds.length ? await fetchAll<LinkClick>((from, to) => client.from('nfc_link_clicks').select('id, link_id, clicked_at').in('link_id', linkIds).gte('clicked_at', since).range(from, to)) : []
        const canManage = selectedRole === 'Administrador' || platformAdmin
        const invitationsResult = canManage ? await client.from('workspace_invitations').select('id, name, email, role, created_at').eq('workspace_id', workspaceId).order('created_at') : { data: [] }
        if (cancelled) return
        setWorkspace(workspaceResult.data as Workspace)
        setStoreId(storeResult.data?.id ?? null)
        setMembers((membersResult.data ?? []) as Member[])
        setTags(loadedTags); setProfiles(loadedProfiles); setLinks(loadedLinks); setScans(loadedScans); setClicks(loadedClicks)
        setInvitations((invitationsResult.data ?? []) as Invitation[])
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : (loadError as { message?: string }).message ?? 'No se pudieron cargar los datos.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [userId, platformAdmin, workspaceId, selectedStatus, selectedRole, reloadKey])

  const logout = () => { void supabase?.auth.signOut(); setWorkspace(null); setWorkspaceId(null); setView('resumen') }

  if (authState === 'checking') return <div className="splash"><span className="brand-mark"><QrCode size={21} /></span></div>
  if (authState === 'out') return <LoginScreen />
  if (!session || workspaces === null) return <div className="splash"><span className="brand-mark"><QrCode size={21} /></span><p>Cargando tu cuenta...</p></div>

  const summary = workspaces.find((item) => item.id === workspaceId)
  if (error && !workspaces.length) return <AccessScreen title="No se pudo cargar tu cuenta" email={session.email} onRetry={() => void retryAccess()} onLogout={logout}>{error}</AccessScreen>
  if (!workspaces.length && !session.isPlatformAdmin) return <AccessScreen title="Tu cuenta aún no tiene acceso" email={session.email} onRetry={() => void retryAccess()} onLogout={logout}>Pide al administrador de tu empresa (o a tu proveedor de placas NFC) que te invite con el correo <strong>{session.email}</strong>. En cuanto lo haga, pulsa "Ya me invitaron".</AccessScreen>
  if (summary?.status === 'Suspendido' && !session.isPlatformAdmin) return <AccessScreen title="Tu empresa está suspendida" email={session.email} onRetry={() => void retryAccess()} onLogout={logout} others={workspaces.filter((item) => item.id !== summary.id && item.status === 'Activo')} onSelect={setWorkspaceId}>El acceso a <strong>{summary.name}</strong> está pausado y sus tags no muestran contenido. Contacta a tu proveedor para reactivarla.</AccessScreen>

  const role = summary?.role ?? 'Operador'
  const canManage = role === 'Administrador' || session.isPlatformAdmin
  const ready = Boolean(workspace && summary && workspace.id === summary.id)
  const activeView: ViewKey = !ready && session.isPlatformAdmin ? 'empresas' : view
  const go = (next: ViewKey) => { setView(next); setMenuOpen(false); setSwitcherOpen(false); window.scrollTo({ top: 0 }) }
  const enterWorkspace = (id: string) => { setWorkspaceId(id); setView('resumen'); setSwitcherOpen(false); setMenuOpen(false) }

  const app: AppContext | null = ready && workspace && summary ? {
    session, workspace, role, storeId, workspaces, tags, setTags, profiles, setProfiles, links, setLinks, scans, clicks, members, setMembers, invitations, setInvitations,
    setWorkspace: (next) => { setWorkspace(next); setWorkspaces((current) => current?.map((item) => item.id === next.id ? { ...item, name: next.name, status: next.status } : item) ?? current) },
    setSessionName: (name) => setSession((current) => current ? { ...current, name } : current),
    notify, go, enterWorkspace, refreshWorkspaces,
  } : null

  const navButton = (item: NavItem) => <button key={item.key} className={`nav-item ${activeView === item.key ? 'selected' : ''}`} onClick={() => go(item.key)} disabled={!app && item.key !== 'empresas' && item.key !== 'tutorial'}><item.icon size={18} /><span>{item.label}</span></button>
  const roleLabel = session.isPlatformAdmin ? 'Admin. de plataforma' : role

  const content = () => {
    if (activeView === 'empresas' && session.isPlatformAdmin) return <CompaniesView notify={notify} enterWorkspace={enterWorkspace} refreshWorkspaces={refreshWorkspaces} currentWorkspaceId={workspaceId} />
    if (activeView === 'tutorial') return <TutorialView isPlatformAdmin={session.isPlatformAdmin} canManage={canManage} go={go} />
    if (!app) return loading ? <div className="data-loading">Cargando datos de la empresa...</div> : null
    switch (activeView) {
      case 'tags': return <TagsView app={app} />
      case 'perfiles': return <ProfilesView app={app} />
      case 'analitica': return <AnalyticsView app={app} />
      case 'equipo': return canManage ? <TeamView app={app} /> : null
      case 'configuracion': return <SettingsView app={app} />
      default: return <OverviewView app={app} />
    }
  }

  return (
    <div className="app-shell">
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand"><span className="brand-mark"><QrCode size={21} strokeWidth={2.5} /></span><span>pulsetag</span></div>
        <button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X size={20} /></button>
        <div className="workspace-menu">
          <button className="workspace-switcher" onClick={() => setSwitcherOpen((open) => !open)} aria-expanded={switcherOpen}>
            <span className="workspace-avatar">{initials(summary?.name ?? '—')}</span>
            <span><strong>{summary?.name ?? 'Sin empresa seleccionada'}</strong><small>{summary ? (summary.status === 'Suspendido' ? 'Suspendida' : 'Empresa activa') : 'Elige o crea una empresa'}</small></span>
            <ChevronDown size={15} />
          </button>
          {switcherOpen && <div className="workspace-dropdown">
            <p>Cambiar de empresa</p>
            <div className="workspace-options">{workspaces.map((item) => <button key={item.id} className={item.id === workspaceId ? 'current' : ''} onClick={() => enterWorkspace(item.id)}><span className="workspace-avatar small">{initials(item.name)}</span><span>{item.name}</span>{item.status === 'Suspendido' && <em>Suspendida</em>}</button>)}</div>
            {session.isPlatformAdmin && <button className="workspace-manage" onClick={() => go('empresas')}><Building2 size={14} /> Gestionar empresas</button>}
          </div>}
        </div>
        <nav>
          <p className="nav-label">GESTIÓN</p>
          {managementNav.map(navButton)}
          <p className="nav-label second">EMPRESA</p>
          {canManage && navButton({ key: 'equipo', label: 'Equipo', short: 'Equipo', icon: Users })}
          {navButton({ key: 'configuracion', label: 'Configuración', short: 'Ajustes', icon: Settings })}
          {session.isPlatformAdmin && <><p className="nav-label second">PLATAFORMA</p>{navButton({ key: 'empresas', label: 'Empresas', short: 'Empresas', icon: Building2 })}</>}
          <p className="nav-label second">AYUDA</p>
          {navButton({ key: 'tutorial', label: 'Tutorial', short: 'Ayuda', icon: BookOpen })}
        </nav>
        <div className="sidebar-bottom"><div className="user-card"><div className="user-avatar">{initials(session.name)}</div><span><strong>{session.name}</strong><small>{roleLabel}</small></span><button className="logout-button" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={17} /></button></div></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu size={21} /></button><div className="breadcrumb"><span>{summary?.name ?? 'Plataforma'}</span><span>/</span><strong>{labels[activeView]}</strong></div><div className="top-actions"><button className="help-button" onClick={() => go('tutorial')}><CircleHelp size={17} /><span>Tutorial</span></button><div className="mini-avatar" title={`${session.name} · ${session.email}`}>{initials(session.name)}</div></div></header>
        <div className="page-wrap">
          {error && <div className="data-error">{error} <button className="text-link" onClick={() => setReloadKey((key) => key + 1)}><RefreshCw size={12} /> Reintentar</button></div>}
          <div key={workspaceId ?? 'none'}>{content()}</div>
          <footer><span>PulseTag Console <b>•</b> {session.email}</span><span>{summary ? `Empresa: ${summary.name}` : ''}</span></footer>
        </div>
      </main>
      {notice && <div className="toast" role="status">{notice}</div>}
      <nav className="mobile-bottom-nav" aria-label="Navegación principal">{managementNav.map((item) => <button key={item.key} className={activeView === item.key ? 'selected' : ''} onClick={() => go(item.key)} disabled={!app}><item.icon size={19} /><span>{item.short}</span></button>)}<button onClick={() => setMenuOpen(true)}><Menu size={19} /><span>Más</span></button></nav>
    </div>
  )
}

function AccessScreen({ title, email, children, onRetry, onLogout, others, onSelect }: { title: string; email: string; children: ReactNode; onRetry: () => void; onLogout: () => void; others?: WorkspaceSummary[]; onSelect?: (id: string) => void }) {
  return <main className="public-tag-page access-page"><div className="public-card"><span className="public-logo"><QrCode size={20} /></span><h1>{title}</h1><p className="public-subtitle">{children}</p>{others && others.length > 0 && <div className="access-others"><p>También tienes acceso a:</p>{others.map((item) => <button key={item.id} className="outline-button" onClick={() => onSelect?.(item.id)}>{item.name}</button>)}</div>}<div className="access-actions"><button className="primary-button" onClick={onRetry}><RefreshCw size={15} /> Ya me invitaron</button><button className="outline-button" onClick={onLogout}><LogOut size={14} /> Cerrar sesión</button></div><small>Sesión iniciada como {email}</small></div></main>
}
