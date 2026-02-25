# RNW Fabric — TTFP & TTI Benchmark

Measures **Time To First Paint** and **Time To Interactive** for a React Native Windows (Fabric New Architecture) app using JS-only instrumentation.

## What is measured

| Metric | Definition | How |
|---|---|---|
| **TTFP** | Time from bundle execution start to first frame queued for presentation | `useEffect` → `requestAnimationFrame` callback |
| **TTI** | Time from bundle execution start to JS event loop being idle and handlers live | `rAF` → `setTimeout(0)` callback |

## Measurement pipeline

```
index.js line 1          App root useEffect       rAF callback        setTimeout(0)
─────────────────────────────────────────────────────────────────────────────────────
global.__PERF_T0         shadow tree committed     frame queued        JS idle
= Date.now()             to Fabric C++ side        for DWM             handlers live
│                        │                         │                   │
▼                        ▼                         ▼                   ▼
T0                       (not measured -            TTFP = now - T0    TTI = now - T0
                          useEffect alone
                          is NOT paint)
```

### Why `useEffect` alone is NOT enough

`useEffect` fires after React's commit phase — the Fabric **shadow tree** is updated in C++ memory, but:

- No `ComponentView` has been created yet
- No Composition Visual has been submitted to DWM
- **Nothing is on screen**

`requestAnimationFrame` fires on the **next compositor tick**, meaning the visuals are queued for DWM presentation. That's the closest JS can get to "pixels on screen" without native instrumentation.

### Why `setTimeout(0)` = TTI

After the frame is queued (rAF fires), `setTimeout(0)` returns to the **end of the JS macrotask queue**. If it executes promptly:

- No pending JS work is blocking the event loop
- Touch/press handlers can fire without delay
- The app is **interactive**

## Requirements

| Requirement | Why |
|---|---|
| **Release mode** | Debug mode includes dev tools overhead, hot reload hooks, and slower JS execution (Hermes bytecode vs interpreted). Timing is meaningless in Debug. |
| **New Architecture (Fabric)** | This app uses the Fabric renderer with Composition Visuals. The rendering pipeline is fundamentally different from Paper/XAML. |
| **Cold start** | Kill the app fully before each run. Hot/warm starts skip bundle loading and skew results. |
| **5+ runs, take median** | Individual runs vary due to OS scheduling, disk cache, and GC. Median resists outliers. |

## How to test

### Option A: Command Line (CLI)

#### 1. Install dependencies

```powershell
yarn install
```

#### 2. Build & launch in Release mode

```powershell
npx @react-native-community/cli run-windows --mode Release --arch x64
```

This bundles the JS, builds the native project, and launches the app. On first run it may take 5-10 minutes (NuGet restore + full C++ build). Subsequent builds are incremental.

#### 3. Read the output

> **Release mode does NOT use Metro.** The JS bundle is pre-built and embedded in the app. There is no Metro terminal to read from.

`console.log` output in Release goes to the native **OutputDebugString** pipeline. Capture it with either:

**a) Sysinternals DebugView** (no Visual Studio needed):

```powershell
# Download from https://learn.microsoft.com/en-us/sysinternals/downloads/debugview
# Run it BEFORE launching the app:
DebugView.exe
# Filter → Include: [PERF]
```

**b) Visual Studio** — attach to the running process:

1. Debug → Attach to Process → select `RNWApp.exe`
2. Output window → "Debug" dropdown → search `[PERF]`

Expected output:

```
[PERF] TTFP: 142ms
[PERF] TTI:  148ms
```

> **Debug mode** (with Metro): `[PERF]` lines appear directly in the Metro terminal. But Debug timings are meaningless — always use Release for benchmarking.

#### 4. Cold-start protocol

```powershell
# Kill the app between runs
Stop-Process -Name RNWApp -ErrorAction SilentlyContinue

# Wait 2 seconds for process cleanup
Start-Sleep -Seconds 2

# Relaunch (already built — just start the exe)
Start-Process "$env:LOCALAPPDATA\Packages\RNWApp_*\RNWApp.exe"
```

Repeat 5+ times and record medians.

---

### Option B: Visual Studio

#### 1. Install dependencies

```powershell
cd C:\path\to\rnw-fabric-ttfp-tti-bench
yarn install
```

#### 2. Open the solution

Open `windows\RNWApp.sln` in Visual Studio 2022.

#### 3. Set build configuration

In the toolbar:
- **Configuration**: `Release`
- **Platform**: `x64` (or `ARM64`)
- **Startup project**: `RNWApp` (right-click → Set as Startup Project)

#### 4. Bundle the JS (required for Release)

Before building in Release, create the JS bundle:

```powershell
npx react-native bundle --platform windows --dev false --entry-file index.js --bundle-output windows\RNWApp\Bundle\index.windows.bundle --assets-dest windows\RNWApp\Bundle
```

#### 5. Build & run

Press **F5** (Start Debugging) or **Ctrl+F5** (Start Without Debugging).

#### 6. View TTFP / TTI output

Go to **Output** window → select **Debug** from the "Show output from" dropdown. Filter or search for `[PERF]`:

```
[PERF] TTFP: 142ms
[PERF] TTI:  148ms
```

> **Tip**: Use `Ctrl+F` in the Output pane and search `[PERF]` to jump directly to the lines.

#### 7. Cold-start re-runs

1. **Stop** the app (Shift+F5 or close the window)
2. **Wait** 2 seconds
3. **Ctrl+F5** to launch again (no rebuild needed)
4. Note the new `[PERF]` values in Output
5. Repeat 5 times

---

### Record results

| Run | TTFP (ms) | TTI (ms) |
|-----|-----------|----------|
| 1   |           |          |
| 2   |           |          |
| 3   |           |          |
| 4   |           |          |
| 5   |           |          |
| **Median** |    |          |

## Accuracy caveats

| Caveat | Impact |
|---|---|
| `Date.now()` has ~1 ms resolution | ±1 ms on each measurement |
| rAF ≈ TTFP, not exact TTFP | Actual pixel display happens at next VSYNC after DWM composites (~1 frame / 6-16 ms later) |
| No native-side timestamps | Cannot measure pre-JS time (process launch → JS engine init → bundle load) |
| OS scheduling jitter | ±2-5 ms between runs is normal |

## Tech stack

- React Native **0.81** + React **19.1**
- React Native Windows **0.81** (Fabric, New Arch, C++ Composition)
- Hermes JS engine
- Target: Windows 10 1809+ (x64/ARM64)

## Files changed

| File | Change |
|---|---|
| `index.js` | Added `global.__PERF_T0 = Date.now()` as first line (T0 anchor) |
| `App.tsx` | Added `useTTFPandTTI()` hook — measures TTFP via rAF, TTI via setTimeout(0) |
