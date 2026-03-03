#pragma once

#include <TraceLoggingProvider.h>
#include <winmeta.h>

// ETW Provider: RNWApp.Startup {8B5A2E4C-6F3D-4A1B-9C8E-2D7F0E1A3B5C}
TRACELOGGING_DEFINE_PROVIDER(
    g_hRNWAppProvider,
    "RNWApp.Startup",
    (0x8b5a2e4c, 0x6f3d, 0x4a1b, 0x9c, 0x8e, 0x2d, 0x7f, 0x0e, 0x1a, 0x3b, 0x5c));

inline int64_t QpcNowUs() noexcept {
  static const int64_t freq = [] {
    LARGE_INTEGER f;
    QueryPerformanceFrequency(&f);
    return f.QuadPart;
  }();
  LARGE_INTEGER now;
  QueryPerformanceCounter(&now);
  return (now.QuadPart * 1'000'000) / freq;
}

inline int64_t g_qpcWinMainUs = 0;
inline int64_t g_qpcAppBuiltUs = 0;
inline int64_t g_qpcBeforeStartUs = 0;

inline void RNWAppTracingRegister() noexcept { TraceLoggingRegister(g_hRNWAppProvider); }
inline void RNWAppTracingUnregister() noexcept { TraceLoggingUnregister(g_hRNWAppProvider); }

inline void CaptureWinMainEntry() noexcept { g_qpcWinMainUs = QpcNowUs(); }
inline void CaptureAppBuilt() noexcept { g_qpcAppBuiltUs = QpcNowUs(); }
inline void CaptureBeforeStart() noexcept { g_qpcBeforeStartUs = QpcNowUs(); }

inline void TraceTTFP(double ms) noexcept {
  TraceLoggingWrite(g_hRNWAppProvider, "TTFP",
      TraceLoggingLevel(WINEVENT_LEVEL_INFO), TraceLoggingKeyword(0x1),
      TraceLoggingFloat64(ms, "TtfpMs"));
}

inline void TraceTTI(double ms) noexcept {
  TraceLoggingWrite(g_hRNWAppProvider, "TTI",
      TraceLoggingLevel(WINEVENT_LEVEL_INFO), TraceLoggingKeyword(0x1),
      TraceLoggingFloat64(ms, "TtiMs"));
}
