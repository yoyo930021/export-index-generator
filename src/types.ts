import type { SourceFile, Program } from 'typescript'

export interface FileProgram {
  ast: SourceFile
  program: Program
}

export interface ExportModule {
  name: string
  isTypeOnly: boolean
  default: boolean
}
