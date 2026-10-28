import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { CONTACT_EMAIL, LAST_UPDATED, OPERATOR } from './legal'

/** Typography for the documents (the app has no prose plugin). */
export function LegalProse({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 text-sm leading-relaxed text-foreground/90',
        '[&_h2]:mt-4 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-medium [&_h2]:text-foreground',
        '[&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:pl-5',
        '[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
        className,
      )}
    >
      {children}
    </div>
  )
}

function Contact() {
  return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
}

function DraftNotice() {
  return (
    <p className="rounded-xl border border-border bg-muted/50 p-3 text-muted-foreground">
      Draft, last updated {LAST_UPDATED}. This page is a plain-language draft and is not legal
      advice.
    </p>
  )
}

export function TermsContent() {
  return (
    <LegalProse>
      <DraftNotice />
      <p>
        Wedonomics (“the app”) is a free wedding budget planner run by {OPERATOR} in Ontario,
        Canada. By creating a wedding or signing in, you agree to these terms.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be old enough to agree to these terms where you live.</li>
        <li>One account plans one wedding. Keep access to your email or Google account safe.</li>
        <li>You are responsible for what you add to your wedding, including photos and links.</li>
      </ul>

      <h2>Sharing</h2>
      <p>
        A public wedding can be found and viewed by anyone. A private wedding can be viewed by
        anyone with its share link, so share it only with people you trust. Only the planner can
        make changes.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Don’t upload anything illegal, hateful, or that you don’t have the right to share.</li>
        <li>
          Don’t try to access other people’s weddings, overload the app, or get around limits.
        </li>
      </ul>
      <p>We may remove content or close accounts that break these rules.</p>

      <h2>The AI assistant</h2>
      <p>
        The assistant’s answers can be wrong. Check figures before relying on them. Edits it
        suggests apply only when you tap Apply.
      </p>

      <h2>No warranty</h2>
      <p>
        The app is provided as is, without guarantees. It is a planning aid, not financial advice.
        Keep your own copies of anything important (Settings has an export). To the extent the law
        allows, we aren’t liable for losses from using the app, including lost data or budgeting
        decisions.
      </p>

      <h2>Changes and ending</h2>
      <p>
        We may change the app or these terms; the date above shows the latest version. You can stop
        using the app at any time and delete your wedding and account in Settings.
      </p>

      <h2>Law and contact</h2>
      <p>
        These terms are governed by the laws of Ontario and the federal laws of Canada that apply
        there. Questions: <Contact />.
      </p>
    </LegalProse>
  )
}

export function PrivacyContent() {
  return (
    <LegalProse>
      <DraftNotice />
      <p>
        This policy explains what Wedonomics collects and why. The app is run by {OPERATOR} in
        Ontario, Canada, who is responsible for your information under Canada’s privacy law
        (PIPEDA).
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account:</strong> your email address and, if you use Google, your name and profile
          picture from Google.
        </li>
        <li>
          <strong>Your wedding:</strong> what you enter (events, budgets, payments, notes, links)
          and the photos you upload.
        </li>
        <li>
          <strong>On your device:</strong> your sign-in session and a few preferences, kept in your
          browser’s storage. We don’t use advertising or tracking cookies.
        </li>
      </ul>
      <p>Guests don’t need an account, and we don’t collect anything about them.</p>

      <h2>How we use it</h2>
      <p>
        Only to run the app: signing you in, saving and showing your wedding, and answering your
        questions in the AI assistant. We don’t sell your information or use it for ads.
      </p>

      <h2>Who sees it</h2>
      <ul>
        <li>
          Your wedding is visible to the people its visibility setting allows (public, or anyone
          with the share link). Your email is never shown to guests.
        </li>
        <li>
          Services that run the app for us: Supabase (database, sign-in and photo storage), Vercel
          (website hosting), Resend (sign-in emails), Cloudflare Turnstile (bot check), Google (if
          you sign in with Google) and Anthropic (the AI assistant receives your wedding’s details
          when you ask it a question), and Sentry (error reports: what went wrong, the page and your
          browser type, with no wedding details or email). Some of them store data outside Canada.
        </li>
        <li>We may disclose information if the law requires it.</li>
      </ul>

      <h2>Keeping and deleting</h2>
      <p>
        We keep your information while your account exists. Deleted items stay in Recently Deleted
        so you can restore them. Deleting your wedding and account in Settings removes your wedding,
        its photos and your account permanently. To see or correct your information, or if you can’t
        sign in to delete it, email <Contact />.
      </p>

      <h2>Security</h2>
      <p>
        Data is sent over encrypted connections, photos are private and shown through short-lived
        links, and only the planner can change a wedding. No system is perfectly secure; we’ll tell
        you if a breach affects you.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or requests: <Contact />. You can also contact the Office of the Privacy
        Commissioner of Canada.
      </p>
    </LegalProse>
  )
}
