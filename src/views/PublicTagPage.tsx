import { useEffect, useState } from 'react'
import { QrCode } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { initials } from '../lib/format'
import { ProfileCard, profileBackground } from '../components/ProfileCard'
import { DEFAULT_DESIGN, type ProfileDesign, type PublicLink } from '../types'

type PublicProfile = { tag: { name: string; client_name: string }; design?: ProfileDesign; links: PublicLink[]; redirect?: PublicLink | null }

// Espera a que se registren las estadísticas, pero nunca más de este tiempo antes de redirigir.
const REDIRECT_WAIT_MS = 700

export function PublicTagPage({ slug }: { slug: string }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) { setError('El servicio no está configurado.'); return }
    let visitorKey: string = crypto.randomUUID()
    try { visitorKey = localStorage.getItem('pulsetag-visitor') ?? visitorKey; localStorage.setItem('pulsetag-visitor', visitorKey) } catch { /* almacenamiento bloqueado */ }
    const client = supabase
    const scan = client.rpc('register_nfc_scan', { tag_slug: slug, visitor: visitorKey })
    client.rpc('get_public_tag', { tag_slug: slug }).then(async ({ data, error: rpcError }) => {
      if (rpcError || !data) { setError('Este perfil no existe o está pausado.'); return }
      const result = data as PublicProfile
      setProfile(result)
      if (!result.redirect) return
      const click = client.rpc('register_link_click', { link: result.redirect.id, visitor: visitorKey })
      await Promise.race([Promise.allSettled([scan, click]), new Promise((resolve) => setTimeout(resolve, REDIRECT_WAIT_MS))])
      window.location.replace(result.redirect.url)
    })
  }, [slug])

  // Con Web NFC (Chrome Android), acercar otro tag mientras la página está abierta navega a su URL.
  useEffect(() => {
    const NDEFReaderCtor = window.NDEFReader
    if (!NDEFReaderCtor) return
    const controller = new AbortController()
    const reader = new NDEFReaderCtor()
    reader.scan({ signal: controller.signal }).then(() => {
      reader.onreading = ({ message }) => {
        const record = message.records.find((item) => item.recordType === 'url' || item.mediaType === 'text/plain')
        if (!record?.data) return
        const value = new TextDecoder().decode(record.data)
        const url = value.startsWith('http') ? value : `https://${value}`
        if (url.startsWith('https://') || url.startsWith('http://')) window.location.href = url
      }
    }).catch(() => { /* sin permiso de NFC: la página funciona igual */ })
    return () => controller.abort()
  }, [])

  const registerClick = (link: PublicLink) => {
    let visitor: string | null = null
    try { visitor = localStorage.getItem('pulsetag-visitor') } catch { /* almacenamiento bloqueado */ }
    void supabase?.rpc('register_link_click', { link: link.id, visitor })
  }

  if (error || !profile) return <main className="public-tag-page"><div className="public-card"><span className="brand-mark"><QrCode size={21} /></span>{error ? <><h1>Perfil no disponible</h1><p>{error}</p></> : <p>Cargando perfil...</p>}</div></main>

  const design = { ...DEFAULT_DESIGN, ...profile.design }
  if (profile.redirect) return <main className="public-tag-page" style={profileBackground(design)}><div className="profile-card redirecting" style={{ color: design.text_color }}>{design.logo_url ? <img className="profile-logo" src={design.logo_url} alt={`Logo de ${profile.tag.client_name}`} /> : <span className="profile-logo placeholder" style={{ background: design.button_color, color: design.button_text_color }}>{initials(profile.tag.client_name)}</span>}<h1>{profile.tag.client_name}</h1><p className="profile-bio">Abriendo {profile.redirect.label}...</p><a className="redirect-fallback" href={profile.redirect.url} style={{ color: design.text_color }}>Si no se abre, toca aquí</a></div></main>
  return <main className="public-tag-page" style={profileBackground(design)}><ProfileCard design={design} title={profile.tag.name} businessName={profile.tag.client_name} links={profile.links} onLinkClick={registerClick} footer={<small className="profile-footer">Enlaces · por PulseTag</small>} /></main>
}
