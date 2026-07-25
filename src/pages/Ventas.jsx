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
import { CATEGORIAS, CATEGORIA_GRANEL, esGranel, precioPorUnidadVendida } from '../constants'

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
      .filter(
        (p) =>
          p.nombre?.toLowerCase().includes(texto) ||
          p.codigoBarras?.toLowerCase() === texto,
      )
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
            <span className="text-sm text-gray-300">
              num. ventas: <span className="font-semibold text-white">{numVentasHoy}</span>
            </span>
            <span className="text-sm text-gray-300">
              acumulado $: <span className="font-semibold text-white">{acumuladoHoy.toFixed(2)}</span>
            </span>
          </>
        }
      >
        <button
          onClick={() => setMostrarHistorial(true)}
          className="rounded-md bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-300"
        >
          historial
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
            placeholder="detección de barras, búsqueda de producto....."
            className="w-full rounded-md bg-gray-100 px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-neutral-800"
          />
          {sugerencias.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg">
              {sugerencias.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => agregarAlCarrito(p)}
                    className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <span>{p.nombre}</span>
                    <span className="text-gray-400">
                      ${Number(p.precio || 0).toFixed(2)}
                      {esGranel(p) ? ' /100g' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {noHayCoincidencias && (
            <div className="absolute z-10 mt-1 w-full rounded-md bg-white p-3 shadow-lg">
              <p className="mb-2 text-sm text-gray-500">
                No se encontró "{busqueda}" en el inventario.
              </p>
              <button
                onClick={() => setMostrarAltaRapida(true)}
                className="w-full rounded-md bg-yellow-400 px-3 py-1.5 text-sm font-bold text-black hover:bg-yellow-300"
              >
                + Agregar producto nuevo
              </button>
            </div>
          )}
        </div>

        {carrito.length === 0 ? (
          <p className="text-sm text-gray-400">
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
                    <p className="font-medium text-gray-800">{item.nombre}</p>
                    <p className="text-xs text-gray-400 underline decoration-dotted">
                      {item.contenido || (granel ? 'Granel' : '—')} / $
                      {Number(item.precio || 0).toFixed(2)}
                      {granel ? ' /100g' : ''}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
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
                      className="w-20 rounded-md bg-neutral-900 px-2 py-1.5 text-center text-sm font-semibold text-white"
                    />
                    <span className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">
                      {granel ? 'gramos' : 'piezas'}
                    </span>
                  </div>
                  <button
                    onClick={() => quitarDelCarrito(item.id)}
                    className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-600"
                  >
                    eliminar
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <p className="mb-4 text-xl font-bold text-gray-800">
          total=${total.toFixed(2)}
        </p>

        {mensaje && <p className="mb-4 text-sm text-gray-600">{mensaje}</p>}

        <div className="flex gap-4">
          <button
            onClick={() => setModalPago('efectivo')}
            disabled={carrito.length === 0}
            className="rounded-md border-2 border-green-500 px-4 py-2 text-sm font-semibold text-green-600 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Compra efectivo
          </button>
          <button
            onClick={() => setModalPago('tarjeta')}
            disabled={carrito.length === 0}
            className="rounded-md border-2 border-blue-400 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
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
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm overflow-hidden rounded-lg bg-white">
        <div className="flex items-center justify-between bg-neutral-900 px-5 py-3 text-white">
          <h2 className="font-semibold">Efectivo</h2>
          <span className="text-sm text-gray-300">Nekuatik</span>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Total</span>
            <span className="rounded-md bg-gray-100 px-3 py-1.5 text-sm">
              ${total.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">ingreso</label>
            <input
              type="number"
              min="0"
              step="0.01"
              autoFocus
              value={ingreso}
              onChange={(e) => setIngreso(e.target.value)}
              className="w-32 rounded-md bg-gray-100 px-3 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-neutral-800"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">cambio</span>
            <span
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                cambio < 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-800'
              }`}
            >
              ${cambio.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-6 border-t px-6 py-4">
          <button onClick={onClose} className="text-sm font-medium text-gray-500 hover:text-gray-700">
            cerrar
          </button>
          <button
            disabled={cambio < 0 || procesando}
            onClick={() => onGuardar(Number(ingreso || 0), cambio)}
            className="text-sm font-semibold text-green-600 hover:text-green-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {procesando ? 'guardando...' : 'guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TarjetaModal({ total, procesando, onClose, onGuardar }) {
  const [tipoTarjeta, setTipoTarjeta] = useState('debito')

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm overflow-hidden rounded-lg bg-white">
        <div className="flex items-center justify-between bg-neutral-900 px-5 py-3 text-white">
          <h2 className="font-semibold">Tarjeta</h2>
          <span className="text-sm text-gray-300">Nekuatik</span>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-sm font-medium text-gray-700">Total: ${total.toFixed(2)}</p>

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">tipo de tarjeta</p>
            <select
              value={tipoTarjeta}
              onChange={(e) => setTipoTarjeta(e.target.value)}
              className="w-full rounded-md bg-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-800"
            >
              <option value="debito">Débito</option>
              <option value="credito">Crédito</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-6 border-t px-6 py-4">
          <button onClick={onClose} className="text-sm font-medium text-gray-500 hover:text-gray-700">
            Cancelar
          </button>
          <button
            disabled={procesando}
            onClick={() => onGuardar(tipoTarjeta)}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-40"
          >
            {procesando ? 'guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function HistorialModal({ ventas, onClose }) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white">
        <div className="flex items-center justify-between bg-neutral-900 px-5 py-3 text-white">
          <h2 className="font-semibold">Historial de ventas</h2>
          <button onClick={onClose} className="text-sm text-gray-300 hover:text-white">
            cerrar ×
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-gray-100 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Vendedor</th>
                <th className="px-4 py-2">Pago</th>
                <th className="px-4 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id} className="border-t">
                  <td className="px-4 py-2">
                    {v.fecha?.toDate ? v.fecha.toDate().toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2">{v.vendedorEmail}</td>
                  <td className="px-4 py-2 capitalize">{v.metodoPago}</td>
                  <td className="px-4 py-2 font-semibold">${Number(v.total || 0).toFixed(2)}</td>
                </tr>
              ))}
              {ventas.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
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

const altaInputClass =
  'w-full rounded-md bg-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-800'

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
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-lg bg-white">
        <div className="bg-neutral-900 px-6 py-4 text-white">
          <h2 className="text-lg font-semibold">Alta rápida de producto</h2>
          <p className="text-xs text-gray-400">Se agrega al inventario y al ticket al instante.</p>
        </div>

        <div className="space-y-3 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nombre</label>
            <input
              name="nombre"
              value={form.nombre}
              onChange={onChange}
              className={altaInputClass}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Código de barras</label>
            <input
              name="codigoBarras"
              value={form.codigoBarras}
              onChange={onChange}
              className={altaInputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Categoría</label>
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
              <label className="mb-1 block text-sm font-medium text-gray-700">
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
              <label className="mb-1 block text-sm font-medium text-gray-700">
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
          <p className="mx-6 mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md bg-gray-200 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
          >
            Cerrar
          </button>
          <button
            onClick={handleGuardar}
            disabled={guardando}
            className="rounded-md bg-yellow-400 px-5 py-2 text-sm font-bold text-black hover:bg-yellow-300 disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar y agregar al ticket'}
          </button>
        </div>
      </div>
    </div>
  )
}
