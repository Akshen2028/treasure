import { toast } from 'sonner'

import { copyTextNow } from '@/lib/download'

/**
 * Short opener sent in the link. It holds none of the wedding data (that would end up in
 * browser history and server logs, and long links get rejected), and it reads correctly
 * whether the assistant sends it straight away or only pre-fills the message box.
 */
export const STARTER_PROMPT =
  'I’m about to paste my wedding budget, exported from my planning app (all amounts are in ' +
  'Canadian dollars). Once it’s pasted, please summarise where things stand, flag anything ' +
  'over budget or overpaid, and list the payments still to make.'

export const ASSISTANTS = [
  { name: 'ChatGPT', url: (q: string) => `https://chatgpt.com/?q=${encodeURIComponent(q)}` },
  { name: 'Claude', url: (q: string) => `https://claude.ai/new?q=${encodeURIComponent(q)}` },
] as const

export type AssistantName = (typeof ASSISTANTS)[number]['name']

/**
 * Copies the export, then opens a new chat with the starter prompt. Call it straight from a
 * click handler: copying first, while this page still has focus, is what makes it work.
 */
export function openAssistant(name: AssistantName, text: string) {
  const assistant = ASSISTANTS.find((a) => a.name === name)!
  const copied = copyTextNow(text)
  window.open(assistant.url(STARTER_PROMPT), '_blank', 'noopener,noreferrer')
  if (copied) {
    toast.success(`Export copied. In ${name}, paste it into the message box and send.`, {
      duration: 8000,
    })
  } else {
    toast.error('Couldn’t copy automatically. Use Download, then attach the file in the chat.')
  }
}
