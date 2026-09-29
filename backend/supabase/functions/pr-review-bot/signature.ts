function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  if (clean.length === 0 || clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) {
    return new Uint8Array();
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function signPayload(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body) as BufferSource),
  );
  return `sha256=${Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function verifySignature(
  body: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (header === null || !header.startsWith("sha256=")) return false;
  const signature = hexToBytes(header.slice("sha256=".length));
  if (signature.length === 0) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return await crypto.subtle.verify(
    "HMAC",
    key,
    signature as BufferSource,
    new TextEncoder().encode(body) as BufferSource,
  );
}
