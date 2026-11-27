import { readSheet } from 'read-excel-file/browser'
import writeXlsxFile from 'write-excel-file/browser'
import type { Patient } from './model'

export type Field = 'name' | 'fileNo' | 'referralNo' | 'rate'
export const FIELD_LABEL: Record<Field, string> = { name: 'שם המטופל', fileNo: 'מספר תיק', referralNo: 'מספר הפנייה', rate: 'סכום למפגש' }
const FIELDS: Field[] = ['name', 'fileNo', 'referralNo', 'rate']

export type ImportRow = {
  line: number // מספר השורה בקובץ, כפי שהוא מופיע באקסל
  name: string
  fileNo: string
  referralNo: string
  rate: number
  rateText: string
  problem?: string // למה השורה לא תיכנס
  dup?: boolean
  missing: string[] // פרטים שחסרים ויושלמו אחר כך
}
export type ImportResult = { ok: true; rows: ImportRow[] } | { ok: false; error: string }

/** מזהה עמודה לפי הכותרת שלה, גם אם הניסוח קצת שונה */
function fieldOf(h: string): Field | undefined {
  const t = h.replace(/["'״׳.\s_-]/g, '')
  if (!t) return
  if (t.includes('תיק')) return 'fileNo'
  if (t.includes('הפני') || t.includes('התחייבות')) return 'referralNo'
  if (/סכום|תעריף|מחיר|למפגש|לטיפול/.test(t)) return 'rate'
  if (t.includes('שם')) return 'name'
}

const cell = (v: unknown) => (v == null ? '' : v instanceof Date ? v.toLocaleDateString('he-IL') : String(v)).trim()

function parseCsv(text: string): string[][] {
  const first = text.split(/\r?\n/)[0] ?? ''
  const sep = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0]
  const rows: string[][] = []
  let row: string[] = [], f = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') (f += '"'), i++
      else if (ch === '"') q = false
      else f += ch
    } else if (ch === '"') q = true
    else if (ch === sep) row.push(f), (f = '')
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(f), rows.push(row), (row = []), (f = '')
    } else f += ch
  }
  if (f || row.length) row.push(f), rows.push(row)
  return rows
}

async function readCsv(f: File) {
  const buf = await f.arrayBuffer()
  let text = new TextDecoder('utf-8').decode(buf)
  // קובץ CSV שנשמר מאקסל בעברית ישנה
  if (text.includes('�')) text = new TextDecoder('windows-1255').decode(buf)
  return parseCsv(text.replace(/^﻿/, ''))
}

export async function readPatientsFile(f: File, existing: Patient[]): Promise<ImportResult> {
  const ext = f.name.split('.').pop()?.toLowerCase()
  if (ext === 'xls') return { ok: false, error: 'הקובץ בפורמט אקסל ישן (xls). פותחים אותו באקסל, שומרים בשם כ״חוברת עבודה של Excel (‎.xlsx)״, ומעלים שוב.' }
  if (ext !== 'xlsx' && ext !== 'csv') return { ok: false, error: 'אפשר להעלות קובץ אקסל (‎.xlsx) או CSV בלבד.' }
  let grid: string[][]
  try {
    grid = ext === 'csv' ? await readCsv(f) : ((await readSheet(f)) as unknown[][]).map((r) => r.map(cell))
  } catch {
    return { ok: false, error: 'לא הצלחנו לקרוא את הקובץ. כדאי לבדוק שהוא נפתח באקסל, ולשמור אותו שוב.' }
  }
  grid = grid.map((r) => r.map(cell))

  // שורת הכותרות: הראשונה מבין 10 השורות הראשונות שמזוהות בה לפחות שתי עמודות
  let head = -1
  let cols: Partial<Record<Field, number>> = {}
  for (let i = 0; i < Math.min(10, grid.length) && head < 0; i++) {
    const m: Partial<Record<Field, number>> = {}
    grid[i].forEach((h, j) => {
      const k = fieldOf(h)
      if (k && m[k] === undefined) m[k] = j
    })
    if (Object.keys(m).length >= 2) (head = i), (cols = m)
  }
  const missing = FIELDS.filter((k) => cols[k] === undefined)
  if (head < 0 || missing.length) {
    return { ok: false, error: `לא מצאנו בקובץ את העמודות: ${(head < 0 ? FIELDS : missing).map((k) => FIELD_LABEL[k]).join(', ')}. כדאי להוריד את התבנית ולהעתיק אליה את הרשימה.` }
  }

  const known = new Set(existing.map((p) => p.fileNo.trim()).filter(Boolean))
  const seen = new Set<string>()
  const rows: ImportRow[] = []
  grid.slice(head + 1).forEach((r, i) => {
    const get = (k: Field) => r[cols[k]!] ?? ''
    const name = get('name'), fileNo = get('fileNo'), referralNo = get('referralNo'), rateText = get('rate')
    if (!name && !fileNo && !referralNo && !rateText) return // שורה ריקה
    // סכום שאינו מספר (למשל ״שלוש מאות״) נחשב חסר, ומשלימים אותו אחר כך בטופס המטופל
    const numeric = !/[^\d.,₪\s]/.test(rateText)
    const parsed = parseFloat(rateText.replace(/[^\d.]/g, ''))
    const rate = numeric && parsed > 0 ? parsed : 0
    // שם הוא החובה היחידה. פרט אחר שחסר נכנס כחסר, ומשלימים אותו לפני הדיווח
    const missing = [!fileNo && FIELD_LABEL.fileNo, !referralNo && FIELD_LABEL.referralNo, !(rate > 0) && FIELD_LABEL.rate].filter(Boolean) as string[]
    let problem: string | undefined
    let dup = false
    if (!name) problem = 'חסר שם המטופל'
    else if (fileNo && known.has(fileNo)) (problem = 'כבר ברשימת המטופלים'), (dup = true)
    else if (fileNo && seen.has(fileNo)) (problem = 'מופיע פעמיים בקובץ'), (dup = true)
    if (fileNo) seen.add(fileNo)
    rows.push({ line: head + i + 2, name, fileNo, referralNo, rate, rateText: numeric ? rateText : '', problem, dup, missing })
  })
  if (!rows.length) return { ok: false, error: 'הקובץ לא כולל מטופלים מתחת לשורת הכותרות.' }
  return { ok: true, rows }
}

/** תבנית אקסל ריקה עם העמודות שהכלי מזהה */
export async function templateFile() {
  const bold = { fontWeight: 'bold' as const, backgroundColor: '#F0F2F5' }
  const blob = await writeXlsxFile([FIELDS.map((k) => ({ value: k === 'rate' ? 'סכום למפגש, לפני מע״מ' : FIELD_LABEL[k], ...bold }))], {
    sheet: 'מטופלים',
    rightToLeft: true,
    columns: [{ width: 24 }, { width: 14 }, { width: 14 }, { width: 22 }],
  }).toBlob()
  return new File([blob], 'תבנית_רשימת_מטופלים.xlsx', { type: blob.type })
}
