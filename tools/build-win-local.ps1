#!/usr/bin/env pwsh
# Local Windows x64 build script for bilibili-linux
# Usage: pwsh tools/build-win-local.ps1
# Requires: node (via mise or PATH), 7z, npx

$ErrorActionPreference = "Stop"
$rootDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (!(Test-Path "$rootDir/package.json")) { $rootDir = Get-Location }
Set-Location $rootDir

function Notice($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "    $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "    FAILED: $msg" -ForegroundColor Red }

# --- Helpers ---
function Invoke-Node {
    if (Get-Command mise -ErrorAction SilentlyContinue) {
        & mise exec -- node @args
    } else {
        & node @args
    }
}

function Invoke-Npx {
    if (Get-Command mise -ErrorAction SilentlyContinue) {
        & mise exec -- npx -y @args
    } else {
        & npx -y @args
    }
}

function Invoke-Pnpm {
    if (Get-Command mise -ErrorAction SilentlyContinue) {
        & mise exec -- pnpm @args
    } else {
        & pnpm @args
    }
}

# --- Step 0: Read configured version ---
Notice "Reading configured version"
$confVersion = (Get-Content "conf/bilibili_version" -Raw).Trim()
Ok "conf/bilibili_version: $confVersion"

# --- Step 1: Download installer ---
Notice "Downloading Bilibili installer"
New-Item -ItemType Directory -Path "cache" -Force | Out-Null
$installer = "cache/bili_win-install.exe"
if (!(Test-Path $installer)) {
    $url = "https://dl.hdslb.com/mobile/fixed/bili_win/bili_win-install.exe"
    Invoke-WebRequest -Uri $url -OutFile "$installer.tmp" -UseBasicParsing
    Move-Item "$installer.tmp" $installer -Force
}
Ok "Installer: $((Get-Item $installer).Length / 1MB) MB"

# --- Step 2: Extract resources ---
Notice "Extracting installer resources"
New-Item -ItemType Directory -Path "tmp/bili" -Force | Out-Null
& 7z x -y $installer -o"tmp/bili" '`$PLUGINSDIR/app-64.7z' | Out-Null
& 7z x -y "tmp/bili/`$PLUGINSDIR/app-64.7z" -o"tmp/bili" "resources" | Out-Null
$resDir = "tmp/bili/resources"
if (!(Test-Path "$resDir/app.asar")) { Fail "app.asar not found after extraction"; exit 1 }
Ok "Resources extracted"

# --- Step 3: Decrypt and deobfuscate ---
Notice "Decrypting and deobfuscating"
$appMain = "$resDir/app/main"
# Extract asar if not already done
if (!(Test-Path "$resDir/app/package.json")) {
    if (Test-Path "$resDir/app") { Remove-Item "$resDir/app" -Recurse -Force }
    Invoke-Npx asar e "$resDir/app.asar" "$resDir/app"
}
# Decrypt
Invoke-Node tools/app-decrypt.js "$appMain/.biliapp" "$appMain/app.orgi.js"
# Deobfuscate
Invoke-Node tools/js-decode.js "$appMain/app.orgi.js" "$appMain/app.js"
# Decode bridge
if (Test-Path "$appMain/assets/bili-bridge.js") {
    Invoke-Node tools/bridge-decode.js "$appMain/assets/bili-bridge.js" "$appMain/assets/bili-bridge.js"
}
Ok "Decrypted and deobfuscated"

# --- Step 4: Apply bypass patches ---
Notice "Applying bypass patches"
$appJs = "$appMain/app.js"
$content = Get-Content $appJs -Raw
# Auto-detect variable names from decoded code
$integrityMatch = [regex]::Match($content, '\w+ = !\w+\["app"\]\["isPackaged"\]')
$guardMatch = [regex]::Match($content, '\w+ = \w+ && \w+ === "mac" \|\| \w+ && \w+ === "win"')

$integrityVar = "dC"
$guardVar = "jT"
if ($integrityMatch.Success) {
    $integrityVar = ($integrityMatch.Value -split ' =')[0].Trim()
    Ok "Integrity check variable: $integrityVar"
} else {
    Ok "Integrity variable not detected, using default: $integrityVar"
}
if ($guardMatch.Success) {
    $guardVar = ($guardMatch.Value -split ' =')[0].Trim()
    Ok "Platform guard variable: $guardVar"
} else {
    Ok "Platform guard variable not detected, using default: $guardVar"
}

$pattern1 = "if \(!$integrityVar"
$pattern2 = "if \(!$guardVar"
$replacement1 = "if(false&&!$integrityVar"
$replacement2 = "if (false&&!$guardVar"

$content = $content -replace $pattern1, $replacement1
$content = $content -replace $pattern2, $replacement2
Set-Content $appJs $content -NoNewline

$verify = Get-Content $appJs -Raw
if ($verify -match [regex]::Escape("if(false&&!$integrityVar")) { Ok "$integrityVar bypass applied" }
else { Fail "$integrityVar bypass NOT applied" }
if ($verify -match [regex]::Escape("if (false&&!$guardVar")) { Ok "$guardVar bypass applied" }
else { Fail "$guardVar bypass NOT applied" }

# --- Step 5: Inject scripts ---
Notice "Injecting bridge and core scripts"
$resScripts = "res/scripts"
# Bridge → bili-inject.js
$bridge = Get-Content "$resScripts/inject-bridge.js" -Raw
$target = Get-Content "$appMain/assets/bili-inject.js" -Raw
Set-Content "$appMain/assets/bili-inject.js" ($bridge + "`n" + $target) -NoNewline
# Bridge → bili-preload.js
$target = Get-Content "$appMain/assets/bili-preload.js" -Raw
Set-Content "$appMain/assets/bili-preload.js" ($bridge + "`n" + $target) -NoNewline
# Core → core.js
$core = Get-Content "$resScripts/inject-core.js" -Raw
$target = Get-Content "$resDir/app/render/assets/lib/core.js" -Raw
Set-Content "$resDir/app/render/assets/lib/core.js" ($core + "`n" + $target) -NoNewline
Ok "Scripts injected"

# --- Step 6: Patch electron-updater ---
Notice "Patching electron-updater"
$providerPath = "$resDir/app/node_modules/electron-updater/out/providerFactory.js"
if (Test-Path $providerPath) {
    $c = Get-Content $providerPath -Raw
    $c = $c -replace '// noinspection SuspiciousTypeOfGuard', 'runtimeOptions.platform="win32";// noinspection SuspiciousTypeOfGuard'
    Set-Content $providerPath $c -NoNewline
    Ok "providerFactory.js patched"
}
$adapterPath = "$resDir/app/node_modules/electron-updater/out/ElectronAppAdapter.js"
if (Test-Path $adapterPath) {
    $c = Get-Content $adapterPath -Raw
    $c = $c -replace 'process\.resourcesPath', 'path.dirname(this.app.getAppPath())'
    Set-Content $adapterPath $c -NoNewline
    Ok "ElectronAppAdapter.js patched"
}

# --- Step 7: Build extension and inject ---
Notice "Building extension and inject"
Invoke-Pnpm install --frozen-lockfile
Invoke-Pnpm run build
Copy-Item "dist/inject/index.js" "$resDir/app/index.js" -Force
Ok "Extension built, inject/index.js copied as app entry"

# --- Step 8: Prepare app directory ---
Notice "Preparing app directory for electron-builder"
# Copy resources to app/
Copy-Item "$resDir/*" "app/" -Recurse -Force
# Extract asar for electron-builder (conf/build.json expects app/app)
if (Test-Path "app/app") { Remove-Item "app/app" -Recurse -Force }
Invoke-Npx asar e "app/app.asar" "app/app"
# Copy extensions into app/app/extensions
New-Item -ItemType Directory -Path "app/app/extensions" -Force | Out-Null
New-Item -ItemType Directory -Path "app/extensions" -Force | Out-Null
if (Test-Path "app/extensions/bilibili") { Remove-Item "app/extensions/bilibili" -Recurse -Force }
Copy-Item "dist/extension" "app/extensions/bilibili" -Recurse
if (Test-Path "app/extensions/thread-ripper") { Remove-Item "app/extensions/thread-ripper" -Recurse -Force }
Copy-Item "res/extensions/thread-ripper" "app/extensions/thread-ripper" -Recurse
Copy-Item "app/extensions/*" "app/app/extensions/" -Recurse -Force
# Ensure transcribe.py and app-update.yml
Copy-Item "res/scripts/transcribe.py" "app/" -Force
if (!(Test-Path "app/app-update.yml")) {
    if (Test-Path "$resDir/app-update.yml") { Copy-Item "$resDir/app-update.yml" "app/" -Force }
}
Ok "App directory ready"

# --- Step 9: Package for Windows x64 ---
Notice "Packaging for Windows x64"
New-Item -ItemType Directory -Path "tmp/build" -Force | Out-Null
Invoke-Pnpm run pkg-win
Ok "Build complete!"

# --- Step 10: Report ---
Notice "Build artifacts"
Get-ChildItem "tmp/build" -File | ForEach-Object {
    Ok "$($_.Name)  ($([math]::Round($_.Length / 1MB, 1)) MB)"
}
