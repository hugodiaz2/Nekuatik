import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Dulces flotando de fondo: posición, tamaño y tiempos distintos por
// partícula para que el movimiento se vea orgánico, no sincronizado.
const PARTICULAS = [
  { emoji: '🍬', left: '6%', duration: '19s', delay: '0s', size: 'text-2xl' },
  { emoji: '🍭', left: '16%', duration: '24s', delay: '3s', size: 'text-3xl' },
  { emoji: '🍫', left: '28%', duration: '21s', delay: '7s', size: 'text-xl' },
  { emoji: '🧁', left: '40%', duration: '27s', delay: '1s', size: 'text-2xl' },
  { emoji: '🍡', left: '54%', duration: '23s', delay: '9s', size: 'text-xl' },
  { emoji: '🍬', left: '67%', duration: '26s', delay: '4s', size: 'text-2xl' },
  { emoji: '🍭', left: '79%', duration: '20s', delay: '11s', size: 'text-3xl' },
  { emoji: '🍫', left: '90%', duration: '25s', delay: '6s', size: 'text-xl' },
]

function IconoUsuario() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
      />
    </svg>
  )
}

function IconoCorreo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    </svg>
  )
}

function IconoCandado() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  )
}

function IconoOjo({ tachado }) {
  if (tachado) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

const MENSAJES_ERROR = {
  'auth/email-already-in-use': 'Ese correo ya tiene una cuenta registrada.',
  'auth/invalid-email': 'El correo electrónico no es válido.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
}

export default function Registro() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (username.trim().length < 3) {
      setError('El usuario debe tener al menos 3 caracteres.')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirmarPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setEnviando(true)
    try {
      await register(email, password, username.trim())
      navigate('/ventas')
    } catch (err) {
      setError(MENSAJES_ERROR[err.code] ?? 'No se pudo crear la cuenta. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-neutral-950 px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="login-blob -top-32 -left-32 h-96 w-96 bg-orange-500/40"
          style={{ animationDuration: '24s' }}
        />
        <div
          className="login-blob -right-24 -bottom-40 h-[28rem] w-[28rem] bg-amber-400/30"
          style={{ animationDuration: '28s', animationDelay: '2s' }}
        />
        <div
          className="login-blob top-1/3 left-1/2 h-80 w-80 bg-rose-500/20"
          style={{ animationDuration: '20s', animationDelay: '5s' }}
        />

        {PARTICULAS.map((p, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`login-particle select-none ${p.size}`}
            style={{ left: p.left, animationDuration: p.duration, animationDelay: p.delay }}
          >
            {p.emoji}
          </span>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="login-card-enter relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.07] p-8 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-10"
      >
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-2xl shadow-lg shadow-orange-500/30">
            🍬
          </span>
          <div className="text-center">
            <h1 className="bg-gradient-to-r from-orange-300 via-amber-200 to-orange-300 bg-clip-text text-2xl font-bold tracking-wide text-transparent">
              NEKUATIK
            </h1>
            <p className="mt-1 text-sm text-white/50">Crear cuenta de empleado</p>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium text-white/70">
              Usuario
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-white/35">
                <IconoUsuario />
              </span>
              <input
                id="username"
                type="text"
                required
                minLength={3}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pr-3 pl-10 text-sm text-white placeholder-white/30 outline-none transition focus:border-orange-400/60 focus:bg-white/10 focus:ring-2 focus:ring-orange-400/20"
                placeholder="nombre.apellido"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-white/70">
              Correo electrónico
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-white/35">
                <IconoCorreo />
              </span>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pr-3 pl-10 text-sm text-white placeholder-white/30 outline-none transition focus:border-orange-400/60 focus:bg-white/10 focus:ring-2 focus:ring-orange-400/20"
                placeholder="empleado@dulceria.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-white/70">
              Contraseña
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-white/35">
                <IconoCandado />
              </span>
              <input
                id="password"
                type={mostrarPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pr-10 pl-10 text-sm text-white placeholder-white/30 outline-none transition focus:border-orange-400/60 focus:bg-white/10 focus:ring-2 focus:ring-orange-400/20"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setMostrarPassword((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-white/35 transition hover:text-white/70"
                aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <IconoOjo tachado={mostrarPassword} />
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmarPassword" className="mb-1 block text-sm font-medium text-white/70">
              Confirmar contraseña
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-white/35">
                <IconoCandado />
              </span>
              <input
                id="confirmarPassword"
                type={mostrarPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={confirmarPassword}
                onChange={(e) => setConfirmarPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pr-3 pl-10 text-sm text-white placeholder-white/30 outline-none transition focus:border-orange-400/60 focus:bg-white/10 focus:ring-2 focus:ring-orange-400/20"
                placeholder="••••••••"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="mt-7 w-full rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-orange-500/40 hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
        >
          {enviando ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>

        <p className="mt-6 text-center text-sm text-white/50">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium text-orange-300 hover:text-orange-200">
            Inicia sesión
          </Link>
        </p>
      </form>
    </div>
  )
}
