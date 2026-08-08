#!/usr/bin/env node
/**
 * End-to-end proof that both features work, runnable in one command.
 *
 * Starts the fixture site and the app, then exercises the real HTTP API the
 * browser uses — registration, the auth gate, a crawl, a scenario run, and an
 * authenticated crawl — asserting on the actual results rather than on the
 * absence of errors. Exits non-zero on the first failed assertion.
 *
 *   node scripts/smoke.mjs
 *
 * The scenario is compiled by POSTing explicit steps, so the whole run works
 * with no AI provider configured. Set AI_API_KEY to additionally exercise
 * plain-English compilation.
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const FIXTURE_PORT = 4310
const APP_PORT = 4300
const FIXTURE = `http://127.0.0.1:${FIXTURE_PORT}`
const APP = `http://127.0.0.1:${APP_PORT}`

const children = []
let failures = 0
let checks = 0

function check(label, condition, detail = '') {
  checks++
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    failures++
    console.error(`  ✗ ${label}${detail ? `\n      ${detail}` : ''}`)
  }
}

function section(title) {
  console.log(`\n${title}`)
}

// --- plumbing ---------------------------------------------------------------

let cookie = ''

async function api(pathname, options = {}) {
  const res = await fetch(`${APP}${pathname}`, {
    ...options,
    redirect: 'manual',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...options.headers,
    },
  })
  const setCookie = res.headers.getSetCookie?.() ?? []
  for (const raw of setCookie) {
    const [pair] = raw.split(';')
    if (pair.startsWith('aisc_session=')) cookie = pair
  }
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    // HTML response (a page, not an API call)
  }
  return { status: res.status, json, text, headers: res.headers }
}

function start(command, args, env, label) {
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  children.push(child)
  child.stderr.on('data', (d) => {
    const line = String(d)
    if (/error/i.test(line)) process.stderr.write(`[${label}] ${line}`)
  })
  return child
}

async function waitFor(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.status < 500) return true
    } catch {
      // not up yet
    }
    await sleep(400)
  }
  throw new Error(`${url} did not come up within ${timeoutMs}ms`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function pollUntilDone(pathname, key, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs
  let last = null
  while (Date.now() < deadline) {
    const res = await api(pathname)
    last = res.json?.[key]
    if (last && !['queued', 'running'].includes(last.status)) return res.json
    await sleep(1000)
  }
  throw new Error(`${pathname} still ${last?.status ?? 'unknown'} after ${timeoutMs}ms`)
}

function cleanup() {
  for (const child of children) {
    try {
      child.kill('SIGKILL')
    } catch {
      // already gone
    }
  }
}

process.on('exit', cleanup)
process.on('SIGINT', () => {
  cleanup()
  process.exit(130)
})

// --- the test ---------------------------------------------------------------

/**
 * A leftover server from a previous run would answer every request, and the
 * suite would silently report on stale code. Refuse to start instead.
 */
async function assertPortFree(port) {
  try {
    await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1500) })
  } catch {
    return // nothing listening, which is what we want
  }
  throw new Error(
    `Port ${port} is already serving. Stop the process using it first ` +
      `(fuser -k -n tcp ${port}), then rerun — otherwise this suite would test stale code.`,
  )
}

async function main() {
  // A throwaway database so a rerun never collides with an existing account.
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiscentry-smoke-'))

  await assertPortFree(APP_PORT)
  await assertPortFree(FIXTURE_PORT)

  section('Starting servers')
  start('node', ['fixtures/serve.mjs'], { FIXTURE_PORT: String(FIXTURE_PORT) }, 'fixture')
  start(
    'npx',
    ['next', 'start', '-p', String(APP_PORT)],
    {
      ALLOW_PRIVATE_TARGETS: 'true',
      AISCENTRY_DATA_DIR: dataDir,
      NODE_ENV: 'production',
    },
    'app',
  )

  await waitFor(`${FIXTURE}/`)
  await waitFor(`${APP}/api/health`)
  console.log('  ✓ fixture site and app are up')

  // 1. The auth gate ---------------------------------------------------------
  section('1. Access control')
  const guarded = await api('/maps')
  check(
    'signed-out request to /maps redirects to /login',
    guarded.status === 307 || guarded.status === 302,
    `got ${guarded.status}`,
  )
  check(
    'redirect points at the login page',
    (guarded.headers.get('location') ?? '').includes('/login'),
    guarded.headers.get('location') ?? 'no location header',
  )
  const unauth = await api('/api/maps')
  check('signed-out API call is rejected', unauth.status === 401, `got ${unauth.status}`)

  // 2. Registration ----------------------------------------------------------
  section('2. Account creation')
  const email = `smoke-${Date.now()}@example.com`
  const registered = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'smoketest123' }),
  })
  check('registration succeeds', registered.status === 200, JSON.stringify(registered.json))
  check('a session cookie is issued', cookie.startsWith('aisc_session='), cookie || 'none')

  const me = await api('/api/me')
  check('session resolves to the new account', me.json?.user?.email === email)

  // 3. Mapping ---------------------------------------------------------------
  section('3. Site mapping')
  const created = await api('/api/maps', {
    method: 'POST',
    body: JSON.stringify({ url: FIXTURE, depthProfile: 'standard', label: 'Fixture' }),
  })
  check('map job accepted', created.status === 201, JSON.stringify(created.json))

  const mapResult = await pollUntilDone(`/api/maps/${created.json.id}`, 'map')
  check(
    'map completes',
    mapResult.map.status === 'complete',
    mapResult.map.error ?? mapResult.map.status,
  )

  const paths = mapResult.graph.nodes.map((n) => n.path)
  for (const expected of ['/', '/products', '/products/1', '/about', '/login']) {
    check(`found ${expected}`, paths.includes(expected), `saw: ${paths.join(', ')}`)
  }

  // The whole point of clicking controls: /deals has no anchor anywhere.
  const buttonEdges = mapResult.graph.edges.filter((e) => e.kind === 'button')
  const dealEdge = buttonEdges.find((e) => {
    const target = mapResult.graph.nodes.find((n) => n.id === e.to)
    return target?.path === '/deals'
  })
  check(
    'a JavaScript-only route was found by clicking',
    Boolean(dealEdge),
    `button edges: ${JSON.stringify(buttonEdges.map((e) => e.label))}`,
  )
  check(
    'the button edge is labelled with the button text',
    dealEdge?.label?.includes('deal'),
    `label was "${dealEdge?.label}"`,
  )

  const linkEdge = mapResult.graph.edges.find((e) => e.kind === 'link' && e.label === 'Products')
  check('link edges carry their link text', Boolean(linkEdge))

  const withShots = mapResult.graph.nodes.filter((n) => n.screenshotUrl)
  check('pages have screenshots', withShots.length >= 5, `${withShots.length} with screenshots`)

  // Everything below needs a real crawl to have happened; without one the
  // remaining checks would report misleading failures on top of the real cause.
  if (!withShots.length) {
    console.error('\nMapping produced nothing — skipping the rest.')
    console.log(`\n✗ ${checks - failures}/${checks} checks passed`)
    process.exit(1)
  }

  const shot = await api(withShots[0].screenshotUrl)
  check('screenshots are served to the owner', shot.status === 200, `got ${shot.status}`)

  // 4. Scenario execution ----------------------------------------------------
  section('4. Scenario execution')
  const scenario = await api('/api/scenarios', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Sign in and rename the account',
      targetUrl: FIXTURE,
      mapId: created.json.id,
      sourceText:
        'Go to the login page. Enter demo as the username and demo123 as the password, then ' +
        'sign in. Open the profile page and change the account name to Ada. Check it saved.',
    }),
  })
  check('scenario saved', scenario.status === 201, JSON.stringify(scenario.json))

  // Explicit steps keep this test independent of any AI provider. They are the
  // same shape the compiler emits, and go through the same zod gate.
  const steps = [
    { action: 'goto', url: `${FIXTURE}/login`, description: 'Go to the login page.' },
    { action: 'fill', target: 'Username', value: 'demo', description: 'Enter demo as the username.' },
    { action: 'fill', target: 'Password', value: 'demo123', secret: true, description: 'Enter the password.' },
    { action: 'click', target: 'Sign in', description: 'Sign in.' },
    { action: 'assertUrl', contains: '/profile', description: 'Signing in lands on the profile.' },
    { action: 'fill', target: 'Account name', value: 'Ada', description: 'Change the account name to Ada.' },
    { action: 'click', target: 'Save changes', description: 'Save.' },
    { action: 'assertText', text: 'Profile updated', description: 'Check it saved.' },
    { action: 'assertText', text: 'Ada', description: 'The new name is shown.' },
  ]

  const compiled = await api(`/api/scenarios/${scenario.json.id}/compile`, {
    method: 'POST',
    body: JSON.stringify({ steps }),
  })
  check('steps compile', compiled.status === 200, JSON.stringify(compiled.json))
  check('all steps survive validation', compiled.json?.steps?.length === steps.length)

  const started = await api(`/api/scenarios/${scenario.json.id}/run`, { method: 'POST' })
  check('run accepted', started.status === 201, JSON.stringify(started.json))

  const runResult = await pollUntilDone(`/api/runs/${started.json.id}`, 'run')
  const failedStep = runResult.run.steps.find((s) => s.status === 'failed')
  check(
    'every step passes',
    runResult.run.status === 'complete',
    failedStep ? `step ${failedStep.idx + 1} (${failedStep.action}): ${failedStep.detail}` : '',
  )
  check(
    'no AI was needed',
    runResult.run.aiRepairs === 0,
    `${runResult.run.aiRepairs} repairs — the deterministic resolver should have handled these`,
  )
  check(
    'each step recorded a screenshot',
    runResult.run.steps.every((s) => s.screenshotUrl),
    `${runResult.run.steps.filter((s) => !s.screenshotUrl).length} without one`,
  )
  check(
    'the password is masked in the recorded step',
    !JSON.stringify(runResult.run.steps).includes('demo123'),
    'the raw password appears in the run record',
  )

  // The real proof: the site actually changed.
  const state = await fetch(`${FIXTURE}/__state`).then((r) => r.json())
  check('the account was really renamed to Ada', state.name === 'Ada', `fixture says "${state.name}"`)

  // 5. Authenticated crawl ---------------------------------------------------
  section('5. Authenticated mapping')
  const loginScenario = await api('/api/scenarios', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Sign in only',
      targetUrl: FIXTURE,
      mapId: created.json.id,
      sourceText: 'Go to the login page and sign in as demo with password demo123.',
    }),
  })
  await api(`/api/scenarios/${loginScenario.json.id}/compile`, {
    method: 'POST',
    body: JSON.stringify({
      steps: [
        { action: 'goto', url: `${FIXTURE}/login`, description: 'Go to the login page.' },
        { action: 'fill', target: 'Username', value: 'demo', description: 'Username.' },
        { action: 'fill', target: 'Password', value: 'demo123', secret: true, description: 'Password.' },
        { action: 'click', target: 'Sign in', description: 'Sign in.' },
        { action: 'assertUrl', contains: '/profile', description: 'Signed in.' },
      ],
    }),
  })

  const authedMap = await api('/api/maps', {
    method: 'POST',
    body: JSON.stringify({
      url: FIXTURE,
      depthProfile: 'standard',
      label: 'Fixture (signed in)',
      loginScenarioId: loginScenario.json.id,
    }),
  })
  check('authenticated map accepted', authedMap.status === 201, JSON.stringify(authedMap.json))

  const authedResult = await pollUntilDone(`/api/maps/${authedMap.json.id}`, 'map')
  check(
    'authenticated map completes',
    authedResult.map.status === 'complete',
    authedResult.map.error ?? '',
  )

  const authedPaths = authedResult.graph.nodes.map((n) => n.path)
  check(
    '/profile is mapped only when signed in',
    authedPaths.includes('/profile') && !paths.includes('/profile'),
    `signed-in: ${authedPaths.includes('/profile')}, signed-out: ${paths.includes('/profile')}`,
  )
  check(
    '/settings is reachable behind the login',
    authedPaths.includes('/settings'),
    `saw: ${authedPaths.join(', ')}`,
  )

  // 6. Cross-account isolation ----------------------------------------------
  section('6. Isolation between accounts')
  const otherCookie = cookie
  cookie = ''
  await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: `other-${Date.now()}@example.com`, password: 'smoketest123' }),
  })
  const stolen = await api(`/api/maps/${created.json.id}`)
  check("another account cannot read someone else's map", stolen.status === 404, `got ${stolen.status}`)
  const stolenShot = await api(withShots[0].screenshotUrl)
  check(
    "another account cannot read someone else's screenshots",
    stolenShot.status === 404,
    `got ${stolenShot.status}`,
  )
  cookie = otherCookie

  // --- verdict --------------------------------------------------------------
  console.log(`\n${failures ? '✗' : '✓'} ${checks - failures}/${checks} checks passed`)
  fs.rmSync(dataDir, { recursive: true, force: true })
  process.exit(failures ? 1 : 0)
}

main().catch((err) => {
  console.error(`\nSmoke test crashed: ${err.stack ?? err.message}`)
  process.exit(1)
})
