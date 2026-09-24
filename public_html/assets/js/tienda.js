// NOCTILUZ · tienda. Interfaz (vistas y enrutado por hash). La lógica de negocio vive en el servidor (api/ + app/).
import { api } from './api.js';
import { esc, eur, fecha, toast, prenda, campo, mostrarErrores, validarEnCliente } from './ui.js';
import * as carrito from './carrito.js';
import { registrar, sesionId } from './eventos.js';

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const vistaInicio = $('#vista-inicio');
const vistaPagina = $('#vista-pagina');
const ORDEN_MODOS = ['fijo', 'parpadeo', 'degradado'];

const estado = {
  catalogo: null,
  filtros: { tipo: 'todas', colores: new Set(), modos: new Set(), texto: '' },
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

function pintarFiltros() {
  const { catalogo: c, filtros: f } = estado;
  $('#filtroTipo').innerHTML = [{ id: 'todas', nombre: 'Todos' }, ...c.categorias]
    .map((t) => `<button type="button" class="chip" data-tipo="${esc(t.id)}" aria-pressed="${f.tipo === t.id}">${esc(t.nombre)}</button>`).join('');
  $('#filtroColor').innerHTML = c.colores
    .map((col) => `<button type="button" class="dot" data-color="${esc(col.id)}" aria-pressed="${f.colores.has(col.id)}"
      title="${esc(col.nombre)}" aria-label="Luz ${esc(col.nombre)}" style="background:${esc(col.hex)};--gc:${esc(col.hex)}"></button>`).join('');
  $('#filtroModo').innerHTML = c.modos
    .map((m) => `<button type="button" class="chip modo-chip" data-modo="${esc(m.id)}" aria-pressed="${f.modos.has(m.id)}" title="${esc(m.descripcion)}"><span class="mdot"></span>${esc(m.nombre)}</button>`).join('');
}

/** Filtros: dentro de un grupo se suman opciones (O); entre grupos se combinan (Y). */
function variantesFiltradas() {
  const f = estado.filtros;
  const texto = normalizar(f.texto);
  const salida = [];
  for (const p of estado.catalogo.productos) {
    if (f.tipo !== 'todas' && p.categoria !== f.tipo) continue;
    if (f.modos.size && !p.modos.some((m) => f.modos.has(m))) continue;
    for (const v of p.variantes) {
      if (f.colores.size && !f.colores.has(v.color)) continue;
      if (texto && !normalizar(`${p.nombre} ${v.color_nombre} ${p.categoria_nombre} ${p.descripcion}`).includes(texto)) continue;
      salida.push({ p, v });
    }
  }
  return salida;
}

function tarjeta({ p, v }) {
  const etiquetaStock = v.stock === 0 ? '<span class="stock-tag agotado">Agotado</span>'
    : v.stock <= 3 ? '<span class="stock-tag ultimas">Últimas unidades</span>' : '';
  return `<a class="pcard" href="#/producto/${esc(v.sku)}">
    <div class="pcard-media" style="--gc:${esc(v.hex)}44">${etiquetaStock}${medio(p, v, { modo: p.modos.at(-1), variante: v.imagen ? 'foto' : 'frontal' })}</div>
    <div class="pcard-body">
      <div class="pcard-type">${esc(p.categoria_nombre)}</div>
      <div class="pcard-name">${esc(p.nombre)}</div>
      <div class="pcard-color" style="--gc:${esc(v.hex)}"><i></i>Luz ${esc(v.color_nombre.toLowerCase())}</div>
      <div class="pcard-modes" aria-label="Modos disponibles">${p.modos.map((m) => `<span>${esc(nombreModo(m))}</span>`).join('')}</div>
      <div class="pcard-foot"><span class="pcard-price">${eur(p.precio)}</span><span class="pcard-cta">Ver producto</span></div>
    </div>
  </a>`;
}

function pintarCatalogo() {
  pintarFiltros();
  const items = variantesFiltradas();
  $('#contadorProductos').textContent = `${items.length} producto${items.length === 1 ? '' : 's'}`;
  $('#rejilla').innerHTML = items.length
    ? items.map(tarjeta).join('')
    : `<div class="empty"><h3>Ningún producto coincide</h3><p>Prueba a quitar algún filtro o a cambiar la búsqueda.</p><button type="button" data-restablecer>Restablecer filtros</button></div>`;
}

function restablecerFiltros() {
  Object.assign(estado.filtros, { tipo: 'todas', texto: '' });
  estado.filtros.colores.clear();
  estado.filtros.modos.clear();
  document.querySelectorAll('[data-buscador]').forEach((i) => { i.value = ''; });
  pintarCatalogo();
}

$('#catalogo').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !estado.catalogo) return;
  const f = estado.filtros;
  const alternar = (conjunto, valor) => (conjunto.has(valor) ? conjunto.delete(valor) : conjunto.add(valor));
  if (b.dataset.tipo) f.tipo = b.dataset.tipo;
  else if (b.dataset.color) alternar(f.colores, b.dataset.color);
  else if (b.dataset.modo) alternar(f.modos, b.dataset.modo);
  else if (b.id === 'restablecer') return restablecerFiltros();
  else return;
  pintarCatalogo();
});
$('#rejilla').addEventListener('click', (e) => { if (e.target.closest('[data-restablecer]')) restablecerFiltros(); });

document.querySelectorAll('[data-buscador]').forEach((input) => {
  input.addEventListener('input', () => {
    estado.filtros.texto = input.value;
    document.querySelectorAll('[data-buscador]').forEach((otro) => { if (otro !== input) otro.value = input.value; });
    if (!estado.catalogo) return;
    pintarCatalogo();
    if (!vistaInicio.hidden) return;
    location.hash = '#/catalogo';
  });
});

document.querySelectorAll('[data-categoria]').forEach((a) => a.addEventListener('click', () => {
  if (!estado.catalogo) return;
  restablecerFiltros();
  estado.filtros.tipo = a.dataset.categoria;
  pintarCatalogo();
}));

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
          <div><dt>Envío</dt><dd>Estándar ${eur(estado.catalogo.reglas.envio_estandar)} (gratis desde ${eur(estado.catalogo.reglas.umbral_envio_gratis)}) · Exprés ${eur(estado.catalogo.reglas.envio_expres)}</dd></div>
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
          <div style="display:grid; gap:10px">
            <label class="opcion-radio"><input type="radio" name="envio" value="estandar" checked>
              <span>Estándar · 48-72 h<br><small class="campo-ayuda">Gratis desde ${eur(estado.catalogo.reglas.umbral_envio_gratis)}</small></span>
              <span class="precio">${eur(estado.catalogo.reglas.envio_estandar)}</span></label>
            <label class="opcion-radio"><input type="radio" name="envio" value="expres">
              <span>Exprés · 24 h</span><span class="precio">${eur(estado.catalogo.reglas.envio_expres)}</span></label>
          </div>
          <small class="campo-error" data-error-de="envio"></small>
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

  async function recalcular() {
    $('#errorCupon').textContent = '';
    try {
      const r = await api('presupuesto.php', { method: 'POST', body: { lineas: carrito.obtener(), cupon: cuponAplicado, envio: form.envio.value } });
      if (r.totales.cupon_error) {
        $('#errorCupon').textContent = r.totales.cupon_error;
        cuponAplicado = '';
      } else if (r.totales.cupon) {
        $('#errorCupon').innerHTML = `<span style="color:var(--ok)">Cupón aplicado: ${esc(r.totales.cupon.descripcion)}</span>`;
      }
      $('#resumen').innerHTML = htmlResumen(r.lineas, r.totales);
      boton.disabled = false;
    } catch (e) {
      $('#resumen').innerHTML = `<div class="alerta error">${esc(e.message)}<ul>${listaErroresLineas(e.campos)}</ul>
        <button type="button" class="enlace" data-abrir-carrito style="margin-top:8px">Revisar el carrito</button></div>`;
      boton.disabled = true;
    }
  }

  form.addEventListener('change', (e) => { if (e.target.name === 'envio') recalcular(); });
  $('#aplicarCupon').addEventListener('click', () => { cuponAplicado = $('#cupon').value.trim().toUpperCase(); recalcular(); });
  $('#cupon').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#aplicarCupon').click(); } });
  $('#resumen').addEventListener('click', (e) => { if (e.target.closest('[data-abrir-carrito]')) abrirCarrito(); });
  $('#rellenarPrueba').addEventListener('click', () => {
    const c = CLIENTES_PRUEBA[Math.floor(Math.random() * CLIENTES_PRUEBA.length)];
    for (const [k, v] of Object.entries(c)) form.elements[k].value = v;
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
        <div id="resultadoPago" role="alert" style="margin-top:16px"></div>
        <button class="btn btn-solid btn-full" style="margin-top:18px" id="pagar">Pagar ${eur(p.total)} (simulado)</button>
        <button type="button" class="btn btn-peligro btn-full" style="margin-top:10px" id="cancelarPedido">Cancelar pedido</button>
      </form>
      <aside class="pegajoso">
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
}

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
      <p style="color:var(--ink-dim)">Pago simulado aprobado. Recuerda que es un prototipo: no recibirás ningún paquete.</p>
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
          ${p.pagos.length ? p.pagos.map((g) => `<div class="sumrow"><span>${fecha(g.creado_en)} · •••• ${esc(g.tarjeta_ultimos4)}</span><span class="estado estado-${esc(g.resultado)}">${esc(g.resultado)}</span></div>`).join('')
            : '<p class="pista">Todavía no hay ningún intento de pago.</p>'}
          ${ultimoPago?.resultado === 'rechazado' && p.estado === 'creado' ? `<p class="pista">Último intento: ${esc(ultimoPago.mensaje)}</p>` : ''}
        </div>
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

function vistaLegal(seccion) {
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
          <li>Envío estándar (48-72 h): 4,95 €, gratis si el pedido supera 120 € tras descuentos.</li>
          <li>Envío exprés (24 h): 9,95 €, nunca gratuito.</li>
          <li>Cupones de prueba: NOCHE10 (10 % desde 50 €), BIENVENIDA5 (5 € desde 30 €) y ENVIOGRATIS.</li>
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
  [/^#\/soporte(?:\?pedido=([\w-]*))?$/, (c) => vistaSoporte((c || '').toUpperCase())],
  [/^#\/legal(?:\/(\w+))?$/, vistaLegal],
];
const SECCIONES_INICIO = { '#/catalogo': 'catalogo', '#/como-funciona': 'como-funciona', '#/marca': 'marca' };
// Cada vista registra sus manejadores con esta señal; al cambiar de vista se anulan todos de golpe.
let controlVista = new AbortController();

async function enrutar() {
  controlVista.abort();
  controlVista = new AbortController();
  cerrarCarrito();
  cerrarMenu();
  const hash = location.hash || '#/';
  document.querySelectorAll('.nav-center a').forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === hash));
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
  .then(() => { pintarCatalogo(); pintarCarrito(); })
  .catch((e) => {
    $('#rejilla').innerHTML = `<div class="empty"><h3>No se pudo cargar el catálogo</h3><p>${esc(e.message)}</p></div>`;
    throw e;
  });
listo.catch(() => {});
pintarCarrito();
enrutar();
