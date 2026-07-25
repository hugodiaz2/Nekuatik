import { useMemo, useState, useEffect } from 'react'
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import Header from '../components/Header'
import { CATEGORIAS, CATEGORIA_GRANEL, esGranel } from '../constants'

function unidadesPorLote(producto) {
  if (esGranel(producto)) return 1 // "Cantidad Recibida" ya viene en gramos
  return producto.presentacion === 'caja' ? Number(producto.numPaquetePiezas) || 1 : 1
}

function textoPresentacion(producto) {
  if (!producto) return ''
  if (esGranel(producto)) return 'Granel · se vende por gramos'
  const base = producto.presentacion === 'caja' ? 'Caja' : 'Individual'
  const empaque = producto.empaque === 'paquete' ? 'paquete(s)' : 'pieza(s)'
  return `${base} · ${producto.numPaquetePiezas || 1} ${empaque}`
}

function formatStock(producto) {
  const stock = producto.stock ?? 0
  if (!esGranel(producto)) return String(stock)
  return stock >= 1000 ? `${(stock / 1000).toFixed(2)} kg` : `${stock} g`
}

export default function Inventario() {
  const [productos, setProductos] = useState([])
  const [categoriaActiva, setCategoriaActiva] = useState('Todos')
  const [modalNuevo, setModalNuevo] = useState(false)
  const [productoAgregar, setProductoAgregar] = useState(null)
  const [productoEditar, setProductoEditar] = useState(null)
  const [productoCaducidad, setProductoCaducidad] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'productos'), orderBy('nombre'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProductos(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsubscribe
  }, [])

  const filtrados = useMemo(
    () =>
      categoriaActiva === 'Todos'
        ? productos
        : productos.filter((p) => p.categoria === categoriaActiva),
    [productos, categoriaActiva],
  )

  const handleEliminar = async (id) => {
    if (confirm('¿Eliminar este producto del inventario?')) {
      await deleteDoc(doc(db, 'productos', id))
    }
  }

  return (
    <div>
      <Header title="Sección de inventario">
        <button
          onClick={() => setModalNuevo(true)}
          className="rounded-md bg-yellow-400 px-4 py-1.5 text-sm font-bold text-black hover:bg-yellow-300"
        >
          NUEVO +
        </button>
      </Header>

      <div className="flex">
        <aside className="min-h-[calc(100vh-64px)] w-52 shrink-0 bg-neutral-900 px-4 py-6 text-white">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-gray-400">
            Inventario
          </h2>
          <nav className="flex flex-col gap-1">
            <button
              onClick={() => setCategoriaActiva('Todos')}
              className={`rounded-md px-2 py-1.5 text-left text-sm ${
                categoriaActiva === 'Todos' ? 'font-bold text-white' : 'text-gray-300 hover:text-white'
              }`}
            >
              Todos
            </button>
            {CATEGORIAS.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoriaActiva(cat)}
                className={`rounded-md px-2 py-1.5 text-left text-sm ${
                  categoriaActiva === cat ? 'font-bold text-white' : 'text-gray-300 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 overflow-x-auto p-6">
          <table className="min-w-full rounded-lg bg-white text-sm shadow">
            <thead className="bg-gray-100 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Contenido</th>
                <th className="px-4 py-3">Stock Total</th>
                <th className="px-4 py-3">Caducidad</th>
                <th className="px-4 py-3">Precio de Venta</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p, i) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{p.nombre}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {esGranel(p) ? 'Granel' : p.contenido || '—'}
                  </td>
                  <td
                    className={`px-4 py-2 font-semibold ${
                      (p.stock ?? 0) <= (p.stockMinimo ?? 0) ? 'text-red-500' : 'text-gray-800'
                    }`}
                  >
                    {formatStock(p)}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{p.caducidad || '—'}</td>
                  <td className="px-4 py-2 text-gray-800">
                    ${Number(p.precio || 0).toFixed(2)}
                    {esGranel(p) && <span className="text-xs text-gray-400"> /100g</span>}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1.5">
                      <button
                        title="Agregar (registrar compra)"
                        onClick={() => setProductoAgregar(p)}
                        className="rounded bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700"
                      >
                        agregar
                      </button>
                      <button
                        title="Editar"
                        onClick={() => setProductoEditar(p)}
                        className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        editar
                      </button>
                      <button
                        title="Detalles de caducidad"
                        onClick={() => setProductoCaducidad(p)}
                        className="rounded bg-amber-700 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-800"
                      >
                        caducidad
                      </button>
                      <button
                        title="Eliminar"
                        onClick={() => handleEliminar(p.id)}
                        className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700"
                      >
                        eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No hay productos en esta categoría.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalNuevo && <NuevoProductoModal onClose={() => setModalNuevo(false)} />}
      {productoAgregar && (
        <AgregarModal producto={productoAgregar} onClose={() => setProductoAgregar(null)} />
      )}
      {productoEditar && (
        <EditarModal producto={productoEditar} onClose={() => setProductoEditar(null)} />
      )}
      {productoCaducidad && (
        <DetallesCaducidadModal
          producto={productoCaducidad}
          onClose={() => setProductoCaducidad(null)}
        />
      )}
    </div>
  )
}

function ModalShell({ titulo, subtitulo, accionEtiqueta, onClose, children }) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white">
        <div className="flex items-center justify-between bg-neutral-900 px-6 py-4 text-white">
          <div>
            <h2 className="text-lg font-semibold">{titulo}</h2>
            {subtitulo && <p className="text-xs text-gray-400">{subtitulo}</p>}
          </div>
          {accionEtiqueta && <span className="text-xl">{accionEtiqueta}</span>}
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-md bg-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-800'

function NuevoProductoModal({ onClose }) {
  const [form, setForm] = useState({
    nombre: '',
    codigoBarras: '',
    categoria: CATEGORIAS[0],
    presentacion: 'individual',
    empaque: 'piezas',
    cantidadComprada: '',
    numPaquetePiezas: '',
    precio: '',
    contenido: '',
    stockMinimo: '',
    fechaCompra: '',
    caducidad: '',
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
      const cantidadComprada = Number(form.cantidadComprada) || 0
      const numPaquetePiezas = Number(form.numPaquetePiezas) || 1
      const stockInicial = granel
        ? cantidadComprada
        : form.presentacion === 'caja'
          ? cantidadComprada * numPaquetePiezas
          : cantidadComprada

      const lotes = []
      if (cantidadComprada > 0) {
        lotes.push({
          cantidad: stockInicial,
          fechaCompra: form.fechaCompra || '',
          caducidad: form.caducidad || '',
          registradoEn: new Date().toISOString(),
        })
      }

      await addDoc(collection(db, 'productos'), {
        nombre: form.nombre.trim(),
        codigoBarras: form.codigoBarras.trim(),
        categoria: form.categoria,
        presentacion: form.presentacion,
        empaque: form.empaque,
        numPaquetePiezas,
        cantidadComprada,
        precio: Number(form.precio) || 0,
        contenido: form.contenido.trim(),
        stock: stockInicial,
        stockMinimo: Number(form.stockMinimo) || 0,
        fechaCompra: form.fechaCompra,
        caducidad: form.caducidad,
        lotes,
        creadoEn: serverTimestamp(),
      })
      onClose()
    } catch (err) {
      setError(
        err.code === 'permission-denied'
          ? 'Firestore rechazó el guardado (permission-denied). Revisa que hayas publicado firestore.rules y que iniciaste sesión.'
          : err.message || 'No se pudo guardar el producto.',
      )
    } finally {
      setGuardando(false)
    }
  }

  return (
    <ModalShell titulo="Nuevo Producto" onClose={onClose}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nombre del Dulce</label>
          <input name="nombre" value={form.nombre} onChange={onChange} className={inputClass} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Código de Barras (leído en lector o escrito)
          </label>
          <input
            name="codigoBarras"
            value={form.codigoBarras}
            onChange={onChange}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Categoría</label>
          <select name="categoria" value={form.categoria} onChange={onChange} className={inputClass}>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {granel ? 'Stock inicial (gramos)' : 'Cantidad Comprada'}
          </label>
          <input
            type="number"
            name="cantidadComprada"
            value={form.cantidadComprada}
            onChange={onChange}
            className={inputClass}
          />
        </div>

        {!granel && (
          <>
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">¿Cómo llega la mercancía?</p>
              <div className="flex gap-2">
                {['caja', 'individual'].map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setForm({ ...form, presentacion: op })}
                    className={`flex-1 rounded-md px-3 py-2 text-sm capitalize ${
                      form.presentacion === op
                        ? 'bg-neutral-900 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {op}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Num. Paquete/Piezas</label>
              <input
                type="number"
                name="numPaquetePiezas"
                value={form.numPaquetePiezas}
                onChange={onChange}
                className={inputClass}
              />
            </div>

            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">Paquete o Piezas</p>
              <div className="flex gap-2">
                {['paquete', 'piezas'].map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setForm({ ...form, empaque: op })}
                    className={`flex-1 rounded-md px-3 py-2 text-sm capitalize ${
                      form.empaque === op ? 'bg-neutral-900 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {op}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Contenido</label>
              <input
                name="contenido"
                value={form.contenido}
                onChange={onChange}
                className={inputClass}
                placeholder='ej. "500g", "1 pieza"'
              />
            </div>
          </>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {granel ? 'Precio de Venta (por 100g)' : 'Precio de Venta'}
          </label>
          <input
            type="number"
            step="0.01"
            name="precio"
            value={form.precio}
            onChange={onChange}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Stock Mínimo {granel && '(gramos)'}
          </label>
          <input
            type="number"
            name="stockMinimo"
            value={form.stockMinimo}
            onChange={onChange}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Fecha de Compra</label>
          <input
            type="date"
            name="fechaCompra"
            value={form.fechaCompra}
            onChange={onChange}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Caducidad</label>
          <input
            type="date"
            name="caducidad"
            value={form.caducidad}
            onChange={onChange}
            className={inputClass}
          />
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="rounded-md bg-gray-200 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
        >
          Cerrar
        </button>
        <button
          onClick={handleGuardar}
          disabled={guardando}
          className="rounded-md bg-purple-700 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </ModalShell>
  )
}

function AgregarModal({ producto, onClose }) {
  const granel = esGranel(producto)
  const [cantidadRecibida, setCantidadRecibida] = useState('')
  const [egresoTotal, setEgresoTotal] = useState('')
  const [fechaCompra, setFechaCompra] = useState(producto.fechaCompra || '')
  const [caducidad, setCaducidad] = useState(producto.caducidad || '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const handleGuardar = async () => {
    const cantidad = Number(cantidadRecibida) || 0
    if (cantidad <= 0) return
    setGuardando(true)
    setError('')
    try {
      const unidadesNuevas = cantidad * unidadesPorLote(producto)
      await updateDoc(doc(db, 'productos', producto.id), {
        stock: (producto.stock ?? 0) + unidadesNuevas,
        fechaCompra: fechaCompra || producto.fechaCompra || '',
        caducidad: caducidad || producto.caducidad || '',
        lotes: arrayUnion({
          cantidad: unidadesNuevas,
          egresoTotal: Number(egresoTotal) || 0,
          fechaCompra: fechaCompra || '',
          caducidad: caducidad || '',
          registradoEn: new Date().toISOString(),
        }),
      })
      onClose()
    } catch (err) {
      setError(
        err.code === 'permission-denied'
          ? 'Firestore rechazó el guardado (permission-denied). Revisa que hayas publicado firestore.rules y que iniciaste sesión.'
          : err.message || 'No se pudo registrar la entrada.',
      )
    } finally {
      setGuardando(false)
    }
  }

  return (
    <ModalShell
      titulo={producto.nombre}
      subtitulo={`Tipo de presentación (como llega la mercancía): ${textoPresentacion(producto)}`}
      accionEtiqueta="Agregar"
      onClose={onClose}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Cantidad Recibida (
            {granel ? 'gramos' : producto.presentacion === 'caja' ? 'cajas' : 'individual'})
          </label>
          <input
            type="number"
            value={cantidadRecibida}
            onChange={(e) => setCantidadRecibida(e.target.value)}
            className={inputClass}
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Egreso Total</label>
          <input
            type="number"
            step="0.01"
            value={egresoTotal}
            onChange={(e) => setEgresoTotal(e.target.value)}
            className={inputClass}
            placeholder="$"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Fecha de compra</label>
          <input
            type="date"
            value={fechaCompra}
            onChange={(e) => setFechaCompra(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Fecha de Caducidad</label>
          <input
            type="date"
            value={caducidad}
            onChange={(e) => setCaducidad(e.target.value)}
            className={inputClass}
          />
        </div>
        <p className="text-xs text-gray-400">
          Este lote (cantidad, fecha de compra y caducidad) queda guardado en el historial visible
          desde el botón "caducidad" de este producto.
        </p>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="rounded-md bg-gray-200 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
        >
          Cerrar
        </button>
        <button
          onClick={handleGuardar}
          disabled={guardando}
          className="rounded-md bg-purple-700 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </ModalShell>
  )
}

function EditarModal({ producto, onClose }) {
  const [nombre, setNombre] = useState(producto.nombre || '')
  const [precio, setPrecio] = useState(producto.precio ?? '')
  const [codigoBarras, setCodigoBarras] = useState(producto.codigoBarras || '')
  const [stockMinimo, setStockMinimo] = useState(producto.stockMinimo ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const handleGuardar = async () => {
    setGuardando(true)
    setError('')
    try {
      await updateDoc(doc(db, 'productos', producto.id), {
        nombre: nombre.trim(),
        precio: Number(precio) || 0,
        codigoBarras: codigoBarras.trim(),
        stockMinimo: Number(stockMinimo) || 0,
      })
      onClose()
    } catch (err) {
      setError(
        err.code === 'permission-denied'
          ? 'Firestore rechazó el guardado (permission-denied). Revisa que hayas publicado firestore.rules y que iniciaste sesión.'
          : err.message || 'No se pudo guardar el cambio.',
      )
    } finally {
      setGuardando(false)
    }
  }

  return (
    <ModalShell
      titulo={producto.nombre}
      subtitulo={`Tipo de presentación (como llega la mercancía): ${textoPresentacion(producto)}`}
      accionEtiqueta="Editar"
      onClose={onClose}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nombre del Dulce</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Precio de Venta {esGranel(producto) && '(por 100g)'}
          </label>
          <input
            type="number"
            step="0.01"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Código de barras</label>
          <input
            value={codigoBarras}
            onChange={(e) => setCodigoBarras(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Stock Mínimo Alerta {esGranel(producto) && '(gramos)'}
          </label>
          <input
            type="number"
            value={stockMinimo}
            onChange={(e) => setStockMinimo(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="rounded-md bg-gray-200 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
        >
          Cerrar
        </button>
        <button
          onClick={handleGuardar}
          disabled={guardando}
          className="rounded-md bg-purple-700 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </ModalShell>
  )
}

function DetallesCaducidadModal({ producto, onClose }) {
  const granel = esGranel(producto)
  const lotes = [...(producto.lotes || [])].sort((a, b) => {
    if (!a.caducidad) return 1
    if (!b.caducidad) return -1
    return a.caducidad.localeCompare(b.caducidad)
  })
  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <ModalShell titulo={producto.nombre} accionEtiqueta="Caducidad" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p>
          <span className="font-medium text-gray-700">Caducidad más próxima: </span>
          {producto.caducidad ? (
            <span className={producto.caducidad < hoy ? 'font-semibold text-red-600' : ''}>
              {producto.caducidad}
            </span>
          ) : (
            'Sin registrar'
          )}
        </p>

        <div>
          <p className="mb-2 font-medium text-gray-700">Historial de compras / lotes</p>
          {lotes.length === 0 ? (
            <p className="text-gray-400">
              Aún no hay lotes registrados. Se agregan automáticamente cada vez que uses el botón
              "agregar" para registrar una compra.
            </p>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-100 text-left text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Cantidad</th>
                    <th className="px-3 py-2">Fecha de compra</th>
                    <th className="px-3 py-2">Caducidad</th>
                    <th className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {lotes.map((lote, idx) => {
                    const vencido = lote.caducidad && lote.caducidad < hoy
                    const porVencer =
                      !vencido &&
                      lote.caducidad &&
                      (new Date(lote.caducidad) - new Date(hoy)) / 86400000 <= 7
                    return (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2">
                          {lote.cantidad} {granel ? 'g' : 'pzas'}
                        </td>
                        <td className="px-3 py-2">{lote.fechaCompra || '—'}</td>
                        <td className="px-3 py-2">{lote.caducidad || '—'}</td>
                        <td className="px-3 py-2">
                          {vencido && <span className="font-semibold text-red-600">Vencido</span>}
                          {porVencer && <span className="font-semibold text-amber-600">Por vencer</span>}
                          {!vencido && !porVencer && <span className="text-gray-400">OK</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={onClose}
          className="rounded-md bg-gray-200 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
        >
          Cerrar
        </button>
      </div>
    </ModalShell>
  )
}
