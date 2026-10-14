import { gameDOM } from './gameDOM';

export const CYBERSPORT_ACTIVE = 'data-kasp-esports-active';
export const CYBERSPORT_SYNC = 'kasp:cybersport:sync';
type Props = Record<string, unknown>;
export interface CreationModel {
    props: Props & { launchFun: (...args: unknown[]) => unknown };
    state: Props;
    setState?: (state: Props) => void;
}
interface Fiber { stateNode?: unknown; return?: Fiber; }
export interface CybersportNativeStatus {
    active: boolean;
    guarded: boolean;
    ready: boolean;
    players: unknown;
    minutes: unknown;
    minRank: unknown;
    private: boolean;
    error: string | null;
    lastSubmission: { players: number; minutes: number; minRank: number; private: boolean } | null;
}

function components(element: Element | null): Array<{ props: Props; state?: Props; setState?: CreationModel['setState'] }> {
    if (!element) return [];
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$') || name.startsWith('__reactInternalInstance$'));
    let fiber = key ? (element as Element & Record<string, unknown>)[key] as Fiber : undefined;
    const result: Array<{ props: Props; state?: Props; setState?: CreationModel['setState'] }> = [];
    const seen = new Set<unknown>();
    for (let depth = 0; fiber && depth < 40; depth++, fiber = fiber.return) {
        const value = fiber.stateNode;
        if (!value || typeof value !== 'object' || value instanceof Node || seen.has(value)) continue;
        seen.add(value);
        const component = value as { props?: Props; state?: Props; setState?: CreationModel['setState'] };
        if (component.props && typeof component.props === 'object') result.push(component as typeof result[number]);
    }
    return result;
}
function creationModel(panel: Element): CreationModel | null {
    return components(panel).find(component => typeof component.props.launchFun === 'function' &&
        component.state && typeof component.state.maxPlayers === 'string' &&
        typeof component.state.timeLimit === 'string' && Number.isInteger(component.state.selectedMinUserRank)) as CreationModel || null;
}
export function nativePrivate(model: CreationModel): boolean {
    try { return /\bPrivate\b/.test(String(model.state.selectedOptions)); }
    catch { return false; }
}

export function guardCybersportSubmission(model: CreationModel, active: () => boolean, minimum: () => number | null,
    report: (submission: CybersportNativeStatus['lastSubmission'], error: string | null) => void):
    { handler: CreationModel['props']['launchFun']; restore(): void } {
    const props = model.props;
    const original = props.launchFun;
    const wrapped = function (this: unknown, ...args: unknown[]) {
        if (!active()) return Reflect.apply(original, this, args);
        const rank = minimum();
        const signature = args.length === 7 && typeof args[0] === 'string' &&
            args.slice(1, 6).every(value => typeof value === 'number' && Number.isFinite(value));
        const capacity = model.state.maxPlayersStatic;
        if (!signature || !Number.isInteger(rank) || rank === null || rank < 1 || rank > 100 ||
            !nativePrivate(model) || (typeof capacity === 'number' && capacity < 6)) {
            report(null, signature ? 'native-preset-not-ready' : 'native-launch-signature-mismatch');
            model.setState?.({ creationStarted: false });
            return;
        }
        const submitted = [...args];
        submitted[1] = 6;
        submitted[2] = 12;
        submitted[5] = rank;
        submitted[6] = model.state.selectedOptions;
        report({ players: 6, minutes: 12, minRank: rank, private: true }, null);
        return Reflect.apply(original, this, submitted);
    };
    props.launchFun = wrapped;
    if (props.launchFun !== wrapped) throw new Error('native-launch-handler-unwritable');
    return { handler: wrapped, restore() { if (props.launchFun === wrapped) props.launchFun = original; } };
}

export function installCybersportNative(page: Window): void {
    const debugPage = page as Window & { __kaspCybersportDebug?: { status(): CybersportNativeStatus } };
    if (debugPage.__kaspCybersportDebug) return;
    const doc = page.document;
    const dom = gameDOM.battleCreate;
    let root: HTMLElement | null = null;
    let model: CreationModel | null = null;
    let guardedProps: CreationModel['props'] | null = null;
    let guard: ReturnType<typeof guardCybersportSubmission> | null = null;
    let minimum: number | null = null;
    let rankMap: unknown;
    let queued = false;
    let error: string | null = null;
    let lastSubmission: CybersportNativeStatus['lastSubmission'] = null;
    const active = () => !!root?.isConnected && root.hasAttribute(CYBERSPORT_ACTIVE);
    const clear = () => {
        guard?.restore(); guard = null; guardedProps = null;
        root = null; model = null; minimum = null; rankMap = undefined;
    };
    const schedule = () => {
        if (queued) return;
        queued = true;
        page.requestAnimationFrame(() => { queued = false; sync(); });
    };
    function sync(): void {
        const nextRoot = doc.querySelector<HTMLElement>(`${dom.root}[${CYBERSPORT_ACTIVE}]`);
        if (!nextRoot) { clear(); error = null; return; }
        if (root !== nextRoot) { clear(); root = nextRoot; }
        const panel = root!.querySelector<HTMLElement>(dom.options);
        const nextModel = panel && creationModel(panel);
        if (!nextModel) {
            guard?.restore(); guard = null; guardedProps = null; model = null; minimum = null;
            error = 'native-creation-model-missing'; return;
        }
        if (model !== nextModel) { guard?.restore(); guard = null; guardedProps = null; minimum = null; model = nextModel; }
        if (rankMap !== model.props.activeMap) { rankMap = model.props.activeMap; minimum = null; }
        try {
            const fields = panel!.querySelectorAll(dom.parameterInputs);
            const form = components(fields[0] || null).find(component =>
                typeof component.props.onMaxPlayersChanged === 'function' && typeof component.props.onTimeLimitChanged === 'function')?.props;
            if (form) {
                if (model.state.maxPlayers !== '6') (form.onMaxPlayersChanged as (value: string) => void)('6');
                if (model.state.timeLimit !== '12') (form.onTimeLimitChanged as (value: string) => void)('12');
            }
            const dropdown = panel!.querySelector(dom.rankDropdowns);
            const ranks = components(dropdown).find(component => Number.isInteger(component.props.minRank) &&
                typeof component.props.onChangeFunction === 'function')?.props;
            if (ranks) {
                const rank = ranks.minRank as number;
                if (rank >= 1 && rank <= 100) {
                    minimum = rank;
                    if (model.state.selectedMinUserRank !== rank) (ranks.onChangeFunction as (value: number) => void)(rank);
                }
            }
            if (!nativePrivate(model)) for (const row of panel!.querySelectorAll(dom.optionRows)) {
                const checkbox = row.querySelector('input[type="checkbox"]');
                const privateOption = components(checkbox).find(component =>
                    typeof component.props.onChange === 'function' && typeof component.props.checked === 'boolean' &&
                    /^(?:закрытая\s+битва|(?:private|closed)(?:\s+battle)?)$/i.test(String(component.props.label).trim()))?.props;
                if (privateOption) { (privateOption.onChange as (checked: boolean) => void)(true); break; }
            }
            if (!guard || guardedProps !== model.props || model.props.launchFun !== guard.handler) {
                guard?.restore();
                guardedProps = model.props;
                guard = guardCybersportSubmission(model, active, () => minimum, (submission, cause) => {
                    lastSubmission = submission; error = cause;
                    if (cause) { console.warn('[KI Esports] Creation postponed:', cause); schedule(); }
                });
            }
            error = minimum === null ? 'native-minimum-rank-missing' : null;
        } catch (cause) { error = String(cause); }
    }
    const status = (): CybersportNativeStatus => ({ active: active(), guarded: guard !== null && model?.props.launchFun === guard.handler,
        ready: active() && guard !== null && model?.props.launchFun === guard.handler && minimum !== null && model?.state.maxPlayers === '6' &&
            model?.state.timeLimit === '12' && model?.state.selectedMinUserRank === minimum && nativePrivate(model),
        players: model?.state.maxPlayers ?? null, minutes: model?.state.timeLimit ?? null,
        minRank: model?.state.selectedMinUserRank ?? null, private: !!model && nativePrivate(model), error,
        lastSubmission: lastSubmission && { ...lastSubmission } });
    debugPage.__kaspCybersportDebug = { status };
    doc.addEventListener(CYBERSPORT_SYNC, sync);
    const beforeStart = (event: Event) => {
        if (event.type === 'keydown') {
            const key = event as KeyboardEvent;
            if (key.code !== 'Space' || key.repeat || key.ctrlKey || key.altKey || key.metaKey ||
                (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]'))) return;
        } else if (!(event.target instanceof Element) || !event.target.closest('.JoinToBattleComponentStyle-buttonJoin')) return;
        const creation = doc.querySelector(`${dom.root}[${CYBERSPORT_ACTIVE}]`);
        if (!creation || (event.type === 'click' && event.target instanceof Node && !creation.contains(event.target))) return;
        sync();
        if (!guard || minimum === null || !model || model.props.launchFun !== guard.handler || !nativePrivate(model)) {
            event.preventDefault(); event.stopImmediatePropagation();
            error = error || 'native-preset-not-ready'; schedule();
            console.warn('[KI Esports] Creation postponed:', error);
        }
    };
    doc.addEventListener('click', beforeStart, true);
    page.addEventListener('keydown', beforeStart, true);
}
