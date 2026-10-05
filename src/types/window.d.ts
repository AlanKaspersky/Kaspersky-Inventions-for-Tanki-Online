export { };

declare global {
    interface Window {
        __kaspBonusPickup: <T>(data: T) => T;
        __kaspBonusPrepare: (data: unknown, field: string) => unknown;
        __kaspBonusRegister: (data: unknown, instanceId?: unknown, x?: unknown, y?: unknown, z?: unknown) => void;
        __kaspBonusContext: (first: unknown, second: unknown) => void;
        __kaspBonusDebug: {
            enable: (value?: boolean) => void;
            clear: () => void;
            export: () => string;
        };
        __kaspSendAction: (className: string, obj: unknown) => void;
        __kaspBattleStats: (obj: unknown) => void;
        __kaspCurrentMode?: string;
        __kaspBattleKind?: string;
        __kaspInjectorVersion?: string;
    }
}
