# Nekuatik — Sistema de Punto de Venta e Inventario para Dulcería

Proyecto de estadía: sistema web para centralizar la gestión de ventas e
inventario de una dulcería. Construido con **React + Vite**, **Tailwind CSS**
y **Firebase** (Authentication + Firestore).

## Funcionalidades

- **Inicio de sesión**: acceso restringido por cuenta de empleado (Firebase Authentication).
- **Home / Punto de venta**: búsqueda o lectura de código de barras, ticket con cantidad y subtotal por producto, contador de ventas y acumulado del día, historial de ventas, y cobro por **Efectivo** (con cálculo de cambio) o **Tarjeta** (débito/crédito).
- **Inventario**: catálogo filtrable por categoría, alta de producto (código de barras, presentación en caja o individual, contenido, caducidad), registro de entradas por compra, edición rápida y alerta visual de stock bajo.
- **Devoluciones**: selecciona una venta reciente y devuelve productos; el stock se reintegra automáticamente al inventario.
- **Operación autónoma**: Firestore mantiene una caché local persistente, así que el sistema sigue funcionando aunque se corte el internet un momento; al reconectar, sincroniza los cambios.

## Requisitos previos

- Node.js 18 o superior
- Una cuenta de Google y un proyecto de [Firebase](https://console.firebase.google.com/)

## 1. Instalar dependencias

```bash
npm install
```

## 2. Crear el proyecto de Firebase

1. Ve a la [consola de Firebase](https://console.firebase.google.com/) y crea un proyecto nuevo.
2. Dentro del proyecto, agrega una app web (ícono `</>`) y copia la configuración que te muestra (`apiKey`, `authDomain`, etc.).
3. Activa **Authentication** → método "Correo electrónico/contraseña" → y crea ahí las cuentas de los empleados que van a usar el sistema.
4. Activa **Firestore Database** (modo producción) y, si quieres usar las reglas incluidas en este repo, despliega `firestore.rules` con el [Firebase CLI](https://firebase.google.com/docs/cli):
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add   # selecciona tu proyecto
   firebase deploy --only firestore:rules
   ```

## 3. Configurar variables de entorno

Copia `.env.example` como `.env` y llena los valores con los datos de tu app web de Firebase:

```bash
cp .env.example .env
```

El archivo `.env` no se sube al repositorio (está en `.gitignore`), así que cada quien usa sus propias credenciales.

## 4. Ejecutar en desarrollo

```bash
npm run dev
```

## 5. Compilar para producción

```bash
npm run build
```

Esto genera la carpeta `dist/`, lista para publicarse (por ejemplo con `firebase deploy --only hosting`).

## Estructura del proyecto

```
src/
  components/    Sidebar, Header, Layout, ProtectedRoute (rutas privadas)
  context/       AuthContext (sesión del usuario)
  firebase/      Configuración e inicialización de Firebase
  pages/
    Login.jsx          Inicio de sesión
    Ventas.jsx          Home / Punto de venta (ticket, cobro, historial)
    Inventario.jsx      Categorías, tabla de productos y modales (Nuevo/Agregar/Editar/Caducidad)
    Devoluciones.jsx    Devolución de productos de ventas recientes
```

## Modelo de datos en Firestore

**Colección `productos`**
| Campo | Tipo | Descripción |
|---|---|---|
| nombre | string | Nombre del dulce |
| codigoBarras | string | Código de barras (leído o escrito) |
| categoria | string | Una de las categorías predefinidas (Dulces de Leche, Guayaba, Coco, Tamarindo, Obleas y mazapanes, Extras, Licores, Arreglos, A Granel) |
| presentacion | string | `caja` \| `individual` — cómo llega la mercancía |
| empaque | string | `paquete` \| `piezas` |
| numPaquetePiezas | number | Piezas por caja/paquete |
| contenido | string | Contenido/peso por unidad (ej. "500g") |
| precio | number | Precio de venta |
| stock | number | Existencias actuales (en unidades de venta) |
| stockMinimo | number | Umbral para alertar stock bajo |
| fechaCompra | string (fecha) | Última fecha de compra registrada |
| caducidad | string (fecha) | Fecha de caducidad del lote más reciente |

**Colección `ventas`**
| Campo | Tipo | Descripción |
|---|---|---|
| items | array | Productos vendidos (id, nombre, contenido, cantidad, precio unitario) |
| total | number | Total cobrado |
| metodoPago | string | `efectivo` \| `tarjeta` |
| montoRecibido / cambio | number | Solo si `metodoPago` es efectivo |
| tipoTarjeta | string | `debito` \| `credito`, solo si `metodoPago` es tarjeta |
| vendedorEmail | string | Empleado que hizo la venta |
| fecha | timestamp | Fecha/hora del servidor |

**Colección `devoluciones`**
| Campo | Tipo | Descripción |
|---|---|---|
| ventaId | string | Referencia a la venta original |
| productoId | string | Producto devuelto |
| nombre | string | Nombre del producto al momento de la devolución |
| cantidad | number | Unidades devueltas |
| vendedorEmail | string | Quién registró la devolución |
| fecha | timestamp | Fecha/hora del servidor |

## Próximos pasos sugeridos

- Reportes de ventas por día/semana/mes y por método de pago.
- Historial de lotes/caducidades por producto (actualmente solo se guarda el más reciente).
- Roles de usuario (administrador vs. cajero) usando Firestore o Custom Claims.
- Impresión/generación de tickets de venta.
