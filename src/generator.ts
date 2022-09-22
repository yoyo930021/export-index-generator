import { ExportModule } from './types'
import type ts from 'typescript'
import { supportExtensions } from './constant'
import { analyzeExports, getExternalExports } from './analyze'
import { getSingleFileProgram } from './parser'
import { basename, extname } from 'path'

const removeNoNeedExtension = (path: string): string => {
  for (const ext of supportExtensions) {
    const result = path.replace(new RegExp(`\\.${ext}$`, 'g'), '')
    if (result !== path) return result
  }

  return path
}

const generateExports = (tsModule: typeof ts, path: string, exports: ExportModule[]): ts.ExportDeclaration[] => {
  const result: ts.ExportDeclaration[] = []
  const isTypeOnlyExports = exports.filter((item) => item.isTypeOnly)
  const otherExports = exports.filter((item) => !item.isTypeOnly)

  const createExportSpecifier = (item: ExportModule) => {
    const propertyName = item.default ? tsModule.createIdentifier('default') : undefined

    const [major, minor] = tsModule.version.split('.')
    if ((Number(major) === 4 && Number(minor) >= 5) || Number(major) > 4) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      return tsModule.createExportSpecifier(undefined, propertyName, tsModule.createIdentifier(item.name))
    }
    return tsModule.createExportSpecifier(propertyName, tsModule.createIdentifier(item.name))
  }

  const createExportDeclaration = (input: ExportModule[], isOnlyType: boolean) =>
    tsModule.createExportDeclaration(
      undefined,
      undefined,
      tsModule.createNamedExports(
        input.map(createExportSpecifier)
      ),
      tsModule.createStringLiteral(`./${removeNoNeedExtension(path)}`),
      isOnlyType
    )

  if (isTypeOnlyExports.length > 0) {
    result.push(createExportDeclaration(isTypeOnlyExports, true))
  }

  if (otherExports.length > 0) {
    result.push(createExportDeclaration(otherExports, false))
  }

  return result
}

export interface File {
  path: string
  content: string
}

export const generate = (tsModule: typeof ts, files: File[]): { content: string, scriptKind: ts.ScriptKind } => {
  const scriptKind = (() => {
    if (files.some((file) => extname(file.path) === '.tsx')) return tsModule.ScriptKind.TSX
    if (files.some((file) => extname(file.path) === '.ts')) return tsModule.ScriptKind.TS
    if (files.some((file) => extname(file.path) === '.jsx')) return tsModule.ScriptKind.JSX
    return tsModule.ScriptKind.JS
  })()

  const sourceFile = tsModule.createSourceFile(
    'index.ts',
    '',
    tsModule.ScriptTarget.ESNext,
    true,
    scriptKind
  )

  const statements = files.reduce(
    (result, file) => {
      // External
      if (!supportExtensions.some((ext) => file.path.endsWith(ext))) return result.concat(generateExports(tsModule, file.path, getExternalExports(file.path)))

      // Script
      const exports = analyzeExports(tsModule, getSingleFileProgram(tsModule, basename(file.path), file.content))
      return result.concat(generateExports(tsModule, file.path, exports))
    },
    [] as ts.ExportDeclaration[]
  )

  const printer = tsModule.createPrinter()

  return {
    content: printer.printFile(tsModule.updateSourceFileNode(sourceFile, statements)).replace(/;/g, '').replace(/"/g, '\''),
    scriptKind
  }
}
