import { useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'

const METODOS_PAGO = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'tarjeta', label: 'Tarjeta' },
  { id: 'transferencia', label: 'Transferencia' },
]

export default function Ventas() {
  const { usuario } = useAuth()
  const [productos, setProductos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState([])
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'productos'), orderBy('nombre'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProductos(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      )
    })
    return unsubscribe
  }, [])

  const filtrados = productos.filter((p) =>
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase()),
  )

  const agregarAlCarrito = (producto) => {
    setCarrito((prev) => {
      const existente = prev.find((item) => item.id === producto.id)
      if (existente) {
        return prev.map((item) =>
          item.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item,
        )
      }
      return [...prev, { ...producto, cantidad: 1 }]
    })
  }

  const cambiarCantidad = (id, delta) => {
    setCarrito((prev) =>
      prev
        .map((item) =>
          item.id === id
            ? { ...item, cantidad: Math.max(1, item.cantidad + delta) }
            : item,
        )
        .filter((item) => item.cantidad > 0),
    )
  }

  const quitarDelCarrito = (id) => {
    setCarrito((prev) => prev.filter((item) => item.id !== id))
  }

  const total = useMemo(
    () =>
      carrito.reduce(
        (acc, item) => acc + item.cantidad * Number(item.precio || 0),
        0,
      ),
    [carrito],
  )

  const finalizarVenta = async () => {
    if (carrito.length === 0) return
    setProcesando(true)
    setMensaje('')
    try {
      await runTransaction(db, async (transaction) => {
        // Verifica stock disponible y lo descuenta de forma atómica.
        for (const item of carrito) {
          const ref = doc(db, 'productos', item.id)
          const snap = await transaction.get(ref)
          const stockActual = snap.data()?.stock ?? 0
          if (stockActual < item.cantidad) {
            throw new Error(`Stock insuficiente de "${item.nombre}"`)
          }
          transaction.update(ref, { stock: stockActual - item.cantidad })
        }

        const ventaRef = doc(collection(db, 'ventas'))
        transaction.set(ventaRef, {
          items: carrito.map((item) => ({
            productoId: item.id,
            nombre: item.nombre,
            cantidad: item.cantidad,
            precioUnitario: Number(item.precio || 0),
          })),
          total,
          metodoPago,
          vendedorEmail: usuario?.email ?? null,
          fecha: serverTimestamp(),
        })
      })

      setCarrito([])
      setMensaje('Venta registrada correctamente.')
    } catch (err) {
      setMensaje(err.message || 'No se pudo completar la venta.')
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Productos */}
      <div className="lg:col-span-2">
        <input
          type="text"
          placeholder="Buscar producto para agregar..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {filtrados.map((p) => (
            <button
              key={p.id}
              onClick={() => agregarAlCarrito(p)}
              disabled={(p.stock ?? 0) <= 0}
              className="rounded-lg bg-white p-3 text-left shadow transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="mb-1 text-2xl">🍬</div>
              <p className="truncate text-sm font-semibold text-gray-800">
                {p.nombre}
              </p>
              <p className="text-xs text-gray-500">
                ${Number(p.precio || 0).toFixed(2)} · Stock: {p.stock ?? 0}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Carrito / cobro */}
      <div className="rounded-lg bg-white p-4 shadow">
        <h2 className="mb-3 text-lg font-bold text-gray-800">Ticket actual</h2>

        {carrito.length === 0 ? (
          <p className="text-sm text-gray-400">Agrega productos al ticket.</p>
        ) : (
          <ul className="mb-4 max-h-64 space-y-2 overflow-y-auto">
            {carrito.map((item) => (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-700">{item.nombre}</p>
                  <p className="text-xs text-gray-400">
                    ${Number(item.precio || 0).toFixed(2)} c/u
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => cambiarCantidad(item.id, -1)}
                    className="h-6 w-6 rounded bg-gray-100 hover:bg-gray-200"
                  >
                    −
                  </button>
                  <span className="w-6 text-center">{item.cantidad}</span>
                  <button
                    onClick={() => cambiarCantidad(item.id, 1)}
                    className="h-6 w-6 rounded bg-gray-100 hover:bg-gray-200"
                  >
                    +
                  </button>
                  <button
                    onClick={() => quitarDelCarrito(item.id)}
                    className="ml-1 text-red-500 hover:underline"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mb-3 flex justify-between border-t pt-3 text-base font-bold text-gray-800">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>

        <label className="mb-1 block text-sm font-medium text-gray-700">
          Forma de pago
        </label>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {METODOS_PAGO.map((m) => (
            <button
              key={m.id}
              onClick={() => setMetodoPago(m.id)}
              className={`rounded-md px-2 py-1.5 text-xs font-medium ${
                metodoPago === m.id
                  ? 'bg-pink-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mensaje && (
          <p className="mb-3 text-sm text-gray-600">{mensaje}</p>
        )}

        <button
          onClick={finalizarVenta}
          disabled={carrito.length === 0 || procesando}
          className="w-full rounded-md bg-green-600 py-2 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {procesando ? 'Procesando...' : 'Cobrar'}
        </button>
      </div>
    </div>
  )
}
