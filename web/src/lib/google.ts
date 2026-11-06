/**
 * Google OAuth 2.0 authorization-code flow, không cần thư viện.
 * Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.
 * Redirect URI phải khai báo đúng: <origin>/api/auth/google/callback
 */
const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";

export const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function authorizeUrl(origin: string, state: string) {
  const u = new URL(AUTH);
  u.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  u.searchParams.set("redirect_uri", `${origin}/api/auth/google/callback`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", state);
  u.searchParams.set("prompt", "select_account");
  return u.toString();
}

export type GoogleProfile = { sub: string; email: string; emailVerified: boolean; name?: string };

export async function exchangeCode(origin: string, code: string): Promise<GoogleProfile | null> {
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: `${origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    console.error("google token lỗi", res.status, (await res.text()).slice(0, 200));
    return null;
  }

  const { id_token: idToken } = (await res.json()) as { id_token?: string };
  if (!idToken) return null;

  // id_token đến trực tiếp từ Google qua TLS nên chỉ cần đọc payload
  // (verify chữ ký là bắt buộc khi token đi qua kênh khác)
  const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  if (!payload.sub || !payload.email) return null;

  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: Boolean(payload.email_verified),
    name: payload.name,
  };
}
