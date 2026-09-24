<?php
declare(strict_types=1);

/** Ciclo de vida del pedido: creación, consulta y cambios de estado. */
final class Pedidos
{
    /** Valida el checkout completo y crea cliente, pedido, líneas, historial y evento en UNA transacción. */
    public static function crear(array $entrada): array
    {
        $val = new Validador();
        $cli = is_array($entrada['cliente'] ?? null) ? $entrada['cliente'] : [];
        $dir = is_array($entrada['direccion'] ?? null) ? $entrada['direccion'] : [];

        $nombre    = $val->texto($cli['nombre'] ?? null, 'nombre', 3, 100, 'El nombre');
        $email     = $val->email($cli['email'] ?? null);
        $telefono  = $val->telefono($cli['telefono'] ?? null);
        $linea     = $val->texto($dir['linea'] ?? null, 'linea', 5, 160, 'La dirección');
        $cp        = $val->codigoPostal($dir['cp'] ?? null);
        $ciudad    = $val->texto($dir['ciudad'] ?? null, 'ciudad', 2, 80, 'La ciudad');
        $provincia = $val->texto($dir['provincia'] ?? null, 'provincia', 2, 80, 'La provincia');
        $envio     = $val->opcion($entrada['envio'] ?? null, array_keys(ReglasNegocio::METODOS_ENVIO), 'envio', 'Elige un método de envío.');
        $val->verdadero($entrada['acepta_condiciones'] ?? null, 'acepta_condiciones', 'Debes aceptar las condiciones del prototipo.');
        $val->comprobar();

        $cupon = is_string($entrada['cupon'] ?? null) ? $entrada['cupon'] : '';
        $sesion = Eventos::sesionValida($entrada['sesion_id'] ?? null);

        return Db::transaccion(function () use ($entrada, $nombre, $email, $telefono, $linea, $cp, $ciudad, $provincia, $envio, $cupon, $sesion) {
            $lineas = ReglasNegocio::validarLineas($entrada['lineas'] ?? null);
            $t = ReglasNegocio::calcular($lineas, $cupon, $envio, true);

            $clienteId = Clientes::obtenerOCrear($nombre, $email, $telefono);
            $codigo = self::nuevoCodigo();
            $fecha = ahora();

            $pedidoId = Db::insertar(
                'INSERT INTO pedidos (codigo, cliente_id, sesion_id, estado, metodo_envio, cupon_codigo, subtotal, descuento, envio,
                                      base_imponible, iva, total, dir_linea, dir_cp, dir_ciudad, dir_provincia, creado_en, actualizado_en)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [$codigo, $clienteId, $sesion, 'creado', $envio, $t['cupon']['codigo'] ?? null,
                 euros($t['subtotal']), euros($t['descuento']), euros($t['envio']), euros($t['base_imponible']),
                 euros($t['iva']), euros($t['total']), $linea, $cp, $ciudad, $provincia, $fecha, $fecha]
            );

            foreach ($lineas as $l) {
                Db::insertar(
                    'INSERT INTO lineas_pedido (pedido_id, variante_id, descripcion, modo_id, talla, cantidad, precio_unitario, importe)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [$pedidoId, $l['variante_id'], $l['descripcion'], $l['modo'], $l['talla'], $l['cantidad'], euros($l['precio']), euros($l['importe'])]
                );
                // La condición "stock >= ?" evita vender de más si dos clientes compran a la vez.
                $ok = Db::ejecutar('UPDATE variantes SET stock = stock - ? WHERE id = ? AND stock >= ?', [$l['cantidad'], $l['variante_id'], $l['cantidad']]);
                if ($ok !== 1) {
                    throw new ErrorNegocio("Se acaban de agotar las unidades de {$l['descripcion']}.");
                }
            }

            self::anotarHistorial($pedidoId, null, 'creado', 'Pedido generado desde la tienda', 'cliente');
            Eventos::registrar('order.created', [
                'codigo'       => $codigo,
                'total'        => euros($t['total']),
                'lineas'       => count($lineas),
                'metodo_envio' => $envio,
                'cupon'        => $t['cupon']['codigo'] ?? null,
            ], 'servidor', $sesion, $clienteId, $pedidoId);

            return ['codigo' => $codigo, 'estado' => 'creado', 'total' => euros($t['total'])];
        });
    }

    private static function nuevoCodigo(): string
    {
        do {
            $codigo = 'NCZ-' . date('ymd') . '-' . codigoAleatorio(6);
        } while (Db::uno('SELECT id FROM pedidos WHERE codigo = ?', [$codigo]) !== null);
        return $codigo;
    }

    public static function anotarHistorial(int $pedidoId, ?string $anterior, string $nuevo, ?string $motivo, string $actor): void
    {
        Db::insertar(
            'INSERT INTO historial_estados (pedido_id, estado_anterior, estado_nuevo, motivo, actor, creado_en) VALUES (?, ?, ?, ?, ?, ?)',
            [$pedidoId, $anterior, $nuevo, $motivo, $actor, ahora()]
        );
    }

    /** Detalle completo de un pedido (para back-office o para su propio cliente). */
    public static function detalle(string $codigo): ?array
    {
        $p = Db::uno(
            'SELECT p.*, c.nombre AS cliente_nombre, c.email AS cliente_email, c.telefono AS cliente_telefono
               FROM pedidos p JOIN clientes c ON c.id = p.cliente_id WHERE p.codigo = ?',
            [$codigo]
        );
        if ($p === null) {
            return null;
        }
        $id = (int) $p['id'];
        $p['estado_nombre'] = ReglasNegocio::ESTADOS[$p['estado']] ?? $p['estado'];
        $p['metodo_envio_nombre'] = ReglasNegocio::METODOS_ENVIO[$p['metodo_envio']] ?? $p['metodo_envio'];
        foreach (['subtotal', 'descuento', 'envio', 'base_imponible', 'iva', 'total'] as $k) {
            $p[$k] = (float) $p[$k];
        }
        $p['lineas'] = Db::todos(
            'SELECT l.descripcion, l.modo_id AS modo, m.nombre AS modo_nombre, l.talla, l.cantidad, l.precio_unitario, l.importe, v.sku, v.imagen
               FROM lineas_pedido l JOIN variantes v ON v.id = l.variante_id JOIN modos m ON m.id = l.modo_id
              WHERE l.pedido_id = ? ORDER BY l.id',
            [$id]
        );
        $p['pagos'] = Db::todos(
            'SELECT metodo, resultado, importe, referencia, tarjeta_ultimos4, mensaje, creado_en FROM pagos WHERE pedido_id = ? ORDER BY id',
            [$id]
        );
        $p['historial'] = Db::todos(
            'SELECT estado_anterior, estado_nuevo, motivo, actor, creado_en FROM historial_estados WHERE pedido_id = ? ORDER BY id',
            [$id]
        );
        $p['transiciones'] = array_values(array_diff(ReglasNegocio::TRANSICIONES[$p['estado']] ?? [], ReglasNegocio::ESTADOS_SOLO_SISTEMA));
        return $p;
    }

    /** Vista del cliente: exige que el email coincida y oculta los datos internos. */
    public static function paraCliente(string $codigo, string $email): ?array
    {
        $p = self::detalle($codigo);
        if ($p === null || mb_strtolower($p['cliente_email']) !== mb_strtolower(trim($email))) {
            return null;
        }
        unset($p['id'], $p['cliente_id'], $p['sesion_id'], $p['transiciones'], $p['cliente_telefono']);
        foreach ($p['historial'] as &$h) {
            unset($h['actor']);
        }
        return $p;
    }

    public static function listar(?string $estado, ?string $busqueda): array
    {
        $sql = 'SELECT p.codigo, p.estado, p.total, p.metodo_envio, p.creado_en, c.nombre AS cliente_nombre, c.email AS cliente_email,
                       (SELECT COALESCE(SUM(l.cantidad), 0) FROM lineas_pedido l WHERE l.pedido_id = p.id) AS unidades
                  FROM pedidos p JOIN clientes c ON c.id = p.cliente_id WHERE 1 = 1';
        $params = [];
        if ($estado !== null && isset(ReglasNegocio::ESTADOS[$estado])) {
            $sql .= ' AND p.estado = ?';
            $params[] = $estado;
        }
        if ($busqueda !== null && trim($busqueda) !== '') {
            $sql .= ' AND (p.codigo LIKE ? OR c.nombre LIKE ? OR c.email LIKE ?)';
            $like = '%' . trim($busqueda) . '%';
            array_push($params, $like, $like, $like);
        }
        $sql .= ' ORDER BY p.creado_en DESC, p.id DESC LIMIT 200';
        $filas = Db::todos($sql, $params);
        foreach ($filas as &$f) {
            $f['total'] = (float) $f['total'];
            $f['unidades'] = (int) $f['unidades'];
            $f['estado_nombre'] = ReglasNegocio::ESTADOS[$f['estado']] ?? $f['estado'];
        }
        return $filas;
    }

    /**
     * Cambia el estado respetando la máquina de estados. Si se cancela, devuelve el stock.
     * Debe llamarse dentro de una transacción.
     */
    public static function cambiarEstado(array $pedido, string $nuevo, ?string $motivo, string $actor): void
    {
        $actual = $pedido['estado'];
        if (!ReglasNegocio::puedeTransicionar($actual, $nuevo)) {
            $de = ReglasNegocio::ESTADOS[$actual] ?? $actual;
            $a = ReglasNegocio::ESTADOS[$nuevo] ?? $nuevo;
            throw new ErrorNegocio("No se puede pasar un pedido de «{$de}» a «{$a}».");
        }
        Db::ejecutar('UPDATE pedidos SET estado = ?, actualizado_en = ? WHERE id = ?', [$nuevo, ahora(), $pedido['id']]);

        if ($nuevo === 'cancelado') {
            foreach (Db::todos('SELECT variante_id, cantidad FROM lineas_pedido WHERE pedido_id = ?', [$pedido['id']]) as $l) {
                Db::ejecutar('UPDATE variantes SET stock = stock + ? WHERE id = ?', [$l['cantidad'], $l['variante_id']]);
            }
        }

        self::anotarHistorial((int) $pedido['id'], $actual, $nuevo, $motivo, $actor);
        Eventos::registrar('order.status_changed', [
            'codigo' => $pedido['codigo'], 'de' => $actual, 'a' => $nuevo, 'actor' => $actor, 'motivo' => $motivo,
        ], 'servidor', $pedido['sesion_id'] ?? null, (int) $pedido['cliente_id'], (int) $pedido['id']);
    }

    /** Cambio de estado manual desde el back-office. */
    public static function cambiarEstadoAdmin(array $entrada, string $actor): array
    {
        $codigo = is_string($entrada['codigo'] ?? null) ? $entrada['codigo'] : '';
        $nuevo = is_string($entrada['estado'] ?? null) ? $entrada['estado'] : '';
        $motivo = is_string($entrada['motivo'] ?? null) ? mb_substr(trim($entrada['motivo']), 0, 200) : null;
        if (in_array($nuevo, ReglasNegocio::ESTADOS_SOLO_SISTEMA, true)) {
            throw new ErrorNegocio('El estado «pagado» solo lo asigna la pasarela de pago simulada.');
        }
        return Db::transaccion(function () use ($codigo, $nuevo, $motivo, $actor) {
            $p = Db::uno('SELECT * FROM pedidos WHERE codigo = ?', [$codigo]);
            if ($p === null) {
                throw new ErrorNegocio('Pedido no encontrado.', [], 404);
            }
            self::cambiarEstado($p, $nuevo, $motivo ?: null, $actor);
            return self::detalle($codigo);
        });
    }
}
