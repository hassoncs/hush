# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release

### Changed
- Initial project setup

## [2.3.0] - 2026-01-15

### Added
- AI-native secrets management with encrypted-at-rest storage
- `hush run` command for running programs with secrets in memory
- `hush set` command for interactive secret input (AI-safe)
- `hush inspect` command for viewing masked values (AI-safe)
- `hush has` command for checking secret existence (AI-safe)
- Claude Code / OpenCode skill integration
- Support for multiple output formats: dotenv, wrangler, json, shell, yaml
- Target filtering with include/exclude patterns
- Framework support: Next.js, Vite, Remix, Expo, Cloudflare Workers, and more
- Git hook integration with `hush check`

### Fixed
- Various encryption and decryption issues

### Changed
- Migration to SOPS + age encryption (replaced deprecated methods)

### Documentation
- Comprehensive getting started guide
- Configuration documentation
- AI-native workflow documentation
- Monorepo patterns documentation

### Internal
- Monorepo structure with pnpm workspaces
- TypeScript strict mode throughout
- Vitest test suite with 95+ tests

[Unreleased]: https://github.com/hassoncs/hush/compare/v2.3.0...main
[2.3.0]: https://github.com/hassoncs/hush/releases/tag/v2.3.0
