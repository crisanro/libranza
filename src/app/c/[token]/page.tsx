// src/app/c/[token]/page.tsx
import { obtenerEstadoPublico } from "@/lib/actions/publico";
import { notFound } from "next/navigation";

const C = {
  fondo:   "#191510",
  card:    "#221C15",
  borde:   "rgba(201, 184, 150, 0.12)",
  texto:   "#EDE3CE",
  muted:   "#8C826F",
  tenue:   "#5A5345",
  acento:  "#7A9B6E",
  alerta:  "#D08B6A",
};

function fmt(valor: number) {
  return valor.toLocaleString("es-EC", { style: "currency", currency: "USD" });
}

function fmtFecha(fecha: string) {
  return new Date(fecha + "T12:00:00").toLocaleDateString("es-EC", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default async function EstadoPublicoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await obtenerEstadoPublico(token);
  if (!data) notFound();

  const { usuario, partidas, saldoTotal } = data;

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.fondo }}>
      <div className="mx-auto max-w-2xl px-4 py-10">

        {/* Header */}
        <div className="mb-2 text-center">
          <span className="text-xs uppercase tracking-[0.2em]" style={{ color: C.tenue }}>
            Estado de cuenta
          </span>
        </div>
        <h1 className="text-center text-2xl"
          style={{ fontFamily: "var(--font-fraunces)", color: C.texto }}>
          {usuario.nombre}
        </h1>

        {/* Saldo total */}
        <div className="mx-auto mt-6 max-w-xs rounded-2xl border px-6 py-5 text-center"
          style={{ backgroundColor: C.card, borderColor: C.borde }}>
          <p className="text-xs" style={{ color: C.muted }}>Saldo total</p>
          <p className="mt-1 text-3xl font-medium"
            style={{ fontFamily: "var(--font-fraunces)", color: saldoTotal >= 0 ? C.acento : C.alerta }}>
            {fmt(Math.abs(saldoTotal))}
          </p>
          <p className="mt-1 text-xs" style={{ color: C.tenue }}>
            {saldoTotal >= 0 ? "Pendiente por pagar" : "Pagado de más"}
          </p>
        </div>

        {/* Partidas */}
        <div className="mt-10 flex flex-col gap-3">
          {partidas.length === 0 ? (
            <p className="text-center text-sm" style={{ color: C.muted }}>
              No hay partidas registradas todavía.
            </p>
          ) : (
            partidas.map(({ partida, transacciones, saldo }) => (
              <PartidaColapsable
                key={partida.id}
                nombre={partida.nombre}
                saldo={saldo}
                transacciones={transacciones}
              />
            ))
          )}
        </div>

        <p className="mt-10 text-center text-xs" style={{ color: C.tenue }}>
          Este es un enlace de solo lectura. Cualquier duda, contacta directamente.
        </p>
      </div>
    </div>
  );
}

// ── Componente colapsable por partida ──
function PartidaColapsable({
  nombre,
  saldo,
  transacciones,
}: {
  nombre: string;
  saldo: number;
  transacciones: {
    id: string;
    tipo: string;
    monto: string;
    descripcion: string | null;
    fechaReferencia: string;
    numeroCuota: number | null;
    totalCuotas: number | null;
  }[];
}) {
  // Server component — usamos details/summary nativo para el colapsable sin JS
  return (
    <details className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: C.card, borderColor: C.borde }}>
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3.5 list-none">
        <span className="text-sm font-medium" style={{ color: C.texto }}>{nombre}</span>
        <span className="text-sm font-medium"
          style={{ color: saldo >= 0 ? C.acento : C.alerta }}>
          {fmt(Math.abs(saldo))}
        </span>
      </summary>

      <div className="flex flex-col gap-1.5 border-t px-4 py-3"
        style={{ borderColor: C.borde }}>
        {transacciones.length === 0 ? (
          <p className="text-xs" style={{ color: C.tenue }}>Sin movimientos.</p>
        ) : (
          transacciones.map(t => {
            const esPrestamo = t.tipo === "PRESTAMO";
            const monto = Number(t.monto);
            return (
              <div key={t.id} className="rounded-lg border px-3 py-2.5"
                style={{ borderColor: C.borde }}>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm" style={{ color: C.texto }}>
                      {t.descripcion || (esPrestamo ? "Préstamo" : "Pago")}
                    </span>
                    <span className="text-xs" style={{ color: C.tenue }}>
                      {fmtFecha(t.fechaReferencia)}
                    </span>
                    {t.numeroCuota && (
                      <span className="text-xs" style={{ color: C.tenue }}>
                        Cuota {t.numeroCuota}/{t.totalCuotas}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium"
                    style={{ color: esPrestamo ? C.alerta : C.acento }}>
                    {esPrestamo ? "+" : "−"}{fmt(monto)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </details>
  );
}