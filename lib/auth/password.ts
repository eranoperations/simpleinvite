import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'

const COST = 12

/**
 * Computed once on first use rather than hardcoded: a malformed literal would
 * make bcrypt.compare return immediately, defeating the whole point.
 */
let dummyHash: Promise<string> | null = null

function getDummyHash(): Promise<string> {
  if (!dummyHash) {
    dummyHash = bcrypt.hash(crypto.randomBytes(24).toString('hex'), COST)
  }
  return dummyHash
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

/**
 * Spends the same time a real comparison would when the account doesn't exist,
 * so response timing doesn't disclose which emails are registered.
 */
export async function burnTime(plain: string): Promise<void> {
  await bcrypt.compare(plain, await getDummyHash())
}
