function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function formatUuidFromBytes(bytes: Uint8Array) {
  const clone = new Uint8Array(bytes);
  clone[6] = (clone[6] & 0x0f) | 0x40;
  clone[8] = (clone[8] & 0x3f) | 0x80;
  const hex = toHex(clone);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function mathRandomUuid() {
  const bytes = new Uint8Array(16);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
  return formatUuidFromBytes(bytes);
}

export function createUuid() {
  const runtimeCrypto = globalThis.crypto as
    | {
        randomUUID?: () => string;
        getRandomValues?: (array: Uint8Array) => Uint8Array;
      }
    | undefined;

  if (runtimeCrypto?.randomUUID) {
    return runtimeCrypto.randomUUID();
  }

  if (runtimeCrypto?.getRandomValues) {
    return formatUuidFromBytes(runtimeCrypto.getRandomValues(new Uint8Array(16)));
  }

  return mathRandomUuid();
}
