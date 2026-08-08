import { Suspense } from 'react'
import Link from 'next/link'
import { AuthForm } from '../auth-form'

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link href="/" className="mb-8 text-lg font-semibold tracking-tight">
        AIS<span className="text-sky-400">Centry</span>
      </Link>
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <p className="mt-2 text-sm text-slate-400">
        Mapping and test execution are available once you are signed in.
      </p>

      <Suspense>
        <AuthForm mode="register" />
      </Suspense>

      <p className="mt-6 text-sm text-slate-400">
        Already registered?{' '}
        <Link href="/login" className="text-sky-400 hover:text-sky-300">
          Log in
        </Link>
      </p>
    </main>
  )
}
