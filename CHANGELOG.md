# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2026-10-10

### Security
- ImageMagick now runs via `execFile` with an argument array instead of a shell string.
  Earlier versions interpolated tool arguments and filenames into a shell command, allowing
  arbitrary command execution. All 1.x users should upgrade. (#33)
- Paths are passed to ImageMagick as absolute paths, so filenames can't be parsed as options. (#38)
- File access is confined to the directories in `IMAGE_TOOLS_ALLOWED_DIRS`. (#42)
- Inputs are identified by magic bytes and restricted to raster formats (PNG, JPEG, GIF, WebP,
  TIFF, BMP, ICO). Coders are pinned explicitly, and a bundled `config/policy.xml` denies
  SVG, MVG, MSL, TEXT, URL, PostScript and PDF coders. (#41)
- Dependencies updated to clear all open advisories, including the MCP SDK (1.31.0). (#43)

### Breaking changes
- Requires Node.js 20 or later.
- Tools can only read and write inside `IMAGE_TOOLS_ALLOWED_DIRS` (path-delimiter separated;
  defaults to the server's working directory). Set it explicitly in your MCP client config.
- Writing over an existing file now requires `overwrite: true`. Output can never replace its
  own input, and `batch_optimize` rejects `outputDir` equal to `inputDir`.
- `convert_format` honors `format`: an extensionless `outputPath` gets the matching extension,
  and a mismatched extension is an error.
- Non-raster inputs (SVG, PDF, PostScript and others) are rejected.
- Tool failures are returned as MCP results with `isError: true` and a
  `{"success": false, "error": "..."}` body instead of JSON-RPC errors. Unknown tools return
  `MethodNotFound`.

### Fixed
- `convert_format` wrote the format implied by the output extension, not the requested one. (#40)
- `batch_optimize` no longer treats directories with image extensions as files. (#38)

### Removed
- Unused `sharp` and `imagemagick` npm dependencies. (#43)
