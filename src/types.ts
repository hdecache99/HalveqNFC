export type Role = 'Administrador' | 'Operador'

export type Member = { id: string; name: string; email: string; role: Role; status: 'Activo' | 'Pendiente'; created_at: string; user_id: string }
export type Invitation = { id: string; name: string; email: string; role: Role; created_at: string }

export type WorkspaceSummary = { id: string; name: string; status: 'Activo' | 'Suspendido'; role: Role }
export type Workspace = { id: string; name: string; status: 'Activo' | 'Suspendido'; contact_name: string | null; contact_email: string | null; contact_phone: string | null; plates_count: number; notes: string | null }
export type PlatformWorkspace = Workspace & { created_at: string; members: number; tags: number; scans_30d: number }

export type ProfileDesign = {
  logo_url: string | null
  bio: string | null
  bg_style: 'solid' | 'gradient' | 'image'
  bg_color: string
  bg_color_2: string
  bg_image_url: string | null
  text_color: string
  button_color: string
  button_text_color: string
  button_shape: 'rounded' | 'pill' | 'square'
}
export type LinktreeProfile = ProfileDesign & { id: string; name: string; client_name: string; slug: string; status: 'Activo' | 'Pausado'; store_id: string | null }

export type NfcTag = { id: string; name: string; client_name: string; destination_url: string; status: 'Activo' | 'Pausado'; slug: string | null; store_id: string | null; profile_id: string | null; created_at: string }
export type Scan = { id: string; tag_id: string; scanned_at: string; source: string; visitor_id: string | null }
export type LinkClick = { id: string; link_id: string; clicked_at: string }
export type PublicLink = { id: string; label: string; url: string }
export type ManagedLink = PublicLink & { tag_id: string | null; profile_id: string; position: number; active: boolean }

export type Session = { userId: string; email: string; name: string; isPlatformAdmin: boolean }

export type ViewKey = 'resumen' | 'tags' | 'perfiles' | 'analitica' | 'equipo' | 'empresas' | 'configuracion' | 'tutorial'

export const PROFILE_COLUMNS = 'id, name, client_name, slug, status, store_id, logo_url, bio, bg_style, bg_color, bg_color_2, bg_image_url, text_color, button_color, button_text_color, button_shape'
export const TAG_COLUMNS = 'id, name, client_name, destination_url, status, slug, store_id, profile_id, created_at'
export const LINK_COLUMNS = 'id, tag_id, profile_id, label, url, position, active'

export const DEFAULT_DESIGN: ProfileDesign = {
  logo_url: null, bio: null, bg_style: 'gradient', bg_color: '#f5e6d8', bg_color_2: '#dcece5', bg_image_url: null,
  text_color: '#292a26', button_color: '#292a26', button_text_color: '#f7f5eb', button_shape: 'rounded',
}
