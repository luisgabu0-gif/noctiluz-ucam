// NOCTILUZ · tienda. Interfaz (vistas y enrutado por hash). La lógica de negocio vive en el servidor (api/ + app/).
import { api } from './api.js';
import { esc, eur, fecha, toast, prenda, campo, mostrarErrores, validarEnCliente } from './ui.js';
import * as carrito from './carrito.js';
import { registrar, sesionId } from './eventos.js';

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const vistaInicio = $('#vista-inicio');
const vistaPagina = $('#vista-pagina');
const vistaColeccion = $('#vista-coleccion');
const ORDEN_MODOS = ['fijo', 'parpadeo', 'degradado'];

const estado = {
  catalogo: null,
  filtros: { tipos: new Set(), colores: new Set(), modos: new Set(), texto: '', soloStock: false, precioMax: null, orden: 'destacados' },
};
let indiceSku = new Map();

// ====================================================================================
// Catálogo
// ====================================================================================

async function cargarCatalogo() {
  const c = await api('productos.php');
  c.modos.sort((a, b) => ORDEN_MODOS.indexOf(a.id) - ORDEN_MODOS.indexOf(b.id));
  indiceSku = new Map();
  for (const p of c.productos) {
    p.modos.sort((a, b) => ORDEN_MODOS.indexOf(a) - ORDEN_MODOS.indexOf(b));
    for (const v of p.variantes) indiceSku.set(v.sku, { producto: p, variante: v });
  }
  estado.catalogo = c;
}

const nombreModo = (id) => estado.catalogo?.modos.find((m) => m.id === id)?.nombre ?? id;
const descripcionModo = (id) => estado.catalogo?.modos.find((m) => m.id === id)?.descripcion ?? '';
const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function medio(p, v, { modo = 'fijo', etiqueta = true, variante = 'frontal' } = {}) {
  if (v.imagen && variante === 'foto') {
    return `<img src="${esc(v.imagen)}" alt="${esc(`${p.nombre}, luz ${v.color_nombre.toLowerCase()}`)}" loading="lazy">`;
  }
  const aviso = etiqueta ? '<span class="foto-pendiente">Imagen provisional</span>' : '';
  return aviso + prenda(p.categoria, v.hex, { modo, variante });
}
const miniatura = (p, v, modo) => medio(p, v, { modo, etiqueta: false, variante: v.imagen ? 'foto' : 'frontal' });

// Orden en que se agrupan las prendas en la página de la colección.
const ORDEN_GRUPOS = ['camiseta', 'gorra', 'chaqueta', 'mochila'];
const alternar = (conjunto, valor) => (conjunto.has(valor) ? conjunto.delete(valor) : conjunto.add(valor));
const precios = () => estado.catalogo.productos.map((p) => p.precio);

function pintarFiltros() {
  const { catalogo: c, filtros: f } = estado;
  const cuantos = (fn) => c.productos.reduce((n, p) => n + p.variantes.filter((v) => fn(p, v)).length, 0);
  const total = cuantos(() => true);
  const tipoActivo = f.tipos.size === 1 ? [...f.tipos][0] : (f.tipos.size ? null : 'todas');
  $('#pestanas').innerHTML = [{ id: 'todas', nombre: 'Todo', n: total },
    ...ORDEN_GRUPOS.map((id) => ({ id, nombre: c.categorias.find((t) => t.id === id)?.nombre ?? id, n: cuantos((p) => p.categoria === id) }))]
    .map((t) => `<a href="#/catalogo${t.id === 'todas' ? '' : '/' + t.id}" ${t.id === tipoActivo ? 'aria-current="page"' : ''}>${esc(t.nombre)}<em>${t.n}</em></a>`).join('');
  $('#fPrenda').innerHTML = ORDEN_GRUPOS.map((id) => `<label class="pf-check"><input type="checkbox" data-tipo="${id}" ${f.tipos.has(id) ? 'checked' : ''}><i aria-hidden="true"></i>${esc(c.categorias.find((t) => t.id === id)?.nombre ?? id)}<em>${cuantos((p) => p.categoria === id)}</em></label>`).join('');
  $('#fColor').innerHTML = c.colores
    .map((col) => `<button type="button" class="pf-color" data-color="${esc(col.id)}" aria-pressed="${f.colores.has(col.id)}"><i style="--k:${esc(col.hex)}"></i>${esc(col.nombre)}<em>${cuantos((p, v) => v.color === col.id)}</em></button>`).join('');
  $('#fModo').innerHTML = c.modos
    .map((m) => `<button type="button" class="pf-modo" data-modo="${esc(m.id)}" aria-pressed="${f.modos.has(m.id)}" title="${esc(m.descripcion)}">${esc(m.nombre)}</button>`).join('');
  const rango = $('#fPrecio');
  rango.min = Math.floor(Math.min(...precios()));
  rango.max = Math.ceil(Math.max(...precios()));
  rango.value = f.precioMax ?? rango.max;
  $('#precioMin').textContent = eur(Number(rango.min));
  $('#precioMax').textContent = `hasta ${eur(Number(rango.value))}`;
  $('#fStock').checked = f.soloStock;
  $('#orden').value = f.orden;
}

/** Filtros: dentro de un grupo se suman opciones (O); entre grupos se combinan (Y). */
function variantesFiltradas() {
  const f = estado.filtros;
  const texto = normalizar(f.texto);
  const salida = [];
  for (const p of estado.catalogo.productos) {
    if (f.tipos.size && !f.tipos.has(p.categoria)) continue;
    if (f.modos.size && !p.modos.some((m) => f.modos.has(m))) continue;
    if (f.precioMax !== null && p.precio > f.precioMax) continue;
    for (const v of p.variantes) {
      if (f.colores.size && !f.colores.has(v.color)) continue;
      if (f.soloStock && v.stock === 0) continue;
      if (texto && !normalizar(`${p.nombre} ${v.color_nombre} ${p.categoria_nombre} ${p.descripcion}`).includes(texto)) continue;
      salida.push({ p, v });
    }
  }
  const orden = { 'precio-asc': (a, b) => a.p.precio - b.p.precio, 'precio-desc': (a, b) => b.p.precio - a.p.precio,
    nombre: (a, b) => a.p.nombre.localeCompare(b.p.nombre, 'es') }[f.orden];
  return orden ? salida.sort(orden) : salida;
}

function tarjeta({ p, v }) {
  const etiqueta = v.stock === 0 ? '<span class="etiqueta agotado">Agotado</span>'
    : v.stock <= 3 ? '<span class="etiqueta">Últimas unidades</span>' : '';
  return `<a class="ptarjeta${v.stock === 0 ? ' sin-stock' : ''}" href="#/producto/${esc(v.sku)}">
    <div class="ptarjeta-foto" style="--gc:${esc(v.hex)}44">${etiqueta}${medio(p, v, { modo: p.modos.at(-1), variante: v.imagen ? 'foto' : 'frontal' })}<span class="ptarjeta-ver">Ver producto</span></div>
    <div class="ptarjeta-fila"><span class="ptarjeta-nombre">${esc(p.nombre)}</span><span class="ptarjeta-precio">${eur(p.precio)}</span></div>
    <div class="ptarjeta-fila sec"><span class="ptarjeta-color" style="--gc:${esc(v.hex)}"><i></i>${esc(p.categoria_nombre)} · luz ${esc(v.color_nombre.toLowerCase())}</span><span>${p.modos.map(nombreModo).join(' · ')}</span></div>
  </a>`;
}

const NOTAS_GRUPO = {
  camiseta: 'Básicos que brillan: la luz dibuja líneas, retículas y siluetas.',
  gorra: 'Luz en la visera, en la copa o en toda la tela.',
  chaqueta: 'Fibra óptica en las costuras y en dibujos de circuito.',
  mochila: 'Para el trayecto diario, con la luz en el contorno o en el frontal.',
};

function filtrosActivos() {
  const { catalogo: c, filtros: f } = estado;
  const chip = (texto, datos) => `<button type="button" class="chip-activo" ${datos}>${esc(texto)} <span aria-hidden="true">✕</span><span class="sr-only">Quitar filtro</span></button>`;
  const chips = [
    ...[...f.tipos].map((t) => chip(c.categorias.find((x) => x.id === t)?.nombre ?? t, `data-quitar-tipo="${esc(t)}"`)),
    ...[...f.colores].map((col) => chip(c.colores.find((x) => x.id === col)?.nombre ?? col, `data-quitar-color="${esc(col)}"`)),
    ...[...f.modos].map((m) => chip(nombreModo(m), `data-quitar-modo="${esc(m)}"`)),
    ...(f.soloStock ? [chip('Solo en stock', 'data-quitar-stock')] : []),
    ...(f.precioMax !== null ? [chip(`Hasta ${eur(f.precioMax)}`, 'data-quitar-precio')] : []),
    ...(f.texto.trim() ? [chip(`«${f.texto.trim()}»`, 'data-quitar-texto')] : []),
  ];
  return chips;
}

function pintarCatalogo() {
  pintarFiltros();
  const items = variantesFiltradas();
  const chips = filtrosActivos();
  $('#filtrosActivos').innerHTML = chips.length ? chips.join('') + '<button type="button" class="enlace" data-borrar>Quitar todo</button>' : '';
  $('#numFiltros').hidden = !chips.length;
  $('#numFiltros').textContent = chips.length;
  $('#verResultados').textContent = `Ver ${items.length} producto${items.length === 1 ? '' : 's'}`;
  $('#contadorProductos').textContent = `${items.length} producto${items.length === 1 ? '' : 's'}`;
  const f = estado.filtros;
  const unico = f.tipos.size === 1 ? estado.catalogo.categorias.find((t) => f.tipos.has(t.id)) : null;
  $('#tituloColeccion').textContent = unico ? unico.nombre : 'Toda la colección';
  $('#migaColeccion').textContent = unico ? unico.nombre : 'Tienda';
  if (!items.length) {
    $('#rejilla').innerHTML = '<div class="empty"><h3>Ningún producto coincide</h3><p>Prueba a quitar algún filtro o a cambiar la búsqueda.</p><button type="button" class="btn btn-outline btn-sm" data-borrar>Borrar filtros</button></div>';
    return;
  }
  const grupos = [...ORDEN_GRUPOS, ...estado.catalogo.categorias.map((t) => t.id).filter((id) => !ORDEN_GRUPOS.includes(id))];
  $('#rejilla').innerHTML = grupos.map((id) => {
    const del = items.filter(({ p }) => p.categoria === id);
    if (!del.length) return '';
    const nombre = estado.catalogo.categorias.find((t) => t.id === id)?.nombre ?? id;
    const enlace = f.tipos.size === 1 ? '' : ` · <a href="#/catalogo/${esc(id)}">Ver solo ${esc(nombre.toLowerCase())}</a>`;
    return `<section class="col-grupo" aria-label="${esc(nombre)}">
      <div class="col-grupo-cab"><div><h2>${esc(nombre)}</h2><p>${esc(NOTAS_GRUPO[id] ?? '')}</p></div><span>${del.length} producto${del.length === 1 ? '' : 's'}${enlace}</span></div>
      <div class="col-rejilla">${del.map(tarjeta).join('')}</div>
    </section>`;
  }).join('');
}

function restablecerFiltros() {
  Object.assign(estado.filtros, { texto: '', soloStock: false, precioMax: null });
  estado.filtros.tipos.clear();
  estado.filtros.colores.clear();
  estado.filtros.modos.clear();
  document.querySelectorAll('[data-buscador]').forEach((i) => { i.value = ''; });
  pintarCatalogo();
}

// ---------- Panel de filtros (ventana flotante bajo el botón «Filtros») ----------
const panelFiltros = $('#panelFiltros');
function abrirFiltros(abrir) {
  panelFiltros.hidden = !abrir;
  $('#botonFiltros').setAttribute('aria-expanded', String(abrir));
}
$('#botonFiltros').addEventListener('click', () => abrirFiltros(panelFiltros.hidden));
$('#verResultados').addEventListener('click', () => abrirFiltros(false));
// composedPath(): el botón pulsado puede haberse repintado ya (y estar fuera del DOM) cuando llega aquí el clic.
document.addEventListener('click', (e) => {
  const ruta = e.composedPath();
  if (!panelFiltros.hidden && !ruta.includes(panelFiltros) && !ruta.includes($('#botonFiltros'))) abrirFiltros(false);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panelFiltros.hidden) abrirFiltros(false); });

$('#vista-coleccion').addEventListener('click', (e) => {
  if (!estado.catalogo) return;
  const f = estado.filtros;
  const b = e.target.closest('button');
  if (!b) return;
  if (b.matches('[data-borrar]')) return restablecerFiltros();
  if (b.dataset.color) alternar(f.colores, b.dataset.color);
  else if (b.dataset.modo) alternar(f.modos, b.dataset.modo);
  else if (b.dataset.quitarTipo) f.tipos.delete(b.dataset.quitarTipo);
  else if (b.dataset.quitarColor) f.colores.delete(b.dataset.quitarColor);
  else if (b.dataset.quitarModo) f.modos.delete(b.dataset.quitarModo);
  else if (b.hasAttribute('data-quitar-stock')) f.soloStock = false;
  else if (b.hasAttribute('data-quitar-precio')) f.precioMax = null;
  else if (b.hasAttribute('data-quitar-texto')) { f.texto = ''; document.querySelectorAll('[data-buscador]').forEach((i) => { i.value = ''; }); }
  else return;
  pintarCatalogo();
});
$('#vista-coleccion').addEventListener('change', (e) => {
  if (!estado.catalogo) return;
  const f = estado.filtros;
  const t = e.target;
  if (t.dataset.tipo) alternar(f.tipos, t.dataset.tipo);
  else if (t.id === 'fStock') f.soloStock = t.checked;
  else if (t.id === 'orden') f.orden = t.value;
  else return;
  pintarCatalogo();
});
$('#fPrecio').addEventListener('input', (e) => {
  if (!estado.catalogo) return;
  const valor = Number(e.target.value);
  estado.filtros.precioMax = valor >= Number(e.target.max) ? null : valor;
  pintarCatalogo();
});

document.querySelectorAll('[data-buscador]').forEach((input) => {
  input.addEventListener('input', () => {
    estado.filtros.texto = input.value;
    document.querySelectorAll('[data-buscador]').forEach((otro) => { if (otro !== input) otro.value = input.value; });
    if (!estado.catalogo) return;
    pintarCatalogo();
    if (!vistaColeccion.hidden) return;
    location.hash = '#/catalogo';
  });
});

// ====================================================================================
// Portada: carruseles, «Shop the look» y reseñas
// ====================================================================================

// Fotos de la comunidad: cada una enlaza con el producto que se ve (nombre y precio salen del catálogo).
const COMUNIDAD = [
  ['assets/img/productos/mochila-trayecto-rosa.jpg', 'mochila-trayecto-rosa'],
  ['assets/img/productos/chaqueta-circuito-violeta.jpg', 'chaqueta-circuito-violeta'],
  ['assets/img/editorial/chaqueta-azotea.jpg', 'chaqueta-perimetro-lima'],
  ['assets/img/comunidad/camiseta-reticula.jpg', 'camiseta-linea-lima'],
  ['assets/img/editorial/mochila-callejon.jpg', 'mochila-trayecto-rojo'],
  ['assets/img/editorial/gorra-lluvia.jpg', 'gorra-faro-cian'],
  ['assets/img/comunidad/chaqueta-nervadura.jpg', 'chaqueta-circuito-ambar'],
  ['assets/img/productos/gorra-aura-violeta.jpg', 'gorra-aura-violeta'],
];

function pintarPortada() {
  $('#pistaComunidad').innerHTML = COMUNIDAD.filter(([, sku]) => indiceSku.has(sku)).map(([foto, sku]) => {
    const { producto: p, variante: v } = indiceSku.get(sku);
    return `<a class="look" href="#/producto/${esc(sku)}">
      <img src="${esc(foto)}" alt="${esc(`${p.nombre}, luz ${v.color_nombre.toLowerCase()}`)}" loading="lazy">
      <span class="look-prod">${v.imagen ? `<img src="${esc(v.imagen)}" alt="">` : ''}<span><b>${esc(p.nombre)}</b>${eur(p.precio)}</span><span class="look-mas" aria-hidden="true">+</span></span>
    </a>`;
  }).join('');
  // Nota media ponderada por número de reseñas de cada producto (datos de prueba de datos_prueba.sql).
  const ps = estado.catalogo.productos;
  const total = ps.reduce((n, p) => n + p.num_resenas, 0);
  const media = total ? ps.reduce((s, p) => s + p.valoracion * p.num_resenas, 0) / total : 0;
  $('#notaMedia').innerHTML = `${media.toLocaleString('es-ES', { maximumFractionDigits: 1 })} de 5 <small>· ${total} opiniones</small>`;
  const prendas = ps.reduce((n, p) => n + p.variantes.length, 0);
  $('#resumenColeccion').textContent = `${prendas} prendas · ${estado.catalogo.colores.length} colores de luz`;
  document.querySelectorAll('[data-carrusel]').forEach(actualizarCarrusel);
}

// ---------- Reseñas: las últimas de la base de datos y el formulario para publicar una ----------
const tarjetaResena = (r) => `<figure class="rcard">
  <div class="estrellas" aria-label="${r.estrellas} de 5">${'★'.repeat(r.estrellas)}${'☆'.repeat(5 - r.estrellas)}</div>
  <blockquote>«${esc(r.texto)}»</blockquote>
  <figcaption><span class="avatar">${esc(r.nombre.charAt(0).toUpperCase())}</span><span><b>${esc(r.nombre)}</b>${esc(r.prenda)}</span></figcaption>
</figure>`;

async function pintarResenas() {
  let datos;
  try {
    datos = await api('resenas.php');
  } catch {
    $('#listaResenas').innerHTML = '';
    return;
  }
  $('#listaResenas').innerHTML = datos.resenas.map(tarjetaResena).join('');
  // Para opinar hay que haber iniciado sesión (el equipo del back-office no puede).
  const caja = $('#resenaNueva');
  caja.hidden = !datos.puede_opinar;
  if (caja.hidden) { caja.innerHTML = ''; return; }
  if (!datos.cliente) {
    caja.innerHTML = '<p class="pista"><a class="enlace" href="#/cuenta">Inicia sesión o crea una cuenta</a> para añadir una reseña.</p>';
    return;
  }
  const pedidos = datos.pedidos;
  // Nombre que se publica por defecto: nombre de pila e inicial del apellido («Lucía F.»).
  const partes = datos.cliente.nombre.split(' ');
  const nombrePublico = (partes[0] + (partes[1] ? ` ${partes[1].charAt(0)}.` : '')).slice(0, 40);
  caja.innerHTML = `
    <button type="button" class="btn btn-outline btn-sm" id="abrirResena" aria-expanded="false" aria-controls="formResena">Añadir reseña</button>
    ${!pedidos.length ? `<p class="pista" id="formResena" hidden>Para opinar necesitas un pedido pagado que todavía no hayas valorado.
      <a class="enlace" href="#/catalogo">Ver la colección</a></p>` : `<form class="bloque form-resena" id="formResena" novalidate hidden>
      <div class="form-grid">
        ${pedidos.length > 1 ? `<div class="campo">
          <label for="f-pedido-resena">Pedido</label>
          <select id="f-pedido-resena" name="pedido">${pedidos.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
          <small class="campo-error" data-error-de="pedido" role="alert"></small>
        </div>` : `<input type="hidden" name="pedido" value="${esc(pedidos[0])}">`}
        ${campo({ nombre: 'nombre', etiqueta: 'Nombre que se publica', valor: nombrePublico, atributos: 'minlength="2" maxlength="40" autocomplete="given-name" placeholder="Ej.: Laura M."' })}
        <div class="campo">
          <span class="etiqueta" id="etq-estrellas">Puntuación</span>
          <div class="elegir-estrellas" role="radiogroup" aria-labelledby="etq-estrellas">
            ${[5, 4, 3, 2, 1].map((n) => `<input type="radio" id="estrella-${n}" name="estrellas" value="${n}" ${n === 5 ? 'checked' : ''}><label for="estrella-${n}" title="${n} de 5">★</label>`).join('')}
          </div>
          <small class="campo-error" data-error-de="estrellas" role="alert"></small>
        </div>
        <div class="campo completo">
          <label for="f-texto">Tu opinión</label>
          <textarea id="f-texto" name="texto" required minlength="10" maxlength="400" data-mensaje="Escribe tu opinión (mínimo 10 caracteres)." placeholder="¿Qué tal brilla? ¿Para qué la usas?"></textarea>
          <small class="campo-error" data-error-de="texto" role="alert"></small>
        </div>
      </div>
      <div id="errorResena" role="alert" style="margin-top:14px"></div>
      <button class="btn btn-solid" style="margin-top:16px" id="enviarResena">Publicar reseña</button>
    </form>`}`;
  const f = $('#formResena');
  $('#abrirResena').addEventListener('click', (e) => {
    f.hidden = !f.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!f.hidden));
    if (!f.hidden && f.nombre) f.nombre.focus();
  });
  if (!pedidos.length) return;
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#errorResena').innerHTML = '';
    if (!validarEnCliente(f)) return;
    const d = Object.fromEntries(new FormData(f));
    const boton = $('#enviarResena');
    boton.disabled = true;
    try {
      await api('resenas.php', { method: 'POST', body: { ...d, sesion_id: sesionId() } });
      toast('¡Gracias! Tu reseña ya está publicada.');
      pintarResenas();
    } catch (err) {
      boton.disabled = false;
      mostrarErrores(f, err.campos);
      $('#errorResena').innerHTML = `<div class="alerta error">${esc(err.message)}</div>`;
    }
  });
}

// Carrusel con desplazamiento nativo (también funciona con el dedo); los botones mueven una tarjeta.
function actualizarCarrusel(carrusel) {
  const pista = $('.carrusel-pista', carrusel);
  const tarjetas = [...pista.children];
  if (!tarjetas.length) return;
  const centro = pista.scrollLeft + pista.clientWidth / 2;
  let actual = 0;
  tarjetas.forEach((t, i) => {
    if (Math.abs(t.offsetLeft + t.offsetWidth / 2 - centro) < Math.abs(tarjetas[actual].offsetLeft + tarjetas[actual].offsetWidth / 2 - centro)) actual = i;
  });
  tarjetas.forEach((t, i) => t.classList.toggle('activa', i === actual));
  const pos = $('[data-posicion]', carrusel);
  if (pos) pos.textContent = `${actual + 1}/${tarjetas.length}`;
  carrusel.dataset.actual = actual;
}
document.querySelectorAll('[data-carrusel]').forEach((carrusel) => {
  const pista = $('.carrusel-pista', carrusel);
  let pendiente = 0;
  pista.addEventListener('scroll', () => { cancelAnimationFrame(pendiente); pendiente = requestAnimationFrame(() => actualizarCarrusel(carrusel)); });
  carrusel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ir]');
    if (!b) return;
    const tarjetas = [...pista.children];
    const destino = tarjetas[Math.max(0, Math.min(tarjetas.length - 1, Number(carrusel.dataset.actual || 0) + Number(b.dataset.ir)))];
    if (destino) pista.scrollTo({ left: destino.offsetLeft + destino.offsetWidth / 2 - pista.clientWidth / 2, behavior: 'smooth' });
  });
  window.addEventListener('resize', () => actualizarCarrusel(carrusel));
  actualizarCarrusel(carrusel);
});

// ====================================================================================
// Ficha de producto
// ====================================================================================

function unidadesEnCarrito(sku) {
  return carrito.obtener().filter((l) => l.sku === sku).reduce((s, l) => s + l.cantidad, 0);
}

async function vistaProducto(sku) {
  await listo;
  const r = indiceSku.get(sku);
  if (!r) return pintarNoEncontrado('Este producto no existe o ya no está disponible.');
  const { producto: p, variante: v } = r;
  const sel = { modo: p.modos[0], talla: p.tiene_tallas ? 'M' : 'Única', cantidad: 1, vista: v.imagen ? 'foto' : 'frontal' };
  registrar('product.viewed', { sku: v.sku, precio: p.precio });
  document.title = `${p.nombre} · ${v.color_nombre} — NOCTILUZ`;

  const estrellas = '★'.repeat(Math.round(p.valoracion)) + '☆'.repeat(5 - Math.round(p.valoracion));
  vistaPagina.innerHTML = `
    <a href="#/catalogo" class="volver">← Volver al catálogo</a>
    <div class="pd-layout">
      <div>
        <div class="pd-gallery-main" id="pdPrincipal" style="--gc:${esc(v.hex)}"></div>
        <div class="pd-thumbs" id="pdMiniaturas" role="group" aria-label="Vistas del producto"></div>
      </div>
      <div>
        <div class="pd-type">${esc(p.categoria_nombre)}</div>
        <h1 class="pd-name">${esc(p.nombre)} · ${esc(v.color_nombre)}</h1>
        <div class="pd-price">${eur(p.precio)}<small>IVA incluido</small></div>
        <div class="pd-rating"><span class="stars" aria-hidden="true">${estrellas}</span><span>${p.valoracion.toLocaleString('es-ES')} de 5 · ${p.num_resenas} reseñas (ficticias)</span></div>
        <p class="pd-desc">${esc(p.descripcion)}</p>

        <div class="pd-option">
          <div class="pd-option-label">Color de luz <span>${esc(v.color_nombre)}</span></div>
          <div class="pd-colors">${p.variantes.map((o) => `<a class="dot" href="#/producto/${esc(o.sku)}" aria-pressed="${o.sku === v.sku}"
            title="${esc(o.color_nombre)}" aria-label="Ver en luz ${esc(o.color_nombre)}" style="background:${esc(o.hex)};--gc:${esc(o.hex)}"></a>`).join('')}</div>
        </div>
        <div class="pd-option">
          <div class="pd-option-label">Modo de iluminación <span id="pdModoDesc"></span></div>
          <div class="pd-modes" id="pdModos"></div>
        </div>
        <div class="pd-option">
          <div class="pd-option-label">Talla</div>
          <div id="pdTallas"></div>
        </div>
        <div class="pd-option">
          <div class="pd-option-label">Cantidad</div>
          <div class="pd-qty"><button type="button" id="menos" aria-label="Quitar una unidad">−</button><span id="cantidad" aria-live="polite">1</span><button type="button" id="mas" aria-label="Añadir una unidad">+</button></div>
        </div>
        <p class="pd-stock" id="pdStock"></p>
        <div class="pd-add"><button type="button" class="btn btn-solid btn-full" id="anadir">Añadir al carrito</button></div>

        <dl class="ficha">
          <div><dt>Material</dt><dd>${esc(p.material)}</dd></div>
          <div><dt>Autonomía</dt><dd>Hasta ${p.autonomia_h} h en modo fijo</dd></div>
          <div><dt>Carga</dt><dd>USB-C en unas 2 h · módulo LED extraíble</dd></div>
          <div><dt>Lavado</dt><dd>A 30 °C, del revés y sin el módulo</dd></div>
          <div><dt>Envío a la Península</dt><dd>Estándar ${eur(estado.catalogo.reglas.envio_estandar)} (gratis desde ${eur(estado.catalogo.reglas.umbral_envio_gratis)}) · Exprés ${eur(estado.catalogo.reglas.envio_expres)} · Baleares con otra tarifa</dd></div>
          <div><dt>Devoluciones</dt><dd>30 días (política simulada)</dd></div>
          <div><dt>Referencia</dt><dd class="codigo">${esc(v.sku)}</dd></div>
        </dl>
      </div>
    </div>`;

  const vistas = v.imagen ? [['foto', 'Fotografía'], ['detalle', 'Detalle de la fibra']] : [['frontal', 'Frontal'], ['trasera', 'Trasera'], ['detalle', 'Detalle de la fibra']];

  function pintarGaleria() {
    $('#pdPrincipal').innerHTML = medio(p, v, { modo: sel.modo, variante: sel.vista });
    $('#pdMiniaturas').innerHTML = vistas.map(([id, etiqueta]) =>
      `<button type="button" class="pd-thumb" data-vista="${id}" aria-pressed="${sel.vista === id}" title="${etiqueta}" aria-label="${etiqueta}">${
        medio(p, v, { modo: sel.modo, variante: id, etiqueta: false })}</button>`).join('');
  }

  function pintarModos() {
    $('#pdModos').innerHTML = p.modos.map((m) =>
      `<button type="button" class="pd-mode-btn" data-modo="${m}" aria-pressed="${sel.modo === m}"><span class="mdot"></span>${esc(nombreModo(m))}</button>`).join('');
    $('#pdModoDesc').textContent = descripcionModo(sel.modo);
  }

  function pintarTallas() {
    $('#pdTallas').innerHTML = p.tiene_tallas
      ? `<div class="pd-sizes">${estado.catalogo.tallas.map((t) => `<button type="button" class="pd-size-btn" data-talla="${t}" aria-pressed="${sel.talla === t}">${t}</button>`).join('')}</div>`
      : '<span class="pd-single">Talla única ajustable</span>';
  }

  function pintarDisponibilidad() {
    const libres = Math.min(carrito.MAX_UNIDADES, v.stock - unidadesEnCarrito(v.sku));
    sel.cantidad = Math.max(1, Math.min(sel.cantidad, Math.max(libres, 1)));
    $('#cantidad').textContent = sel.cantidad;
    const stock = $('#pdStock');
    const boton = $('#anadir');
    stock.className = 'pd-stock';
    if (v.stock === 0) {
      stock.classList.add('agotado');
      stock.textContent = 'Agotado en este color. Prueba con otro color de luz.';
    } else if (libres <= 0) {
      stock.classList.add('ultimas');
      stock.textContent = 'Ya tienes en el carrito todas las unidades disponibles.';
    } else if (v.stock <= 3) {
      stock.classList.add('ultimas');
      stock.textContent = `Últimas unidades: quedan ${v.stock}.`;
    } else {
      stock.textContent = 'En stock · envío en 24-72 h (simulado).';
    }
    boton.disabled = v.stock === 0 || libres <= 0;
    boton.textContent = v.stock === 0 ? 'Agotado' : 'Añadir al carrito';
    $('#mas').disabled = sel.cantidad >= libres;
    $('#menos').disabled = sel.cantidad <= 1;
  }

  vistaPagina.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.vista) { sel.vista = b.dataset.vista; pintarGaleria(); }
    else if (b.dataset.modo) { sel.modo = b.dataset.modo; pintarModos(); if (sel.vista !== 'foto') pintarGaleria(); }
    else if (b.dataset.talla) { sel.talla = b.dataset.talla; pintarTallas(); }
    else if (b.id === 'mas') { sel.cantidad += 1; pintarDisponibilidad(); }
    else if (b.id === 'menos') { sel.cantidad -= 1; pintarDisponibilidad(); }
    else if (b.id === 'anadir') {
      carrito.anadir({ sku: v.sku, modo: sel.modo, talla: sel.talla, cantidad: sel.cantidad });
      registrar('cart.item_added', { sku: v.sku, modo: sel.modo, talla: sel.talla, cantidad: sel.cantidad, precio: p.precio });
      pintarDisponibilidad();
      abrirCarrito();
      toast(`${p.nombre} · ${v.color_nombre} añadida al carrito`);
    }
  }, { signal: controlVista.signal });

  pintarGaleria();
  pintarModos();
  pintarTallas();
  pintarDisponibilidad();
}

// ====================================================================================
// Carrito (panel lateral)
// ====================================================================================

function subtotalLocal() {
  return carrito.obtener().reduce((s, l) => s + (indiceSku.get(l.sku)?.producto.precio ?? 0) * l.cantidad, 0);
}

function pintarCarrito() {
  const n = carrito.unidades();
  const contador = $('#contadorCarrito');
  contador.hidden = n === 0;
  contador.textContent = n;
  $('#botonCarrito').setAttribute('aria-label', `Abrir carrito (${n} unidades)`);
  if (!estado.catalogo) return;

  const lineas = carrito.obtener();
  if (!lineas.length) {
    $('#lineasCarrito').innerHTML = '<div class="drawer-empty">Tu carrito está vacío.</div>';
    $('#pieCarrito').innerHTML = '<a class="btn btn-outline btn-full" href="#/catalogo">Ver la colección</a>';
    return;
  }

  let hayProblemas = false;
  $('#lineasCarrito').innerHTML = lineas.map((l) => {
    const k = esc(carrito.clave(l));
    const r = indiceSku.get(l.sku);
    if (!r) {
      hayProblemas = true;
      return `<div class="cline"><div class="cline-info"><div class="cline-name">Producto no disponible</div>
        <button class="cline-remove" data-quitar="${k}">Eliminar</button></div></div>`;
    }
    const { producto: p, variante: v } = r;
    const sinStock = unidadesEnCarrito(l.sku) > v.stock;
    hayProblemas ||= sinStock;
    return `<div class="cline">
      <a class="cline-media" href="#/producto/${esc(v.sku)}">${miniatura(p, v, l.modo)}</a>
      <div class="cline-info">
        <div class="cline-name">${esc(p.nombre)} · ${esc(v.color_nombre)}</div>
        <div class="cline-meta">${esc(nombreModo(l.modo))} · Talla ${esc(l.talla)}</div>
        ${sinStock ? `<div class="cline-aviso">Solo quedan ${v.stock} unidades de este color.</div>` : ''}
        <div class="cline-row">
          <div class="cline-qty">
            <button data-menos="${k}" aria-label="Quitar una unidad">−</button><span>${l.cantidad}</span><button data-mas="${k}" aria-label="Añadir una unidad">+</button>
          </div>
          <span class="cline-price">${eur(p.precio * l.cantidad)}</span>
        </div>
        <button class="cline-remove" data-quitar="${k}">Eliminar</button>
      </div>
    </div>`;
  }).join('');

  const subtotal = subtotalLocal();
  const falta = estado.catalogo.reglas.umbral_envio_gratis - subtotal;
  $('#pieCarrito').innerHTML = `
    <div class="sumrow total" style="margin-top:0; padding-top:0; border:0"><span>Subtotal</span><span>${eur(subtotal)}</span></div>
    <div class="sumrow nota"><span>${falta > 0 ? `Te faltan ${eur(falta)} para el envío estándar gratis.` : 'Tienes envío estándar gratis.'}</span></div>
    <div class="sumrow nota"><span>IVA incluido. Envío, cupones y desglose de impuestos en el siguiente paso.</span></div>
    ${hayProblemas
      ? '<div class="alerta error" style="margin-top:10px">Ajusta las líneas marcadas para continuar.</div>'
      : '<a class="btn btn-solid btn-full" style="margin-top:14px" href="#/checkout">Tramitar pedido</a>'}
    <div class="demo-note">Tienda de demostración — no se procesan pagos reales.</div>`;
}

$('#lineasCarrito').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const l = carrito.obtener().find((x) => [b.dataset.mas, b.dataset.menos, b.dataset.quitar].includes(carrito.clave(x)));
  if (!l) return;
  const k = carrito.clave(l);
  if (b.dataset.mas) {
    const r = indiceSku.get(l.sku);
    if (r && unidadesEnCarrito(l.sku) >= r.variante.stock) return toast('No hay más unidades disponibles.', 'error');
    carrito.cambiarCantidad(k, l.cantidad + 1);
  } else if (b.dataset.menos) {
    carrito.cambiarCantidad(k, l.cantidad - 1);
  } else {
    carrito.quitar(k);
    registrar('cart.item_removed', { sku: l.sku, cantidad: l.cantidad });
  }
});
document.addEventListener('carrito:cambio', pintarCarrito);

function abrirCarrito() {
  $('#carrito').classList.add('open');
  $('#carrito').setAttribute('aria-hidden', 'false');
  $('#velo').classList.add('open');
  $('#cerrarCarrito').focus();
}
function cerrarCarrito() {
  $('#carrito').classList.remove('open');
  $('#carrito').setAttribute('aria-hidden', 'true');
  $('#velo').classList.remove('open');
}
$('#botonCarrito').addEventListener('click', () => { pintarCarrito(); abrirCarrito(); });
$('#cerrarCarrito').addEventListener('click', cerrarCarrito);
$('#velo').addEventListener('click', cerrarCarrito);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarCarrito(); });

// ====================================================================================
// Acceso a pedidos: el navegador recuerda qué email corresponde a cada pedido de esta sesión
// ====================================================================================

const CLAVE_ACCESOS = 'noctiluz_pedidos';
function accesos() {
  try { return JSON.parse(sessionStorage.getItem(CLAVE_ACCESOS) || '{}'); } catch { return {}; }
}
function guardarAcceso(codigo, email) {
  const a = accesos();
  a[codigo] = email;
  try { sessionStorage.setItem(CLAVE_ACCESOS, JSON.stringify(a)); } catch { /* sin persistencia */ }
}
const emailDe = (codigo) => accesos()[codigo] ?? null;

async function cargarPedido(codigo, destino) {
  const email = emailDe(codigo);
  if (!email) { pintarPedirEmail(codigo); return null; }
  try {
    return await api('pedidos.php', { params: { codigo, email } });
  } catch (e) {
    if (e.estado === 404) { pintarPedirEmail(codigo, e.message); return null; }
    throw e;
  }
}

function pintarPedirEmail(codigo, mensaje = '') {
  vistaPagina.innerHTML = `
    <h1 class="pagina-titulo">Pedido <span class="codigo">${esc(codigo)}</span></h1>
    <p class="pagina-sub">Por privacidad, confirma el email con el que hiciste el pedido.</p>
    <form class="bloque" id="formAcceso" style="max-width:480px; margin-top:24px" novalidate>
      ${mensaje ? `<div class="alerta error" style="margin-bottom:16px">${esc(mensaje)}</div>` : ''}
      ${campo({ nombre: 'email', etiqueta: 'Email', tipo: 'email', atributos: 'autocomplete="email" maxlength="120"' })}
      <button class="btn btn-solid btn-full" style="margin-top:16px">Ver pedido</button>
    </form>`;
  $('#formAcceso').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validarEnCliente(e.target)) return;
    guardarAcceso(codigo, e.target.email.value.trim().toLowerCase());
    enrutar();
  });
}

// ====================================================================================
// Checkout (paso 1: datos, envío, cupón y creación del pedido)
// ====================================================================================

const CLIENTES_PRUEBA = [
  { nombre: 'Lucía Ferrer (prueba)', email: 'lucia.ferrer@ejemplo.test', telefono: '600000101', linea: 'Calle Ficticia 12, 3.º B', cp: '30001', ciudad: 'Murcia', provincia: 'Murcia' },
  { nombre: 'Marcos Ibáñez (prueba)', email: 'marcos.ibanez@ejemplo.test', telefono: '600000102', linea: 'Avenida de Prueba 45', cp: '30107', ciudad: 'Guadalupe', provincia: 'Murcia' },
  { nombre: 'Sara Nieto (prueba)', email: 'sara.nieto@ejemplo.test', telefono: '600000103', linea: 'Plaza Inventada 3', cp: '30820', ciudad: 'Alcantarilla', provincia: 'Murcia' },
];

function listaErroresLineas(campos) {
  const lineas = carrito.obtener();
  return Object.entries(campos || {})
    .filter(([k]) => k.startsWith('lineas.'))
    .map(([k, msg]) => {
      const l = lineas[Number(k.split('.')[1])];
      const r = l && indiceSku.get(l.sku);
      return `<li>${r ? `${esc(r.producto.nombre)} · ${esc(r.variante.color_nombre)}: ` : ''}${esc(msg)}</li>`;
    }).join('');
}

function htmlResumen(lineas, t) {
  return `
    <div>${lineas.map((l) => {
      const r = indiceSku.get(l.sku);
      return `<div class="linea-res">
        <div class="mini">${r ? miniatura(r.producto, r.variante, l.modo) : ''}</div>
        <div class="info">${esc(l.descripcion)}<div class="meta">${esc(nombreModo(l.modo ?? l.modo_id))} · Talla ${esc(l.talla)} · ${l.cantidad} × ${eur(l.precio ?? l.precio_unitario)}</div></div>
        <div class="imp">${eur(l.importe)}</div>
      </div>`;
    }).join('')}</div>
    <div style="margin-top:16px">
      <div class="sumrow"><span>Subtotal</span><span>${eur(t.subtotal)}</span></div>
      ${t.descuento > 0 ? `<div class="sumrow descuento"><span>Descuento${t.cupon?.codigo || t.cupon_codigo ? ` (${esc(t.cupon?.codigo ?? t.cupon_codigo)})` : ''}</span><span>−${eur(t.descuento)}</span></div>` : ''}
      <div class="sumrow"><span>Envío</span><span>${t.envio === 0 ? 'Gratis' : eur(t.envio)}</span></div>
      <div class="sumrow total"><span>Total</span><span>${eur(t.total)}</span></div>
      <div class="sumrow nota"><span>Base imponible ${eur(t.base_imponible)} + IVA 21 % ${eur(t.iva)}</span></div>
      ${t.falta_envio_gratis > 0 ? `<div class="sumrow nota"><span>Añade ${eur(t.falta_envio_gratis)} más para tener envío estándar gratis.</span></div>` : ''}
    </div>`;
}

async function vistaCheckout() {
  await listo;
  if (!carrito.obtener().length) {
    vistaPagina.innerHTML = `<h1 class="pagina-titulo">Tu carrito está vacío</h1>
      <p class="pagina-sub">Añade algún producto para poder finalizar la compra.</p>
      <a class="btn btn-solid" style="margin-top:24px" href="#/catalogo">Ver la colección</a>`;
    return;
  }
  registrar('checkout.started', { lineas: carrito.obtener().length, unidades: carrito.unidades(), subtotal: subtotalLocal() });
  document.title = 'Finalizar compra — NOCTILUZ';

  vistaPagina.innerHTML = `
    <a href="#/catalogo" class="volver">← Seguir comprando</a>
    <h1 class="pagina-titulo">Finalizar compra</h1>
    <p class="pagina-sub">Paso 1 de 2 · Datos y envío. En el siguiente paso simularás el pago.</p>
    <div class="dos-col">
      <form id="formCheckout" novalidate>
        <div class="bloque">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:16px">
            <h2 style="margin:0">Datos de contacto</h2>
            <button type="button" class="btn btn-outline btn-sm" id="rellenarPrueba">Rellenar con datos de prueba</button>
          </div>
          <div class="form-grid">
            ${campo({ nombre: 'nombre', etiqueta: 'Nombre y apellidos', completo: true, atributos: 'minlength="3" maxlength="100" autocomplete="name"' })}
            ${campo({ nombre: 'email', etiqueta: 'Email', tipo: 'email', atributos: 'maxlength="120" autocomplete="email"', ayuda: 'Usa un email de prueba, p. ej. nombre@ejemplo.test' })}
            ${campo({ nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', requerido: false, atributos: 'maxlength="15" autocomplete="tel" pattern="(\\+34)?[\\s.\\-]?[6789]([\\s.\\-]?\\d){8}" data-mensaje="El teléfono debe ser un número español de 9 cifras."' })}
          </div>
        </div>
        <div class="bloque">
          <h2>Dirección de envío</h2>
          <div class="form-grid">
            ${campo({ nombre: 'linea', etiqueta: 'Dirección', completo: true, atributos: 'minlength="5" maxlength="160" autocomplete="street-address"' })}
            ${campo({ nombre: 'cp', etiqueta: 'Código postal', atributos: 'inputmode="numeric" maxlength="5" pattern="(0[1-9]|[1-4]\\d|5[0-2])\\d{3}" autocomplete="postal-code" data-mensaje="El código postal debe tener 5 cifras y ser de España."' })}
            ${campo({ nombre: 'ciudad', etiqueta: 'Ciudad', atributos: 'minlength="2" maxlength="80" autocomplete="address-level2"' })}
            ${campo({ nombre: 'provincia', etiqueta: 'Provincia', completo: true, atributos: 'minlength="2" maxlength="80" autocomplete="address-level1"' })}
          </div>
        </div>
        <div class="bloque">
          <h2>Método de envío</h2>
          <p class="pista" id="zonaEnvio" style="margin:-4px 0 12px">Precios para la Península. Se ajustan al escribir el código postal.</p>
          <div style="display:grid; gap:10px">
            <label class="opcion-radio"><input type="radio" name="envio" value="estandar" checked>
              <span>Estándar · <span data-plazo="estandar">48-72 h</span><br><small class="campo-ayuda">Gratis desde <span data-gratis>${eur(estado.catalogo.reglas.umbral_envio_gratis)}</span></small></span>
              <span class="precio" data-precio="estandar">${eur(estado.catalogo.reglas.envio_estandar)}</span></label>
            <label class="opcion-radio"><input type="radio" name="envio" value="expres">
              <span>Exprés · <span data-plazo="expres">24 h</span><br><small class="campo-ayuda">Nunca es gratis</small></span><span class="precio" data-precio="expres">${eur(estado.catalogo.reglas.envio_expres)}</span></label>
          </div>
          <small class="campo-error" data-error-de="envio"></small>
          <p class="pista">No enviamos a ${esc(new Intl.ListFormat('es').format(estado.catalogo.reglas.sin_envio))}. Tienes la política completa en «Envíos y devoluciones», al pie de la página.</p>
        </div>
        <div class="bloque">
          <label class="check"><input type="checkbox" name="acepta_condiciones" required data-mensaje="Debes aceptar las condiciones del prototipo para continuar.">
            <span>Entiendo que NOCTILUZ es un <strong>prototipo académico</strong>: el pedido es simulado, no se cobrará nada ni se enviará ningún producto, y los datos que introduzco son de prueba.</span></label>
          <small class="campo-error" data-error-de="acepta_condiciones"></small>
        </div>
        <div id="erroresCheckout" role="alert" style="margin-top:18px"></div>
        <button class="btn btn-solid btn-full" type="submit" id="confirmar" style="margin-top:18px">Confirmar pedido y pasar al pago</button>
      </form>
      <aside class="bloque pegajoso" aria-label="Resumen del pedido">
        <h2>Resumen</h2>
        <div id="resumen"><div class="cargando" style="padding:30px 0">Calculando…</div></div>
        <div style="margin-top:18px; padding-top:16px; border-top:1px solid var(--border-soft)">
          <label class="etiqueta" for="cupon">Cupón de descuento</label>
          <div class="cupon-fila" style="margin-top:6px">
            <input class="input" id="cupon" maxlength="20" placeholder="Código" autocomplete="off">
            <button type="button" class="btn btn-outline btn-sm" id="aplicarCupon">Aplicar</button>
          </div>
          <small class="campo-error" id="errorCupon" role="alert"></small>
          <p class="pista">Cupones de prueba: <code>NOCHE10</code>, <code>BIENVENIDA5</code>, <code>ENVIOGRATIS</code> (y <code>VERANO25</code>, caducado).</p>
        </div>
      </aside>
    </div>`;

  const form = $('#formCheckout');
  const boton = $('#confirmar');
  let cuponAplicado = '';

  // Los portes dependen de la zona del código postal: los precios de las opciones salen del servidor.
  function pintarTarifas(t) {
    for (const m of ['estandar', 'expres']) {
      form.querySelector(`[data-precio="${m}"]`).textContent = eur(t.tarifas[m].precio);
      form.querySelector(`[data-plazo="${m}"]`).textContent = t.tarifas[m].plazo;
    }
    form.querySelector('[data-gratis]').textContent = eur(t.tarifas.gratis_desde);
    $('#zonaEnvio').textContent = /^\d{5}$/.test(form.cp.value) ? `Envío a ${t.zona.nombre}.` : 'Precios para la Península. Se ajustan al escribir el código postal.';
  }

  async function recalcular() {
    $('#errorCupon').textContent = '';
    try {
      const cp = /^\d{5}$/.test(form.cp.value) ? form.cp.value : '';
      const r = await api('presupuesto.php', { method: 'POST', body: { lineas: carrito.obtener(), cupon: cuponAplicado, envio: form.envio.value, cp } });
      pintarTarifas(r.totales);
      if (r.totales.cupon_error) {
        $('#errorCupon').textContent = r.totales.cupon_error;
        cuponAplicado = '';
      } else if (r.totales.cupon) {
        $('#errorCupon').innerHTML = `<span style="color:var(--ok)">Cupón aplicado: ${esc(r.totales.cupon.descripcion)}</span>`;
      }
      $('#resumen').innerHTML = htmlResumen(r.lineas, r.totales);
      boton.disabled = false;
    } catch (e) {
      // Un código postal sin envío no es un problema del carrito: se avisa junto al método de envío.
      if (e.campos?.cp) {
        $('#zonaEnvio').textContent = e.campos.cp;
        $('#resumen').innerHTML = `<div class="alerta error">${esc(e.message)}</div>`;
      } else {
        $('#resumen').innerHTML = `<div class="alerta error">${esc(e.message)}<ul>${listaErroresLineas(e.campos)}</ul>
          <button type="button" class="enlace" data-abrir-carrito style="margin-top:8px">Revisar el carrito</button></div>`;
      }
      boton.disabled = true;
    }
  }

  form.addEventListener('change', (e) => { if (e.target.name === 'envio') recalcular(); });
  let cpAnterior = '';
  form.cp.addEventListener('input', () => {
    const cp = /^\d{5}$/.test(form.cp.value) ? form.cp.value : '';
    if (cp !== cpAnterior) { cpAnterior = cp; recalcular(); }
  });
  $('#aplicarCupon').addEventListener('click', () => { cuponAplicado = $('#cupon').value.trim().toUpperCase(); recalcular(); });
  $('#cupon').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#aplicarCupon').click(); } });
  $('#resumen').addEventListener('click', (e) => { if (e.target.closest('[data-abrir-carrito]')) abrirCarrito(); });
  // Con la sesión iniciada, el nombre y el email son los de la cuenta y el email no se puede cambiar:
  // el servidor asigna el pedido a la cuenta, así que aparece en «Mi cuenta».
  let cuenta = null;
  api('cuenta.php').then((r) => {
    if (!r.cliente) return;
    cuenta = r.cliente;
    form.nombre.value ||= cuenta.nombre;
    form.email.value = cuenta.email;
    form.email.readOnly = true;
    form.email.closest('.campo')?.querySelector('.campo-ayuda')?.replaceChildren('Compras con tu cuenta: el pedido aparecerá en «Mi cuenta».');
  }).catch(() => {});
  $('#rellenarPrueba').addEventListener('click', () => {
    const c = CLIENTES_PRUEBA[Math.floor(Math.random() * CLIENTES_PRUEBA.length)];
    for (const [k, v] of Object.entries(c)) {
      // Con cuenta, se rellenan la dirección y el teléfono de prueba, pero se mantienen su nombre y su email.
      if (cuenta && (k === 'nombre' || k === 'email')) continue;
      form.elements[k].value = v;
    }
    form.cp.dispatchEvent(new Event('input'));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#erroresCheckout').innerHTML = '';
    if (!validarEnCliente(form)) return;
    const d = Object.fromEntries(new FormData(form));
    const email = d.email.trim().toLowerCase();
    boton.disabled = true;
    boton.textContent = 'Creando pedido…';
    try {
      const r = await api('pedidos.php', {
        method: 'POST',
        body: {
          cliente: { nombre: d.nombre, email, telefono: d.telefono },
          direccion: { linea: d.linea, cp: d.cp, ciudad: d.ciudad, provincia: d.provincia },
          envio: d.envio,
          cupon: cuponAplicado,
          lineas: carrito.obtener(),
          sesion_id: sesionId(),
          acepta_condiciones: form.acepta_condiciones.checked,
        },
      });
      guardarAcceso(r.codigo, email);
      carrito.vaciar();
      cargarCatalogo().then(pintarCatalogo).catch(() => {});
      toast(`Pedido ${r.codigo} creado`);
      location.hash = '#/pago/' + r.codigo;
    } catch (err) {
      boton.disabled = false;
      boton.textContent = 'Confirmar pedido y pasar al pago';
      mostrarErrores(form, err.campos);
      if (err.campos?.cupon) { $('#errorCupon').textContent = err.campos.cupon; cuponAplicado = ''; }
      $('#erroresCheckout').innerHTML = `<div class="alerta error">${esc(err.message)}<ul>${listaErroresLineas(err.campos)}</ul></div>`;
    }
  });

  recalcular();
}

// ====================================================================================
// Pago simulado (paso 2)
// ====================================================================================

const TARJETAS_PRUEBA = [
  ['4242 4242 4242 4242', 'Visa de prueba', 'Aprobado'],
  ['5555 5555 5555 4444', 'Mastercard de prueba', 'Aprobado'],
  ['4000 0000 0000 0002', 'Fondos insuficientes', 'Rechazado'],
  ['4000 0000 0000 0069', 'Tarjeta caducada', 'Rechazado'],
];

async function vistaPago(codigo) {
  await listo;
  const p = await cargarPedido(codigo);
  if (!p) return;
  if (p.estado !== 'creado') { location.replace('#/pedido/' + codigo); return; }
  document.title = 'Pago simulado — NOCTILUZ';

  vistaPagina.innerHTML = `
    <h1 class="pagina-titulo">Pago simulado</h1>
    <p class="pagina-sub">Paso 2 de 2 · Tu pedido <span class="codigo">${esc(codigo)}</span> está creado y pendiente de pago.</p>
    <div class="dos-col">
      <form id="formPago" class="bloque" novalidate>
        <div class="pasarela-cabecera"><h2 style="margin:0">Pago con tarjeta</h2><span>Entorno de pruebas</span></div>
        <div class="alerta" style="margin-bottom:18px">Pasarela simulada: solo acepta las tarjetas de prueba de la tabla. No se guarda el número completo, solo sus 4 últimas cifras.</div>
        <div class="form-grid">
          ${campo({ nombre: 'titular', etiqueta: 'Titular', completo: true, atributos: 'minlength="3" maxlength="80" autocomplete="off"' })}
          ${campo({ nombre: 'numero', etiqueta: 'Número de tarjeta de prueba', completo: true, atributos: 'inputmode="numeric" maxlength="23" autocomplete="off" placeholder="4242 4242 4242 4242" pattern="[\\d ]{13,23}" data-mensaje="Introduce una de las tarjetas de prueba."' })}
          ${campo({ nombre: 'caducidad', etiqueta: 'Caducidad', atributos: 'inputmode="numeric" maxlength="5" autocomplete="off" placeholder="MM/AA" pattern="(0[1-9]|1[0-2])/\\d{2}" data-mensaje="Usa el formato MM/AA."' })}
          ${campo({ nombre: 'cvc', etiqueta: 'CVC', atributos: 'inputmode="numeric" maxlength="3" autocomplete="off" placeholder="123" pattern="\\d{3}" data-mensaje="El CVC son 3 cifras."' })}
        </div>
        <div id="resultadoPago" role="alert" style="margin-top:16px">${p.pagos.at(-1)?.resultado === 'rechazado'
          ? `<div class="alerta error"><strong>Último intento rechazado:</strong> ${esc(p.pagos.at(-1).mensaje)}. Puedes volver a intentarlo.</div>` : ''}</div>
        <button class="btn btn-solid btn-full" style="margin-top:18px" id="pagar">Pagar ${eur(p.total)} (simulado)</button>
        <button type="button" class="btn btn-peligro btn-full" style="margin-top:10px" id="cancelarPedido">Cancelar pedido</button>
      </form>
      <aside class="pegajoso">
        ${estado.catalogo.reglas.paypal ? `<div class="bloque">
          <div class="pasarela-cabecera"><h2 style="margin:0">PayPal</h2><span>Sandbox</span></div>
          <p class="pista" style="margin-bottom:14px">Pasarela real en su entorno de pruebas: inicia sesión con una <strong>cuenta personal de prueba</strong> de PayPal sandbox. No se mueve dinero real.</p>
          <button type="button" class="btn btn-outline btn-full" id="pagarPaypal">Pagar ${eur(p.total)} con PayPal (sandbox)</button>
          <div id="resultadoPaypal" role="alert" style="margin-top:10px"></div>
        </div>` : ''}
        <div class="bloque">
          <h2>Tarjetas de prueba</h2>
          <table class="tabla-pruebas"><tbody>${TARJETAS_PRUEBA.map(([n, d, r]) => `
            <tr><td><code>${n}</code><br>${d}</td><td><span class="estado estado-${r === 'Aprobado' ? 'aprobado' : 'rechazado'}">${r}</span><br>
            <button type="button" class="enlace" data-tarjeta="${n}" style="margin-top:6px">Usar</button></td></tr>`).join('')}</tbody></table>
          <p class="pista">Caducidad: cualquier fecha futura (p. ej. 12/30). CVC: cualquier número de 3 cifras.</p>
        </div>
        <div class="bloque">
          <h2>Tu pedido</h2>
          ${htmlResumen(p.lineas, p)}
        </div>
      </aside>
    </div>`;

  const form = $('#formPago');
  const email = emailDe(codigo);

  form.numero.addEventListener('input', () => {
    form.numero.value = form.numero.value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
  });
  form.caducidad.addEventListener('input', (e) => {
    const d = form.caducidad.value.replace(/\D/g, '').slice(0, 4);
    form.caducidad.value = d.length > 2 || (d.length === 2 && e.inputType !== 'deleteContentBackward') ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  });
  vistaPagina.querySelectorAll('[data-tarjeta]').forEach((b) => b.addEventListener('click', () => {
    form.numero.value = b.dataset.tarjeta;
    form.caducidad.value ||= '12/30';
    form.cvc.value ||= '123';
    form.titular.value ||= p.cliente_nombre;
    form.numero.focus();
  }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#resultadoPago').innerHTML = '';
    if (!validarEnCliente(form)) return;
    const boton = $('#pagar');
    boton.disabled = true;
    boton.textContent = 'Procesando pago simulado…';
    try {
      const r = await api('pagos.php', {
        method: 'POST',
        body: { codigo, email, titular: form.titular.value, numero: form.numero.value, caducidad: form.caducidad.value, cvc: form.cvc.value },
      });
      if (r.resultado === 'aprobado') {
        toast('Pago simulado aprobado');
        location.hash = '#/pedido/' + codigo;
        return;
      }
      $('#resultadoPago').innerHTML = `<div class="alerta error"><strong>${esc(r.mensaje)}.</strong> El intento ha quedado registrado (ref. <span class="codigo">${esc(r.referencia)}</span>). Puedes probar con otra tarjeta de prueba.</div>`;
    } catch (err) {
      mostrarErrores(form, err.campos);
      $('#resultadoPago').innerHTML = `<div class="alerta error">${esc(err.message)}</div>`;
    }
    boton.disabled = false;
    boton.textContent = `Pagar ${eur(p.total)} (simulado)`;
  });

  $('#cancelarPedido').addEventListener('click', () => cancelarPedido(codigo, email));

  // PayPal: el servidor crea la orden por el total del pedido y devuelve la página de PayPal donde aprobarla.
  $('#pagarPaypal')?.addEventListener('click', async (e) => {
    const boton = e.currentTarget;
    boton.disabled = true;
    boton.textContent = 'Conectando con PayPal…';
    try {
      const r = await api('paypal.php', { method: 'POST', body: { accion: 'crear', codigo, email } });
      location.href = r.url;
    } catch (err) {
      $('#resultadoPaypal').innerHTML = `<div class="alerta error">${esc(err.message)}</div>`;
      boton.disabled = false;
      boton.textContent = `Pagar ${eur(p.total)} con PayPal (sandbox)`;
    }
  });
}

/** Texto de un intento de pago: tarjeta de prueba (últimas cifras) o PayPal. */
const metodoPago = (g) => (g.metodo === 'paypal_sandbox' ? 'PayPal (sandbox)' : `•••• ${esc(g.tarjeta_ultimos4)}`);

async function cancelarPedido(codigo, email) {
  if (!confirm(`¿Seguro que quieres cancelar el pedido ${codigo}? Las unidades volverán al stock.`)) return;
  try {
    await api('pedidos.php', { method: 'POST', body: { accion: 'cancelar', codigo, email } });
    toast('Pedido cancelado');
    await cargarCatalogo();
    pintarCatalogo();
    location.hash = '#/pedido/' + codigo;
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ====================================================================================
// Detalle y seguimiento del pedido
// ====================================================================================

async function vistaPedido(codigo) {
  await listo;
  const p = await cargarPedido(codigo);
  if (!p) return;
  document.title = `Pedido ${codigo} — NOCTILUZ`;
  const ultimoPago = p.pagos.at(-1);

  vistaPagina.innerHTML = `
    ${p.estado === 'pagado' ? `<div class="bloque exito" style="margin-bottom:28px">
      <div class="icono" aria-hidden="true">✓</div>
      <h2 style="font-size:1.3rem; margin-bottom:8px">¡Pedido confirmado!</h2>
      <p style="color:var(--ink-dim)">Pago aprobado${p.factura?.estado_envio === 'enviada' ? ` y factura ${esc(p.factura.numero)} enviada a ${esc(p.cliente_email)}` : ''}. Recuerda que es un prototipo: no recibirás ningún paquete.</p>
    </div>` : ''}
    <div class="pedido-cab">
      <h1 class="pagina-titulo">Pedido <span class="codigo">${esc(p.codigo)}</span></h1>
      <span class="estado estado-${esc(p.estado)}">${esc(p.estado_nombre)}</span>
    </div>
    <p class="pagina-sub">Realizado el ${fecha(p.creado_en)} · ${esc(p.cliente_nombre)} · ${esc(p.cliente_email)}</p>
    <div class="dos-col">
      <div>
        <div class="bloque"><h2>Productos</h2>${htmlResumen(p.lineas, p)}</div>
        <div class="bloque"><h2>Seguimiento</h2>
          <ol class="linea-tiempo">${p.historial.map((h) => `<li><strong>${esc(nombreEstado(h.estado_nuevo))}</strong>${h.motivo ? ` · ${esc(h.motivo)}` : ''}<time>${fecha(h.creado_en)}</time></li>`).join('')}</ol>
        </div>
      </div>
      <aside class="pegajoso">
        <div class="bloque"><h2>Envío</h2>
          <p style="color:var(--ink-dim); font-size:.9rem">${esc(p.dir_linea)}<br>${esc(p.dir_cp)} ${esc(p.dir_ciudad)} (${esc(p.dir_provincia)})<br>${esc(p.metodo_envio_nombre)}</p>
        </div>
        <div class="bloque"><h2>Pagos</h2>
          ${p.pagos.length ? p.pagos.map((g) => `<div class="sumrow"><span>${fecha(g.creado_en)} · ${metodoPago(g)}</span><span class="estado estado-${esc(g.resultado)}">${esc(g.resultado)}</span></div>`).join('')
            : '<p class="pista">Todavía no hay ningún intento de pago.</p>'}
          ${ultimoPago?.resultado === 'rechazado' && p.estado === 'creado' ? `<p class="pista">Último intento: ${esc(ultimoPago.mensaje)}</p>` : ''}
        </div>
        ${p.factura ? `<div class="bloque"><h2>Factura</h2>
          <div class="sumrow"><span><span class="codigo">${esc(p.factura.numero)}</span> · ${fecha(p.factura.emitida_en)}</span>
            <span class="estado ${p.factura.estado_envio === 'enviada' ? 'estado-aprobado' : 'estado-rechazado'}">${p.factura.estado_envio === 'enviada' ? 'enviada por email' : 'pendiente de envío'}</span></div>
          <a class="btn btn-outline btn-sm" style="margin-top:10px" target="_blank" rel="noopener"
            href="api/factura.php?codigo=${encodeURIComponent(p.codigo)}&email=${encodeURIComponent(p.cliente_email)}">Ver factura</a>
        </div>` : ''}
        <div class="acciones">
          ${p.estado === 'creado' ? `<a class="btn btn-solid" href="#/pago/${esc(p.codigo)}">Pagar ahora</a><button type="button" class="btn btn-peligro" id="cancelar">Cancelar</button>` : ''}
          <a class="btn btn-outline" href="#/soporte?pedido=${esc(p.codigo)}">¿Algún problema?</a>
        </div>
      </aside>
    </div>`;
  $('#cancelar')?.addEventListener('click', () => cancelarPedido(codigo, emailDe(codigo)));
}

const ESTADOS = {
  creado: 'Pedido creado', pagado: 'Pagado', en_preparacion: 'Pendiente de preparación',
  enviado: 'Enviado', entregado: 'Entregado', incidencia: 'Con incidencia', cancelado: 'Cancelado',
};
const nombreEstado = (e) => ESTADOS[e] ?? e;

function vistaSeguimiento() {
  document.title = 'Mis pedidos — NOCTILUZ';
  const recientes = Object.keys(accesos());
  vistaPagina.innerHTML = `
    <h1 class="pagina-titulo">Seguimiento de pedido</h1>
    <p class="pagina-sub">Introduce el código de pedido (lo verás al finalizar la compra) y el email con el que lo hiciste.</p>
    <div class="dos-col">
      <form class="bloque" id="formSeguimiento" novalidate>
        <div class="form-grid">
          ${campo({ nombre: 'codigo', etiqueta: 'Código de pedido', completo: true, atributos: 'maxlength="20" placeholder="NCZ-AAMMDD-XXXXXX" pattern="[Nn][Cc][Zz]-\\d{6}-[A-Za-z0-9]{6}" data-mensaje="El código tiene el formato NCZ-AAMMDD-XXXXXX." autocomplete="off"' })}
          ${campo({ nombre: 'email', etiqueta: 'Email', tipo: 'email', completo: true, atributos: 'maxlength="120" autocomplete="email"' })}
        </div>
        <button class="btn btn-solid btn-full" style="margin-top:18px">Consultar pedido</button>
        <p class="pista" style="margin-top:14px">Pedido de ejemplo: <code>NCZ-260920-A7K2QD</code> con <code>lucia.ferrer@ejemplo.test</code></p>
      </form>
      <div class="bloque">
        <h2>Pedidos de esta sesión</h2>
        ${recientes.length ? recientes.map((c) => `<p style="margin-bottom:8px"><a class="enlace codigo" href="#/pedido/${esc(c)}">${esc(c)}</a></p>`).join('')
          : '<p class="pista">Aún no has hecho ningún pedido en esta sesión del navegador.</p>'}
      </div>
    </div>`;
  $('#formSeguimiento').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    if (!validarEnCliente(f)) return;
    const codigo = f.codigo.value.trim().toUpperCase();
    guardarAcceso(codigo, f.email.value.trim().toLowerCase());
    location.hash = '#/pedido/' + codigo;
  });
}

// ====================================================================================
// Mi cuenta: inicio de sesión, registro, pedidos e incidencias con la respuesta del equipo
// ====================================================================================

async function vistaCuenta() {
  document.title = 'Mi cuenta — NOCTILUZ';
  const r = await api('cuenta.php');
  if (!r.cliente) { pintarAccesoCuenta(); return; }
  // Así los enlaces a sus pedidos se abren sin volver a pedir el email.
  r.pedidos.forEach((p) => guardarAcceso(p.codigo, r.cliente.email));

  vistaPagina.innerHTML = `
    <div class="pedido-cab">
      <h1 class="pagina-titulo">Hola, ${esc(r.cliente.nombre)}</h1>
      <button type="button" class="btn btn-outline btn-sm" id="cerrarSesion">Cerrar sesión</button>
    </div>
    <p class="pagina-sub">${esc(r.cliente.email)}</p>
    <div class="dos-col">
      <div class="bloque"><h2>Mis pedidos</h2>
        ${r.pedidos.length ? r.pedidos.map((p) => `<div class="sumrow">
            <span><a class="enlace codigo" href="#/pedido/${esc(p.codigo)}">${esc(p.codigo)}</a><br><small class="campo-ayuda">${fecha(p.creado_en)} · ${eur(p.total)}</small></span>
            <span class="estado estado-${esc(p.estado)}">${esc(p.estado_nombre)}</span></div>`).join('')
          : '<p class="pista">Todavía no has hecho ningún pedido con este email. <a class="enlace" href="#/catalogo">Ver la colección</a></p>'}
      </div>
      <div class="bloque"><h2>Mis incidencias</h2>
        ${r.incidencias.length ? r.incidencias.map((i) => `<div class="incidencia-cliente">
            <div class="sumrow"><span><strong class="codigo">${esc(i.codigo)}</strong> · ${esc(i.motivo_nombre)}</span><span class="estado estado-${esc(i.estado)}">${esc(i.estado)}</span></div>
            <p class="campo-ayuda">${fecha(i.creado_en)}${i.pedido_codigo ? ` · pedido ${esc(i.pedido_codigo)}` : ''}</p>
            <p>${esc(i.mensaje)}</p>
            ${i.respuesta ? `<div class="respuesta-equipo"><strong>Respuesta del equipo</strong> · <small>${fecha(i.respondida_en)}</small><p>${esc(i.respuesta)}</p></div>`
              : '<p class="pista">Pendiente de respuesta.</p>'}
          </div>`).join('')
          : '<p class="pista">No has abierto ninguna incidencia. <a class="enlace" href="#/soporte">Ir a soporte</a></p>'}
      </div>
    </div>`;
  $('#cerrarSesion').addEventListener('click', async () => {
    await api('cuenta.php', { method: 'DELETE' }).catch(() => {});
    toast('Has cerrado sesión');
    enrutar();
  });
}

function pintarAccesoCuenta() {
  vistaPagina.innerHTML = `
    <h1 class="pagina-titulo">Mi cuenta</h1>
    <p class="pagina-sub">Inicia sesión o crea una cuenta para ver tus pedidos, las respuestas a tus incidencias y añadir reseñas.</p>
    <div class="dos-col">
      <form class="bloque" id="formLogin" novalidate>
        <h2>Iniciar sesión</h2>
        <div class="form-grid">
          ${campo({ nombre: 'email', id: 'l-email', etiqueta: 'Email', tipo: 'email', completo: true, atributos: 'maxlength="120" autocomplete="email"' })}
          ${campo({ nombre: 'clave', id: 'l-clave', etiqueta: 'Contraseña', tipo: 'password', completo: true, atributos: 'maxlength="100" autocomplete="current-password"' })}
        </div>
        <div class="error-form" role="alert" style="margin-top:14px"></div>
        <button class="btn btn-solid btn-full" style="margin-top:16px">Entrar</button>
      </form>
      <form class="bloque" id="formRegistro" novalidate>
        <h2>Crear cuenta</h2>
        <div class="form-grid">
          ${campo({ nombre: 'nombre', id: 'r-nombre', etiqueta: 'Nombre y apellidos', completo: true, atributos: 'minlength="3" maxlength="100" autocomplete="name"' })}
          ${campo({ nombre: 'email', id: 'r-email', etiqueta: 'Email', tipo: 'email', completo: true, atributos: 'maxlength="120" autocomplete="email"', ayuda: 'Usa un email de prueba. Si ya compraste con él, verás esos pedidos.' })}
          ${campo({ nombre: 'clave', id: 'r-clave', etiqueta: 'Contraseña', tipo: 'password', completo: true, atributos: 'minlength="8" maxlength="100" autocomplete="new-password" data-mensaje="La contraseña debe tener al menos 8 caracteres."', ayuda: 'Mínimo 8 caracteres. No uses una contraseña real.' })}
        </div>
        <div class="error-form" role="alert" style="margin-top:14px"></div>
        <button class="btn btn-solid btn-full" style="margin-top:16px">Crear cuenta</button>
      </form>
    </div>`;

  const enviar = (form, accion) => form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hueco = form.querySelector('.error-form');
    hueco.innerHTML = '';
    if (!validarEnCliente(form)) return;
    const boton = form.querySelector('button');
    boton.disabled = true;
    try {
      await api('cuenta.php', { method: 'POST', body: { accion, ...Object.fromEntries(new FormData(form)), sesion_id: sesionId() } });
      toast(accion === 'registro' ? '¡Cuenta creada!' : 'Sesión iniciada');
      enrutar();
    } catch (err) {
      boton.disabled = false;
      mostrarErrores(form, err.campos);
      hueco.innerHTML = `<div class="alerta error">${esc(err.message)}</div>`;
    }
  });
  enviar($('#formLogin'), 'login');
  enviar($('#formRegistro'), 'registro');
}

// ====================================================================================
// Soporte e incidencias
// ====================================================================================

async function vistaSoporte(pedidoPrevio = '') {
  document.title = 'Soporte — NOCTILUZ';
  const { motivos } = await api('soporte.php');
  const emailPrevio = pedidoPrevio ? emailDe(pedidoPrevio) ?? '' : '';
  vistaPagina.innerHTML = `
    <h1 class="pagina-titulo">Soporte e incidencias</h1>
    <p class="pagina-sub">¿Dudas con un pedido, un envío o una prenda que no se enciende? Cuéntanoslo y el equipo lo verá en el back-office.</p>
    <div class="dos-col">
      <form class="bloque" id="formSoporte" novalidate>
        <div class="form-grid">
          ${campo({ nombre: 'nombre', etiqueta: 'Nombre', atributos: 'minlength="3" maxlength="100" autocomplete="name"' })}
          ${campo({ nombre: 'email', etiqueta: 'Email', tipo: 'email', valor: emailPrevio, atributos: 'maxlength="120" autocomplete="email"' })}
          ${campo({ nombre: 'pedido', etiqueta: 'Código de pedido', requerido: false, valor: pedidoPrevio, atributos: 'maxlength="20" placeholder="NCZ-AAMMDD-XXXXXX" pattern="[Nn][Cc][Zz]-\\d{6}-[A-Za-z0-9]{6}" data-mensaje="El código tiene el formato NCZ-AAMMDD-XXXXXX." autocomplete="off"' })}
          <div class="campo">
            <label for="f-motivo">Motivo</label>
            <select id="f-motivo" name="motivo" required data-mensaje="Elige un motivo.">
              <option value="">Elige un motivo…</option>
              ${Object.entries(motivos).map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`).join('')}
            </select>
            <small class="campo-error" data-error-de="motivo" role="alert"></small>
          </div>
          <div class="campo completo">
            <label for="f-mensaje">Mensaje</label>
            <textarea id="f-mensaje" name="mensaje" required minlength="10" maxlength="1000" data-mensaje="Cuéntanos el problema (mínimo 10 caracteres)."></textarea>
            <small class="campo-ayuda" id="contadorMensaje">0 / 1000</small>
            <small class="campo-error" data-error-de="mensaje" role="alert"></small>
          </div>
        </div>
        <div id="errorSoporte" role="alert" style="margin-top:14px"></div>
        <button class="btn btn-solid btn-full" style="margin-top:18px" id="enviarSoporte">Enviar solicitud</button>
      </form>
      <div class="bloque">
        <h2>Antes de escribirnos</h2>
        <p class="pista" style="font-size:.86rem">· Si tu prenda no se enciende, carga el módulo por USB-C al menos 2 h.<br>
        · Puedes consultar el estado de tu pedido en <a class="enlace" href="#/seguimiento">Mis pedidos</a>.<br>
        · Es un prototipo: las solicitudes no llegan a nadie de fuera del equipo del proyecto.</p>
      </div>
    </div>`;

  const f = $('#formSoporte');
  f.mensaje.addEventListener('input', () => { $('#contadorMensaje').textContent = `${f.mensaje.value.length} / 1000`; });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#errorSoporte').innerHTML = '';
    if (!validarEnCliente(f)) return;
    const d = Object.fromEntries(new FormData(f));
    const boton = $('#enviarSoporte');
    boton.disabled = true;
    try {
      const r = await api('soporte.php', { method: 'POST', body: { ...d, sesion_id: sesionId() } });
      vistaPagina.innerHTML = `<div class="bloque exito" style="max-width:560px; margin:40px auto">
        <div class="icono" aria-hidden="true">✓</div>
        <h1 class="pagina-titulo" style="font-size:1.4rem">Solicitud registrada</h1>
        <p style="color:var(--ink-dim); margin-top:10px">Tu número de incidencia es <strong class="codigo">${esc(r.codigo)}</strong>. El equipo la revisará desde el back-office.</p>
        <a class="btn btn-outline" style="margin-top:22px" href="#/">Volver a la tienda</a></div>`;
    } catch (err) {
      boton.disabled = false;
      mostrarErrores(f, err.campos);
      $('#errorSoporte').innerHTML = `<div class="alerta error">${esc(err.message)}</div>`;
    }
  });
}

// ====================================================================================
// Aviso de prototipo, envíos y privacidad
// ====================================================================================

async function vistaLegal(seccion) {
  await listo;
  document.title = 'Aviso de prototipo — NOCTILUZ';
  vistaPagina.innerHTML = `
    <div class="legal">
      <h1 class="pagina-titulo">Sobre este prototipo</h1>
      <section id="aviso">
        <h2>Prototipo académico sin actividad comercial</h2>
        <p>NOCTILUZ es una tienda ficticia desarrollada como Tarea 1 de la asignatura <em>Soluciones Informáticas para la Empresa</em> del Grado en Ingeniería Informática de la UCAM. No es una empresa real, no vende nada, no cobra y no envía productos.</p>
        <p>Los precios, reseñas, stock y valoraciones son datos de prueba inventados para que el flujo de compra sea realista.</p>
      </section>
      <section id="equipo">
        <h2>Equipo</h2>
        <ul><li>Luis Galindo Buendia</li><li>Roberto Ciller Miñana</li><li>Javier Zamora Lopez</li><li>JunJie Yang Jao</li></ul>
      </section>
      <section id="envios">
        <h2>Condiciones comerciales simuladas</h2>
        <ul>
          <li>Precios con IVA (21 %) incluido; en cada pedido se desglosan base imponible e IVA.</li>
          <li>Los portes dependen de la zona del código postal de entrega:</li>
        </ul>
        <div class="tabla-wrap"><table class="tabla-pruebas">
          <thead><tr><th>Zona</th><th>Estándar</th><th>Gratis desde</th><th>Exprés</th></tr></thead>
          <tbody>${estado.catalogo.reglas.zonas_envio.map((z) => `<tr><td>${esc(z.nombre)}</td>
            <td>${eur(z.estandar.precio)} · ${esc(z.estandar.plazo)}</td><td>${eur(z.gratis_desde)}</td>
            <td>${eur(z.expres.precio)} · ${esc(z.expres.plazo)}</td></tr>`).join('')}</tbody>
        </table></div>
        <ul>
          <li>El envío gratis se calcula tras aplicar los descuentos y solo cuenta para el envío estándar; el exprés nunca es gratuito.</li>
          <li>No enviamos a ${esc(new Intl.ListFormat('es').format(estado.catalogo.reglas.sin_envio))}: allí no se aplica el IVA, sino el IGIC o el IPSI, y nuestros precios llevan el IVA incluido.</li>
          <li>Cupones de prueba: NOCHE10 (10 % desde 50 €), BIENVENIDA5 (5 € desde 30 €) y ENVIOGRATIS (envío estándar gratis en cualquier zona).</li>
          <li>Máximo 9 unidades por línea y nunca más que el stock disponible.</li>
          <li>Devoluciones: 30 días desde la entrega (política simulada; se solicitan desde Soporte).</li>
        </ul>
      </section>
      <section id="privacidad">
        <h2>Datos y privacidad</h2>
        <p>Usa solo datos de prueba (por ejemplo, emails @ejemplo.test). Los datos del formulario se guardan en la base de datos del prototipo para poder demostrar el flujo de pedido y se pueden borrar en cualquier momento.</p>
        <p>El pago es simulado: solo se aceptan tarjetas de prueba y únicamente se guardan sus 4 últimas cifras.</p>
        <p>Para analizar el proceso de compra se registran eventos anónimos (producto visto, añadido al carrito, checkout iniciado, pedido, pago, soporte) asociados a un identificador aleatorio de sesión guardado en tu navegador, sin cookies de terceros ni herramientas de analítica externas. El carrito se guarda en el almacenamiento local del navegador.</p>
      </section>
    </div>`;
  if (seccion) requestAnimationFrame(() => document.getElementById(seccion)?.scrollIntoView());
}

// ====================================================================================
// Enrutado
// ====================================================================================

function pintarNoEncontrado(mensaje) {
  vistaPagina.innerHTML = `<h1 class="pagina-titulo">No encontrado</h1><p class="pagina-sub">${esc(mensaje)}</p>
    <a class="btn btn-outline" style="margin-top:24px" href="#/catalogo">Volver al catálogo</a>`;
}

const RUTAS = [
  [/^#\/producto\/([\w-]+)$/, vistaProducto],
  [/^#\/checkout$/, vistaCheckout],
  [/^#\/pago\/([\w-]+)$/, (c) => vistaPago(c.toUpperCase())],
  [/^#\/pedido\/([\w-]+)$/, (c) => vistaPedido(c.toUpperCase())],
  [/^#\/seguimiento$/, vistaSeguimiento],
  [/^#\/cuenta$/, vistaCuenta],
  [/^#\/soporte(?:\?pedido=([\w-]*))?$/, (c) => vistaSoporte((c || '').toUpperCase())],
  [/^#\/legal(?:\/(\w+))?$/, vistaLegal],
];
const SECCIONES_INICIO = { '#/como-funciona': 'como-funciona', '#/marca': 'marca' };
// Cada vista registra sus manejadores con esta señal; al cambiar de vista se anulan todos de golpe.
let controlVista = new AbortController();

function seccionDe(hash) {
  if (/^#\/(catalogo|producto)/.test(hash)) return 'tienda';
  if (/^#\/(seguimiento|pedido)/.test(hash)) return 'pedidos';
  if (hash.startsWith('#/soporte')) return 'soporte';
  if (hash === '#/cuenta') return 'cuenta';
  if (hash === '#/como-funciona') return 'como-funciona';
  if (hash === '#/' || hash === '#/marca') return 'inicio';
  return '';
}

async function enrutar() {
  controlVista.abort();
  controlVista = new AbortController();
  cerrarCarrito();
  cerrarMenu();
  const hash = location.hash || '#/';
  document.querySelectorAll('.nav-center a').forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === hash));
  // En el menú del móvil se marca la sección en la que estás (la ficha de producto cuenta como «Tienda»).
  const seccionMenu = seccionDe(hash);
  document.querySelectorAll('#menuMovil a[data-seccion]').forEach((a) => {
    if (a.dataset.seccion === seccionMenu) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  abrirFiltros(false);
  const coleccion = hash.match(/^#\/catalogo(?:\/(\w+))?$/);
  if (coleccion) {
    vistaInicio.hidden = true;
    vistaPagina.hidden = true;
    vistaColeccion.hidden = false;
    document.title = 'Tienda · NOCTILUZ (prototipo académico)';
    // La pestaña o el enlace de categoría deja solo esa prenda; «Tienda» las muestra todas.
    estado.filtros.tipos.clear();
    if (coleccion[1]) estado.filtros.tipos.add(coleccion[1]);
    if (estado.catalogo) pintarCatalogo();
    window.scrollTo(0, 0);
    return;
  }
  vistaColeccion.hidden = true;
  for (const [patron, vista] of RUTAS) {
    const m = hash.match(patron);
    if (!m) continue;
    vistaInicio.hidden = true;
    vistaPagina.hidden = false;
    window.scrollTo(0, 0);
    vistaPagina.innerHTML = '<div class="cargando">Cargando…</div>';
    try {
      await vista(...m.slice(1));
    } catch (e) {
      vistaPagina.innerHTML = `<div class="alerta error" style="margin-top:30px">${esc(e.message)}</div>`;
    }
    return;
  }
  document.title = 'NOCTILUZ — Moda urbana con fibra óptica integrada (prototipo académico)';
  vistaPagina.hidden = true;
  vistaPagina.innerHTML = '';
  vistaInicio.hidden = false;
  pintarResenas();
  const seccion = SECCIONES_INICIO[hash];
  if (seccion) requestAnimationFrame(() => document.getElementById(seccion).scrollIntoView({ behavior: 'smooth' }));
  else window.scrollTo(0, 0);
}

window.addEventListener('hashchange', enrutar);
// Un enlace a la ruta en la que ya estás no dispara hashchange: se fuerza el enrutado (p. ej. "Catálogo" dos veces).
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#/"]');
  if (a && a.getAttribute('href') === location.hash) { e.preventDefault(); enrutar(); }
});

// ---------- Menú móvil y altura de la cabecera (para los elementos "sticky") ----------
function cerrarMenu() {
  $('#menuMovil').classList.remove('open');
  $('#hamburguesa').setAttribute('aria-expanded', 'false');
}
$('#hamburguesa').addEventListener('click', () => {
  const abierto = $('#menuMovil').classList.toggle('open');
  $('#hamburguesa').setAttribute('aria-expanded', String(abierto));
});
const ajustarCabecera = () => document.documentElement.style.setProperty('--cabecera-h', $('#cabecera').offsetHeight + 'px');
window.addEventListener('resize', ajustarCabecera);
ajustarCabecera();

// ---------- Arranque ----------
const listo = cargarCatalogo()
  .then(() => { pintarCatalogo(); pintarPortada(); pintarCarrito(); })
  .catch((e) => {
    $('#rejilla').innerHTML = `<div class="empty"><h3>No se pudo cargar el catálogo</h3><p>${esc(e.message)}</p></div>`;
    throw e;
  });
listo.catch(() => {});
pintarCarrito();
enrutar();
