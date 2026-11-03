<?php
declare(strict_types=1);
require __DIR__ . '/_inicio.php';

// POST /api/paypal.php {accion: "crear", codigo, email} → {url}: crea la orden en PayPal sandbox y devuelve dónde aprobarla.
// GET  /api/paypal.php?accion=volver&codigo=…&token=…   → PayPal devuelve aquí al cliente; se captura el pago y se
//                                                         redirige a la página del pedido (o a la de pago si falla).
if (metodo() === 'GET' && parametro('accion') === 'volver') {
    $codigo = (string) parametro('codigo');
    $destino = urlTienda() . '/#/pago/' . rawurlencode($codigo);
    try {
        $r = PagoPaypal::volver($codigo, (string) parametro('token'));
        if (in_array($r['resultado'], ['aprobado', 'ya_procesado'], true)) {
            $destino = urlTienda() . '/#/pedido/' . rawurlencode($codigo);
        }
    } catch (Throwable $e) {
        error_log('[NOCTILUZ] Vuelta de PayPal: ' . $e->getMessage());
    }
    header('Location: ' . $destino, true, 303);
    exit;
}

permitir('POST');
$e = cuerpoJson();
if (($e['accion'] ?? '') !== 'crear') {
    responder(['error' => 'Acción no válida.'], 400);
}
responder(PagoPaypal::crear($e));
