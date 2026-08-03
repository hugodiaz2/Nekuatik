import { useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import Header from '../components/Header'
import {
  CATEGORIAS,
  CATEGORIA_GRANEL,
  esGranel,
  folioVenta,
  precioPorUnidadVendida,
  ventaCoincideBusqueda,
} from '../constants'
import { registrarDevolucion } from '../firebase/devoluciones'

function esMismoDia(fechaTimestamp) {
  if (!fechaTimestamp?.toDate) return false
  const f = fechaTimestamp.toDate()
  const hoy = new Date()
  return (
    f.getFullYear() === hoy.getFullYear() &&
    f.getMonth() === hoy.getMonth() &&
    f.getDate() === hoy.getDate()
  )
}

export default function Ventas() {
  const { usuario } = useAuth()
  const [productos, setProductos] = useState([])
  const [ventasRecientes, setVentasRecientes] = useState([])
  const [devolucionesRecientes, setDevolucionesRecientes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState([])
  const [modalPago, setModalPago] = useState(null) // 'efectivo' | 'tarjeta' | null
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  const [mostrarDevolucion, setMostrarDevolucion] = useState(false)
  const [mostrarAltaRapida, setMostrarAltaRapida] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [procesando, setProcesando] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'productos'), orderBy('nombre'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProductos(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'ventas'), orderBy('fecha', 'desc'), limit(200))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setVentasRecientes(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'devoluciones'), orderBy('fecha', 'desc'), limit(200))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDevolucionesRecientes(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsubscribe
  }, [])

  const { numVentasHoy, acumuladoHoy } = useMemo(() => {
    const deHoy = ventasRecientes.filter((v) => esMismoDia(v.fecha))
    const totalVendido = deHoy.reduce((acc, v) => acc + (v.total || 0), 0)
    const totalDevuelto = devolucionesRecientes
      .filter((d) => esMismoDia(d.fecha))
      .reduce((acc, d) => acc + (d.monto || 0), 0)
    return {
      numVentasHoy: deHoy.length,
      acumuladoHoy: totalVendido - totalDevuelto,
    }
  }, [ventasRecientes, devolucionesRecientes])

  const sugerencias = useMemo(() => {
    if (!busqueda.trim()) return []
    const texto = busqueda.toLowerCase()
    return productos
      .filter((p) => {
        const coincideCodigo = p.codigoBarras?.toLowerCase() === texto
        if (esGranel(p)) {
          // A Granel: se busca por nombre o por el código interno asignado.
          return coincideCodigo || p.nombre?.toLowerCase().includes(texto)
        }
        // Individual: solo se encuentra con el código exacto (escáner o escrito).
        return coincideCodigo
      })
      .slice(0, 6)
  }, [busqueda, productos])

  const agregarAlCarrito = (producto) => {
    setCarrito((prev) => {
      const existente = prev.find((item) => item.id === producto.id)
      if (existente) {
        return prev.map((item) =>
          item.id === producto.id
            ? { ...item, cantidad: item.cantidad + (esGranel(producto) ? 100 : 1) }
            : item,
        )
      }
      return [...prev, { ...producto, cantidad: esGranel(producto) ? 100 : 1 }]
    })
    setBusqueda('')
  }

  const handleBusquedaKeyDown = (e) => {
    if (e.key !== 'Enter') return
    const texto = busqueda.trim().toLowerCase()
    if (!texto) return
    const porCodigo = productos.find((p) => p.codigoBarras?.toLowerCase() === texto)
    if (porCodigo) {
      agregarAlCarrito(porCodigo)
      return
    }
    if (sugerencias.length === 1) {
      agregarAlCarrito(sugerencias[0])
    }
  }

  const cambiarCantidad = (id, cantidad) => {
    const valor = Math.max(0, Number(cantidad) || 0)
    setCarrito((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, cantidad: valor } : item))
        .filter((item) => item.cantidad > 0),
    )
  }

  const quitarDelCarrito = (id) => {
    setCarrito((prev) => prev.filter((item) => item.id !== id))
  }

  const total = useMemo(
    () =>
      carrito.reduce(
        (acc, item) => acc + item.cantidad * precioPorUnidadVendida(item),
        0,
      ),
    [carrito],
  )

  const registrarVenta = async (datosPago) => {
    if (carrito.length === 0) return
    setProcesando(true)
    setMensaje('')
    try {
      await runTransaction(db, async (transaction) => {
        // Todas las lecturas primero (stock de cada producto + contador de
        // folios), y hasta el final las escrituras: Firestore no garantiza
        // el resultado de una transacción que intercala lecturas y escrituras.
        const productoRefs = carrito.map((item) => doc(db, 'productos', item.id))
        const productoSnaps = []
        for (const ref of productoRefs) {
          productoSnaps.push(await transaction.get(ref))
        }
        const contadorRef = doc(db, 'contadores', 'ventas')
        const contadorSnap = await transaction.get(contadorRef)

        carrito.forEach((item, i) => {
          const stockActual = productoSnaps[i].data()?.stock ?? 0
          if (stockActual < item.cantidad) {
            throw new Error(`Stock insuficiente de "${item.nombre}"`)
          }
        })

        const folio = (contadorSnap.data()?.ultimo ?? 0) + 1

        carrito.forEach((item, i) => {
          const stockActual = productoSnaps[i].data()?.stock ?? 0
          transaction.update(productoRefs[i], { stock: stockActual - item.cantidad })
        })
        transaction.set(contadorRef, { ultimo: folio }, { merge: true })

        const ventaRef = doc(collection(db, 'ventas'))
        transaction.set(ventaRef, {
          folio,
          items: carrito.map((item) => ({
            productoId: item.id,
            nombre: item.nombre,
            contenido: item.contenido ?? '',
            categoria: item.categoria ?? '',
            cantidad: item.cantidad,
            unidad: esGranel(item) ? 'g' : 'pza',
            precioUnitario: precioPorUnidadVendida(item),
          })),
          total,
          vendedorEmail: usuario?.email ?? null,
          fecha: serverTimestamp(),
          ...datosPago,
        })
      })

      setCarrito([])
      setModalPago(null)
      setMensaje('Venta registrada correctamente.')
    } catch (err) {
      setMensaje(err.message || 'No se pudo completar la venta.')
      throw err
    } finally {
      setProcesando(false)
    }
  }

  const noHayCoincidencias = busqueda.trim().length > 0 && sugerencias.length === 0

  return (
    <div>
      <Header
        title="Punto de venta"
        stats={
          <>
            <span className="text-sm text-white/60">
              Ventas hoy: <span className="font-semibold text-white">{numVentasHoy}</span>
            </span>
            <span className="text-sm text-white/60">
              Acumulado: <span className="font-semibold text-white">${acumuladoHoy.toFixed(2)}</span>
            </span>
          </>
        }
      >
        <button
          onClick={() => setMostrarHistorial(true)}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
        >
          Historial
        </button>
        <button
          onClick={() => setMostrarDevolucion(true)}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
        >
          ↩️ Hacer Devolución
        </button>
      </Header>

      <div className="p-6">
        <div className="relative mb-6 max-w-md">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={handleBusquedaKeyDown}
            autoFocus
            placeholder="Detección de barras o búsqueda de producto..."
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition focus:border-orange-400/60 focus:bg-white/10 focus:ring-2 focus:ring-orange-400/20"
          />
          {sugerencias.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-lg border border-white/10 bg-neutral-900 shadow-2xl shadow-black/40">
              {sugerencias.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => agregarAlCarrito(p)}
                    className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-white/80 hover:bg-white/5"
                  >
                    <span>{p.nombre}</span>
                    <span className="text-white/40">
                      ${Number(p.precio || 0).toFixed(2)}
                      {esGranel(p) ? ' /100g' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {noHayCoincidencias && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-white/10 bg-neutral-900 p-3 shadow-2xl shadow-black/40">
              <p className="mb-1 text-sm text-white/50">
                No se encontró "{busqueda}" en el inventario.
              </p>
              <p className="mb-2 text-xs text-white/40">
                Recuerda: los productos individuales solo se encuentran escaneando o escribiendo
                su código de barras exacto (no por nombre).
              </p>
              <button
                onClick={() => setMostrarAltaRapida(true)}
                className="w-full rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 hover:brightness-110"
              >
                + Agregar producto nuevo
              </button>
            </div>
          )}
        </div>

        {carrito.length === 0 ? (
          <p className="text-sm text-white/40">
            Busca o escanea un producto para agregarlo al ticket.
          </p>
        ) : (
          <div className="mb-8 max-w-2xl space-y-5">
            {carrito.map((item) => {
              const subtotal = item.cantidad * precioPorUnidadVendida(item)
              const granel = esGranel(item)
              return (
                <div key={item.id} className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{item.nombre}</p>
                    <p className="text-xs text-white/40 underline decoration-dotted">
                      {item.contenido || (granel ? 'Granel' : '—')} / $
                      {Number(item.precio || 0).toFixed(2)}
                      {granel ? ' /100g' : ''}
                    </p>
                    <p className="mt-1 text-xs text-white/50">
                      SUBTOTAL: <span className="font-semibold">${subtotal.toFixed(2)}</span>
                    </p>
                  </div>
                  <div className="flex flex-col items-center">
                    <input
                      type="number"
                      min="0"
                      step={granel ? '1' : '1'}
                      value={item.cantidad}
                      onChange={(e) => cambiarCantidad(item.id, e.target.value)}
                      className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-center text-sm font-semibold text-white outline-none focus:border-orange-400/60 focus:ring-2 focus:ring-orange-400/20"
                    />
                    <span className="mt-1 text-[10px] uppercase tracking-wide text-white/40">
                      {granel ? 'gramos' : 'piezas'}
                    </span>
                  </div>
                  <button
                    onClick={() => quitarDelCarrito(item.id)}
                    className="rounded-lg bg-red-500/90 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-500"
                  >
                    Eliminar
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <p className="mb-4 text-xl font-bold text-white">
          total=${total.toFixed(2)}
        </p>

        {mensaje && <p className="mb-4 text-sm text-white/60">{mensaje}</p>}

        <div className="flex gap-4">
          <button
            onClick={() => setModalPago('efectivo')}
            disabled={carrito.length === 0}
            className="rounded-lg border-2 border-green-500/60 px-4 py-2 text-sm font-semibold text-green-400 hover:bg-green-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Compra efectivo
          </button>
          <button
            onClick={() => setModalPago('tarjeta')}
            disabled={carrito.length === 0}
            className="rounded-lg border-2 border-blue-400/60 px-4 py-2 text-sm font-semibold text-blue-400 hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Compra tarjeta
          </button>
        </div>
      </div>

      {modalPago === 'efectivo' && (
        <EfectivoModal
          total={total}
          procesando={procesando}
          onClose={() => setModalPago(null)}
          onGuardar={(montoRecibido, cambio) =>
            registrarVenta({ metodoPago: 'efectivo', montoRecibido, cambio })
          }
        />
      )}

      {modalPago === 'tarjeta' && (
        <TarjetaModal
          total={total}
          procesando={procesando}
          onClose={() => setModalPago(null)}
          onGuardar={(tipoTarjeta) =>
            registrarVenta({ metodoPago: 'tarjeta', tipoTarjeta })
          }
        />
      )}

      {mostrarHistorial && (
        <HistorialModal ventas={ventasRecientes} onClose={() => setMostrarHistorial(false)} />
      )}

      {mostrarDevolucion && (
        <DevolucionRapidaModal
          ventas={ventasRecientes}
          usuario={usuario}
          onClose={() => setMostrarDevolucion(false)}
        />
      )}

      {mostrarAltaRapida && (
        <AltaRapidaModal
          textoInicial={busqueda}
          onClose={() => setMostrarAltaRapida(false)}
          onCreado={(producto) => {
            agregarAlCarrito(producto)
            setMostrarAltaRapida(false)
          }}
        />
      )}
    </div>
  )
}

function EfectivoModal({ total, procesando, onClose, onGuardar }) {
  const [ingreso, setIngreso] = useState('')
  const cambio = Number(ingreso || 0) - total

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-white/10 bg-neutral-900 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-5 py-3 text-white">
          <h2 className="font-semibold">Efectivo</h2>
          <span className="text-sm text-white/60">Nekuatik</span>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white/70">Total</span>
            <span className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white">
              ${total.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-white/70">Ingreso</label>
            <input
              type="number"
              min="0"
              step="0.01"
              autoFocus
              value={ingreso}
              onChange={(e) => setIngreso(e.target.value)}
              className="w-32 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-right text-sm text-white outline-none transition focus:border-orange-400/60 focus:bg-white/10 focus:ring-2 focus:ring-orange-400/20"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white/70">Cambio</span>
            <span
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                cambio < 0 ? 'bg-red-500/10 text-red-400' : 'bg-white/10 text-white'
              }`}
            >
              ${cambio.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-6 border-t border-white/10 px-6 py-4">
          <button onClick={onClose} className="text-sm font-medium text-white/50 hover:text-white">
            Cerrar
          </button>
          <button
            disabled={cambio < 0 || procesando}
            onClick={() => onGuardar(Number(ingreso || 0), cambio)}
            className="text-sm font-semibold text-green-400 hover:text-green-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {procesando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TarjetaModal({ total, procesando, onClose, onGuardar }) {
  const [tipoTarjeta, setTipoTarjeta] = useState('debito')

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-white/10 bg-neutral-900 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-5 py-3 text-white">
          <h2 className="font-semibold">Tarjeta</h2>
          <span className="text-sm text-white/60">Nekuatik</span>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-sm font-medium text-white/70">Total: ${total.toFixed(2)}</p>

          <div>
            <p className="mb-2 text-sm font-medium text-white/70">Tipo de tarjeta</p>
            <select
              value={tipoTarjeta}
              onChange={(e) => setTipoTarjeta(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-orange-400/60 focus:bg-white/10 focus:ring-2 focus:ring-orange-400/20"
            >
              <option value="debito">Débito</option>
              <option value="credito">Crédito</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-6 border-t border-white/10 px-6 py-4">
          <button onClick={onClose} className="text-sm font-medium text-white/50 hover:text-white">
            Cancelar
          </button>
          <button
            disabled={procesando}
            onClick={() => onGuardar(tipoTarjeta)}
            className="text-sm font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-40"
          >
            {procesando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function HistorialModal({ ventas, onClose }) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-neutral-900 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-5 py-3 text-white">
          <h2 className="font-semibold">Historial de ventas</h2>
          <button onClick={onClose} className="text-sm text-white/60 hover:text-white">
            Cerrar ×
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto">
          <table className="min-w-full text-sm text-white">
            <thead className="sticky top-0 bg-white/[0.06] text-left text-white/60">
              <tr>
                <th className="px-4 py-3">Folio</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3">Pago</th>
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id} className="border-t border-white/10 transition hover:bg-white/5">
                  <td className="px-4 py-3 font-mono text-xs text-white/50">{folioVenta(v)}</td>
                  <td className="px-4 py-3">
                    {v.fecha?.toDate ? v.fecha.toDate().toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">{v.vendedorEmail}</td>
                  <td className="px-4 py-3 capitalize">{v.metodoPago}</td>
                  <td className="px-4 py-3 font-semibold">${Number(v.total || 0).toFixed(2)}</td>
                </tr>
              ))}
              {ventas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-white/40">
                    Aún no hay ventas registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// "Procesar Devolución": dos columnas — izquierda buscador (por dulce o
// folio) + lista de ventas recientes; derecha la venta elegida, el dulce a
// devolver (una venta puede tener varios), cantidad, motivo y confirmación.
// El producto_id guardado en cada línea de la venta es lo que permite
// regresar la pieza exacta a su fila del inventario.
function DevolucionRapidaModal({ ventas, usuario, onClose }) {
  const [busqueda, setBusqueda] = useState('')
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null)
  const [itemIdx, setItemIdx] = useState(0)
  const [cantidad, setCantidad] = useState(0)
  const [motivo, setMotivo] = useState('cambio')
  const [monto, setMonto] = useState('0.00')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  const listaVentas = useMemo(() => {
    const texto = busqueda.trim()
    const base = texto
      ? ventas.filter((v) => ventaCoincideBusqueda(v, texto))
      : ventas.filter((v) => esMismoDia(v.fecha))
    return base.slice(0, 20)
  }, [busqueda, ventas])

  const item = ventaSeleccionada?.items?.[itemIdx] ?? null

  const fijarItem = (venta, idx) => {
    const it = venta.items?.[idx]
    setItemIdx(idx)
    setCantidad(it?.cantidad ?? 0)
    setMonto(((it?.cantidad ?? 0) * (it?.precioUnitario || 0)).toFixed(2))
  }

  const seleccionarVenta = (venta) => {
    setVentaSeleccionada(venta)
    const texto = busqueda.trim().toLowerCase()
    const idx = texto
      ? Math.max(
          0,
          (venta.items || []).findIndex((it) => it.nombre?.toLowerCase().includes(texto)),
        )
      : 0
    fijarItem(venta, idx)
  }

  const actualizarCantidad = (valor) => {
    const c = Math.max(0, Math.min(item.cantidad, Number(valor) || 0))
    setCantidad(c)
    setMonto((c * (item.precioUnitario || 0)).toFixed(2))
  }

  const volver = () => {
    setVentaSeleccionada(null)
    setItemIdx(0)
  }

  const handleConfirmar = async () => {
    if (!item || cantidad <= 0) return
    setGuardando(true)
    setError('')
    try {
      await registrarDevolucion(db, {
        usuario,
        venta: ventaSeleccionada,
        item,
        cantidad,
        motivo,
        monto: Number(monto) || 0,
      })
      setExito(
        motivo === 'perdida'
          ? `Se registró "${item.nombre}" como mercancía perdida (merma). Se descontaron $${Number(monto).toFixed(2)} de caja.`
          : `Devolución registrada: "${item.nombre}" reingresó al inventario y se descontaron $${Number(monto).toFixed(2)} de caja.`,
      )
    } catch (err) {
      setError(err.message || 'No se pudo registrar la devolución.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/10 bg-neutral-900 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-6 py-4 text-white">
          <div className="flex items-center gap-2">
            <span className="text-xl">↩️</span>
            <h2 className="text-lg font-semibold">Procesar Devolución</h2>
          </div>
          <button onClick={onClose} className="text-sm text-white/60 hover:text-white">
            Cerrar ×
          </button>
        </div>

        {exito ? (
          <div className="p-6">
            <p className="rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400">{exito}</p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={onClose}
                className="rounded-lg bg-white/10 px-5 py-2 text-sm font-semibold text-white hover:bg-white/20"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden sm:flex-row">
            <div className="flex w-full flex-col border-b p-5 sm:w-2/5 sm:border-b-0 sm:border-r">
              <label className="mb-1 text-sm font-medium text-white/70">
                Buscar por Producto o Folio
              </label>
              <input
                type="text"
                autoFocus
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Ej. Jamoncillo o FOL-102..."
                className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-orange-400/60 focus:bg-white/10 focus:ring-2 focus:ring-orange-400/20"
              />
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-white/40">
                {busqueda.trim() ? 'Resultados' : 'Ventas recientes (hoy)'}
              </p>
              <div className="flex-1 space-y-2 overflow-y-auto">
                {listaVentas.map((v) => {
                  const seleccionada = ventaSeleccionada?.id === v.id
                  return (
                    <button
                      key={v.id}
                      onClick={() => seleccionarVenta(v)}
                      className={`w-full rounded-lg border border-white/10 px-3 py-2 text-left text-sm text-white transition ${
                        seleccionada ? 'border-orange-500 bg-orange-500/10' : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-white">
                          {folioVenta(v)}
                        </span>
                        <span className="font-semibold text-white">
                          ${Number(v.total || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-xs text-white/50">
                        <span>
                          {v.fecha?.toDate
                            ? v.fecha.toDate().toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}{' '}
                          · <span className="capitalize">{v.metodoPago}</span>
                        </span>
                        <span className="text-orange-400">Ver productos →</span>
                      </div>
                    </button>
                  )
                })}
                {listaVentas.length === 0 && (
                  <p className="text-sm text-white/40">
                    {busqueda.trim()
                      ? `Sin resultados para "${busqueda}".`
                      : 'No hay ventas registradas hoy todavía.'}
                  </p>
                )}
              </div>
            </div>

            <div className="flex w-full flex-col overflow-y-auto p-5 sm:w-3/5">
              {!ventaSeleccionada ? (
                <p className="m-auto max-w-xs text-center text-sm text-white/40">
                  Elige una venta de la lista para ver sus productos.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-white">
                    <span className="text-white/60">Venta Seleccionada: </span>
                    <span className="font-mono font-semibold text-white">
                      {folioVenta(ventaSeleccionada)}
                    </span>
                    <span className="float-right text-white/60">
                      Total Original:{' '}
                      <span className="font-semibold text-white">
                        ${Number(ventaSeleccionada.total || 0).toFixed(2)}
                      </span>
                    </span>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-white/70">
                      Selecciona el Dulce a Devolver
                    </label>
                    <select
                      value={itemIdx}
                      onChange={(e) => fijarItem(ventaSeleccionada, Number(e.target.value))}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-orange-400/60 focus:bg-white/10 focus:ring-2 focus:ring-orange-400/20"
                    >
                      {(ventaSeleccionada.items || []).map((it, idx) => (
                        <option key={idx} value={idx}>
                          {it.nombre} (ID: {it.productoId?.slice(-6).toUpperCase()}) — $
                          {Number(it.precioUnitario || 0).toFixed(2)} c/u
                        </option>
                      ))}
                    </select>
                  </div>

                  {item && (
                    <>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-white/70">
                          Cantidad a Devolver {item.unidad === 'g' ? '(g)' : ''}
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min="0"
                            max={item.cantidad}
                            value={cantidad}
                            onChange={(e) => actualizarCantidad(e.target.value)}
                            className="w-32 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-orange-400/60 focus:bg-white/10 focus:ring-2 focus:ring-orange-400/20"
                          />
                          <span className="text-sm text-white/40">
                            Máx: {item.cantidad} {item.unidad === 'g' ? 'g' : ''}
                          </span>
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-sm font-medium text-white/70">
                          Motivo de la devolución
                        </p>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 rounded-lg border border-white/10 p-3 text-sm text-white has-[:checked]:border-green-500 has-[:checked]:bg-green-500/10">
                            <input
                              type="radio"
                              name="motivo-rapido"
                              checked={motivo === 'cambio'}
                              onChange={() => setMotivo('cambio')}
                            />
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-500" />
                            <span>
                              <span className="font-medium">Cliente se arrepintió:</span>{' '}
                              <span className="text-white/60">Producto intacto.</span>{' '}
                              <span className="text-xs italic text-white/40">
                                (Regresa a stock en BD)
                              </span>
                            </span>
                          </label>
                          <label className="flex items-center gap-2 rounded-lg border border-white/10 p-3 text-sm text-white has-[:checked]:border-red-500 has-[:checked]:bg-red-500/10">
                            <input
                              type="radio"
                              name="motivo-rapido"
                              checked={motivo === 'perdida'}
                              onChange={() => setMotivo('perdida')}
                            />
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
                            <span>
                              <span className="font-medium">Producto dañado / Merma:</span>{' '}
                              <span className="text-white/60">Empaque roto/caducado.</span>{' '}
                              <span className="text-xs italic text-white/40">
                                (NO regresa a stock)
                              </span>
                            </span>
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-white/70">
                          Monto a reembolsar
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={monto}
                          onChange={(e) => setMonto(e.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-orange-400/60 focus:bg-white/10 focus:ring-2 focus:ring-orange-400/20"
                        />
                        <p className="mt-1 text-xs text-white/40">
                          Se calcula automático; ajústalo si el reembolso es parcial.
                        </p>
                      </div>

                      {error && (
                        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
                          {error}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {!exito && ventaSeleccionada && (
          <div className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
            <button
              onClick={volver}
              className="rounded-lg border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Volver
            </button>
            {item && (
              <button
                onClick={handleConfirmar}
                disabled={guardando || cantidad <= 0}
                className="rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 hover:brightness-110 disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : `Guardar ($${(Number(monto) || 0).toFixed(2)})`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const altaInputClass =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-orange-400/60 focus:bg-white/10 focus:ring-2 focus:ring-orange-400/20'

function AltaRapidaModal({ textoInicial, onClose, onCreado }) {
  const pareceCodigoBarras = /^\d{6,}$/.test(textoInicial.trim())
  const [form, setForm] = useState({
    nombre: pareceCodigoBarras ? '' : textoInicial,
    codigoBarras: pareceCodigoBarras ? textoInicial.trim() : '',
    categoria: CATEGORIAS[0],
    precio: '',
    stock: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const granel = form.categoria === CATEGORIA_GRANEL

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleGuardar = async () => {
    if (!form.nombre.trim() || !form.precio) return
    setGuardando(true)
    setError('')
    try {
      const stockInicial = Number(form.stock) || 0
      const nuevo = {
        nombre: form.nombre.trim(),
        codigoBarras: form.codigoBarras.trim(),
        categoria: form.categoria,
        presentacion: 'individual',
        empaque: 'piezas',
        numPaquetePiezas: 1,
        cantidadComprada: stockInicial,
        precio: Number(form.precio) || 0,
        contenido: '',
        stock: stockInicial,
        stockMinimo: 0,
        fechaCompra: '',
        caducidad: '',
        lotes: [],
        creadoEn: serverTimestamp(),
      }
      const ref = await addDoc(collection(db, 'productos'), nuevo)
      onCreado({ id: ref.id, ...nuevo })
    } catch (err) {
      setError(
        err.code === 'permission-denied'
          ? 'Firestore rechazó el guardado (permission-denied). Revisa que hayas publicado firestore.rules.'
          : err.message || 'No se pudo crear el producto.',
      )
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-white/10 bg-neutral-900 shadow-2xl shadow-black/50">
        <div className="border-b border-white/10 bg-white/[0.03] px-6 py-4 text-white">
          <h2 className="text-lg font-semibold">Alta rápida de producto</h2>
          <p className="text-xs text-white/40">Se agrega al inventario y al ticket al instante.</p>
        </div>

        <div className="space-y-3 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-white/70">Nombre</label>
            <input
              name="nombre"
              value={form.nombre}
              onChange={onChange}
              className={altaInputClass}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-white/70">Código de barras</label>
            <input
              name="codigoBarras"
              value={form.codigoBarras}
              onChange={onChange}
              className={altaInputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-white/70">Categoría</label>
            <select name="categoria" value={form.categoria} onChange={onChange} className={altaInputClass}>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-white/70">
                {granel ? 'Precio (por 100g)' : 'Precio'}
              </label>
              <input
                type="number"
                step="0.01"
                name="precio"
                value={form.precio}
                onChange={onChange}
                className={altaInputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-white/70">
                Stock inicial {granel && '(g)'}
              </label>
              <input
                type="number"
                name="stock"
                value={form.stock}
                onChange={onChange}
                className={altaInputClass}
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="mx-6 mb-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        <div className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-white/10 px-5 py-2 text-sm font-semibold text-white hover:bg-white/20"
          >
            Cerrar
          </button>
          <button
            onClick={handleGuardar}
            disabled={guardando}
            className="rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-orange-500/25 hover:brightness-110 disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar y agregar al ticket'}
          </button>
        </div>
      </div>
    </div>
  )
}
