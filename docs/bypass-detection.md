# 屏蔽检测 Bypass — v1.17.9+

## What Changed

Bilibili v1.17.9 rewrote the platform detection logic. The old blanket `if (!jy)` check is gone, replaced by two distinct checks:

### Check 1: Integrity check (`if (!dC)`)

```js
dC = !ds["app"]["isPackaged"] && !dB
//    ↑ true when app is NOT packaged AND not OHOS
```

When running from source (dev mode), `dC = true`, so `if (!dC)` is `false` and the check is skipped. This check verifies the `.biliapp` file hash matches the bundled code — a tamper/integrity guard. In our build, the app IS packaged, so `dC = false` and this check would fire. We bypass it with:

```bash
grep -lr 'if (!dC)' --exclude="app.asar" .
sed -i 's#if (!dC)#if(false\&\&!dC)#' "app/main/app.js"
```

### Check 2: Platform check (`if (!jT && !dB)`)

```js
dw = process["platform"] === "win32"
dz = process["platform"] === "darwin"
dA = process["platform"] === "linux"
dB = !!process["platform"]["match"](/(harmony|ohos)/i)

jS = cs  // platform string
jT = dz && jS === "mac" || dw && jS === "win"
```

The logic:
- `jT = true` on macOS or Windows → block skipped entirely
- `jT = false` on Linux/OHOS → enters block:
  - `if (!dA)` → not Linux → error 021, exit
  - `else jS !== "linux"` → IS Linux → error 022, show warning

On Windows, `jT = true` so the block is never entered. On Linux, the nested `jS !== "linux"` guard prevents the error. However, we still bypass `jT` as a safety measure:

```bash
sed -i 's#if (!jT#if (false\&\&!jT#' "app/main/app.js"
```

## How to Find the Correct Patterns Next Time

The variable names (`dC`, `jT`, `dw`, etc.) are minified and change every release. Here's how to find the new ones:

### Step 1: Decode the app

```bash
# Extract asar
asar e app.asar app

# Decrypt biliapp → raw JS
node tools/app-decrypt.js app/main/.biliapp app/main/app.orgi.js

# Decode obfuscation (requires: npm install / pnpm install)
node tools/js-decode.js app/main/app.orgi.js app/main/app.js
```

### Step 2: Find the platform variables

Search the decoded `app.js` for platform string comparisons:

```bash
grep -oP '\w+ = process\["platform"\] === "\w+"' app/main/app.js
```

You'll see something like:
```
dw = process["platform"] === "win32"
dz = process["platform"] === "darwin"
dA = process["platform"] === "linux"
```

### Step 3: Find the integrity check variable

Look for `isPackaged` near the platform variables:

```bash
grep -oP '\w+ = !\w+\["app"\]\["isPackaged"\]' app/main/app.js
```

This gives you the integrity check variable (e.g., `dC`).

### Step 4: Find the platform guard variable

Look for the compound check combining mac/win platform booleans:

```bash
grep -oP '\w+ = \w+ && \w+ === "mac" \|\| \w+ && \w+ === "win"' app/main/app.js
```

This gives you the platform guard variable (e.g., `jT`).

### Step 5: Verify the error block

Look for the error codes near the platform guard:

```bash
grep -oP 'if \(!\w+ && !\w+\).{0,200}' app/main/app.js
```

You should see the `"Start error, code: 021"` / `"Start error, code: 022"` block.

### Step 6: Update fix-other.sh

Replace the old variable names with the new ones in the `grep` and `sed` commands:

```bash
# Integrity check
grep -lr 'if (!NEW_INTEGRITY_VAR)' --exclude="app.asar" .
sed -i 's#if (!NEW_INTEGRITY_VAR)#if(false\&\&!NEW_INTEGRITY_VAR)#' "app/main/app.js"

# Platform check (optional safety bypass)
sed -i 's#if (!NEW_PLATFORM_GUARD#if (false\&\&!NEW_PLATFORM_GUARD#' "app/main/app.js"
```

## Summary

| Check | Pattern | What it blocks | How to find |
|-------|---------|---------------|-------------|
| Integrity | `if (!dC)` | Modified code detection | `grep isPackaged` |
| Platform | `if (!jT && !dB)` | Non-Win/Mac platforms | `grep process["platform"]` |

The variable names are always short minified identifiers near each other in the code. The structure and error codes (`011`, `012`, `021`, `022`) remain stable across versions — use them as anchors to find the surrounding variables.
