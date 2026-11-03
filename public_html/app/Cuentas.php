<?php
declare(strict_types=1);

/**
 * Cuentas de cliente: registro e inicio de sesión con email y contraseña (cifrada con bcrypt).
 * La cuenta es la misma fila de `clientes` que usan los pedidos, así que si alguien se registra
 * con un email con el que ya había comprado, esos pedidos aparecen en «Mi cuenta».
 */
final class Cuentas
{
    public const SESION = 'NOCTILUZ_CLIENTE';

    public static function registrar(array $entrada): array
    {
        $val = new Validador();
        $nombre = $val->texto($entrada['nombre'] ?? null, 'nombre', 3, 100, 'El nombre');
        $email  = $val->email($entrada['email'] ?? null);
        $clave  = is_string($entrada['clave'] ?? null) ? $entrada['clave'] : '';
        if (mb_strlen($clave) < 8 || mb_strlen($clave) > 100) {
            $val->error('clave', 'La contraseña debe tener entre 8 y 100 caracteres.');
        }
        $val->comprobar();

        $existente = Db::uno('SELECT id, clave_hash FROM clientes WHERE email = ?', [$email]);
        if ($existente !== null && $existente['clave_hash'] !== null) {
            throw new ErrorNegocio('Revisa los datos marcados.', ['email' => 'Ya hay una cuenta con este email. Inicia sesión.']);
        }
        $hash = password_hash($clave, PASSWORD_DEFAULT);
        $sesion = Eventos::sesionValida($entrada['sesion_id'] ?? null);

        $id = Db::transaccion(function () use ($existente, $nombre, $email, $hash, $sesion) {
            $fecha = ahora();
            if ($existente !== null) {
                // Ya había comprado sin cuenta: se le pone contraseña a su ficha de cliente.
                Db::ejecutar('UPDATE clientes SET nombre = ?, clave_hash = ?, registrado_en = ? WHERE id = ?', [$nombre, $hash, $fecha, $existente['id']]);
                $id = (int) $existente['id'];
            } else {
                $id = Db::insertar(
                    'INSERT INTO clientes (nombre, email, telefono, creado_en, clave_hash, registrado_en) VALUES (?, ?, NULL, ?, ?, ?)',
                    [$nombre, $email, $fecha, $hash, $fecha]
                );
            }
            Eventos::registrar('customer.registered', ['ya_habia_comprado' => $existente !== null], 'servidor', $sesion, $id);
            return $id;
        });
        return self::guardarEnSesion($id, $nombre, $email);
    }

    public static function login(array $entrada): array
    {
        $email = is_string($entrada['email'] ?? null) ? mb_strtolower(trim($entrada['email'])) : '';
        $clave = is_string($entrada['clave'] ?? null) ? $entrada['clave'] : '';
        $c = Db::uno('SELECT id, nombre, email, clave_hash FROM clientes WHERE email = ?', [$email]);
        if ($c === null || $c['clave_hash'] === null || !password_verify($clave, $c['clave_hash'])) {
            usleep(400000); // frena los intentos de fuerza bruta
            throw new ErrorNegocio('Email o contraseña incorrectos.', [], 401);
        }
        return self::guardarEnSesion((int) $c['id'], $c['nombre'], $c['email']);
    }

    public static function logout(): void
    {
        if (!isset($_COOKIE[self::SESION])) {
            return;
        }
        abrirSesion(self::SESION);
        $_SESSION = [];
        session_destroy();
        setcookie(self::SESION, '', ['expires' => time() - 3600, 'path' => '/']);
    }

    /** Cliente con la sesión iniciada, o null. Sin la cookie no se abre ninguna sesión. */
    public static function actual(): ?array
    {
        if (!isset($_COOKIE[self::SESION])) {
            return null;
        }
        abrirSesion(self::SESION);
        return $_SESSION['cliente'] ?? null;
    }

    /** Lo que ve el cliente en «Mi cuenta»: sus pedidos y sus incidencias con la respuesta del equipo. */
    public static function resumen(array $cliente): array
    {
        $pedidos = Db::todos(
            'SELECT codigo, estado, total, creado_en FROM pedidos WHERE cliente_id = ? ORDER BY creado_en DESC, id DESC',
            [$cliente['id']]
        );
        foreach ($pedidos as &$p) {
            $p['total'] = (float) $p['total'];
            $p['estado_nombre'] = ReglasNegocio::ESTADOS[$p['estado']] ?? $p['estado'];
        }
        return ['cliente' => $cliente, 'pedidos' => $pedidos, 'incidencias' => Incidencias::deCliente($cliente['email'])];
    }

    private static function guardarEnSesion(int $id, string $nombre, string $email): array
    {
        abrirSesion(self::SESION);
        session_regenerate_id(true);
        $_SESSION['cliente'] = ['id' => $id, 'nombre' => $nombre, 'email' => $email];
        return $_SESSION['cliente'];
    }
}

/**
 * Abre la sesión PHP con ese nombre de cookie (NOCTILUZ_ADMIN o NOCTILUZ_CLIENTE).
 * PHP solo tiene una sesión activa a la vez: si había otra abierta, se guarda y se cierra antes.
 */
function abrirSesion(string $nombre): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        if (session_name() === $nombre) {
            return;
        }
        session_write_close();
    }
    $guardada = $_COOKIE[$nombre] ?? '';
    // Cadena vacía = PHP crea un identificador nuevo; si no, se retoma la sesión de esa cookie.
    session_id(is_string($guardada) && preg_match('/^[A-Za-z0-9,-]{22,256}$/', $guardada) ? $guardada : '');
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    session_name($nombre);
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'secure' => $https, 'samesite' => 'Strict']);
    session_start();
}
