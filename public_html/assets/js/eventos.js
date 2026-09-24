// Instrumentación del lado del navegador: product.viewed, cart.item_added, cart.item_removed y checkout.started.
// Los eventos de pedido, pago y soporte los registra el servidor (ver app/Eventos.php).

const CLAVE_SESION = 'noctiluz_sesion';

function uuid() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Identificador anónimo de sesión: permite reconstruir el embudo sin guardar datos personales. */
export function sesionId() {
  let id = null;
  try { id = localStorage.getItem(CLAVE_SESION); } catch { /* almacenamiento bloqueado */ }
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) {
    id = uuid();
    try { localStorage.setItem(CLAVE_SESION, id); } catch { /* sin persistencia: sesión solo en memoria */ }
  }
  return id;
}

export function registrar(tipo, datos = {}) {
  const cuerpo = JSON.stringify({ tipo, datos, sesion_id: sesionId() });
  console.info('[evento]', tipo, datos);
  // keepalive: el evento se envía aunque el usuario cambie de página justo después.
  fetch('api/eventos.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo, keepalive: true })
    .catch(() => { /* la analítica nunca debe romper la compra */ });
}
