"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

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
      <div
        className="w-full max-w-sm rounded-2xl border p-8"
        style={{
          backgroundColor: "#221C15",
          borderColor: "rgba(201, 184, 150, 0.12)",
        }}
      >
        <h1
          className="text-xl"
          style={{ fontFamily: "var(--font-fraunces)", color: "#EDE3CE" }}
        >
          Bienvenido de nuevo
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#8C826F" }}>
          Ingresa para revisar tus cuentas.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: "#A89B81" }}
            >
              Correo
            </label>
            <input
              id="email"
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none transition-colors"
              style={{
                borderColor: "rgba(201, 184, 150, 0.18)",
                color: "#EDE3CE",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "#7A9B6E")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor =
                  "rgba(201, 184, 150, 0.18)")
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: "#A89B81" }}
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none transition-colors"
              style={{
                borderColor: "rgba(201, 184, 150, 0.18)",
                color: "#EDE3CE",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "#7A9B6E")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor =
                  "rgba(201, 184, 150, 0.18)")
              }
            />
          </div>

          {error && (
            <p className="text-sm" role="alert" style={{ color: "#D08B6A" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg py-2.5 text-sm font-medium transition-opacity disabled:opacity-60"
            style={{ backgroundColor: "#7A9B6E", color: "#171510" }}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: "#8C826F" }}>
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="underline" style={{ color: "#C9B896" }}>
            Regístrate
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
