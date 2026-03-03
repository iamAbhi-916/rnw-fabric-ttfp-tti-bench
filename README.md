# RNWApp — Startup Performance Benchmark

Full-pipeline startup measurement for React Native Windows (Fabric / New Arch / Win32 Composition).  
Combines native C++ QPC timestamps (ETW TraceLogging) with JS-side TTFP/TTI to capture the **entire** startup — not just the JS portion.

## How to Run

1. **Install dependencies**
   ```powershell
   yarn install
   ```

2. **Open** `windows\RNWApp.sln` in Visual Studio 2022

3. Set toolbar to **Release | x64**

4. **Ctrl+F5** (Start Without Debugging)

5. Read the startup breakdown from the on-screen banner

For cold-start accuracy: close the app, wait 2 seconds, Ctrl+F5 again. Take median of 5 runs.

---

## Startup Time Breakdown

### What JS apps typically measure

Libraries like Shopify `react-native-performance`, Callstack's tools, and most RN perf guides only measure **JS-side** TTFP and TTI:

```
index.js T0 → rAF callback (TTFP) → setTimeout(0) (TTI)
```

On this app with Hermes `.hbc` bytecode, that gives **~3 ms TTFP / ~13 ms TTI**. Fast — but it only measures what happens *after* the JS engine is already running. It misses everything before.

### What actually happens before JS runs

```
Process Launch
  │
  ├── WinMain entry                        ─┐
  ├── WinRT init + DPI setup                │  ~70-80 ms
  ├── ReactNativeAppBuilder().Build()       ─┘
  │     ├── Hermes VM construction
  │     ├── JS thread creation
  │     ├── TurboModule registry binding
  │     ├── Bundle I/O (disk read .hbc)        ~220 ms
  │     └── loadScript (Hermes)
  │
  ├── index.js T0 = Date.now()             ← JS starts here
  ├── rAF → TTFP                              ~3 ms
  └── setTimeout(0) → TTI                     ~13 ms
```

### The full equation

| Phase | Time |
|---|---|
| WinMain → Build() | ~70-80 ms |
| Native→JS (Hermes init + bundle load) | ~220 ms |
| JS TTFP | ~3 ms |
| **TRUE TTFP (process start → first paint)** | **~300 ms** |

JS TTFP alone reports 3 ms. The real startup is ~300 ms.

### Where does the ~220 ms Native→JS gap go?

This is the cost of hosting a JavaScript runtime:

- **Hermes VM construction** — allocating heap, JIT/interpreter setup
- **JS thread creation** — dedicated thread for JS execution
- **TurboModule binding** — registering native modules into JS context
- **Bundle I/O** — reading 880 KB `.hbc` file from disk
- **loadScript** — Hermes ingesting the bytecode (memory-mapped, no parse step)

This cost exists in every cross-platform JS framework (RN, Electron, etc.) and cannot be eliminated — only reduced.

### Comparison with other frameworks

| Framework | Approximate startup | Notes |
|---|---|---|
| **WinUI 3 (native C++)** | 100–150 ms | XAML parsing + compositor init, no JS overhead |
| **React Native Windows** | ~300 ms | ~80 ms native + ~220 ms JS runtime |
| **Electron** | 500–800 ms | Chromium + V8 + IPC overhead |

RNW is the fastest cross-platform JS framework on Windows. The ~220 ms JS runtime overhead is the fundamental cost of running JavaScript — Hermes bytecode precompilation already eliminates parse time, making this close to the floor.

---

## ETW Provider

This app registers a proper ETW TraceLogging provider that emits TRUE TTFP and TRUE TTI as ETW events.

**Provider**: `RNWApp.Startup`  
**GUID**: `{8B5A2E4C-6F3D-4A1B-9C8E-2D7F0E1A3B5C}`

### Events emitted

| Event | Field | Description |
|---|---|---|
| `TTFP` | `TtfpMs` (double) | True TTFP — process start to first paint |
| `TTI` | `TtiMs` (double) | True TTI — process start to interactive |

### Sample output (from actual capture)

```xml
<Event>
  <Provider Name="RNWApp.Startup" Guid="{8b5a2e4c-6f3d-4a1b-9c8e-2d7f0e1a3b5c}" />
  <EventData>
    <Data Name="TtfpMs">383.400000</Data>
  </EventData>
  <RenderingInfo><Task>TTFP</Task></RenderingInfo>
</Event>
<Event>
  <Provider Name="RNWApp.Startup" Guid="{8b5a2e4c-6f3d-4a1b-9c8e-2d7f0e1a3b5c}" />
  <EventData>
    <Data Name="TtiMs">389.400000</Data>
  </EventData>
  <RenderingInfo><Task>TTI</Task></RenderingInfo>
</Event>
```

### Capture (Admin PowerShell)

`tracelog` ships with the Windows SDK. If not on PATH:
```powershell
$env:PATH += ";C:\Program Files (x86)\Windows Kits\10\bin\10.0.19041.0\x64"
```

**Start → Launch app → Stop → View:**
```powershell
tracelog -start RNWPerf -guid "#8B5A2E4C-6F3D-4A1B-9C8E-2D7F0E1A3B5C" -f C:\temp\rnw.etl

# Launch app (Ctrl+F5 in VS), wait for banner

tracelog -stop RNWPerf
tracerpt C:\temp\rnw.etl -o C:\temp\rnw.xml -of XML -lr -y
Get-Content C:\temp\rnw.xml
```

> **Note**: Quote the GUID (`"#8B5A2..."`) — PowerShell treats `#` as a comment otherwise.

Zero overhead when no ETW session is listening.

---

## Files

| File | Purpose |
|---|---|
| `windows/RNWApp/RNWAppTracing.h` | ETW provider, QPC timestamp infrastructure |
| `windows/RNWApp/StartupTimingModule.h` | TurboModule exposing native timings to JS |
| `windows/RNWApp/RNWApp.cpp` | 3 trace points at WinMain milestones |
| `App.tsx` | Startup pipeline display (native + JS) |
| `index.js` | `Date.now()` T0 anchor before any imports |
