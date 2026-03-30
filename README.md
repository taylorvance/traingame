# Traingame

A small railway path-building puzzle prototype.

## Status

This repo now includes an in-browser prototype plus the game design docs and planning notes.
The toolchain follows the shared consumer conventions from `tv-shared`.

## Run

```bash
npm install
npm run dev
```

Useful scripts:

- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run playtest:report`
- `npm run verify`

## Deploy

GitHub Pages deployment follows the shared `tv-shared` consumer standard:

- CI runs through `.github/workflows/ci.yml`
- Pages deploy runs through `.github/workflows/deploy-pages.yml`

The Vite base path auto-detects the repository name during GitHub Actions builds, so the app can
deploy to a standard project Pages URL without a custom build override. You can still override it
manually with `VITE_BASE_PATH` if needed.

The app also now uses `@taylorvance/tv-shared-runtime` for project-scoped local persistence, so
the current run and playtest settings can survive refreshes without colliding with other local apps.

## Docs

- [Design Doc](docs/design.md)
- [Theme Notes](docs/theme.md)
- [Automated Playtesting](docs/automated-playtesting.md)
- [Web Prototype Plan](docs/prototype-plan.md)
- [Playtest Report](docs/playtest-report.md)

## Next Step

Current prototype focus:

- Draw 2 track tiles
- Optionally spend 1 token to hire a surveyor and reveal 2 more
- Choose 1 forced placement
- Advance the engine
- Collect tokens, check win/loss, repeat
- Tweak balancing levers from the in-app control panel
