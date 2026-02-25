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

## How to run

### 1. Build in Release mode

```powershell
npx @react-native-community/cli run-windows --mode Release
```

### 2. Collect timings

Launch the app 5+ times (cold start each time). Look for console output:

```
[PERF] TTFP: 142ms
[PERF] TTI:  148ms
```

In Release mode without Metro, check **Debug Output** in Visual Studio (attach to process → filter for `[PERF]`).

### 3. Record results

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
