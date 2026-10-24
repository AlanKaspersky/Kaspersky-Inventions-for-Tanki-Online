declare module 'electron' {
    export const ipcRenderer: {
        send(channel: string, ...args: unknown[]): void;
    };
}
