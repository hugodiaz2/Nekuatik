export const CATEGORIAS = [
  'Dulces de Leche',
  'Dulces de Guayaba',
  'Dulces de Coco',
  'Dulces de Tamarindo',
  'Obleas y mazapanes',
  'Extras',
  'Licores',
  'Arreglos',
  'A Granel',
]

export const CATEGORIA_GRANEL = 'A Granel'

export function esGranel(producto) {
  return producto?.categoria === CATEGORIA_GRANEL
}

// Precio de venta que se guarda en el producto:
// - Para "A Granel" el campo `precio` representa el precio por cada 100 gramos.
// - Para el resto, `precio` es el precio por pieza.
// Esta función devuelve el precio ya normalizado por la unidad que
// realmente se vende (por gramo o por pieza), para usarlo en cálculos.
export function precioPorUnidadVendida(producto) {
  const precio = Number(producto?.precio || 0)
  return esGranel(producto) ? precio / 100 : precio
}

// Folio corto y legible de una venta. Las ventas nuevas guardan un
// contador secuencial real (`venta.folio`, ver contadores/ventas en
// Firestore), formateado como "FOL-103". Las ventas registradas antes de
// que existiera ese contador no tienen `folio`, así que para esas se cae
// en un identificador derivado del ID del documento.
export function folioVenta(venta) {
  if (venta?.folio) return `FOL-${String(venta.folio).padStart(3, '0')}`
  return venta?.id ? `#${venta.id.slice(-6).toUpperCase()}` : '#—'
}

// Coincidencia de una venta con lo que el vendedor escribió en el buscador
// de devoluciones: por nombre del dulce o por folio (con o sin "#"/"FOL-").
export function ventaCoincideBusqueda(venta, texto) {
  const t = texto.trim().toLowerCase()
  if (!t) return true
  const folio = folioVenta(venta).toLowerCase()
  if (folio.includes(t.replace(/^#/, ''))) return true
  return (venta.items || []).some((item) => item.nombre?.toLowerCase().includes(t))
}
