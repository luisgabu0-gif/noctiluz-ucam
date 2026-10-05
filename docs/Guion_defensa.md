# Guion de la defensa · NOCTILUZ

Defensa de **7 minutos** entre los cuatro, siguiendo las 6 diapositivas de `Diapositivas_NOCTILUZ.pptx` (cada diapositiva lleva en sus notas quién habla). Los tiempos suman unos 6:30, con 30 segundos de margen.

**No es para leerlo ni aprenderlo de memoria:** es una guía de qué contar. Decidlo con vuestras palabras.

| Parte | Quién | Diapositivas | Tiempo |
|---|---|---|---|
| Caso, objetivo y arquitectura | Luis | 1 y 2 | ≈1:45 |
| Demo: catálogo y carrito | Roberto | 3 (pasos 1-2) | ≈0:45 |
| Demo: compra, reglas de negocio y pago | Javier | 3 (pasos 3-5) | ≈1:15 |
| Demo: back-office y eventos | JunJie | 3 (pasos 6-7) y 4 | ≈1:30 |
| Decisiones, limitaciones, IA y conclusión | Luis | 5 y 6 | ≈1:15 |

---

## 1. Luis · Diapositivas 1 y 2 (≈1:45)

**Diapositiva 1 · Caso y objetivo**

> "Buenos días. Somos Luis, Roberto, Javier y JunJie, y os presentamos NOCTILUZ, una tienda online de moda luminosa urbana: camisetas, chaquetas, mochilas y gorras con LED y fibra óptica.
>
> Lo especial del catálogo es que cada prenda se elige por tipo, por **color de luz** y por **modo de iluminación** —fija, parpadeo o degradado—, y no todos los modelos admiten todos los modos. Tenemos 8 modelos y 16 variantes.
>
> El objetivo no era solo hacer una web bonita, sino un **canal de venta completo**: que se pueda comprar de principio a fin y que **cada paso del cliente deje datos y eventos** que otros sistemas puedan aprovechar, como haremos en la Tarea 2."

**Diapositiva 2 · Arquitectura**

> "La arquitectura tiene cuatro capas. Delante, la **interfaz**, en HTML, CSS y JavaScript sin librerías. Esta llama a una capa de **servicios**, una API en PHP que devuelve JSON, que pasa las peticiones a la **lógica de negocio**, donde se calcula todo. Y al fondo, la **base de datos MySQL**, con 15 tablas.
>
> La idea clave es que **el navegador nunca decide precios, impuestos ni stock**: solo dice qué quiere comprar, y el servidor lo calcula todo. Así nadie puede cambiarse el precio desde el navegador.
>
> Abajo está el recorrido del cliente. Cada paso genera un evento: ver un producto, añadir al carrito, empezar la compra, crear el pedido, pagar… Los del servidor se guardan **en la misma transacción que el dato**, así que nunca hay un pedido sin su evento ni al revés.
>
> La web está publicada en **algo.free.je**, y ahora Roberto os la enseña."

## 2. Roberto · Diapositiva 3, pasos 1 y 2 (≈0:45)

> "Esta es la tienda. Filtro por **chaquetas**, **luz violeta** y **modo degradado**, y solo salen las prendas que cumplen las tres cosas.
>
> Entro en una ficha. Aquí se ven el material, la autonomía de la batería, los modos que admite, las tallas y el stock. Al abrirla se ha generado el evento **`product.viewed`**. Elijo modo y talla y la añado al carrito, lo que genera **`cart.item_added`**.
>
> El carrito se guarda en el navegador, así que si cierro la página no se pierde. Javier sigue con la compra."

## 3. Javier · Diapositiva 3, pasos 3 a 5 (≈1:15)

> "Al entrar en el checkout se genera **`checkout.started`**. Relleno los datos de prueba y aplico el cupón **NOCHE10**, que da un 10 % a partir de 50 €.
>
> Aquí se ven las **reglas de negocio**, que están todas en el servidor, en `ReglasNegocio.php`. Los precios llevan el 21 % de IVA incluido y se desglosa. El envío estándar cuesta 4,95 € y es gratis si el pedido llega a 120 €. Además, el servidor comprueba que el modo y la talla existan, que haya stock y que no se pidan más de 9 unidades.
>
> Confirmo y recibo un código único, **NCZ-** más la fecha y seis caracteres. En ese momento se descuenta el stock y se guarda el evento **`order.created`**, todo en una transacción.
>
> El pago es **simulado**. Primero pruebo con una tarjeta que se rechaza por fondos insuficientes y luego con una aprobada. Cada intento, salga bien o mal, genera **`payment.simulated`**. Solo se guardan los 4 últimos dígitos, y cualquier tarjeta real se rechaza. JunJie os enseña qué ve el dueño."

## 4. JunJie · Diapositivas 3 (pasos 6 y 7) y 4 (≈1:30)

> "Este es el **back-office**, en `/admin.html`, con su propio inicio de sesión. Aquí aparece el pedido de Javier, ya pagado. Lo paso a **en preparación** y luego a **enviado**. Cada cambio genera **`order.status_changed`** y queda en el historial. Además, solo se permiten los cambios de estado definidos: no se puede enviar un pedido sin pagar.
>
> Si el cliente tiene un problema, abre una incidencia desde soporte con su código de pedido, y se genera **`support.requested`**.
>
> *(Diapositiva 4)* Esta es la parte central del trabajo: los **eventos**. Se guardan en una tabla con un identificador único, el tipo, de dónde vienen, la sesión y los datos en JSON. Se pueden exportar en CSV o JSON, y otro sistema puede leer **solo los nuevos** pidiendo los posteriores a un número, que es lo que usaremos en la Tarea 2.
>
> Con ellos, el back-office calcula facturación, ticket medio, stock bajo y el **embudo de venta**: cuántos vieron un producto, cuántos lo añadieron al carrito, cuántos empezaron la compra y cuántos pagaron."

## 5. Luis · Diapositivas 5 y 6 (≈1:15)

> "Las decisiones más importantes fueron estas. Usamos **PHP y MySQL** porque es lo que ofrece un hosting normal. Hicimos un **desarrollo propio en vez de WooCommerce**, para que el modelo de datos y los eventos quedaran a la vista. La **pasarela es simulada**, para no manejar claves ni tarjetas reales. Y los **eventos se guardan en la base de datos**, en la misma transacción que el negocio.
>
> Las limitaciones: el pago no es real, no hay cuentas de cliente ni emails, hay una sola cuenta de administrador de prueba y algunas variantes tienen imagen provisional.
>
> Sobre la **IA**: la primera versión del HTML se generó con IA, y después usamos Claude Code para la arquitectura, el código y los datos de prueba. Revisamos lo que generaba y encontramos errores —un filtro de modos que no funcionaba bien, eventos que se registraban dos veces…— que corregimos y comprobamos probando el flujo completo. *[Vuestra reflexión: qué habéis aprendido usando IA.]*
>
> *(Diapositiva 6)* En resumen: un **flujo de compra completo y publicado**, con las **reglas de negocio en el servidor** y **cada paso registrado como evento**, listo para la Tarea 2. *[Vuestro aprendizaje principal.]* Muchas gracias. ¿Alguna pregunta?"

---

## Preguntas que os pueden hacer

Cualquiera puede ser preguntado por cualquier parte, así que todos deberíais saber contestar estas:

- **¿Por qué los precios se calculan en el servidor?** Porque lo que hay en el navegador lo puede cambiar el usuario. Si el precio viniera del navegador, cualquiera podría comprar una chaqueta a 1 €.
- **¿Qué es un evento y para qué sirve?** Un registro de algo que ha pasado (alguien vio un producto, pagó…), con fecha, tipo y datos. Sirve para analizar el comportamiento de los clientes (el embudo de venta) y para que otros sistemas reaccionen, como en la Tarea 2.
- **¿Qué es una transacción?** Un grupo de cambios en la base de datos que se hacen todos o ninguno. Al crear un pedido se guardan el pedido, se descuenta el stock y se registra el evento: si algo falla, no se guarda nada a medias.
- **¿Qué pasa si dos personas compran la última unidad a la vez?** El servidor descuenta el stock con una condición (`stock >= cantidad`) dentro de la transacción: solo una de las dos compras sale adelante; la otra recibe un error de falta de stock.
- **¿Por qué no WooCommerce?** Habría sido más rápido, pero el modelo de datos y los eventos quedarían escondidos dentro del plugin; haciéndolo nosotros se ve y se controla todo.
- **¿Qué hizo la IA y qué hicisteis vosotros?** Responded con honestidad, igual que en el anexo de la memoria.

## Antes del día 7

1. **Rellenad los `[COMPLETAR]`** de las diapositivas: qué hizo cada uno (diapositiva 1), la reflexión sobre la IA (5) y el aprendizaje principal (6).
2. **Preparad un plan B para la demo.** InfinityFree a veces va lento: tened el back-office ya abierto con la sesión iniciada en otra pestaña y algunas capturas o un vídeo corto por si se cae la web.
3. **Ensayadlo una vez con cronómetro.** Si os pasáis de 7 minutos, recortad la demo, no las explicaciones.

Los datos de prueba (usuario del back-office, tarjetas y cupones) están en el apartado 5 del `README.md`.
