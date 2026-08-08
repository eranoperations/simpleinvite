import { Suspense } from 'react'
import Link from 'next/link'
import { AuthForm } from '../auth-form'

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link href="/" className="mb-8 text-lg font-semibold tracking-tight">
        AIS<span className="text-sky-400">Centry</span>
      </Link>
      <h1 className="text-2xl font-semibold">Log in</h1>
      <p className="mt-2 text-sm text-slate-400">
        Maps and scenarios are tied to your account.
      </p>

      <Suspense>
        <AuthForm mode="login" />
      </Suspense>

      <p className="mt-6 text-sm text-slate-400">
        No account?{' '}
        <Link href="/register" className="text-sky-400 hover:text-sky-300">
          Create one
        </Link>
      </p>
    </main>
  )
}
