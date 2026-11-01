"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { AuthShell } from "@/components/auth-shell";

const claseLabel = "text-xs font-medium uppercase tracking-wide text-secundario";
const claseInput =
  "rounded-lg border border-borde-suave bg-transparent px-3 py-2.5 text-sm text-texto outline-none transition-colors placeholder:text-tenue focus:border-acento";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;

      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found"
      ) {
        setError("Correo o contraseña incorrectos.");
      } else if (code === "auth/invalid-email") {
        setError("El correo no es válido.");
      } else if (code === "auth/too-many-requests") {
        setError("Demasiados intentos. Intenta de nuevo más tarde.");
      } else {
        setError("Ocurrió un error al iniciar sesión. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="w-full max-w-sm rounded-2xl border border-borde bg-tarjeta p-8">
        <h1 className="text-xl text-texto" style={{ fontFamily: "var(--font-fraunces)" }}>
          Bienvenido de nuevo
        </h1>
        <p className="mt-1 text-sm text-apagado">
          Ingresa para revisar tus cuentas.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className={claseLabel}>
              Correo
            </label>
            <input
              id="email"
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={claseInput}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className={claseLabel}>
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={claseInput}
            />
          </div>

          {error && (
            <p className="text-sm text-alerta" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-acento py-2.5 text-sm font-medium text-sobre-acento transition-opacity disabled:opacity-60"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
