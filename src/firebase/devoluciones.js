// Lógica compartida para registrar una devolución.
// La usan tanto el modal rápido de Home (Ventas.jsx) como la página de Devoluciones.
import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore'

// Si el producto sigue siendo vendible ("cambio"), reingresa al stock.
// Si es "perdida" (mercancía dañada/merma), no se toca el inventario.
export async function registrarDevolucion(db, { usuario, venta, item, cantidad, motivo, monto }) {
  await runTransaction(db, async (transaction) => {
    const productoRef = doc(db, 'productos', item.productoId)
    const snap = await transaction.get(productoRef)
    const esPerdida = motivo === 'perdida'

    if (!esPerdida && snap.exists()) {
      const stockActual = snap.data().stock ?? 0
      transaction.update(productoRef, { stock: stockActual + cantidad })
    }

    const devolucionRef = doc(collection(db, 'devoluciones'))
    transaction.set(devolucionRef, {
      ventaId: venta.id,
      folio: venta.folio ?? null,
      productoId: item.productoId,
      nombre: item.nombre,
      cantidad,
      motivo,
      mercanciaPerdida: esPerdida,
      monto,
      vendedorEmail: usuario?.email ?? null,
      fecha: serverTimestamp(),
    })
  })
}
