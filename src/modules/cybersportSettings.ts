import { featureScope } from '../core/featureRuntime';
const lifecycle = featureScope('cybersportSettings');
import { gameDOM } from '../core/gameDOM';
import { CYBERSPORT_ACTIVE, CYBERSPORT_SYNC } from '../core/cybersportNative';

export function createCybersportSettings(schedule: () => void) {
    let root: HTMLElement | null = null;
    let observer: MutationObserver | null = null;
    let writing = false;
    let closingButton: HTMLElement | null = null;
    let creationRoot: HTMLElement | null = null;
    const locks = new Map<HTMLInputElement, { readOnly: boolean; disabled: boolean }>();
    let rankIcon: string | null = null;
    let lastRankAttempt: string | null = null;
    let rankJob: { dropdown: HTMLElement; key: string; until: number; opened: boolean; clicked: boolean } | null = null;
    let rankTimer: ReturnType<typeof setTimeout> | null = null;
    const dom = gameDOM.battleCreate;

    const imageKey = (element: Element | null): string | null => {
        const image = element?.querySelector<HTMLImageElement>('img');
        if (!image?.src) return null;
        try { return new URL(image.src, location.href).pathname; }
        catch { return null; }
    };
    const lock = (input: HTMLInputElement, checkbox = false) => {
        if (!locks.has(input)) locks.set(input, { readOnly: input.readOnly, disabled: input.disabled });
        if (checkbox) input.disabled = true;
        else input.readOnly = true;
    };
    const releaseLocks = () => {
        for (const [input, previous] of locks) {
            input.readOnly = previous.readOnly;
            input.disabled = previous.disabled;
        }
        locks.clear();
    };
    const toggleDropdown = (dropdown: HTMLElement) => {
        const control = dropdown.querySelector<HTMLElement>(dom.dropdownControl);
        control?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    };
    const finishRank = (close = false) => {
        if (rankTimer !== null) lifecycle.cancelTimeout(rankTimer);
        rankTimer = null;
        if (close && rankJob?.opened && rankJob.dropdown.isConnected && rankJob.dropdown.querySelector(dom.dropdownMenu)) {
            const previousWriting = writing;
            writing = true;
            try { toggleDropdown(rankJob.dropdown); }
            finally { writing = previousWriting; }
        }
        rankJob = null;
    };
    const onInteraction = (event: Event) => {
        if (writing) return;
        const target = event.target;
        const minimum = root?.querySelector(dom.rankDropdowns);
        const placeholder = minimum?.querySelector(dom.dropdownPlaceholder);
        const fixedRank = /^(?:первый сержант|first sergeant)$/i.test(placeholder?.textContent?.trim() || '') ||
            (rankIcon !== null && imageKey(placeholder || null) === rankIcon);
        const editsRank = event.type === 'mousedown' || (event.type === 'keydown' &&
            ['Enter', ' ', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes((event as KeyboardEvent).key));
        if (editsRank &&
            fixedRank && target instanceof Node && minimum?.contains(target)) {
            event.preventDefault(); event.stopPropagation();
        }
        schedule();
    };
    const events = ['input', 'change', 'click', 'mousedown', 'keydown'] as const;
    const clear = () => {
        finishRank(true);
        observer?.disconnect(); observer = null;
        events.forEach(type => lifecycle.unlisten(root, type, onInteraction, true));
        releaseLocks();
        creationRoot?.removeAttribute(CYBERSPORT_ACTIVE); creationRoot = null;
        document.dispatchEvent(new Event(CYBERSPORT_SYNC));
        root = null; closingButton = null; rankIcon = lastRankAttempt = null;
    };
    const setNumber = (index: number, value: string) => {
        const input = root?.querySelectorAll<HTMLInputElement>(dom.parameterInputs)[index];
        if (!input?.isConnected || input.type !== 'text') return;
        if (input.value !== value) {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            if (!setter || input.disabled) return;
            setter.call(input, value);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        lock(input);
    };
    const setPrivate = () => {
        const rows = root?.querySelectorAll<HTMLElement>(dom.optionRows);
        const privateRow = Array.from(rows || []).find(element =>
            /^(?:закрытая\s+битва|(?:private|closed)(?:\s+battle)?)$/i.test(
                element.querySelector('label[for]')?.textContent?.trim() || ''));
        const input = privateRow?.querySelector<HTMLInputElement>('input[type="checkbox"]');
        if (!input?.isConnected) return;
        if (!input.checked) {
            const previous = locks.get(input);
            if (previous) input.disabled = previous.disabled;
            if (input.disabled) return;
            input.click();
        }
        if (input.checked) lock(input, true);
    };
    const closeAdvanced = (): boolean => {
        const button = Array.from(root?.querySelectorAll<HTMLElement>(dom.advancedClose) || [])
            .find(element => /^(?:закрыть|close)$/i.test(element.textContent?.trim() || ''));
        if (!button) { closingButton = null; return false; }
        if (closingButton !== button) {
            closingButton = button;
            button.click();
            schedule();
        }
        return true;
    };
    const setRank = () => {
        const dropdown = root?.querySelector<HTMLElement>(dom.rankDropdowns);
        const placeholder = dropdown?.querySelector(dom.dropdownPlaceholder);
        if (!dropdown || !placeholder) { finishRank(true); return; }
        const currentIcon = imageKey(placeholder);
        const name = placeholder.textContent?.replace(/\s+/g, ' ').trim() || '';
        if (/^(?:первый сержант|first sergeant)$/i.test(name) || (rankIcon && currentIcon === rankIcon)) {
            finishRank(true); lastRankAttempt = null; return;
        }
        const key = `${currentIcon}|${name}`;
        if (rankJob && (rankJob.dropdown !== dropdown || rankJob.key !== key)) finishRank(true);
        if (!rankJob) {
            if (lastRankAttempt === key) return;
            lastRankAttempt = key;
            rankJob = { dropdown, key, until: Date.now() + 2000, opened: false, clicked: false };
            if (!dropdown.querySelector(dom.dropdownMenu)) {
                rankJob.opened = true;
                toggleDropdown(dropdown);
            }
        }
        if (Date.now() >= rankJob.until) { finishRank(true); return; }
        const menu = dropdown.querySelector<HTMLElement>(dom.dropdownMenu);
        const firstImage = menu?.querySelector<HTMLImageElement>(`${dom.dropdownItems} img`);
        const firstOption = firstImage?.parentElement;
        if (firstOption && !rankJob.clicked) {
            rankIcon = imageKey(firstOption);
            rankJob.clicked = true;
            firstOption.click();
        }
        if (rankTimer === null) rankTimer = lifecycle.timeout(() => {
            rankTimer = null; schedule();
        }, 100);
    };
    const sync = (nextRoot: HTMLElement | null) => {
        if (!nextRoot?.isConnected) { clear(); return; }
        const panel = nextRoot.querySelector<HTMLElement>(dom.options);
        if (!panel) { clear(); return; }
        if (root !== panel) {
            clear(); root = panel;
            events.forEach(type => lifecycle.listen(panel, type, onInteraction, true));
            observer = lifecycle.observer(schedule);
            observer.observe(panel, { subtree: true, childList: true, characterData: true,
                attributes: true, attributeFilter: ['class', 'src', 'value', 'checked'] });
        }
        creationRoot = nextRoot;
        if (!nextRoot.hasAttribute(CYBERSPORT_ACTIVE)) nextRoot.setAttribute(CYBERSPORT_ACTIVE, '');
        document.dispatchEvent(new Event(CYBERSPORT_SYNC));
        for (const [input, previous] of locks) if (!panel.contains(input)) {
            input.readOnly = previous.readOnly; input.disabled = previous.disabled; locks.delete(input);
        }
        if (writing) return;
        writing = true;
        try {
            setNumber(0, '6');
            setNumber(1, '12');
            setPrivate();
            if (closeAdvanced()) return;
            setRank();
        } finally { writing = false; }
    };
    lifecycle.onCleanup(clear);
    return { sync: lifecycle.guard(sync), clear };
}
