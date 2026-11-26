import { defaultSettings, type Data } from './model'

/** קובץ גיבוי: מטופלים, סכומים והגדרות. הסריקות לא נכללות */
export function backupFile(data: Data) {
  const blob = new Blob([JSON.stringify({ app: 'mod-report', version: 1, data }, null, 2)], { type: 'application/json' })
  const d = new Date().toISOString().slice(0, 10)
  return new File([blob], `גיבוי_דיווח_חודשי_${d}.json`, { type: 'application/json' })
}

/** קורא קובץ גיבוי. מחזיר undefined אם זה לא קובץ גיבוי של הכלי */
export async function readBackup(f: File): Promise<Data | undefined> {
  try {
    const j = JSON.parse(await f.text()) as { app?: string; data?: Data }
    if (j.app !== 'mod-report' || !j.data?.patients) return undefined
    return { patients: j.data.patients, months: j.data.months ?? {}, settings: { ...defaultSettings, ...j.data.settings } }
  } catch {
    return undefined
  }
}
