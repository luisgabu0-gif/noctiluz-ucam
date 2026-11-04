# Matriz de decisión de implantación · NOCTILUZ (Tarea 2)

Apartado 8 del enunciado de la Tarea 2. Sigue el proceso de decisión del **Tema 1** (diapositivas 17-33): **requisitos → shortlist de alternativas → evidencia (prueba de concepto) → TCO y riesgo → criterios, pesos y *trade-offs* → decisión**. Usa la clasificación de alternativas del tema (desarrollo propio, SaaS, plataforma parametrizable, low-code/no-code y arquitectura híbrida) y la diferencia entre **parametrizar y personalizar** del **Tema 2**.

## 1. Requisitos

**Caso de empresa.** NOCTILUZ es una marca ficticia y pequeña (perfil de *startup* o pyme) que vende online ropa con LED. Su canal digital (Tarea 1) genera pedidos, pagos, incidencias y eventos. Necesita llevar esos datos a un **back-office independiente**, automatizar el proceso y apoyar el soporte con un **agente de IA supervisado**.

**Imprescindibles (*must-have*), del enunciado:**

| # | Requisito |
|---|---|
| R1 | Back-office **independiente** de la tienda, con su propio almacenamiento y acceso (una tabla más en la base de la tienda no vale) |
| R2 | Intercambio **estructurado y automático** (webhook, API, cola o equivalente), nunca copia manual |
| R3 | Plataforma de flujos **que conlleve programación**: no se aceptan herramientas 100 % no-code como Zapier |
| R4 | Validación, rama de error, registro de ejecuciones y **trazabilidad** |
| R5 | Agente de IA con herramientas de consulta y de acción, salida estructurada y **revisión humana** |
| R6 | Mensajería con el cliente (**Telegram**) en el escenario de incidencias |
| R7 | Todo **desplegado fuera del ordenador** del grupo |
| R8 | Pagos externos en **sandbox** del proveedor; sin credenciales ni datos personales reales |

**Restricciones del contexto:**
- **Presupuesto prácticamente nulo**, porque es un prototipo académico.
- El hosting de DonDominio de la tienda **solo ejecuta PHP + MySQL**, así que no puede alojar n8n ni un back-office de otra tecnología.
- **Cuatro personas** sin experiencia previa en integración y un plazo de pocas semanas.
- La tienda ya existe, con eventos y una API de lectura incremental (`desde_id`).

## 2. Shortlist de alternativas

Las cinco familias que distingue el Tema 1 (diapositivas 17-18), aplicadas al caso:

| Alternativa | En NOCTILUZ sería… | Modelo de servicio (Tema 1, diap. 23) |
|---|---|---|
| **A. Desarrollo propio** | Back-office e integración programados a mano en PHP, sin plataforma de flujos | Lo que despleguemos (PaaS o hosting) |
| **B. SaaS** | Un CRM SaaS (p. ej. HubSpot) conectado a la tienda con sus conectores | SaaS |
| **C. Plataforma parametrizable** | Un ERP/CRM modular como **Odoo**, parametrizado y con algún módulo propio | SaaS (Odoo Online), PaaS (Odoo.sh) o autoalojado (diap. 27) |
| **D. Low-code / no-code** | Zapier con una hoja de cálculo como back-office | SaaS |
| **E. Arquitectura híbrida** | Tienda propia + **n8n autoalojado** (automatización con código) + **back-office propio** con su base de datos + Telegram + Gemini | PaaS (Render) para n8n y el back-office; SaaS para Telegram, Gemini y PayPal |

**Descarte previo.** La **D no cumple R3**: el enunciado excluye expresamente las herramientas 100 % no-code como Zapier. Además, el plan gratuito de Zapier no incluye webhooks y solo admite automatizaciones de dos pasos (apartado 8). Se mantiene en la matriz solo para comparar.

## 3. Evidencia: lo que probamos (prueba de concepto)

El Tema 1 pide decidir con evidencias, no solo con folletos. Esto es lo que comprobamos al montar la solución:

| Prueba | Resultado | Qué aprendimos |
|---|---|---|
| n8n en el plan gratuito de Render | Funciona, pero con **512 MB** de memoria los nodos de IA llegaban a tumbar n8n | Flujos y prompts cortos; vigilar la memoria |
| Render gratuito | El servicio **se apaga tras 15 min sin uso** y tarda alrededor de **1 min** en volver | Hace falta una **cola con reintentos** en la tienda |
| OpenAI como modelo del agente | **No funciona sin saldo prepagado** | Lo descartamos y usamos Gemini |
| Gemini (capa gratuita) en n8n | Funciona con herramientas y salida JSON | Solo con **datos ficticios**, por sus condiciones de uso |
| PayPal sandbox en la tienda | Pago aprobado y rechazado, sin doble cobro al recargar | El enunciado exige un **sandbox real del proveedor**, no una simulación propia |

## 4. TCO y riesgo

El Tema 1 (diapositiva 29) recuerda que **el precio de la licencia es solo una parte del coste total (TCO)**: también cuentan la implantación, la integración, la operación, las actualizaciones y **la salida**, además del *time-to-market* y de las capacidades internas del equipo.

| | A. Propio | B. SaaS | C. Odoo | D. No-code | E. Híbrida |
|---|---|---|---|---|---|
| **Licencias** | 0 € | Plan gratuito limitado; la automatización avanzada es de pago | Edición Community gratis; las aplicaciones y el alojamiento gestionado son de pago | Gratis hasta 100 tareas/mes; plan Professional desde 19,99 $/mes | 0 € (n8n Community, Render gratuito, Gemini gratuito) |
| **Implantación** | Muy alta: hay que programarlo todo | Media: parametrizar el CRM | Alta: aprender Odoo y parametrizarlo | Baja | Media |
| **Integración con la tienda** | Alta: reintentos, colas y errores a mano | Media: conectores genéricos | Media: API de Odoo y nodo de n8n | Baja, pero limitada | Baja: webhooks y nodos HTTP de n8n |
| **Operación y actualizaciones** | Altas: todo el código es nuestro | Bajas: las hace el proveedor | Medias: actualizaciones de versión y de módulos | Bajas | Medias: mantener n8n y el back-office |
| **Coste de salida (*lock-in*)** | Bajo | Alto: datos y flujos dentro del proveedor | Medio: núcleo abierto, pero mucha parametrización propia | Muy alto | Bajo: flujos exportables en JSON y base de datos estándar |
| **Riesgo principal** | No terminar a tiempo; errores en el código propio | Dependencia del proveedor y de sus precios | Curva de aprendizaje; Odoo necesita más memoria de la que da Render gratis | No cumple el enunciado | Límites de la capa gratuita (memoria, apagados, caducidad de la BD) |

Comparativa cualitativa siguiendo la tabla del Tema 1 (diapositiva 28):

| Alternativa | *Time-to-market* | Control | Carga interna |
|---|---|---|---|
| A. Propio | Bajo | Alto | Alta |
| B. SaaS | Alto | Bajo-medio | Baja |
| C. Odoo | Medio | Medio-alto | Media |
| D. No-code | Alto | Medio-bajo | Baja |
| E. Híbrida | Medio-alto | Alto | Media |

## 5. Criterios, pesos y matriz ponderada

**Método.** Cada alternativa se puntúa de **1 (muy mal) a 5 (muy bien)** en los doce criterios que exige el enunciado. Cada criterio tiene un peso, y los pesos suman 100 %. **Puntuación = Σ (peso × nota) / 100**, sobre 5.

**Por qué estos pesos.** Pesan más el **coste** (no hay presupuesto), la **integración** y la **funcionalidad** (son los requisitos R1-R6) y la **trazabilidad** (R4, y en la rúbrica cuenta como apartado propio).

| Criterio | Peso | A. Propio | B. SaaS | C. Odoo | D. No-code | E. Híbrida |
|---|---:|:-:|:-:|:-:|:-:|:-:|
| Funcionalidad (R1-R6) | 12 % | 4 | 4 | 4 | 3 | 5 |
| Coste estimado (TCO) | 12 % | 5 | 2 | 3 | 3 | 5 |
| Esfuerzo de implantación | 8 % | 2 | 3 | 2 | 5 | 3 |
| Escalabilidad | 6 % | 3 | 5 | 4 | 3 | 3 |
| Integración | 12 % | 3 | 4 | 4 | 2 | 5 |
| Seguridad | 8 % | 3 | 4 | 4 | 3 | 4 |
| Dependencia del proveedor | 6 % | 5 | 2 | 3 | 1 | 4 |
| Mantenimiento | 6 % | 2 | 5 | 3 | 4 | 3 |
| Cumplimiento normativo (RGPD) | 8 % | 4 | 3 | 3 | 2 | 4 |
| Trazabilidad | 10 % | 3 | 3 | 4 | 3 | 5 |
| Facilidad de evolución | 6 % | 3 | 3 | 4 | 2 | 4 |
| Adecuación al tamaño de la empresa | 6 % | 3 | 3 | 4 | 4 | 5 |
| **Puntuación ponderada** | **100 %** | **3,42** | **3,38** | **3,52** | **2,90** | **4,32** |

**Justificación de las notas:**
- **E. Híbrida (4,32).** Es la única que cumple todos los requisitos con coste cero. n8n aporta webhooks, nodos de código, ramas de error, historial de ejecuciones y nodos de agente; el back-office propio guarda lo que necesitamos y nada más. Pierde en escalabilidad y mantenimiento por los límites de la capa gratuita y porque operamos nosotros n8n y el back-office.
- **C. Odoo (3,52).** Es la segunda: cubre CRM, inventario y soporte y tiene buena trazabilidad. Pero exige aprender una plataforma grande, parametrizarla e integrarle Telegram y el agente. Además, autoalojado necesita más memoria de la que da Render gratis. El Tema 2 advierte del riesgo de **personalizar demasiado** un ERP hasta bloquear sus actualizaciones.
- **A. Propio (3,42).** Es gratis y sin dependencias, pero tendríamos que programar a mano lo que n8n ya trae (reintentos, registro de ejecuciones, conexión con Telegram y el agente). El Tema 1 indica que el desarrollo propio tiene sentido cuando el software es **diferencial** para el negocio, y la integración de NOCTILUZ no lo es.
- **B. SaaS (3,38).** Es lo más escalable y lo que menos mantenimiento exige, pero las licencias se pagan por usuario, crea **dependencia del proveedor** y oculta buena parte del flujo dentro de su configuración, cuando el enunciado valora justo que se vea el diseño del flujo.
- **D. No-code (2,90).** Descartada por R3.

## 6. *Trade-offs* y análisis de sensibilidad

Para comprobar que la decisión no depende de un peso concreto, recalculamos con otros dos escenarios:

| Escenario | Cambio de pesos | A | B | C | D | **E** |
|---|---|:-:|:-:|:-:|:-:|:-:|
| Base | — | 3,42 | 3,38 | 3,52 | 2,90 | **4,32** |
| NOCTILUZ crece | Escalabilidad 6 % → 12 % y coste 12 % → 6 % | 3,30 | 3,56 | 3,58 | 2,90 | **4,20** |
| Miedo al *lock-in* | Dependencia del proveedor 6 % → 10 % y esfuerzo 8 % → 4 % | 3,54 | 3,34 | 3,56 | 2,74 | **4,36** |

E gana en los tres escenarios. Si la empresa crece, **B y C se acercan**: son las alternativas razonables cuando haya presupuesto y personal no técnico que gestione clientes sin tocar flujos.

**El *trade-off* principal de E:** ganamos control, trazabilidad y coste cero **a cambio de** operar nosotros n8n y el back-office y de convivir con los límites de la capa gratuita.

## 7. Dependencia del proveedor y estrategia de salida

El Tema 1 (diapositiva 32) pide preguntarse cómo saldríamos de cada proveedor. En la alternativa elegida:

| Pieza | Proveedor | Fuente de *lock-in* | Cómo saldríamos |
|---|---|---|---|
| Flujos | n8n (autoalojado) | Bajo: es software *fair-code* que controlamos | Exportar los workflows en JSON e importarlos en otra instancia de n8n o en otro servidor |
| Alojamiento de n8n y del back-office | Render | Bajo-medio: despliegue con Docker | El mismo contenedor funciona en Railway, en un VPS o en otra PaaS |
| Base de datos del back-office | Postgres | Bajo: estándar abierto | Volcado SQL (`pg_dump`) y restaurar en otro servidor |
| Modelo del agente | Gemini | Medio: el prompt y el formato están afinados para Gemini | n8n permite cambiar el nodo del modelo (OpenAI, Groq…) manteniendo herramientas y salida JSON |
| Mensajería | Telegram | Medio | El aviso al cliente es un nodo del flujo: se podría sustituir por email u otra mensajería |
| Pagos | PayPal sandbox | Medio | La tienda aísla la pasarela en `PagoPaypal.php`; otra pasarela sería otra clase con la misma interfaz |

**Responsabilidad compartida** (Tema 1, diapositivas 22-23): con PaaS y SaaS, el proveedor gestiona la infraestructura y la plataforma, pero **la configuración, los datos, las credenciales y los permisos siguen siendo responsabilidad nuestra**. Por eso los secretos van en variables de entorno, no en el repositorio, y el agente solo tiene acceso a lo imprescindible.

## 8. Decisiones por componente

Dentro de la alternativa E hay tres decisiones más pequeñas. Se puntúan con el mismo método (1-5, pesos sobre 100).

### 8.1. Plataforma de automatización: n8n frente a Make y Zapier

| Criterio | Peso | n8n | Make | Zapier |
|---|---:|:-:|:-:|:-:|
| Admite programación (R3) | 25 % | 5 | 2 | 1 |
| Coste para el prototipo | 20 % | 4 | 4 | 2 |
| Webhooks, ramas y gestión de errores | 20 % | 5 | 4 | 1 |
| Nodos de agente de IA con herramientas | 15 % | 5 | 4 | 3 |
| Historial de ejecuciones (trazabilidad) | 10 % | 5 | 4 | 3 |
| Autoalojable / dependencia del proveedor | 10 % | 5 | 1 | 1 |
| **Puntuación** | **100 %** | **4,80** | **3,20** | **1,70** |

n8n tiene nodos *Code* (JavaScript y Python), webhooks, ramas, flujo de errores y nodos de agente, y se puede autoalojar gratis. Make es potente, pero visual y no autoalojable; su plan gratuito da 1.000 créditos al mes. Zapier está excluido por el enunciado.

### 8.2. Alojamiento de n8n y del back-office: Render frente a Railway y un VPS

| Criterio | Peso | Render (gratuito) | Railway | VPS |
|---|---:|:-:|:-:|:-:|
| Coste | 25 % | 5 | 2 | 3 |
| Memoria y recursos | 20 % | 2 | 3 | 5 |
| Disponibilidad (sin apagados) | 15 % | 2 | 4 | 5 |
| Facilidad de despliegue | 20 % | 5 | 5 | 2 |
| Persistencia de la base de datos | 10 % | 2 | 3 | 5 |
| Mantenimiento | 10 % | 5 | 5 | 1 |
| **Puntuación** | **100 %** | **3,65** | **3,50** | **3,50** |

- **Render gratuito:** despliega desde GitHub con Docker, pero se apaga tras 15 min sin uso, tiene 750 horas al mes y su **Postgres gratuita tiene 1 GB y caduca a los 30 días**.
- **Railway:** su plan gratuito solo da 1 $ de crédito al mes y 0,5 GB por servicio, así que en la práctica hay que pasar al plan Hobby, de 5 $ al mes.
- **VPS:** es lo más potente, pero obliga a administrar Linux, Docker, certificados y parches.

**Si pudiéramos pagar 5 $ al mes, Railway sería mejor opción.**

### 8.3. Modelo del agente: Gemini frente a OpenAI y Groq

| Criterio | Peso | Gemini (gratuito) | OpenAI | Groq |
|---|---:|:-:|:-:|:-:|
| Coste y disponibilidad | 30 % | 5 | 1 | 4 |
| Herramientas y salida estructurada (JSON) | 25 % | 5 | 5 | 4 |
| Integración con n8n | 15 % | 5 | 5 | 4 |
| Privacidad y RGPD | 20 % | 3 | 4 | 3 |
| Límites de uso | 10 % | 3 | 4 | 3 |
| **Puntuación** | **100 %** | **4,40** | **3,50** | **3,70** |

- **Gemini** pierde puntos en privacidad: en su capa gratuita, Google puede usar los datos para mejorar sus productos, sus condiciones piden **no enviar datos personales** y, para ofrecer el servicio a usuarios del EEE, exigen la versión de pago. Por eso usamos solo **datos ficticios**.
- **OpenAI** no funciona sin saldo.
- **Groq** tiene plan gratuito, pero lo hemos probado menos.

## 9. Decisión

**Recomendamos la alternativa E, arquitectura híbrida: tienda propia + n8n autoalojado + back-office propio en Render + Gemini + Telegram, con 4,32 sobre 5.** Es la única que cumple todos los requisitos imprescindibles (R1-R8) con coste cero, la mejor en integración y trazabilidad, y la que gana en los tres escenarios de pesos. Además, con ella **conservamos el desarrollo propio donde ya lo teníamos (la tienda) y reutilizamos servicios maduros para lo demás**, que es la ventaja de la arquitectura híbrida que señala el Tema 1 (diapositiva 26).

**Si NOCTILUZ pasara de prototipo a empresa real**, mantendríamos la arquitectura con tres cambios:
1. **Alojamiento de pago** (Render o Railway), para evitar apagados, tener más memoria y una base de datos que no caduque.
2. **Gemini de pago** u otro proveedor con contrato de **encargado del tratamiento** (RGPD, art. 28), porque con clientes reales del EEE las condiciones de Google lo exigen.
3. **Volver a evaluar Odoo o un CRM SaaS** (alternativas C y B) cuando haya presupuesto y personal no técnico.

## Fuentes

**Temario de la asignatura:**
- Tema 1, *Software empresarial y comercio digital*: alternativas de implantación (diap. 17-28), TCO (29), escalabilidad y mantenimiento (30), seguridad (31), dependencia del proveedor y estrategia de salida (32) y proceso de decisión (33).
- Tema 2, *Sistemas empresariales*: ERP/CRM, parametrizar frente a personalizar y riesgos de personalizar demasiado (diap. 18-23).
- Laudon, K. C. y Laudon, J. P., *Management Information Systems*, citado en la bibliografía del Tema 1.

**Documentación de proveedores** (consultada en noviembre de 2026; los precios y los límites gratuitos cambian a menudo):
- Render, *Deploy for Free*: https://render.com/docs/free
- Railway, *Pricing*: https://railway.com/pricing
- Make, *Pricing*: https://www.make.com/en/pricing
- Zapier, *Pricing*: https://zapier.com/pricing
- n8n, *Hosting n8n* y *Sustainable Use License*: https://docs.n8n.io/hosting/ · https://docs.n8n.io/sustainable-use-license/
- Google, *Gemini API Additional Terms of Service*: https://aistudio.google.com/docs/terms
- Groq, *Rate limits*: https://console.groq.com/docs/rate-limits
- Reglamento (UE) 2016/679 (RGPD), art. 28: https://eur-lex.europa.eu/eli/reg/2016/679/oj
