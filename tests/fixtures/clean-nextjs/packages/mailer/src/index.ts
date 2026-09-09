export function mailerKey(): string {
  return process.env.RESEND_API_KEY?.trim() ?? '';
}
