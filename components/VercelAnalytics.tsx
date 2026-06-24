import { Platform } from 'react-native';

// Minimal typing so the project compiles even before @vercel/analytics is
// installed locally; Vercel installs it during the web build.
declare const require: (module: string) => { Analytics: () => JSX.Element };

// Vercel Web Analytics. Active only in the web build and a no-op on native.
// The package is loaded lazily (and wrapped in try/catch) so it is pulled into
// the web bundle only, and the app still runs on native / without the dep.
export default function VercelAnalytics() {
  if (Platform.OS !== 'web') return null;
  try {
    const { Analytics } = require('@vercel/analytics/react');
    return <Analytics />;
  } catch {
    return null;
  }
}
