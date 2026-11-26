import { PDFDocument } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { toPng } from 'html-to-image'

// בגרסת הניסיון (קובץ אחד) ה-worker נטען מ-blob
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.startsWith('data:') ? URL.createObjectURL(new Blob([Uint8Array.from(atob(workerUrl.split(',')[1]), (ch) => ch.charCodeAt(0))], { type: 'text/javascript' })) : workerUrl

/** תמונה ממוזערת של העמוד הראשון, לזיהוי הטופס */
export async function makeThumb(file: Blob): Promise<string | undefined> {
  try {
    if (file.type.startsWith('image/')) return await imageThumb(file)
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    const page = await doc.getPage(1)
    const vp0 = page.getViewport({ scale: 1 })
    const scale = 360 / vp0.width
    const vp = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = vp.width
    canvas.height = vp.height
    await page.render({ canvas, viewport: vp }).promise
    const url = canvas.toDataURL('image/jpeg', 0.72)
    void doc.cleanup?.()
    return url
  } catch {
    return undefined
  }
}

function imageThumb(file: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => {
      const scale = 360 / img.width
      const c = document.createElement('canvas')
      c.width = 360
      c.height = img.height * scale
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      res(c.toDataURL('image/jpeg', 0.72))
      URL.revokeObjectURL(img.src)
    }
    img.onerror = rej
    img.src = URL.createObjectURL(file)
  })
}

const A4 = { w: 595.28, h: 841.89 }

/** סריקה שהיא תמונה הופכת ל-PDF בעמוד A4; PDF נשאר כמו שהוא */
export async function asPdfBytes(blob: Blob): Promise<Uint8Array> {
  if (blob.type === 'application/pdf') return new Uint8Array(await blob.arrayBuffer())
  const doc = await PDFDocument.create()
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const img = blob.type === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(await toJpegBytes(blob))
  addImagePage(doc, img)
  return doc.save()
}

async function toJpegBytes(blob: Blob): Promise<Uint8Array> {
  if (blob.type === 'image/jpeg') return new Uint8Array(await blob.arrayBuffer())
  const bmp = await createImageBitmap(blob)
  const c = document.createElement('canvas')
  c.width = bmp.width
  c.height = bmp.height
  c.getContext('2d')!.drawImage(bmp, 0, 0)
  const b: Blob = await new Promise((r) => c.toBlob((x) => r(x!), 'image/jpeg', 0.9))
  return new Uint8Array(await b.arrayBuffer())
}

function addImagePage(doc: PDFDocument, img: { width: number; height: number } & Parameters<ReturnType<PDFDocument['addPage']>['drawImage']>[0]) {
  const page = doc.addPage([A4.w, A4.h])
  const m = 24
  const s = Math.min((A4.w - m * 2) / img.width, (A4.h - m * 2) / img.height)
  const w = img.width * s
  const h = img.height * s
  page.drawImage(img, { x: (A4.w - w) / 2, y: A4.h - m - h, width: w, height: h })
}

/** הופך אלמנט HTML (הטבלה) לקובץ PDF בגודל A4 */
export async function elementToPdf(el: HTMLElement): Promise<Uint8Array> {
  const png = await toPng(el, { pixelRatio: 2, backgroundColor: '#ffffff' })
  const doc = await PDFDocument.create()
  const img = await doc.embedPng(png)
  addImagePage(doc, img)
  return doc.save()
}
