import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-app px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex size-10 items-center justify-center rounded-xl bg-action text-[15px] font-semibold text-action-fg">IT</span>
          <h1 className="mt-4 text-[22px] font-semibold tracking-[-0.01em] text-fg">Sign in to IT Ops Hub</h1>
          <p className="mt-1 text-[13.5px] text-fg-secondary">Assets, subscriptions and tickets in one place.</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-6">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
