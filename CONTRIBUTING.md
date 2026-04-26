# Contributing to OpenHop

Thanks for your interest. PRs are welcome.

## Dev setup

```bash
git clone https://github.com/naorsabag/OpenHop.git
cd OpenHop
npm install          # installs deps and builds the CLI bundle
cd packages/cli && npm link
openhop --help
```

## Running the stack

```bash
npm run serve        # API server on :8787
npm run dev          # API + web UI on :8788
```

## Before submitting a PR

- Run `npm run build` — the CLI must bundle cleanly.
- Keep changes scoped. One logical change per PR.
- Write a clear commit message describing the _why_, not the _what_.
- If the change is user-facing, update `README.md` and add an entry under `Unreleased` in `CHANGELOG.md`.

## Reporting bugs

Open an issue using the `Bug report` template. Include OS, Node version, exact
command, and the full error.

## Proposing features

Open an issue using the `Feature request` template before writing a large PR, so
we can agree on scope.

## Code of conduct

Participation in this project is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
