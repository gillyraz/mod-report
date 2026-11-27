import * as pdfjs from 'pdfjs-dist'
import './pdf' // מגדיר את ה-worker של pdfjs

/**
 * זיהוי מספר השורות החתומות בטבלה של טופס "חשבון טיפולים".
 * הכול רץ בדפדפן, על המחשב עצמו. הסריקה לא נשלחת לשום מקום.
 *
 * איך זה עובד: מיישרים סריקה עקומה, מוצאים את הקווים האופקיים של הטבלה
 * (שורות בגובה דומה זו מתחת לזו), ובודקים באיזו שורה יש כתב יד.
 * השורה הראשונה בטבלה היא הכותרת ולא נספרת.
 * כשהתוצאה לא חד משמעית מחזירים null, והמשתמש מזין ידנית.
 */

export type SigRow = { y: number; h: number } // יחסית לגובה העמוד (0..1), אחרי יישור
export type Sig = {
  count: number
  rows: SigRow[] // השורות שזוהו כחתומות, בעמוד הראשון בלבד
  table: { x: number; y: number; w: number; h: number } // יחסית לעמוד
  angle: number // מעלות. התצוגה מסובבת את הסימון בזווית הזו
}

export const SIG_VERSION = 1
const WIDTH = 1100

export async function detectSignatures(blob: Blob): Promise<Sig | null> {
  try {
    const pages = await renderPages(blob, 3)
    let first: Sig | null = null
    let total = 0
    let found = false
    for (let i = 0; i < pages.length; i++) {
      const r = analyze(pages[i])
      if (r === 'unsure') return null
      if (!r) continue
      found = true
      total += r.count
      if (i === 0) first = r
    }
    if (!found) return null
    return first ? { ...first, count: total } : { count: total, rows: [], table: { x: 0, y: 0, w: 0, h: 0 }, angle: 0 }
  } catch {
    return null
  }
}

type Gray = { g: Uint8ClampedArray; w: number; h: number }

async function renderPages(blob: Blob, max: number): Promise<Gray[]> {
  const out: Gray[] = []
  if (blob.type.startsWith('image/')) {
    const bmp = await createImageBitmap(blob)
    out.push(toGray(bmp, bmp.width, bmp.height))
    bmp.close()
    return out
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
  for (let n = 1; n <= Math.min(doc.numPages, max); n++) {
    const page = await doc.getPage(n)
    const vp0 = page.getViewport({ scale: 1 })
    const vp = page.getViewport({ scale: WIDTH / vp0.width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(vp.width)
    canvas.height = Math.round(vp.height)
    await page.render({ canvas, viewport: vp }).promise
    out.push(toGray(canvas, canvas.width, canvas.height))
  }
  void doc.cleanup?.()
  return out
}

function toGray(src: CanvasImageSource, sw: number, sh: number): Gray {
  const w = WIDTH
  const h = Math.round((sh / sw) * WIDTH)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(src, 0, 0, w, h)
  const d = ctx.getImageData(0, 0, w, h).data
  const g = new Uint8ClampedArray(w * h)
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (d[j] * 299 + d[j + 1] * 587 + d[j + 2] * 114) / 1000
  return { g, w, h }
}

/** כהה ביחס לסביבה הקרובה: עובד גם בסריקה כהה או עם צל */
function binarize({ g, w, h }: Gray): Uint8Array {
  const I = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) {
    let row = 0
    for (let x = 0; x < w; x++) {
      row += g[y * w + x]
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row
    }
  }
  const r = 20
  const b = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r)
    const y1 = Math.min(h, y + r + 1)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(w, x + r + 1)
      const sum = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0]
      const mean = sum / ((y1 - y0) * (x1 - x0))
      const v = g[y * w + x]
      b[y * w + x] = v < mean * 0.82 && v < 200 ? 1 : 0
    }
  }
  return b
}

/** זווית ההטיה: הזווית שבה הקווים האופקיים הכי חדים */
function skew(b: Uint8Array, w: number, h: number): number {
  const xs: number[] = []
  const ys: number[] = []
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (b[y * w + x]) xs.push(x), ys.push(y)
  if (xs.length < 200) return 0
  const score = (deg: number) => {
    const t = Math.tan((deg * Math.PI) / 180)
    const bins = new Float64Array(h + w)
    for (let i = 0; i < xs.length; i++) {
      const k = Math.round(ys[i] - (xs[i] - w / 2) * t + w / 2)
      if (k >= 0 && k < bins.length) bins[k]++
    }
    let s = 0
    for (const v of bins) s += v * v
    return s
  }
  let best = 0
  let bestS = -1
  for (let d = -6; d <= 6.001; d += 0.25) {
    const s = score(d)
    if (s > bestS) (bestS = s), (best = d)
  }
  for (let d = best - 0.2; d <= best + 0.2001; d += 0.05) {
    const s = score(d)
    if (s > bestS) (bestS = s), (best = d)
  }
  return best
}

function rotate(b: Uint8Array, w: number, h: number, deg: number): Uint8Array {
  if (Math.abs(deg) < 0.05) return b
  const a = (deg * Math.PI) / 180
  const cs = Math.cos(a)
  const sn = Math.sin(a)
  const cx = w / 2
  const cy = h / 2
  const o = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // נקודה ביישור -> נקודה בסריקה המקורית
      const dx = x - cx
      const dy = y - cy
      const sx = Math.round(cx + dx * cs - dy * sn)
      const sy = Math.round(cy + dx * sn + dy * cs)
      if (sx >= 0 && sx < w && sy >= 0 && sy < h) o[y * w + x] = b[sy * w + sx]
    }
  }
  return o
}

type Line = { y: number; x0: number; x1: number }

function hLines(b: Uint8Array, w: number, h: number): Line[] {
  const runs: { y: number; x0: number; x1: number }[] = []
  for (let y = 1; y < h - 1; y++) {
    let best = 0
    let bx0 = 0
    let start = -1
    let last = -100
    for (let x = 0; x < w; x++) {
      const on = b[(y - 1) * w + x] | b[y * w + x] | b[(y + 1) * w + x]
      if (on) {
        if (x - last > 8) start = x
        last = x
        if (last - start > best) (best = last - start), (bx0 = start)
      }
    }
    if (best > w * 0.3) runs.push({ y, x0: bx0, x1: bx0 + best })
  }
  // קו של טבלה דק. שורת טקסט צפופה עבה בהרבה, ולא נחשבת קו
  const groups: { a: number; b: number; x0: number; x1: number }[] = []
  for (const r of runs) {
    const g = groups[groups.length - 1]
    if (g && r.y - g.b <= 1) {
      g.b = r.y
      g.x0 = Math.min(g.x0, r.x0)
      g.x1 = Math.max(g.x1, r.x1)
    } else groups.push({ a: r.y, b: r.y, x0: r.x0, x1: r.x1 })
  }
  return groups.filter((g) => g.b - g.a <= 10).map((g) => ({ y: (g.a + g.b) / 2, x0: g.x0, x1: g.x1 }))
}

/** הרצף הארוך ביותר של קווים במרווחים דומים: זו הטבלה */
function findTable(lines: Line[], h: number): Line[] | null {
  let best: Line[] = []
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
      // שורת הכותרת (i..j) יכולה להיות גבוהה יותר; הצעד הקבוע נקבע מהשורה שאחריה
      const seq = [lines[i], lines[j]]
      let step = -1
      for (let k = j + 1; k < lines.length; k++) {
        const prev = seq[seq.length - 1]
        const gap = lines[k].y - prev.y
        const overlap = Math.min(prev.x1, lines[k].x1) - Math.max(prev.x0, lines[k].x0)
        if (overlap < 0.7 * (prev.x1 - prev.x0)) continue
        if (step < 0) {
          if (gap < h * 0.012 || gap > h * 0.08) break
          const head = lines[j].y - lines[i].y
          if (head < gap * 0.7 || head > gap * 3.2) break
          step = gap
          seq.push(lines[k])
        } else if (gap > step * 0.75 && gap < step * 1.3) seq.push(lines[k])
        else if (gap <= step * 0.75) continue
        else break
      }
      if (seq.length > best.length) best = seq
    }
  }
  return best.length >= 5 ? best : null
}

function analyze(img: Gray): { count: number; rows: SigRow[]; table: Sig['table']; angle: number } | null | 'unsure' {
  const { w, h } = img
  const b0 = binarize(img)
  const angle = skew(b0, w, h)
  const b = rotate(b0, w, h, angle)
  const t = findTable(hLines(b, w, h), h)
  if (!t) return null
  const x0 = Math.max(...t.map((l) => l.x0))
  const x1 = Math.min(...t.map((l) => l.x1))
  const top = t[0].y
  const bottom = t[t.length - 1].y

  // קווים אנכיים בתוך הטבלה, כדי לא לספור אותם כדיו
  const vmask = new Uint8Array(w)
  for (let x = Math.round(x0); x < x1; x++) {
    let n = 0
    for (let y = Math.round(top); y < bottom; y++) n += b[y * w + x]
    if (n > (bottom - top) * 0.6) for (let k = -4; k <= 4; k++) if (x + k >= 0 && x + k < w) vmask[x + k] = 1
  }

  // דיו בכל שורה (בלי השורה הראשונה, שהיא הכותרת)
  const rows: { y: number; h: number; ink: number }[] = []
  for (let i = 1; i < t.length - 1; i++) {
    const ya = t[i].y
    const yb = t[i + 1].y
    const m = Math.max(4, (yb - ya) * 0.15)
    let ink = 0
    let area = 0
    for (let y = Math.round(ya + m); y < yb - m; y++) {
      for (let x = Math.round(x0 + 6); x < x1 - 6; x++) {
        if (vmask[x]) continue
        area++
        ink += b[y * w + x]
      }
    }
    rows.push({ y: ya, h: yb - ya, ink: area ? ink / area : 0 })
  }
  if (rows.length < 3) return null
  // אם לא בטוחים, מנסים שוב בלי השורה האחרונה (שורת סיכום מודפסת)
  const r = classify(rows)
  const res = r === 'unsure' ? classify(rows.slice(0, -1)) : r
  if (res === 'unsure') return 'unsure'
  const sel = rows.filter((_, i) => res[i])
  return {
    count: sel.length,
    rows: sel.map((r2) => ({ y: r2.y / h, h: r2.h / h })),
    table: { x: x0 / w, y: top / h, w: (x1 - x0) / w, h: (bottom - top) / h },
    angle,
  }
}

function classify(rows: { ink: number }[]): boolean[] | 'unsure' {

  // מפרידים בין שורות ריקות למלאות. דיו מודפס (כמו מספר שורה) קבוע ונמוך
  const sorted = rows.map((r) => r.ink).sort((a, b2) => a - b2)
  const lo = sorted[0]
  const hi = sorted[sorted.length - 1]
  let filled: boolean[]
  if (hi < 0.006) filled = rows.map(() => false)
  else if (lo > 0.012 && hi / Math.max(lo, 1e-4) < 2.5) filled = rows.map(() => true)
  else {
    // הפער הגדול ביותר בין ערכים ממוינים
    let cut = -1
    let ratio = 0
    for (let i = 0; i < sorted.length - 1; i++) {
      const r = (sorted[i + 1] + 0.002) / (sorted[i] + 0.002)
      if (r > ratio && sorted[i + 1] > 0.005) (ratio = r), (cut = (sorted[i] + sorted[i + 1]) / 2)
    }
    if (ratio < 2.2) return 'unsure'
    filled = rows.map((r) => r.ink > cut)
  }

  // שורה מלאה אחרונה אחרי שורות ריקות היא כנראה שורת סיכום מודפסת
  const lastFilled = filled.lastIndexOf(true)
  if (lastFilled === filled.length - 1 && lastFilled > 0 && !filled[lastFilled - 1] && filled.slice(0, lastFilled).some(Boolean)) filled[lastFilled] = false

  // חתימות נכתבות מלמעלה למטה. יותר מחור אחד באמצע: לא בטוחים
  const end = filled.lastIndexOf(true)
  const holes = filled.slice(0, end + 1).filter((f) => !f).length
  if (holes > 1) return 'unsure'

  return filled
}
