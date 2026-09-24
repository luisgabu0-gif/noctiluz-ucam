<?php
declare(strict_types=1);

/** Error de negocio o de validación: se devuelve al cliente con código 422 y el detalle por campo. */
class ErrorNegocio extends RuntimeException
{
    public array $detalles;
    public int $http;

    public function __construct(string $mensaje, array $detalles = [], int $http = 422)
    {
        parent::__construct($mensaje);
        $this->detalles = $detalles;
        $this->http = $http;
    }
}

/** Acumula errores de validación por campo y los lanza todos juntos. */
final class Validador
{
    private array $errores = [];

    public function texto($valor, string $campo, int $min, int $max, string $etiqueta): string
    {
        $v = is_string($valor) ? trim(preg_replace('/\s+/u', ' ', $valor)) : '';
        $largo = mb_strlen($v);
        if ($largo < $min) {
            $this->errores[$campo] = $min <= 1 ? "$etiqueta es obligatorio." : "$etiqueta debe tener al menos $min caracteres.";
        } elseif ($largo > $max) {
            $this->errores[$campo] = "$etiqueta no puede superar $max caracteres.";
        }
        return $v;
    }

    public function email($valor, string $campo = 'email'): string
    {
        $v = is_string($valor) ? mb_strtolower(trim($valor)) : '';
        if ($v === '' || mb_strlen($v) > 120 || filter_var($v, FILTER_VALIDATE_EMAIL) === false) {
            $this->errores[$campo] = 'Introduce un email válido.';
        }
        return $v;
    }

    public function telefono($valor, string $campo = 'telefono'): ?string
    {
        $v = is_string($valor) ? preg_replace('/[\s.-]/', '', $valor) : '';
        if ($v === '') {
            return null;
        }
        if (!preg_match('/^(\+34)?[6789]\d{8}$/', $v)) {
            $this->errores[$campo] = 'El teléfono debe ser un número español de 9 cifras.';
        }
        return $v;
    }

    public function codigoPostal($valor, string $campo = 'cp'): string
    {
        $v = is_string($valor) ? trim($valor) : '';
        if (!preg_match('/^(0[1-9]|[1-4]\d|5[0-2])\d{3}$/', $v)) {
            $this->errores[$campo] = 'El código postal debe tener 5 cifras y ser de España.';
        }
        return $v;
    }

    public function opcion($valor, array $permitidos, string $campo, string $mensaje): string
    {
        $v = is_string($valor) ? $valor : '';
        if (!in_array($v, $permitidos, true)) {
            $this->errores[$campo] = $mensaje;
        }
        return $v;
    }

    public function verdadero($valor, string $campo, string $mensaje): void
    {
        if ($valor !== true) {
            $this->errores[$campo] = $mensaje;
        }
    }

    public function error(string $campo, string $mensaje): void
    {
        $this->errores[$campo] = $mensaje;
    }

    public function comprobar(string $mensaje = 'Revisa los datos marcados.'): void
    {
        if ($this->errores) {
            throw new ErrorNegocio($mensaje, $this->errores);
        }
    }
}
