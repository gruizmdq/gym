// Hands a file over: on the iPhone, the share sheet (Save to Files, AirDrop, Mail); where files
// can't be shared, a download. Call it right in the tap: iOS refuses the sheet otherwise.
// Resolves false when the sheet is closed without sharing.
export async function shareFile(name: string, type: string, content: string): Promise<boolean> {
  const file = new File([content], name, { type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return true
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false
      throw error
    }
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
