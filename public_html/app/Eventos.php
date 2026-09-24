<?php
declare(strict_types=1);

/**
 * Registro de eventos de negocio (tabla `eventos`).
 * Cada evento es un "sobre" con: uuid, tipo, origen, fecha, sesión, cliente, pedido y datos (JSON).
 */
final class Eventos
{
    /** Eventos que el navegador puede notificar (ocurren en la interfaz). */
    public const TIPOS_CLIENTE = ['product.viewed', 'cart.item_added', 'cart.item_removed', 'checkout.started'];

    /** Eventos que solo genera el servidor, dentro de la misma transacción que el cambio de datos. */
    public const TIPOS_SERVIDOR = ['order.created', 'payment.simulated', 'order.status_changed', 'support.requested'];

    public static function registrar(string $tipo, array $datos, string $origen, ?string $sesionId = null, ?int $clienteId = null, ?int $pedidoId = null): string
    {
        $uuid = uuid4();
        Db::insertar(
            'INSERT INTO eventos (uuid, tipo, origen, ocurrido_en, sesion_id, cliente_id, pedido_id, datos)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$uuid, $tipo, $origen, ahora(), $sesionId, $clienteId, $pedidoId, json_encode($datos, JSON_UNESCAPED_UNICODE)]
        );
        return $uuid;
    }

    /** Evento enviado por el navegador: se valida el tipo, la sesión y el tamaño antes de guardarlo. */
    public static function registrarDesdeCliente(array $entrada): string
    {
        $tipo = (string) ($entrada['tipo'] ?? '');
        if (!in_array($tipo, self::TIPOS_CLIENTE, true)) {
            throw new ErrorNegocio('Tipo de evento no permitido.');
        }
        $sesion = self::sesionValida($entrada['sesion_id'] ?? null);
        $datos = $entrada['datos'] ?? [];
        if (!is_array($datos)) {
            throw new ErrorNegocio('Los datos del evento deben ser un objeto.');
        }
        $limpios = [];
        foreach ($datos as $clave => $valor) {
            if (!is_string($clave) || !preg_match('/^[a-z_]{1,30}$/', $clave)) {
                continue;
            }
            if (is_string($valor)) {
                $limpios[$clave] = mb_substr($valor, 0, 80);
            } elseif (is_int($valor) || is_float($valor) || is_bool($valor) || $valor === null) {
                $limpios[$clave] = $valor;
            }
        }
        if (count($limpios) > 12) {
            throw new ErrorNegocio('Demasiados datos en el evento.');
        }
        return self::registrar($tipo, $limpios, 'cliente', $sesion);
    }

    public static function sesionValida($valor): ?string
    {
        return is_string($valor) && preg_match('/^[a-f0-9-]{36}$/', $valor) ? $valor : null;
    }

    /**
     * Consulta paginada por cursor (desde_id). Es la "API de consumo" pensada para la Tarea 2:
     * otro sistema guarda el último id leído y pide solo los eventos nuevos.
     */
    public static function listar(?string $tipo, int $desdeId, int $limite): array
    {
        $sql = 'SELECT e.id, e.uuid, e.tipo, e.origen, e.ocurrido_en, e.sesion_id, e.cliente_id, e.pedido_id, e.datos, p.codigo AS pedido_codigo
                  FROM eventos e LEFT JOIN pedidos p ON p.id = e.pedido_id
                 WHERE e.id > ?';
        $params = [$desdeId];
        if ($tipo !== null && $tipo !== '') {
            $sql .= ' AND e.tipo = ?';
            $params[] = $tipo;
        }
        $sql .= ' ORDER BY e.id ASC LIMIT ' . max(1, min($limite, 1000));
        $filas = Db::todos($sql, $params);
        foreach ($filas as &$f) {
            $f['id'] = (int) $f['id'];
            $f['cliente_id'] = $f['cliente_id'] !== null ? (int) $f['cliente_id'] : null;
            $f['pedido_id'] = $f['pedido_id'] !== null ? (int) $f['pedido_id'] : null;
            $f['datos'] = json_decode($f['datos'], true) ?? [];
        }
        return $filas;
    }

    public static function recuentoPorTipo(): array
    {
        $salida = [];
        foreach (Db::todos('SELECT tipo, COUNT(*) AS n FROM eventos GROUP BY tipo ORDER BY tipo') as $f) {
            $salida[$f['tipo']] = (int) $f['n'];
        }
        return $salida;
    }

    /** Embudo de conversión: nº de sesiones distintas que llegaron a cada paso. */
    public static function embudo(): array
    {
        $pasos = [
            'product.viewed'   => 'Ven un producto',
            'cart.item_added'  => 'Añaden al carrito',
            'checkout.started' => 'Inician el checkout',
            'order.created'    => 'Crean el pedido',
        ];
        $salida = [];
        foreach ($pasos as $tipo => $etiqueta) {
            $n = Db::uno('SELECT COUNT(DISTINCT sesion_id) AS n FROM eventos WHERE tipo = ? AND sesion_id IS NOT NULL', [$tipo]);
            $salida[] = ['tipo' => $tipo, 'etiqueta' => $etiqueta, 'sesiones' => (int) $n['n']];
        }
        $pagadas = Db::uno(
            "SELECT COUNT(DISTINCT e.sesion_id) AS n FROM eventos e
              WHERE e.tipo = 'payment.simulated' AND e.sesion_id IS NOT NULL AND e.datos LIKE '%\"resultado\":\"aprobado\"%'"
        );
        $salida[] = ['tipo' => 'payment.simulated', 'etiqueta' => 'Pagan (aprobado)', 'sesiones' => (int) $pagadas['n']];
        return $salida;
    }
}
