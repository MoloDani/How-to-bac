// A plain static host (nginx serving a folder) only returns files that exist,
// so every URL the app can open needs one. This copies the prerendered shell to
// each route path: /login -> dist/client/login/index.html, and so on.
//
// Paths come from the generated route tree, so new routes are covered without
// touching this script. Run it after `vite build` (see package.json).
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'dist', 'client')
const shell = join(outDir, 'index.html')

const routeTree = readFileSync(join(root, 'src', 'routeTree.gen.ts'), 'utf8')
const block =
  /export interface FileRoutesByFullPath \{([^}]*)\}/.exec(routeTree)?.[1] ?? ''

const paths = [...block.matchAll(/'([^']+)'/g)]
  .map((match) => match[1])
  // '/' is the shell itself; dynamic segments can't be written ahead of time.
  .filter((path) => path !== '/' && !path.includes('$') && !path.includes('*'))

for (const path of paths) {
  const target = join(outDir, path, 'index.html')
  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(shell, target)
}

console.log(
  `[spa-paths] wrote index.html for ${paths.length} routes: ${paths.join(', ')}`,
)
