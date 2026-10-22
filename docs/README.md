# Documentation Index

Extension **3.0.0** · Source review **October 22, 2026**

| File | Purpose | Language |
| --- | --- | --- |
| [Project README](../README.md) | Installation, configuration, complete feature overview and final credits | English |
| [Technical reference](../DOCUMENTATION.md) | Architecture, source contracts, native mappings, state and build workflow | English |
| [Maintenance guide](../MAINTENANCE.md) | Failure isolation, diagnostics, regression and release checklists | English |
| [FAQ](FAQ.md) | 70 questions covering actual shipped behavior and limitations | English |
| [User guide](USER_GUIDE.ru.md) | Player instructions, settings, privacy, battle/history workflows and recovery | Russian |
| [Publication description](DESCRIPTION.en.md) | Full public feature copy with current credits at the end | English |
| [Описание для публикации](DESCRIPTION.ru.md) | Полное описание функций с благодарностями в конце | Russian |
| [Kill-feed investigation](kill-feed-rendering.md) | Specific verified render chain and font-safety regression | Russian |
| [License and Terms of Use](../LICENSE.txt) | Proprietary international edition with retained Tanki Tweaks permission | English |
| [Discord client integration](https://github.com/AlanKaspersky/Kaspersky-Inventions-for-Tanki-Online/blob/main/tools/electron-discord/README.md) | Companion preload/main-process reference and deployment guide | English; source repository only |

## Which Copy Changes When?

- Root guides and this directory describe the reviewed source tree.
- Release packaging copies the root guides, license and `docs/`; an old ZIP keeps its old contents until rebuilt.
- The separate client integration guide lives under `tools/` and is not included by runtime packaging. Follow that link from a source checkout or the project repository.
- Google Drive License/FAQ links in settings point to separately published documents. Local Markdown edits do not replace their remote content.
- Full descriptions here are publication drafts. They do not automatically update a store listing.
- `_locales/en/messages.json` and `_locales/ru/messages.json` supply short browser metadata. They are separate from the full descriptions and the in-game dictionaries.

Source code is authoritative for behavior. Declared support, unit/fixture checks and real-game verification are separate kinds of evidence. Do not turn diagnostic experiments into advertised features without a corresponding implementation.
