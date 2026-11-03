<?php
declare(strict_types=1);

/**
 * Reseñas de la portada. Para opinar hay que haber iniciado sesión con una cuenta de cliente
 * y elegir uno de sus pedidos ya pagados (una reseña por pedido).
 * El equipo de administración no puede opinar.
 */
final class Resenas
{
    /** Estados en los que el cliente ya ha comprado (el pedido está pagado). */
    public const ESTADOS_CON_COMPRA = ['pagado', 'en_preparacion', 'enviado', 'entregado', 'incidencia'];

    public static function ultimas(int $cuantas = 3): array
    {
        $filas = Db::todos('SELECT nombre, prenda, estrellas, texto, creado_en FROM resenas ORDER BY creado_en DESC, id DESC LIMIT ' . $cuantas);
        foreach ($filas as &$f) {
            $f['estrellas'] = (int) $f['estrellas'];
        }
        return $filas;
    }

    /** Solo se mira la sesión si el navegador trae su cookie: así no se abre una sesión a cada visitante. */
    public static function esAdmin(): bool
    {
        return isset($_COOKIE['NOCTILUZ_ADMIN']) && Admin::actual() !== null;
    }

    /** Pedidos pagados de un cliente que todavía no tienen reseña: los que puede valorar. */
    public static function pedidosParaOpinar(int $clienteId): array
    {
        $marcas = implode(', ', array_fill(0, count(self::ESTADOS_CON_COMPRA), '?'));
        $filas = Db::todos(
            "SELECT p.codigo FROM pedidos p LEFT JOIN resenas r ON r.pedido_id = p.id
              WHERE p.cliente_id = ? AND r.id IS NULL AND p.estado IN ($marcas) ORDER BY p.creado_en DESC, p.id DESC",
            [$clienteId, ...self::ESTADOS_CON_COMPRA]
        );
        return array_column($filas, 'codigo');
    }

    public static function crear(array $entrada): array
    {
        if (self::esAdmin()) {
            throw new ErrorNegocio('El equipo de administración no puede publicar reseñas.', [], 403);
        }
        $cliente = Cuentas::actual();
        if ($cliente === null) {
            throw new ErrorNegocio('Inicia sesión en tu cuenta para añadir una reseña.', [], 401);
        }
        $val = new Validador();
        $nombre = $val->texto($entrada['nombre'] ?? null, 'nombre', 2, 40, 'El nombre');
        $texto  = $val->texto($entrada['texto'] ?? null, 'texto', 10, 400, 'La opinión');
        $estrellas = filter_var($entrada['estrellas'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 5]]);
        if ($estrellas === false) {
            $val->error('estrellas', 'Elige de 1 a 5 estrellas.');
        }
        $codigo = is_string($entrada['pedido'] ?? null) ? mb_strtoupper(trim($entrada['pedido'])) : '';
        if ($codigo === '') {
            $val->error('pedido', 'Indica el código de tu pedido.');
        }
        $val->comprobar();

        // Solo vale un pedido de la propia cuenta: así nadie puede opinar con pedidos ajenos.
        $pedido = Db::uno('SELECT id, codigo, estado, cliente_id FROM pedidos WHERE codigo = ? AND cliente_id = ?', [$codigo, $cliente['id']]);
        if ($pedido === null) {
            throw new ErrorNegocio('Revisa los datos marcados.', ['pedido' => 'No tienes ningún pedido con ese código.']);
        }
        if (!in_array($pedido['estado'], self::ESTADOS_CON_COMPRA, true)) {
            throw new ErrorNegocio('Revisa los datos marcados.', ['pedido' => 'Solo se puede opinar de un pedido ya pagado.']);
        }
        if (Db::uno('SELECT id FROM resenas WHERE pedido_id = ?', [$pedido['id']]) !== null) {
            throw new ErrorNegocio('Revisa los datos marcados.', ['pedido' => 'Ya hay una reseña de este pedido.']);
        }

        // La prenda que se muestra sale del propio pedido, no de lo que escriba el cliente.
        $lineas = Db::todos('SELECT descripcion FROM lineas_pedido WHERE pedido_id = ? ORDER BY id', [$pedido['id']]);
        $prenda = $lineas[0]['descripcion'] . (count($lineas) > 1 ? ' y ' . (count($lineas) - 1) . ' más' : '');
        $sesion = Eventos::sesionValida($entrada['sesion_id'] ?? null);

        return Db::transaccion(function () use ($pedido, $nombre, $prenda, $estrellas, $texto, $sesion) {
            Db::insertar(
                'INSERT INTO resenas (pedido_id, nombre, prenda, estrellas, texto, creado_en) VALUES (?, ?, ?, ?, ?, ?)',
                [$pedido['id'], $nombre, $prenda, $estrellas, $texto, ahora()]
            );
            Eventos::registrar('review.created', [
                'pedido' => $pedido['codigo'], 'estrellas' => $estrellas,
            ], 'servidor', $sesion, (int) $pedido['cliente_id'], (int) $pedido['id']);
            return ['nombre' => $nombre, 'prenda' => $prenda, 'estrellas' => $estrellas, 'texto' => $texto];
        });
    }
}
