import { Redirect } from 'expo-router';

/**
 * OAuth return target. On iOS the in-app auth session consumes the redirect before
 * it reaches the router, but on Android the deep link is also delivered to expo-router —
 * land it on home instead of the default unmatched-route screen. The actual code
 * exchange happens inside signInWithGoogle, not here.
 */
export default function AuthCallbackScreen() {
  return <Redirect href="/" />;
}
