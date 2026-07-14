import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase/config'

export default function Catalogo() {
  const [productos, setProductos] = useState([])
  const [busqueda, setBusqueda] = useState('')

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

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Catálogo de productos</h1>
        <input
          type="text"
          placeholder="Buscar producto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
        />
      </div>

      {filtrados.length === 0 ? (
        <p className="text-gray-500">No hay productos que coincidan.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtrados.map((p) => (
            <div
              key={p.id}
              className="rounded-lg bg-white p-3 shadow transition hover:shadow-md"
            >
              <div className="mb-2 flex h-24 items-center justify-center rounded-md bg-pink-50 text-3xl">
                🍭
              </div>
              <h3 className="truncate text-sm font-semibold text-gray-800">
                {p.nombre}
              </h3>
              <p className="text-xs text-gray-500">{p.categoria}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-bold text-pink-600">
                  ${Number(p.precio || 0).toFixed(2)}
                </span>
                <span
                  className={`text-xs ${
                    p.stock <= (p.stockMinimo ?? 0)
                      ? 'text-red-500'
                      : 'text-gray-400'
                  }`}
                >
                  Stock: {p.stock ?? 0}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
