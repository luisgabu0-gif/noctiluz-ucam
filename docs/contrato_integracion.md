# Contrato de integración · Tienda NOCTILUZ ↔ n8n ↔ back-office (Tarea 2)

Define **qué datos se intercambian, con qué formato, qué responde cada parte y qué pasa si algo falla**. Sigue las cuatro partes de un contrato completo del **Tema 2** (diapositivas 46-50): **propósito**, **estructura**, **respuestas** y **operación** (versiones, *timeouts*, reintentos, duplicados y seguimiento).

> **Estado de implementación.** La tienda ya genera y guarda todos los eventos de este documento (tabla `eventos`), y los ofrece con `GET api/admin/eventos.php?desde_id=N`. Están **pendientes**: el envío por webhook (apartado 5) y el endpoint de vuelta (apartado 6). Cuando se programen, deben seguir este contrato, y los flujos de n8n deben esperar **exactamente** estos nombres de campo. [COMPLETAR: marcar como hecho cuando estén en el repositorio.]

## 1. Propósito

| | |
|---|---|
| **Emisor** | Tienda NOCTILUZ (PHP en DonDominio), `https://www.noctiluz.onl` |
| **Receptor** | n8n (Render), webhook `POST {N8N_URL}/webhook/noctiluz-eventos` |
| **Destino final** | Back-office independiente (Render + Postgres), al que n8n llama por su API |
| **Sentido inverso** | n8n → tienda, para sincronizar cambios de estado hechos en el back-office (apartado 6) |

Cada escenario obligatorio del enunciado se apoya en eventos que la tienda ya instrumenta desde la Tarea 1:

| Escenario | Evento que lo dispara | Qué hace el receptor |
|---|---|---|
| **1. Pedido generado e integrado** | `order.created` (y `payment.simulated` para marcarlo pagado) | Crea el pedido en el back-office con cliente, líneas, importe, estado y fecha |
| **2. Cambio operativo o sincronización** | `order.status_changed` (tienda → back-office) y llamada de vuelta (back-office → tienda) | Actualiza el estado en el otro sistema, o lo deja como **pendiente de sincronizar** si no está disponible |
| **3. Incidencia postventa** | `support.requested` | Crea el ticket ligado al cliente y al pedido; el agente propone respuesta; tras la aprobación humana, se avisa al cliente por Telegram |

## 2. Estructura del mensaje

### 2.1. Sobre común (todos los eventos)

Es el mismo «sobre» que la tienda guarda en su tabla `eventos`, más una **foto del pedido o de la incidencia** en el momento del evento. Así el receptor no tiene que volver a preguntar a la tienda.

| Campo | Tipo | Obligatorio | Regla |
|---|---|:-:|---|
| `version` | entero | ✅ | Versión del contrato. Ahora `1` |
| `id` | texto (UUID v4) | ✅ | Identificador único del evento. Es la **clave de idempotencia** (apartado 4.3) |
| `tipo` | texto | ✅ | Uno de los tipos del apartado 2.2 |
| `ocurrido_en` | texto (ISO 8601 con zona) | ✅ | Ej. `2026-11-04T18:30:12+01:00` |
| `origen` | texto | ✅ | `servidor` (los eventos del navegador no se envían) |
| `sesion_id` | texto (UUID) o `null` | ❌ | Sesión anónima del navegador; sirve para el embudo |
| `datos` | objeto | ✅ | Los mismos datos del evento que guarda la tienda (apartado 2.2) |
| `pedido` | objeto | Según tipo | Foto del pedido (apartado 2.3). Obligatorio en `order.*` y `payment.*` |
| `incidencia` | objeto | Según tipo | Foto de la incidencia (apartado 2.4). Obligatorio en `support.requested` |

**Convenios de formato:**
- **Importes:** número decimal en **euros con IVA incluido**, con punto y dos decimales (`73.95`). Moneda siempre `EUR`.
- **Fechas:** ISO 8601 con zona horaria de Madrid.
- **Código de pedido:** `NCZ-AAMMDD-XXXXXX`, con la expresión regular `^NCZ-\d{6}-[A-Z2-9]{6}$`.
- **Textos:** UTF-8. Los emails van en minúsculas.

### 2.2. Tipos de evento que se envían y su campo `datos`

| `tipo` | Campos de `datos` (ya los genera la tienda) |
|---|---|
| `order.created` | `codigo`, `total`, `lineas` (número de líneas), `metodo_envio`, `cupon` |
| `payment.simulated` | `codigo`, `resultado` (`aprobado` \| `rechazado`), `importe`, `referencia`, y con PayPal también `pasarela` y `orden_paypal` |
| `order.status_changed` | `codigo`, `de`, `a`, `actor`, `motivo` |
| `support.requested` | `codigo` (de la incidencia), `motivo`, `pedido` |

El resto de eventos (`product.viewed`, `cart.item_added`, `checkout.started`, `review.created`…) **no se envían por webhook**: se leen en bloque con `desde_id` para el cuadro de mando.

### 2.3. Foto del pedido (`pedido`)

| Campo | Tipo | Obligatorio | Regla |
|---|---|:-:|---|
| `codigo` | texto | ✅ | Formato `NCZ-…` |
| `estado` | texto | ✅ | `creado`, `pagado`, `en_preparacion`, `enviado`, `entregado`, `incidencia` o `cancelado` |
| `creado_en` | fecha | ✅ | ISO 8601 |
| `cliente.nombre` | texto | ✅ | 3-100 caracteres |
| `cliente.email` | texto | ✅ | Email válido (en las pruebas, siempre `@ejemplo.test`) |
| `cliente.telefono` | texto o `null` | ❌ | |
| `lineas[]` | lista | ✅ | **Al menos una línea** |
| `lineas[].sku` | texto | ✅ | SKU de la variante |
| `lineas[].descripcion` | texto | ✅ | |
| `lineas[].modo` · `lineas[].talla` | texto | ✅ | |
| `lineas[].cantidad` | entero | ✅ | 1-9 |
| `lineas[].precio_unitario` · `lineas[].importe` | decimal | ✅ | `importe = cantidad × precio_unitario` |
| `totales.subtotal` · `descuento` · `envio` · `base_imponible` · `iva` · `total` | decimal | ✅ | `total = subtotal − descuento + envio = base_imponible + iva` |
| `envio.metodo` · `envio.zona` · `envio.cp` · `envio.ciudad` · `envio.provincia` | texto | ✅ | `metodo`: `estandar` \| `expres`; `zona`: `peninsula` \| `baleares` |

### 2.4. Foto de la incidencia (`incidencia`)

| Campo | Tipo | Obligatorio | Regla |
|---|---|:-:|---|
| `codigo` | texto | ✅ | Código de la incidencia |
| `motivo` | texto | ✅ | Uno de los motivos del formulario de soporte |
| `mensaje` | texto | ✅ | Texto del cliente (máx. 1000 caracteres) |
| `creada_en` | fecha | ✅ | |
| `cliente.nombre` · `cliente.email` | texto | ✅ | |
| `pedido_codigo` | texto o `null` | ❌ | Si la incidencia es sobre un pedido |

## 3. Respuestas del receptor

Lo que debe devolver n8n (y, después, el back-office) y qué hace la tienda con cada respuesta. Sigue la clasificación de errores del Tema 2 (diapositiva 50).

| Código | Significado | Cuerpo | Qué hace la tienda |
|---|---|---|---|
| **201** | Creado en el back-office | `{"ok": true, "id": "<uuid del evento>", "entidad": "pedido", "referencia": "<id en el back-office>"}` | Marca el envío como **enviado** |
| **200** | Ya se había recibido (duplicado idempotente) | `{"ok": true, "duplicado": true, …}` | Marca como **enviado**. No es un error |
| **202** | Aceptado, se procesará después | `{"ok": true, "pendiente": true}` | Marca como **enviado** |
| **400** | JSON mal formado | `{"error": "…"}` | **No reintenta.** Lo marca como **fallido** para revisarlo |
| **401** | Token incorrecto o ausente | `{"error": "…"}` | **No reintenta.** Fallido y aviso: es un problema de configuración |
| **409** | Conflicto: el mismo `id` llegó con datos distintos, o el cambio de estado no está permitido | `{"error": "…"}` | **No reintenta.** Fallido para revisarlo |
| **422** | Faltan campos o no cumplen las reglas | `{"error": "…", "campos": {"lineas": "Debe haber al menos una línea."}}` | **No reintenta**: hay que corregir los datos. Fallido |
| **5xx**, *timeout* o sin conexión | Fallo transitorio (p. ej. n8n dormido en Render) | — | **Reintenta** con espera creciente (apartado 4.2) |

**Regla general:** un 4xx significa que el mensaje está mal y repetirlo no lo arreglará; un 5xx o un *timeout* significa que el receptor no estaba disponible y **merece la pena reintentar**.

## 4. Operación

### 4.1. Versionado

- Todos los mensajes llevan `"version": 1`.
- **Cambios compatibles** (sin subir versión): añadir campos **opcionales**. El receptor debe **ignorar los campos que no conozca**.
- **Cambios incompatibles** (subir a `2`): quitar o renombrar campos, o cambiar su tipo o su significado. Durante la transición, la tienda enviaría las dos versiones o n8n aceptaría ambas.

### 4.2. Cabeceras, *timeouts* y reintentos

**Cabeceras de cada petición tienda → n8n:**

```
Content-Type: application/json
Authorization: Bearer <INTEGRACION_TOKEN>
Idempotency-Key: <id del evento>
```

- El token se guarda en el `config.php` de la tienda y en las credenciales de n8n, **nunca en el repositorio**. Hay un ejemplo sin secretos en `public_html/app/config.ejemplo.php` [COMPLETAR cuando exista el bloque `integracion`].
- **Timeout:** 10 segundos por intento.
- **Reintentos:** hasta **8 intentos** con espera creciente, para cubrir el apagado de Render (alrededor de 1 min en volver): 1, 2, 4, 8, 16, 30, 60 y 60 minutos.
- Después del último intento, el envío queda como **fallido**, visible en el cuadro de mando como «evento de integración fallido», y se puede **reenviar a mano**.
- Los envíos pendientes se guardan en una **cola** en la base de datos de la tienda, en la misma transacción que el evento. Si la tienda se cae justo después de guardar un pedido, el aviso no se pierde: sale en el siguiente intento.

### 4.3. Duplicados e idempotencia

Sigue el Tema 2 (diapositiva 49): **reintentar no debe duplicar efectos**.

- La **clave de idempotencia es el `id` del evento**, que se envía también en la cabecera `Idempotency-Key`.
- El receptor guarda los `id` ya procesados. Si recibe uno repetido **con el mismo contenido**, responde `200 {"duplicado": true}` y **no crea nada nuevo**.
- Si recibe un `id` repetido **con contenido distinto**, responde **`409`**: no son la misma petición y no se tratan igual.
- Además, el back-office no permite **dos pedidos con el mismo `codigo`** (restricción única en su base de datos).

### 4.4. Seguimiento y trazabilidad

Para reconstruir la historia de un pedido de punta a punta:

| Dónde | Qué se registra | Cómo se relaciona |
|---|---|---|
| Tienda, tabla `eventos` | Cada evento, con su `id` | `id` del evento y `codigo` del pedido |
| Tienda, cola de envíos | Intentos, código de respuesta, último error y fecha del siguiente intento | `id` del evento |
| n8n, historial de ejecuciones | Cada ejecución del flujo, con su entrada y su salida | `id` del evento, que se escribe en la ejecución |
| Back-office | La entidad creada o actualizada, y su registro de integración | `id` del evento y `codigo` del pedido |

Con el `id` del evento se puede localizar el mismo hecho en los tres sistemas. Es la evidencia de trazabilidad que pide el enunciado (apartado 3.f).

## 5. Ejemplo completo: tienda → n8n

```http
POST {N8N_URL}/webhook/noctiluz-eventos
Content-Type: application/json
Authorization: Bearer <INTEGRACION_TOKEN>
Idempotency-Key: 6f1c2d3e-4a5b-4c7d-8e9f-0a1b2c3d4e5f
```

El cuerpo de cada escenario está en `docs/payloads/` (apartado 8).

## 6. Sentido inverso: back-office → tienda (escenario 2)

Cuando el equipo cambia el estado de un pedido **en el back-office**, n8n lo comunica a la tienda:

```http
POST https://www.noctiluz.onl/api/integracion/pedidos.php
Content-Type: application/json
Authorization: Bearer <INTEGRACION_TOKEN>
Idempotency-Key: <id del cambio en el back-office>

{ "version": 1, "codigo": "NCZ-261104-K7M2QP", "estado": "enviado", "motivo": "Entregado a la mensajería", "origen": "backoffice" }
```

| Respuesta | Cuándo |
|---|---|
| `200 {"ok": true, "estado": "enviado"}` | Cambio aplicado |
| `200 {"ok": true, "sin_cambios": true}` | El pedido ya estaba en ese estado (idempotente) |
| `401` | Token incorrecto |
| `404` | El pedido no existe |
| `409` | La transición no está permitida por `ReglasNegocio::TRANSICIONES` (p. ej. de `creado` a `enviado`) |
| `422` | Falta el código o el estado no existe |

**Reglas:**
- La tienda sigue aplicando **su propia máquina de estados**: el back-office no puede saltársela.
- El estado `pagado` **no se puede poner desde fuera**: solo lo asigna la pasarela de pago.
- **Para evitar bucles**, los cambios que llegan por esta vía se registran con actor `integracion:backoffice` y **no se vuelven a enviar** al back-office.
- Si la tienda no responde, n8n deja el cambio como **«pendiente de sincronizar»** en el back-office y lo reintenta. El enunciado admite esta opción en el escenario 2.

## 7. Validaciones del receptor (n8n)

Antes de tocar el back-office, el flujo comprueba, en este orden:
1. Que el token es correcto. Si no → **401**.
2. Que el cuerpo es JSON y tiene `version`, `id`, `tipo`, `ocurrido_en` y `datos`. Si no → **400** o **422**.
3. Que la `version` es soportada (`1`). Si no → **422**.
4. Que el `tipo` es uno de los cuatro del apartado 2.2. Si no → **422**.
5. Que el `id` no se ha procesado ya. Si se ha procesado → **200 duplicado** o **409**.
6. Según el tipo, los campos obligatorios de `pedido` o `incidencia`: al menos una línea, cantidades de 1 a 9, código con el formato correcto, email válido y **totales que cuadran**. Si no → **422**, indicando qué campos fallan.
7. Solo entonces: normalizar (email en minúsculas, importes a número, fechas a ISO) y llamar al back-office. **Rama correcta** → 201. **Rama de error** → registrar el fallo y devolver el código correspondiente.

## 8. Payloads de prueba

En `docs/payloads/`, con **datos ficticios** (nombres inventados y emails `@ejemplo.test`):

| Archivo | Escenario | Resultado esperado |
|---|---|---|
| `escenario1_order_created.json` | 1. Pedido generado e integrado | `201`: pedido creado en el back-office |
| `escenario2_order_status_changed.json` | 2. Cambio de estado | `201` o `200`: estado actualizado en el back-office |
| `escenario3_support_requested.json` | 3. Incidencia postventa | `201`: ticket creado y propuesta del agente **pendiente de aprobación** |
| `error_pedido_sin_lineas.json` | Caso de error: datos incompletos | `422` con `campos.lineas` |

Para probar la idempotencia, se envía **dos veces** `escenario1_order_created.json`: la segunda vez debe responder `200 {"duplicado": true}` y no crear otro pedido.
