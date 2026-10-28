/*
 * Security headers for the hosted lite edition (docs/LITE-IMPLEMENTATION.md §7.1), applied to
 * every response by next.config.ts in production lite builds.
 *
 * The API keys live in the page, so connect-src is the part that matters: even injected script
 * could only send data to RolePort itself, the AI providers, and the user's own computer (Ollama,
 * JobSpy). Scripts allow 'unsafe-inline' because Next.js inlines the page data in every static
 * page; nonces would force every page to render per request, and SRI covers script files only.
 */

/** Where the browser may send requests: this site, the AI providers, and this computer. */
const CONNECT = [
  "'self'",
  "https://api.anthropic.com",
  "https://api.openai.com",
  "https://openrouter.ai",
  "https://api.groq.com",
  // Whisper model files, fetched only when the user chooses to download one. Hugging Face
  // redirects file downloads to its storage hosts under hf.co.
  "https://huggingface.co",
  "https://*.huggingface.co",
  "https://*.hf.co",
  // Ollama, LM Studio and JobSpy on the user's own machine, on any port. (CSP has no syntax
  // for IPv6 addresses, so [::1] can't be listed; localhost covers it.)
  "http://localhost:*",
  "http://127.0.0.1:*",
];

const CSP = [
  "default-src 'self'",
  // 'wasm-unsafe-eval' lets PGlite compile its WebAssembly; it doesn't allow eval() of strings.
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  // Company logos come from the job boards.
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  `connect-src ${CONNECT.join(" ")}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const LITE_SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // The microphone is for answering mock interviews out loud, on this site only.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=()" },
];
