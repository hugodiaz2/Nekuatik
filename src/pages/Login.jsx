import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      await login(email, password)
      navigate('/ventas')
    } catch (err) {
      setError('Correo o contraseña incorrectos.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-pink-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg"
      >
        <h1 className="mb-1 text-center text-2xl font-bold text-pink-600">
          🍬 Nekuatik
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          Sistema de Punto de Venta e Inventario
        </p>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <label className="mb-1 block text-sm font-medium text-gray-700">
          Correo electrónico
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none"
          placeholder="empleado@dulceria.com"
        />

        <label className="mb-1 block text-sm font-medium text-gray-700">
          Contraseña
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-6 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none"
          placeholder="••••••••"
        />

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-md bg-pink-600 py-2 font-semibold text-white transition hover:bg-pink-700 disabled:opacity-50"
        >
          {enviando ? 'Ingresando...' : 'Iniciar sesión'}
        </button>
      </form>
    </div>
  )
}
