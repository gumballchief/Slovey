import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * "Sign in with Slovey" for MCP clients (claude.ai and Claude Desktop custom
 * connectors, Claude Code, Cursor...). OAuth 2.1 authorization code + PKCE with
 * dynamic client registration, as the MCP authorization spec requires.
 *
 * Stateless by design: client ids and authorization codes are HMAC-signed, so
 * nothing new is stored. The access token handed back is an ordinary repo-scoped
 * Slovey API key (api_tokens), so the user sees it in Settings and can revoke it,
 * and the MCP endpoint checks it exactly like a key made by hand.
 */

export const OAUTH_SCOPE = "mcp";
const CODE_TTL_MS = 5 * 60_000;
const MAX_REDIRECT_URIS = 10;

function signingKey(): Buffer {
  const k = process.env.TOKEN_ENCRYPTION_KEY;
  if (!k) throw new Error("TOKEN_ENCRYPTION_KEY is required for OAuth");
  // A dedicated subkey, so OAuth signatures can never be confused with anything else the key protects.
  return createHmac("sha256", Buffer.from(k, "base64")).update("slovey-oauth-v1").digest();
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

function mac(data: string): string {
  return createHmac("sha256", signingKey()).update(data).digest("base64url");
}

function sign(payload: object): string {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${mac(body)}`;
}

function verify<T>(token: string | null | undefined): T | null {
  if (!token || token.length > 4096) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const want = Buffer.from(mac(body));
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("base64url");

// ── Clients (RFC 7591 dynamic registration) ─────────────────────────────────

export interface OAuthClient {
  redirectUris: string[];
  name: string;
  /** Whether the client authenticates at the token endpoint with a secret. */
  confidential: boolean;
}

type ClientClaims = { t: "client"; r: string[]; n: string; c: boolean };

/**
 * Redirect URIs must be https, or loopback http for desktop and CLI clients
 * (Claude Code and Cursor listen on 127.0.0.1/localhost during sign-in).
 * Fragments are forbidden by the OAuth spec.
 */
export function isAllowedRedirectUri(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (u.protocol === "https:") return true;
  return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]");
}

export class OAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export function registerClient(input: {
  redirect_uris?: unknown;
  client_name?: unknown;
  token_endpoint_auth_method?: unknown;
}): { clientId: string; clientSecret?: string; client: OAuthClient } {
  const uris = input.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > MAX_REDIRECT_URIS) {
    throw new OAuthError("invalid_redirect_uri", "redirect_uris must list 1 to 10 URLs.");
  }
  for (const u of uris) {
    if (typeof u !== "string" || u.length > 500 || !isAllowedRedirectUri(u)) {
      throw new OAuthError("invalid_redirect_uri", "Each redirect URI must be https, or http on localhost.");
    }
  }
  const name =
    typeof input.client_name === "string" && input.client_name.trim()
      ? input.client_name.trim().replace(/[\u0000-\u001f]/g, "").slice(0, 60)
      : "An MCP client";
  const method = input.token_endpoint_auth_method ?? "none";
  if (method !== "none" && method !== "client_secret_post" && method !== "client_secret_basic") {
    throw new OAuthError("invalid_client_metadata", "Unsupported token_endpoint_auth_method.");
  }
  const confidential = method !== "none";
  const clientId = `sloveyc_${sign({ t: "client", r: uris as string[], n: name, c: confidential } satisfies ClientClaims)}`;
  return {
    clientId,
    clientSecret: confidential ? clientSecretFor(clientId) : undefined,
    client: { redirectUris: uris as string[], name, confidential },
  };
}

/** Secrets are derived, not stored: anyone holding the signing key can recompute them. */
function clientSecretFor(clientId: string): string {
  return `sloveys_${mac(`secret:${clientId}`)}`;
}

export function parseClient(clientId: string | null | undefined): OAuthClient | null {
  if (!clientId?.startsWith("sloveyc_")) return null;
  const claims = verify<ClientClaims>(clientId.slice("sloveyc_".length));
  if (!claims || claims.t !== "client" || !Array.isArray(claims.r)) return null;
  return { redirectUris: claims.r, name: claims.n, confidential: Boolean(claims.c) };
}

export function checkClientSecret(clientId: string, presented: string | null | undefined): boolean {
  if (!presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(clientSecretFor(clientId));
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Authorization requests ──────────────────────────────────────────────────

export interface AuthorizeRequest {
  clientId: string;
  client: OAuthClient;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  scope: string;
}

/**
 * Validate an /oauth/authorize request. Errors about the client or redirect URI
 * must be shown to the user, never sent to the (unverified) redirect URI, so they
 * throw. Everything else can be reported back to the client.
 */
export function parseAuthorizeRequest(params: URLSearchParams): AuthorizeRequest {
  const clientId = params.get("client_id") ?? "";
  const client = parseClient(clientId);
  if (!client) throw new OAuthError("invalid_client", "This sign-in link is from an app Slovey doesn't recognise.");
  const redirectUri = params.get("redirect_uri") ?? (client.redirectUris.length === 1 ? client.redirectUris[0]! : "");
  if (!client.redirectUris.includes(redirectUri)) {
    throw new OAuthError("invalid_request", "This sign-in link points somewhere the app never registered.");
  }
  if (params.get("response_type") !== "code") {
    throw new OAuthError("unsupported_response_type", "Only the authorization code flow is supported.");
  }
  const codeChallenge = params.get("code_challenge") ?? "";
  if (params.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge)) {
    throw new OAuthError("invalid_request", "A PKCE code challenge (S256) is required.");
  }
  const state = params.get("state");
  if (state && state.length > 1000) throw new OAuthError("invalid_request", "state is too long.");
  return { clientId, client, redirectUri, state, codeChallenge, scope: OAUTH_SCOPE };
}

export function redirectWith(redirectUri: string, values: Record<string, string | null | undefined>): string {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(values)) if (v != null) u.searchParams.set(k, v);
  return u.toString();
}

// ── Authorization codes ─────────────────────────────────────────────────────

type CodeClaims = {
  t: "code";
  cid: string; // sha256 of the client id
  ru: string;
  cc: string;
  u: string; // user id
  r: string; // repo id
  exp: number;
  jti: string;
};

export function mintCode(req: AuthorizeRequest, userId: string, repoId: string): string {
  return sign({
    t: "code",
    cid: sha256(req.clientId),
    ru: req.redirectUri,
    cc: req.codeChallenge,
    u: userId,
    r: repoId,
    exp: Date.now() + CODE_TTL_MS,
    jti: randomBytes(12).toString("base64url"),
  } satisfies CodeClaims);
}

// Codes are single use. One web instance serves slovey.ai, so memory is enough;
// PKCE already makes a stolen code useless without the client's verifier.
const usedCodes = new Map<string, number>();

function markUsed(jti: string, exp: number): boolean {
  const now = Date.now();
  for (const [k, e] of usedCodes) if (e < now) usedCodes.delete(k);
  if (usedCodes.has(jti)) return false;
  usedCodes.set(jti, exp);
  return true;
}

/** Exchange a code: checks signature, expiry, client, redirect URI, PKCE and single use. */
export function redeemCode(input: {
  code: string;
  clientId: string;
  redirectUri: string | null;
  codeVerifier: string;
}): { userId: string; repoId: string } {
  const claims = verify<CodeClaims>(input.code);
  if (!claims || claims.t !== "code") throw new OAuthError("invalid_grant", "Unknown authorization code.");
  if (claims.exp < Date.now()) throw new OAuthError("invalid_grant", "The authorization code expired. Sign in again.");
  if (claims.cid !== sha256(input.clientId)) throw new OAuthError("invalid_grant", "The code was issued to another client.");
  if (input.redirectUri != null && input.redirectUri !== claims.ru) {
    throw new OAuthError("invalid_grant", "redirect_uri doesn't match the authorization request.");
  }
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(input.codeVerifier) || sha256(input.codeVerifier) !== claims.cc) {
    throw new OAuthError("invalid_grant", "PKCE verification failed.");
  }
  if (!markUsed(claims.jti, claims.exp)) throw new OAuthError("invalid_grant", "This authorization code was already used.");
  return { userId: claims.u, repoId: claims.r };
}

// ── Metadata ────────────────────────────────────────────────────────────────

/** The public origin a request arrived on (Render's proxy sets x-forwarded-*). */
export function publicOrigin(req: Request): string {
  const host = req.headers.get("x-forwarded-host");
  if (host) return `${req.headers.get("x-forwarded-proto") ?? "https"}://${host}`;
  return new URL(req.url).origin;
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    scopes_supported: [OAUTH_SCOPE],
    service_documentation: `${origin}/mcp`,
  };
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/api/mcp`,
    resource_name: "Slovey",
    authorization_servers: [origin],
    scopes_supported: [OAUTH_SCOPE],
    bearer_methods_supported: ["header"],
    resource_documentation: `${origin}/mcp`,
  };
}

/** Public OAuth endpoints are called by browser-based clients too (e.g. the MCP Inspector). */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, mcp-protocol-version",
  "Access-Control-Max-Age": "86400",
};
