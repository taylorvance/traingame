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
- `npm run verify`

## Docs

- [Design Doc](docs/design.md)
- [Theme Notes](docs/theme.md)
- [Web Prototype Plan](docs/prototype-plan.md)

## Next Step

Current prototype focus:

- Draw 2 track tiles
- Optionally spend 1 token to hire a surveyor and reveal 2 more
- Choose 1 forced placement
- Advance the engine
- Collect tokens, check win/loss, repeat
- Tweak balancing levers from the in-app control panel
