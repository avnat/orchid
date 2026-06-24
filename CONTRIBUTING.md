# Contributing to Orchid

Thanks for your interest — Orchid is a small, calm Markdown reader for macOS, and contributions are welcome. 🌸

## Getting set up

```bash
npm install
npm run dev        # launch in development
npm run typecheck  # please run before opening a PR
npm run build      # production renderer/main build
```

Orchid is an Electron + React + TypeScript app (electron-vite). It targets **macOS on Apple Silicon**.

## Submitting changes

1. **Open an issue first** for anything non-trivial, so we can agree on the approach before you write code.
2. Fork, branch from `main`, and open a pull request.
3. Keep PRs **small and focused** — one change per PR is much easier to review.
4. **Run `npm run typecheck`** and make sure the app launches (`npm run dev`).
5. Match the style of the surrounding code (it's consistent — please don't reformat unrelated lines).

## A few house rules

- **Keep everything generic.** Sample documents, screenshots, and docs must not contain real company names, internal tools, customer data, or any proprietary/confidential content — only neutral demo material.
- **No secrets in commits.** Push protection is on; don't commit API keys, tokens, or credentials.
- **Discuss UI/UX changes** in an issue before building — Orchid leans deliberately minimal and calm, so new surface area needs a reason.

## Reporting bugs / requesting features

Use the issue templates (Bug report / Feature request). Include your macOS version and steps to reproduce for bugs.

By contributing, you agree your contributions are licensed under the project's [MIT License](LICENSE).
