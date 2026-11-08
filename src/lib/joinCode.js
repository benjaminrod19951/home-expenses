// Share codes for joining a workspace. 10 characters from an alphabet without look-alikes (0/O, 1/I/L):
// 31^10 ≈ 8×10^14 combinations (the old 6-character codes still work).
export const JOIN_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function generateJoinCode(length = 10, random = n => crypto.getRandomValues(new Uint8Array(n))) {
    const bytes = random(length * 2);
    let out = "";
    for (let i = 0; i < bytes.length && out.length < length; i++) {
        if (bytes[i] < 248) // 248 = 8×31, avoids modulo bias
            out += JOIN_ALPHABET[bytes[i] % JOIN_ALPHABET.length];
    }
    return out.length === length ? out : generateJoinCode(length, random);
}
export const normalizeJoinCode = code => String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
