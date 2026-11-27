import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval'
import { PROTO } from './proto'
import { defaultSettings, loadData, loadScans, wipeAll as wipeLegacy, type Data, type Scan } from './model'

/*
 * הכספת: כל המידע נשמר מוצפן בתיקייה שהמשתמש בחר במחשב.
 *   data.mrv          המטופלים, הסכומים, ההגדרות ופרטי הסריקות
 *   scans/<id>.mrv    כל סריקה בקובץ משלה
 *   טבלאות/           הטבלאות שהופקו (PDF רגיל, כדי שאפשר יהיה לשלוח אותן)
 * ההצפנה: AES-GCM 256 עם מפתח שנגזר מהסיסמה (PBKDF2-SHA256). הסיסמה עצמה לא נשמרת בשום מקום.
 * בדפדפן בלי בחירת תיקייה (טלפון) המידע נשמר מוצפן בתוך הדפדפן.
 */

const DATA = 'data.mrv'
const SCAN_DIR = 'scans'
export const TABLE_DIR = 'טבלאות'
const CONFIG = 'mod-report-vault'
const MAGIC = [77, 82, 86, 49] // MRV1
const ITER = PROTO ? 100_000 : 600_000

type Dir = {
  name: string
  kind: 'directory'
  getFileHandle: (n: string, o?: { create?: boolean }) => Promise<{ getFile: () => Promise<File>; createWritable: () => Promise<{ write: (d: BlobPart) => Promise<void>; close: () => Promise<void> }> }>
  getDirectoryHandle: (n: string, o?: { create?: boolean }) => Promise<Dir>
  removeEntry: (n: string, o?: { recursive?: boolean }) => Promise<void>
  queryPermission: (o: { mode: 'readwrite' }) => Promise<PermissionState>
  requestPermission: (o: { mode: 'readwrite' }) => Promise<PermissionState>
  entries: () => AsyncIterable<[string, unknown]>
}

type Config = { kind: 'fs'; dir: Dir } | { kind: 'browser' }

// ---------- מקום השמירה ----------
interface Store {
  kind: 'fs' | 'browser'
  label: string
  read(path: string): Promise<Uint8Array | null>
  write(path: string, bytes: Uint8Array): Promise<void>
  remove(path: string): Promise<void>
  list(dir: string): Promise<string[]>
  /** מחיקת תת-תיקייה וכל מה שבתוכה */
  removeDir?(name: string): Promise<void>
  /** מחיקת התיקייה עצמה, רק אם נשארה ריקה */
  removeRootIfEmpty?(): Promise<void>
  sub?(name: string): Promise<Dir>
}

const split = (p: string) => {
  const parts = p.split('/')
  return { dirs: parts.slice(0, -1), file: parts[parts.length - 1] }
}

function fsStore(root: Dir): Store {
  lastDir = root
  const at = async (dirs: string[], create: boolean) => {
    let d = root
    for (const n of dirs) d = await d.getDirectoryHandle(n, { create })
    return d
  }
  return {
    kind: 'fs',
    label: root.name,
    async read(path) {
      try {
        const { dirs, file } = split(path)
        const f = await (await (await at(dirs, false)).getFileHandle(file)).getFile()
        return new Uint8Array(await f.arrayBuffer())
      } catch {
        return null
      }
    },
    async write(path, bytes) {
      const { dirs, file } = split(path)
      const w = await (await (await at(dirs, true)).getFileHandle(file, { create: true })).createWritable()
      await w.write(bytes as BlobPart)
      await w.close()
    },
    async remove(path) {
      const { dirs, file } = split(path)
      try {
        await (await at(dirs, false)).removeEntry(file)
      } catch {
        /* כבר לא קיים */
      }
    },
    async list(dir) {
      try {
        const out: string[] = []
        for await (const [n] of (await at([dir], false)).entries()) out.push(n)
        return out
      } catch {
        return []
      }
    },
    sub: (name) => at([name], true),
    async removeDir(name) {
      try {
        await root.removeEntry(name, { recursive: true })
      } catch {
        /* כבר לא קיימת */
      }
    },
    async removeRootIfEmpty() {
      try {
        for await (const _ of root.entries()) return // יש בה קבצים שלא שייכים לכלי: לא נוגעים בה
        await (root as Dir & { remove?: () => Promise<void> }).remove?.()
      } catch {
        /* הדפדפן לא מאפשר למחוק את התיקייה עצמה. היא נשארת ריקה */
      }
    },
  }
}

// בגרסת הניסיון ובטלפון: בתוך הדפדפן (בגרסת הניסיון בזיכרון בלבד)
const mem = new Map<string, Uint8Array>()
function browserStore(label: string): Store {
  const k = (p: string) => `vault:${p}`
  return {
    kind: PROTO ? 'fs' : 'browser',
    label,
    read: async (p) => (PROTO ? mem.get(p) ?? null : ((await idbGet(k(p))) as Uint8Array | undefined) ?? null),
    write: async (p, b) => void (PROTO ? mem.set(p, b) : await idbSet(k(p), b)),
    remove: async (p) => void (PROTO ? mem.delete(p) : await idbDel(k(p))),
    list: async (dir) => {
      const all = PROTO ? [...mem.keys()] : ((await idbKeys()) as string[]).filter((x) => typeof x === 'string' && x.startsWith('vault:')).map((x) => x.slice(6))
      return all.filter((x) => x.startsWith(dir + '/')).map((x) => x.slice(dir.length + 1))
    },
  }
}

// ---------- הצפנה ----------
const enc = new TextEncoder()
const dec = new TextDecoder()

async function deriveKey(password: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

async function seal(key: CryptoKey, salt: Uint8Array, plain: Uint8Array) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain as BufferSource))
  const out = new Uint8Array(4 + 16 + 12 + ct.length)
  out.set(MAGIC, 0)
  out.set(salt, 4)
  out.set(iv, 20)
  out.set(ct, 32)
  return out
}

const isSealed = (b: Uint8Array) => b.length > 32 && MAGIC.every((m, i) => b[i] === m)
const saltOf = (b: Uint8Array) => b.slice(4, 20)

async function unseal(key: CryptoKey, b: Uint8Array) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(20, 32) }, key, b.slice(32)))
}

// ---------- מצב הכספת ----------
type Meta = Omit<Scan, 'blob'>
type Payload = { app: 'mod-report'; v: 1 | 2; data: Data; scans: Meta[]; files?: Record<string, string> }

let store: Store | null = null
let lastDir: Dir | null = null
let key: CryptoKey | null = null
let salt: Uint8Array | null = null
let written = new Set<string>() // סריקות שכבר נכתבו לתיקייה

export const canPickFolder = () => PROTO || 'showDirectoryPicker' in window
export const folderLabel = () => store?.label ?? ''
export const isFolder = () => store?.kind === 'fs'
export const tablesDir = async () => (store?.sub ? store.sub(TABLE_DIR) : null)

export type Boot = { state: 'setup'; legacy: boolean } | { state: 'locked'; label: string; needsPermission: boolean }

/** בכניסה: האם כבר נבחר מקום שמירה */
export async function boot(): Promise<Boot> {
  const cfg = PROTO ? protoCfg : ((await idbGet(CONFIG).catch(() => undefined)) as Config | undefined)
  const legacy = PROTO ? false : !!(await loadData().catch(() => null))?.patients.length
  if (!cfg) return { state: 'setup', legacy }
  if (cfg.kind === 'fs' && !PROTO) {
    store = fsStore(cfg.dir)
    const p = await cfg.dir.queryPermission({ mode: 'readwrite' }).catch(() => 'prompt' as PermissionState)
    return { state: 'locked', label: cfg.dir.name, needsPermission: p !== 'granted' }
  }
  store = browserStore(PROTO ? 'דיווח חודשי' : 'הדפדפן במכשיר הזה')
  return { state: 'locked', label: store.label, needsPermission: false }
}
let protoCfg: Config | undefined

export type Pick = { ok: true; label: string; existing: boolean } | { ok: false; reason: 'cancel' | 'unsupported' }

/** בחירת תיקייה. מחזיר אם כבר יש בה מידע של הכלי */
export async function pickFolder(): Promise<Pick> {
  if (PROTO) {
    store = browserStore('דיווח חודשי')
    return { ok: true, label: store.label, existing: !!(await store.read(DATA)) }
  }
  if (!('showDirectoryPicker' in window)) return { ok: false, reason: 'unsupported' }
  try {
    const dir = (await (window as unknown as { showDirectoryPicker: (o: object) => Promise<Dir> }).showDirectoryPicker({ mode: 'readwrite', id: 'mod-report', startIn: 'documents' })) as Dir
    store = fsStore(dir)
    return { ok: true, label: dir.name, existing: !!(await store.read(DATA)) }
  } catch {
    return { ok: false, reason: 'cancel' }
  }
}

/** בטלפון: בלי תיקייה, בתוך הדפדפן */
export function useBrowserStore() {
  store = browserStore('הדפדפן במכשיר הזה')
}

async function remember() {
  if (!store) return
  if (PROTO) return void (protoCfg = { kind: 'browser' })
  // נשמרת רק ההפניה לתיקייה (בלי תוכן), כדי לבקש הרשאה בכניסה הבאה
  const cfg: Config = store.kind === 'fs' && lastDir ? { kind: 'fs', dir: lastDir } : { kind: 'browser' }
  await idbSet(CONFIG, cfg)
}

/** יצירת כספת חדשה בתיקייה שנבחרה. מעביר לתוכה מידע ישן שנשמר בדפדפן, אם יש */
export async function create(password: string): Promise<{ data: Data; scans: Scan[] }> {
  salt = crypto.getRandomValues(new Uint8Array(16))
  key = await deriveKey(password, salt)
  const data = PROTO ? emptyData() : await loadData()
  const scans = PROTO ? [] : await loadScans()
  written = new Set()
  await writeAll(data, scans)
  await remember()
  if (!PROTO) await wipeLegacy()
  return { data, scans }
}

export type Unlock = { ok: true; data: Data; scans: Scan[] } | { ok: false; reason: 'password' | 'missing' | 'permission' }

/** פתיחה: אישור גישה לתיקייה (באותה לחיצה) ופענוח */
export async function unlock(password: string): Promise<Unlock> {
  if (!store) return { ok: false, reason: 'missing' }
  const dir = lastDir
  if (store.kind === 'fs' && dir && !PROTO) {
    const p = await dir.requestPermission({ mode: 'readwrite' }).catch(() => 'denied' as PermissionState)
    if (p !== 'granted') return { ok: false, reason: 'permission' }
  }
  const raw = await store.read(DATA)
  if (!raw || !isSealed(raw)) return { ok: false, reason: 'missing' }
  const s = saltOf(raw)
  const k = await deriveKey(password, s)
  let payload: Payload
  try {
    payload = JSON.parse(dec.decode(await unseal(k, raw)))
  } catch {
    return { ok: false, reason: 'password' }
  }
  key = k
  salt = s
  const scans: Scan[] = []
  for (const m of payload.scans ?? []) {
    const b = await store.read(`${SCAN_DIR}/${m.id}.mrv`)
    if (!b) continue
    scans.push({ ...m, blob: new Blob([(await unseal(k, b)) as BlobPart], { type: m.type }) })
  }
  written = new Set(scans.map((x) => x.id))
  await remember()
  return { ok: true, data: normalize(payload.data), scans }
}

export function lock() {
  key = null
  written = new Set()
}

const normalize = (d: Partial<Data>): Data => ({
  patients: d.patients ?? [],
  months: d.months ?? {},
  settings: { ...defaultSettings, ...(d.settings ?? {}) },
  monthVat: d.monthVat ?? {},
  reports: d.reports ?? {},
})
const emptyData = () => normalize({})

// ---------- כתיבה ----------
let queue: Promise<unknown> = Promise.resolve()
let pending: { data: Data; scans: Scan[] } | null = null
let timer: number | undefined
export let saveError: ((e: unknown) => void) | null = null
export const onSaveError = (fn: (e: unknown) => void) => void (saveError = fn)

async function writeAll(data: Data, scans: Scan[]) {
  if (!store || !key || !salt) return
  const k = key, s = salt, st = store
  for (const sc of scans) {
    if (written.has(sc.id)) continue
    await st.write(`${SCAN_DIR}/${sc.id}.mrv`, await seal(k, s, new Uint8Array(await sc.blob.arrayBuffer())))
    written.add(sc.id)
  }
  const meta: Meta[] = scans.map(({ blob: _b, ...m }) => m)
  const payload: Payload = { app: 'mod-report', v: 1, data, scans: meta }
  await st.write(DATA, await seal(k, s, enc.encode(JSON.stringify(payload))))
  const keep = new Set(scans.map((x) => x.id))
  for (const id of [...written]) if (!keep.has(id)) (await st.remove(`${SCAN_DIR}/${id}.mrv`), written.delete(id))
}

/** שמירה אחרי כל שינוי, מקובצת לחצי שנייה */
export function save(data: Data, scans: Scan[]) {
  pending = { data, scans }
  window.clearTimeout(timer)
  timer = window.setTimeout(flush, 400)
}
export function flush() {
  window.clearTimeout(timer)
  if (!pending) return queue
  const p = pending
  pending = null
  queue = queue.then(() => writeAll(p.data, p.scans)).catch((e) => saveError?.(e))
  return queue
}

// ---------- פעולות מההגדרות ----------
export async function changePassword(current: string, next: string): Promise<boolean> {
  if (!store || !key) return false
  await flush()
  const raw = await store.read(DATA)
  if (!raw) return false
  try {
    await unseal(await deriveKey(current, saltOf(raw)), raw)
  } catch {
    return false
  }
  const s2 = crypto.getRandomValues(new Uint8Array(16))
  const k2 = await deriveKey(next, s2)
  for (const id of written) {
    const b = await store.read(`${SCAN_DIR}/${id}.mrv`)
    if (b) await store.write(`${SCAN_DIR}/${id}.mrv`, await seal(k2, s2, await unseal(key, b)))
  }
  await store.write(DATA, await seal(k2, s2, await unseal(key, raw)))
  key = k2
  salt = s2
  return true
}

export type Move = { ok: true; label: string } | { ok: false; reason: 'cancel' | 'unsupported' | 'existing' | 'same' }

/** העברת המידע לתיקייה אחרת: מעתיקים את הקבצים המוצפנים כמו שהם */
export async function moveFolder(): Promise<Move> {
  if (!store) return { ok: false, reason: 'cancel' }
  await flush()
  const from = store
  if (PROTO) return { ok: true, label: from.label }
  if (!('showDirectoryPicker' in window)) return { ok: false, reason: 'unsupported' }
  let dir: Dir
  try {
    dir = await (window as unknown as { showDirectoryPicker: (o: object) => Promise<Dir> }).showDirectoryPicker({ mode: 'readwrite', id: 'mod-report' })
  } catch {
    return { ok: false, reason: 'cancel' }
  }
  if (lastDir && (await (lastDir as unknown as { isSameEntry: (d: Dir) => Promise<boolean> }).isSameEntry(dir).catch(() => false))) return { ok: false, reason: 'same' }
  const prev = lastDir
  const to = fsStore(dir)
  lastDir = prev
  if (await to.read(DATA)) return { ok: false, reason: 'existing' }
  for (const n of await from.list(SCAN_DIR)) {
    const b = await from.read(`${SCAN_DIR}/${n}`)
    if (b) await to.write(`${SCAN_DIR}/${n}`, b)
  }
  await to.write(DATA, (await from.read(DATA))!)
  lastDir = dir
  store = to
  await remember()
  return { ok: true, label: dir.name }
}

const toB64 = (u: Uint8Array) => {
  let s = ''
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}
const fromB64 = (b: string) => Uint8Array.from(atob(b), (ch) => ch.charCodeAt(0))

/** גיבוי לקובץ: עותק מוצפן של כל המידע, כולל הסריקות */
export async function backupBytes(data: Data, scans: Scan[]) {
  if (!key || !salt) return null
  const files: Record<string, string> = {}
  for (const sc of scans) files[sc.id] = toB64(new Uint8Array(await sc.blob.arrayBuffer()))
  const payload: Payload = { app: 'mod-report', v: 2, data, scans: scans.map(({ blob: _b, ...m }) => m), files }
  return seal(key, salt, enc.encode(JSON.stringify(payload)))
}

export type ReadBackup = { ok: true; data: Data; scans: Scan[] } | { ok: false; reason: 'password' | 'invalid' }

const scansOf = (p: Payload): Scan[] =>
  (p.scans ?? []).flatMap((m) => (p.files?.[m.id] ? [{ ...m, blob: new Blob([fromB64(p.files[m.id]) as BlobPart], { type: m.type }) }] : []))

/** קריאת קובץ גיבוי: מוצפן (בסיסמה הנוכחית או בסיסמה שהוזנה) או קובץ גיבוי ישן */
export async function readBackup(bytes: Uint8Array, password?: string): Promise<ReadBackup> {
  if (isSealed(bytes)) {
    try {
      const k = password ? await deriveKey(password, saltOf(bytes)) : salt && equal(saltOf(bytes), salt) ? key! : null
      if (!k) return { ok: false, reason: 'password' }
      const p = JSON.parse(dec.decode(await unseal(k, bytes))) as Payload
      return { ok: true, data: normalize(p.data), scans: scansOf(p) }
    } catch {
      return { ok: false, reason: 'password' }
    }
  }
  try {
    const j = JSON.parse(dec.decode(bytes)) as { app?: string; data?: Data }
    if (j.app !== 'mod-report' || !j.data?.patients) return { ok: false, reason: 'invalid' }
    return { ok: true, data: normalize(j.data), scans: [] }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}
const equal = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i])

/** מחיקת כל המידע מהתיקייה ומהדפדפן */
export async function wipe() {
  window.clearTimeout(timer)
  pending = null
  await queue
  if (store) {
    // כל מה שהכלי יצר בתיקייה: קובץ המידע, הסריקות והטבלאות שנשמרו
    if (store.removeDir) {
      await store.removeDir(SCAN_DIR)
      await store.removeDir(TABLE_DIR)
    } else for (const n of await store.list(SCAN_DIR)) await store.remove(`${SCAN_DIR}/${n}`)
    await store.remove(DATA)
    await store.removeRootIfEmpty?.()
  }
  if (PROTO) protoCfg = undefined
  else (await idbDel(CONFIG).catch(() => {}), await wipeLegacy().catch(() => {}))
  store = null
  key = null
  salt = null
  written = new Set()
  lastDir = null
}

