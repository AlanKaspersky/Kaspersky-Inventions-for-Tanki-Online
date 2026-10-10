import { Socket } from 'node:net';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface Presence { details: string; state: string; timestamps?: { end: number }; party?: { size: [number, number] }; }
export function validPresence(value: unknown): value is Presence {
    if (!value || typeof value !== 'object') return false;
    const input = value as Presence;
    return typeof input.details === 'string' && input.details.trim().length > 0 && input.details.length <= 128 &&
        typeof input.state === 'string' && input.state.trim().length > 0 && input.state.length <= 128 &&
        !/[\u0000-\u001f]/.test(input.details + input.state) &&
        (input.timestamps === undefined || !!input.timestamps && Number.isSafeInteger(input.timestamps.end) && input.timestamps.end > 0 && input.timestamps.end < 1e11) &&
        (input.party === undefined || !!input.party && Array.isArray(input.party.size) && input.party.size.length === 2 &&
            input.party.size.every(value => Number.isInteger(value) && value >= 0 && value <= 1000) &&
            input.party.size[1] > 0 && input.party.size[0] <= input.party.size[1]);
}
export function copyPresence(value: Presence): Presence {
    return { details: value.details, state: value.state,
        ...(value.timestamps ? { timestamps: { end: value.timestamps.end } } : {}),
        ...(value.party ? { party: { size: [value.party.size[0], value.party.size[1]] } } : {}) };
}
export function discordPipe(index: number): string {
    return process.platform === 'win32' ? `\\\\?\\pipe\\discord-ipc-${index}`
        : join(process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp', `discord-ipc-${index}`);
}
export function rpcFrame(opcode: number, data: unknown): Buffer {
    const payload = Buffer.from(JSON.stringify(data));
    const header = Buffer.alloc(8);
    header.writeUInt32LE(opcode); header.writeUInt32LE(payload.length, 4);
    return Buffer.concat([header, payload]);
}

/** Local Discord IPC only: no account tokens, HTTP server or extra dependencies. */
export class DiscordPresence {
    private socket: Socket | null = null;
    private ready = false;
    private disposed = false;
    private desired: Presence | null = null;
    private sent: string | null = null;
    private lastSent = 0;
    // Reuse one session start across section changes, navigation and RPC reconnects.
    private readonly sessionStartedAt = Math.floor(Date.now() / 1000);
    private reconnect?: NodeJS.Timeout;
    private sendTimer?: NodeJS.Timeout;
    constructor(private applicationId: string, private report: (message: string) => void = console.warn) {}

    update(value: Presence | null): void {
        if (this.disposed || !/^\d{17,20}$/.test(this.applicationId)) return;
        this.desired = value;
        if (value && !this.socket && !this.reconnect) this.connect(0);
        this.flush();
    }
    private connect(index: number): void {
        if (this.disposed || !this.desired) return;
        const socket = new Socket();
        this.socket = socket;
        this.ready = false;
        let input = Buffer.alloc(0);
        const timeout = setTimeout(() => socket.destroy(), 3000);
        socket.on('error', () => socket.destroy());
        socket.on('close', () => {
            clearTimeout(timeout);
            if (this.socket !== socket) return;
            const wasReady = this.ready;
            this.socket = null; this.ready = false; this.sent = null;
            if (this.disposed || !this.desired) return;
            if (!wasReady && index < 9) this.connect(index + 1);
            else this.reconnect = setTimeout(() => { this.reconnect = undefined; this.connect(0); }, 15000);
        });
        socket.on('connect', () => socket.write(rpcFrame(0, { v: 1, client_id: this.applicationId })));
        socket.on('data', chunk => {
            if (this.socket !== socket) return;
            input = Buffer.concat([input, chunk]);
            while (input.length >= 8) {
                const opcode = input.readUInt32LE(), length = input.readUInt32LE(4);
                if (length > 1024 * 1024) { socket.destroy(); return; }
                if (input.length < length + 8) return;
                const payload = input.subarray(8, 8 + length);
                input = input.subarray(8 + length);
                if (opcode === 2) { socket.destroy(); return; }
                if (opcode === 3) {
                    const header = Buffer.alloc(8); header.writeUInt32LE(4); header.writeUInt32LE(payload.length, 4);
                    socket.write(Buffer.concat([header, payload])); continue;
                }
                if (opcode !== 1) continue;
                try {
                    const message = JSON.parse(payload.toString());
                    if (message.evt === 'READY') {
                        clearTimeout(timeout); this.ready = true; this.lastSent = 0; this.flush();
                    } else if (message.evt === 'ERROR') {
                        this.report(`[KI Discord] ${message.data?.message || 'RPC error'}`);
                        // Retry a rejected activity only after the normal throttle interval.
                        this.sent = null;
                    }
                } catch { socket.destroy(); return; }
            }
        });
        socket.connect(discordPipe(index));
    }
    private flush(): void {
        if (!this.ready || !this.socket || this.disposed) return;
        const key = JSON.stringify(this.desired);
        if (this.sent === key) return;
        const wait = this.desired === null ? 0 : Math.max(0, 15000 - (Date.now() - this.lastSent));
        if (wait) {
            if (!this.sendTimer) this.sendTimer = setTimeout(() => { this.sendTimer = undefined; this.flush(); }, wait);
            return;
        }
        clearTimeout(this.sendTimer); this.sendTimer = undefined;
        const activity = this.desired ? { type: 0, details: this.desired.details, state: this.desired.state,
            timestamps: this.desired.timestamps ?? { start: this.sessionStartedAt },
            ...(this.desired.party ? { party: this.desired.party } : {}), instance: false } : null;
        this.socket.write(rpcFrame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity }, nonce: randomUUID() }));
        this.sent = key; this.lastSent = Date.now();
    }
    dispose(): void {
        this.update(null);
        this.disposed = true;
        clearTimeout(this.reconnect); clearTimeout(this.sendTimer);
        const socket = this.socket;
        this.socket = null;
        if (socket) {
            socket.end();
            setTimeout(() => socket.destroy(), 500).unref();
        }
    }
}
