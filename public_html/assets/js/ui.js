// Utilidades de interfaz compartidas por la tienda y el back-office.

export function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const formatoEur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
export const eur = (n) => formatoEur.format(Number(n) || 0);

export function fecha(texto) {
  if (!texto) return '';
  const d = new Date(texto.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return texto;
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

let temporizadorToast;
export function toast(mensaje, tipo = '') {
  const t = document.getElementById('toast');
  t.textContent = mensaje;
  t.className = 'toast show ' + tipo;
  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(() => t.classList.remove('show'), 3000);
}

/** Pinta los errores por campo que devuelve la API ({campo: mensaje}) junto a cada input. */
export function mostrarErrores(form, campos) {
  limpiarErrores(form);
  let primero = null;
  for (const [nombre, mensaje] of Object.entries(campos || {})) {
    const input = form.querySelector(`[name="${CSS.escape(nombre)}"]`);
    if (!input) continue;
    input.setAttribute('aria-invalid', 'true');
    const hueco = form.querySelector(`[data-error-de="${CSS.escape(nombre)}"]`);
    if (hueco) hueco.textContent = mensaje;
    primero ??= input;
  }
  primero?.focus();
  return primero !== null;
}

export function limpiarErrores(form) {
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  form.querySelectorAll('[data-error-de]').forEach((el) => { el.textContent = ''; });
}

/** Validación en el navegador con los atributos HTML5 (required, pattern, type...) antes de llamar a la API. */
export function validarEnCliente(form) {
  const campos = {};
  form.querySelectorAll('input, select, textarea').forEach((el) => {
    if (!el.name || el.checkValidity()) return;
    campos[el.name] = el.dataset.mensaje || el.validationMessage;
  });
  if (Object.keys(campos).length) {
    mostrarErrores(form, campos);
    return false;
  }
  limpiarErrores(form);
  return true;
}

export function campo({ nombre, etiqueta, tipo = 'text', requerido = true, atributos = '', valor = '', ayuda = '', completo = false }) {
  const id = 'f-' + nombre;
  return `<div class="campo${completo ? ' completo' : ''}">
    <label for="${id}">${esc(etiqueta)}${requerido ? '' : ' <span class="opcional">(opcional)</span>'}</label>
    <input id="${id}" name="${nombre}" type="${tipo}" value="${esc(valor)}" ${requerido ? 'required' : ''} ${atributos}>
    ${ayuda ? `<small class="campo-ayuda">${ayuda}</small>` : ''}
    <small class="campo-error" data-error-de="${nombre}" role="alert"></small>
  </div>`;
}

// ---------- Ilustración SVG de la prenda (se usa cuando todavía no hay foto de esa variante) ----------
const FORMAS = {
  camiseta: { outline: 'M40 18 L58 8 L80 8 L98 18 L118 34 L104 50 L94 42 L94 132 L44 132 L44 42 L34 50 L20 34 Z',
              glow: 'M60 28 C 75 45, 62 70, 78 88 S 70 118, 82 124' },
  chaqueta: { outline: 'M38 16 L58 6 L69 16 L80 6 L98 16 L120 34 L106 52 L96 44 L96 132 L42 132 L42 44 L32 52 L18 34 Z',
              glow: 'M58 26 L58 120 M80 26 L80 120' },
  mochila:  { outline: 'M46 44 C46 22 96 22 96 44 L96 130 C96 138 88 142 71 142 C54 142 46 138 46 130 Z',
              glow: 'M52 60 C 52 90, 90 90, 90 60' },
  gorra:    { outline: 'M28 78 C28 42 116 42 116 78 L128 84 C130 88 128 92 122 92 L26 92 C20 92 18 88 20 84 Z',
              glow: 'M40 76 C 40 52, 104 52, 104 76' },
};

export function prenda(tipo, hex, { modo = 'fijo', variante = 'frontal' } = {}) {
  const f = FORMAS[tipo] || FORMAS.camiseta;
  const viewBox = variante === 'detalle' ? '30 20 80 100' : '0 0 140 150';
  const espejo = variante === 'trasera' ? 'transform="scale(-1,1) translate(-140,0)"' : '';
  return `<svg class="garment-svg mode-${esc(modo)}" viewBox="${viewBox}" style="--c:${esc(hex)}" aria-hidden="true">
    <g ${espejo}><path class="outline" d="${f.outline}"/><path class="glow-line" d="${f.glow}" stroke="${esc(hex)}"/></g>
  </svg>`;
}
