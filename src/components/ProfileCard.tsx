import type { CSSProperties, ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import type { ProfileDesign, PublicLink } from '../types'
import { initials } from '../lib/format'

const radius = { rounded: '10px', pill: '999px', square: '2px' }

export function profileBackground(design: ProfileDesign): CSSProperties {
  if (design.bg_style === 'image' && design.bg_image_url) return { backgroundColor: design.bg_color, backgroundImage: `url(${JSON.stringify(design.bg_image_url)})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  if (design.bg_style === 'gradient') return { background: `linear-gradient(160deg, ${design.bg_color}, ${design.bg_color_2})` }
  return { background: design.bg_color }
}

type Props = { design: ProfileDesign; title: string; businessName: string; links: PublicLink[]; onLinkClick?: (link: PublicLink) => void; footer?: ReactNode }

export function ProfileCard({ design, title, businessName, links, onLinkClick, footer }: Props) {
  return (
    <div className="profile-card" style={{ color: design.text_color }}>
      {design.logo_url ? <img className="profile-logo" src={design.logo_url} alt={`Logo de ${businessName}`} /> : <span className="profile-logo placeholder" style={{ background: design.button_color, color: design.button_text_color }}>{initials(businessName)}</span>}
      <h1>{businessName}</h1>
      {title && title !== businessName && <p className="profile-title">{title}</p>}
      {design.bio && <p className="profile-bio">{design.bio}</p>}
      <div className="profile-links">
        {links.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer" style={{ background: design.button_color, color: design.button_text_color, borderRadius: radius[design.button_shape] }} onClick={() => onLinkClick?.(link)}>{link.label}<ArrowUpRight size={16} /></a>)}
        {!links.length && <p className="profile-empty">Aún no hay enlaces publicados.</p>}
      </div>
      {footer}
    </div>
  )
}
