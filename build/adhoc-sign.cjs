// Ad-hoc sign the packaged .app (no Apple Developer certificate required).
// This stops macOS from marking a downloaded build as "damaged"; users still
// get a one-time "Open Anyway" prompt. Runs as electron-builder's afterPack hook.
const { execSync } = require('child_process')
const path = require('path')

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(context.appOutDir, `${appName}.app`)
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
