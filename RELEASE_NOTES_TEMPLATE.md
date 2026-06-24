<!--
Canonical template for GitHub release notes. Copy this, fill the {{ }} bits,
and keep the "Download & install" block VERBATIM (just update the version).
Why: Orchid is ad-hoc signed (not notarized), and macOS 15+ removed the
right-click → Open bypass — the System Settings "Open Anyway" path below is the
only GUI route that works. Never shorten it to "right-click → Open".
-->

{{one-line summary of this release}}

## Update

Already on a recent build? Orchid shows an in-app update card (or use **Orchid → Check for Updates…**). Otherwise download below.

## Download & install

> **Requires macOS on Apple Silicon** (M1 / M2 / M3 / M4).

**1. Download** `Orchid-{{VERSION}}-arm64.dmg` below.

**2. Install** — open the `.dmg`, then drag the **Orchid** icon onto the **Applications** folder.

**3. Open it the first time** (one-time, ~15 seconds):

Orchid is free and open-source, and isn't paid-signed by Apple, so macOS double-checks with you on the *very first* launch. This is normal and safe:

1. In **Applications**, double-click **Orchid**.
2. A box says *"Apple could not verify 'Orchid' is free of malware…"* → click **Done**. *(Do **not** click "Move to Bin".)*
3. Open the **Apple menu  → System Settings → Privacy & Security**.
4. Scroll to **Security** — *"Orchid was blocked to protect your Mac."* → click **Open Anyway**.
5. Confirm with **Open Anyway** (Touch ID / password if asked).

From then on, Orchid opens with a normal double-click. ✨

> Rare — if it says "damaged" or won't open, the quarantine flag got stuck. Open **Terminal** and run:
> `xattr -dr com.apple.quarantine /Applications/Orchid.app`

## What's new in {{VERSION}}

{{Added / Changed / Fixed — from CHANGELOG.md}}

---
Full history: [CHANGELOG.md](https://github.com/avnat/orchid/blob/main/CHANGELOG.md)
