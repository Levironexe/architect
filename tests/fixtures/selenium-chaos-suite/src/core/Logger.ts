export class Logger {
  static info(message: string, payload?: any) {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, payload || "");
  }

  static warn(message: string, payload?: any) {
    console.log(`[WARN] ${new Date().toISOString()} - ${message}`, payload || "");
  }

  static error(message: string, payload?: any) {
    console.log(`[ERROR] ${new Date().toISOString()} - ${message}`, payload || "");
  }
}
