/** Saves text as a file through the browser's normal download. */
export function downloadText(fileName: string, text: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([text], { type: `${mimeType};charset=utf-8` }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  // Give the browser a moment to start the download before releasing the file.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Copies using the older copy command; synchronous, and works on plain-http pages too. */
function copyWithCommand(text: string): boolean {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.append(area)
  area.select()
  area.setSelectionRange(0, text.length)
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    area.remove()
  }
}

/**
 * Copies text to the clipboard. `navigator.clipboard` only exists on secure pages (https or
 * localhost), so plain-http testing on a phone falls back to the older copy command.
 */
export async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to the fallback (e.g. permission denied).
    }
  }
  return copyWithCommand(text)
}

/**
 * Copies synchronously, for use right before opening another tab: once a new tab takes focus,
 * the browser may refuse an asynchronous clipboard write from this page.
 */
export function copyTextNow(text: string): boolean {
  if (copyWithCommand(text)) return true
  // Some browsers have retired the old command; start the async write while we still have focus.
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text).catch(() => {})
    return true
  }
  return false
}

/** True where the system share sheet can share this file (phones on https). */
export function canShareFile(file: File): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
}
