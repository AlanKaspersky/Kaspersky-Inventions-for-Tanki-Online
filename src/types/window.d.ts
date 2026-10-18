export { };

declare global {
    interface Window {
        __kaspOverdriveDirection?: { wanted(): boolean; capture(position: unknown, rotation: unknown): void };
        __kaspOverdriveDirectionDebug?: { status(): unknown };
        __kaspArcadeControl?: ReturnType<typeof import('../core/nativeFeature').createNativeFeature>;
        __kaspArcadeReloadDebug: {
            setEnabled(value: boolean): void;
            status(): import('../core/arcadeReload').ArcadeReloadHookStatus & { error: string | null; updates: number;
                sample: import('../core/arcadeReload').ArcadeReloadSample | null };
            observe(sample: import('../core/arcadeReload').ArcadeReloadSample): void;
            reportError(message: string): void;
        };
        __kaspAugmentConfigure: (schema: import('../core/gameAugments').AugmentSchema) => void;
        __kaspAugmentData: (object: unknown, data: unknown) => void;
        __kaspAugmentLink: (id: unknown, baseItemId: unknown) => void;
        __kaspAugmentsDebug: { device(id: string): import('../core/criticalDevices').CriticalDevice | null; reportHook(status: import('../core/gameAugments').AugmentHookStatus): void; export(): string; page(): unknown; exportPage(): string; status(): { hooked: boolean; devices: number; equipment: number; revision: number; mapping?: import('../core/gameAugments').AugmentHookStatus } };
        __kaspCriticalBridge: import('../core/criticalIndicator').CriticalBridge;
        __kaspCriticalDebug: { status(): import('../core/criticalIndicator').CriticalSample & { mapping: import('../core/criticalIndicator').CriticalHookStatus | null }; reportHook(status: import('../core/criticalIndicator').CriticalHookStatus): void };
        __kaspBonusPickup: <T>(data: T) => T;
        __kaspBonusPrepare: (data: unknown, field: string, instance?: unknown) => unknown;
        __kaspBonusRegister: (data: unknown, instanceId?: unknown, x?: unknown, y?: unknown, z?: unknown, instance?: unknown) => void;
        __kaspBonusContext: (first: unknown, second: unknown) => void;
        __kaspBonusType: (prototype: unknown, kind: unknown, fields: unknown) => boolean;
        __kaspBonusDebug: {
            enable: (value?: boolean) => void;
            clear: () => void;
            export: () => string;
            status: () => import('../core/bonusPickup').BonusDiagnosticRecord;
        };
        __kaspSendAction: (className: string, obj: unknown, schema: import('../core/userActions').UserActionSchema) => void;
        __kaspBattleStats: (obj: unknown, schema: import('../core/battleStatistics').BattleStatisticsSchema) => void;
        __kaspCurrentMode?: string;
        __kaspBattleKind?: string;
        __kaspInjectorVersion?: string;
    }
}
