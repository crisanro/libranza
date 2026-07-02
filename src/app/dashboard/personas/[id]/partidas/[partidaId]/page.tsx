// src/app/dashboard/personas/[id]/partidas/[partidaId]/page.tsx
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import {
  listarTransacciones,
  agregarTransaccion,
  agregarPrestamoCuotas,
  simularAmortizacion,
  anularTransaccion,
  anularGrupo,
} from "@/lib/actions/transacciones";

interface TransaccionItem {
  id: string;
  tipo: string;
  monto: string;
  descripcion: string | null;
  fechaReferencia: string;
  grupoId: string | null;
  numeroCuota: number | null;
  totalCuotas: number | null;
  createdAt: Date | null;
}

interface FilaAmortizacion {
  numero: number;
  fecha: string;
  cuota: number;
  capital: number;
  interes: number;
  saldoRestante: number;
}

type Vista = "historial" | "por_cobrar";
type Frecuencia = "DIARIO" | "SEMANAL" | "QUINCENAL" | "MENSUAL" | "AL_VENCIMIENTO";
type ModalTipo = null | "simple" | "cuotas";

const C = {
  fondo:      "#191510",
  card:       "#221C15",
  borde:      "rgba(201, 184, 150, 0.10)",
  bordeSuave: "rgba(201, 184, 150, 0.18)",
  texto:      "#EDE3CE",
  muted:      "#8C826F",
  tenue:      "#5A5345",
  acento:     "#7A9B6E",
  alerta:     "#D08B6A",
};

function fmt(valor: number) {
  return valor.toLocaleString("es-EC", { style: "currency", currency: "USD" });
}

function fmtFecha(fecha: string) {
  return new Date(fecha + "T12:00:00").toLocaleDateString("es-EC", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function claveMes(fecha: string) {
  return fecha.slice(0, 7);
}

function etiquetaMes(clave: string) {
  const [anio, mes] = clave.split("-").map(Number);
  const txt = new Date(anio, mes - 1, 1).toLocaleDateString("es-EC", {
    month: "long", year: "numeric",
  });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

function mesActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

function puedeAnular(createdAt: Date | null): boolean {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() < 5 * 60 * 1000;
}

// Acordeón de un mes
function MesAcordeon({
  etiqueta,
  items,
  saldo,
  defaultAbierto,
  onAnularTransaccion,
  onAnularGrupo,
}: {
  etiqueta: string;
  items: TransaccionItem[];
  saldo: number;
  defaultAbierto: boolean;
  onAnularTransaccion: (id: string) => void;
  onAnularGrupo: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(defaultAbierto);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.borde }}>
      <button
        onClick={() => setAbierto(!abierto)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        style={{ backgroundColor: C.card }}>
        <div className="flex items-center gap-2">
          <span className="text-xs transition-transform inline-block"
            style={{ color: C.tenue, transform: abierto ? "rotate(90deg)" : "rotate(0deg)" }}>
            ›
          </span>
          <span className="text-sm font-medium" style={{ color: C.texto }}>{etiqueta}</span>
        </div>
        <span className="text-sm font-medium" style={{ color: saldo >= 0 ? C.acento : C.alerta }}>
          {fmt(saldo)}
        </span>
      </button>

      {abierto && (
        <div className="flex flex-col gap-1.5 border-t px-4 py-3"
          style={{ borderColor: C.borde, backgroundColor: C.fondo }}>
          {items.map(t => {
            const esPrestamo = t.tipo === "PRESTAMO";
            const monto = Number(t.monto);
            return (
              <div key={t.id} className="rounded-xl border px-4 py-3"
                style={{ backgroundColor: C.card, borderColor: C.borde }}>
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
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium"
                      style={{ color: esPrestamo ? C.alerta : C.acento }}>
                      {esPrestamo ? "+" : "−"}{fmt(monto)}
                    </span>
                    {puedeAnular(t.createdAt) && (
                      t.grupoId ? (
                        <button onClick={() => onAnularGrupo(t.grupoId!)}
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ color: C.tenue, border: `1px solid ${C.borde}` }}
                          title="Anular grupo completo">
                          ✕ grupo
                        </button>
                      ) : (
                        <button onClick={() => onAnularTransaccion(t.id)}
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ color: C.tenue, border: `1px solid ${C.borde}` }}
                          title="Anular">
                          ✕
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PartidaDetallePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const usuarioId = params.id as string;
  const partidaId = params.partidaId as string;

  const [lista, setLista]         = useState<TransaccionItem[]>([]);
  const [saldo, setSaldo]         = useState(0);
  const [cargando, setCargando]   = useState(true);
  const [vista, setVista]         = useState<Vista>("historial");
  const [modal, setModal]         = useState<ModalTipo>(null);

  // Modal simple
  const [tipoMov, setTipoMov]     = useState<"PRESTAMO" | "PAGO">("PRESTAMO");
  const [monto, setMonto]         = useState("");
  const [desc, setDesc]           = useState("");
  const [fecha, setFecha]         = useState(new Date().toISOString().slice(0, 10));
  const [guardando, setGuardando] = useState(false);
  const [errorMov, setErrorMov]   = useState<string | null>(null);

  // Modal cuotas
  const [simMonto, setSimMonto]           = useState("");
  const [simTasa, setSimTasa]             = useState("");
  const [simCuotas, setSimCuotas]         = useState("");
  const [simFrecuencia, setSimFrecuencia] = useState<Frecuencia>("MENSUAL");
  const [simFecha, setSimFecha]           = useState(new Date().toISOString().slice(0, 10));
  const [simDesc, setSimDesc]             = useState("");
  const [simulando, setSimulando]         = useState(false);
  const [confirmando, setConfirmando]     = useState(false);
  const [errorSim, setErrorSim]           = useState<string | null>(null);
  const [preview, setPreview]             = useState<{
    filas: FilaAmortizacion[];
    cuotaFija: number;
    totalIntereses: number;
  } | null>(null);

  const cargarDatos = useCallback(async () => {
    if (!user) return;
    setCargando(true);
    try {
      const idToken = await user.getIdToken();
      const data = await listarTransacciones({ idToken, partidaId });
      setLista(data.transacciones);
      setSaldo(data.saldo);
    } finally {
      setCargando(false);
    }
  }, [user, partidaId]);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login"); return; }
    if (user) cargarDatos();
  }, [user, authLoading, cargarDatos, router]);

  // Agrupar por mes y separar historial vs por cobrar
  const { gruposHistorial, gruposPorCobrar } = useMemo(() => {
    const actual = mesActual();
    const mapa = new Map<string, TransaccionItem[]>();

    for (const t of lista) {
      const clave = claveMes(t.fechaReferencia);
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push(t);
    }

    const historial: { clave: string; etiqueta: string; items: TransaccionItem[]; saldo: number }[] = [];
    const porCobrar: { clave: string; etiqueta: string; items: TransaccionItem[]; saldo: number }[] = [];

    for (const [clave, items] of mapa.entries()) {
      const saldoMes = items.reduce((acc, t) =>
        t.tipo === "PRESTAMO" ? acc + Number(t.monto) : acc - Number(t.monto), 0);
      const grupo = { clave, etiqueta: etiquetaMes(clave), items, saldo: saldoMes };

      if (clave <= actual) {
        historial.push(grupo);
      } else {
        porCobrar.push(grupo);
      }
    }

    // Historial: más reciente primero
    historial.sort((a, b) => b.clave.localeCompare(a.clave));
    // Por cobrar: más próximo primero
    porCobrar.sort((a, b) => a.clave.localeCompare(b.clave));

    return { gruposHistorial: historial, gruposPorCobrar: porCobrar };
  }, [lista]);

  const saldoPorCobrar = gruposPorCobrar.reduce((acc, g) => acc + g.saldo, 0);

  async function handleAgregarSimple(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setErrorMov(null);
    const m = parseFloat(monto);
    if (isNaN(m) || m <= 0) { setErrorMov("Ingresa un monto válido."); return; }
    setGuardando(true);
    try {
      const idToken = await user.getIdToken();
      await agregarTransaccion({ idToken, partidaId, tipo: tipoMov, monto: m, descripcion: desc, fechaReferencia: fecha });
      setModal(null);
      setMonto(""); setDesc("");
      setFecha(new Date().toISOString().slice(0, 10));
      cargarDatos();
    } catch {
      setErrorMov("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function handleSimular(e: React.FormEvent) {
    e.preventDefault();
    setErrorSim(null);
    const m = parseFloat(simMonto);
    const tasa = parseFloat(simTasa) || 0;
    const cuotas = simFrecuencia === "AL_VENCIMIENTO" ? 1 : parseInt(simCuotas, 10);
    if (isNaN(m) || m <= 0) { setErrorSim("Ingresa un monto válido."); return; }
    if (simFrecuencia !== "AL_VENCIMIENTO" && (isNaN(cuotas) || cuotas <= 0)) {
      setErrorSim("Ingresa un número de cuotas válido."); return;
    }
    setSimulando(true);
    try {
      const resultado = await simularAmortizacion({
        montoOriginal: m, tasaAnual: tasa,
        totalCuotas: cuotas, frecuencia: simFrecuencia, fechaInicio: simFecha,
      });
      setPreview(resultado);
    } catch {
      setErrorSim("No se pudo calcular.");
    } finally {
      setSimulando(false);
    }
  }

  async function handleConfirmarCuotas() {
    if (!user || !preview) return;
    setConfirmando(true);
    try {
      const idToken = await user.getIdToken();
      const m = parseFloat(simMonto);
      const tasa = parseFloat(simTasa) || 0;
      const cuotas = simFrecuencia === "AL_VENCIMIENTO" ? 1 : parseInt(simCuotas, 10);
      await agregarPrestamoCuotas({
        idToken, partidaId, descripcion: simDesc,
        montoOriginal: m, tasaAnual: tasa,
        totalCuotas: cuotas, frecuencia: simFrecuencia, fechaInicio: simFecha,
      });
      setModal(null); setPreview(null);
      setSimMonto(""); setSimTasa(""); setSimCuotas(""); setSimDesc("");
      setSimFecha(new Date().toISOString().slice(0, 10));
      cargarDatos();
    } catch {
      setErrorSim("No se pudieron crear las cuotas.");
    } finally {
      setConfirmando(false);
    }
  }

  async function handleAnularTransaccion(transaccionId: string) {
    if (!user) return;
    if (!confirm("¿Anular esta transacción?")) return;
    const idToken = await user.getIdToken();
    await anularTransaccion({ idToken, transaccionId });
    cargarDatos();
  }

  async function handleAnularGrupo(grupoId: string) {
    if (!user) return;
    if (!confirm("¿Anular todas las cuotas de este grupo?")) return;
    const idToken = await user.getIdToken();
    await anularGrupo({ idToken, grupoId });
    cargarDatos();
  }

  if (authLoading || cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: C.fondo }}>
        <p style={{ color: C.muted }}>Cargando...</p>
      </div>
    );
  }

  const gruposActivos = vista === "historial" ? gruposHistorial : gruposPorCobrar;

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.fondo }}>
      <div className="mx-auto max-w-2xl px-4 py-8">

        <button onClick={() => router.push(`/dashboard/personas/${usuarioId}`)}
          className="mb-4 text-sm" style={{ color: C.muted }}>
          ← Volver
        </button>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl" style={{ fontFamily: "var(--font-fraunces)", color: C.texto }}>
            Partida
          </h1>

          {/* Resumen según vista activa */}
          <div className="mt-3 flex gap-2">
            <div className="flex-1 rounded-xl border px-4 py-3"
              style={{ backgroundColor: C.card, borderColor: vista === "historial" ? C.acento : C.borde }}>
              <p className="text-xs" style={{ color: C.tenue }}>Hasta este mes</p>
              <p className="mt-0.5 text-lg font-medium"
                style={{ color: gruposHistorial.reduce((a, g) => a + g.saldo, 0) >= 0 ? C.acento : C.alerta }}>
                {fmt(gruposHistorial.reduce((a, g) => a + g.saldo, 0))}
              </p>
              <p className="text-xs mt-0.5" style={{ color: C.tenue }}>
                {gruposHistorial.length} {gruposHistorial.length === 1 ? "mes" : "meses"}
              </p>
            </div>
            <div className="flex-1 rounded-xl border px-4 py-3"
              style={{ backgroundColor: C.card, borderColor: vista === "por_cobrar" ? C.acento : C.borde }}>
              <p className="text-xs" style={{ color: C.tenue }}>Por cobrar</p>
              <p className="mt-0.5 text-lg font-medium"
                style={{ color: saldoPorCobrar >= 0 ? C.acento : C.alerta }}>
                {fmt(saldoPorCobrar)}
              </p>
              <p className="text-xs mt-0.5" style={{ color: C.tenue }}>
                {gruposPorCobrar.length} {gruposPorCobrar.length === 1 ? "mes" : "meses"} futuros
              </p>
            </div>
          </div>

          {/* Saldo total */}
          <p className="mt-3 text-xs" style={{ color: C.tenue }}>
            Saldo total (todo): <span style={{ color: saldo >= 0 ? C.acento : C.alerta }}>{fmt(saldo)}</span>
          </p>
        </div>

        {/* Botones acción */}
        <div className="mb-4 flex gap-2">
          <button onClick={() => setModal("simple")}
            className="flex-1 rounded-lg py-2.5 text-sm font-medium"
            style={{ backgroundColor: C.acento, color: "#171510" }}>
            + Transacción
          </button>
          <button onClick={() => setModal("cuotas")}
            className="flex-1 rounded-lg border py-2.5 text-sm font-medium"
            style={{ borderColor: C.bordeSuave, color: C.texto }}>
            + Préstamo con cuotas
          </button>
        </div>

        {/* Tabs vista */}
        <div className="mb-4 flex gap-1.5">
          <button onClick={() => setVista("historial")}
            className="flex-1 rounded-lg py-2 text-sm font-medium"
            style={{
              backgroundColor: vista === "historial" ? C.acento : "transparent",
              color: vista === "historial" ? "#171510" : C.muted,
              border: vista === "historial" ? "none" : `1px solid ${C.bordeSuave}`,
            }}>
            Historial
          </button>
          <button onClick={() => setVista("por_cobrar")}
            className="flex-1 rounded-lg py-2 text-sm font-medium"
            style={{
              backgroundColor: vista === "por_cobrar" ? C.acento : "transparent",
              color: vista === "por_cobrar" ? "#171510" : C.muted,
              border: vista === "por_cobrar" ? "none" : `1px solid ${C.bordeSuave}`,
            }}>
            Por cobrar
          </button>
        </div>

        {/* Contenido */}
        {gruposActivos.length === 0 ? (
          <div className="rounded-2xl border px-6 py-10 text-center" style={{ borderColor: C.borde }}>
            <p style={{ color: C.muted }}>
              {vista === "historial"
                ? "Sin transacciones registradas todavía."
                : "No hay cuotas pendientes para meses futuros."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {gruposActivos.map((grupo, i) => (
              <MesAcordeon
                key={grupo.clave}
                etiqueta={grupo.etiqueta}
                items={grupo.items}
                saldo={grupo.saldo}
                defaultAbierto={i === 0}
                onAnularTransaccion={handleAnularTransaccion}
                onAnularGrupo={handleAnularGrupo}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL SIMPLE ── */}
      {modal === "simple" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          onClick={() => setModal(null)}>
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border p-6"
            style={{ backgroundColor: C.card, borderColor: C.borde }}>
            <h2 className="text-lg" style={{ fontFamily: "var(--font-fraunces)", color: C.texto }}>
              Nueva transacción
            </h2>
            <div className="mt-4 flex gap-2">
              {(["PRESTAMO", "PAGO"] as const).map(t => (
                <button key={t} onClick={() => setTipoMov(t)}
                  className="flex-1 rounded-lg border py-2 text-sm"
                  style={{
                    backgroundColor: tipoMov === t ? (t === "PRESTAMO" ? C.alerta : C.acento) : "transparent",
                    borderColor: C.bordeSuave,
                    color: tipoMov === t ? "#171510" : C.texto,
                  }}>
                  {t === "PRESTAMO" ? "Le presté" : "Me pagó"}
                </button>
              ))}
            </div>
            <form onSubmit={handleAgregarSimple} className="mt-4 flex flex-col gap-3">
              <input type="number" step="0.01" placeholder="Monto"
                value={monto} onChange={e => setMonto(e.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: C.bordeSuave, color: C.texto }} />
              <input type="text" placeholder="Descripción (opcional)"
                value={desc} onChange={e => setDesc(e.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: C.bordeSuave, color: C.texto }} />
              <div className="flex flex-col gap-1">
                <label className="text-xs" style={{ color: C.muted }}>
                  {tipoMov === "PRESTAMO" ? "Fecha del préstamo" : "Fecha del pago"}
                </label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                  className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: C.bordeSuave, color: C.texto }} />
              </div>
              {errorMov && <p className="text-sm" style={{ color: C.alerta }}>{errorMov}</p>}
              <div className="mt-1 flex gap-2">
                <button type="button" onClick={() => setModal(null)}
                  className="flex-1 rounded-lg border py-2.5 text-sm"
                  style={{ borderColor: C.bordeSuave, color: "#A89B81" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={guardando}
                  className="flex-1 rounded-lg py-2.5 text-sm font-medium disabled:opacity-60"
                  style={{ backgroundColor: C.acento, color: "#171510" }}>
                  {guardando ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL CUOTAS ── */}
      {modal === "cuotas" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-8"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          onClick={() => { setModal(null); setPreview(null); }}>
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border p-6"
            style={{ backgroundColor: C.card, borderColor: C.borde }}>
            <h2 className="text-lg" style={{ fontFamily: "var(--font-fraunces)", color: C.texto }}>
              Préstamo con cuotas
            </h2>
            <p className="mt-1 text-sm" style={{ color: C.muted }}>
              Sistema francés — cuota fija. Revisa antes de confirmar.
            </p>

            {!preview ? (
              <form onSubmit={handleSimular} className="mt-4 flex flex-col gap-3">
                <input type="text" placeholder="Descripción (ej: Moto, Aire...)"
                  value={simDesc} onChange={e => setSimDesc(e.target.value)}
                  className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: C.bordeSuave, color: C.texto }} />
                <input type="number" step="0.01" placeholder="Monto total prestado"
                  value={simMonto} onChange={e => setSimMonto(e.target.value)}
                  className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: C.bordeSuave, color: C.texto }} />
                <input type="number" step="0.01" placeholder="Interés anual % (0 si no aplica)"
                  value={simTasa} onChange={e => setSimTasa(e.target.value)}
                  className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: C.bordeSuave, color: C.texto }} />
                <select value={simFrecuencia} onChange={e => setSimFrecuencia(e.target.value as Frecuencia)}
                  className="rounded-lg border px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: C.bordeSuave, color: C.texto, backgroundColor: C.fondo }}>
                  <option value="DIARIO">Diario</option>
                  <option value="SEMANAL">Semanal</option>
                  <option value="QUINCENAL">Quincenal</option>
                  <option value="MENSUAL">Mensual</option>
                  <option value="AL_VENCIMIENTO">Al vencimiento (1 cuota)</option>
                </select>
                {simFrecuencia !== "AL_VENCIMIENTO" && (
                  <input type="number" placeholder="Número de cuotas"
                    value={simCuotas} onChange={e => setSimCuotas(e.target.value)}
                    className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                    style={{ borderColor: C.bordeSuave, color: C.texto }} />
                )}
                <div className="flex flex-col gap-1">
                  <label className="text-xs" style={{ color: C.muted }}>Fecha primera cuota</label>
                  <input type="date" value={simFecha} onChange={e => setSimFecha(e.target.value)}
                    className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                    style={{ borderColor: C.bordeSuave, color: C.texto }} />
                </div>
                {errorSim && <p className="text-sm" style={{ color: C.alerta }}>{errorSim}</p>}
                <div className="mt-1 flex gap-2">
                  <button type="button" onClick={() => setModal(null)}
                    className="flex-1 rounded-lg border py-2.5 text-sm"
                    style={{ borderColor: C.bordeSuave, color: "#A89B81" }}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={simulando}
                    className="flex-1 rounded-lg py-2.5 text-sm font-medium disabled:opacity-60"
                    style={{ backgroundColor: C.acento, color: "#171510" }}>
                    {simulando ? "Calculando..." : "Calcular"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4">
                <div className="mb-3 rounded-lg px-3 py-2.5" style={{ backgroundColor: C.fondo }}>
                  <p className="text-sm" style={{ color: C.texto }}>
                    Cuota fija: <strong>{fmt(preview.cuotaFija)}</strong>
                  </p>
                  <p className="text-xs" style={{ color: C.muted }}>
                    Total intereses: {fmt(preview.totalIntereses)}
                  </p>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-lg border" style={{ borderColor: C.borde }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ color: C.muted }}>
                        <th className="px-2 py-1.5 text-left">#</th>
                        <th className="px-2 py-1.5 text-left">Fecha</th>
                        <th className="px-2 py-1.5 text-right">Cuota</th>
                        <th className="px-2 py-1.5 text-right">Interés</th>
                        <th className="px-2 py-1.5 text-right">Capital</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.filas.map(f => (
                        <tr key={f.numero} style={{ color: C.texto }}>
                          <td className="px-2 py-1">{f.numero}</td>
                          <td className="px-2 py-1">{f.fecha}</td>
                          <td className="px-2 py-1 text-right">{fmt(f.cuota)}</td>
                          <td className="px-2 py-1 text-right" style={{ color: C.alerta }}>{fmt(f.interes)}</td>
                          <td className="px-2 py-1 text-right" style={{ color: C.acento }}>{fmt(f.capital)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {errorSim && <p className="mt-3 text-sm" style={{ color: C.alerta }}>{errorSim}</p>}
                <div className="mt-4 flex gap-2">
                  <button onClick={() => setPreview(null)}
                    className="flex-1 rounded-lg border py-2.5 text-sm"
                    style={{ borderColor: C.bordeSuave, color: "#A89B81" }}>
                    Ajustar
                  </button>
                  <button onClick={handleConfirmarCuotas} disabled={confirmando}
                    className="flex-1 rounded-lg py-2.5 text-sm font-medium disabled:opacity-60"
                    style={{ backgroundColor: C.acento, color: "#171510" }}>
                    {confirmando ? "Creando..." : "Confirmar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}