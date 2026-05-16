import { input } from '@inquirer/prompts';

export interface InteractiveStreams {
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WriteStream;
}

export function isInteractiveTerminal(streams: InteractiveStreams = {}): boolean {
  const stdin = streams.stdin ?? process.stdin;
  const stdout = streams.stdout ?? process.stdout;

  return stdin.isTTY === true && stdout.isTTY === true;
}

export async function promptForDirectory(message = 'Directory to scan:'): Promise<string> {
  const answer = await input({
    message,
    default: '.',
    required: true
  });

  return answer.trim();
}
