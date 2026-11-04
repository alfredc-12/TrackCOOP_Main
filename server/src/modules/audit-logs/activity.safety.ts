/** Fail closed on credential-bearing free text, including URLs whose path carries a secret. */
export function safeText(value: unknown, max = 1800) {
  if (typeof value !== "string") return "";
  if (
    /(?:password|secret|token|session|api[_ -]?key|authorization)/i.test(
      value,
    ) &&
    /[{}\\]/.test(value)
  )
    return "[sensitive detail omitted]";
  return value
    .slice(0, 10000)
    .replace(/https?:\/\/[^\s<>"']+/gi, "[link omitted]")
    .replace(
      /\b(?:sk_(?:test|live)_|whsec_|whsk_|re_|gh[opsu]_)[A-Za-z0-9_\-]{12,}/g,
      "[secret omitted]",
    )
    .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, "[secret omitted]")
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?/g,
      "[token omitted]",
    )
    .replace(/\bBearer\s+\S+/gi, "[token omitted]")
    .replace(
      /\b(password|password_hash|api[_ -]?key|secret|token|session[_ -]?(?:id|token)|authorization)["']?\s*[=:]\s*["']?[^\s,"'}]+/gi,
      "[sensitive value omitted]",
    )
    .replace(/\b[A-Za-z0-9+/_=-]{40,}\b/g, "[sensitive value omitted]")
    .slice(0, max);
}
