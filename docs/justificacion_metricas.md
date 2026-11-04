# Métricas del cuadro de mando · Justificación (Tarea 2)

Apartado 7 del enunciado: un cuadro de mando con **al menos cinco métricas** y **una representación gráfica** como mínimo, calculadas con **datos generados por el propio sistema** (nunca con cifras inventadas), y con la elección de cada métrica **justificada** en manuales, documentación técnica o literatura.

> **[COMPLETAR]** Comprobar contra el cuadro de mando real del back-office qué métricas están ya calculadas. Las que no lo estén se quitan de aquí o se implementan. Declarar una métrica que el sistema no calcula sería una cifra inventada.

## 1. Criterio de selección

Un cuadro de mando operativo debe responder preguntas que llevan a **decidir algo**, no acumular cifras. Así lo plantea el Tema 3 (diapositiva 47), que convierte un evento suelto en una cifra útil en cuatro pasos: **captura → limpieza → agregación → decisión**. Few (2006) recomienda además pocas métricas, en una sola pantalla y elegidas por su uso.

Elegimos las métricas para cubrir las **cuatro dimensiones del rendimiento de un proceso** que propone Dumas et al. (2018): **tiempo**, **coste**, **calidad** y **flexibilidad**. A ellas añadimos dos aspectos propios de esta tarea: la **salud de la integración** y la **supervisión del agente de IA**.

| Dimensión | Pregunta de negocio | Métricas |
|---|---|---|
| Volumen y ventas | ¿Cuánto vendemos y qué? | M1, M2, M3 |
| Estado del proceso | ¿Dónde se acumula el trabajo? | M4 |
| Calidad del servicio postventa | ¿Atendemos bien y a tiempo? | M5, M6 |
| Conversión | ¿Dónde perdemos clientes? | M7 |
| Salud de la integración | ¿Los sistemas se hablan bien? | M8 |
| Supervisión del agente | ¿Cuánto nos fiamos de lo que propone la IA? | M9 |

## 2. Métricas

### M1 · Pedidos por día (histórico) — **gráfico de barras**
- **Fórmula:** número de pedidos creados cada día, en los últimos 30 días.
- **Origen del dato:** pedidos registrados en el back-office a partir de `order.created` (escenario 1).
- **Para qué sirve:** ver la tendencia de la demanda y detectar caídas bruscas. Una caída puede deberse a un problema del canal o de la integración, no del negocio.
- **Justificación:** es la representación gráfica que propone el propio enunciado. Corresponde al **volumen de trabajo** que procesa el sistema, base de cualquier medida de rendimiento de procesos (Dumas et al., 2018) y equivalente a la señal de **tráfico** de la monitorización de sistemas (Beyer et al., 2016).

### M2 · Importe total simulado y ticket medio
- **Fórmula:** suma de `total` de los pedidos pagados; ticket medio = importe total / número de pedidos pagados.
- **Origen del dato:** pedidos del back-office con un `payment.simulated` aprobado.
- **Para qué sirve:** medir la facturación del canal y si las promociones (cupones, envío gratis) suben o bajan el gasto por pedido.
- **Justificación:** el Tema 3 (diapositiva 47) usa precisamente el ticket medio como ejemplo de cómo pasar de eventos a una cifra que decide algo. Se cuenta solo lo **pagado** porque un pedido creado y no pagado no es venta.

### M3 · Productos más solicitados
- **Fórmula:** unidades vendidas por SKU en pedidos pagados (las 5 primeras).
- **Origen del dato:** líneas de pedido del back-office.
- **Para qué sirve:** decidir qué reponer y qué destacar en la tienda.
- **Justificación:** el Tema 1 distingue **producto, variante y SKU**: el cliente ve menos de lo que gestiona el sistema. Medir por SKU, y no por producto, permite decidir el stock de cada color de luz y talla.

### M4 · Pedidos por estado y pedidos pendientes
- **Fórmula:** número de pedidos en cada estado (`creado`, `pagado`, `en_preparacion`, `enviado`, `entregado`, `incidencia`, `cancelado`); **pendientes** = pagados + en preparación.
- **Origen del dato:** estado actual de cada pedido en el back-office, mantenido al día por `order.status_changed` (escenario 2).
- **Para qué sirve:** ver dónde se atasca el proceso. Muchos pedidos «pagados» sin pasar a preparación indican un cuello de botella en el almacén.
- **Justificación:** «pedidos pendientes» es uno de los **indicadores operativos de servicio** del Tema 3 (diapositiva 43). Medir el trabajo en curso por etapa es la forma habitual de localizar cuellos de botella en un proceso (Dumas et al., 2018).

### M5 · Incidencias abiertas e incidencias por cada 100 pedidos
- **Fórmula:** incidencias sin cerrar; **incidencias / pedidos × 100** en el mismo periodo.
- **Origen del dato:** tickets del back-office creados a partir de `support.requested` (escenario 3).
- **Para qué sirve:** el número absoluto indica la carga del equipo de soporte; el ratio indica la **calidad** del proceso, porque no depende de cuánto se venda.
- **Justificación:** las dos aparecen en la tabla de indicadores operativos del Tema 3 (diapositiva 43), que recomienda expresar las incidencias **como ratio** para poder comparar periodos con ventas distintas.

### M6 · Tiempo medio de primera respuesta, tiempo medio de resolución y cumplimiento del plazo (SLA)
- **Fórmula:**
  - primera respuesta = media de (primera respuesta − apertura);
  - resolución = media de (cierre − apertura);
  - **cumplimiento del SLA** = % de incidencias resueltas dentro del plazo acordado. Proponemos 48 h, en línea con el plazo de envío estándar de la tienda.
- **Origen del dato:** fechas de apertura, respuesta y cierre del ticket en el back-office. Como el prototipo no tiene clientes reales, son **tiempos simulados** de las pruebas, que es lo que admite el enunciado.
- **Para qué sirve:** saber si el soporte responde a tiempo y si el agente de IA ayuda a hacerlo más rápido.
- **Justificación:** el tiempo de primera respuesta, el tiempo de resolución y el cumplimiento del SLA están en la tabla del Tema 3 (diapositiva 43). Son las medidas clásicas de la **gestión de incidencias y de niveles de servicio** de ITIL 4 (AXELOS, 2019). En el modelo de Dumas et al. (2018) pertenecen a la dimensión **tiempo**.

### M7 · Tasa de conversión del embudo
- **Fórmula:** sesiones distintas que llegan a cada paso / sesiones que ven un producto: ven producto → añaden al carrito → empiezan el checkout → crean el pedido → pagan.
- **Origen del dato:** eventos `product.viewed`, `cart.item_added`, `checkout.started`, `order.created` y `payment.simulated` de la tienda, agrupados por `sesion_id` y leídos con `desde_id`.
- **Para qué sirve:** localizar **en qué paso se pierden los clientes**. Por ejemplo, si muchos empiezan el checkout y pocos pagan, el problema está en el pago.
- **Justificación:** el embudo de ventas del Tema 1 se construye con los mismos pasos que los eventos de comercio electrónico de Google Analytics 4 (`view_item`, `add_to_cart`, `begin_checkout`, `purchase`), citados en la bibliografía del tema (Google, s. f.). Usar el `sesion_id` evita contar dos veces al mismo visitante.

### M8 · Eventos de integración correctos y fallidos, y errores por tipo
- **Fórmula:** envíos tienda → n8n → back-office con resultado correcto / total de envíos; los fallidos, agrupados por motivo (401 token, 422 datos incompletos, 409 duplicado o conflicto, *timeout*…).
- **Origen del dato:** la cola de envíos de la tienda y el **historial de ejecuciones de n8n** (ver `docs/contrato_integracion.md`, apartado 4).
- **Para qué sirve:** saber si la integración es fiable y **qué tipo de fallo** hay que corregir. Un pico de 401 es un problema de configuración; uno de *timeouts*, que Render estaba dormido.
- **Justificación:** la tasa de errores es una de las **cuatro señales doradas** de la monitorización de sistemas distribuidos (Beyer et al., 2016). El Tema 2 (diapositiva 50) insiste en que **no todos los fallos se tratan igual**: separarlos por tipo indica cuáles se reintentan y cuáles hay que corregir. El enunciado la pide expresamente.

### M9 · Acciones propuestas por el agente frente a acciones aprobadas
- **Fórmula:** número de propuestas del agente; **tasa de aprobación** = aprobadas / (aprobadas + rechazadas); también las que siguen **pendientes de revisión**.
- **Origen del dato:** las propuestas del agente guardadas en el back-office, con la decisión humana de cada una (aprobado, rechazado o pendiente) tomada en Telegram.
- **Para qué sirve:** medir **cuánto se puede confiar en el agente**. Una tasa de aprobación baja indica que hay que mejorar sus instrucciones o sus herramientas antes de darle más autonomía. Si se acumulan pendientes, el cuello de botella es la revisión humana.
- **Justificación:** el Tema 3 presenta la supervisión humana como uno de los ingredientes de un agente supervisado. El Reglamento europeo de IA (Reglamento (UE) 2024/1689, art. 14) exige que la supervisión humana sea efectiva, y el marco de gestión de riesgos de IA del NIST (NIST, 2023) pide **medir y vigilar** el comportamiento de los sistemas de IA en uso. Registrar cada decisión es además la evidencia de **«registro explícito de aprobación o rechazo»** que pide el enunciado (apartado 6.c).

## 3. Calidad del dato

Siguiendo los pasos del Tema 3 (diapositiva 47), antes de calcular:
- **Se excluyen los duplicados** usando el `id` del evento como clave (ver la idempotencia en el contrato de integración).
- **Se convierten los formatos**: importes a número y fechas a ISO 8601.
- **Se cuentan solo pedidos pagados** para el importe y los productos más solicitados.
- **Todos los datos son de prueba** (clientes `@ejemplo.test`), así que las cifras describen las **pruebas del prototipo**, no un negocio real. Así se indica en el propio cuadro de mando.

## 4. Resumen

| # | Métrica | Origen | Tipo | Fuente principal |
|---|---|---|---|---|
| M1 | Pedidos por día | Back-office (`order.created`) | **Gráfico de barras** | Enunciado; Dumas et al. (2018); Beyer et al. (2016) |
| M2 | Importe total y ticket medio | Back-office (pedidos pagados) | Cifra | Tema 3, diap. 47 |
| M3 | Productos más solicitados | Back-office (líneas) | Tabla | Tema 1 (producto, variante y SKU) |
| M4 | Pedidos por estado y pendientes | Back-office (`order.status_changed`) | Barras o tabla | Tema 3, diap. 43; Dumas et al. (2018) |
| M5 | Incidencias abiertas y por cada 100 pedidos | Back-office (`support.requested`) | Cifra y ratio | Tema 3, diap. 43 |
| M6 | Primera respuesta, resolución y SLA | Back-office (fechas del ticket) | Cifra | Tema 3, diap. 43; ITIL 4 |
| M7 | Conversión del embudo | Tienda (eventos por sesión) | Embudo | Tema 1; Google Analytics 4 |
| M8 | Integración correcta/fallida y errores por tipo | Cola de la tienda + ejecuciones de n8n | Cifra y tabla | Beyer et al. (2016); Tema 2, diap. 50 |
| M9 | Propuestas del agente frente a aprobadas | Back-office (decisiones en Telegram) | Cifra y ratio | Tema 3; Reglamento de IA, art. 14; NIST AI RMF |

## Referencias

- AXELOS (2019). *ITIL Foundation: ITIL 4 Edition*. TSO.
- Beyer, B., Jones, C., Petoff, J. y Murphy, N. R. (eds.) (2016). *Site Reliability Engineering: How Google Runs Production Systems*. O'Reilly. Cap. 6, «Monitoring Distributed Systems».
- Dumas, M., La Rosa, M., Mendling, J. y Reijers, H. A. (2018). *Fundamentals of Business Process Management* (2.ª ed.). Springer. Citado en la bibliografía del Tema 1.
- Few, S. (2006). *Information Dashboard Design*. O'Reilly.
- Google (s. f.). *GA4 Ecommerce events*. support.google.com/analytics/answer/6367342. Citado en la bibliografía del Tema 1.
- NIST (2023). *Artificial Intelligence Risk Management Framework (AI RMF 1.0)*. NIST AI 100-1.
- Reglamento (UE) 2024/1689, de Inteligencia Artificial, art. 14 (supervisión humana).
- Serrano Fernández, A. *Soluciones Informáticas para la Empresa*, Temas 1, 2 y 3 (diapositivas de la asignatura).
