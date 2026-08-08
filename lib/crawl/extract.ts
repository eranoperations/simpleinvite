/**
 * Serialized into the page under test and evaluated in the browser, so it must
 * be entirely self-contained — no imports, no closures over Node-side values.
 *
 * Playwright treats a string argument to `page.evaluate` as an *expression*, so
 * passing this source directly returns the function itself (serializing to
 * undefined) instead of calling it. `evalInPage` wraps it as an IIFE.
 */

export interface ExtractedLink {
  href: string
  text: string
  selector: string
}

export interface ExtractedControl {
  selector: string
  text: string
  tag: string
  role: string | null
  type: string | null
}

export interface ExtractedField {
  type: string
  name: string
  id: string
  label: string
  placeholder: string
  required: boolean
  selector: string
}

export interface ExtractedForm {
  action: string
  method: string
  selector: string
  fields: ExtractedField[]
  submitLabel: string
}

export interface PageExtract {
  title: string
  headings: string[]
  links: ExtractedLink[]
  interactive: ExtractedControl[]
  forms: ExtractedForm[]
  textSample: string
}

export const EXTRACT_SCRIPT = String.raw`() => {
  const abs = (u) => { try { return new URL(u, location.href).toString() } catch { return null } };
  const txt = (el) => ((el && (el.innerText || el.textContent)) || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  const esc = (v) => (window.CSS && CSS.escape ? CSS.escape(v) : String(v).replace(/[^a-zA-Z0-9_-]/g, '\\$&'));

  // Preference ladder for a selector that survives a re-render: an explicit
  // test id or id beats a name, which beats an aria-label, which beats a
  // structural path. The path is the last resort because it breaks the moment
  // a sibling is inserted.
  const selectorFor = (el) => {
    const testId = el.getAttribute('data-testid') || el.getAttribute('data-test-id');
    if (testId) return '[data-testid="' + testId.replace(/"/g, '\\"') + '"]';
    if (el.id && !/^[0-9]/.test(el.id) && document.querySelectorAll('#' + esc(el.id)).length === 1) {
      return '#' + esc(el.id);
    }
    const name = el.getAttribute('name');
    if (name) {
      const sel = el.tagName.toLowerCase() + '[name="' + name.replace(/"/g, '\\"') + '"]';
      if (document.querySelectorAll(sel).length === 1) return sel;
    }
    const aria = el.getAttribute('aria-label');
    if (aria) {
      const sel = '[aria-label="' + aria.replace(/"/g, '\\"') + '"]';
      if (document.querySelectorAll(sel).length === 1) return sel;
    }
    const path = [];
    let node = el;
    while (node && node.nodeType === 1 && path.length < 6) {
      let part = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (parent) {
        const same = [...parent.children].filter((c) => c.tagName === node.tagName);
        if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
      }
      path.unshift(part);
      if (node.id) { path.unshift('#' + esc(node.id)); break; }
      node = parent;
      if (node === document.body) break;
    }
    return path.join(' > ') || el.tagName.toLowerCase();
  };

  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none';
  };

  const links = [...document.querySelectorAll('a[href]')]
    .slice(0, 500)
    .map((a) => ({ href: abs(a.getAttribute('href')) || '', text: txt(a) || (a.querySelector('img') ? (a.querySelector('img').getAttribute('alt') || 'image link') : ''), selector: selectorFor(a) }))
    .filter((l) => l.href);

  // Anchors are already covered by links; including them here would double every
  // navigation edge, once as a link and once as a click.
  const controlSel = 'button, [role="button"], input[type="submit"], input[type="button"], [onclick], summary, [role="tab"], [role="menuitem"]';
  const interactive = [...document.querySelectorAll(controlSel)]
    .filter((el) => el.tagName !== 'A' && visible(el) && !el.disabled)
    .slice(0, 120)
    .map((el) => ({
      selector: selectorFor(el),
      text: txt(el) || el.getAttribute('aria-label') || el.getAttribute('value') || el.getAttribute('title') || '',
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
      type: el.getAttribute('type'),
    }));

  const labelText = (input) => {
    const aria = input.getAttribute('aria-label');
    if (aria) return aria.trim().slice(0, 80);
    if (input.id) {
      const lab = document.querySelector('label[for="' + esc(input.id) + '"]');
      if (lab) return txt(lab).slice(0, 80);
    }
    const wrapper = input.closest('label');
    if (wrapper) return txt(wrapper).slice(0, 80);
    const labelledBy = input.getAttribute('aria-labelledby');
    if (labelledBy) {
      const ref = document.getElementById(labelledBy);
      if (ref) return txt(ref).slice(0, 80);
    }
    return '';
  };

  const forms = [...document.querySelectorAll('form')].slice(0, 25).map((f) => {
    const submit = f.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
    return {
      action: abs(f.getAttribute('action') || '') || location.href,
      method: (f.getAttribute('method') || 'get').toLowerCase(),
      selector: selectorFor(f),
      submitLabel: submit ? (txt(submit) || submit.getAttribute('value') || 'Submit') : '',
      fields: [...f.querySelectorAll('input, select, textarea')]
        .filter((i) => i.getAttribute('type') !== 'hidden')
        .slice(0, 40)
        .map((i) => ({
          type: (i.getAttribute('type') || i.tagName.toLowerCase()).toLowerCase(),
          name: i.getAttribute('name') || '',
          id: i.id || '',
          label: labelText(i),
          placeholder: i.getAttribute('placeholder') || '',
          required: i.hasAttribute('required'),
          selector: selectorFor(i),
        })),
    };
  });

  // Standalone inputs outside any <form> are common in SPAs and would otherwise
  // be invisible to the scenario compiler.
  const loose = [...document.querySelectorAll('input, select, textarea')]
    .filter((i) => !i.closest('form') && i.getAttribute('type') !== 'hidden' && visible(i))
    .slice(0, 30)
    .map((i) => ({
      type: (i.getAttribute('type') || i.tagName.toLowerCase()).toLowerCase(),
      name: i.getAttribute('name') || '',
      id: i.id || '',
      label: labelText(i),
      placeholder: i.getAttribute('placeholder') || '',
      required: i.hasAttribute('required'),
      selector: selectorFor(i),
    }));
  if (loose.length) {
    forms.push({ action: location.href, method: 'none', selector: 'body', submitLabel: '', fields: loose });
  }

  return {
    title: (document.title || '').trim().slice(0, 200),
    headings: [...document.querySelectorAll('h1, h2')].slice(0, 12).map((h) => txt(h)).filter(Boolean),
    links,
    interactive,
    forms,
    textSample: txt(document.body).slice(0, 600),
  };
}`
