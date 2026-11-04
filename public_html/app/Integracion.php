<?php
declare(strict_types=1);

/**
 * Integración con n8n (Tarea 2). Sigue docs/contrato_integracion.md.
 *
 * Salida: cada evento de negocio se guarda en la cola «integracion_salida» dentro de la misma transacción
 * que el cambio de datos, y se envía al terminar la petición. Si n8n no responde (en Render se duerme),
 * se reintenta con espera creciente, así que un pedido nunca se pierde por un fallo de red.
 *
 * Entrada: n8n cambia estados de pedido por api/integracion/pedidos.php, siempre a través de la máquina de estados.
 */
final class Integracion
{
    /** Eventos que viajan por webhook. El resto se consulta en bloque con api/admin/eventos.php. */
    public const TIPOS_ENVIADOS = ['order.created', 'payment.simulated', 'order.status_changed', 'support.requested'];

    /** Espera antes de cada reintento, en minutos. Cubre de sobra lo que tarda en despertar n8n. */
    private const ESPERAS_MINUTOS = [1, 2, 4, 8, 16, 30, 60, 60];

    private const LOTE = 5;
    private const TIMEOUT_SEGUNDOS = 10;
    private const RESERVA_MINUTOS = 2;

    private static function config(): array
    {
        return $GLOBALS['config']['integracion'] ?? [];
    }

    public static function activa(): bool
    {
        return !empty(self::config()['activo']);
    }

    // ── Salida: tienda → n8n ─────────────────────────────────────────────────────────────────────

    /** Debe llamarse dentro de la transacción del evento: o se guardan los dos o ninguno. */
    public static function encolar(string $uuid, string $tipo, array $datos, string $ocurrido, ?string $sesion, ?int $pedidoId): void
    {
        if (!self::activa() || !in_array($tipo, self::TIPOS_ENVIADOS, true)) {
            return;
        }
        // Lo que ya viene del back-office no se le devuelve: evita bucles.
        if (strpos((string) ($datos['actor'] ?? ''), 'integracion:') === 0) {
            return;
        }
        $cuerpo = [
            'version'     => 1,
            'id'          => $uuid,
            'tipo'        => $tipo,
            'ocurrido_en' => date('c', (int) strtotime($ocurrido)),
            'origen'      => 'servidor',
            'sesion_id'   => $sesion,
            'datos'       => $datos,
        ];
        if ($tipo === 'support.requested') {
            $cuerpo['incidencia'] = self::fotoIncidencia((string) $datos['codigo']);
        } elseif ($pedidoId !== null) {
            $cuerpo['pedido'] = self::fotoPedido((string) $datos['codigo']);
        }
        Db::insertar(
            'INSERT INTO integracion_salida (evento_uuid, tipo, cuerpo, estado, intentos, siguiente_intento, creado_en)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [$uuid, $tipo, json_encode($cuerpo, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 'pendiente', 0, ahora(), ahora()]
        );
    }

    /** Foto del pedido en el momento del evento: así el receptor no tiene que volver a preguntar a la tienda. */
    private static function fotoPedido(string $codigo): ?array
    {
        $p = Pedidos::detalle($codigo);
        if ($p === null) {
            return null;
        }
        return [
            'codigo'    => $p['codigo'],
            'estado'    => $p['estado'],
            'creado_en' => date('c', (int) strtotime($p['creado_en'])),
            'cliente'   => ['nombre' => $p['cliente_nombre'], 'email' => mb_strtolower($p['cliente_email']), 'telefono' => $p['cliente_telefono']],
            'lineas'    => array_map(fn ($l) => [
                'sku'             => $l['sku'],
                'descripcion'     => $l['descripcion'],
                'modo'            => $l['modo'],
                'talla'           => $l['talla'],
                'cantidad'        => (int) $l['cantidad'],
                'precio_unitario' => (float) $l['precio_unitario'],
                'importe'         => (float) $l['importe'],
            ], $p['lineas']),
            'totales'   => [
                'subtotal'       => $p['subtotal'],
                'descuento'      => $p['descuento'],
                'envio'          => $p['envio'],
                'base_imponible' => $p['base_imponible'],
                'iva'            => $p['iva'],
                'total'          => $p['total'],
            ],
            'envio'     => [
                'metodo'    => $p['metodo_envio'],
                'zona'      => ReglasNegocio::zonaEnvio($p['dir_cp']),
                'cp'        => $p['dir_cp'],
                'ciudad'    => $p['dir_ciudad'],
                'provincia' => $p['dir_provincia'],
            ],
        ];
    }

    private static function fotoIncidencia(string $codigo): ?array
    {
        $i = Db::uno(
            'SELECT i.codigo, i.motivo, i.mensaje, i.creado_en, i.nombre, i.email, p.codigo AS pedido_codigo
               FROM incidencias i LEFT JOIN pedidos p ON p.id = i.pedido_id WHERE i.codigo = ?',
            [$codigo]
        );
        if ($i === null) {
            return null;
        }
        return [
            'codigo'        => $i['codigo'],
            'motivo'        => $i['motivo'],
            'mensaje'       => $i['mensaje'],
            'creada_en'     => date('c', (int) strtotime($i['creado_en'])),
            'cliente'       => ['nombre' => $i['nombre'], 'email' => mb_strtolower($i['email'])],
            'pedido_codigo' => $i['pedido_codigo'],
        ];
    }

    /** Se ejecuta al acabar cada petición de la API: primero se libera al cliente y después se habla con n8n. */
    public static function alTerminar(): void
    {
        try {
            if (!self::activa() || self::vencidos() === 0) {
                return;
            }
            ignore_user_abort(true);
            if (session_status() === PHP_SESSION_ACTIVE) {
                session_write_close();
            }
            if (function_exists('fastcgi_finish_request')) {
                fastcgi_finish_request();
            } elseif (function_exists('litespeed_finish_request')) {
                litespeed_finish_request();
            } else {
                while (ob_get_level() > 0) {
                    ob_end_flush();
                }
                flush();
            }
            self::procesar();
        } catch (Throwable $e) {
            // Un fallo aquí nunca debe afectar a la compra: el evento sigue en la cola.
            error_log('[NOCTILUZ] Integración: ' . $e->getMessage());
        }
    }

    private static function vencidos(): int
    {
        $f = Db::uno("SELECT COUNT(*) AS n FROM integracion_salida WHERE estado = 'pendiente' AND siguiente_intento <= ?", [ahora()]);
        return (int) $f['n'];
    }

    /** Envía los eventos vencidos, del más antiguo al más nuevo. Si n8n no responde, se para hasta el siguiente turno. */
    public static function procesar(int $limite = self::LOTE): array
    {
        $resumen = ['enviados' => 0, 'reintentar' => 0, 'fallidos' => 0];
        $filas = Db::todos(
            "SELECT id, tipo, evento_uuid, cuerpo, intentos, siguiente_intento FROM integracion_salida
              WHERE estado = 'pendiente' AND siguiente_intento <= ? ORDER BY id LIMIT " . max(1, min($limite, 50)),
            [ahora()]
        );
        foreach ($filas as $f) {
            // Reserva: si dos peticiones coinciden, solo una envía el evento.
            $reserva = date('Y-m-d H:i:s', time() + self::RESERVA_MINUTOS * 60);
            if (Db::ejecutar(
                "UPDATE integracion_salida SET siguiente_intento = ? WHERE id = ? AND estado = 'pendiente' AND siguiente_intento = ?",
                [$reserva, $f['id'], $f['siguiente_intento']]
            ) !== 1) {
                continue;
            }
            [$codigo, $error] = self::enviar($f);
            $resultado = self::anotar($f, $codigo, $error);
            $resumen[$resultado]++;
            if ($resultado === 'reintentar') {
                break;
            }
        }
        return $resumen;
    }

    /** @return array{0:int,1:?string} código HTTP (0 si no hubo respuesta) y descripción del error */
    private static function enviar(array $f): array
    {
        $c = self::config();
        if (empty($c['url']) || empty($c['token'])) {
            return [0, 'Falta configurar integracion.url o integracion.token.'];
        }
        if (!function_exists('curl_init')) {
            return [0, 'El servidor no tiene cURL.'];
        }
        $ch = curl_init($c['url']);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $f['cuerpo'],
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $c['token'],
                'Idempotency-Key: ' . $f['evento_uuid'],
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT        => self::TIMEOUT_SEGUNDOS,
        ]);
        $respuesta = curl_exec($ch);
        $codigo = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $errorRed = $respuesta === false ? curl_error($ch) : null;
        curl_close($ch);
        if ($errorRed !== null) {
            return [0, $errorRed];
        }
        return [$codigo, $codigo >= 200 && $codigo < 300 ? null : mb_substr((string) $respuesta, 0, 280)];
    }

    /** Apartado 3 del contrato: un 4xx no se arregla repitiendo; un 5xx o un timeout sí merece otro intento. */
    private static function anotar(array $f, int $codigo, ?string $error): string
    {
        $intentos = (int) $f['intentos'] + 1;
        if ($codigo >= 200 && $codigo < 300) {
            Db::ejecutar(
                "UPDATE integracion_salida SET estado = 'enviado', intentos = ?, ultimo_codigo = ?, ultimo_error = NULL, enviado_en = ? WHERE id = ?",
                [$intentos, $codigo, ahora(), $f['id']]
            );
            return 'enviados';
        }
        $transitorio = $codigo === 0 || $codigo >= 500 || in_array($codigo, [408, 429], true);
        if ($transitorio && $intentos <= count(self::ESPERAS_MINUTOS)) {
            $siguiente = date('Y-m-d H:i:s', time() + self::ESPERAS_MINUTOS[$intentos - 1] * 60);
            Db::ejecutar(
                'UPDATE integracion_salida SET intentos = ?, ultimo_codigo = ?, ultimo_error = ?, siguiente_intento = ? WHERE id = ?',
                [$intentos, $codigo ?: null, $error, $siguiente, $f['id']]
            );
            return 'reintentar';
        }
        Db::ejecutar(
            "UPDATE integracion_salida SET estado = 'fallido', intentos = ?, ultimo_codigo = ?, ultimo_error = ? WHERE id = ?",
            [$intentos, $codigo ?: null, $error, $f['id']]
        );
        return 'fallidos';
    }

    /** Vuelve a poner en cola un envío fallido (apartado 4.2: reenvío a mano). */
    public static function reenviar($id): void
    {
        $id = filter_var($id, FILTER_VALIDATE_INT);
        if ($id === false || Db::ejecutar(
            "UPDATE integracion_salida SET estado = 'pendiente', intentos = 0, siguiente_intento = ? WHERE id = ? AND estado = 'fallido'",
            [ahora(), $id]
        ) !== 1) {
            throw new ErrorNegocio('No hay ningún envío fallido con ese id.', [], 404);
        }
    }

    /** Estado de la cola: lo que hay por enviar y lo que falló. */
    public static function estadoCola(): array
    {
        $recuento = ['pendiente' => 0, 'enviado' => 0, 'fallido' => 0];
        foreach (Db::todos('SELECT estado, COUNT(*) AS n FROM integracion_salida GROUP BY estado') as $f) {
            $recuento[$f['estado']] = (int) $f['n'];
        }
        return [
            'activa'  => self::activa(),
            'cola'    => $recuento,
            'ultimos' => Db::todos(
                "SELECT id, evento_uuid, tipo, estado, intentos, siguiente_intento, ultimo_codigo, ultimo_error, creado_en, enviado_en
                   FROM integracion_salida WHERE estado <> 'enviado' ORDER BY id DESC LIMIT 50"
            ),
        ];
    }

    // ── Entrada: n8n → tienda ────────────────────────────────────────────────────────────────────

    public static function exigirToken(): void
    {
        $esperado = (string) (self::config()['token'] ?? '');
        $cabecera = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        // Algunos hostings no pasan Authorization a PHP: por eso se admite también una cabecera propia.
        $recibido = preg_match('/^Bearer\s+(\S+)$/', (string) $cabecera, $m) ? $m[1] : (string) ($_SERVER['HTTP_X_NOCTILUZ_TOKEN'] ?? '');
        if (strlen($esperado) < 20 || !hash_equals($esperado, $recibido)) {
            throw new ErrorNegocio('Token no válido.', [], 401);
        }
    }

    /** Apartado 6 del contrato: cambio de estado hecho en el back-office. La tienda sigue aplicando sus reglas. */
    public static function aplicarEstado(array $e): array
    {
        $codigo = is_string($e['codigo'] ?? null) ? trim($e['codigo']) : '';
        $estado = is_string($e['estado'] ?? null) ? $e['estado'] : '';
        $campos = [];
        if (!preg_match('/^NCZ-\d{6}-[A-Z0-9]{6}$/', $codigo)) {
            $campos['codigo'] = 'Falta el código del pedido o no tiene el formato correcto.';
        }
        if (!isset(ReglasNegocio::ESTADOS[$estado])) {
            $campos['estado'] = 'El estado no existe.';
        }
        if ($campos) {
            throw new ErrorNegocio('Revisa los campos marcados.', $campos, 422);
        }
        if (in_array($estado, ReglasNegocio::ESTADOS_SOLO_SISTEMA, true)) {
            throw new ErrorNegocio('El estado «pagado» solo lo asigna la pasarela de pago.', [], 409);
        }
        $motivo = is_string($e['motivo'] ?? null) ? mb_substr(trim($e['motivo']), 0, 200) : null;
        return Db::transaccion(function () use ($codigo, $estado, $motivo) {
            $p = Db::uno('SELECT * FROM pedidos WHERE codigo = ?', [$codigo]);
            if ($p === null) {
                throw new ErrorNegocio('Pedido no encontrado.', [], 404);
            }
            if ($p['estado'] === $estado) {
                return ['ok' => true, 'sin_cambios' => true, 'estado' => $estado];
            }
            if (!ReglasNegocio::puedeTransicionar($p['estado'], $estado)) {
                $de = ReglasNegocio::ESTADOS[$p['estado']] ?? $p['estado'];
                throw new ErrorNegocio("No se puede pasar un pedido de «{$de}» a «" . ReglasNegocio::ESTADOS[$estado] . '».', [], 409);
            }
            Pedidos::cambiarEstado($p, $estado, $motivo ?: 'Cambio hecho en el back-office', 'integracion:backoffice');
            return ['ok' => true, 'estado' => $estado];
        });
    }

    /** Respuesta de soporte aprobada por una persona. Repetirla no duplica nada: se sobrescribe con el mismo texto. */
    public static function guardarRespuesta(array $e): array
    {
        $codigo = is_string($e['codigo'] ?? null) ? trim($e['codigo']) : '';
        $respuesta = is_string($e['respuesta'] ?? null) ? trim($e['respuesta']) : '';
        if ($respuesta === '' || mb_strlen($respuesta) > 1000) {
            throw new ErrorNegocio('Revisa los campos marcados.', ['respuesta' => 'Debe tener entre 1 y 1000 caracteres.'], 422);
        }
        $i = Db::uno('SELECT id FROM incidencias WHERE codigo = ?', [$codigo]);
        if ($i === null) {
            throw new ErrorNegocio('Incidencia no encontrada.', [], 404);
        }
        Incidencias::responder(['id' => (int) $i['id'], 'respuesta' => $respuesta], 'integracion:backoffice');
        return ['ok' => true, 'codigo' => $codigo];
    }

    // ── Telegram ─────────────────────────────────────────────────────────────────────────────────

    /** Enlace al bot para vincular el pedido. La firma evita que alguien vincule un pedido ajeno. */
    public static function enlaceTelegram(string $codigo): ?string
    {
        $c = self::config();
        if (empty($c['bot_telegram']) || empty($c['secreto_telegram'])) {
            return null;
        }
        $firma = substr(hash_hmac('sha256', $codigo, (string) $c['secreto_telegram']), 0, 10);
        return 'https://t.me/' . rawurlencode((string) $c['bot_telegram']) . '?start=' . $codigo . '_' . $firma;
    }
}
