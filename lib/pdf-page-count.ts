const maxPdfSize = 50 * 1024 * 1024

export async function getPdfPageCount(file: File) {
  if (!file.name.toLocaleLowerCase().endsWith(".pdf")) {
    throw new Error(`"${file.name}" không phải file PDF.`)
  }
  if (file.size === 0) {
    throw new Error(`File "${file.name}" đang trống.`)
  }
  if (file.size > maxPdfSize) {
    throw new Error(`File "${file.name}" vượt quá giới hạn 50 MB.`)
  }

  let pageCount: number
  try {
    const { PDFDocument } = await import("pdf-lib")
    const pdf = await PDFDocument.load(await file.arrayBuffer())
    pageCount = pdf.getPageCount()
  } catch {
    throw new Error(`Không đọc được số trang của "${file.name}". Kiểm tra file có bị hỏng hoặc khóa mật khẩu không.`)
  }

  if (pageCount < 1) throw new Error(`PDF "${file.name}" không có trang.`)
  return pageCount
}
