# NOCTILUZ · Tienda online de moda luminosa urbana

> **Prototipo académico sin actividad comercial real.** Tarea 1 de *Soluciones Informáticas para la Empresa* (Grado en Ingeniería Informática, UCAM). No se cobra, no se envía nada y todos los datos son de prueba.

**Equipo:** Luis Galindo Buendia · Roberto Ciller Miñana · Javier Zamora Lopez · JunJie Yang Jao

**URL pública:** https://algo.free.je (despliegue provisional en InfinityFree)

---

## 1. Qué hace

Canal digital de venta con flujo transaccional completo:

| Parte | Dónde |
|---|---|
| Portada, catálogo filtrable por **tipo de prenda**, **color de luz** y **modo de iluminación** (fijo, parpadeo, degradado), buscador | `index.html` (`#/`, `#/catalogo`) |
| Ficha de producto (material, autonomía, modos que admite, tallas, stock, envío) | `#/producto/<sku>` |
| Carrito persistente en el navegador | panel lateral |
| Checkout con validación, cupones, envío estándar/exprés e IVA desglosado | `#/checkout` |
| Pago simulado con tarjetas de prueba | `#/pago/<código>` |
| Pedido con identificador único (`NCZ-AAMMDD-XXXXXX`), estados e historial | `#/pedido/<código>`, `#/seguimiento` |
| Soporte postventa e incidencias | `#/soporte` |
| Back-office: métricas, embudo, pedidos, cambio de estado, eventos (CSV/JSON), incidencias | `admin.html` |

## 2. Arquitectura

```
entrega_final/
├── public_html/              ← lo que se sube al hosting
│   ├── index.html            Interfaz de la tienda (HTML + CSS + JS sin librerías)
│   ├── admin.html            Interfaz del back-office
│   ├── assets/css, js, img   Estilos, módulos JS (api, carrito, eventos, vistas) e imágenes
│   ├── api/                  Capa HTTP: endpoints JSON (un archivo por recurso)
│   │   └── admin/            Endpoints protegidos por sesión
│   ├── app/                  Lógica de negocio y persistencia (bloqueada por .htaccess)
│   │   ├── ReglasNegocio.php IVA, envío, cupones, stock, máquina de estados
│   │   ├── Pedidos.php, Pagos.php, Incidencias.php, Catalogo.php, Clientes.php
│   │   ├── Eventos.php       Registro y consulta de eventos de negocio
│   │   ├── Db.php            Acceso a datos (PDO, transacciones)
│   │   └── config.ejemplo.php
│   └── datos/                Solo para la base SQLite local (bloqueada por .htaccess)
└── database/
    ├── esquema_mysql.sql     Esquema para el hosting (MySQL/MariaDB)
    ├── esquema_sqlite.sql    Mismo esquema para pruebas locales
    ├── datos_prueba.sql      Datos maestros + clientes, pedidos y eventos de ejemplo
    └── instalar_local.php    Crea la base SQLite local
```

- **Interfaz:** HTML, CSS y JavaScript nativo (módulos ES). Sin frameworks ni dependencias externas salvo las fuentes de Google Fonts.
- **Lógica de negocio:** PHP 8 sin framework. Precios, stock, cupones e impuestos se calculan **siempre en el servidor**; el navegador solo envía qué quiere comprar.
- **Persistencia:** MySQL en el hosting (SQLite en local), 15 tablas. Todo cambio relevante (pedido, pago, cambio de estado) se guarda en **una transacción** junto con su evento.

## 3. Ejecución en local (sin MySQL)

Requisitos: PHP ≥ 8.0 con las extensiones `pdo_sqlite` y `mbstring` activas en `php.ini`.

```bash
php database/instalar_local.php
```

```bash
php -S localhost:8000 -t public_html
```

Abre `http://localhost:8000` (tienda) y `http://localhost:8000/admin.html` (back-office). Volver a ejecutar `instalar_local.php` deja la base como recién instalada.

> El servidor integrado de PHP no lee `.htaccess`: en local, las carpetas `app/` y `datos/` no están protegidas. En el hosting (Apache) sí.

## 4. Despliegue en DonDominio (hosting real)

1. **Dominio y alojamiento** (lo hace una persona del grupo, con sus propios datos): seguir `Guía-DonDominio.pdf` — crear la cuenta de cliente, registrar `noctiluz.<extensión>` aplicando el **código de dominio** de la hoja compartida del Tema 1, esperar 5-10 min y ampliar a **Alojamiento Básico** aplicando el **código de alojamiento**.
2. **Versión de PHP:** en el panel del alojamiento, elegir PHP 8.1 o superior.
3. **Base de datos:** en el panel, crear una base de datos MySQL y su usuario (anotar nombre, usuario, contraseña y servidor). Abrir phpMyAdmin e importar, en este orden, `database/esquema_mysql.sql` y `database/datos_prueba.sql`.
4. **Configuración:** copiar `public_html/app/config.ejemplo.php` como `public_html/app/config.php` y rellenar los datos del paso 3 (`driver` = `mysql`). **Este archivo no se sube nunca a GitHub** (está en `.gitignore`).
5. **Subir archivos:** con el gestor de archivos del panel o por FTP (p. ej. FileZilla, con las credenciales FTP que da el panel), subir **el contenido** de `public_html/` a la carpeta pública del alojamiento, incluidos los `.htaccess`. No hace falta subir `datos/noctiluz.sqlite`.
6. **HTTPS:** activar el certificado SSL gratuito desde el panel y, cuando funcione, descomentar la redirección a HTTPS en `public_html/.htaccess`.
7. **Comprobar:** abrir la URL, hacer una compra completa, entrar en `/admin.html` y ver el pedido y sus eventos. Comprobar que `https://<dominio>/app/config.php` y `https://<dominio>/app/Db.php` devuelven **403 Prohibido**.

## 5. Usuarios y datos de prueba

| Qué | Valor |
|---|---|
| Back-office | `admin@noctiluz.test` · contraseña `NoctiluzDemo2026` (cuenta de prueba, cifrada con bcrypt en la base de datos) |
| Clientes de ejemplo | `lucia.ferrer@ejemplo.test`, `marcos.ibanez@ejemplo.test`, `sara.nieto@ejemplo.test` (el botón *Rellenar con datos de prueba* del checkout los usa) |
| Pedido de ejemplo | `NCZ-260920-A7K2QD` con `lucia.ferrer@ejemplo.test` (en *Mis pedidos*) |
| Tarjetas aprobadas | `4242 4242 4242 4242`, `5555 5555 5555 4444` |
| Tarjetas rechazadas | `4000 0000 0000 0002` (fondos insuficientes), `4000 0000 0000 0069` (caducada) |
| Caducidad / CVC | cualquier fecha futura (p. ej. `12/30`) / cualquier número de 3 cifras |
| Cupones | `NOCHE10` (10 % desde 50 €), `BIENVENIDA5` (5 € desde 30 €), `ENVIOGRATIS`, `VERANO25` (caducado, para probar la regla) |

Cualquier otra tarjeta, aunque sea válida, se rechaza: así nadie puede introducir una tarjeta real por error.

## 6. Reglas de negocio

- Precios con IVA (21 %) incluido; cada pedido guarda subtotal, descuento, envío, base imponible, IVA y total.
- Envío estándar 4,95 € (gratis si el pedido, tras descuento, llega a 120 €); exprés 9,95 € siempre.
- Solo se puede comprar un modo de iluminación que el producto admita y una talla válida; máximo 9 unidades por línea y nunca más que el stock.
- El stock se descuenta al crear el pedido (con control de concurrencia) y se devuelve si se cancela.
- Estados: `creado → pagado → en_preparacion → enviado → entregado`, más `incidencia` y `cancelado`. Solo se permiten las transiciones definidas en `ReglasNegocio::TRANSICIONES`; `pagado` solo lo asigna la pasarela simulada.

## 7. Eventos de negocio

| Evento | Origen | Cuándo |
|---|---|---|
| `product.viewed` | navegador | Se abre una ficha de producto |
| `cart.item_added` / `cart.item_removed` | navegador | Se añade / quita una línea del carrito |
| `checkout.started` | navegador | Se entra en el checkout |
| `order.created` | servidor | Se crea el pedido (misma transacción) |
| `payment.simulated` | servidor | Cada intento de pago, aprobado o rechazado |
| `order.status_changed` | servidor | Cada cambio de estado (pasarela, cliente o back-office) |
| `support.requested` | servidor | Se registra una incidencia o solicitud de soporte |

Se guardan en la tabla `eventos` (uuid, tipo, origen, fecha, sesión anónima, cliente, pedido y datos en JSON). Consulta y exportación (requiere sesión de back-office):

- `GET api/admin/eventos.php?desde_id=N&limite=200` → solo los eventos posteriores al id `N` (lectura incremental para otro sistema en la Tarea 2).
- `GET api/admin/eventos.php?formato=csv` / `?formato=json&descargar=1` → exportación completa.

## 8. API

| Método y ruta | Uso |
|---|---|
| `GET api/productos.php` | Catálogo, filtros y reglas comerciales |
| `POST api/presupuesto.php` | Desglose de importes de un carrito |
| `POST api/pedidos.php` | Crear pedido / cancelar (`accion: "cancelar"`) |
| `GET api/pedidos.php?codigo=&email=` | Seguimiento del pedido |
| `POST api/pagos.php` | Pago simulado |
| `POST api/eventos.php` | Evento del navegador |
| `GET/POST api/soporte.php` | Motivos / crear incidencia |
| `GET/POST/DELETE api/admin/sesion.php` | Estado / iniciar / cerrar sesión |
| `GET/POST api/admin/pedidos.php` | Listado, detalle y cambio de estado |
| `GET api/admin/eventos.php` | Eventos (JSON, CSV) |
| `GET/POST api/admin/incidencias.php` | Incidencias |
| `GET api/admin/metricas.php` | Indicadores y embudo |

Los errores de validación devuelven `422` con `{ "error": "...", "campos": { "campo": "mensaje" } }`.

## 9. Limitaciones conocidas

- Pago **simulado**: no hay integración con ninguna pasarela real (ni siquiera en su modo de pruebas).
- No hay cuentas de cliente: el pedido se consulta con código + email. El carrito vive en el navegador de cada visitante.
- Una única cuenta de back-office, sin roles ni recuperación de contraseña; su contraseña de prueba es pública en este README.
- Sin límite de peticiones: el endpoint de eventos podría recibir eventos falsos en grandes cantidades.
- No se envían emails ni se integra con logística; los estados de envío los cambia el back-office a mano.
- Las fotos de producto son de baja resolución y 8 de las 16 variantes usan una ilustración provisional.
- Las exportaciones de eventos están limitadas a 1.000 registros por petición.

## 10. Uso de IA generativa

La versión inicial de la interfaz se generó con IA y el resto del desarrollo se ha hecho con ayuda de Claude Code. El detalle (herramientas, tareas, errores detectados y validación) está en el anexo de IA de la memoria.

## Licencia y avisos

Proyecto académico. Marca, productos, clientes, pedidos y reseñas son ficticios. `noindex` activado para que no lo indexen los buscadores.
