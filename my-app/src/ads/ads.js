import { adSettings } from './adsSetup.js';

// The build's ad settings, read once from the Vite environment.
export const ads = adSettings(import.meta.env);

// Opens Google's consent message again so visitors can change their choices.
// Google's consent tool (set up in AdSense > Privacy & messaging) loads with
// the AdSense script; the queue waits for it if it has not loaded yet.
export function openPrivacyChoices() {
  const googlefc = window.googlefc = window.googlefc || {};
  googlefc.callbackQueue = googlefc.callbackQueue || [];
  googlefc.callbackQueue.push(() => googlefc.showRevocationMessage?.());
}
