export class AppError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

export function publicErrorText(error: unknown): string {
  if (error instanceof AppError) return error.message;
  const text = error instanceof Error ? error.message : "The request failed.";
  const cleaned = text.replace(/\s+/g, " ").trim();
  const lowered = cleaned.toLowerCase();
  if (cleaned.includes("sk-") || lowered.includes("api_key") || lowered.includes("authorization")) {
    return "The request failed.";
  }
  if (lowered.includes("incorrect api key") || lowered.includes("invalid api key")) {
    return "OpenAI rejected the API key.";
  }
  if (lowered.includes("rate limit") || lowered.includes("quota")) {
    return "OpenAI rate limit or quota was reached. Wait and try again.";
  }
  if (lowered.includes("timed out") || lowered.includes("timeout")) {
    return "OpenAI took too long to respond. Try again.";
  }
  if (lowered.includes("connection") || lowered.includes("fetch failed") || lowered.includes("econnrefused")) {
    return "Could not reach OpenAI. Check the connection and try again.";
  }
  return cleaned.slice(0, 300) || "The request failed.";
}
