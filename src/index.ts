import { program } from 'commander'
import fg from 'fast-glob'
import { supportExtensions } from './constant'
import ts from 'typescript'
import { generate } from './generator'
import { resolve } from 'path'
import { readFileSync, writeFileSync } from 'fs'

const getCurrentCommand = (external: boolean, cwd: string) => `generate-index${external ? ' -e' : ''} ${cwd}`

const getFileName = (tsModule: typeof ts, scriptKind: ts.ScriptKind) => {
  if (scriptKind === tsModule.ScriptKind.TSX) return 'tsx'
  if (scriptKind === tsModule.ScriptKind.TS) return 'ts'
  if (scriptKind === tsModule.ScriptKind.JSX) return 'jsx'
  return 'js'
}

const addAutoComment = (command: string, content: string) => `/* auto generator by \`${command}\` */
${content}/* auto generator end */
`

const readFile = (path: string) => {
  try {
    return readFileSync(path, { encoding: 'utf8' })
  } catch {
    return null
  }
}

const updateOrCreateFile = (command: string, path: string, content: string) => {
  const oldContent = readFile(path) ?? ''
  const startRe = /\/\* auto generator by.* \*\/\n/
  const endRe = /\/\* auto generator end \*\/\n/
  const start = startRe.exec(oldContent)
  const end = endRe.exec(oldContent)

  const output =
    (start && end)
      ? oldContent.slice(0, start.index + start[0].length) + content + oldContent.slice(end.index)
      : addAutoComment(command, content)

  console.log((start && end) ? 'Update file.' : 'Create new file.')
  writeFileSync(path, output)
}

const successMessage = '✨ Success'
program
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  .version((require('../package.json') as { version: string }).version)
  .arguments('<cwd>')
  .description('generate typescript or javascript index file')
  .option('-e, --external', 'generate no script type file with fileName', false)
  .option('-d, --detect-duplicate', 'detect duplicate exports', false)
  .action((cwd: string, cmd: { external: boolean, detectDuplicate: boolean }) => {
    console.time(successMessage)
    const cwdPath = resolve(process.cwd(), cwd)
    const tsModule = (() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      try { return require(require.resolve('typescript', { paths: [cwdPath] })) as typeof ts } catch { return ts }
    })()

    const extension = cmd.external ? '*' : `{${supportExtensions.join(',')}}`
    const files =
      fg
        .sync(`**/*.${extension}`, { cwd: cwdPath }).filter((file) => !/^index\.[jt]{1}sx{0,1}$/.test(file))
        .map((path) => ({ path, content: readFileSync(resolve(cwd, path), { encoding: 'utf8' }) }))

    const result = generate(tsModule, files, cmd.detectDuplicate)
    updateOrCreateFile(
      getCurrentCommand(!!cmd.external, cwd),
      resolve(cwd, `index.${getFileName(tsModule, result.scriptKind)}`),
      result.content
    )
    console.timeEnd(successMessage)
  })

program.parse(process.argv)
