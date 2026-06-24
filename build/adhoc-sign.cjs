// Ad-hoc sign the packaged .app (no Apple Developer certificate required).
// This stops macOS from marking a downloaded build as "damaged"; users still
// get a one-time "Open Anyway" prompt. Runs as electron-builder's afterPack hook.
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(context.appOutDir, `${appName}.app`)

  // Trim Chromium's per-language locale.pak files (~38 MB) down to English.
  // electron-builder's `electronLanguages` only prunes Contents/Resources on
  // macOS; the framework locales live here and must go before we sign so the
  // code seal stays valid. Orchid's UI is English-only.
  const fwResources = path.join(
    appPath,
    'Contents/Frameworks/Electron Framework.framework/Versions/A/Resources'
  )
  try {
    let freed = 0
    for (const entry of fs.readdirSync(fwResources)) {
      if (entry.endsWith('.lproj') && entry !== 'en.lproj' && entry !== 'en_US.lproj') {
        const p = path.join(fwResources, entry)
        try {
          freed += fs.statSync(path.join(p, 'locale.pak')).size
        } catch {
          /* size is informational */
        }
        fs.rmSync(p, { recursive: true, force: true })
      }
    }
    console.log(`✓ trimmed locales (~${Math.round(freed / 1e6)} MB)`)
  } catch (e) {
    console.log('locale trim skipped:', e.message)
  }

  // Sign nested helpers/frameworks first, then the app bundle, all ad-hoc ("-").
  execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' })
  // Verify (non-fatal log).
  try {
    execSync(`codesign -dv "${appPath}"`, { stdio: 'inherit' })
  } catch {
    /* verify is informational */
  }
  console.log('✓ ad-hoc signed', appPath)
}
