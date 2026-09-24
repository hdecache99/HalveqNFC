export const initials = (name: string) => name.trim().split(/\s+/).map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase() || '?'

export const formatDate = (value: string) => new Date(value).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

export const toSlug = (value: string) => value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export const publicTagUrl = (slug: string | null, id: string) => `${window.location.origin}/t/${slug ?? id}`

export const errorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : 'Ocurrió un error inesperado'
  if (message.includes('duplicate key') && message.includes('slug')) return 'Esa dirección (slug) ya está en uso. Elige otra.'
  if (message.includes('row-level security')) return 'No tienes permisos para hacer este cambio.'
  return message
}

export const periodStart = (days: number) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (days - 1)); return date }
