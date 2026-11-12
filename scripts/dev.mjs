import { spawn } from 'node:child_process'
const processes = [
  spawn(process.execPath, ['--env-file=.env', 'server/index.mjs'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' }),
]
let closing = false
function close(code = 0) {
  if (closing) return
  closing = true
  for (const child of processes) child.kill()
  process.exitCode = code
}
for (const child of processes) {
  child.on('error', () => close(1))
  child.on('exit', (code) => close(code ?? 1))
}
process.on('SIGINT', () => close())
process.on('SIGTERM', () => close())
