// Cliente HTTP de la API PHP. Todas las peticiones pasan por aquí.

export class ErrorApi extends Error {
  constructor(mensaje, estado, campos) {
    super(mensaje);
    this.estado = estado;
    this.campos = campos || {};
  }
}

export async function api(ruta, { method = 'GET', body, params } = {}) {
  let url = 'api/' + ruta;
  if (params) url += '?' + new URLSearchParams(params);
  let respuesta;
  try {
    respuesta = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ErrorApi('No hay conexión con el servidor. Inténtalo de nuevo.', 0);
  }
  let datos = null;
  try { datos = await respuesta.json(); } catch { /* respuesta sin JSON */ }
  if (!respuesta.ok) {
    throw new ErrorApi(datos?.error || `Error ${respuesta.status}`, respuesta.status, datos?.campos);
  }
  return datos;
}
