import type { FeatureScope } from '../core/featureRuntime';
import { gameDOM } from '../core/gameDOM';

// One inherited progress value drives both the frame and all column widths.
export function createTabExpansion(scope: FeatureScope) {
    const panes = new Set<HTMLElement>();
    let timer = 0;
    const clear = () => {
        scope.cancelTimeout(timer);
        timer = 0;
        for (const pane of panes) {
            pane.removeAttribute('data-kasp-tab-animating');
            pane.removeAttribute('data-kasp-tab-measuring');
            for (const key of Array.from(pane.style)) if (key.startsWith('--kasp-tab-')) pane.style.removeProperty(key);
        }
        panes.clear();
    };
    const snapshot = (pane: HTMLElement) => {
        const row = (selector: string) => {
            const native = Array.from(pane.querySelectorAll(selector)).find(row => row.children.length >= 7);
            return { width: native?.getBoundingClientRect().width ?? 0,
                cells: Array.from(native?.children ?? []).slice(0, 8).map(cell => cell.getBoundingClientRect().width) };
        };
        return { width: parseFloat(window.getComputedStyle(pane).width),
            header: row('table > thead > tr'), body: row('table > tbody > tr') };
    };
    const setExpanded = (expanded: boolean) => {
        const body = document.body;
        const previous = body.classList.contains('kasp-tab-expanded');
        if (previous === expanded) return;
        const roots = Array.from(document.querySelectorAll<HTMLElement>(gameDOM.statistics.teams));
        if (!roots.length) { body.classList.toggle('kasp-tab-expanded', expanded); return; }
        // A rapid reverse uses the existing transition's current progress.
        if (!roots.every(root => panes.has(root))) {
            clear();
            try {
                roots.forEach(root => { panes.add(root); root.setAttribute('data-kasp-tab-measuring', ''); });
                body.classList.remove('kasp-tab-expanded');
                const collapsed = roots.map(snapshot);
                body.classList.add('kasp-tab-expanded');
                const opened = roots.map(snapshot);
                body.classList.toggle('kasp-tab-expanded', previous);
                roots.forEach((root, index) => {
                    const from = collapsed[index], to = opened[index];
                    if (!Number.isFinite(from.width) || !Number.isFinite(to.width) || from.width <= 0 || to.width <= 0) return;
                    if (from.header.cells.length < 7 || from.body.cells.length < 7
                        || from.header.cells.length !== to.header.cells.length || from.body.cells.length !== to.body.cells.length) return;
                    root.style.setProperty('--kasp-tab-from', `${from.width}px`);
                    root.style.setProperty('--kasp-tab-to', `${to.width}px`);
                    for (const group of ['header', 'body'] as const) {
                        root.style.setProperty(`--kasp-tab-${group}-row-from`, `${from[group].width}px`);
                        root.style.setProperty(`--kasp-tab-${group}-row-to`, `${to[group].width}px`);
                        from[group].cells.forEach((width, column) => {
                            root.style.setProperty(`--kasp-tab-${group}-${column}-from`, `${width}px`);
                            root.style.setProperty(`--kasp-tab-${group}-${column}-to`, `${to[group].cells[column] ?? width}px`);
                        });
                    }
                    root.style.setProperty('--kasp-tab-progress', previous ? '1' : '0');
                    root.setAttribute('data-kasp-tab-animating', '');
                });
                // Commit the current geometry before changing the shared transition target.
                roots.forEach(root => { void window.getComputedStyle(root).width; });
            } catch (error) {
                clear();
                throw error;
            } finally {
                body.classList.toggle('kasp-tab-expanded', previous);
                roots.forEach(root => root.removeAttribute('data-kasp-tab-measuring'));
            }
        }
        body.classList.toggle('kasp-tab-expanded', expanded);
        roots.forEach(root => root.style.removeProperty('--kasp-tab-progress'));
        scope.cancelTimeout(timer);
        timer = scope.timeout(clear, 240);
    };
    // Let native responsive rules immediately take over after a resize.
    scope.listen(window, 'resize', clear);
    scope.onCleanup(clear);
    return { setExpanded };
}
