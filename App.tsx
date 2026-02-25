/**
 * RNW Fabric TTFP / TTI Benchmark
 * Measures Time To First Paint and Time To Interactive from JS only.
 *
 * @format
 */

import React from 'react';
import {NewAppScreen} from '@react-native/new-app-screen';
import {StatusBar, StyleSheet, Text, useColorScheme, View} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

// T0 was captured in index.js before any imports
const T0: number = (global as any).__PERF_T0 ?? Date.now();

/**
 * Measures TTFP and TTI exactly once on first mount.
 * Returns the values so they can be displayed on screen.
 *
 * useEffect  → fires after React commits to Fabric shadow tree
 * rAF        → fires on next compositor tick (frame queued for DWM) ≈ TTFP
 * setTimeout → fires when JS event loop is idle (handlers live)   ≈ TTI
 */
function useTTFPandTTI() {
  const [ttfp, setTtfp] = React.useState<number | null>(null);
  const [tti, setTti] = React.useState<number | null>(null);
  const measured = React.useRef(false);

  React.useEffect(() => {
    if (measured.current) return;
    measured.current = true;

    requestAnimationFrame(() => {
      const ttfpMs = Date.now() - T0;
      setTtfp(ttfpMs);
      console.log(`[PERF] TTFP: ${ttfpMs}ms`);

      setTimeout(() => {
        const ttiMs = Date.now() - T0;
        setTti(ttiMs);
        console.log(`[PERF] TTI:  ${ttiMs}ms`);
      }, 0);
    });
  }, []);

  return {ttfp, tti};
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const {ttfp, tti} = useTTFPandTTI();

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <PerfBanner ttfp={ttfp} tti={tti} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function PerfBanner({ttfp, tti}: {ttfp: number | null; tti: number | null}) {
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerTitle}>⏱ Startup Performance</Text>
      <Text style={styles.bannerText}>
        TTFP: {ttfp !== null ? `${ttfp} ms` : 'measuring...'}
      </Text>
      <Text style={styles.bannerText}>
        TTI:  {tti !== null ? `${tti} ms` : 'measuring...'}
      </Text>
    </View>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <NewAppScreen
        templateFileName="App.tsx"
        safeAreaInsets={safeAreaInsets}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  banner: {
    backgroundColor: '#1a1a2e',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  bannerTitle: {
    color: '#e94560',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  bannerText: {
    color: '#eee',
    fontSize: 14,
    fontFamily: 'Consolas',
  },
});

export default App;
