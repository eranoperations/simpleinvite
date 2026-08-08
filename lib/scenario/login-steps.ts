import type { TestUserRow } from '@/lib/db/types'
import type { Step } from './steps'

/**
 * A generic sign-in sequence built from a saved test user, with no scenario
 * text and no AI compilation involved. It leans on the same resolver ladder a
 * compiled scenario uses (via each step's `selector` hint) and on AI repair as
 * a fallback if the site's markup does not match these common patterns —
 * exactly like any other step the executor runs.
 */
export function buildLoginSteps(testUser: TestUserRow): Step[] {
  return [
    {
      action: 'goto',
      url: testUser.login_path?.trim() || '/login',
      description: `Go to the sign-in page as ${testUser.label}`,
    },
    {
      action: 'fill',
      target: 'Email or username',
      selector:
        'input[type="email"], input[autocomplete="username"], input[autocomplete="email"], ' +
        'input[name*="email" i], input[name*="user" i], input[id*="email" i], input[id*="user" i]',
      value: testUser.username,
      description: 'Enter the test user’s username or email',
    },
    {
      action: 'fill',
      target: 'Password',
      selector: 'input[type="password"]',
      value: testUser.password,
      secret: true,
      description: 'Enter the test user’s password',
    },
    {
      action: 'press',
      key: 'Enter',
      description: 'Submit the sign-in form',
    },
  ]
}
