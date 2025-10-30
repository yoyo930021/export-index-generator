import { FileProgram, ExportModule } from './types'
import type ts from 'typescript'
import { basename, extname } from 'path'

export const guessIsType = (tsModule: typeof ts, typeChecker: ts.TypeChecker, symbol: ts.Symbol): boolean => {
  const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0]
  if (!declaration) {
    throw new Error(`No declaration for ${JSON.stringify(symbol)}`)
  }

  // export interface ex6 {}
  if (tsModule.isInterfaceDeclaration(declaration)) {
    return true
  }

  // export type ex7 = '1'
  if (tsModule.isTypeAliasDeclaration(declaration)) {
    return true
  }

  // export { ex8, ex9 }
  if (tsModule.isExportSpecifier(declaration)) {
    const originalSymbol = typeChecker.getAliasedSymbol(symbol)
    if (!(originalSymbol.valueDeclaration ?? originalSymbol.declarations?.[0])) return false
    return guessIsType(tsModule, typeChecker, originalSymbol)
  }

  // export default ex10
  if (tsModule.isExportAssignment(declaration)) {
    const originalSymbol = typeChecker.getAliasedSymbol(symbol)
    if (!(originalSymbol.valueDeclaration ?? originalSymbol.declarations?.[0])) return false
    return guessIsType(tsModule, typeChecker, originalSymbol)
  }

  return false
}

export const getDefaultName = (tsModule: typeof ts, symbol: ts.Symbol, fileName: string): string => {
  const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0]
  if (!declaration) {
    throw new Error(`No declaration for ${JSON.stringify(symbol)}`)
  }

  if (tsModule.isClassDeclaration(declaration)) {
    return declaration.name?.escapedText as string || fileName
  }

  if (tsModule.isExportAssignment(declaration)) {
    return declaration.expression?.getText() || fileName
  }

  if (tsModule.isInterfaceDeclaration(declaration)) {
    return declaration.name.escapedText as string || fileName
  }

  return fileName
}

export const analyzeExports = (
  tsModule: typeof ts,
  fileProgram: FileProgram,
  allExportedNames: Set<string> | null,
  detectDuplicate = false
): ExportModule[] => {
  const { ast, program } = fileProgram
  const typeChecker = program.getTypeChecker()

  const symbol = typeChecker.getSymbolAtLocation(ast)
  if (!symbol || !symbol.exports) return []

  return Array.from(symbol.exports.values() as unknown as Iterable<ts.Symbol>)
    .map((item) => {
      const isTypeOnly = guessIsType(tsModule, typeChecker, item)
      if (item.name === 'default') {
        return {
          name: getDefaultName(tsModule, item, basename(ast.fileName, extname(ast.fileName))),
          isTypeOnly,
          default: true
        }
      }
      const exportName = item.name
      if (detectDuplicate) {
        if ((item.declarations && item.declarations.length > 1) || allExportedNames?.has(exportName)) {
          throw new Error(`Duplicate export name found: ${exportName} in file ${ast.fileName}`)
        }
        allExportedNames?.add(exportName)
      }
      return {
        name: exportName,
        isTypeOnly,
        default: false
      }
    })
}

export const getExternalExports = (path: string): ExportModule[] => {
  return [{
    name: basename(path).split('.')[0],
    isTypeOnly: false,
    default: true
  }]
}
