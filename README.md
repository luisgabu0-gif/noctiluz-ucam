# NOCTILUZ · Tienda online de moda luminosa urbana

> **Prototipo académico sin actividad comercial real.** Tarea 1 de *Soluciones Informáticas para la Empresa* (Grado en Ingeniería Informática, UCAM). No se cobra, no se envía nada y todos los datos son de prueba.

**Equipo:** Luis Galindo Buendia · Roberto Ciller Miñana · Javier Zamora Lopez · JunJie Yang Jao

**URL pública:** https://noctiluz.onl (alojamiento Básico de DonDominio). Copia alternativa: https://noctiluz.free.je (InfinityFree, con su propia base de datos)

---

## 1. Qué hace

Canal digital de venta con flujo transaccional completo:

| Parte | Dónde |
|---|---|
| Portada (destacados, «Así se lleva», reseñas y equipo) | `index.html` (`#/`) |
| Tienda agrupada por prenda, con ventana de filtros (prenda, color de luz, modo, precio, stock), orden y buscador | `#/catalogo`, `#/catalogo/<tipo>` |
| Ficha de producto (material, autonomía, modos que admite, tallas, stock, envío) | `#/producto/<sku>` |
| Carrito persistente en el navegador | panel lateral |
| Checkout con validación, cupones, portes por zona (Península / Baleares) e IVA desglosado | `#/checkout` |
| Pago con **PayPal en modo sandbox** o con tarjetas de prueba simuladas | `#/pago/<código>` |
| Factura con numeración correlativa, enviada por email al pagar | `#/pedido/<código>`, `api/factura.php` |
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
│   │   ├── ReglasNegocio.php IVA, portes por zona, cupones, stock, máquina de estados
│   │   ├── Pedidos.php, Pagos.php, Incidencias.php, Catalogo.php, Clientes.php
│   │   ├── PagoPaypal.php    Pasarela PayPal sandbox (API Orders v2, con curl)
│   │   ├── Facturas.php      Numeración, documento HTML y envío por correo
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
- **Persistencia:** MySQL en el hosting (SQLite en local), 17 tablas. Todo cambio relevante (pedido, pago, cambio de estado, factura, reseña) se guarda en **una transacción** junto con su evento.

## 3. Ejecución en local (sin MySQL)

Requisitos: PHP ≥ 8.0 con las extensiones `pdo_sqlite`, `mbstring` y `curl` (para PayPal) activas en `php.ini`.

```bash
php database/instalar_local.php
```

```bash
php -S localhost:8000 -t public_html
```

Abre `http://localhost:8000` (tienda) y `http://localhost:8000/admin.html` (back-office). Volver a ejecutar `instalar_local.php` deja la base como recién instalada.

En local, las facturas no se envían: se guardan como archivos `.eml` en `public_html/datos/correos/` (se abren con cualquier programa de correo). PayPal queda desactivado hasta que pongas credenciales sandbox en `config.php` (apartado 4.1).

> El servidor integrado de PHP no lee `.htaccess`: en local, las carpetas `app/` y `datos/` no están protegidas. En el hosting (Apache) sí.

### Pruebas automáticas de las reglas de negocio

```bash
php tests/pruebas_reglas_negocio.php
```

Comprueba totales, IVA, portes por zona, cupones, stock, la numeración y el envío de facturas y el error de PayPal sin configurar, con los datos de `database/datos_prueba.sql`, en una base SQLite en memoria: no toca la base local. Termina con `Todas las pruebas pasan` (código 0) o con la lista de las que fallan (código 1). Conviene ejecutarlo antes de subir cualquier cambio en `ReglasNegocio.php`.

## 4. Despliegue en DonDominio (hosting real)

1. **Dominio y alojamiento** (lo hace una persona del grupo, con sus propios datos): seguir `Guía-DonDominio.pdf` — crear la cuenta de cliente, registrar `noctiluz.<extensión>` aplicando el **código de dominio** de la hoja compartida del Tema 1, esperar 5-10 min y ampliar a **Alojamiento Básico** aplicando el **código de alojamiento**.
2. **Versión de PHP:** en el panel del alojamiento, elegir PHP 8.1 o superior.
3. **Base de datos:** en el panel, crear una base de datos MySQL y su usuario (anotar nombre, usuario, contraseña y servidor; en DonDominio el servidor es `bbdd.<dominio>`, no `localhost`). Abrir phpMyAdmin e importar, en este orden, `database/esquema_mysql.sql` y `database/datos_prueba.sql`.
4. **Configuración:** copiar `public_html/app/config.ejemplo.php` como `public_html/app/config.php` y rellenar los datos del paso 3 (`driver` = `mysql`). **Este archivo no se sube nunca a GitHub** (está en `.gitignore`).
5. **Subir archivos:** con el gestor de archivos del panel o por FTP (p. ej. FileZilla, con las credenciales FTP que da el panel), subir **el contenido** de `public_html/` a la carpeta pública del alojamiento (`public` en DonDominio, borrando su `_defaulthome.html`), incluidos los `.htaccess`. No hace falta subir `datos/noctiluz.sqlite`.
6. **HTTPS:** activar el certificado SSL gratuito desde el panel y, cuando funcione, descomentar la redirección a HTTPS en `public_html/.htaccess`.
7. **Comprobar:** abrir la URL, hacer una compra completa, entrar en `/admin.html` y ver el pedido y sus eventos. Comprobar que `https://<dominio>/app/config.php` y `https://<dominio>/app/Db.php` devuelven **403 Prohibido**.

### 4.1. PayPal sandbox y facturas por correo

**Si la base del hosting ya estaba instalada**, se actualiza sin perder nada:
1. Subir los archivos nuevos y modificados de `public_html/`: `app/PagoPaypal.php`, `app/Facturas.php`, `app/Pagos.php`, `app/Pedidos.php`, `app/ReglasNegocio.php`, `app/Catalogo.php`, `app/Eventos.php`, `app/Db.php`, `api/_inicio.php`, `api/paypal.php`, `api/factura.php`, `api/presupuesto.php`, `api/admin/pedidos.php`, `assets/js/tienda.js` y `assets/js/admin.js`.
2. Ejecutar en phpMyAdmin `database/actualizar_pagos_facturas.sql`.
3. Añadir al `config.php` del hosting los bloques `tienda`, `paypal` y `correo` de `config.ejemplo.php`.

**PayPal (sandbox):**
1. Entrar en https://developer.paypal.com con una cuenta del grupo y, en *Apps & Credentials*, con el interruptor en **Sandbox**, crear una app. Copiar su *Client ID* y su *Secret* en `config.php` (`paypal.client_id`, `paypal.secreto`) y poner `paypal.activo` a `true`. **Nunca credenciales *Live*.**
2. En *Testing Tools → Sandbox Accounts*, PayPal crea una cuenta **personal** de prueba: con su email y contraseña se paga en la ventana de PayPal durante la demo. Sus datos no van al repositorio.
3. `tienda.url_publica` debe ser la dirección real de la tienda (p. ej. `https://noctiluz.onl`): PayPal devuelve al cliente a `…/api/paypal.php?accion=volver`.

**Facturas por correo:** con `correo.modo = 'mail'` se usa el correo del hosting. `correo.remitente` debe ser una dirección del propio dominio (p. ej. `facturas@noctiluz.onl`, creada en el panel de DonDominio). Como los clientes de prueba usan emails `@ejemplo.test`, que no existen, poned en `correo.copia_oculta` una bandeja del equipo: así veréis cada factura enviada sin usar emails de clientes reales. Si el envío falla, el pedido sigue pagado, la factura queda como «error» en el back-office y se puede reenviar con el botón *Reenviar por email*.

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

**PayPal sandbox:** se paga con la cuenta personal de prueba que crea PayPal en *Sandbox Accounts* (apartado 4.1). En sandbox no se mueve dinero real.

**Códigos postales para probar los portes:** `30107` (Península), `07001` (Baleares) y `35001` (Canarias, sin envío).

## 6. Reglas de negocio

- Precios con IVA (21 %) incluido; cada pedido guarda subtotal, descuento, envío, base imponible, IVA y total.
- **Portes por zona**, según el código postal de entrega (`ReglasNegocio::ZONAS_ENVIO`):

  | Zona | Estándar | Gratis desde | Exprés |
  |---|---|---|---|
  | Península | 4,95 € · 48-72 h | 120 € | 9,95 € · 24 h |
  | Islas Baleares (CP 07…) | 8,95 € · 3-5 días laborables | 180 € | 16,95 € · 48 h |

  El envío gratis se calcula tras descuento y solo vale para el estándar; el cupón `ENVIOGRATIS` lo hace gratis en cualquier zona; el exprés nunca es gratis. **No se envía a Canarias, Ceuta ni Melilla** (CP 35, 38, 51 y 52): allí no rige el IVA sino el IGIC o el IPSI, y los precios de la tienda llevan el IVA incluido.
- **Factura:** al aprobarse el pago se emite una factura con número correlativo por año (`F2026-000001`) en la misma transacción que el pago, y después se envía por email. Si el correo falla, el pago no se deshace.
- Solo se puede comprar un modo de iluminación que el producto admita y una talla válida; máximo 9 unidades por línea y nunca más que el stock.
- El stock se descuenta al crear el pedido (con control de concurrencia) y se devuelve si se cancela.
- Cuentas de cliente: cualquiera puede registrarse en *Mi cuenta* con nombre, email y contraseña (mínimo 8 caracteres, cifrada con bcrypt). La cuenta es la misma ficha de `clientes` que usan los pedidos, así que si te registras con un email con el que ya compraste, ves esos pedidos. En *Mi cuenta* se ven los pedidos y las incidencias con la respuesta del equipo.
- Reseñas: el botón «Añadir reseña» solo aparece con la sesión de cliente iniciada. El servidor comprueba que el pedido sea de esa cuenta y esté pagado, y admite una reseña por pedido. Con la sesión del back-office iniciada no se puede opinar.
- Back-office: cada pedido y cada incidencia se puede **modificar** o **eliminar** (✕), y las incidencias se pueden **responder**. De un pedido solo se modifica la dirección de envío, y solo antes de que salga del almacén (los importes nunca se tocan a mano). Al eliminar un pedido que no había salido del almacén, sus unidades vuelven al stock; sus incidencias y reseñas se conservan sin pedido y sus eventos no se borran.
- Estados: `creado → pagado → en_preparacion → enviado → entregado`, más `incidencia` y `cancelado`. Desde `pagado` el back-office también puede marcar directamente `enviado` o `entregado`, y desde `en_preparacion`, `entregado`. Solo se permiten las transiciones definidas en `ReglasNegocio::TRANSICIONES`; `pagado` solo lo asigna la pasarela de pago (tarjeta de prueba o PayPal sandbox), después de comprobar que el importe cobrado coincide con el total del pedido.

## 7. Eventos de negocio

| Evento | Origen | Cuándo |
|---|---|---|
| `product.viewed` | navegador | Se abre una ficha de producto |
| `cart.item_added` / `cart.item_removed` | navegador | Se añade / quita una línea del carrito |
| `checkout.started` | navegador | Se entra en el checkout |
| `order.created` | servidor | Se crea el pedido (misma transacción) |
| `payment.simulated` | servidor | Cada intento de pago, aprobado o rechazado (con PayPal, `datos.pasarela = "paypal_sandbox"`) |
| `invoice.sent` | servidor | Se envía (o falla al enviarse) la factura por email |
| `order.status_changed` | servidor | Cada cambio de estado (pasarela, cliente o back-office) |
| `support.requested` | servidor | Se registra una incidencia o solicitud de soporte |
| `review.created` | servidor | Un cliente publica una reseña de su pedido |
| `customer.registered` | servidor | Un cliente crea su cuenta |
| `order.updated` / `order.deleted` | servidor | El back-office modifica la dirección / elimina un pedido |
| `support.updated` / `support.replied` / `support.deleted` | servidor | El back-office modifica, responde o elimina una incidencia |

Se guardan en la tabla `eventos` (uuid, tipo, origen, fecha, sesión anónima, cliente, pedido y datos en JSON). Consulta y exportación (requiere sesión de back-office):

- `GET api/admin/eventos.php?desde_id=N&limite=200` → solo los eventos posteriores al id `N` (lectura incremental para otro sistema en la Tarea 2).
- `GET api/admin/eventos.php?formato=csv` / `?formato=json&descargar=1` → exportación completa.

## 8. API

| Método y ruta | Uso |
|---|---|
| `GET api/productos.php` | Catálogo, filtros y reglas comerciales |
| `POST api/presupuesto.php` | Desglose de importes de un carrito (con `cp`, portes de su zona) |
| `POST api/pedidos.php` | Crear pedido / cancelar (`accion: "cancelar"`) |
| `GET api/pedidos.php?codigo=&email=` | Seguimiento del pedido |
| `POST api/pagos.php` | Pago simulado con tarjeta de prueba |
| `POST api/paypal.php` · `GET ?accion=volver` | Crear la orden en PayPal sandbox / vuelta de PayPal y captura del pago |
| `GET api/factura.php?codigo=&email=` | Factura del pedido en HTML |
| `POST api/eventos.php` | Evento del navegador |
| `GET/POST api/soporte.php` | Motivos / crear incidencia |
| `GET/POST/DELETE api/cuenta.php` | Cuenta de cliente: sesión, pedidos e incidencias / registro o inicio de sesión / cerrar sesión |
| `GET/POST api/resenas.php` | Últimas reseñas / publicar una reseña (con sesión de cliente) |
| `GET/POST/DELETE api/admin/sesion.php` | Estado / iniciar / cerrar sesión |
| `GET/POST/DELETE api/admin/pedidos.php` | Listado, detalle, cambio de estado, reenvío de factura (`accion: "reenviar_factura"`), modificar dirección y eliminar |
| `GET api/admin/eventos.php` | Eventos (JSON, CSV) |
| `GET/POST/DELETE api/admin/incidencias.php` | Incidencias: listar, cambiar estado, modificar, responder y eliminar |
| `GET api/admin/metricas.php` | Indicadores y embudo |

Los errores de validación devuelven `422` con `{ "error": "...", "campos": { "campo": "mensaje" } }`.

## 9. Limitaciones conocidas

- PayPal funciona solo en **sandbox**: no se cobra dinero real. Tampoco se recibe el aviso asíncrono de PayPal (*webhook*): el pago se confirma cuando el cliente vuelve a la tienda, así que si cierra la ventana justo después de aprobar, el pedido se queda pendiente.
- La factura es un documento de ejemplo **sin validez fiscal** (emisor ficticio), en HTML y no en PDF.
- Las cuentas de cliente no verifican el email: quien se registra con un email ajeno ve los pedidos de ese email. No hay recuperación de contraseña. El carrito vive en el navegador de cada visitante.
- Una única cuenta de back-office, sin roles ni recuperación de contraseña; su contraseña de prueba es pública en este README.
- Sin límite de peticiones: el endpoint de eventos podría recibir eventos falsos en grandes cantidades.
- El único email que se envía es la factura. No hay integración con logística: los estados de envío los cambia el back-office a mano.
- Las fotos de producto son de baja resolución y 1 de las 16 variantes usa una ilustración provisional.
- Las exportaciones de eventos están limitadas a 1.000 registros por petición.

## 10. Uso de IA generativa

La versión inicial de la interfaz se generó con IA y el resto del desarrollo se ha hecho con ayuda de Claude Code. El detalle (herramientas, tareas, errores detectados y validación) está en el anexo de IA de la memoria.

## Licencia y avisos

Proyecto académico. Marca, productos, clientes, pedidos y reseñas son ficticios. `noindex` activado para que no lo indexen los buscadores.
