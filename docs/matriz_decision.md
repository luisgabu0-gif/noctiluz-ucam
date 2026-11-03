# Matriz de decisión de implantación · NOCTILUZ (Tarea 2)

Apartado 8 del enunciado: comparar al menos dos alternativas tecnológicas para integrar el canal digital de NOCTILUZ con un back-office, automatizar el proceso con flujos e incorporar un agente de IA supervisado, y justificar la recomendada.

**Caso de empresa:** NOCTILUZ es una marca ficticia y pequeña (perfil de *startup* o pyme) que vende online ropa con LED. Necesita que los pedidos, los cambios de estado y las incidencias de la tienda lleguen a un sistema interno, avisar al cliente por Telegram y apoyarse en IA para el soporte, **con un presupuesto casi nulo** y un equipo de cuatro personas sin experiencia previa en integración.

## 1. Método

- Cada alternativa se puntúa de **1 (muy mal) a 5 (muy bien)** en cada criterio.
- Cada criterio tiene un **peso**; los pesos suman 100 %.
- **Puntuación final = Σ (peso × nota) / 100**, sobre 5.
- Los pesos reflejan el caso: una empresa pequeña, sin presupuesto y con un prototipo académico. Por eso pesan más el coste, la integración, la funcionalidad y la trazabilidad (esta última, porque el enunciado y la rúbrica la exigen).

| Criterio | Peso | Qué se valora |
|---|---:|---|
| Funcionalidad | 12 % | Cubre los 3 escenarios: pedido, cambio de estado e incidencia con Telegram y agente |
| Coste estimado | 12 % | Coste mensual para el prototipo y para una pyme pequeña |
| Esfuerzo de implantación | 8 % | Tiempo y conocimientos necesarios para tenerlo funcionando |
| Escalabilidad | 6 % | Capacidad de crecer en pedidos y en usuarios |
| Integración | 12 % | Webhooks, APIs, transformación de datos y conexión con la tienda PHP existente |
| Seguridad | 8 % | Control de tokens, secretos y accesos |
| Dependencia del proveedor | 6 % | Facilidad para cambiar de proveedor sin rehacerlo todo |
| Mantenimiento | 6 % | Trabajo continuo: actualizaciones, caídas y copias de seguridad |
| Cumplimiento normativo (RGPD) | 8 % | Dónde se guardan los datos y quién los trata |
| Trazabilidad | 10 % | Logs, historial de ejecuciones, aprobaciones y auditoría |
| Facilidad de evolución | 6 % | Añadir escenarios o cambiar reglas más adelante |
| Adecuación al tamaño de la empresa | 6 % | Proporcionado a una marca pequeña |

## 2. Matriz principal: arquitectura de la solución

**Alternativas:**

- **A. Arquitectura híbrida (elegida):** tienda propia (PHP en DonDominio) + **n8n autoalojado** como plataforma de flujos + **back-office propio** con su propia base de datos (Render) + Telegram + Gemini.
- **B. CRM/ERP SaaS** (por ejemplo, HubSpot u Odoo Online) conectado a la tienda con sus conectores o su API.
- **C. Plataforma no-code** (Zapier) con una hoja de cálculo como back-office.
- **D. Desarrollo propio completo:** toda la integración programada a mano en PHP, sin plataforma de flujos.

| Criterio | Peso | A. Híbrida | B. CRM SaaS | C. No-code | D. Propio |
|---|---:|:-:|:-:|:-:|:-:|
| Funcionalidad | 12 % | 5 | 4 | 3 | 4 |
| Coste estimado | 12 % | 5 | 2 | 3 | 5 |
| Esfuerzo de implantación | 8 % | 3 | 3 | 5 | 2 |
| Escalabilidad | 6 % | 3 | 5 | 3 | 3 |
| Integración | 12 % | 5 | 4 | 2 | 3 |
| Seguridad | 8 % | 4 | 4 | 3 | 3 |
| Dependencia del proveedor | 6 % | 4 | 2 | 1 | 5 |
| Mantenimiento | 6 % | 3 | 5 | 4 | 2 |
| Cumplimiento normativo | 8 % | 4 | 3 | 2 | 4 |
| Trazabilidad | 10 % | 5 | 3 | 3 | 3 |
| Facilidad de evolución | 6 % | 4 | 3 | 2 | 3 |
| Adecuación al tamaño | 6 % | 5 | 3 | 4 | 3 |
| **Puntuación ponderada** | **100 %** | **4,32** | **3,38** | **2,90** | **3,42** |

**Por qué estas notas:**

- **A. Híbrida.** Cubre los tres escenarios. Cuesta 0 € usando capas gratuitas. Los webhooks, los nodos de código y el historial de ejecuciones de n8n dan integración y trazabilidad completas, y el back-office es nuestro, así que controlamos qué datos guarda. Pierde puntos en escalabilidad y mantenimiento por los límites de la capa gratuita de Render (apartado 6) y porque tenemos que mantener nosotros n8n y el back-office.
- **B. CRM SaaS.** Es lo más escalable y lo que menos mantenimiento exige, pero las licencias se pagan por usuario, nos ata al proveedor, los datos quedan fuera de nuestro control y su historial de integraciones es menos detallado que el de n8n. Además, el enunciado valora que se vea el diseño del flujo, y en un CRM gran parte queda oculta en su configuración.
- **C. No-code (Zapier).** Es lo más rápido de montar, pero **queda descartado por el propio enunciado**, que no acepta tecnologías 100 % no-code. Además, el plan gratuito solo admite automatizaciones de dos pasos y no incluye webhooks (apartado 3), que son la base de nuestra integración. Se puntúa solo para comparar.
- **D. Desarrollo propio completo.** Es gratis y sin dependencias, pero tendríamos que programar a mano los reintentos, las ramas de error, el registro de ejecuciones, la conexión con Telegram y el agente. El esfuerzo es alto, hay más código que mantener y la trazabilidad sería peor que el historial que n8n ya trae.

**Análisis de sensibilidad.** Si NOCTILUZ creciera y diéramos más importancia a la escalabilidad (12 %) que al coste (6 %), las notas quedarían así: **A 4,20 · B 3,56 · D 3,30 · C 2,90**. A sigue ganando, pero B se acerca: un CRM SaaS es la alternativa razonable si algún día la empresa tiene presupuesto y más personal que no sepa programar.

## 3. Plataforma de automatización: n8n frente a Make y Zapier

| Criterio | Peso | n8n | Make | Zapier |
|---|---:|:-:|:-:|:-:|
| Admite programación (requisito del enunciado) | 25 % | 5 | 2 | 1 |
| Coste para el prototipo | 20 % | 4 | 4 | 2 |
| Webhooks, ramas y gestión de errores | 20 % | 5 | 4 | 1 |
| Nodos de agente de IA con herramientas | 15 % | 5 | 4 | 3 |
| Historial de ejecuciones (trazabilidad) | 10 % | 5 | 4 | 3 |
| Autoalojable / dependencia del proveedor | 10 % | 5 | 1 | 1 |
| **Puntuación ponderada** | **100 %** | **4,80** | **3,20** | **1,70** |

- **n8n:** tiene nodos *Code* en JavaScript y Python, webhooks, ramas condicionales, flujo de errores y nodos de agente de IA con herramientas. Se puede **autoalojar gratis** (edición Community, con licencia *fair-code*), así que no dependemos de su nube. El inconveniente es que hay que alojarlo, y con poca memoria da problemas (apartado 6).
- **Make:** es visual y potente, y su plan gratuito da 1.000 créditos al mes, pero está pensado para no programar y no se puede autoalojar.
- **Zapier:** su plan gratuito se queda en 100 tareas al mes, solo permite automatizaciones de dos pasos y no incluye webhooks. Además, el enunciado excluye expresamente Zapier.

**Decisión: n8n.**

## 4. Alojamiento de n8n y del back-office: Render frente a Railway y un VPS

DonDominio solo admite PHP + MySQL, así que n8n y el back-office necesitan otro alojamiento. El enunciado propone Render, Railway o el GitHub Student Developer Pack.

| Criterio | Peso | Render (gratuito) | Railway | VPS |
|---|---:|:-:|:-:|:-:|
| Coste | 25 % | 5 | 2 | 3 |
| Memoria y recursos | 20 % | 2 | 3 | 5 |
| Disponibilidad (sin apagados) | 15 % | 2 | 4 | 5 |
| Facilidad de despliegue | 20 % | 5 | 5 | 2 |
| Persistencia de la base de datos | 10 % | 2 | 3 | 5 |
| Mantenimiento | 10 % | 5 | 5 | 1 |
| **Puntuación ponderada** | **100 %** | **3,65** | **3,50** | **3,50** |

- **Render (gratuito):** gratis y fácil, porque despliega directamente desde GitHub con Docker. Pero tiene límites serios: el servicio **se apaga tras 15 minutos sin peticiones** y tarda **alrededor de un minuto** en volver; tiene 750 horas gratuitas al mes; en nuestras pruebas la instancia tenía **512 MB** de memoria, y la base de datos Postgres gratuita tiene **1 GB y caduca a los 30 días**.
- **Railway:** igual de fácil y sin apagados, pero el plan gratuito solo incluye **1 $ de crédito al mes** y 0,5 GB de memoria por servicio, lo que no da para tener n8n encendido. En la práctica, tras la prueba de 30 días (5 $ de crédito) habría que pagar el plan Hobby, de **5 $ al mes**.
- **VPS** (por ejemplo, con el crédito del GitHub Student Developer Pack): es lo que más memoria y disponibilidad ofrece y la base de datos no caduca, pero tendríamos que administrar Linux, Docker, certificados, cortafuegos y actualizaciones de seguridad, demasiado para el equipo y el plazo.

**Decisión: Render**, porque es el único gratis de verdad para todo el periodo de la práctica. **Si el grupo pudiera pagar 5 $ al mes, Railway sería mejor opción:** evita los apagados y da más memoria.

## 5. Modelo de IA del agente: Gemini frente a OpenAI y Groq

| Criterio | Peso | Gemini (gratuito) | OpenAI | Groq |
|---|---:|:-:|:-:|:-:|
| Coste y disponibilidad | 30 % | 5 | 1 | 4 |
| Herramientas y salida estructurada (JSON) | 25 % | 5 | 5 | 4 |
| Integración con n8n | 15 % | 5 | 5 | 4 |
| Privacidad y RGPD | 20 % | 3 | 4 | 3 |
| Límites de uso | 10 % | 3 | 4 | 3 |
| **Puntuación ponderada** | **100 %** | **4,40** | **3,50** | **3,70** |

- **Gemini:** tiene capa gratuita y n8n lo integra con un nodo propio. Admite herramientas (*function calling*) y salida en JSON, que es lo que necesita el agente para dar su salida estructurada. Pierde puntos en privacidad: en la capa gratuita, Google puede usar los datos para mejorar sus productos y revisarlos personas (fuera del EEE), y sus condiciones piden **no enviar datos personales ni confidenciales**. Además, para ofrecer el servicio a usuarios del EEE exige usar la versión de pago.
- **OpenAI:** técnicamente excelente, pero **sin saldo prepagado la API no funciona**. Lo comprobamos nosotros mismos, así que para un grupo sin presupuesto no es viable.
- **Groq:** tiene plan gratuito con límites de uso y ejecuta modelos abiertos muy rápido, pero el uso de herramientas es menos fiable que en Gemini o OpenAI, y lo hemos probado menos.

**Decisión: Gemini**, siempre con **datos ficticios** (nombres inventados y emails `@ejemplo.test`), que es lo que exige el enunciado y lo que piden las propias condiciones de Google.

## 6. Límites encontrados en las pruebas

Estos problemas los encontramos nosotros al montar la solución, y explican varias notas de las tablas:

| Límite | Efecto | Cómo lo mitigamos |
|---|---|---|
| **512 MB de memoria** en Render gratuito | n8n va justo de memoria | Flujos pequeños; nada de cargar datos innecesarios |
| **Los nodos de IA tumban n8n** | Al ejecutar el agente, n8n podía reiniciarse por falta de memoria | Prompts y respuestas cortas; el agente consulta solo los datos que necesita |
| **Apagado tras 15 min sin uso** (≈1 min en volver) | El primer webhook tras un rato sin uso falla o llega tarde | La tienda guarda los envíos en una **cola con reintentos**; antes de la demo, «despertar» n8n abriendo su URL |
| **Postgres gratuita caduca a los 30 días** | Se pierde el back-office si la defensa cae después | Anotar la fecha de creación y, si hace falta, recrearla y volver a cargar los datos de prueba antes de la defensa |
| **OpenAI sin saldo no funciona** | No se pudo usar como modelo del agente | Cambiamos a Gemini |

## 7. Recomendación

**Recomendamos la alternativa A: arquitectura híbrida con tienda propia, n8n autoalojado, back-office propio en Render, Gemini y Telegram (4,32 sobre 5).** Es la única que cumple a la vez todos los requisitos del enunciado (integración entre dos sistemas independientes, flujo con código, trazabilidad completa y agente con herramientas) con coste cero, y la mejor en integración y trazabilidad, los criterios que más pesan en la rúbrica.

**Si NOCTILUZ pasara de prototipo a empresa real**, mantendríamos la arquitectura, pero con tres cambios:

1. **Alojamiento de pago** (Render o Railway), para evitar los apagados, tener más memoria y una base de datos que no caduque.
2. **Gemini de pago** (o un proveedor con contrato de encargado del tratamiento), porque con clientes reales del EEE las condiciones de Google lo exigen y el RGPD obliga a un acuerdo de tratamiento de datos.
3. **Volver a valorar un CRM SaaS** (alternativa B) cuando el equipo crezca y haya personal no técnico que necesite gestionar clientes sin tocar los flujos.

## Fuentes

Consultadas en noviembre de 2026. Los precios y los límites de las capas gratuitas cambian a menudo.

- Render, *Deploy for Free* (límites de servicios y Postgres gratuitos): https://render.com/docs/free
- Railway, *Pricing*: https://railway.com/pricing
- Make, *Pricing*: https://www.make.com/en/pricing
- Zapier, *Pricing*: https://zapier.com/pricing
- n8n, *Hosting n8n* y *Sustainable Use License*: https://docs.n8n.io/hosting/ · https://docs.n8n.io/sustainable-use-license/
- Google, *Gemini API Additional Terms of Service* (uso de datos en servicios gratuitos y de pago, EEE): https://aistudio.google.com/docs/terms
- Groq, *Rate limits*: https://console.groq.com/docs/rate-limits
- Reglamento (UE) 2016/679 (RGPD), art. 28 (encargado del tratamiento): https://eur-lex.europa.eu/eli/reg/2016/679/oj
