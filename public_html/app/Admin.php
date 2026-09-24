<?php
declare(strict_types=1);

/** Acceso al back-office con sesión PHP y contraseña cifrada con password_hash (bcrypt). */
final class Admin
{
    public static function iniciarSesionPhp(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
        session_name('NOCTILUZ_ADMIN');
        session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'secure' => $https, 'samesite' => 'Strict']);
        session_start();
    }

    public static function login(array $entrada): array
    {
        self::iniciarSesionPhp();
        $email = is_string($entrada['email'] ?? null) ? mb_strtolower(trim($entrada['email'])) : '';
        $clave = is_string($entrada['clave'] ?? null) ? $entrada['clave'] : '';
        $u = Db::uno('SELECT id, email, nombre, password_hash FROM usuarios_admin WHERE email = ?', [$email]);
        if ($u === null || !password_verify($clave, $u['password_hash'])) {
            usleep(400000); // frena los intentos de fuerza bruta
            throw new ErrorNegocio('Email o contraseña incorrectos.', [], 401);
        }
        session_regenerate_id(true);
        $_SESSION['admin'] = ['id' => (int) $u['id'], 'email' => $u['email'], 'nombre' => $u['nombre']];
        return $_SESSION['admin'];
    }

    public static function logout(): void
    {
        self::iniciarSesionPhp();
        $_SESSION = [];
        session_destroy();
    }

    public static function actual(): ?array
    {
        self::iniciarSesionPhp();
        return $_SESSION['admin'] ?? null;
    }

    public static function exigir(): array
    {
        $a = self::actual();
        if ($a === null) {
            throw new ErrorNegocio('Inicia sesión en el back-office.', [], 401);
        }
        return $a;
    }

    public static function metricas(): array
    {
        $ventas = Db::uno(
            "SELECT COUNT(*) AS pedidos, COALESCE(SUM(total), 0) AS facturacion
               FROM pedidos WHERE estado NOT IN ('creado', 'cancelado')"
        );
        $porEstado = [];
        foreach (Db::todos('SELECT estado, COUNT(*) AS n FROM pedidos GROUP BY estado') as $f) {
            $porEstado[$f['estado']] = (int) $f['n'];
        }
        $pedidosPagados = (int) $ventas['pedidos'];
        $facturacion = (float) $ventas['facturacion'];
        $top = Db::todos(
            "SELECT l.descripcion, SUM(l.cantidad) AS unidades
               FROM lineas_pedido l JOIN pedidos p ON p.id = l.pedido_id
              WHERE p.estado NOT IN ('creado', 'cancelado')
              GROUP BY l.descripcion ORDER BY unidades DESC LIMIT 5"
        );
        return [
            'pedidos_total'       => array_sum($porEstado),
            'pedidos_pagados'     => $pedidosPagados,
            'facturacion'         => round($facturacion, 2),
            'ticket_medio'        => $pedidosPagados > 0 ? round($facturacion / $pedidosPagados, 2) : 0,
            'por_estado'          => $porEstado,
            'incidencias_abiertas'=> (int) Db::uno("SELECT COUNT(*) AS n FROM incidencias WHERE estado = 'abierta'")['n'],
            'stock_bajo'          => Db::todos('SELECT sku, stock FROM variantes WHERE stock <= 3 ORDER BY stock, sku'),
            'mas_vendidos'        => array_map(fn ($f) => ['descripcion' => $f['descripcion'], 'unidades' => (int) $f['unidades']], $top),
            'eventos_por_tipo'    => Eventos::recuentoPorTipo(),
            'embudo'              => Eventos::embudo(),
            'estados'             => ReglasNegocio::ESTADOS,
        ];
    }
}
