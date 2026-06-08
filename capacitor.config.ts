import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dh.servis',
  appName: 'Dh_Servis Cmms',
  webDir: 'dist',
  /* server: {
    url: 'https://dh-servis-rapor.web.app',
    cleartext: true
  }, */
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: "#0A0F19"
    }
  }
};

export default config;
