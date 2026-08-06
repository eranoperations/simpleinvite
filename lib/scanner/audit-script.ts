/**
 * Serialized into the page under test and evaluated in the browser. It must be
 * self-contained — no imports, no closures over Node-side variables.
 */

export interface PageAudit {
  title: string
  metaDescription: string | null
  lang: string | null
  viewportMeta: string | null
  canonical: string | null
  headings: { level: number; text: string }[]
  h1Count: number
  links: { href: string; text: string; targetBlank: boolean; unsafeRel: boolean }[]
  forms: {
    action: string
    method: string
    insecureAction: boolean
    hasPasswordField: boolean
    hasHiddenTokenField: boolean
    inputs: { type: string; name: string; required: boolean; labelled: boolean }[]
  }[]
  interactive: { selector: string; text: string; tag: string; role: string | null }[]
  images: { total: number; missingAlt: number; samplesMissingAlt: string[]; oversized: string[] }
  inputsWithoutLabels: number
  duplicateIds: string[]
  thirdPartyScripts: string[]
  inlineScriptCount: number
  mixedContent: string[]
  smallTapTargets: number
  horizontalOverflow: boolean
  documentWidth: number
  viewportWidth: number
  emptyLinks: number
  textSample: string
  wordCount: number
  detectedTech: string[]
  hasSkipLink: boolean
  autofocusCount: number
}

export const AUDIT_SCRIPT = `() => {
  const abs = (u) => { try { return new URL(u, location.href).toString() } catch { return null } };
  const txt = (el) => (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 120);

  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
    .slice(0, 60)
    .map((h) => ({ level: Number(h.tagName[1]), text: txt(h) }));

  const links = [...document.querySelectorAll('a[href]')].slice(0, 400).map((a) => {
    const rel = (a.getAttribute('rel') || '').toLowerCase();
    const targetBlank = a.getAttribute('target') === '_blank';
    return {
      href: abs(a.getAttribute('href')) || '',
      text: txt(a),
      targetBlank,
      unsafeRel: targetBlank && !rel.includes('noopener') && !rel.includes('noreferrer'),
    };
  }).filter((l) => l.href);

  const labelFor = (input) => {
    if (input.getAttribute('aria-label')) return true;
    if (input.getAttribute('aria-labelledby')) return true;
    if (input.getAttribute('title')) return true;
    if (input.id && document.querySelector('label[for="' + CSS.escape(input.id) + '"]')) return true;
    if (input.closest('label')) return true;
    if (input.getAttribute('placeholder')) return true;
    return false;
  };

  const forms = [...document.querySelectorAll('form')].slice(0, 25).map((f) => {
    const action = abs(f.getAttribute('action') || '') || location.href;
    const inputs = [...f.querySelectorAll('input,select,textarea')].slice(0, 40).map((i) => ({
      type: (i.getAttribute('type') || i.tagName.toLowerCase()).toLowerCase(),
      name: i.getAttribute('name') || '',
      required: i.hasAttribute('required'),
      labelled: labelFor(i),
    }));
    return {
      action,
      method: (f.getAttribute('method') || 'get').toLowerCase(),
      insecureAction: action.startsWith('http://'),
      hasPasswordField: inputs.some((i) => i.type === 'password'),
      hasHiddenTokenField: [...f.querySelectorAll('input[type=hidden]')].some((i) =>
        /csrf|token|_token|authenticity/i.test(i.getAttribute('name') || '')
      ),
      inputs,
    };
  });

  const selectorFor = (el) => {
    if (el.id) return '#' + CSS.escape(el.id);
    const attrs = ['data-testid', 'data-test', 'name', 'aria-label'];
    for (const a of attrs) {
      const v = el.getAttribute(a);
      if (v) return el.tagName.toLowerCase() + '[' + a + '="' + v.replace(/"/g, '\\\\"') + '"]';
    }
    const parent = el.parentElement;
    if (!parent) return el.tagName.toLowerCase();
    const siblings = [...parent.children].filter((c) => c.tagName === el.tagName);
    const idx = siblings.indexOf(el) + 1;
    const parentSel = parent.id
      ? '#' + CSS.escape(parent.id)
      : parent.tagName.toLowerCase();
    return parentSel + ' > ' + el.tagName.toLowerCase() + ':nth-of-type(' + idx + ')';
  };

  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  };

  const interactive = [...document.querySelectorAll(
    'button, [role=button], input[type=button], input[type=submit], [role=tab], summary, [onclick], [data-toggle], [aria-haspopup]'
  )]
    .filter(isVisible)
    .slice(0, 60)
    .map((el) => ({
      selector: selectorFor(el),
      text: txt(el),
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
    }));

  const imgs = [...document.querySelectorAll('img')];
  const missing = imgs.filter((i) => !i.hasAttribute('alt'));
  const oversized = imgs
    .filter((i) => i.naturalWidth > 0 && i.naturalWidth > i.clientWidth * 2.5 && i.clientWidth > 0)
    .slice(0, 10)
    .map((i) => (i.currentSrc || i.src || '').slice(0, 200));

  const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
  const seen = new Set();
  const dupes = new Set();
  for (const id of ids) { if (seen.has(id)) dupes.add(id); seen.add(id); }

  const scripts = [...document.querySelectorAll('script[src]')].map((s) => s.src);
  const thirdParty = [...new Set(scripts
    .filter((s) => { try { return new URL(s).origin !== location.origin } catch { return false } })
    .map((s) => { try { return new URL(s).origin } catch { return s } }))].slice(0, 25);

  const mixed = location.protocol === 'https:'
    ? [...document.querySelectorAll('[src],[href]')]
        .map((e) => e.getAttribute('src') || e.getAttribute('href') || '')
        .filter((u) => u.startsWith('http://'))
        .slice(0, 15)
    : [];

  const tapTargets = [...document.querySelectorAll('a,button,[role=button],input,select')]
    .filter(isVisible)
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width < 24 || r.height < 24 })
    .length;

  const tech = [];
  if (window.jQuery) tech.push('jQuery ' + (window.jQuery.fn && window.jQuery.fn.jquery || '?'));
  if (window.React || document.querySelector('[data-reactroot],#__next')) tech.push('React');
  if (window.__NEXT_DATA__ || document.querySelector('#__next')) tech.push('Next.js');
  if (window.Vue || document.querySelector('[data-v-app]')) tech.push('Vue');
  if (window.ng || document.querySelector('[ng-version]')) tech.push('Angular');
  if (document.querySelector('meta[name=generator]')) {
    tech.push('generator: ' + document.querySelector('meta[name=generator]').content);
  }
  if (window.wp || document.querySelector('link[href*="wp-content"]')) tech.push('WordPress');
  if (window.Shopify) tech.push('Shopify');

  const bodyText = (document.body ? document.body.innerText || '' : '').replace(/\\s+/g, ' ').trim();

  const meta = (n) => { const el = document.querySelector('meta[name="' + n + '"]'); return el ? el.content : null };

  return {
    title: document.title || '',
    metaDescription: meta('description'),
    lang: document.documentElement.getAttribute('lang'),
    viewportMeta: meta('viewport'),
    canonical: (document.querySelector('link[rel=canonical]') || {}).href || null,
    headings,
    h1Count: document.querySelectorAll('h1').length,
    links,
    forms,
    interactive,
    images: {
      total: imgs.length,
      missingAlt: missing.length,
      samplesMissingAlt: missing.slice(0, 8).map((i) => (i.currentSrc || i.src || '').slice(0, 200)),
      oversized,
    },
    inputsWithoutLabels: [...document.querySelectorAll('input:not([type=hidden]),select,textarea')]
      .filter((i) => !labelFor(i)).length,
    duplicateIds: [...dupes].slice(0, 15),
    thirdPartyScripts: thirdParty,
    inlineScriptCount: document.querySelectorAll('script:not([src])').length,
    mixedContent: mixed,
    smallTapTargets: tapTargets,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 8,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    emptyLinks: [...document.querySelectorAll('a[href]')].filter((a) => !txt(a) && !a.querySelector('img,svg')).length,
    textSample: bodyText.slice(0, 3000),
    wordCount: bodyText ? bodyText.split(/\\s+/).length : 0,
    detectedTech: tech,
    hasSkipLink: !!document.querySelector('a[href^="#"]:first-of-type'),
    autofocusCount: document.querySelectorAll('[autofocus]').length,
  };
}`
