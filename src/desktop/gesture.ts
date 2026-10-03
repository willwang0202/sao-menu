import { execFile, spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { promisify } from 'node:util';
import type { GestureStatus, Position } from '../shared/contracts';

const execute = promisify(execFile);

/** A fixed-purpose helper protocol. No renderer input reaches its arguments. */
export class GestureController {
  private process: ReturnType<typeof spawn> | null = null;
  private refreshOperation: Promise<GestureStatus> | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  private status: GestureStatus = {
    supported: process.platform === 'darwin', permission: 'unknown', running: false,
    message: process.platform === 'darwin'
      ? 'Hold both mouse buttons and slide down. Enable Input Monitoring to summon from other applications.'
      : 'Global mouse gesture is available on macOS. Use the configured shortcut or tray on this operating system.',
  };

  constructor(
    private readonly helper: string,
    private readonly summon: (point: Position) => void,
    private readonly dismiss: () => void,
    private readonly pointerDown: (point: Position) => void,
  ) {}

  start(): void {
    if (!this.status.supported || this.poll) return;
    void this.getStatus();
    this.poll = setInterval(() => { void this.getStatus(); }, 5000);
    this.poll.unref();
  }

  stop(): void {
    this.stopped = true;
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
    this.process?.kill();
    this.process = null;
    this.status.running = false;
  }

  async getStatus(): Promise<GestureStatus> {
    if (!this.status.supported || this.stopped) return { ...this.status };
    if (!this.refreshOperation) {
      this.refreshOperation = this.inspect(false).finally(() => { this.refreshOperation = null; });
    }
    return this.refreshOperation;
  }

  async requestPermission(): Promise<GestureStatus> {
    if (!this.status.supported || this.stopped) return { ...this.status };
    if (this.refreshOperation) await this.refreshOperation;
    this.refreshOperation = this.inspect(true).finally(() => { this.refreshOperation = null; });
    return this.refreshOperation;
  }

  private async inspect(requestPermission: boolean): Promise<GestureStatus> {
    try {
      await access(this.helper, constants.X_OK);
      const { stdout } = await execute(this.helper, [requestPermission ? '--request' : '--status'], { timeout: 10_000, maxBuffer: 16_384 });
      if (this.stopped) return { ...this.status };
      const response: unknown = JSON.parse(stdout.trim());
      if (!response || typeof response !== 'object' || !('granted' in response) || typeof response.granted !== 'boolean') throw new Error('Invalid mouse helper status.');
      this.status.permission = response.granted ? 'granted' : 'denied';
      if (!response.granted) {
        this.process?.kill();
        this.process = null;
        this.status.running = false;
        this.status.message = 'In System Settings → Privacy & Security → Input Monitoring, enable SAO Utils 2 (or its gesture helper). Restart the app if macOS requests it. The shortcut works without this permission.';
      } else if (!this.process) {
        await this.listen();
      }
    } catch (error) {
      this.status.running = false;
      this.status.message = `Global mouse gesture is unavailable: ${(error as Error).message}`;
    }
    return { ...this.status };
  }

  private listen(): Promise<void> {
    return new Promise(resolve => {
      const listener = spawn(this.helper, ['--listen'], { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
      this.process = listener;
      let pending = '';
      let stderr = '';
      let ready = false;
      const finish = () => {
        if (ready) return;
        ready = true;
        clearTimeout(timeout);
        resolve();
      };
      const timeout = setTimeout(() => {
        this.status.running = false;
        this.status.message = 'The global mouse listener did not start. Check Input Monitoring and restart SAO Utils 2.';
        listener.kill();
        finish();
      }, 3000);
      listener.stdout?.setEncoding('utf8');
      listener.stdout?.on('data', data => {
        if (this.process !== listener) return;
        pending += String(data);
        if (pending.length > 65_536) { listener.kill(); finish(); return; }
        let lineEnd: number;
        while ((lineEnd = pending.indexOf('\n')) !== -1) {
          const line = pending.slice(0, lineEnd);
          pending = pending.slice(lineEnd + 1);
          try {
            const event: unknown = JSON.parse(line);
            if (!event || typeof event !== 'object' || !('kind' in event)) continue;
            if (event.kind === 'status' && 'running' in event && typeof event.running === 'boolean') {
              this.status.running = event.running;
              this.status.message = event.running
                ? 'Hold the left and right mouse buttons together, then slide down to summon the launcher anywhere.'
                : 'The mouse listener could not start. Check Input Monitoring and restart SAO Utils 2.';
              finish();
            } else if (event.kind === 'dismiss' && !this.stopped) {
              this.dismiss();
            } else if (['summon', 'pointer-down'].includes(String(event.kind)) && 'x' in event && 'y' in event && typeof event.x === 'number' && typeof event.y === 'number' && Number.isFinite(event.x) && Number.isFinite(event.y)) {
              if (!this.stopped) (event.kind === 'summon' ? this.summon : this.pointerDown)({ x: event.x, y: event.y });
            }
          } catch { /* Only complete validated protocol messages are acted upon. */ }
        }
      });
      listener.stderr?.setEncoding('utf8');
      listener.stderr?.on('data', data => { if (stderr.length < 8192) stderr += String(data); });
      listener.on('error', error => {
        this.status.running = false;
        this.status.message = `The global mouse listener could not start: ${error.message}`;
        if (this.process === listener) this.process = null;
        finish();
      });
      listener.on('close', code => {
        if (this.process === listener) {
          this.process = null;
          this.status.running = false;
          if (code !== 0 && !this.stopped) this.status.message = `The global mouse listener stopped: ${stderr.trim() || `exit ${code}`}`;
        }
        finish();
      });
    });
  }
}
