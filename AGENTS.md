# bilibili-linux

Electron Linux client for Bilibili. Wraps the official Windows client: download installer → decrypt/deobfuscate → inject custom code → repackage with Linux Electron.

## Commands

```bash
pnpm install                    # always use pnpm (packageManager pinned)
pnpm build                      # tsc -b && vite build (extension + inject bundles)
pnpm dev                        # vite build --watch
pnpm lint                       # eslint
pnpm test:translation           # translation suite (needs display; use xvfb-run on CI)
pnpm test                       # NOT unit tests — runs loongarch packaging
pnpm pkg-linux / pkg-win / pkg-mac / pkg-loongarch
pnpm gen-proto                  # regenerates src/inject/common/dynamic.ts from res/protos
```

Full local setup (Linux only, bash): `tools/setup-bilibili.sh` then `bin/bilibili`.
Needs: wget, exiftool, 7z, asar (`npx asar` works).

## Architecture

Three layers, built separately by one `vite.config.ts`:

| Layer | Entry | Output | Format | Role |
|-------|-------|--------|--------|------|
| inject (main) | `src/inject/index.ts` | `dist/inject/index.js` → copied to `app/app/index.js` | CJS | Electron main-process shim; hooks APIs then `require("./main/app.js")` loads official code |
| extension content | `src/extension/content.ts` | `dist/extension/content.js` | IIFE | Chrome MV3 content script; loads page.js + CSS |
| extension page | `src/extension/page.ts` | `dist/extension/page.js` | IIFE | In-page UI (React/AntD/Redux): settings, roaming, sponsor-block, translation |

`res/scripts/inject-*.js` are **prebuilt** JS concatenated into official bundles during `fix-other.sh` — not built by Vite.

Gitignored (generated, never commit): `app/`, `electron/`, `tmp/`, `cache/`, `dist/`.

## Build pipeline (order matters)

`tools/setup-bilibili.sh` runs in this order:

1. `update-electron.sh` — downloads Linux Electron (43.1.1; **22.3.27 for LoongArch**)
2. `update-bilibili.sh` — downloads official Windows installer; version **must** match `conf/bilibili_version` or build fails
3. `fix-other.sh` — extract asar → decrypt `.biliapp` → deobfuscate → patch platform/integrity checks → concat inject scripts → repack asar
4. `extension.sh` — `pnpm build`, copy `dist/extension` + inject `index.js` into asar
5. Move `tmp/bili/resources/*` → `app/`

When Bilibili updates, minified variable names in `fix-other.sh` change. Procedure to find new names: `docs/bypass-detection.md`.

## Debug modes (`bin/bilibili`)

- default: `electron/app.asar` (release)
- `DEBUG=1`: `tmp/bili/resources/app` (unextracted resources)
- `DEBUG=2`: `app/app` with `extensions/bilibili` symlinked to `dist/extension` (hot-reload extension)

VSCode: `.vscode/launch.json` launches `electron/electron app/app`.

## Lint / TS rules (enforced)

- `no-console` is **error** — use the project logger (`src/common/log.ts`)
- `@typescript-eslint/no-unused-vars`: prefix unused with `_`
- `perfectionist/sort-interfaces` is **error** — sort interface keys
- TS project references: `tsconfig.app.json` (src) + `tsconfig.node.json` (vite.config)
- `verbatimModuleSyntax` + `noUnusedLocals` + `noUnusedParameters` all on

## Translation

zh-CN + en. Details in `docs/Translation.md`.

- React UI strings: `src/extension/ui/locales/en.ts` (i18next `extension` namespace)
- Official client DOM translation: `src/extension/common/translation/` — exact map + dynamic regex rules in `en.ts`
- Every new dynamic rule needs an input/output example in `tests/translation/browser.ts`
- Mark React mount points with `data-bili-i18n-skip` so the DOM translator skips them

## Gotchas

- `app/` does not exist until you run the setup pipeline — `pnpm build` alone produces `dist/` only
- Electron pin is duplicated in `conf/build.json` and `tools/update-electron.sh`; keep them in sync
- CI (`.github/workflows/release.yml`) uses Node 22 + corepack pnpm; build scripts are Linux bash
- `docs/bypass-detection.md` is gitignored but is the authoritative guide for re-patching after client updates
- Official client port for bilipc is redirected via local HTTPS server on 3031 (`src/inject/common/bilibili.ts`)
- User Chromium flags: `~/.config/bilibili/bilibili-flags.conf` (parsed at startup by inject)
