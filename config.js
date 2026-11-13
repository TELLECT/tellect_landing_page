// Runtime configuration for the Tellect Campus waitlist landing page.
//
// This file is loaded as a plain <script> before the page logic, so you can
// point the page at a different API host WITHOUT a build step — just edit
// apiBaseUrl here and redeploy the static site.
//
// For local development set apiBaseUrl to '' (empty) to use the same origin,
// or leave it as 'http://localhost:3000' when running the backend locally.

window.TELLECT_CONFIG = {
  // Base URL of the waitlist API. No trailing slash.
  apiBaseUrl: 'https://tellect-landing-page-backend.onrender.com',

  // Leave empty to use the page's own origin (same-origin deployments).
  // Example: 'https://tellect-landing-page-backend.onrender.com'
  // or: 'http://localhost:3000'
}
