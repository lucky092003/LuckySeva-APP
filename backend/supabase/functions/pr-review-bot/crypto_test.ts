import { assert, assertEquals, assertThrows } from "@std/assert";

import { base64Url, importPrivateKey, pemToPkcs8 } from "./pem.ts";
import { signPayload, verifySignature } from "./signature.ts";

const SECRET = "a-shared-webhook-secret";

Deno.test("a signature produced from the body verifies", async () => {
  const body = JSON.stringify({ action: "opened" });
  const header = await signPayload(body, SECRET);
  assertEquals(await verifySignature(body, header, SECRET), true);
});

Deno.test("a tampered body fails verification", async () => {
  const body = JSON.stringify({ action: "opened" });
  const header = await signPayload(body, SECRET);
  assertEquals(await verifySignature(`${body} `, header, SECRET), false);
});

Deno.test("a different secret fails verification", async () => {
  const body = "{}";
  const header = await signPayload(body, SECRET);
  assertEquals(await verifySignature(body, header, "other"), false);
});

Deno.test("a missing or malformed header is rejected without throwing", async () => {
  const body = "{}";
  for (const bad of [null, "", "sha1=abc", "sha256=", "sha256=zzzz", "sha256=abc"]) {
    assertEquals(await verifySignature(body, bad, SECRET), false, `accepted ${bad}`);
  }
});

Deno.test("hex case does not matter in the digest, but the algorithm prefix does", async () => {
  const body = "{}";
  const header = await signPayload(body, SECRET);
  assertEquals(
    await verifySignature(body, `sha256=${header.slice(7).toUpperCase()}`, SECRET),
    true,
  );
  assertEquals(await verifySignature(body, header.replace("sha256=", "SHA256="), SECRET), false);
  assertEquals(await verifySignature(body, header.replace("sha256=", "sha1="), SECRET), false);
});

Deno.test("signing is deterministic for the same body", async () => {
  assertEquals(await signPayload("{}", SECRET), await signPayload("{}", SECRET));
});

Deno.test("base64Url is url-safe and unpadded", () => {
  const encoded = base64Url(new Uint8Array([251, 255, 190, 0, 1, 2]));
  assert(/^[A-Za-z0-9_-]+$/.test(encoded), encoded);
  assert(!encoded.includes("="));
});

Deno.test("pemToPkcs8 passes a PKCS#8 key through untouched", () => {
  const inner = new Uint8Array([0x30, 0x03, 0x02, 0x01, 0x00]);
  const pem = `-----BEGIN PRIVATE KEY-----\n${
    btoa(Array.from(inner, (b) => String.fromCharCode(b)).join(""))
  }\n-----END PRIVATE KEY-----\n`;
  assertEquals(Array.from(pemToPkcs8(pem)), Array.from(inner));
});

Deno.test("pemToPkcs8 wraps a PKCS#1 key in a PKCS#8 envelope", () => {
  const pkcs1 = new Uint8Array([0x30, 0x0d, 0x02, 0x01, 0x00, 0x02, 0x03, 0x01, 0x02, 0x03]);
  const pem = `-----BEGIN RSA PRIVATE KEY-----\n${
    btoa(Array.from(pkcs1, (b) => String.fromCharCode(b)).join(""))
  }\n-----END RSA PRIVATE KEY-----\n`;
  const out = pemToPkcs8(pem);
  assertEquals(out[0], 0x30);
  assert(Array(out.length > pkcs1.length));
  assert(Array.from(out.slice(-pkcs1.length)).join(",") === Array.from(pkcs1).join(","));
});

Deno.test("pemToPkcs8 rejects a key it cannot parse", () => {
  assertThrows(() => pemToPkcs8("not a key"), Error, "not a PEM private key");
});

Deno.test("importPrivateKey produces a signing key from a real RSA PKCS#8 PEM", async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${
    btoa(Array.from(pkcs8, (b) => String.fromCharCode(b)).join(""))
  }\n-----END PRIVATE KEY-----\n`;

  const key = await importPrivateKey(pem);
  const message = new TextEncoder().encode("payload");
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, message);
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    pair.publicKey,
    signature,
    message,
  );
  assert(verified);
});
