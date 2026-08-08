import { getDb } from '@/lib/db'
import type { MapNodeRow } from '@/lib/db/types'
import type { ExtractedControl, ExtractedForm } from '@/lib/crawl/extract'

/**
 * A condensed description of a mapped site, small enough to sit in a prompt.
 * This is what makes compilation accurate: "go to the login page" resolves to a
 * real URL and "enter the username" to a real field, because the model is
 * looking at the site's actual pages, fields and button labels rather than
 * guessing at conventions.
 */
export function buildInventory(mapId: string, limit = 30): string {
  const db = getDb()
  const nodes = db
    .prepare(
      `SELECT * FROM map_nodes
       WHERE map_id = ? AND kind = 'page'
       ORDER BY depth ASC, length(canonical_url) ASC
       LIMIT ?`,
    )
    .all(mapId, limit) as MapNodeRow[]

  if (!nodes.length) return ''

  const sections = nodes.map((node) => {
    const lines: string[] = [`PAGE ${node.canonical_url}${node.title ? ` — "${node.title}"` : ''}`]

    const forms = safeParse<ExtractedForm[]>(node.forms_json) ?? []
    for (const form of forms) {
      if (!form.fields.length) continue
      const fields = form.fields
        .map((f) => {
          const naming = [
            f.label && `label "${f.label}"`,
            f.name && `name "${f.name}"`,
            f.id && `id "${f.id}"`,
            f.placeholder && `placeholder "${f.placeholder}"`,
          ]
            .filter(Boolean)
            .join(', ')
          return `    - ${f.type} field: ${naming || '(unnamed)'}${f.required ? ' [required]' : ''}`
        })
        .join('\n')
      lines.push(`  FORM ${form.method.toUpperCase()} ${form.action}`)
      lines.push(fields)
      if (form.submitLabel) lines.push(`    - submit button: "${form.submitLabel}"`)
    }

    const controls = safeParse<ExtractedControl[]>(node.interactive_json) ?? []
    const labels = controls
      .map((c) => c.text)
      .filter(Boolean)
      .slice(0, 15)
    if (labels.length) {
      lines.push(`  BUTTONS: ${labels.map((l) => `"${l}"`).join(', ')}`)
    }

    return lines.join('\n')
  })

  return sections.join('\n\n')
}

/**
 * The live-page equivalent, used when a selector fails mid-run and the model is
 * asked to find the right element on the page as it actually is.
 */
export function describeLiveElements(
  controls: ExtractedControl[],
  forms: ExtractedForm[],
): string {
  const lines: string[] = []

  for (const form of forms.slice(0, 10)) {
    for (const field of form.fields.slice(0, 25)) {
      const naming = [
        field.label && `label "${field.label}"`,
        field.name && `name "${field.name}"`,
        field.id && `id "${field.id}"`,
        field.placeholder && `placeholder "${field.placeholder}"`,
      ]
        .filter(Boolean)
        .join(', ')
      lines.push(`INPUT ${field.type} — ${naming || '(unnamed)'} — selector: ${field.selector}`)
    }
    if (form.submitLabel) lines.push(`SUBMIT "${form.submitLabel}" in form ${form.selector}`)
  }

  for (const control of controls.slice(0, 40)) {
    lines.push(
      `${control.tag.toUpperCase()} "${control.text}"${
        control.role ? ` role=${control.role}` : ''
      } — selector: ${control.selector}`,
    )
  }

  return lines.join('\n')
}

function safeParse<T>(json: string | null): T | null {
  if (!json) return null
  try {
    return JSON.parse(json) as T
  } catch {
    return null
  }
}
