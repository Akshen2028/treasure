/**
 * Sets up (or resets) planner access. Run it yourself in a terminal:
 *
 *   npm run planner:setup
 *
 * It uses the Supabase secret key from .env.test.local, so it runs only on your machine,
 * never in the browser. Passwords are typed into hidden prompts and sent straight to
 * Supabase Auth; they are not printed, logged or stored anywhere else.
 *
 * Steps:
 *   1. Find the wedding with slug VITE_WEDDING_SLUG (default "main"), or create it.
 *   2. Create the planner account, or reset its password if it already exists.
 *   3. Grant that account planner rights for the wedding.
 */
import { createInterface } from 'node:readline/promises'

import { createClient } from '@supabase/supabase-js'

const MIN_PASSWORD_LENGTH = 12

function fail(message: string): never {
  console.error(`\n✖ ${message}`)
  process.exit(1)
}

async function ask(question: string, fallback = ''): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const suffix = fallback ? ` (${fallback})` : ''
  const answer = (await rl.question(`${question}${suffix}: `)).trim()
  rl.close()
  return answer || fallback
}

/** Reads a line without echoing it. */
function askHidden(question: string): Promise<string> {
  const stdin = process.stdin
  if (!stdin.isTTY) fail('Run this script in an interactive terminal.')
  process.stdout.write(`${question}: `)
  return new Promise((resolve) => {
    let value = ''
    const finish = () => {
      stdin.setRawMode(false)
      stdin.pause()
      stdin.off('data', onData)
      process.stdout.write('\n')
      resolve(value)
    }
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return finish()
        if (ch === '\u0003') {
          stdin.setRawMode(false)
          process.stdout.write('\n')
          process.exit(130)
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1)
        else value += ch
      }
    }
    stdin.setRawMode(true)
    stdin.setEncoding('utf8')
    stdin.resume()
    stdin.on('data', onData)
  })
}

async function askNewPassword(): Promise<string> {
  for (;;) {
    const password = await askHidden(`New planner password (min ${MIN_PASSWORD_LENGTH} characters)`)
    if (password.length < MIN_PASSWORD_LENGTH) {
      console.log(
        `  Too short. Use at least ${MIN_PASSWORD_LENGTH} characters; a passphrase works well.`,
      )
      continue
    }
    if ((await askHidden('Confirm password')) !== password) {
      console.log('  Passwords did not match. Try again.')
      continue
    }
    return password
  }
}

async function main() {
  const url = process.env.SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!url || !secretKey) {
    fail('SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.test.local.')
  }
  const slug = process.env.VITE_WEDDING_SLUG || 'main'
  if (slug.startsWith('test-')) fail('The wedding slug must not start with "test-".')

  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log('\nWedonomics planner setup\n')

  // 1. Wedding
  const existing = await admin.from('weddings').select('id, name').eq('slug', slug).maybeSingle()
  if (existing.error) fail(`Could not read weddings: ${existing.error.message}`)
  let weddingId = existing.data?.id
  if (existing.data) {
    console.log(`Wedding: ${existing.data.name} (slug "${slug}")`)
  } else {
    console.log(`No wedding with slug "${slug}" yet. Let's create it.`)
    const name = await ask('Wedding name', 'Our Wedding')
    const date = await ask('Wedding date, YYYY-MM-DD (optional)')
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('Date must look like 2027-06-12.')
    const created = await admin
      .from('weddings')
      .insert({ slug, name, wedding_date: date || null })
      .select('id')
      .single()
    if (created.error) fail(`Could not create the wedding: ${created.error.message}`)
    weddingId = created.data.id
    console.log(`✔ Created "${name}" with the seven default categories.`)
  }

  // 2. Planner account
  const email = (await ask('\nPlanner email', process.env.VITE_PLANNER_EMAIL ?? '')).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('That does not look like an email address.')

  let userId: string | undefined
  for (let page = 1; !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) fail(`Could not list accounts: ${error.message}`)
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id
    if (data.users.length < 200) break
  }

  if (userId) {
    const reset = await ask('That account exists. Reset its password? (y/N)', 'N')
    if (/^y/i.test(reset)) {
      const password = await askNewPassword()
      const { error } = await admin.auth.admin.updateUserById(userId, { password })
      if (error) fail(`Could not update the password: ${error.message}`)
      console.log('✔ Password updated. Other devices stay signed in until they lock or expire.')
    }
  } else {
    const password = await askNewPassword()
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error || !data.user) fail(`Could not create the account: ${error?.message}`)
    userId = data.user.id
    console.log('✔ Planner account created.')
  }

  // 3. Planner rights
  const grant = await admin
    .from('planners')
    .upsert({ user_id: userId, wedding_id: weddingId! }, { onConflict: 'user_id,wedding_id' })
  if (grant.error) fail(`Could not grant planner access: ${grant.error.message}`)
  console.log('✔ Planner access granted.')

  if (process.env.VITE_PLANNER_EMAIL?.toLowerCase() !== email) {
    console.log(`\nNext: set VITE_PLANNER_EMAIL=${email} in .env.local and restart npm run dev.`)
  }
  console.log('\nDone.\n')
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)))
