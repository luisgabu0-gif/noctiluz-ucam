<?php
declare(strict_types=1);

/**
 * Pasarela de pago SIMULADA. Solo acepta tarjetas de prueba conocidas (mismo convenio que usan
 * las pasarelas reales en modo test). El número completo nunca se guarda: solo los 4 últimos dígitos.
 */
final class Pagos
{
    public const TARJETAS_PRUEBA = [
        '4242424242424242' => ['aprobado',  'Pago simulado aprobado'],
        '5555555555554444' => ['aprobado',  'Pago simulado aprobado'],
        '4000000000000002' => ['rechazado', 'Tarjeta de prueba rechazada: fondos insuficientes'],
        '4000000000000069' => ['rechazado', 'Tarjeta de prueba rechazada: tarjeta caducada'],
    ];

    public static function simular(array $entrada): array
    {
        $val = new Validador();
        $codigo  = is_string($entrada['codigo'] ?? null) ? $entrada['codigo'] : '';
        $email   = $val->email($entrada['email'] ?? null);
        $val->texto($entrada['titular'] ?? null, 'titular', 3, 80, 'El titular');
        $numero  = preg_replace('/\D/', '', (string) ($entrada['numero'] ?? ''));
        $caduca  = (string) ($entrada['caducidad'] ?? '');
        $cvc     = (string) ($entrada['cvc'] ?? '');

        if (strlen($numero) < 13 || strlen($numero) > 19 || !self::luhn($numero)) {
            $val->error('numero', 'El número de tarjeta no es válido.');
        } elseif (!isset(self::TARJETAS_PRUEBA[$numero])) {
            $val->error('numero', 'Solo se aceptan las tarjetas de prueba indicadas. No introduzcas nunca una tarjeta real.');
        }
        if (!preg_match('/^(0[1-9]|1[0-2])\/(\d{2})$/', $caduca, $m)) {
            $val->error('caducidad', 'Usa el formato MM/AA.');
        } elseif ((int) ('20' . $m[2] . $m[1]) < (int) date('Ym')) {
            $val->error('caducidad', 'La fecha de caducidad ya ha pasado.');
        }
        if (!preg_match('/^\d{3}$/', $cvc)) {
            $val->error('cvc', 'El CVC son 3 cifras.');
        }
        $val->comprobar();

        return Db::transaccion(function () use ($codigo, $email, $numero) {
            $p = Db::uno('SELECT p.*, c.email FROM pedidos p JOIN clientes c ON c.id = p.cliente_id WHERE p.codigo = ?', [$codigo]);
            if ($p === null || mb_strtolower($p['email']) !== $email) {
                throw new ErrorNegocio('No encontramos ese pedido.', [], 404);
            }
            if ($p['estado'] !== 'creado') {
                throw new ErrorNegocio('Este pedido ya no está pendiente de pago.');
            }

            [$resultado, $mensaje] = self::TARJETAS_PRUEBA[$numero];
            $referencia = 'SIM-' . codigoAleatorio(10);
            $ultimos4 = substr($numero, -4);

            Db::insertar(
                'INSERT INTO pagos (pedido_id, metodo, resultado, importe, referencia, tarjeta_ultimos4, mensaje, creado_en)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [$p['id'], 'tarjeta_simulada', $resultado, $p['total'], $referencia, $ultimos4, $mensaje, ahora()]
            );
            Eventos::registrar('payment.simulated', [
                'codigo'     => $codigo,
                'resultado'  => $resultado,
                'importe'    => (float) $p['total'],
                'referencia' => $referencia,
            ], 'servidor', $p['sesion_id'], (int) $p['cliente_id'], (int) $p['id']);

            if ($resultado === 'aprobado') {
                Pedidos::cambiarEstado($p, 'pagado', 'Pago simulado aprobado', 'pasarela-simulada');
            }

            return ['resultado' => $resultado, 'mensaje' => $mensaje, 'referencia' => $referencia, 'codigo' => $codigo];
        });
    }

    private static function luhn(string $numero): bool
    {
        $suma = 0;
        $doble = false;
        for ($i = strlen($numero) - 1; $i >= 0; $i--) {
            $d = (int) $numero[$i];
            if ($doble) {
                $d *= 2;
                if ($d > 9) {
                    $d -= 9;
                }
            }
            $suma += $d;
            $doble = !$doble;
        }
        return $suma % 10 === 0;
    }
}
