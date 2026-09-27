export { };

declare global {
    interface Window {
        __kaspSendAction: (className: string, obj: unknown) => void;
        __kaspBattleStats: (obj: unknown) => void;
        __kaspCurrentMode?: string;
        __kaspBattleKind?: string;
        __kaspInjectorVersion?: string;
    }
}