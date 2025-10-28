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
    const [major, minor] = tsModule.version.split('.')
    const createIdentifier = (text: string): ts.Identifier => {
      if (Number(major) === 5) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return tsModule.factory.createIdentifier(text)
      }
      return tsModule.createIdentifier(text)
    }
    const propertyName = item.default ? createIdentifier('default') : undefined

    if ((Number(major) === 5)) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
      return tsModule.factory.createExportSpecifier(undefined, propertyName, tsModule.factory.createIdentifier(item.name))
    }
    if ((Number(major) === 4 && Number(minor) >= 5)) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      return tsModule.createExportSpecifier(undefined, propertyName, tsModule.createIdentifier(item.name))
    }
    return tsModule.createExportSpecifier(propertyName, tsModule.createIdentifier(item.name))
  }

  const createExportDeclaration = (input: ExportModule[], isOnlyType: boolean) => {
    const [major] = tsModule.version.split('.')
    if ((Number(major) === 5)) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      return tsModule.factory.createExportDeclaration(
        undefined,
        isOnlyType,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        tsModule.factory.createNamedExports(
          input.map(createExportSpecifier)
        ),
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        tsModule.factory.createStringLiteral(`./${removeNoNeedExtension(path)}`)
      )
    }
    return tsModule.createExportDeclaration(
      undefined,
      undefined,
      tsModule.createNamedExports(
        input.map(createExportSpecifier)
      ),
      tsModule.createStringLiteral(`./${removeNoNeedExtension(path)}`),
      isOnlyType
    )
  }

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

export const generate = (tsModule: typeof ts, files: File[], detectDuplicate = false): { content: string, scriptKind: ts.ScriptKind } => {
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

  const allExportedNames = new Set<string>()
  const statements = files.reduce(
    (result, file) => {
      // External
      if (!supportExtensions.some((ext) => file.path.endsWith(ext))) return result.concat(generateExports(tsModule, file.path, getExternalExports(file.path)))

      // Script
      const exports = analyzeExports(
        tsModule,
        getSingleFileProgram(tsModule, basename(file.path), file.content),
        allExportedNames,
        detectDuplicate
      )
      return result.concat(generateExports(tsModule, file.path, exports))
    },
    [] as ts.ExportDeclaration[]
  )

  const printer = tsModule.createPrinter()
  const updateSourceFileNode = (sourceFile: ts.SourceFile, statements: ts.ExportDeclaration[]) => {
    const [major] = tsModule.version.split('.')
    if ((Number(major) === 5)) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      return tsModule.factory.updateSourceFile(sourceFile, statements)
    }
    return tsModule.updateSourceFileNode(sourceFile, statements)
  }

  return {
    content: printer.printFile(updateSourceFileNode(sourceFile, statements)).replace(/;/g, '').replace(/"/g, '\''),
    scriptKind
  }
}
