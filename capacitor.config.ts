import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.pulsetag.console',
  appName: 'PulseTag',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config