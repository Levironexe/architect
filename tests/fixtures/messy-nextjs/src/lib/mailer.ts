export function sendMail(to: string) {
  const key = process.env.SENDGRID_API_KEY;
  return { to, key: Boolean(key) };
}
