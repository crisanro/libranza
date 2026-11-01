// src/lib/publico.ts
// Solo se usa desde el Server Component de /c/[token]. NO es "use server":
// así no queda expuesto como server action invocable desde el navegador.
import { db } from "@/lib/db/client";
import { usuarios, partidas, transacciones } from "@/lib/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { id as esquemaId } from "@/lib/validacion";

export async function obtenerEstadoPublico(token: string) {
  // Un token que no es UUID ni siquiera llega a la BD
  if (!esquemaId.safeParse(token).success) return null;

  // Buscar usuario por token público
  const usuario = await db.query.usuarios.findFirst({
    columns: { id: true, nombre: true },
    where: and(
      eq(usuarios.tokenPublico, token),
      isNull(usuarios.anuladoAt)
    ),
  });

  if (!usuario) return null;

  // Obtener partidas activas
  const listaPartidas = await db.query.partidas.findMany({
    columns: { id: true, nombre: true },
    where: and(
      eq(partidas.usuarioId, usuario.id),
      isNull(partidas.anuladoAt)
    ),
    orderBy: [asc(partidas.createdAt)],
  });

  // Por cada partida, obtener sus transacciones activas y calcular saldo
  const partidasConDatos = await Promise.all(
    listaPartidas.map(async (p) => {
      const lista = await db.query.transacciones.findMany({
        columns: {
          id: true,
          tipo: true,
          monto: true,
          descripcion: true,
          fechaReferencia: true,
          numeroCuota: true,
          totalCuotas: true,
        },
        where: and(
          eq(transacciones.partidaId, p.id),
          isNull(transacciones.anuladoAt)
        ),
        orderBy: [asc(transacciones.fechaReferencia), asc(transacciones.createdAt)],
      });

      const saldo = lista.reduce((acc, t) => {
        return t.tipo === "PRESTAMO"
          ? acc + Number(t.monto)
          : acc - Number(t.monto);
      }, 0);

      return { partida: p, transacciones: lista, saldo };
    })
  );

  const saldoTotal = partidasConDatos.reduce((acc, p) => acc + p.saldo, 0);

  return { usuario: { nombre: usuario.nombre }, partidas: partidasConDatos, saldoTotal };
}
