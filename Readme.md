# export-index-generator

Generate index file for JavaScript/TypeScript Library.

## feature
- [x] prefer export type for https://devblogs.microsoft.com/typescript/announcing-typescript-3-9/#export-is-always-retained.
- [x] recursive.
- [x] only update area for manual case.


## Usage
```
Usage: generate-index [options] <cwd>

generate typescript or javascript index file

Options:
  -V, --version   output the version number
  -e, --external  generate no script type file with fileName (default: false)
  -h, --help      display help for command
```
