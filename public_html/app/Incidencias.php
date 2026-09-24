<?php
declare(strict_types=1);

/** Soporte postventa: solicitudes e incidencias, opcionalmente asociadas a un pedido. */
final class Incidencias
{
    public const MOTIVOS = [
        'pedido'     => 'Duda sobre un pedido',
        'envio'      => 'Problema con el envío',
        'producto'   => 'Producto defectuoso o no se enciende',
        'devolucion' => 'Devolución o cambio',
        'otro'       => 'Otra consulta',
    ];

    public static function crear(array $entrada): array
    {
        $val = new Validador();
        $nombre  = $val->texto($entrada['nombre'] ?? null, 'nombre', 3, 100, 'El nombre');
        $email   = $val->email($entrada['email'] ?? null);
        $motivo  = $val->opcion($entrada['motivo'] ?? null, array_keys(self::MOTIVOS), 'motivo', 'Elige un motivo.');
        $mensaje = $val->texto($entrada['mensaje'] ?? null, 'mensaje', 10, 1000, 'El mensaje');
        $codigoPedido = is_string($entrada['pedido'] ?? null) ? mb_strtoupper(trim($entrada['pedido'])) : '';
        $val->comprobar();

        $pedido = null;
        if ($codigoPedido !== '') {
            $pedido = Db::uno('SELECT p.id, p.codigo, p.cliente_id, c.email FROM pedidos p JOIN clientes c ON c.id = p.cliente_id WHERE p.codigo = ?', [$codigoPedido]);
            // Solo se vincula si el email coincide: así nadie puede "adivinar" pedidos ajenos.
            if ($pedido === null || mb_strtolower($pedido['email']) !== $email) {
                throw new ErrorNegocio('Revisa los datos marcados.', ['pedido' => 'No hay ningún pedido con ese código para este email.']);
            }
        }
        $sesion = Eventos::sesionValida($entrada['sesion_id'] ?? null);

        return Db::transaccion(function () use ($nombre, $email, $motivo, $mensaje, $pedido, $sesion) {
            $codigo = 'INC-' . date('ymd') . '-' . codigoAleatorio(4);
            Db::insertar(
                'INSERT INTO incidencias (codigo, pedido_id, nombre, email, motivo, mensaje, estado, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [$codigo, $pedido['id'] ?? null, $nombre, $email, $motivo, $mensaje, 'abierta', ahora()]
            );
            Eventos::registrar('support.requested', [
                'codigo' => $codigo, 'motivo' => $motivo, 'pedido' => $pedido['codigo'] ?? null,
            ], 'servidor', $sesion, isset($pedido['cliente_id']) ? (int) $pedido['cliente_id'] : null, isset($pedido['id']) ? (int) $pedido['id'] : null);
            return ['codigo' => $codigo];
        });
    }

    public static function listar(): array
    {
        $filas = Db::todos(
            'SELECT i.id, i.codigo, i.nombre, i.email, i.motivo, i.mensaje, i.estado, i.creado_en, p.codigo AS pedido_codigo
               FROM incidencias i LEFT JOIN pedidos p ON p.id = i.pedido_id
              ORDER BY i.estado = \'abierta\' DESC, i.creado_en DESC'
        );
        foreach ($filas as &$f) {
            $f['id'] = (int) $f['id'];
            $f['motivo_nombre'] = self::MOTIVOS[$f['motivo']] ?? $f['motivo'];
        }
        return $filas;
    }

    public static function cambiarEstado(array $entrada): void
    {
        $id = filter_var($entrada['id'] ?? null, FILTER_VALIDATE_INT);
        $estado = $entrada['estado'] ?? '';
        if ($id === false || !in_array($estado, ['abierta', 'resuelta'], true)) {
            throw new ErrorNegocio('Datos no válidos.');
        }
        if (Db::ejecutar('UPDATE incidencias SET estado = ? WHERE id = ?', [$estado, $id]) === 0
            && Db::uno('SELECT id FROM incidencias WHERE id = ?', [$id]) === null) {
            throw new ErrorNegocio('Incidencia no encontrada.', [], 404);
        }
    }
}
