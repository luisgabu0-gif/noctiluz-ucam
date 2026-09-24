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
        <div class="lista-simple">${Object.keys(m.estados).map((e) => `<div>${etiquetaEstado(e)}<span>${m.por_estado[e] ?? 0}</span></div>`).join('')}</div>
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
}

// ---------- Pedidos ----------

const filtroPedidos = { estado: '', q: '' };

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
      <thead><tr><th>Código</th><th>Fecha</th><th>Cliente</th><th>Ud.</th><th>Total</th><th>Estado</th></tr></thead>
      <tbody>${r.pedidos.length ? r.pedidos.map((p) => `
        <tr class="clicable" data-codigo="${esc(p.codigo)}" tabindex="0" aria-selected="${p.codigo === codigoAbierto}">
          <td><code>${esc(p.codigo)}</code></td><td>${fecha(p.creado_en)}</td>
          <td>${esc(p.cliente_nombre)}<br><small>${esc(p.cliente_email)}</small></td>
          <td class="num">${p.unidades}</td><td class="num">${eur(p.total)}</td><td>${etiquetaEstado(p.estado)}</td>
        </tr>`).join('') : '<tr><td colspan="6" class="vacio">No hay pedidos con esos filtros.</td></tr>'}
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
    tr.addEventListener('click', abrir);
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') abrir(); });
  });
  if (codigoAbierto) detallePedido(codigoAbierto);
}

async function detallePedido(codigo) {
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
          <h2 style="margin-top:20px">Pagos simulados</h2>
          <div class="lista-simple">${p.pagos.length ? p.pagos.map((g) => `<div><span>${fecha(g.creado_en)} · •••• ${esc(g.tarjeta_ultimos4)}<br><small><code>${esc(g.referencia)}</code> · ${esc(g.mensaje)}</small></span><span class="estado estado-${esc(g.resultado)}">${esc(g.resultado)}</span></div>`).join('') : '<p class="pista">Sin intentos de pago.</p>'}</div>
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
          <p class="pista">Solo se ofrecen las transiciones válidas desde «${esc(estados[p.estado])}». «Pagado» solo lo asigna la pasarela simulada.</p>`
            : '<p class="pista">Estado final: este pedido ya no admite cambios.</p>'}
        </div>
      </div>
    </div>`;
  caja.scrollIntoView({ behavior: 'smooth', block: 'start' });

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
  const { incidencias: lista } = await llamar('admin/incidencias.php');
  actualizarContadorIncidencias(lista.filter((i) => i.estado === 'abierta').length);
  contenido.innerHTML = `<div class="tabla-wrap"><table class="tabla">
    <thead><tr><th>Código</th><th>Fecha</th><th>Cliente</th><th>Motivo</th><th>Mensaje</th><th>Pedido</th><th>Estado</th></tr></thead>
    <tbody>${lista.length ? lista.map((i) => `<tr>
      <td><code>${esc(i.codigo)}</code></td><td style="white-space:nowrap">${fecha(i.creado_en)}</td>
      <td>${esc(i.nombre)}<br><small>${esc(i.email)}</small></td>
      <td>${esc(i.motivo_nombre)}</td><td style="min-width:240px">${esc(i.mensaje)}</td>
      <td>${i.pedido_codigo ? `<button class="enlace" data-ver-pedido="${esc(i.pedido_codigo)}">${esc(i.pedido_codigo)}</button>` : '—'}</td>
      <td><span class="estado estado-${esc(i.estado)}">${esc(i.estado)}</span><br>
        <button class="enlace" style="margin-top:6px; font-size:.78rem" data-id="${i.id}" data-nuevo="${i.estado === 'abierta' ? 'resuelta' : 'abierta'}">
          ${i.estado === 'abierta' ? 'Marcar resuelta' : 'Reabrir'}</button></td>
    </tr>`).join('') : '<tr><td colspan="7" class="vacio">No hay incidencias.</td></tr>'}</tbody></table></div>`;

  contenido.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', async () => {
    try {
      await llamar('admin/incidencias.php', { method: 'POST', body: { id: Number(b.dataset.id), estado: b.dataset.nuevo } });
      toast('Incidencia actualizada');
      incidencias();
    } catch (e) { toast(e.message, 'error'); }
  }));
  contenido.querySelectorAll('[data-ver-pedido]').forEach((b) => b.addEventListener('click', async () => {
    filtroPedidos.estado = '';
    filtroPedidos.q = '';
    pestanaActual = 'pedidos';
    document.querySelectorAll('[data-pestana]').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.pestana === 'pedidos')));
    await pedidos(b.dataset.verPedido);
  }));
}

comprobarSesion().catch((e) => {
  $('#vistaLogin').hidden = false;
  $('#errorLogin').innerHTML = `<div class="alerta error">${esc(e.message)}</div>`;
});
