// src/lib/validacion.ts
// Las server actions son endpoints públicos: los tipos de TypeScript no
// existen en tiempo de ejecución, así que todo lo que llega se valida aquí.
import { z } from "zod";
import { MAX_CUOTAS } from "@/lib/limites";

// Límites que protegen al servidor (CPU/memoria) y a las columnas de la BD
const MAX_MONTO = 9_999_999_999.99; // numeric(12, 2)
const MAX_TASA = 999.99;            // numeric(5, 2)

export const FRECUENCIAS = [
  "DIARIO",
  "SEMANAL",
  "QUINCENAL",
  "MENSUAL",
  "AL_VENCIMIENTO",
] as const;

export const ORDENES_USUARIOS = [
  "nombre_asc",
  "creado_desc",
  "creado_asc",
  "ultimo_movimiento_desc",
] as const;

// ── Primitivos ──
export const idToken = z.string().min(1).max(4096);
export const id = z.uuid({ error: "Identificador inválido" });
export const nombre = z
  .string()
  .trim()
  .min(1, { error: "El nombre es obligatorio" })
  .max(150, { error: "El nombre es demasiado largo" });
export const descripcion = z
  .string()
  .trim()
  .max(500, { error: "La descripción es demasiado larga" });
export const monto = z
  .number({ error: "Monto inválido" })
  .positive({ error: "El monto debe ser mayor a cero" })
  .max(MAX_MONTO, { error: "El monto es demasiado grande" });
export const tasaAnual = z
  .number({ error: "Tasa inválida" })
  .min(0, { error: "La tasa no puede ser negativa" })
  .max(MAX_TASA, { error: "La tasa es demasiado alta" });
export const totalCuotas = z
  .number({ error: "Número de cuotas inválido" })
  .int({ error: "El número de cuotas debe ser entero" })
  .min(1, { error: "El número de cuotas debe ser mayor a cero" })
  .max(MAX_CUOTAS, { error: `Máximo ${MAX_CUOTAS} cuotas` });
export const frecuencia = z.enum(FRECUENCIAS, { error: "Frecuencia inválida" });
export const tipoTransaccion = z.enum(["PRESTAMO", "PAGO"], {
  error: "Tipo inválido",
});
export const fecha = z.iso.date({ error: "Fecha inválida" }); // YYYY-MM-DD

// ── Helper ──
export function validar<T extends z.ZodType>(esquema: T, datos: unknown): z.infer<T> {
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) {
    throw new Error(resultado.error.issues[0]?.message ?? "Datos inválidos");
  }
  return resultado.data;
}
