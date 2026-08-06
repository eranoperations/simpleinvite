import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { connectDB } from '@/lib/mongodb'
import { User } from '@/models/User'

export const runtime = 'nodejs'

const RegisterSchema = z.object({
  email: z.string().email('Enter a valid email address.').max(254),
  password: z
    .string()
    .min(10, 'Use at least 10 characters.')
    .max(200, 'That password is too long.'),
  name: z.string().trim().max(100).optional(),
})

export async function POST(req: Request) {
  try {
    const parsed = RegisterSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid details.' },
        { status: 400 },
      )
    }

    const { email, password, name } = parsed.data
    await connectDB()

    const normalized = email.toLowerCase().trim()
    if (await User.exists({ email: normalized })) {
      return NextResponse.json(
        { error: 'An account with that email already exists.' },
        { status: 409 },
      )
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await User.create({ email: normalized, passwordHash, name })

    return NextResponse.json(
      { id: String(user._id), email: user.email },
      { status: 201 },
    )
  } catch (err) {
    // A racing signup trips the unique index rather than the exists() check.
    if ((err as { code?: number }).code === 11000) {
      return NextResponse.json(
        { error: 'An account with that email already exists.' },
        { status: 409 },
      )
    }
    console.error('[register]', err)
    return NextResponse.json({ error: 'Could not create the account.' }, { status: 500 })
  }
}
