// NOCTILUZ · back-office: resumen, pedidos (con cambio de estado), eventos e incidencias.
import { api } from './api.js';
import { esc, eur, fecha, toast, mostrarErrores, validarEnCliente } from './ui.js';

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const contenido = $('#contenido');
let pestanaActual = 'resumen';
let estados = {};

// ---------- Sesión ----------

async function comprobarSesion() {
  const { admin } = await api('admin/sesion.php');
  admin ? mostrarPanel(admin) : mostrarLogin();
}

function mostrarLogin() {
  $('#vistaPanel').hidden = true;
  $('#usuario').hidden = true;
  $('#vistaLogin').hidden = false;
  $('#f-email').focus();
}

function mostrarPanel(admin) {
  $('#vistaLogin').hidden = true;
  $('#vistaPanel').hidden = false;
  $('#usuario').hidden = false;
  $('#nombreAdmin').textContent = `${admin.nombre} · ${admin.email}`;
  cambiarPestana(pestanaActual);
}

$('#formLogin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  $('#errorLogin').innerHTML = '';
  if (!validarEnCliente(f)) return;
  try {
    const { admin } = await api('admin/sesion.php', { method: 'POST', body: { email: f.email.value, clave: f.clave.value } });
    f.reset();
    mostrarPanel(admin);
  } catch (err) {
    $('#errorLogin').innerHTML = `<div class="alerta error">${esc(err.message)}</div>`;
    mostrarErrores(f, err.campos);
  }
});

$('#salir').addEventListener('click', async () => {
  await api('admin/sesion.php', { method: 'DELETE' }).catch(() => {});
  mostrarLogin();
});

/** Si la sesión caduca en mitad del uso, se vuelve al login en vez de mostrar errores sueltos. */
async function llamar(ruta, opciones) {
  try {
    return await api(ruta, opciones);
  } catch (e) {
    if (e.estado === 401) { mostrarLogin(); toast('La sesión ha caducado.', 'error'); }
    throw e;
  }
}

// ---------- Pestañas ----------

document.querySelectorAll('[data-pestana]').forEach((b) => b.addEventListener('click', () => cambiarPestana(b.dataset.pestana)));

async function cambiarPestana(nombre) {
  pestanaActual = nombre;
  document.querySelectorAll('[data-pestana]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.pestana === nombre)));
  contenido.innerHTML = '<div class="vacio">Cargando…</div>';
  try {
    await { resumen, pedidos, eventos, incidencias }[nombre]();
  } catch (e) {
    if (e.estado !== 401) contenido.innerHTML = `<div class="alerta error">${esc(e.message)}</div>`;
  }
}

const etiquetaEstado = (e) => `<span class="estado estado-${esc(e)}">${esc(estados[e] ?? e)}</span>`;

function barras(filas, maximo) {
  return filas.map(([etiqueta, valor, texto]) => `<div class="barra">
    <div class="fila"><span>${esc(etiqueta)}</span><span>${texto ?? valor}</span></div>
    <div class="pista-barra"><div class="relleno" style="width:${maximo ? Math.round((valor / maximo) * 100) : 0}%"></div></div>
  </div>`).join('');
}

// ---------- Resumen ----------

async function resumen() {
  const m = await llamar('admin/metricas.php');
  estados = m.estados;
  actualizarContadorIncidencias(m.incidencias_abiertas);
  const inicioEmbudo = m.embudo[0]?.sesiones || 0;
  const maxEventos = Math.max(0, ...Object.values(m.eventos_por_tipo));
  contenido.innerHTML = `
    <div class="kpis">
      <div class="kpi"><div class="etiqueta">Pedidos totales</div><div class="valor">${m.pedidos_total}</div></div>
      <div class="kpi"><div class="etiqueta">Pedidos pagados</div><div class="valor">${m.pedidos_pagados}</div></div>
      <div class="kpi"><div class="etiqueta">Facturación simulada</div><div class="valor">${eur(m.facturacion)}</div></div>
      <div class="kpi"><div class="etiqueta">Ticket medio</div><div class="valor">${eur(m.ticket_medio)}</div></div>
      <div class="kpi"><div class="etiqueta">Incidencias abiertas</div><div class="valor">${m.incidencias_abiertas}</div></div>
    </div>
    <div class="rejilla-adm">
      <div class="panel"><h2>Embudo de conversión (sesiones)</h2>
        ${barras(m.embudo.map((p) => [p.etiqueta, p.sesiones, `${p.sesiones}${inicioEmbudo ? ` · ${Math.round((p.sesiones / inicioEmbudo) * 100)} %` : ''}`]), inicioEmbudo)}
        <p class="pista">Calculado a partir de la tabla <code>eventos</code>: sesiones anónimas distintas que llegan a cada paso.</p>
      </div>
      <div class="panel"><h2>Pedidos por estado</h2>
        <div class="lista-simple">${Object.keys(m.estados).map((e) => `<button type="button" class="fila-estado" data-ver-estado="${esc(e)}" title="Ver los pedidos en este estado">${etiquetaEstado(e)}<span>${m.por_estado[e] ?? 0}</span></button>`).join('')}</div>
      </div>
      <div class="panel"><h2>Eventos registrados por tipo</h2>
        ${barras(Object.entries(m.eventos_por_tipo), maxEventos)}
      </div>
      <div class="panel"><h2>Más vendidos</h2>
        <div class="lista-simple">${m.mas_vendidos.length ? m.mas_vendidos.map((p) => `<div><span>${esc(p.descripcion)}</span><span>${p.unidades} ud.</span></div>`).join('') : '<p class="pista">Sin ventas pagadas todavía.</p>'}</div>
        <h2 style="margin-top:22px">Stock bajo (≤ 3)</h2>
        <div class="lista-simple">${m.stock_bajo.length ? m.stock_bajo.map((v) => `<div><code>${esc(v.sku)}</code><span>${v.stock === 0 ? '<span class="estado estado-cancelado">agotado</span>' : `${v.stock} ud.`}</span></div>`).join('') : '<p class="pista">Todo el catálogo tiene stock suficiente.</p>'}</div>
      </div>
    </div>`;

  // Pulsar un estado lleva a la pestaña Pedidos ya filtrada por ese estado.
  contenido.querySelectorAll('[data-ver-estado]').forEach((b) => b.addEventListener('click', () => irAPedidos({ estado: b.dataset.verEstado })));
}

// ---------- Pedidos ----------

const filtroPedidos = { estado: '', q: '' };

/** Cambia a la pestaña Pedidos con un filtro de estado y, opcionalmente, un pedido abierto. */
async function irAPedidos({ estado = '', codigo = null } = {}) {
  filtroPedidos.estado = estado;
  filtroPedidos.q = '';
  pestanaActual = 'pedidos';
  document.querySelectorAll('[data-pestana]').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.pestana === 'pedidos')));
  await pedidos(codigo);
}

async function pedidos(codigoAbierto = null) {
  const r = await llamar('admin/pedidos.php', { params: { estado: filtroPedidos.estado, q: filtroPedidos.q } });
  estados = r.estados;
  contenido.innerHTML = `
    <div class="herramientas">
      <select class="input" id="filtroEstado" aria-label="Filtrar por estado">
        <option value="">Todos los estados</option>
        ${Object.entries(r.estados).map(([id, n]) => `<option value="${esc(id)}" ${filtroPedidos.estado === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}
      </select>
      <input class="input" type="search" id="buscarPedido" placeholder="Código, cliente o email" value="${esc(filtroPedidos.q)}" aria-label="Buscar pedidos" maxlength="60">
      <span class="derecha pista" style="margin-top:0">${r.pedidos.length} pedido${r.pedidos.length === 1 ? '' : 's'}</span>
    </div>
    <div class="tabla-wrap"><table class="tabla">
      <thead><tr><th>Código</th><th>Fecha</th><th>Cliente</th><th>Ud.</th><th>Total</th><th>Estado</th><th>Modificar</th><th>Eliminar</th></tr></thead>
      <tbody>${r.pedidos.length ? r.pedidos.map((p) => `
        <tr class="clicable" data-codigo="${esc(p.codigo)}" tabindex="0" aria-selected="${p.codigo === codigoAbierto}">
          <td><code>${esc(p.codigo)}</code></td><td>${fecha(p.creado_en)}</td>
          <td>${esc(p.cliente_nombre)}<br><small>${esc(p.cliente_email)}</small></td>
          <td class="num">${p.unidades}</td><td class="num">${eur(p.total)}</td><td>${etiquetaEstado(p.estado)}</td>
          <td><button type="button" class="enlace" data-modificar="${esc(p.codigo)}">Modificar</button></td>
          <td><button type="button" class="btn-x" data-eliminar="${esc(p.codigo)}" title="Eliminar pedido" aria-label="Eliminar el pedido ${esc(p.codigo)}">✕</button></td>
        </tr>`).join('') : '<tr><td colspan="8" class="vacio">No hay pedidos con esos filtros.</td></tr>'}
      </tbody></table></div>
    <div id="detallePedido"></div>`;

  $('#filtroEstado').addEventListener('change', (e) => { filtroPedidos.estado = e.target.value; pedidos(); });
  let espera;
  $('#buscarPedido').addEventListener('input', (e) => {
    clearTimeout(espera);
    espera = setTimeout(() => { filtroPedidos.q = e.target.value; pedidos().then(() => $('#buscarPedido').focus()); }, 350);
  });
  contenido.querySelectorAll('tr[data-codigo]').forEach((tr) => {
    const abrir = () => {
      contenido.querySelectorAll('tr[data-codigo]').forEach((x) => x.setAttribute('aria-selected', String(x === tr)));
      detallePedido(tr.dataset.codigo);
    };
    tr.addEventListener('click', (e) => { if (!e.target.closest('button')) abrir(); });
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === tr) abrir(); });
  });
  contenido.querySelectorAll('[data-modificar]').forEach((b) => b.addEventListener('click', () => {
    contenido.querySelectorAll('tr[data-codigo]').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.codigo === b.dataset.modificar)));
    detallePedido(b.dataset.modificar, true);
  }));
  contenido.querySelectorAll('[data-eliminar]').forEach((b) => b.addEventListener('click', async () => {
    const codigo = b.dataset.eliminar;
    if (!confirm(`¿Eliminar el pedido ${codigo}? Se borran sus líneas, pagos e historial. No se puede deshacer.`)) return;
    try {
      await llamar('admin/pedidos.php', { method: 'DELETE', params: { codigo } });
      toast(`Pedido ${codigo} eliminado`);
      pedidos();
    } catch (err) { toast(err.message, 'error'); }
  }));
  if (codigoAbierto) detallePedido(codigoAbierto);
}

/** Estados en los que la dirección todavía se puede cambiar (igual que en Pedidos::editarEnvioAdmin). */
const EDITABLE_ENVIO = ['creado', 'pagado', 'en_preparacion'];

async function detallePedido(codigo, editar = false) {
  const caja = $('#detallePedido');
  caja.innerHTML = '<div class="vacio">Cargando pedido…</div>';
  const p = await llamar('admin/pedidos.php', { params: { codigo } });
  caja.innerHTML = `
    <div class="detalle">
      <div class="detalle-cab"><h2>Pedido <span class="codigo">${esc(p.codigo)}</span></h2>${etiquetaEstado(p.estado)}</div>
      <div class="rejilla-adm" style="margin-top:0">
        <div class="panel"><h2>Líneas de pedido</h2>
          <div class="lista-simple">${p.lineas.map((l) => `<div><span>${l.cantidad} × ${esc(l.descripcion)}<br><small>${esc(l.modo_nombre)} · Talla ${esc(l.talla)} · <code>${esc(l.sku)}</code></small></span><span>${eur(l.importe)}</span></div>`).join('')}</div>
          <div class="lista-simple" style="margin-top:12px">
            <div><span>Subtotal</span><span>${eur(p.subtotal)}</span></div>
            <div><span>Descuento ${p.cupon_codigo ? `(${esc(p.cupon_codigo)})` : ''}</span><span>−${eur(p.descuento)}</span></div>
            <div><span>Envío (${esc(p.metodo_envio_nombre)})</span><span>${eur(p.envio)}</span></div>
            <div><span>Base imponible</span><span>${eur(p.base_imponible)}</span></div>
            <div><span>IVA 21 %</span><span>${eur(p.iva)}</span></div>
            <div><strong>Total</strong><strong>${eur(p.total)}</strong></div>
          </div>
        </div>
        <div class="panel"><h2>Cliente y envío</h2>
          <div class="lista-simple">
            <div><span>Nombre</span><span>${esc(p.cliente_nombre)}</span></div>
            <div><span>Email</span><span>${esc(p.cliente_email)}</span></div>
            <div><span>Teléfono</span><span>${esc(p.cliente_telefono ?? '—')}</span></div>
            <div><span>Dirección</span><span style="text-align:right">${esc(p.dir_linea)}<br>${esc(p.dir_cp)} ${esc(p.dir_ciudad)} (${esc(p.dir_provincia)})</span></div>
            <div><span>Creado</span><span>${fecha(p.creado_en)}</span></div>
            <div><span>Sesión</span><code>${esc(p.sesion_id ?? '—')}</code></div>
          </div>
          <h2 style="margin-top:20px">Pagos</h2>
          <div class="lista-simple">${p.pagos.length ? p.pagos.map((g) => `<div><span>${fecha(g.creado_en)} · ${g.metodo === 'paypal_sandbox' ? 'PayPal (sandbox)' : `•••• ${esc(g.tarjeta_ultimos4)}`}<br><small><code>${esc(g.referencia)}</code> · ${esc(g.mensaje)}</small></span><span class="estado estado-${esc(g.resultado)}">${esc(g.resultado)}</span></div>`).join('') : '<p class="pista">Sin intentos de pago.</p>'}</div>
          <h2 style="margin-top:20px">Factura</h2>
          ${p.factura ? `<div class="lista-simple">
              <div><span><code>${esc(p.factura.numero)}</code> · ${fecha(p.factura.emitida_en)}<br><small>${p.factura.estado_envio === 'enviada'
                ? `Enviada por email el ${fecha(p.factura.enviada_en)}` : `No enviada${p.factura.error_envio ? `: ${esc(p.factura.error_envio)}` : ''}`}</small></span>
                <span class="estado ${p.factura.estado_envio === 'enviada' ? 'estado-aprobado' : 'estado-rechazado'}">${esc(p.factura.estado_envio)}</span></div>
            </div>
            <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap">
              <a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="api/factura.php?codigo=${encodeURIComponent(p.codigo)}">Ver factura</a>
              <button type="button" class="btn btn-outline btn-sm" id="reenviarFactura">Reenviar por email</button>
            </div>`
            : '<p class="pista">Se emite automáticamente cuando el pedido se paga.</p>'}
        </div>
        <div class="panel"><h2>Historial de estados</h2>
          <div class="lista-simple">${p.historial.map((h) => `<div><span>${h.estado_anterior ? `${esc(estados[h.estado_anterior] ?? h.estado_anterior)} → ` : ''}<strong>${esc(estados[h.estado_nuevo] ?? h.estado_nuevo)}</strong><br><small>${esc(h.motivo ?? '')} · ${esc(h.actor)}</small></span><span>${fecha(h.creado_en)}</span></div>`).join('')}</div>
          <h2 style="margin-top:20px">Cambiar estado</h2>
          ${p.transiciones.length ? `<form class="cambio-estado" id="formEstado" novalidate>
            <div class="campo"><label for="f-estado">Nuevo estado</label><select id="f-estado" name="estado" required>
              ${p.transiciones.map((t) => `<option value="${esc(t)}">${esc(estados[t] ?? t)}</option>`).join('')}</select></div>
            <div class="campo"><label for="f-motivo">Motivo <span class="opcional">(opcional)</span></label><input id="f-motivo" name="motivo" maxlength="200" placeholder="p. ej. entregado a la mensajería"></div>
            <button class="btn btn-solid btn-sm" style="height:44px">Aplicar</button>
          </form>
          <p class="pista">Solo se ofrecen las transiciones válidas desde «${esc(estados[p.estado])}». «Pagado» solo lo asigna la pasarela de pago (tarjeta de prueba o PayPal sandbox).</p>`
            : '<p class="pista">Estado final: este pedido ya no admite cambios.</p>'}
        </div>
        <div class="panel" id="panelModificar"><h2>Modificar dirección de envío</h2>
          ${EDITABLE_ENVIO.includes(p.estado) ? `<form class="form-inline" id="formEnvio" novalidate>
            <div class="campo"><label for="e-linea">Dirección</label><input id="e-linea" name="linea" required minlength="5" maxlength="160" value="${esc(p.dir_linea)}"><small class="campo-error" data-error-de="linea"></small></div>
            <div class="campo"><label for="e-cp">Código postal</label><input id="e-cp" name="cp" required maxlength="5" pattern="(0[1-9]|[1-4]\\d|5[0-2])\\d{3}" data-mensaje="Código postal español de 5 cifras." value="${esc(p.dir_cp)}"><small class="campo-error" data-error-de="cp"></small></div>
            <div class="campo"><label for="e-ciudad">Ciudad</label><input id="e-ciudad" name="ciudad" required minlength="2" maxlength="80" value="${esc(p.dir_ciudad)}"><small class="campo-error" data-error-de="ciudad"></small></div>
            <div class="campo"><label for="e-provincia">Provincia</label><input id="e-provincia" name="provincia" required minlength="2" maxlength="80" value="${esc(p.dir_provincia)}"><small class="campo-error" data-error-de="provincia"></small></div>
            <button class="btn btn-solid btn-sm">Guardar cambios</button>
          </form>
          <p class="pista">Los importes no se modifican a mano: los calcula el servidor al crear el pedido.</p>`
            : '<p class="pista">El pedido ya ha salido del almacén (o está cancelado): la dirección ya no se puede cambiar.</p>'}
        </div>
      </div>
    </div>`;
  if (editar) {
    $('#panelModificar').scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('#e-linea')?.focus({ preventScroll: true });
  } else {
    caja.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('#formEnvio')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    if (!validarEnCliente(f)) return;
    try {
      await llamar('admin/pedidos.php', { method: 'POST', body: { accion: 'editar', codigo, direccion: Object.fromEntries(new FormData(f)) } });
      toast('Dirección actualizada');
      pedidos(codigo);
    } catch (err) {
      mostrarErrores(f, err.campos);
      toast(err.message, 'error');
    }
  });

  $('#reenviarFactura')?.addEventListener('click', async () => {
    try {
      const r = await llamar('admin/pedidos.php', { method: 'POST', body: { accion: 'reenviar_factura', codigo } });
      toast(r.factura?.estado_envio === 'enviada' ? 'Factura enviada' : `No se pudo enviar: ${r.factura?.error_envio ?? 'error desconocido'}`, r.factura?.estado_envio === 'enviada' ? undefined : 'error');
      detallePedido(codigo);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  $('#formEstado')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await llamar('admin/pedidos.php', { method: 'POST', body: { codigo, estado: f.estado.value, motivo: f.motivo.value } });
      toast('Estado actualizado');
      pedidos(codigo);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

// ---------- Eventos ----------

let filtroTipo = '';

async function eventos() {
  const r = await llamar('admin/eventos.php', { params: { tipo: filtroTipo, desde_id: 0, limite: 1000 } });
  const lista = [...r.eventos].reverse();
  const params = new URLSearchParams({ tipo: filtroTipo, descargar: 1 });
  contenido.innerHTML = `
    <div class="herramientas">
      <select class="input" id="filtroTipo" aria-label="Filtrar por tipo de evento">
        <option value="">Todos los tipos</option>
        ${r.tipos.map((t) => `<option ${t === filtroTipo ? 'selected' : ''}>${esc(t)}</option>`).join('')}
      </select>
      <button class="btn btn-outline btn-sm" id="recargarEventos">Actualizar</button>
      <div class="derecha">
        <a class="btn btn-outline btn-sm" href="api/admin/eventos.php?${params}&formato=csv">Exportar CSV</a>
        <a class="btn btn-outline btn-sm" href="api/admin/eventos.php?${params}&formato=json">Exportar JSON</a>
      </div>
    </div>
    <p class="pista" style="margin:-6px 0 14px">${lista.length} eventos (los más recientes primero). Lectura incremental para otro sistema:
      <code>GET api/admin/eventos.php?desde_id=${r.siguiente_desde_id}</code> devuelve solo los eventos posteriores al último leído.</p>
    <div class="tabla-wrap"><table class="tabla">
      <thead><tr><th>#</th><th>Fecha</th><th>Tipo</th><th>Origen</th><th>Sesión</th><th>Pedido</th><th>Datos</th></tr></thead>
      <tbody>${lista.length ? lista.map((ev) => `<tr>
        <td class="num">${ev.id}</td><td style="white-space:nowrap">${fecha(ev.ocurrido_en)}</td>
        <td><span class="tipo-evento ${ev.origen === 'servidor' ? 'servidor' : ''}">${esc(ev.tipo)}</span></td>
        <td>${esc(ev.origen)}</td>
        <td><code title="${esc(ev.sesion_id ?? '')}">${esc((ev.sesion_id ?? '—').slice(0, 8))}</code></td>
        <td>${ev.pedido_codigo ? `<code>${esc(ev.pedido_codigo)}</code>` : '—'}</td>
        <td><code>${esc(JSON.stringify(ev.datos))}</code></td>
      </tr>`).join('') : '<tr><td colspan="7" class="vacio">No hay eventos de ese tipo.</td></tr>'}</tbody>
    </table></div>`;
  $('#filtroTipo').addEventListener('change', (e) => { filtroTipo = e.target.value; eventos(); });
  $('#recargarEventos').addEventListener('click', () => eventos());
}

// ---------- Incidencias ----------

function actualizarContadorIncidencias(n) {
  const c = $('#contadorIncidencias');
  c.hidden = !n;
  c.textContent = n;
}

async function incidencias() {
  const { incidencias: lista, motivos } = await llamar('admin/incidencias.php');
  actualizarContadorIncidencias(lista.filter((i) => i.estado === 'abierta').length);
  const porId = new Map(lista.map((i) => [i.id, i]));
  contenido.innerHTML = `<div class="tabla-wrap"><table class="tabla">
    <thead><tr><th>Código</th><th>Fecha</th><th>Cliente</th><th>Motivo</th><th>Mensaje</th><th>Pedido</th><th>Estado</th><th>Respuesta</th><th>Modificar</th><th>Eliminar</th></tr></thead>
    <tbody>${lista.length ? lista.map((i) => `<tr data-fila="${i.id}">
      <td><code>${esc(i.codigo)}</code></td><td style="white-space:nowrap">${fecha(i.creado_en)}</td>
      <td>${esc(i.nombre)}<br><small>${esc(i.email)}</small></td>
      <td>${esc(i.motivo_nombre)}</td><td style="min-width:240px">${esc(i.mensaje)}</td>
      <td>${i.pedido_codigo ? `<button class="enlace" data-ver-pedido="${esc(i.pedido_codigo)}">${esc(i.pedido_codigo)}</button>` : '—'}</td>
      <td><span class="estado estado-${esc(i.estado)}">${esc(i.estado)}</span><br>
        <button class="enlace" style="margin-top:6px; font-size:.78rem" data-id="${i.id}" data-nuevo="${i.estado === 'abierta' ? 'resuelta' : 'abierta'}">
          ${i.estado === 'abierta' ? 'Marcar resuelta' : 'Reabrir'}</button></td>
      <td style="min-width:200px">${i.respuesta ? `<div class="respuesta">${esc(i.respuesta)}</div><small>${fecha(i.respondida_en)}</small><br>` : ''}
        <button class="enlace" style="font-size:.78rem" data-responder="${i.id}">${i.respuesta ? 'Editar respuesta' : 'Responder'}</button></td>
      <td><button class="enlace" data-editar="${i.id}">Modificar</button></td>
      <td><button type="button" class="btn-x" data-borrar="${i.id}" title="Eliminar incidencia" aria-label="Eliminar la incidencia ${esc(i.codigo)}">✕</button></td>
    </tr>`).join('') : '<tr><td colspan="10" class="vacio">No hay incidencias.</td></tr>'}</tbody></table></div>`;

  /** Abre un formulario en una fila justo debajo de la incidencia (solo uno a la vez). */
  function abrirFormulario(id, html, alGuardar) {
    contenido.querySelector('.fila-edicion')?.remove();
    const fila = contenido.querySelector(`tr[data-fila="${id}"]`);
    fila.insertAdjacentHTML('afterend', `<tr class="fila-edicion"><td colspan="10"><form class="form-inline" novalidate>${html}
      <div class="botones"><button class="btn btn-solid btn-sm">Guardar</button><button type="button" class="btn btn-outline btn-sm" data-cancelar>Cancelar</button></div>
    </form></td></tr>`);
    const f = fila.nextElementSibling.querySelector('form');
    f.querySelector('[data-cancelar]').addEventListener('click', () => f.closest('tr').remove());
    f.querySelector('textarea, select, input')?.focus();
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validarEnCliente(f)) return;
      try {
        await alGuardar(Object.fromEntries(new FormData(f)));
        incidencias();
      } catch (err) {
        mostrarErrores(f, err.campos);
        toast(err.message, 'error');
      }
    });
  }

  contenido.querySelectorAll('[data-responder]').forEach((b) => b.addEventListener('click', () => {
    const i = porId.get(Number(b.dataset.responder));
    abrirFormulario(i.id, `
      <div class="campo"><label for="i-respuesta">Respuesta para ${esc(i.nombre)} (la verá en «Mi cuenta»)</label>
        <textarea id="i-respuesta" name="respuesta" required minlength="2" maxlength="1000">${esc(i.respuesta ?? '')}</textarea>
        <small class="campo-error" data-error-de="respuesta"></small></div>`,
    async (d) => {
      await llamar('admin/incidencias.php', { method: 'POST', body: { accion: 'responder', id: i.id, ...d } });
      toast('Respuesta guardada');
    });
  }));

  contenido.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => {
    const i = porId.get(Number(b.dataset.editar));
    abrirFormulario(i.id, `
      <div class="campo"><label for="i-motivo">Motivo</label><select id="i-motivo" name="motivo" required>
        ${Object.entries(motivos).map(([id, n]) => `<option value="${esc(id)}" ${id === i.motivo ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
      <div class="campo"><label for="i-mensaje">Mensaje</label>
        <textarea id="i-mensaje" name="mensaje" required minlength="10" maxlength="1000">${esc(i.mensaje)}</textarea>
        <small class="campo-error" data-error-de="mensaje"></small></div>
      <div class="campo"><label for="i-estado">Estado</label><select id="i-estado" name="estado">
        ${['abierta', 'resuelta'].map((e) => `<option ${e === i.estado ? 'selected' : ''}>${e}</option>`).join('')}</select></div>`,
    async (d) => {
      await llamar('admin/incidencias.php', { method: 'POST', body: { accion: 'editar', id: i.id, ...d } });
      toast('Incidencia modificada');
    });
  }));

  contenido.querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', async () => {
    const i = porId.get(Number(b.dataset.borrar));
    if (!confirm(`¿Eliminar la incidencia ${i.codigo}? No se puede deshacer.`)) return;
    try {
      await llamar('admin/incidencias.php', { method: 'DELETE', params: { id: i.id } });
      toast(`Incidencia ${i.codigo} eliminada`);
      incidencias();
    } catch (e) { toast(e.message, 'error'); }
  }));

  contenido.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', async () => {
    try {
      await llamar('admin/incidencias.php', { method: 'POST', body: { id: Number(b.dataset.id), estado: b.dataset.nuevo } });
      toast('Incidencia actualizada');
      incidencias();
    } catch (e) { toast(e.message, 'error'); }
  }));
  contenido.querySelectorAll('[data-ver-pedido]').forEach((b) => b.addEventListener('click', () => irAPedidos({ codigo: b.dataset.verPedido })));
}

comprobarSesion().catch((e) => {
  $('#vistaLogin').hidden = false;
  $('#errorLogin').innerHTML = `<div class="alerta error">${esc(e.message)}</div>`;
});
