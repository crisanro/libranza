// src/app/dashboard/personas/[id]/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { listarPartidas, crearPartida, renombrarPartida } from "@/lib/actions/partidas";

interface PartidaItem {
  id: string;
  nombre: string;
  createdAt: Date | null;
  saldo: string;
}

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

function formatoMoneda(valor: number) {
  return valor.toLocaleString("es-EC", { style: "currency", currency: "USD" });
}

export default function PersonaDetallePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const usuarioId = params.id as string;

  const [nombrePersona, setNombrePersona]   = useState("");
  const [partidas, setPartidas] = useState<PartidaItem[]>([]);
  const [saldoTotal, setSaldoTotal]         = useState(0);
  const [cargando, setCargando]             = useState(true);
  const [tokenPublico, setTokenPublico]     = useState("");
  const [copiado, setCopiado]               = useState(false);

  const [mostrarModal, setMostrarModal]     = useState(false);
  const [nombreNuevo, setNombreNuevo]       = useState("");
  const [creando, setCreando]               = useState(false);
  const [errorModal, setErrorModal]         = useState<string | null>(null);

  const [editandoId, setEditandoId]         = useState<string | null>(null);
  const [nombreEdit, setNombreEdit]         = useState("");

  const cargarDatos = useCallback(async () => {
    if (!user) return;
    setCargando(true);
    try {
      const idToken = await user.getIdToken();
      const data = await listarPartidas({ idToken, usuarioId });
      setNombrePersona(data.usuario.nombre);
      setTokenPublico(data.usuario.tokenPublico);
      setPartidas(data.partidas);
      setSaldoTotal(data.saldoTotal);
    } finally {
      setCargando(false);
    }
  }, [user, usuarioId]);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login"); return; }
    if (user) cargarDatos();
  }, [user, authLoading, cargarDatos, router]);

  function copiarLink() {
    navigator.clipboard.writeText(`${window.location.origin}/c/${tokenPublico}`);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function handleCrearPartida(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setErrorModal(null);
    if (!nombreNuevo.trim()) { setErrorModal("Escribe un nombre."); return; }
    setCreando(true);
    try {
      const idToken = await user.getIdToken();
      const nueva = await crearPartida({ idToken, usuarioId, nombre: nombreNuevo });
      setMostrarModal(false);
      setNombreNuevo("");
      router.push(`/dashboard/personas/${usuarioId}/partidas/${nueva.id}`);
    } catch {
      setErrorModal("No se pudo crear. Intenta de nuevo.");
    } finally {
      setCreando(false);
    }
  }

  async function handleRenombrar(partidaId: string) {
    if (!user || !nombreEdit.trim()) { setEditandoId(null); return; }
    const idToken = await user.getIdToken();
    await renombrarPartida({ idToken, partidaId, nombre: nombreEdit });
    setEditandoId(null);
    cargarDatos();
  }

  if (authLoading || cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: C.fondo }}>
        <p style={{ color: C.muted }}>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.fondo }}>
      <div className="mx-auto max-w-2xl px-4 py-8">

        <button onClick={() => router.push("/dashboard")}
          className="mb-4 text-sm" style={{ color: C.muted }}>
          ← Volver
        </button>

        {/* Header persona */}
        <div className="mb-6">
          <h1 className="text-2xl" style={{ fontFamily: "var(--font-fraunces)", color: C.texto }}>
            {nombrePersona}
          </h1>
          <p className="mt-1 text-sm" style={{ color: saldoTotal >= 0 ? C.acento : C.alerta }}>
            Saldo total: {formatoMoneda(saldoTotal)}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: C.tenue }}>
            {saldoTotal >= 0 ? "Te debe (a tu favor)" : "Le debes (a favor de la persona)"}
          </p>
          <button onClick={copiarLink} className="mt-2 text-xs underline" style={{ color: C.muted }}>
            {copiado ? "¡Link copiado!" : "Copiar link de estado de cuenta"}
          </button>
        </div>

        {/* Botón nueva partida */}
        <button onClick={() => setMostrarModal(true)}
          className="mb-4 w-full rounded-lg py-2.5 text-sm font-medium"
          style={{ backgroundColor: C.acento, color: "#171510" }}>
          + Nueva partida
        </button>

        {/* Lista partidas */}
        {partidas.length === 0 ? (
          <div className="rounded-2xl border px-6 py-10 text-center" style={{ borderColor: C.borde }}>
            <p style={{ color: C.muted }}>Sin partidas todavía. Crea una para empezar.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {partidas.map(p => {
              const saldo = Number(p.saldo);
              return (
                <div key={p.id} className="rounded-xl border px-4 py-3.5"
                  style={{ backgroundColor: C.card, borderColor: C.borde }}>
                  {editandoId === p.id ? (
                    <div className="flex gap-2">
                      <input autoFocus value={nombreEdit}
                        onChange={e => setNombreEdit(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") handleRenombrar(p.id);
                          if (e.key === "Escape") setEditandoId(null);
                        }}
                        className="flex-1 rounded-lg border bg-transparent px-2 py-1.5 text-sm outline-none"
                        style={{ borderColor: C.acento, color: C.texto }} />
                      <button onClick={() => handleRenombrar(p.id)}
                        className="rounded-lg px-3 text-xs font-medium"
                        style={{ backgroundColor: C.acento, color: "#171510" }}>
                        Guardar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => router.push(`/dashboard/personas/${usuarioId}/partidas/${p.id}`)}
                      className="flex w-full items-center justify-between text-left">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium" style={{ color: C.texto }}>
                          {p.nombre}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium"
                          style={{ color: saldo >= 0 ? C.acento : C.alerta }}>
                          {formatoMoneda(saldo)}
                        </span>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setEditandoId(p.id);
                            setNombreEdit(p.nombre);
                          }}
                          className="text-xs" style={{ color: C.tenue }}>
                          ✎
                        </button>
                      </div>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal nueva partida */}
      {mostrarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          onClick={() => setMostrarModal(false)}>
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border p-6"
            style={{ backgroundColor: C.card, borderColor: C.borde }}>
            <h2 className="text-lg" style={{ fontFamily: "var(--font-fraunces)", color: C.texto }}>
              Nueva partida
            </h2>
            <p className="mt-1 text-sm" style={{ color: C.muted }}>
              Dale un nombre. Ejemplo: General, Moto 2024, Deuda enero...
            </p>
            <form onSubmit={handleCrearPartida} className="mt-4 flex flex-col gap-3">
              <input type="text" autoFocus placeholder="Nombre de la partida"
                value={nombreNuevo} onChange={e => setNombreNuevo(e.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: C.bordeSuave, color: C.texto }} />
              {errorModal && <p className="text-sm" style={{ color: C.alerta }}>{errorModal}</p>}
              <div className="mt-1 flex gap-2">
                <button type="button" onClick={() => setMostrarModal(false)}
                  className="flex-1 rounded-lg border py-2.5 text-sm"
                  style={{ borderColor: C.bordeSuave, color: "#A89B81" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={creando}
                  className="flex-1 rounded-lg py-2.5 text-sm font-medium disabled:opacity-60"
                  style={{ backgroundColor: C.acento, color: "#171510" }}>
                  {creando ? "Creando..." : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}