const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function clean(value: string): string {
  return value.replace(/[),.;:]+$/g, "").toLowerCase();
}

export function jobRecipient(description: string, ownEmail = ""): string {
  const own = ownEmail.trim().toLowerCase();
  const found = (description.match(EMAIL) ?? []).map(clean).filter((address) => {
    if (!address || address === own) return false;
    if (address.endsWith("@example.com") || address.endsWith("@example.org")) return false;
    if (address.startsWith("noreply@") || address.startsWith("no-reply@")) return false;
    return true;
  });
  const preferred = found.find((address) => /^(careers|jobs|job|hr|talent|recruit|recruiting|hiring|apply|recruitment)@/.test(address));
  return preferred ?? found[0] ?? "";
}
