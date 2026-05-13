# Cool Frutiger Aero Block Game

A local block-placement strategy web game with a Frutiger Aero / Aqua / Vista-inspired interface. It supports 2, 3, or 4 local players with any mix of humans and CPUs.

## Run locally

```bash
bun install
bun run dev
```

Or use the dev runner, which installs dependencies when `node_modules` is missing:

```bash
./scripts/dev.sh
```

## Build for deployment

```bash
bun run build
```

The static output is written to `dist/` and can be deployed to any static host.

## Test rules

```bash
bun test
```
