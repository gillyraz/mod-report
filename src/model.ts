import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'

// בגרסת הניסיון, או כשהדפדפן חוסם אחסון, המידע נשמר בזיכרון בלבד
const mem = new Map<string, unknown>()
const PROTO = import.meta.env.VITE_PROTO === '1'
const get = async (k: string) => (PROTO ? mem.get(k) : idbGet(k).catch(() => mem.get(k)))
const set = async (k: string, v: unknown) => (PROTO ? void mem.set(k, v) : idbSet(k, v).catch(() => void mem.set(k, v)))
const del = async (k: string) => (PROTO ? void mem.delete(k) : idbDel(k).catch(() => void mem.delete(k)))

export type Patient = {
  id: string
  name: string
  fileNo: string
  referralNo: string
  rate: number // סכום למפגש לפני מע"מ, כפי שמודפס בטופס
  archived?: boolean
  addedAt?: number // מתי נוסף לרשימה
}

export type Entry = {
  signed: number
  cancelled: number
  scanId?: string
}

export type Settings = {
  vatRate: number
  vatExempt: boolean
  tableAmount: 'total' | 'beforeVat'
  therapistName: string
}

export type Scan = {
  id: string
  name: string
  type: string
  blob: Blob
  thumb?: string
  month: string
  patientId?: string
  addedAt: number
}

export type Data = {
  patients: Patient[]
  months: Record<string, Record<string, Entry>>
  settings: Settings
}

export const defaultSettings: Settings = {
  vatRate: 18,
  vatExempt: false,
  tableAmount: 'total',
  therapistName: '',
}

const KEY = 'mod-report-data-v1'
const SCANS = 'mod-report-scans-v1'

export async function loadData(): Promise<Data> {
  const d = (await get(KEY)) as Data | undefined
  return {
    patients: d?.patients ?? [],
    months: d?.months ?? {},
    settings: { ...defaultSettings, ...(d?.settings ?? {}) },
  }
}

export const saveData = (d: Data) => set(KEY, d)

export async function loadScans(): Promise<Scan[]> {
  return ((await get(SCANS)) as Scan[] | undefined) ?? []
}
export const saveScans = (s: Scan[]) => set(SCANS, s)
export const wipeAll = async () => {
  await del(KEY)
  await del(SCANS)
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
export const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return `${HE_MONTHS[m - 1]} ${y}`
}
export const shiftMonth = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number)
  return monthKey(new Date(y, m - 1 + delta, 1))
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function calc(p: Patient, e: Entry | undefined, s: Settings) {
  const signed = e?.signed ?? 0
  const cancelled = e?.cancelled ?? 0
  const base = r2(signed * p.rate + cancelled * p.rate * 0.5)
  const vat = s.vatExempt ? 0 : r2((base * s.vatRate) / 100)
  const total = r2(base + vat)
  return { base, vat, total, sessions: signed + cancelled }
}

export const ils = (n: number) =>
  '₪' + n.toLocaleString('he-IL', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })

export type Status = 'empty' | 'amounts' | 'ready'
export function statusOf(e: Entry | undefined): Status {
  const has = (e?.signed ?? 0) + (e?.cancelled ?? 0) > 0
  if (has && e?.scanId) return 'ready'
  if (has || e?.scanId) return 'amounts'
  return 'empty'
}

export const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim()
export const scanFileName = (p: Patient, month: string) =>
  `${safeName(p.referralNo || p.fileNo)}_${safeName(p.name)}_${month}.pdf`
