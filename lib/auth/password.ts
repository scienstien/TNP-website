/**
 * Password hashing with scrypt (memory-hard, built into Node; no native add-on).
 * Stored format: scrypt$N$r$p$<salt base64>$<hash base64>, so parameters can be raised
 * later without breaking existing hashes.
 */
import "server-only";

import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 128 * N * R * 2;

function derive(
  password: string,
  salt: Buffer,
  options: ScryptOptions,
  length = KEY_LENGTH,
) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, length, options, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEMORY,
  });
  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [algorithm, n, r, p, salt, hash] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const cost = Number(n);
  const blockSize = Number(r);
  const key = await derive(
    password,
    Buffer.from(salt, "base64"),
    {
      N: cost,
      r: blockSize,
      p: Number(p),
      maxmem: 128 * cost * blockSize * 2,
    },
    expected.length,
  );
  return key.length === expected.length && timingSafeEqual(key, expected);
}

let dummyHash: Promise<string> | undefined;

/**
 * Spend the same time as a real check when the account does not exist, so response
 * timing does not reveal which emails are registered.
 */
export async function burnPasswordCheck(password: string) {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(password, await dummyHash);
}
