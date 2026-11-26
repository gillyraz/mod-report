type DirHandle = {
  getFileHandle: (n: string, o: { create: boolean }) => Promise<{ createWritable: () => Promise<{ write: (d: Blob) => Promise<void>; close: () => Promise<void> }> }>
}

import { PROTO } from './proto'

export const canPickFolder = () => !PROTO && 'showDirectoryPicker' in window
export const canShareFiles = (files: File[]) => !PROTO && !!navigator.canShare && navigator.canShare({ files })

/** שמירה לתיקייה במחשב (Chrome/Edge) */
export async function saveToFolder(files: File[]) {
  const dir = (await (window as unknown as { showDirectoryPicker: (o: object) => Promise<DirHandle> }).showDirectoryPicker({ mode: 'readwrite' }))
  for (const f of files) {
    const h = await dir.getFileHandle(f.name, { create: true })
    const w = await h.createWritable()
    await w.write(f)
    await w.close()
  }
}

export async function shareFiles(files: File[], title: string) {
  await navigator.share({ files, title })
}

export async function downloadFiles(files: File[]) {
  if (PROTO) return
  for (const f of files) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(f)
    a.download = f.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    await new Promise((r) => setTimeout(r, 350))
  }
}

export const pdfFile = (bytes: Uint8Array, name: string) => new File([bytes as BlobPart], name, { type: 'application/pdf' })
