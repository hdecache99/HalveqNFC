import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (request) => {
  const headers = corsHeaders(request.headers.get('Origin'))
  if (request.method === 'OPTIONS') return new Response('ok', { headers })

  try {
    const authHeader = request.headers.get('Authorization') ?? ''
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: { user: caller } } = await userClient.auth.getUser()
    if (!caller) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } })

    const body = await request.json()
    const { workspaceId, name, email, role } = body
    if (typeof workspaceId !== 'string' || !/^[0-9a-f-]{36}$/i.test(workspaceId)) throw new Error('Workspace inválido')
    if (typeof name !== 'string' || name.trim().length < 2 || name.length > 100) throw new Error('Nombre inválido')
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Correo inválido')
    if (role !== 'Administrador' && role !== 'Operador') throw new Error('Rol inválido')
    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: membership } = await adminClient.from('workspace_members').select('role, status').eq('workspace_id', workspaceId).eq('user_id', caller.id).single()
    if (!membership || membership.role !== 'Administrador' || membership.status !== 'Activo') return new Response(JSON.stringify({ error: 'No tienes permisos para invitar usuarios' }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } })

    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, { data: { full_name: name } })
    if (inviteError || !invited.user) throw inviteError ?? new Error('No se pudo crear la invitación')
    const { error: memberError } = await adminClient.from('workspace_members').insert({ workspace_id: workspaceId, user_id: invited.user.id, name, email, role: role ?? 'Operador', status: 'Pendiente' })
    if (memberError) throw memberError

    return new Response(JSON.stringify({ ok: true }), { headers: { ...headers, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Error interno' }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } })
  }
})
