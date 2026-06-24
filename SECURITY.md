# Security Policy

## Reporting a vulnerability

Please **don't** open a public issue for security problems.

Instead, use GitHub's **private vulnerability reporting**: go to the repository's
**Security** tab → **Report a vulnerability**. That opens a private channel with the maintainer.

I'll acknowledge reports as soon as I can and keep you posted on a fix.

## Scope

Orchid is a local macOS app that reads and edits files you point it at. It has no
account system or server. Things worth reporting include: ways a crafted Markdown
file or workspace could read/write files outside the opened folder, execute code,
or exfiltrate data.

## Supported versions

Only the latest release is supported — please update before reporting (Orchid
checks for updates in-app, or grab the latest from the Releases page).
