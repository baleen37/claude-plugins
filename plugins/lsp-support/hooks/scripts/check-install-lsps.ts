#!/usr/bin/env bun
import { $ } from "bun"

const lspServers = [
  { name: 'bash-language-server', check: 'bash-language-server', install: 'npm install -g bash-language-server' },
  { name: 'pyright', check: 'pyright', install: 'npm install -g pyright' },
  { name: 'typescript-language-server', check: 'typescript-language-server', install: 'npm install -g typescript-language-server typescript' },
  { name: 'gopls', check: 'gopls', install: 'go install golang.org/x/tools/gopls@latest' },
  { name: 'kotlin-language-server', check: 'kotlin-language-server', install: 'brew install kotlin-language-server' },
  { name: 'lua-language-server', check: 'lua-language-server', install: 'brew install lua-language-server' },
  { name: 'nil', check: 'nil', install: 'cargo install --git https://github.com/oxalica/nil nil' },
]

const failures: string[] = []

for (const server of lspServers) {
  const exists = await $`command -v ${server.check}`.quiet().nothrow()
  if (exists.exitCode === 0) continue

  const result = await $`${server.install}`.quiet().nothrow()
  if (result.exitCode === 0) {
    console.error(`✓ ${server.name} installed`)
  } else {
    console.error(`✗ ${server.name} failed`)
    failures.push(server.name)
  }
}

if (failures.length > 0) {
  console.error(`\nFailed to install: ${failures.join(', ')}`)
}

process.exit(0)
