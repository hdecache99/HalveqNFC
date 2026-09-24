import { useState, type FormEvent } from 'react'
import { ArrowUpRight, QrCode, ShieldCheck } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok?: boolean } | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) { setMessage({ text: 'Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para iniciar sesión.' }); return }
    if (mode === 'signup' && password !== confirmation) { setMessage({ text: 'Las contraseñas no coinciden.' }); return }
    if (mode === 'signup' && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,}/.test(password)) { setMessage({ text: 'Usa al menos 12 caracteres, mayúscula, minúscula, número y símbolo.' }); return }
    setLoading(true); setMessage(null)
    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
      setLoading(false)
      setMessage(error ? { text: error.message } : { text: 'Si el correo existe, te enviamos un enlace para restablecer tu contraseña.', ok: true })
      return
    }
    const { error } = mode === 'signup'
      ? await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin } })
      : await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setMessage({ text: error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : error.message === 'Email not confirmed' ? 'Confirma tu correo antes de iniciar sesión (revisa tu bandeja y spam).' : error.message }); return }
    if (mode === 'signup') { setMessage({ text: 'Cuenta creada. Revisa tu correo para confirmar la dirección y después inicia sesión.', ok: true }); setMode('login') }
  }

  const switchMode = (next: typeof mode) => { setMode(next); setMessage(null); setPassword(''); setConfirmation('') }
  const heading = { login: 'Bienvenido de nuevo', signup: 'Crea tu cuenta', reset: 'Recupera tu acceso' }[mode]
  const copy = {
    login: 'Administra tus tags NFC, perfiles y resultados desde un solo lugar.',
    signup: 'Si tu proveedor ya te invitó, regístrate con ese mismo correo y tendrás acceso a tu empresa al confirmar.',
    reset: 'Escribe tu correo y te enviaremos un enlace para crear una nueva contraseña.',
  }[mode]

  return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><span className="brand-mark"><QrCode size={21} /></span><span>pulsetag</span></div><div className="auth-heading"><span className="auth-lock"><ShieldCheck size={22} /></span><p className="eyebrow">CONSOLA DE ADMINISTRACIÓN</p><h1>{heading}</h1><p>{copy}</p></div><form onSubmit={submit} className="auth-form">{mode === 'signup' && <label>Nombre completo<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" minLength={2} required /></label>}<label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>{mode !== 'reset' && <label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? 12 : 1} required /></label>}{mode === 'signup' && <label>Confirmar contraseña<input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={12} required /></label>}{message && <p className={`form-error ${message.ok ? 'form-success' : ''}`}>{message.text}</p>}<button className="primary-button auth-submit" type="submit" disabled={loading}>{loading ? 'Procesando...' : mode === 'login' ? 'Iniciar sesión' : mode === 'signup' ? 'Crear cuenta' : 'Enviar enlace'} {!loading && <ArrowUpRight size={16} />}</button></form>{!isSupabaseConfigured && <div className="demo-hint"><ShieldCheck size={14} /> Falta configurar la conexión con Supabase.</div>}<div className="auth-links"><button className="auth-switch" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? '¿Aún no tienes cuenta? Crear cuenta' : '¿Ya tienes cuenta? Iniciar sesión'}</button>{mode === 'login' && <button className="auth-switch" onClick={() => switchMode('reset')}>Olvidé mi contraseña</button>}</div><p className="auth-footer">Usamos confirmación de correo y acceso separado por empresa.</p></section><aside className="auth-aside"><div className="auth-aside-copy"><p className="eyebrow">CONTROL EN CADA TOQUE</p><h2>Convierte cada escaneo en una mejor decisión.</h2><p>Una vista clara para impulsar los negocios que confían en PulseTag.</p></div><div className="auth-stat"><strong>PulseTag</strong><span>control operativo para tu negocio</span></div></aside></main>
}
