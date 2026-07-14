# Nekuatik — Sistema de Punto de Venta e Inventario para Dulcería

Proyecto de estadía: sistema web para centralizar la gestión de ventas e
inventario de una dulcería. Construido con **React + Vite**, **Tailwind CSS**
y **Firebase** (Authentication + Firestore).

## Funcionalidades

- **Inicio de sesión**: acceso restringido por cuenta de empleado (Firebase Authentication).
- **Catálogo de productos**: vista de todos los productos con precio y existencias, en tiempo real.
- **Inventario**: alta, edición y baja de productos; registro de entradas por compra; alerta visual de stock bajo.
- **Punto de venta**: carrito de compra, selección de forma de pago (efectivo, tarjeta, transferencia) y descuento automático de stock al cobrar (vía transacción atómica, evita vender de más si dos personas cobran al mismo tiempo).
- **Operación autónoma**: Firestore mantiene una caché local persistente, así que el catálogo y el registro de ventas siguen funcionando aunque se corte el internet un momento; al reconectar, sincroniza los cambios.

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
  components/    Navbar, Layout, ProtectedRoute (rutas privadas)
  context/       AuthContext (sesión del usuario)
  firebase/      Configuración e inicialización de Firebase
  pages/
    Login.jsx        Inicio de sesión
    Catalogo.jsx      Catálogo de productos (solo lectura)
    Inventario.jsx    Alta/edición/baja de productos y registro de compras
    Ventas.jsx        Punto de venta (carrito, cobro, formas de pago)
```

## Modelo de datos en Firestore

**Colección `productos`**
| Campo | Tipo | Descripción |
|---|---|---|
| nombre | string | Nombre del producto |
| categoria | string | Categoría (dulces, chocolates, etc.) |
| precio | number | Precio de venta |
| costo | number | Costo de compra |
| stock | number | Existencias actuales |
| stockMinimo | number | Umbral para alertar stock bajo |

**Colección `ventas`**
| Campo | Tipo | Descripción |
|---|---|---|
| items | array | Productos vendidos (id, nombre, cantidad, precio unitario) |
| total | number | Total cobrado |
| metodoPago | string | `efectivo` \| `tarjeta` \| `transferencia` |
| vendedorEmail | string | Empleado que hizo la venta |
| fecha | timestamp | Fecha/hora del servidor |

## Próximos pasos sugeridos

- Reportes de ventas por día/semana/mes y por método de pago.
- Historial de movimientos de inventario (auditoría de compras).
- Roles de usuario (administrador vs. cajero) usando Firestore o Custom Claims.
- Impresión/generación de tickets de venta.
