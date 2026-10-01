import { state } from '../../core/state';
import { buildCardMarkup, buildDetailedMarkup } from './presentation';
import { getAllBattles } from './repository';
import { getHistoryDictionary, type HistoryDictionary } from './localization';
import type { BattleData, HistoryAccount } from './types';

export function createHistoryViews(account: HistoryAccount) {
    const ROWS_PER_PAGE = 15;
    let hasRenderedBattleList = false;
    let lastRenderedNewestBattleKey: string | null = null;
    let pendingBattleListAnimation = false;

    let listRevision = 0;
    let detailRevision = 0;
    const templates = new Map<string, Promise<string>>();

    const loadTemplate = (name: 'card' | 'detail'): Promise<string> => {
        let pending = templates.get(name);
        if (!pending) {
            pending = fetch(chrome.runtime.getURL('templates/battle-history-' + name + '.html'))
                .then(response => {
                    if (!response.ok) throw new Error('Failed to load history template: ' + response.status);
                    return response.text();
                })
                .catch(error => {
                    templates.delete(name);
                    throw error;
                });
            templates.set(name, pending);
        }
        return pending;
    };

    const animateHistoryTransition = (element: HTMLElement, className: string, duration: number): Promise<void> =>
        new Promise(resolve => {
            let finished = false;
            let timer = 0;
            const finish = () => {
                if (finished) return;
                finished = true;
                window.clearTimeout(timer);
                element.removeEventListener('animationend', onAnimationEnd);
                element.classList.remove(className);
                resolve();
            };
            const onAnimationEnd = (event: AnimationEvent) => {
                if (event.target === element) finish();
            };

            element.classList.remove(className);
            void element.offsetWidth;
            element.addEventListener('animationend', onAnimationEnd);
            element.classList.add(className);
            timer = window.setTimeout(finish, duration + 50);
        });

    const renderDetailedMatch = async (b: BattleData, dict: HistoryDictionary, lang: string) => {
        const contentBlock = document.querySelector('.custom-history-content');
        if (!contentBlock) return;
        const revision = ++detailRevision;
        const isCurrent = () => revision === detailRevision
            && document.querySelector('.custom-history-content') === contentBlock;

        let template: string;
        try {
            template = await loadTemplate('detail');
        } catch (error) {
            console.error('[Tanki Battle History] Failed to load detail template:', error);
            return;
        }

        if (!isCurrent()) return;
        const listPanel = contentBlock.querySelector('.bh-left-panel') as HTMLElement | null;
        if (listPanel) {
            await animateHistoryTransition(listPanel, 'bh-panel-leave', 200);
            if (!isCurrent()) return;
            clearBattleListAnimations(listPanel);
            listPanel.style.display = 'none';
        }

        const oldView = contentBlock.querySelector('.bh-detailed-view');
        if (oldView) oldView.remove();

        const detailedView = document.createElement('div');
        detailedView.className = 'bh-detailed-view page';
        detailedView.style.cssText = 'flex-grow: 1; overflow-y: auto; padding-right: 1em; width: 100%; box-sizing: border-box;';

        detailedView.innerHTML = buildDetailedMarkup(b, dict, lang, template);

        contentBlock.appendChild(detailedView);
        void animateHistoryTransition(detailedView, 'bh-detail-enter', 240);

        let isReturningToList = false;
        const returnToList = async () => {
            if (isReturningToList) return;
            isReturningToList = true;
            await animateHistoryTransition(detailedView, 'bh-detail-leave', 200);
            detailedView.remove();
            if (listPanel && isCurrent()) {
                listPanel.style.display = 'flex';
                void animateHistoryTransition(listPanel, 'bh-panel-enter', 240);
            }
        };

        detailedView.querySelector('#bh-detailed-back')?.addEventListener('click', () => {
            void returnToList();
        });

    };

    const buildBattleCard = async (b: BattleData, dict: HistoryDictionary, lang: string): Promise<HTMLElement> => {
        const card = document.createElement('article');
        card.innerHTML = buildCardMarkup(b, dict, lang, await loadTemplate('card'));
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => renderDetailedMatch(b, dict, lang));
        return card;
    };

    const buildPageNumbers = (current: number, total: number): (number | string)[] => {
        if (total <= 7) {
            const arr: number[] = [];
            for (let i = 1; i <= total; i++) arr.push(i);
            return arr;
        }
        const result: (number | string)[] = [];
        result.push(1);
        if (current > 4) result.push('…');
        const start = Math.max(2, current - 1);
        const end = Math.min(total - 1, current + 1);
        for (let i = start; i <= end; i++) result.push(i);
        if (current < total - 3) result.push('…');
        result.push(total);
        return result;
    };

    const renderPagination = (current: number, total: number) => {
        const list = document.getElementById('bh-page-list');
        if (!list) return;
        list.textContent = '';

        const prev = document.createElement('button');
        prev.type = 'button';
        prev.className = 'bh-page bh-page-arrow';
        prev.textContent = '‹';
        prev.disabled = current <= 1;
        prev.addEventListener('click', () => renderBattleList(current - 1));
        list.appendChild(prev);

        const pages = buildPageNumbers(current, total);
        for (const p of pages) {
            if (p === '…') {
                const dots = document.createElement('span');
                dots.className = 'bh-page bh-page-dots';
                dots.textContent = '…';
                list.appendChild(dots);
                continue;
            }
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'bh-page' + (p === current ? ' bh-page-active' : '');
            btn.textContent = String(p);
            btn.addEventListener('click', () => renderBattleList(p as number));
            list.appendChild(btn);
        }

        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'bh-page bh-page-arrow';
        next.textContent = '›';
        next.disabled = current >= total;
        next.addEventListener('click', () => renderBattleList(current + 1));
        list.appendChild(next);
    };

    const getBattleKey = (battle: BattleData): string =>
        battle.id !== undefined ? `id:${battle.id}` : `date:${battle.date}|${battle.map}|${battle.mode}`;

    const playPendingBattleListAnimation = () => {
        if (!pendingBattleListAnimation) return;
        const listEl = document.querySelector<HTMLElement>('.bh-list');
        if (listEl) {
            listEl.classList.add('bh-list--animations-ready');
            listEl.querySelectorAll<HTMLElement>('.bh-card--rise-in').forEach(card => {
                const delay = parseFloat(card.style.animationDelay) || 0;
                window.setTimeout(() => {
                    card.classList.remove('bh-card--rise-in');
                    card.style.removeProperty('animation-delay');
                    card.style.removeProperty('z-index');
                    if (!listEl.querySelector('.bh-card--rise-in')) {
                        listEl.classList.remove('bh-list--animations-ready');
                    }
                }, delay + 400);
            });
        }
        pendingBattleListAnimation = false;
    };

    const clearBattleListAnimations = (panel: HTMLElement) => {
        panel.querySelectorAll<HTMLElement>('.bh-card--rise-in, .bh-card--new-in, .bh-card--push-down').forEach(card => {
            card.classList.remove('bh-card--rise-in', 'bh-card--new-in', 'bh-card--push-down');
            card.style.removeProperty('animation-delay');
            card.style.removeProperty('z-index');
            card.style.removeProperty('--bh-push-distance');
        });
        panel.querySelector('.bh-list')?.classList.remove('bh-list--animations-ready');
        pendingBattleListAnimation = false;
    };

    const renderBattleList = async (page = 1, animateNewMatches = false) => {
        account.updateNickname();
        const listEl = document.querySelector('.bh-list');
        if (!listEl) return;

        const revision = ++listRevision;
        const nickname = account.getNickname();
        const isCurrent = () => revision === listRevision && nickname === account.getNickname()
            && document.querySelector('.bh-list') === listEl;
        const lang = state.lang;
        const dict = getHistoryDictionary(lang);
        let battles: BattleData[];
        try {
            battles = await getAllBattles(nickname);
        } catch (error) {
            console.error('[BattleHistory] Failed to load battles:', error);
            return;
        }
        if (!isCurrent()) return;

        battles.sort((a, b) => b.date - a.date);
        const newestBattleKey = battles.length > 0 ? getBattleKey(battles[0]) : null;
        let animationMode: 'initial' | 'new-match' | null = null;
        if (animateNewMatches && page === 1) {
            if (!hasRenderedBattleList && battles.length > 0) {
                animationMode = 'initial';
            } else if (newestBattleKey && newestBattleKey !== lastRenderedNewestBattleKey) {
                animationMode = 'new-match';
            }
        }
        const totalPages = Math.max(1, Math.ceil(battles.length / ROWS_PER_PAGE));
        if (page > totalPages) page = totalPages;
        if (page < 1) page = 1;
        const startIndex = (page - 1) * ROWS_PER_PAGE;
        const pageBattles = battles.slice(startIndex, startIndex + ROWS_PER_PAGE);

        let cards: HTMLElement[];
        try {
            cards = await Promise.all(pageBattles.map(b => buildBattleCard(b, dict, lang)));
        } catch (error) {
            console.error('[BattleHistory] Failed to render battles:', error);
            return;
        }
        if (!isCurrent()) return;
        if (page === 1) {
            hasRenderedBattleList = true;
            lastRenderedNewestBattleKey = newestBattleKey;
        }

        listEl.classList.remove('bh-list--animations-ready');
        pendingBattleListAnimation = false;
        listEl.innerHTML = '';
        if (pageBattles.length === 0) {
            listEl.innerHTML = `<div class="bh-empty">${dict.noBattles}</div>`;
        } else {
            cards.forEach((card, index) => {
                const visualCard = card.querySelector<HTMLElement>('.bh-card');
                if (visualCard && animationMode === 'initial') {
                    visualCard.classList.add('bh-card--rise-in');
                    const delay = index * 60;
                    visualCard.style.animationDelay = `${delay}ms`;
                    visualCard.style.zIndex = String(cards.length - index);
                } else if (visualCard && animationMode === 'new-match') {
                    if (index === 0) {
                        visualCard.classList.add('bh-card--new-in');
                    } else {
                        visualCard.classList.add('bh-card--push-down');
                    }
                }
                listEl.appendChild(card);
            });

            if (animationMode === 'new-match' && cards.length > 1) {
                const newCard = cards[0].querySelector<HTMLElement>('.bh-card');
                const gap = parseFloat(getComputedStyle(listEl).rowGap) || 0;
                const pushDistance = (newCard?.getBoundingClientRect().height || 0) + gap;
                cards.slice(1).forEach(card => {
                    card.querySelector<HTMLElement>('.bh-card')?.style.setProperty('--bh-push-distance', `-${pushDistance}px`);
                });
            }

            pendingBattleListAnimation = animationMode !== null;
        }

        renderPagination(page, totalPages);
        const totalEl = document.getElementById('bh-total-battles');
        if (totalEl) totalEl.textContent = String(battles.length);
    };

    return {
        renderBattleList, buildBattleCard, renderDetailedMatch, playPendingBattleListAnimation,
        reset() {
            listRevision++;
            detailRevision++;
            hasRenderedBattleList = false;
            lastRenderedNewestBattleKey = null;
            pendingBattleListAnimation = false;
        },
    };
}
