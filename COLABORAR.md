# Cómo colaborar en NOCTILUZ

Guía para que cada miembro del grupo pueda trabajar en el repositorio con su propia cuenta. **Entrega: 7 de octubre de 2026.**

## 1. Preparación (solo la primera vez)

1. **Aceptar la invitación** al repositorio: entrar en https://github.com/luisgabu0-gif/noctiluz-ucam con tu cuenta de GitHub y pulsar *Accept invitation* (también llega por correo). Caduca a los 7 días: si da 404, pide a Luis que la reenvíe.
2. **Instalar Git**, de una de estas dos formas:
   - **GitHub Desktop** (https://desktop.github.com), sin terminal: inicias sesión con tu cuenta y configura tu nombre y correo solo. Después, *File → Clone repository → noctiluz-ucam*.
   - **Git** (https://git-scm.com), por terminal: sigue los pasos 3 y 4.
3. **Descargar el proyecto:**
   ```bash
   git clone https://github.com/luisgabu0-gif/noctiluz-ucam.git
   ```
4. **Poner tu nombre y correo en Git.** Usa **el mismo correo que tu cuenta de GitHub**; si no, tus commits no aparecen a tu nombre:
   ```bash
   git config --global user.name "Nombre Apellido"
   git config --global user.email "correo-de-tu-cuenta-github@ejemplo.com"
   ```
5. **Probar la tienda en tu ordenador.** Necesitas PHP 8 (en Windows sirve XAMPP) con `pdo_sqlite` y `mbstring` activas en `php.ini`. Desde la carpeta del proyecto:
   ```bash
   php database/instalar_local.php
   php -S localhost:8000 -t public_html
   ```
   La tienda queda en http://localhost:8000 y el back-office en http://localhost:8000/admin.html. Los usuarios, tarjetas y cupones de prueba están en el apartado 5 del [README](README.md).

## 2. Cada vez que vayas a trabajar

1. **Antes de tocar nada**, baja lo último que hayan subido los demás:
   ```bash
   git pull
   ```
2. Haz tu cambio y **pruébalo en local**.
3. Guárdalo con un mensaje que explique qué has hecho y súbelo:
   ```bash
   git add .
   git commit -m "Añade pruebas de cupones y envío gratis"
   git push
   ```
   En GitHub Desktop: escribes el mensaje, *Commit to master* y *Push origin*.

Si `git push` te lo rechaza porque alguien ha subido algo antes, haz `git pull` y vuelve a hacer `git push`.

## 3. Normas

- **Commits pequeños y con sentido**, cada uno con tu cuenta. Nada de commits de relleno: en la defensa cada uno explica lo suyo.
- **La memoria (`.docx`) y las diapositivas (`.pptx`) se editan por turnos.** Git no puede mezclar dos versiones de un archivo de Office: si dos personas los editan a la vez, uno pierde su trabajo. Avisa en el grupo antes de cogerlos y súbelos en cuanto termines.
- **Nunca subas `public_html/app/config.php`** (tiene las contraseñas de la base de datos). Está en `.gitignore`, así que Git lo ignora solo: no lo fuerces.
- **Si usas IA (Claude, ChatGPT…), entiende lo que subes y decláralo** en el anexo de la memoria. El repositorio incluye un `CLAUDE.md` para que Claude Code conozca el proyecto.

## 4. Publicar los cambios en la web

Subir algo a GitHub **no cambia la web publicada** (https://algo.free.je): el hosting tiene su propia copia de los archivos. Cuando tus cambios estén en GitHub, avisa a Luis y él los publica en InfinityFree.

## 5. Reparto

| Quién | Parte |
|---|---|
| Luis | Base de datos, despliegue y coordinación |
| Javier | Reglas de negocio (`app/ReglasNegocio.php`): IVA, envío, cupones y stock |
| JunJie | Eventos (`app/Eventos.php`) y back-office (`admin.html`, `assets/js/admin.js`) |
| Roberto | Tienda y carrito (`assets/js/tienda.js`, `assets/js/carrito.js`) |

Además, cada uno escribe su párrafo de aportaciones en el anexo de la memoria (apartado e), los errores que haya encontrado (apartado d) y su parte de las diapositivas.
