<?php
declare(strict_types=1);

/**
 * Pago con PayPal en entorno SANDBOX (API Orders v2). Flujo:
 *   1. crear(): la tienda crea una orden en PayPal por el total del pedido (calculado en el servidor)
 *      y devuelve la URL de PayPal donde el cliente aprueba el pago con una cuenta de prueba.
 *   2. PayPal devuelve al cliente a api/paypal.php?accion=volver con el id de la orden (token).
 *   3. volver(): la tienda captura (cobra) la orden, comprueba que el pedido y el importe coinciden
 *      y guarda pago, cambio de estado, evento y factura en una transacción.
 * Las credenciales son de una app sandbox (config.php → 'paypal'); no se mueve dinero real.
 */
final class PagoPaypal
{
    public static function activo(): bool
    {
        return (bool) config('paypal.activo', false) && config('paypal.client_id') && config('paypal.secreto');
    }

    /** Paso 1: crea la orden en PayPal y devuelve la URL de aprobación. */
    public static function crear(array $entrada): array
    {
        if (!self::activo()) {
            throw new ErrorNegocio('El pago con PayPal no está configurado en esta tienda.', [], 503);
        }
        $val = new Validador();
        $email = $val->email($entrada['email'] ?? null);
        $val->comprobar();
        $codigo = is_string($entrada['codigo'] ?? null) ? $entrada['codigo'] : '';
        $p = self::pedidoPendiente($codigo);
        if (mb_strtolower($p['email']) !== $email) {
            throw new ErrorNegocio('No encontramos ese pedido.', [], 404);
        }

        $base = urlTienda();
        [$estado, $orden] = self::peticion('POST', '/v2/checkout/orders', [
            'intent' => 'CAPTURE',
            'purchase_units' => [[
                'reference_id' => $codigo,
                'custom_id'    => $codigo,
                'description'  => "Pedido $codigo · NOCTILUZ (prototipo académico)",
                'amount'       => ['currency_code' => 'EUR', 'value' => self::importe($p['total'])],
            ]],
            'payment_source' => ['paypal' => ['experience_context' => [
                'brand_name'          => 'NOCTILUZ (prototipo)',
                'locale'              => 'es-ES',
                'shipping_preference' => 'NO_SHIPPING',
                'user_action'         => 'PAY_NOW',
                'return_url'          => "$base/api/paypal.php?accion=volver&codigo=" . rawurlencode($codigo),
                'cancel_url'          => "$base/#/pago/" . rawurlencode($codigo),
            ]]],
        ]);
        foreach ($orden['links'] ?? [] as $l) {
            if (in_array($l['rel'] ?? '', ['payer-action', 'approve'], true)) {
                return ['url' => $l['href'], 'orden' => $orden['id'] ?? null];
            }
        }
        error_log('[NOCTILUZ] PayPal no devolvió enlace de aprobación: HTTP ' . $estado . ' ' . json_encode($orden));
        throw new ErrorNegocio('PayPal no ha aceptado la orden de pago. Inténtalo de nuevo.', [], 502);
    }

    /**
     * Paso 3: el cliente vuelve de PayPal. Captura la orden y registra el resultado.
     * Si el pedido ya estaba pagado (el cliente recarga la página), no se cobra dos veces.
     */
    public static function volver(string $codigo, string $orden): array
    {
        if (!self::activo()) {
            throw new ErrorNegocio('El pago con PayPal no está configurado en esta tienda.', [], 503);
        }
        if (!preg_match('/^[A-Z0-9]{10,30}$/', $orden)) {
            throw new ErrorNegocio('Respuesta de PayPal no válida.');
        }
        $p = Db::uno('SELECT p.*, c.email FROM pedidos p JOIN clientes c ON c.id = p.cliente_id WHERE p.codigo = ?', [$codigo]);
        if ($p === null) {
            throw new ErrorNegocio('No encontramos ese pedido.', [], 404);
        }
        if ($p['estado'] !== 'creado') {
            return ['resultado' => 'ya_procesado', 'codigo' => $codigo];
        }

        // PayPal-Request-Id hace la captura idempotente: repetirla con el mismo id no cobra dos veces.
        [$estado, $r] = self::peticion('POST', "/v2/checkout/orders/$orden/capture", null, ['PayPal-Request-Id: captura-' . $orden]);
        $captura = $r['purchase_units'][0]['payments']['captures'][0] ?? null;
        $referenciaPedido = $r['purchase_units'][0]['reference_id'] ?? null;

        if ($estado >= 200 && $estado < 300 && ($r['status'] ?? '') === 'COMPLETED' && ($captura['status'] ?? '') === 'COMPLETED') {
            $cobrado = ($captura['amount']['currency_code'] ?? '') . ' ' . ($captura['amount']['value'] ?? '');
            if ($referenciaPedido !== $codigo || $cobrado !== 'EUR ' . self::importe($p['total'])) {
                // No debería pasar nunca: lo registramos como rechazado para revisarlo a mano.
                return self::registrar($p, 'rechazado', 'PP-' . $captura['id'], "PayPal cobró $cobrado, que no coincide con el pedido", $orden);
            }
            return self::registrar($p, 'aprobado', 'PP-' . $captura['id'], 'Pago aprobado en PayPal (sandbox)', $orden);
        }

        $motivo = $r['details'][0]['description'] ?? $r['message'] ?? 'PayPal no ha completado el pago';
        return self::registrar($p, 'rechazado', 'PP-' . substr($orden, 0, 24) . '-' . codigoAleatorio(4), 'PayPal: ' . mb_substr((string) $motivo, 0, 140), $orden);
    }

    /** Guarda el intento de pago (y, si se aprueba, el cambio a «pagado» y la factura) en una transacción. */
    private static function registrar(array $p, string $resultado, string $referencia, string $mensaje, string $orden): array
    {
        $r = Db::transaccion(function () use ($p, $resultado, $referencia, $mensaje, $orden) {
            $actual = Db::uno('SELECT * FROM pedidos WHERE id = ?', [$p['id']]);
            if ($actual['estado'] !== 'creado') {
                return ['resultado' => 'ya_procesado', 'codigo' => $p['codigo']];
            }
            Db::insertar(
                'INSERT INTO pagos (pedido_id, metodo, resultado, importe, referencia, tarjeta_ultimos4, mensaje, creado_en)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [$p['id'], 'paypal_sandbox', $resultado, $p['total'], mb_substr($referencia, 0, 40), null, $mensaje, ahora()]
            );
            // Mismo tipo de evento que el pago con tarjeta de prueba, para que quien consume los eventos no cambie.
            Eventos::registrar('payment.simulated', [
                'codigo'       => $p['codigo'],
                'resultado'    => $resultado,
                'importe'      => (float) $p['total'],
                'referencia'   => $referencia,
                'pasarela'     => 'paypal_sandbox',
                'orden_paypal' => $orden,
            ], 'servidor', $p['sesion_id'], (int) $p['cliente_id'], (int) $p['id']);
            if ($resultado === 'aprobado') {
                Pedidos::cambiarEstado($actual, 'pagado', 'Pago aprobado en PayPal (sandbox)', 'paypal-sandbox');
                Facturas::emitir((int) $p['id'], $p['email']);
            }
            return ['resultado' => $resultado, 'mensaje' => $mensaje, 'referencia' => $referencia, 'codigo' => $p['codigo']];
        });
        if ($r['resultado'] === 'aprobado') {
            $r['factura_envio'] = Facturas::enviar($p['codigo']);
        }
        return $r;
    }

    private static function pedidoPendiente(string $codigo): array
    {
        $p = Db::uno('SELECT p.*, c.email FROM pedidos p JOIN clientes c ON c.id = p.cliente_id WHERE p.codigo = ?', [$codigo]);
        if ($p === null) {
            throw new ErrorNegocio('No encontramos ese pedido.', [], 404);
        }
        if ($p['estado'] !== 'creado') {
            throw new ErrorNegocio('Este pedido ya no está pendiente de pago.');
        }
        return $p;
    }

    /** Importe con punto decimal y dos cifras, como lo exige PayPal ("67.05"). */
    private static function importe($total): string
    {
        return number_format((float) $total, 2, '.', '');
    }

    /** Token OAuth de la app sandbox (client_credentials). */
    private static function token(): string
    {
        $c = self::curl(rtrim((string) config('paypal.api'), '/') . '/v1/oauth2/token', [
            CURLOPT_POST       => true,
            CURLOPT_POSTFIELDS => 'grant_type=client_credentials',
            CURLOPT_USERPWD    => config('paypal.client_id') . ':' . config('paypal.secreto'),
            CURLOPT_HTTPHEADER => ['Accept: application/json', 'Content-Type: application/x-www-form-urlencoded'],
        ]);
        if ($c[0] !== 200 || !isset($c[1]['access_token'])) {
            error_log('[NOCTILUZ] PayPal OAuth falló: HTTP ' . $c[0]);
            throw new ErrorNegocio('No se ha podido conectar con PayPal (credenciales sandbox no válidas).', [], 502);
        }
        return $c[1]['access_token'];
    }

    /** Llamada autenticada a la API de PayPal. Devuelve [código HTTP, JSON decodificado]. */
    private static function peticion(string $metodo, string $ruta, ?array $cuerpo, array $cabeceras = []): array
    {
        $opciones = [
            CURLOPT_CUSTOMREQUEST => $metodo,
            CURLOPT_HTTPHEADER    => array_merge(['Content-Type: application/json', 'Authorization: Bearer ' . self::token()], $cabeceras),
            CURLOPT_POSTFIELDS    => $cuerpo === null ? '' : json_encode($cuerpo, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ];
        return self::curl(rtrim((string) config('paypal.api'), '/') . $ruta, $opciones);
    }

    private static function curl(string $url, array $opciones): array
    {
        if (!function_exists('curl_init')) {
            throw new ErrorNegocio('El servidor no tiene la extensión curl de PHP, necesaria para PayPal.', [], 500);
        }
        $ch = curl_init($url);
        curl_setopt_array($ch, $opciones + [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_CONNECTTIMEOUT => 8]);
        $respuesta = curl_exec($ch);
        $estado = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        if ($respuesta === false) {
            error_log('[NOCTILUZ] PayPal sin respuesta: ' . $error);
            throw new ErrorNegocio('No se ha podido contactar con PayPal. Inténtalo de nuevo en unos minutos.', [], 502);
        }
        return [$estado, json_decode((string) $respuesta, true) ?? []];
    }
}
