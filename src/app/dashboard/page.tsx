// src/app/dashboard/page.tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/auth-context";
import { listarUsuarios, crearUsuario, OrdenUsuarios } from "@/lib/actions/usuarios";

interface UsuarioItem {
  id: string;
  nombre: string;
  tokenPublico: string;
  createdAt: Date | null;
}

const C = {
  fondo:       "#191510",
  card:        "#221C15",
  borde:       "rgba(201, 184, 150, 0.10)",
  bordeSuave:  "rgba(201, 184, 150, 0.18)",
  texto:       "#EDE3CE",
  muted:       "#8C826F",
  tenue:       "#5A5345",
  acento:      "#7A9B6E",
};

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [usuarios, setUsuarios]         = useState<UsuarioItem[]>([]);
  const [busqueda, setBusqueda]         = useState("");
  const [orden, setOrden]               = useState<OrdenUsuarios>("creado_desc");
  const [cargandoLista, setCargandoLista] = useState(true);
  const [cargandoMas, setCargandoMas]   = useState(false);
  const [cursor, setCursor]             = useState<number | null>(0);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [nombreNuevo, setNombreNuevo]   = useState("");
  const [creando, setCreando]           = useState(false);
  const [errorModal, setErrorModal]     = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const cargarUsuarios = useCallback(async (params: {
    reset?: boolean;
    offset?: number;
    texto?: string;
  }) => {
    if (!user) return;
    const { reset = false, offset = 0, texto = busqueda } = params;
    if (reset) setCargandoLista(true);
    else setCargandoMas(true);
    try {
      const idToken = await user.getIdToken();
      const { usuarios: nuevos, siguienteCursor } = await listarUsuarios({
        idToken, busqueda: texto, cursor: offset, orden,
      });
      setUsuarios(prev => reset ? nuevos : [...prev, ...nuevos]);
      setCursor(siguienteCursor);
    } finally {
      setCargandoLista(false);
      setCargandoMas(false);
    }
  }, [user, busqueda, orden]);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login"); return; }
    if (user) cargarUsuarios({ reset: true, offset: 0, texto: "" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  useEffect(() => {
    if (!user) return;
    cargarUsuarios({ reset: true, offset: 0 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orden]);

  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => cargarUsuarios({ reset: true, offset: 0, texto: busqueda }), 350);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && cursor !== null && !cargandoMas)
        cargarUsuarios({ offset: cursor, texto: busqueda });
    });
    observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, cargandoMas, busqueda, orden]);

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setErrorModal(null);
    if (!nombreNuevo.trim()) { setErrorModal("Escribe un nombre."); return; }
    setCreando(true);
    try {
      const idToken = await user.getIdToken();
      await crearUsuario({ idToken, nombre: nombreNuevo });
      setNombreNuevo("");
      setMostrarModal(false);
      cargarUsuarios({ reset: true, offset: 0, texto: busqueda });
    } catch {
      setErrorModal("No se pudo crear. Intenta de nuevo.");
    } finally {
      setCreando(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: C.fondo }}>
        <p style={{ color: C.muted }}>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.fondo }}>
      <div className="mx-auto max-w-2xl px-4 py-8">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <span className="text-2xl italic" style={{ fontFamily: "var(--font-fraunces)", color: "#E7DCC4" }}>
            Libranza
          </span>
          <button onClick={() => signOut(auth).then(() => router.push("/login"))}
            className="text-sm underline" style={{ color: C.muted }}>
            Cerrar sesión
          </button>
        </div>

        {/* Buscar + Agregar */}
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            placeholder="Buscar persona..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="flex-1 rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
            style={{ borderColor: C.bordeSuave, color: C.texto }}
          />
          <button onClick={() => setMostrarModal(true)}
            className="shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium"
            style={{ backgroundColor: C.acento, color: "#171510" }}>
            + Agregar
          </button>
        </div>

        {/* Orden */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs" style={{ color: C.tenue }}>
            {usuarios.length} {usuarios.length === 1 ? "persona" : "personas"}
          </span>
          <select value={orden} onChange={e => setOrden(e.target.value as OrdenUsuarios)}
            className="rounded-lg border bg-transparent px-3 py-1.5 text-xs outline-none"
            style={{ borderColor: C.bordeSuave, color: "#A89B81", backgroundColor: C.fondo }}>
            <option value="creado_desc">Más recientes</option>
            <option value="creado_asc">Más antiguos</option>
            <option value="nombre_asc">Alfabético (A-Z)</option>
            <option value="ultimo_movimiento_desc">Última transacción</option>
          </select>
        </div>

        {/* Lista */}
        {cargandoLista ? (
          <p className="text-sm" style={{ color: C.muted }}>Cargando...</p>
        ) : usuarios.length === 0 ? (
          <div className="rounded-2xl border px-6 py-10 text-center" style={{ borderColor: C.borde }}>
            <p style={{ color: C.muted }}>
              {busqueda ? "No se encontró nadie con ese nombre." : "Todavía no has agregado a nadie."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {usuarios.map(u => (
              <button key={u.id}
                onClick={() => router.push(`/dashboard/personas/${u.id}`)}
                className="flex items-center justify-between rounded-xl border px-4 py-3.5 text-left"
                style={{ backgroundColor: C.card, borderColor: C.borde }}>
                <span className="text-sm font-medium" style={{ color: C.texto }}>{u.nombre}</span>
                <span className="text-xs" style={{ color: C.tenue }}>→</span>
              </button>
            ))}
            <div ref={sentinelRef} className="h-4" />
            {cargandoMas && (
              <p className="py-2 text-center text-xs" style={{ color: C.tenue }}>Cargando más...</p>
            )}
          </div>
        )}
      </div>

      {/* Modal agregar */}
      {mostrarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          onClick={() => setMostrarModal(false)}>
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border p-6"
            style={{ backgroundColor: C.card, borderColor: C.borde }}>
            <h2 className="text-lg" style={{ fontFamily: "var(--font-fraunces)", color: C.texto }}>
              Agregar persona
            </h2>
            <form onSubmit={handleCrear} className="mt-4 flex flex-col gap-3">
              <input type="text" autoFocus placeholder="Nombre"
                value={nombreNuevo} onChange={e => setNombreNuevo(e.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: C.bordeSuave, color: C.texto }} />
              {errorModal && <p className="text-sm" style={{ color: "#D08B6A" }}>{errorModal}</p>}
              <div className="mt-1 flex gap-2">
                <button type="button" onClick={() => setMostrarModal(false)}
                  className="flex-1 rounded-lg border py-2.5 text-sm"
                  style={{ borderColor: C.bordeSuave, color: "#A89B81" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={creando}
                  className="flex-1 rounded-lg py-2.5 text-sm font-medium disabled:opacity-60"
                  style={{ backgroundColor: C.acento, color: "#171510" }}>
                  {creando ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}