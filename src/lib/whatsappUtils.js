/**
 * Shared WhatsApp utilities for phone formatting and link generation.
 */

/**
 * Normalizes a phone number to 11-digit Brazilian format (DDD + 9XXXX-XXXX).
 * Strips country code 55, non-digit chars, and handles common input variations.
 * Foreign numbers typed with "+" keep their country code (e.g. "+1 321..." -> "1321...").
 * Returns null if input is empty/invalid.
 */
export function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  let local = digits;
  if (local.startsWith("55") && local.length >= 12) {
    local = local.slice(2);
  }
  if (local.length === 10 || local.length === 11) {
    return local;
  }
  // Return cleaned digits if non-standard length
  return local || null;
}

/**
 * True when the stored digits are a foreign number (country code included).
 * The bot stores the WhatsApp number as-is, and only strips 55 — so a US client
 * is "13214384841". A Brazilian mobile always has 9 right after the DDD; with
 * 11 digits and no 9 there (or 12+ digits), it is not Brazilian. No country code
 * starts with 0: "0..." is a Brazilian number typed with the carrier zero.
 */
export function isInternationalPhone(phone) {
  if (!phone) return false;
  const digits = String(phone).replace(/\D/g, "");
  if (!digits || digits.startsWith("0")) return false;
  if (digits.startsWith("55") && digits.length >= 12) return false;
  return digits.length >= 12 || (digits.length === 11 && digits[2] !== "9");
}

export function formatPhone(phone) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (isInternationalPhone(digits)) return `+${digits}`;
  // Handle Brazilian numbers: 55 + DD + 9XXXX-XXXX
  let local = digits;
  if (local.startsWith("55") && local.length >= 12) {
    local = local.slice(2);
  }
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return phone;
}

export function getWhatsAppLink(phone, text) {
  if (!phone) return "#";
  const digits = phone.replace(/\D/g, "");
  const suffix = text ? `?text=${encodeURIComponent(text)}` : "";
  if (isInternationalPhone(digits)) return `https://wa.me/${digits}${suffix}`;
  // DDD 55 (RS) is a valid local number: only 12+ digits already carry the 55
  const number = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  return `https://wa.me/${number}${suffix}`;
}
