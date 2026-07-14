import { useEffect, useState } from 'react'
import {
  addDoc,
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

const vacio = {
  nombre: '',
  categoria: '',
  precio: '',
  costo: '',
  stock: '',
  stockMinimo: '',
}

export default function Inventario() {
  const [productos, setProductos] = useState([])
  const [form, setForm] = useState(vacio)
  const [editandoId, setEditandoId] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'productos'), orderBy('nombre'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProductos(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      )
    })
    return unsubscribe
  }, [])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const resetForm = () => {
    setForm(vacio)
    setEditandoId(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const datos = {
      nombre: form.nombre.trim(),
      categoria: form.categoria.trim(),
      precio: Number(form.precio) || 0,
      costo: Number(form.costo) || 0,
      stock: Number(form.stock) || 0,
      stockMinimo: Number(form.stockMinimo) || 0,
    }

    if (editandoId) {
      await updateDoc(doc(db, 'productos', editandoId), datos)
    } else {
      await addDoc(collection(db, 'productos'), {
        ...datos,
        creadoEn: serverTimestamp(),
      })
    }
    resetForm()
  }

  const handleEditar = (producto) => {
    setEditandoId(producto.id)
    setForm({
      nombre: producto.nombre ?? '',
      categoria: producto.categoria ?? '',
      precio: producto.precio ?? '',
      costo: producto.costo ?? '',
      stock: producto.stock ?? '',
      stockMinimo: producto.stockMinimo ?? '',
    })
  }

  const handleEliminar = async (id) => {
    if (confirm('¿Eliminar este producto del inventario?')) {
      await deleteDoc(doc(db, 'productos', id))
    }
  }

  const registrarCompra = async (producto) => {
    const cantidad = Number(prompt(`¿Cuántas unidades de "${producto.nombre}" entraron?`, '0'))
    if (!cantidad || cantidad <= 0) return
    await updateDoc(doc(db, 'productos', producto.id), {
      stock: (producto.stock ?? 0) + cantidad,
    })
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-4 text-xl font-bold text-gray-800">
        Gestión de inventario
      </h1>

      <form
        onSubmit={handleSubmit}
        className="mb-6 grid grid-cols-2 gap-3 rounded-lg bg-white p-4 shadow sm:grid-cols-3 md:grid-cols-6"
      >
        <input
          name="nombre"
          placeholder="Nombre"
          required
          value={form.nombre}
          onChange={handleChange}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <input
          name="categoria"
          placeholder="Categoría"
          value={form.categoria}
          onChange={handleChange}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <input
          name="precio"
          type="number"
          step="0.01"
          placeholder="Precio venta"
          required
          value={form.precio}
          onChange={handleChange}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <input
          name="costo"
          type="number"
          step="0.01"
          placeholder="Costo"
          value={form.costo}
          onChange={handleChange}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <input
          name="stock"
          type="number"
          placeholder="Stock inicial"
          value={form.stock}
          onChange={handleChange}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <input
          name="stockMinimo"
          type="number"
          placeholder="Stock mínimo"
          value={form.stockMinimo}
          onChange={handleChange}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <div className="col-span-2 flex gap-2 sm:col-span-3 md:col-span-6">
          <button
            type="submit"
            className="rounded-md bg-pink-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-pink-700"
          >
            {editandoId ? 'Guardar cambios' : 'Agregar producto'}
          </button>
          {editandoId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md bg-gray-200 px-4 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-300"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2">Categoría</th>
              <th className="px-3 py-2">Precio</th>
              <th className="px-3 py-2">Costo</th>
              <th className="px-3 py-2">Stock</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">{p.nombre}</td>
                <td className="px-3 py-2">{p.categoria}</td>
                <td className="px-3 py-2">${Number(p.precio || 0).toFixed(2)}</td>
                <td className="px-3 py-2">${Number(p.costo || 0).toFixed(2)}</td>
                <td
                  className={`px-3 py-2 font-semibold ${
                    p.stock <= (p.stockMinimo ?? 0) ? 'text-red-500' : ''
                  }`}
                >
                  {p.stock ?? 0}
                </td>
                <td className="space-x-2 px-3 py-2">
                  <button
                    onClick={() => registrarCompra(p)}
                    className="text-green-600 hover:underline"
                  >
                    + Compra
                  </button>
                  <button
                    onClick={() => handleEditar(p)}
                    className="text-blue-600 hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleEliminar(p.id)}
                    className="text-red-600 hover:underline"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
