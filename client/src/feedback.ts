const ENDPOINT = "https://formsubmit.co/ajax/485aec7837a70e3d58f61a22516fd02b ";

export async function sendFeedback(input: { name: string; email: string; message: string }): Promise<"sent" | "pending"> {
  const email = input.email.trim();
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      name: input.name.trim() || "JobFit user",
      ...(email ? { email } : {}),
      message: input.message.trim(),
      page: `${window.location.origin}${window.location.pathname}`,
      _subject: "JobFit AI feedback",
      _template: "box",
      _captcha: "false",
    }),
  });
  const data = (await response.json().catch(() => null)) as { success?: string | boolean; message?: string } | null;
  const message = data?.message ?? "";
  if (data?.success === true || data?.success === "true") return "sent";
  if (/activat/i.test(message)) return "pending";
  throw new Error("The message could not be sent.");
}
