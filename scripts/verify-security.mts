import { exportLooksSafe, stripSensitiveKeys } from '../src/security/sanitize.ts'

const dirty = {
  title: 't',
  originalText: 'x'.repeat(500),
  apiKey: 'secret',
  nested: { token: 'abc', ok: 1 },
}
const clean = stripSensitiveKeys(dirty) as Record<string, unknown>
if ('originalText' in clean) throw new Error('originalText not stripped')
if ('apiKey' in clean) throw new Error('apiKey not stripped')
if ((clean.nested as any).token) throw new Error('nested token not stripped')
if ((clean.nested as any).ok !== 1) throw new Error('ok field lost')

const bad = JSON.stringify({ originalText: 'y'.repeat(300) })
const good = JSON.stringify({ note: 'hello' })
if (exportLooksSafe(bad)) throw new Error('expected unsafe')
if (!exportLooksSafe(good)) throw new Error('expected safe')

console.log(JSON.stringify({ ok: true, stripped: Object.keys(clean) }, null, 2))
console.log('verify:security PASSED')
