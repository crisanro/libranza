// src/lib/actions/publico.ts
"use server";

import { db } from "@/lib/db/client";
import { usuarios, partidas, transacciones } from "@/lib/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";

export async function obtenerEstadoPublico(token: string) {
  // Buscar usuario por token público
  const usuario = await db.query.usuarios.findFirst({
    where: and(
      eq(usuarios.tokenPublico, token),
      isNull(usuarios.anuladoAt)
    ),
  });

  if (!usuario) return null;

  // Obtener partidas activas
  const listaPartidas = await db.query.partidas.findMany({
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

  return { usuario, partidas: partidasConDatos, saldoTotal };
}