// Public client-side config. These are NOT secrets — they are safe to commit,
// but you should restrict them in the Google Cloud Console:
//   - OAuth client: lock "Authorized JavaScript origins" to your dev/prod URLs.
//   - API key: restrict to HTTP referrers + the Picker API only.
//
// Fill these in after the Google Cloud setup (see README.md).

export const CLIENT_ID = ""; // e.g. "1234567890-abc123.apps.googleusercontent.com"
export const API_KEY = ""; // e.g. "AIzaSy..."

// Optional but recommended for the drive.file scope: your Cloud project NUMBER
// (not the project ID). Found on the Cloud Console dashboard. Leave "" if unsure.
export const APP_ID = "";
