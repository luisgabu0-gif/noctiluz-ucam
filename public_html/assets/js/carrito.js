// Estado del carrito en el navegador. Solo guarda qué se quiere comprar (SKU, modo, talla, cantidad):
// precios, nombres y stock se leen siempre del catálogo que sirve la API.

const CLAVE = 'noctiluz_carrito';
export const MAX_UNIDADES = 9;

let lineas = leer();

function leer() {
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE) || '[]');
    return Array.isArray(datos) ? datos.filter((l) => l && typeof l.sku === 'string' && Number.isInteger(l.cantidad)) : [];
  } catch {
    return [];
  }
}

function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(lineas)); } catch { /* sin persistencia */ }
  document.dispatchEvent(new CustomEvent('carrito:cambio'));
}

export const clave = (l) => `${l.sku}|${l.modo}|${l.talla}`;
export const obtener = () => lineas.map((l) => ({ ...l }));
export const unidades = () => lineas.reduce((s, l) => s + l.cantidad, 0);

export function anadir({ sku, modo, talla, cantidad }) {
  const existente = lineas.find((l) => clave(l) === clave({ sku, modo, talla }));
  if (existente) existente.cantidad = Math.min(MAX_UNIDADES, existente.cantidad + cantidad);
  else lineas.push({ sku, modo, talla, cantidad: Math.min(MAX_UNIDADES, cantidad) });
  guardar();
}

export function cambiarCantidad(k, cantidad) {
  const l = lineas.find((x) => clave(x) === k);
  if (!l) return;
  l.cantidad = Math.max(1, Math.min(MAX_UNIDADES, cantidad));
  guardar();
}

export function quitar(k) {
  const l = lineas.find((x) => clave(x) === k);
  lineas = lineas.filter((x) => clave(x) !== k);
  guardar();
  return l;
}

export function vaciar() {
  lineas = [];
  guardar();
}
