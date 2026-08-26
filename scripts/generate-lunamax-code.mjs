import { createHash, randomInt } from 'node:crypto'

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const requestedCount = Number.parseInt(process.argv.find((argument) => /^\d+$/.test(argument)) ?? '1', 10)
const count = Math.min(Math.max(requestedCount, 1), 100)
const codes = new Set()

while (codes.size < count) {
  codes.add(Array.from({ length: 16 }, () => alphabet[randomInt(0, alphabet.length)]).join(''))
}

const entries = [...codes].map((code) => ({
  code,
  display: code.match(/.{4}/g).join('-'),
  hash: createHash('sha256').update(code).digest('hex'),
}))
const values = entries.map((entry) => `('${entry.hash}', 30, 1)`).join(',\n')
const sql = `insert into public.plan_codes (code_hash, duration_days, max_redemptions)\nvalues\n${values};`

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ keys: entries.map((entry) => entry.display), sql }))
} else {
  console.log(`\n${entries.length} chave${entries.length === 1 ? '' : 's'} para entregar:\n`)
  console.log(entries.map((entry, index) => `${String(index + 1).padStart(2, '0')}. ${entry.display}`).join('\n'))
  console.log('\nGuarde as chaves agora: o banco recebe somente os hashes.')
  console.log('\nExecute no SQL Editor do Supabase:\n')
  console.log(`${sql}\n`)
}
