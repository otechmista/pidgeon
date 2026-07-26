import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { URL } from "node:url";
import type { Provider } from "@pidgeon/shared";

export type OAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  tokenType: string;
};

export type OidcProfile = {
  email: string;
  name?: string;
  sub: string;
};

function b64url(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function pkce() {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export const SCOPES: Record<Provider, string> = {
  google: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
  ].join(" "),
  microsoft: ["openid", "email", "profile", "offline_access", "Mail.Read", "Mail.Send"].join(" "),
};

export function authUrl(
  provider: Provider,
  clientId: string,
  redirectUri: string,
  challenge: string
): string {
  if (provider === "google") {
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.searchParams.set("client_id", clientId);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", SCOPES.google);
    u.searchParams.set("code_challenge", challenge);
    u.searchParams.set("code_challenge_method", "S256");
    u.searchParams.set("access_type", "offline");
    u.searchParams.set("prompt", "consent");
    return u.toString();
  }
  const u = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", SCOPES.microsoft);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("response_mode", "query");
  return u.toString();
}

export async function exchangeCode(
  provider: Provider,
  clientId: string,
  redirectUri: string,
  code: string,
  verifier: string
): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: verifier,
  });
  const tokenUrl =
    provider === "google"
      ? "https://oauth2.googleapis.com/token"
      : "https://login.microsoftonline.com/common/oauth2/v2.0/token";
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${text}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
    token_type: string;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? "",
    expiresAt: Date.now() + json.expires_in * 1000,
    scope: json.scope ?? SCOPES[provider],
    tokenType: json.token_type,
  };
}

export async function refreshTokens(
  provider: Provider,
  clientId: string,
  refreshToken: string
): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const tokenUrl =
    provider === "google"
      ? "https://oauth2.googleapis.com/token"
      : "https://login.microsoftonline.com/common/oauth2/v2.0/token";
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error("provider_auth_required");
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
    token_type: string;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000,
    scope: json.scope ?? SCOPES[provider],
    tokenType: json.token_type,
  };
}

export async function fetchOidcProfile(
  provider: Provider,
  accessToken: string
): Promise<OidcProfile> {
  if (provider === "google") {
    const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error("Failed to load Google profile");
    const json = (await res.json()) as { email: string; name?: string; sub: string };
    return { email: json.email, name: json.name, sub: json.sub };
  }
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to load Microsoft profile");
  const json = (await res.json()) as {
    mail?: string;
    userPrincipalName?: string;
    displayName?: string;
    id: string;
  };
  return {
    email: json.mail || json.userPrincipalName || "",
    name: json.displayName,
    sub: json.id,
  };
}

export async function runOidcLogin(opts: {
  provider: Provider;
  clientId: string;
  openUrl: (url: string) => Promise<void>;
}): Promise<{ tokens: OAuthTokens; profile: OidcProfile }> {
  const { verifier, challenge } = pkce();

  const { code, redirectUri } = await new Promise<{ code: string; redirectUri: string }>(
    (resolve, reject) => {
      const server = createServer((req, res) => {
        const addr = server.address();
        const port = addr && typeof addr !== "string" ? addr.port : 0;
        const redirect = `http://127.0.0.1:${port}/callback`;
        try {
          const u = new URL(req.url || "/", redirect);
          if (u.searchParams.get("error")) {
            res.end("Authorization denied. You can close this window.");
            server.close();
            reject(new Error("oidc_cancelled"));
            return;
          }
          const codeParam = u.searchParams.get("code");
          if (!codeParam) {
            res.statusCode = 400;
            res.end("Missing code");
            return;
          }
          res.end("Pidgeon connected. You can close this window.");
          server.close();
          resolve({ code: codeParam, redirectUri: redirect });
        } catch (e) {
          server.close();
          reject(e);
        }
      });

      server.once("error", reject);
      server.listen(0, "127.0.0.1", async () => {
        const addr = server.address();
        if (!addr || typeof addr === "string") {
          reject(new Error("Failed to bind loopback"));
          return;
        }
        const redirectUriLocal = `http://127.0.0.1:${addr.port}/callback`;
        try {
          await opts.openUrl(authUrl(opts.provider, opts.clientId, redirectUriLocal, challenge));
        } catch (e) {
          server.close();
          reject(e);
        }
      });
    }
  );

  const tokens = await exchangeCode(opts.provider, opts.clientId, redirectUri, code, verifier);
  const profile = await fetchOidcProfile(opts.provider, tokens.accessToken);
  return { tokens, profile };
}
