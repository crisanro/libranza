//src/components/auth-shell.tsx
import { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-fondo px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent, transparent 27px, var(--dorado) 27px, var(--dorado) 28px)",
        }}
      />

      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-acento opacity-20 blur-3xl" />

      <div className="relative z-10 flex w-full flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-1 text-center">
          <span
            className="text-3xl italic text-marca"
            style={{ fontFamily: "var(--font-fraunces)" }}
          >
            Libranza
          </span>
          <span
            className="text-xs uppercase tracking-[0.2em] text-apagado">
            Cobros, pagos y deudas
          </span>
        </div>

        {children}
      </div>
    </div>
  );
}
