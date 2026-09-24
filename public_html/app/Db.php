<?php
declare(strict_types=1);

/** Capa de persistencia: única conexión PDO compartida por los servicios. */
final class Db
{
    private static ?PDO $pdo = null;
    private static array $config = [];

    public static function configurar(array $config): void
    {
        self::$config = $config;
    }

    public static function conexion(): PDO
    {
        if (self::$pdo !== null) {
            return self::$pdo;
        }
        $c = self::$config;
        $opciones = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ];
        if (($c['driver'] ?? 'mysql') === 'sqlite') {
            self::$pdo = new PDO('sqlite:' . $c['sqlite_ruta'], null, null, $opciones);
            self::$pdo->exec('PRAGMA foreign_keys = ON');
        } else {
            $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $c['host'], $c['puerto'] ?? 3306, $c['nombre']);
            $opciones[PDO::ATTR_EMULATE_PREPARES] = false;
            self::$pdo = new PDO($dsn, $c['usuario'], $c['clave'], $opciones);
        }
        return self::$pdo;
    }

    public static function uno(string $sql, array $params = []): ?array
    {
        $st = self::conexion()->prepare($sql);
        $st->execute($params);
        $fila = $st->fetch();
        return $fila === false ? null : $fila;
    }

    public static function todos(string $sql, array $params = []): array
    {
        $st = self::conexion()->prepare($sql);
        $st->execute($params);
        return $st->fetchAll();
    }

    /** Ejecuta una sentencia y devuelve el nº de filas afectadas. */
    public static function ejecutar(string $sql, array $params = []): int
    {
        $st = self::conexion()->prepare($sql);
        $st->execute($params);
        return $st->rowCount();
    }

    public static function insertar(string $sql, array $params = []): int
    {
        self::ejecutar($sql, $params);
        return (int) self::conexion()->lastInsertId();
    }

    /** Ejecuta $fn dentro de una transacción: o se guarda todo o no se guarda nada. */
    public static function transaccion(callable $fn)
    {
        $pdo = self::conexion();
        $pdo->beginTransaction();
        try {
            $resultado = $fn();
            $pdo->commit();
            return $resultado;
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}

function ahora(): string
{
    return date('Y-m-d H:i:s');
}

/** Código aleatorio legible (sin 0/O ni 1/I para que se pueda dictar por teléfono). */
function codigoAleatorio(int $longitud): string
{
    $alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $codigo = '';
    for ($i = 0; $i < $longitud; $i++) {
        $codigo .= $alfabeto[random_int(0, strlen($alfabeto) - 1)];
    }
    return $codigo;
}

function uuid4(): string
{
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

function euros(int $centimos): float
{
    return round($centimos / 100, 2);
}

function centimos($importe): int
{
    return (int) round(((float) $importe) * 100);
}
