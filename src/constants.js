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
