#!/usr/bin/env node
/**
 * A tiny site that exists to prove the mapper and the scenario runner work.
 * No dependencies — plain node:http so it starts anywhere.
 *
 * It deliberately contains the three things that are hard to fake:
 *   1. a route reachable ONLY through a JavaScript button (no <a href>),
 *   2. a real login form with a session cookie,
 *   3. a profile page that renders only when signed in, whose name is editable.
 *
 * State is in memory and resets on restart, which is what makes the smoke test
 * repeatable.
 */

import http from 'node:http'

const PORT = Number(process.env.FIXTURE_PORT) || 4310
const USER = { username: 'demo', password: 'demo123', name: 'Demo User' }
const sessions = new Set()

const layout = (title, body, nav = true) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} · Demo Shop</title>
  <style>
    body{font-family:system-ui,sans-serif;margin:0;background:#fff;color:#111}
    header{border-bottom:1px solid #ddd;padding:12px 24px;display:flex;gap:16px;align-items:center}
    main{padding:24px;max-width:720px}
    a{color:#0b64d6}
    button{font:inherit;padding:8px 14px;border:1px solid #0b64d6;background:#0b64d6;color:#fff;border-radius:6px;cursor:pointer}
    button.link{background:none;color:#0b64d6;border:none;text-decoration:underline;padding:0}
    label{display:block;margin:12px 0}
    input{font:inherit;padding:8px;border:1px solid #bbb;border-radius:6px;width:260px}
    .card{border:1px solid #ddd;border-radius:8px;padding:16px;margin:12px 0}
  </style>
</head>
<body>
  ${nav ? `<header>
    <strong>Demo Shop</strong>
    <a href="/">Home</a>
    <a href="/products">Products</a>
    <a href="/about">About</a>
    <a href="/login">Login</a>
  </header>` : ''}
  <main>${body}</main>
</body>
</html>`

function parseCookies(req) {
  const header = req.headers.cookie || ''
  return Object.fromEntries(
    header
      .split(';')
      .map((c) => c.trim().split('='))
      .filter((p) => p.length === 2),
  )
}

function isSignedIn(req) {
  const { fixture_session: token } = parseCookies(req)
  return Boolean(token && sessions.has(token))
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 1e6) req.destroy()
    })
    req.on('end', () => resolve(new URLSearchParams(data)))
  })
}

const send = (res, status, html, headers = {}) => {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', ...headers })
  res.end(html)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const path = url.pathname.replace(/\/$/, '') || '/'

  // --- Home -----------------------------------------------------------------
  if (path === '/') {
    return send(
      res,
      200,
      layout(
        'Home',
        `<h1>Welcome to Demo Shop</h1>
         <p>Browse the <a href="/products">catalogue</a> or read <a href="/about">about us</a>.</p>
         <div class="card">
           <h2>Today's deal</h2>
           <p>Our best seller, hand picked.</p>
           <!-- Reachable ONLY by clicking: there is no anchor to this route.
                A link-only crawler cannot find /deals. -->
           <button id="deal-btn" onclick="location.href='/deals'">See today's deal</button>
         </div>`,
      ),
    )
  }

  if (path === '/deals') {
    return send(
      res,
      200,
      layout(
        'Deals',
        `<h1>Today's deal</h1>
         <p>Widget Pro at half price.</p>
         <p><a href="/products/1">View the widget</a></p>`,
      ),
    )
  }

  if (path === '/products') {
    return send(
      res,
      200,
      layout(
        'Products',
        `<h1>Products</h1>
         <ul>
           <li><a href="/products/1">Widget Pro</a></li>
           <li><a href="/products/2">Widget Mini</a></li>
         </ul>`,
      ),
    )
  }

  if (path.startsWith('/products/')) {
    const id = path.split('/')[2]
    return send(
      res,
      200,
      layout(
        `Product ${id}`,
        `<h1>${id === '1' ? 'Widget Pro' : 'Widget Mini'}</h1>
         <p>A fine product.</p>
         <p><a href="/products">Back to products</a></p>`,
      ),
    )
  }

  if (path === '/about') {
    return send(res, 200, layout('About', `<h1>About us</h1><p>We sell widgets.</p>`))
  }

  // --- Login ----------------------------------------------------------------
  if (path === '/login' && req.method === 'GET') {
    if (isSignedIn(req)) return send(res, 302, '', { location: '/profile' })
    const failed = url.searchParams.has('error')
    return send(
      res,
      200,
      layout(
        'Login',
        `<h1>Sign in</h1>
         ${failed ? '<p style="color:#b00">Wrong username or password.</p>' : ''}
         <form method="post" action="/login">
           <label for="username">Username</label>
           <input id="username" name="username" type="text" required>
           <label for="password">Password</label>
           <input id="password" name="password" type="password" required>
           <button type="submit">Sign in</button>
         </form>
         <p style="margin-top:16px;color:#666">Try demo / demo123</p>`,
      ),
    )
  }

  if (path === '/login' && req.method === 'POST') {
    const body = await readBody(req)
    if (body.get('username') === USER.username && body.get('password') === USER.password) {
      const token = Math.random().toString(36).slice(2)
      sessions.add(token)
      return send(res, 302, '', {
        location: '/profile',
        'set-cookie': `fixture_session=${token}; Path=/; HttpOnly`,
      })
    }
    return send(res, 302, '', { location: '/login?error=1' })
  }

  // --- Profile (signed in only) --------------------------------------------
  if (path === '/profile' && req.method === 'GET') {
    if (!isSignedIn(req)) return send(res, 302, '', { location: '/login' })
    const saved = url.searchParams.has('saved')
    return send(
      res,
      200,
      layout(
        'Profile',
        `<h1>Your profile</h1>
         ${saved ? '<p style="color:#0a0">Profile updated.</p>' : ''}
         <p>Account name: <strong id="account-name">${escapeHtml(USER.name)}</strong></p>
         <form method="post" action="/profile">
           <label for="name">Account name</label>
           <input id="name" name="name" type="text" value="${escapeHtml(USER.name)}" required>
           <button type="submit">Save changes</button>
         </form>
         <p style="margin-top:16px"><a href="/settings">Settings</a></p>
         <p><a href="/logout">Log out</a></p>`,
      ),
    )
  }

  if (path === '/profile' && req.method === 'POST') {
    if (!isSignedIn(req)) return send(res, 302, '', { location: '/login' })
    const body = await readBody(req)
    const name = (body.get('name') || '').trim()
    if (name) USER.name = name.slice(0, 80)
    return send(res, 302, '', { location: '/profile?saved=1' })
  }

  if (path === '/settings') {
    if (!isSignedIn(req)) return send(res, 302, '', { location: '/login' })
    return send(
      res,
      200,
      layout('Settings', `<h1>Settings</h1><p>Nothing to configure yet.</p>`),
    )
  }

  if (path === '/logout') {
    const { fixture_session: token } = parseCookies(req)
    sessions.delete(token)
    return send(res, 302, '', { location: '/', 'set-cookie': 'fixture_session=; Path=/; Max-Age=0' })
  }

  // Lets the smoke test read back the state a scenario was supposed to change.
  if (path === '/__state') {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ name: USER.name }))
  }

  send(res, 404, layout('Not found', '<h1>404</h1><p>No such page.</p>'))
})

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`fixture site listening on http://127.0.0.1:${PORT}`)
})
