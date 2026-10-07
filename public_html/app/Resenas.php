<?php
declare(strict_types=1);

/**
 * Reseñas de la portada. No hay cuentas de cliente, así que "estar registrado" es tener un pedido:
 * para opinar hay que dar el código del pedido y su email, y el pedido tiene que estar pagado.
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

    public static function crear(array $entrada): array
    {
        if (self::esAdmin()) {
            throw new ErrorNegocio('El equipo de administración no puede publicar reseñas.', [], 403);
        }
        $val = new Validador();
        $email  = $val->email($entrada['email'] ?? null);
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

        $pedido = Db::uno('SELECT p.id, p.codigo, p.estado, p.cliente_id, c.email FROM pedidos p JOIN clientes c ON c.id = p.cliente_id WHERE p.codigo = ?', [$codigo]);
        // Igual que en soporte: si el email no coincide se responde lo mismo que si no existe.
        if ($pedido === null || mb_strtolower($pedido['email']) !== $email) {
            throw new ErrorNegocio('Revisa los datos marcados.', ['pedido' => 'No hay ningún pedido con ese código para este email.']);
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
