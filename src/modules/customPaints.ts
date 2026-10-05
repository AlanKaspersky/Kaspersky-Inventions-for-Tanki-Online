import { gameDOM } from '../core/gameDOM';
import { state } from '../core/state';
import { utils } from '../core/utils';
import { DataLoader } from '../core/dataLoader';

export const customPaints = (() => {
    let initialized = false;

    function normalizeText(text: string) {
        if (!text) return "";
        return text.toLowerCase().replace(/ё/g, 'е');
    }

    function applySearch() {
        if (!DataLoader.isReady()) return;
        const input = document.querySelector('.kasp-search-wrapper input') as HTMLInputElement;
        if (!input) return;
        const rawQuery = input.value.trim();
        const queryWords = normalizeText(rawQuery).split(/\s+/).filter(word => word.length > 0);
        const items = document.querySelectorAll(`.kasp-paints-container ${gameDOM.garage.item}`);

        items.forEach(itemEl => {
            const item = itemEl as HTMLElement;
            if (queryWords.length === 0) {
                item.style.display = '';
                return;
            }
            const imgElement = item.querySelector(gameDOM.garage.itemImage);
            if (!imgElement) return;
            const src = imgElement.getAttribute('src');
            if (!src) return;
            const paintInfo = DataLoader.getPaint(src);
            let isMatch = false;
            if (paintInfo) {
                const combinedNames = normalizeText(paintInfo.ru + " " + paintInfo.en);
                isMatch = queryWords.every(word => combinedNames.includes(word));
            }
            item.style.display = isMatch ? '' : 'none';
        });

        const columns = document.querySelectorAll('.kasp-paints-container > div');
        columns.forEach(colEl => {
            const col = colEl as HTMLElement;
            const visibleItems = Array.from(col.querySelectorAll(gameDOM.garage.item)).filter(i => (i as HTMLElement).style.display !== 'none');
            col.style.display = visibleItems.length === 0 ? 'none' : '';
        });
    }

    function addSearchInput() {
        const captionContainer = document.querySelector(gameDOM.paints.caption);
        if (!captionContainer) return;
        const parentBlock = captionContainer.closest(gameDOM.paints.categoryInfo);
        if (!parentBlock || parentBlock.querySelector('.kasp-search-wrapper')) return;

        const itemsContainer = document.querySelector(gameDOM.paints.items);
        if (itemsContainer) {
            itemsContainer.classList.add('kasp-paints-container');
        }

        const searchWrapper = document.createElement('div');
        searchWrapper.className = 'kasp-search-wrapper';
        const searchContainer = document.createElement('div');
        searchContainer.className = 'kasp-SearchInputComponentStyle-search';
        const searchInputDiv = document.createElement('div');
        searchInputDiv.className = 'kasp-SearchInputComponentStyle-searchInput';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = state.lang === 'RU' ? 'Найти' : 'Search';
        input.className = gameDOM.classes.normal;
        input.addEventListener('input', applySearch);

        const searchIcon = document.createElement('div');
        searchIcon.className = 'kasp-search-icon';

        searchInputDiv.appendChild(input);
        searchInputDiv.appendChild(searchIcon);
        searchContainer.appendChild(searchInputDiv);
        searchWrapper.appendChild(searchContainer);
        parentBlock.appendChild(searchWrapper);
    }

    return () => {
        if (!utils.getSetting('k_paints', false)) return;
        if (state.currentScreen !== 'garage') return;

        if (!initialized) {
            initialized = true;
        }

        addSearchInput();
        const input = document.querySelector('.kasp-search-wrapper input') as HTMLInputElement;
        if (input && input.value.trim() !== '') {
            applySearch();
        }
    };
})();
