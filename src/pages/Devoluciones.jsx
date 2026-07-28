import { useEffect, useMemo, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import Header from '../components/Header'
import { registrarDevolucion as registrarDevolucionEnFirestore } from '../firebase/devoluciones'
import { folioVenta, ventaCoincideBusqueda } from '../constants'

export default function Devoluciones() {
  const { usuario } = useAuth()
  const [ventas, setVentas] = useState([])
  const [devoluciones, setDevoluciones] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [ventaAbierta, setVentaAbierta] = useState(null)
  const [itemADevolver, setItemADevolver] = useState(null) // { venta, item }
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'ventas'), orderBy('fecha', 'desc'), limit(100))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setVentas(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'devoluciones'), orderBy('fecha', 'desc'), limit(20))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDevoluciones(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsubscribe
  }, [])

  // Búsqueda rápida por nombre del dulce o por folio: los clientes casi
  // nunca traen ticket, así que se busca por lo que sí recuerdan.
  const ventasFiltradas = useMemo(() => {
    const texto = busqueda.trim()
    if (!texto) return ventas
    return ventas.filter((v) => ventaCoincideBusqueda(v, texto))
  }, [busqueda, ventas])

  const registrarDevolucion = async ({ venta, item, cantidad, motivo, monto }) => {
    setMensaje('')
    try {
      await registrarDevolucionEnFirestore(db, { usuario, venta, item, cantidad, motivo, monto })
      setMensaje(
        motivo === 'perdida'
          ? `Se registró "${item.nombre}" como mercancía perdida y se descontó $${monto.toFixed(2)} del acumulado.`
          : `Devolución de "${item.nombre}" registrada, stock reintegrado y $${monto.toFixed(2)} descontados del acumulado.`,
      )
      setItemADevolver(null)
    } catch (err) {
      setMensaje(err.message || 'No se pudo registrar la devolución.')
    }
  }

  return (
    <div>
      <Header title="Devoluciones" />

      <div className="p-6">
        <p className="mb-4 text-sm text-gray-500">
          Selecciona una venta reciente para devolver alguno de sus productos. Si el producto
          sigue en buen estado, el stock se reintegra al inventario; si es mercancía dañada,
          caduca o en mal estado, se descuenta como pérdida (no vuelve a venderse) pero igual se
          registra el reembolso al cliente. En ambos casos el monto se descuenta del acumulado del
          día.
        </p>

        {mensaje && <p className="mb-4 text-sm text-gray-700">{mensaje}</p>}

        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por Producto o Folio (ej. Jamoncillo o FOL-102)..."
          className="mb-4 w-full max-w-md rounded-md bg-gray-100 px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-neutral-800"
        />

        <div className="mb-8 space-y-2">
          {ventasFiltradas.map((v) => {
            const abierta = ventaAbierta === v.id
            return (
              <div key={v.id} className="rounded-lg bg-white shadow">
                <button
                  onClick={() => setVentaAbierta(abierta ? null : v.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm"
                >
                  <span>
                    <span className="font-mono text-xs text-gray-400">{folioVenta(v)}</span> ·{' '}
                    {v.fecha?.toDate ? v.fecha.toDate().toLocaleString() : '—'} ·{' '}
                    <span className="capitalize text-gray-500">{v.metodoPago}</span> ·{' '}
                    <span className="text-gray-500">{v.vendedorEmail}</span>
                  </span>
                  <span className="font-semibold text-gray-800">
                    ${Number(v.total || 0).toFixed(2)} {abierta ? '▲' : '▼'}
                  </span>
                </button>

                {abierta && (
                  <div className="space-y-2 border-t px-4 py-3">
                    {(v.items || []).map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-sm text-gray-700"
                      >
                        <span>
                          {item.nombre} × {item.cantidad} {item.unidad === 'g' ? 'g' : ''} · $
                          {Number(item.precioUnitario || 0).toFixed(2)}
                        </span>
                        <button
                          onClick={() => setItemADevolver({ venta: v, item })}
                          className="rounded bg-orange-500 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-600"
                        >
                          Devolver
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {ventasFiltradas.length === 0 && (
            <p className="text-sm text-gray-400">
              {busqueda
                ? `No se encontraron ventas recientes con "${busqueda}".`
                : 'No hay ventas registradas todavía.'}
            </p>
          )}
        </div>

        <h2 className="mb-3 text-lg font-bold text-gray-800">📋 Historial de Devoluciones y Mermas</h2>
        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Folio</th>
                <th className="px-4 py-2">Producto</th>
                <th className="px-4 py-2">Cant.</th>
                <th className="px-4 py-2">Monto</th>
                <th className="px-4 py-2">Motivo</th>
                <th className="px-4 py-2">Registrada por</th>
                <th className="px-4 py-2">Efecto Stock</th>
              </tr>
            </thead>
            <tbody>
              {devoluciones.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-4 py-2 whitespace-nowrap">
                    {d.fecha?.toDate ? d.fecha.toDate().toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2 font-mono font-semibold text-gray-700">
                    {folioVenta({ folio: d.folio, id: d.ventaId })}
                  </td>
                  <td className="px-4 py-2">{d.nombre}</td>
                  <td className="px-4 py-2">
                    {d.cantidad} {d.unidad === 'g' ? 'g' : 'pza(s)'}
                  </td>
                  <td className="px-4 py-2 font-semibold text-red-600">
                    -${Number(d.monto || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    {d.mercanciaPerdida ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        Merma / Dañado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        Buen estado
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">{d.vendedorEmail}</td>
                  <td className="px-4 py-2">
                    {d.mercanciaPerdida ? (
                      <span className="text-gray-500">
                        Sin reingreso <span className="italic text-gray-400">(Pérdida)</span>
                      </span>
                    ) : (
                      <span className="font-medium text-green-700">
                        +{d.cantidad} al stock
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {devoluciones.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                    Aún no hay devoluciones registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {itemADevolver && (
        <DevolucionModal
          venta={itemADevolver.venta}
          item={itemADevolver.item}
          onClose={() => setItemADevolver(null)}
          onConfirmar={registrarDevolucion}
        />
      )}
    </div>
  )
}

function DevolucionModal({ venta, item, onClose, onConfirmar }) {
  const [cantidad, setCantidad] = useState(item.cantidad)
  const [motivo, setMotivo] = useState('cambio')
  const [monto, setMonto] = useState((item.cantidad * (item.precioUnitario || 0)).toFixed(2))
  const [guardando, setGuardando] = useState(false)

  const actualizarCantidad = (valor) => {
    const c = Math.max(0, Math.min(item.cantidad, Number(valor) || 0))
    setCantidad(c)
    setMonto((c * (item.precioUnitario || 0)).toFixed(2))
  }

  const handleConfirmar = async () => {
    if (cantidad <= 0) return
    setGuardando(true)
    try {
      await onConfirmar({ venta, item, cantidad, motivo, monto: Number(monto) || 0 })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-lg bg-white">
        <div className="bg-neutral-900 px-6 py-4 text-white">
          <h2 className="text-lg font-semibold">Devolver: {item.nombre}</h2>
          <p className="text-xs text-gray-400">
            Vendido: {item.cantidad} {item.unidad === 'g' ? 'g' : 'pzas'}
          </p>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Cantidad a devolver {item.unidad === 'g' ? '(g)' : ''}
            </label>
            <input
              type="number"
              min="0"
              max={item.cantidad}
              value={cantidad}
              onChange={(e) => actualizarCantidad(e.target.value)}
              className="w-full rounded-md bg-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-800"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Motivo</p>
            <div className="space-y-2">
              <label className="flex items-start gap-2 rounded-md border p-3 text-sm has-[:checked]:border-green-500 has-[:checked]:bg-green-50">
                <input
                  type="radio"
                  name="motivo"
                  checked={motivo === 'cambio'}
                  onChange={() => setMotivo('cambio')}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">Cambio / cliente se arrepintió</span>
                  <br />
                  <span className="text-xs text-gray-500">
                    El producto sigue en buen estado y regresa al inventario.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-md border p-3 text-sm has-[:checked]:border-red-500 has-[:checked]:bg-red-50">
                <input
                  type="radio"
                  name="motivo"
                  checked={motivo === 'perdida'}
                  onChange={() => setMotivo('perdida')}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">Producto dañado, endurecido o vencido</span>
                  <br />
                  <span className="text-xs text-gray-500">
                    Es mercancía perdida: NO regresa al stock, pero igual se le devuelve el
                    dinero al cliente.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Monto a reembolsar
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full rounded-md bg-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-800"
            />
            <p className="mt-1 text-xs text-gray-400">
              Se calcula automático según lo vendido; puedes ajustarlo si el reembolso es parcial.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md bg-gray-200 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={guardando || cantidad <= 0}
            className="rounded-md bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Confirmar devolución'}
          </button>
        </div>
      </div>
    </div>
  )
}
