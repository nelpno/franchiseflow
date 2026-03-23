/**
 * Shared WhatsApp utilities for phone formatting and link generation.
 */

/**
 * Normalizes a phone number to 11-digit Brazilian format (DDD + 9XXXX-XXXX).
 * Strips country code 55, non-digit chars, and handles common input variations.
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

export function formatPhone(phone) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
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

export function getWhatsAppLink(phone) {
  if (!phone) return "#";
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${number}`;
}
