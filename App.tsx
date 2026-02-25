/**
 * RNW Fabric TTFP / TTI Benchmark
 * Measures Time To First Paint and Time To Interactive from JS only.
 *
 * @format
 */

import React from 'react';
import {NewAppScreen} from '@react-native/new-app-screen';
import {StatusBar, StyleSheet, useColorScheme, View} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

// T0 was captured in index.js before any imports
const T0: number = (global as any).__PERF_T0 ?? Date.now();

/**
 * Measures TTFP and TTI exactly once on first mount.
 *
 * useEffect  → fires after React commits to Fabric shadow tree
 * rAF        → fires on next compositor tick (frame queued for DWM) ≈ TTFP
 * setTimeout → fires when JS event loop is idle (handlers live)   ≈ TTI
 */
function useTTFPandTTI() {
  const measured = React.useRef(false);

  React.useEffect(() => {
    if (measured.current) return;
    measured.current = true;

    requestAnimationFrame(() => {
      const ttfp = Date.now() - T0;
      console.log(`[PERF] TTFP: ${ttfp}ms`);

      setTimeout(() => {
        const tti = Date.now() - T0;
        console.log(`[PERF] TTI:  ${tti}ms`);
      }, 0);
    });
  }, []);
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  useTTFPandTTI();

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
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
});

export default App;
