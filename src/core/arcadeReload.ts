export interface ArcadeReloadHookStatus {
    hooked: boolean;
    issues: string[];
    panel?: 'local-hud';
}

export interface ArcadeReloadSample {
    weapon: 'Shaft' | 'Scorpio' | null;
    progress: number | null;
    barCreated: boolean;
    visible: boolean;
}

const ID = '[\\w$]+';
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function functionEnd(code: string, opening: number): number {
    let depth = 0;
    const start = code[opening], close = start === '(' ? ')' : '}';
    for (let index = opening; index < Math.min(code.length, opening + 30_000); index++) {
        const character = code[index];
        if (character === '"' || character === "'" || character === '`') {
            const quote = character;
            while (++index < code.length) {
                if (code[index] === '\\') index++;
                else if (code[index] === quote) break;
            }
        } else if (character === '/' && code[index + 1] === '*') {
            const end = code.indexOf('*/', index + 2);
            if (end < 0) return -1;
            index = end + 1;
        } else if (character === '/' && code[index + 1] === '/') {
            const end = code.indexOf('\n', index + 2);
            if (end < 0) return -1;
            index = end;
        } else if (character === start) depth++;
        else if (character === close && --depth === 0) return index + 1;
    }
    return -1;
}

function argumentList(expression: string): string[] {
    const result: string[] = [];
    let start = 0, depth = 0;
    for (let index = 0; index < expression.length; index++) {
        const char = expression[index];
        if (char === '"' || char === "'") {
            const quote = char;
            while (++index < expression.length) {
                if (expression[index] === '\\') index++;
                else if (expression[index] === quote) break;
            }
        } else if ('({['.includes(char)) depth++;
        else if (')}]'.includes(char)) depth--;
        else if (char === ',' && depth === 0) { result.push(expression.slice(start, index)); start = index + 1; }
    }
    result.push(expression.slice(start));
    return result;
}

function nativeLookup(code: string, label: string) {
    const getter = new RegExp(`function(?:\\s+(${ID}))?\\s*\\(\\s*(${ID})\\s*\\)\\s*\\{\\s*var\\s+(${ID})\\s*=\\s*\\2\\.(${ID})\\s*;\\s*if\\s*\\(\\s*(?:null\\s*!=\\s*\\3|\\3\\s*!=\\s*null)\\s*\\)\\s*return\\s+\\3\\s*;\\s*${ID}\\s*\\(\\s*['"]${label}['"]\\s*\\)\\s*\\}`, 'g');
    const candidates = new Map<string, { getter: string; field: string; type: string; token: string }>();
    for (const match of code.matchAll(getter)) {
        const lookup = new RegExp(`this\\.${escape(match[4])}\\s*=\\s*this\\.${ID}\\s*\\(\\s*\\)\\.${ID}\\s*\\(\\s*(?:(${ID})\\s*\\(\\s*(${ID})\\s*\\)|(${ID}))\\s*\\)`, 'g');
        for (const assignment of code.matchAll(lookup)) {
            const type = assignment[2] || assignment[3];
            candidates.set(type, { getter: match[1] || '', field: match[4], type, token: assignment[1] || '' });
        }
    }
    return candidates.size === 1 ? [...candidates.values()][0] : null;
}

export function patchArcadeReload(code: string, report?: (status: ArcadeReloadHookStatus) => void): string {
    const status: ArcadeReloadHookStatus = { hooked: false, issues: [] };
    const done = (result: string) => { try { report?.(status); } catch {} return result; };
    if (code.includes('__kaspArcadeHudCreate')) {
        status.hooked = true;
        status.panel = 'local-hud';
        return done(code);
    }
    const shaft = nativeLookup(code, 'shaftWeapon');
    const scorpio = nativeLookup(code, 'scorpioWeapon');
    const reload = nativeLookup(code, 'reloadTimeComponent');
    if (!shaft || !scorpio || !reload?.getter) {
        status.issues.push('weapon-or-reload-component-missing');
        return done(code);
    }

    const localTanks = [...code.matchAll(new RegExp(`function\\s+(${ID})\\s*\\(\\s*(${ID})\\s*\\)\\s*\\{\\s*return\\s+\\2\\.${ID}\\s*\\(\\s*['"]LocalTank['"]\\s*\\)\\s*\\}`, 'g'))];
    if (localTanks.length !== 1) {
        status.issues.push('local-tank-lookup-missing-or-ambiguous');
        return done(code);
    }

    const headers = [...code.matchAll(new RegExp(`(${ID}(?:\\(\\s*${ID}\\s*\\)|\\.prototype))\\.(${ID})\\s*=\\s*function\\s*\\([^)]*\\)\\s*\\{`, 'g'))];
    const componentBodies = (type: string) => headers.filter(header =>
        new RegExp(`(?:\\(\\s*${escape(type)}\\s*\\)|^${escape(type)}\\.prototype)$`).test(header[1])).map(header => {
            const end = functionEnd(code, header.index! + header[0].lastIndexOf('{'));
            return end > 0 ? code.slice(header.index, end) : '';
        });
    const configurations = [...code.matchAll(/['"]progressBarMaterial['"]/g)];
    const initializers = configurations.map(anchor => {
        const preceding = headers.filter(candidate => candidate.index! < anchor.index!);
        const header = preceding[preceding.length - 1];
        if (!header) return null;
        const end = functionEnd(code, header.index! + header[0].lastIndexOf('{'));
        return end > anchor.index! ? { header, body: code.slice(header.index, end) } : null;
    }).filter(Boolean);
    if (initializers.length !== 1) {
        status.issues.push('local-hud-configuration-missing-or-ambiguous');
        return done(code);
    }
    const init = initializers[0]!;
    const creation = new RegExp(`(${ID})\\s*=\\s*new\\s+(${ID})\\s*\\(`, 'g');
    const anchor = init.body.indexOf('progressBarMaterial');
    const factories = [...init.body.matchAll(creation)].filter(match => {
        const end = functionEnd(init.body, match.index! + match[0].lastIndexOf('('));
        return match.index! < anchor && end > anchor;
    });
    const nativeFactory = factories.length === 1 ? factories[0] : null;
    const factoryOpening = nativeFactory ? nativeFactory.index! + nativeFactory[0].lastIndexOf('(') : -1;
    const factoryEnd = factoryOpening >= 0 ? functionEnd(init.body, factoryOpening) : -1;
    const factory = factoryEnd > 0 ? init.body.slice(nativeFactory!.index! + nativeFactory![0].indexOf('new'), factoryEnd) : '';
    const factoryArgs = factoryEnd > 0 ? argumentList(init.body.slice(factoryOpening + 1, factoryEnd - 1)) : [];
    const attachment = nativeFactory && new RegExp(`(${ID})\\s*\\(\\s*${escape(nativeFactory[1])}\\s*,\\s*(${ID})\\s*\\)\\s*,\\s*${escape(nativeFactory[1])}\\.(${ID})\\s*\\(\\s*${ID}\\s*\\)\\s*,\\s*(${ID})\\s*\\(\\s*(${ID})\\s*\\)\\.(${ID})\\s*\\(\\s*${escape(nativeFactory[1])}\\s*\\)\\s*,\\s*\\5\\.(${ID})\\s*=\\s*${escape(nativeFactory[1])}`).exec(init.body.slice(factoryEnd));
    if (!nativeFactory || factoryArgs.length !== 4 || !attachment) {
        status.issues.push('local-hud-factory-missing-or-ambiguous');
        return done(code);
    }
    const barField = attachment[7], setProgress = attachment[3], owner = attachment[5];
    const materialField = new RegExp(`var\\s+${ID}\\s*=\\s*${ID}\\.(${ID})\\s*;`).exec(factoryArgs[2]);
    const materialCreations = materialField ? [...init.body.matchAll(new RegExp(`${ID}\\.${escape(materialField[1])}\\s*=\\s*new\\s+(${ID})\\s*\\(`, 'g'))] : [];
    let arcadeFactory = factory;
    if (materialCreations.length === 1) {
        const material = materialCreations[0];
        const opening = material.index! + material[0].lastIndexOf('('), end = functionEnd(init.body, opening);
        const args = end > 0 ? argumentList(init.body.slice(opening + 1, end - 1)) : [];
        const color = /^\s*([\w$]+)\s*\(\s*-?\d+\s*\)\s*$/.exec(args[2] || '');
        if (args.length === 4 && color) {
            args[1] = `${color[1]}(0xffbb1c)`;
            const greenArgs = [...factoryArgs];
            greenArgs[2] = `new ${material[1]}(${args.join(',')})`;
            arcadeFactory = `new ${nativeFactory[2]}(${greenArgs.join(',')})`;
        } else status.issues.push('arcade-material-color-missing');
    } else status.issues.push('arcade-material-missing-or-ambiguous');
    const methods = headers.filter(header => header[1] === init.header[1]).map(header => {
        const end = functionEnd(code, header.index! + header[0].lastIndexOf('{'));
        return { header, end, body: code.slice(header.index, end) };
    });
    const layoutMarker = init.body.search(/callableName\s*=\s*['"]onLayoutSizeChanged['"]/);
    const layoutCalls = [...init.body.slice(0, layoutMarker).matchAll(new RegExp(`${ID}\\.(${ID})\\s*\\(\\s*${ID}\\s*,\\s*${ID}\\.${ID}\\s*\\)`, 'g'))];
    const layoutMethods = methods.filter(method => layoutCalls.some(call => call[1] === method.header[2]));
    const cleanup = methods.map(method => ({ ...method, match: new RegExp(`var\\s+(${ID})\\s*=\\s*this\\.${escape(barField)}\\s*;\\s*(?:null\\s*==\\s*\\1|\\1\\s*==\\s*null)\\s*\\|\\|\\s*${escape(attachment[4])}\\s*\\(\\s*this\\s*\\)\\.(${ID})\\s*\\(\\s*\\1\\s*\\)`).exec(method.body) })).filter(item => item.match);
    const frames = [
        new RegExp(`null\\s*==\\s*\\(\\s*(${ID})\\s*=\\s*(${ID})\\.${escape(barField)}\\s*\\)\\s*\\|\\|\\s*\\1\\.${escape(setProgress)}\\s*\\(\\s*${ID}\\s*\\)`),
        new RegExp(`\\(\\s*(${ID})\\s*=\\s*(${ID})\\.${escape(barField)}\\s*\\)\\s*==\\s*null\\s*\\|\\|\\s*\\1\\.${escape(setProgress)}\\s*\\(\\s*${ID}\\s*\\)`),
        new RegExp(`\\(\\s*(${ID})\\s*=\\s*(${ID})\\.${escape(barField)}\\s*\\)\\?\\.${escape(setProgress)}\\s*\\(\\s*${ID}\\s*\\)`)
    ].map(pattern => pattern.exec(init.body)).filter(Boolean);
    const frame = frames.length === 1 ? frames[0] : null;
    const visibility = new RegExp(`var\\s+(${ID})\\s*=\\s*(${ID})\\.${escape(barField)}\\s*;\\s*(?:null\\s*==\\s*\\1\\s*\\|\\|\\s*\\1\\.|\\1\\?\\.)(${ID})\\s*\\(\\s*(${ID})\\s*\\)`).exec(code);
    const world = new RegExp(`this\\.${ID}\\s*=\\s*${ID}\\s*\\(\\s*this\\.(${ID})\\s*\\(\\s*\\)\\s*\\)`).exec(init.body);
    const hudType = /\(\s*([\w$]+)\s*\)|^([\w$]+)\.prototype/.exec(init.header[1]);
    const lookup = hudType && new RegExp(`this\\.${ID}\\s*=\\s*this\\.${ID}\\s*\\(\\s*\\)\\.(${ID})\\s*\\(\\s*(?:(${ID})\\s*\\(\\s*${escape(hudType[1] || hudType[2])}\\s*\\)|${escape(hudType[1] || hudType[2])})\\s*\\)`).exec(code);
    const placement = [...code.matchAll(new RegExp(`${escape(nativeFactory[2])}\\s*\\)\\.(${ID})\\s*=\\s*function\\s*\\(\\s*(${ID})\\s*,\\s*(${ID})\\s*\\)\\s*\\{\\s*${ID}\\s*\\(\\s*this\\s*,\\s*\\2\\.${ID}\\s*,\\s*\\2\\.${ID}\\s*\\+\\s*\\3\\s*\\)\\s*,\\s*this\\.(${ID})\\.${ID}\\s*=\\s*\\2\\.${ID}`, 'g'))];
    const dimensions = [...code.matchAll(new RegExp(`function\\s+${escape(nativeFactory[2])}\\s*\\(\\s*(${ID})\\s*,\\s*(${ID})\\s*,[^)]*\\)\\s*\\{[^{}]{0,500}?this\\.(${ID})\\s*\\(\\s*\\1\\s*\\)\\s*,\\s*this\\.(${ID})\\s*\\(\\s*\\2\\s*\\)`, 'g'))];
    const getters = (setter: string) => {
        const fields = [...code.matchAll(new RegExp(`\\.${escape(setter)}\\s*=\\s*function\\s*\\(\\s*(${ID})\\s*\\)\\s*\\{\\s*this\\.(${ID})\\s*=\\s*Math\\.max\\s*\\(\\s*0\\s*,\\s*\\1\\s*\\)\\s*\\}`, 'g'))];
        const names = fields.flatMap(field => [...code.matchAll(new RegExp(`\\.(${ID})\\s*=\\s*function\\s*\\(\\s*\\)\\s*\\{\\s*return\\s+this\\.${escape(field[2])}\\s*\\}`, 'g'))].map(match => match[1]));
        return [...new Set(names)];
    };
    const widthGetters = dimensions.length === 1 ? getters(dimensions[0][3]) : [];
    const heightGetters = dimensions.length === 1 ? getters(dimensions[0][4]) : [];
    const providerAnchor = code.search(/callableName\s*=\s*['"]provideDefaultTitlePosition['"]/);
    const providerHeader = headers.filter(header => header.index! < providerAnchor).pop();
    const providerEnd = providerHeader ? functionEnd(code, providerHeader.index! + providerHeader[0].lastIndexOf('{')) : -1;
    const providerBody = providerHeader && providerEnd > providerAnchor ? code.slice(providerHeader.index, providerEnd) : '';
    const siblings = [...providerBody.matchAll(new RegExp(`this\\.(${ID})\\s*=\\s*this\\.(${ID})\\s*\\(\\s*\\)\\.(${ID})\\s*\\(\\s*(?:(${ID})\\s*\\(\\s*(${ID})\\s*\\)|(${ID}))\\s*\\)`, 'g'))];
    const weaponSiblingIndex = siblings.findIndex(match => (match[5] || match[6]) === (hudType?.[1] || hudType?.[2]));
    const suppliesSibling = weaponSiblingIndex >= 0 ? siblings[weaponSiblingIndex + 1] : null;
    const suppliesType = suppliesSibling && (suppliesSibling[5] || suppliesSibling[6]);
    const supplyMethods = suppliesType ? headers.filter(header =>
        new RegExp(`(?:\\(\\s*${escape(suppliesType)}\\s*\\)|^${escape(suppliesType)}\\.prototype)$`).test(header[1])) : [];
    const supplyLayouts = supplyMethods.flatMap(header => {
        const params = /function\s*\(\s*([\w$]+)\s*,\s*([\w$]+)\s*\)/.exec(header[0]);
        if (!params) return [];
        const end = functionEnd(code, header.index! + header[0].lastIndexOf('{'));
        const body = code.slice(header.index, end);
        const calls = [...body.matchAll(new RegExp(`(${ID})\\s*\\(\\s*0\\s*,\\s*${escape(params[1])}\\s*,\\s*${escape(params[2])}\\s*,\\s*this\\.${ID}\\.${ID}\\(\\)\\s*,\\s*(-?\\d+(?:\\.\\d+)?)\\s*,\\s*${escape(params[1])}\\s*,\\s*${escape(params[2])}\\s*\\)`, 'g'))];
        return calls.length === 2 && calls[0][1] === calls[1][1] && Number(calls[0][2]) < 0 && Number(calls[1][2]) >= 0 ? [{ header, call: calls[1] }] : [];
    });
    const supplyLayout = supplyLayouts.length === 1 ? supplyLayouts[0] : null;
    const centeredFlags = supplyLayout && suppliesType ? componentBodies(suppliesType).flatMap(body =>
        [...body.matchAll(new RegExp(`this\\.(${ID})\\s*\\?\\s*this\\.${ID}\\s*\\|\\|\\s*this\\.${ID}\\(\\)\\s*:\\s*${escape(supplyLayout.call[1])}\\s*\\(`, 'g'))]) : [];
    const renderFactories = componentBodies(nativeFactory[2]).flatMap(body =>
        [...body.matchAll(new RegExp(`return\\s+new\\s+(${ID})\\s*\\(\\s*this\\s*\\)`, 'g'))]);
    const projections = renderFactories.length === 1 ? componentBodies(renderFactories[0][1]).flatMap(body => {
        const projection = new RegExp(`this\\.(${ID})\\.(${ID})\\s*\\(\\s*${ID}\\.${ID}\\s*,\\s*(${ID}\\(\\)\\.${ID})\\s*\\)\\s*,\\s*this\\.\\1\\.${ID}\\.${ID}\\s*\\(`).exec(body);
        if (!projection) return [];
        const opening = projection.index + projection[0].lastIndexOf('('), end = functionEnd(body, opening);
        const args = end > 0 ? argumentList(body.slice(opening + 1, end - 1)) : [];
        const fields = [0, 1, 3, 4].map(index => new RegExp(`^${escape(projection[3])}\\.(${ID})$`).exec(args[index]?.trim() || '')?.[1]);
        return fields.every(Boolean) ? [{ method: projection[2], x: fields[0]!, y: fields[1]!, width: fields[2]!, height: fields[3]! }] : [];
    }) : [];
    if (cleanup.length !== 1 || !frame || !visibility || !world || !lookup || placement.length !== 1 || projections.length !== 1 || layoutMethods.length !== 1 || widthGetters.length !== 1 || heightGetters.length !== 1) {
        const checks = { cleanup: cleanup.length === 1, frame: !!frame, visibility: !!visibility, world: !!world,
            lookup: !!lookup, placement: placement.length === 1, projection: projections.length === 1, resize: layoutMethods.length === 1,
            dimensions: widthGetters.length === 1 && heightGetters.length === 1 };
        status.issues.push(...Object.entries(checks).filter(([, valid]) => !valid).map(([name]) => `local-hud-${name}-missing-or-ambiguous`));
        return done(code);
    }

    const helpers = [...code.matchAll(new RegExp(`function\\s+(${ID})\\s*\\(\\s*(${ID})\\s*\\)\\s*\\{`, 'g'))].filter(header =>
        code.slice(header.index, header.index! + 400).includes(`${reload.getter}(${header[2]})`));
    const progressHelpers = helpers.map(header => {
        const end = functionEnd(code, header.index! + header[0].lastIndexOf('{'));
        const body = end > 0 ? code.slice(header.index, end) : '';
        const subtract = new RegExp(`var\\s+${ID}\\s*=\\s*(${ID})\\s*\\(\\s*${escape(reload.getter)}\\s*\\(`).exec(body);
        const divide = new RegExp(`=\\s*1\\s*-\\s*(${ID})\\s*\\(`).exec(body);
        return subtract && divide && /else\s+[\w$]+\s*=\s*1/.test(body) ? { subtract: subtract[1], divide: divide[1] } : null;
    }).filter(Boolean);
    if (progressHelpers.length !== 1) {
        status.issues.push('native-reload-progress-missing-or-ambiguous');
        return done(code);
    }
    const progressHelper = progressHelpers[0]!;

    const shaftBodies = componentBodies(shaft.type);
    const stateFactories = shaftBodies.flatMap(body => [...body.matchAll(new RegExp(`(${ID})\\.(${ID})\\s*=\\s*${ID}\\.${ID}\\s*\\(\\s*new\\s+(${ID})\\s*\\(\\s*\\1\\s*\\)\\s*\\)`, 'g'))]);
    const activeStates = shaftBodies.flatMap(body => [...body.matchAll(new RegExp(`var\\s+(${ID})\\s*=\\s*this\\.(${ID})\\s*;\\s*(?:null\\s*==\\s*\\1\\s*\\|\\|\\s*\\1\\.|\\1\\?\\.)${ID}\\s*\\(\\s*\\)`, 'g'))]);
    const frozenStates = shaftBodies.flatMap(body => [...body.matchAll(new RegExp(`this\\.(${ID})\\s*\\|\\|\\s*this\\.(${ID})\\s*\\|\\|\\s*${ID}\\s*\\(\\s*this\\s*,`, 'g'))]);
    const scorpioProgress = componentBodies(scorpio.type).flatMap(body => [...body.matchAll(new RegExp(`return\\s+this\\.(${ID})\\s*\\+\\s*${ID}\\s*\\(\\s*this\\s*,\\s*${ID}\\s*\\)\\s*>=\\s*1`, 'g'))]);
    if (stateFactories.length !== 1 || activeStates.length !== 1 || frozenStates.length !== 1 || scorpioProgress.length !== 1) {
        status.issues.push('arcade-weapon-state-missing-or-ambiguous');
        return done(code);
    }
    const stateFactory = stateFactories[0];
    const cooldowns = componentBodies(stateFactory[3]).flatMap(body => [...body.matchAll(new RegExp(`:\\s*${ID}\\s*\\(\\s*this\\.(${ID})\\.(${ID})\\s*\\(\\s*\\)\\s*,\\s*this\\.\\1\\.(${ID})\\s*\\)\\s*[,;]\\s*this\\.(${ID})\\s*=\\s*${ID}`, 'g'))]);
    const comparisons = componentBodies(stateFactory[3]).flatMap(body => [...body.matchAll(new RegExp(`(${ID})\\s*\\(\\s*this\\.${escape(cooldowns[0]?.[1] || '')}\\.${escape(cooldowns[0]?.[2] || '')}\\s*\\(\\s*\\)\\s*,\\s*this\\.${escape(cooldowns[0]?.[4] || '')}\\s*\\)\\s*>=\\s*0`, 'g'))]);
    if (cooldowns.length !== 1 || comparisons.length !== 1) {
        status.issues.push('shaft-cooldown-missing-or-ambiguous');
        return done(code);
    }
    const cooldown = cooldowns[0];
    const optional = (type: string) => `__kaspEntity.${lookup[1]}(${lookup[2] ? `${lookup[2]}(${type})` : type})`;
    const show = visibility[3];
    const remove = cleanup[0].match![2];
    const dispose = (target: string) => `if(${target}.__kaspArcadeReloadBar){${attachment[4]}(${target}).${remove}(${target}.__kaspArcadeReloadBar);${target}.__kaspArcadeReloadBar=null}`;
    const notify = `if(window.__kaspArcadeReloadDebug&&window.__kaspArcadeReloadDebug.observe)window.__kaspArcadeReloadDebug.observe({weapon:__kaspShaft?"Shaft":__kaspScorpio?"Scorpio":null,progress:__kaspOwner.__kaspArcadeProgress,barCreated:!!__kaspBar,visible:!!__kaspBar&&__kaspOwner.__kaspArcadeProgress!=null&&!__kaspOwner.__kaspArcadeReloadFailed&&__kaspOwner.__kaspArcadeHudVisible!==false})`;
    const update = `function(){var __kaspOwner=this;try{` +
        `if(__kaspOwner.__kaspArcadeReloadFailed||!__kaspOwner.${barField})return;` +
        `var __kaspEntity=${localTanks[0][1]}(__kaspOwner.${world[1]}()),__kaspBar=__kaspOwner.__kaspArcadeReloadBar;` +
        `var __kaspProgress=null,__kaspShaft=null,__kaspScorpio=null;if(__kaspEntity){` +
        `var __kaspShaft=${optional(shaft.type)},__kaspScorpio=${optional(scorpio.type)};` +
        `if(__kaspScorpio)__kaspProgress=__kaspScorpio.${scorpioProgress[0][1]};` +
        `else if(__kaspShaft){var __kaspState=__kaspShaft.${activeStates[0][2]};` +
        `if((__kaspShaft.${frozenStates[0][1]}||__kaspShaft.${frozenStates[0][2]})&&__kaspOwner.__kaspArcadeWeapon===__kaspShaft)__kaspProgress=__kaspOwner.__kaspArcadeProgress;` +
        `else __kaspProgress=__kaspState instanceof ${stateFactory[3]}&&${comparisons[0][1]}(__kaspShaft.${cooldown[2]}(),__kaspState.${cooldown[4]})<0?` +
        `1-${progressHelper.divide}(${progressHelper.subtract}(__kaspState.${cooldown[4]},__kaspShaft.${cooldown[2]}()),__kaspShaft.${cooldown[3]}):1}}` +
        `if(typeof __kaspProgress!=="number"||!Number.isFinite(__kaspProgress)){__kaspOwner.__kaspArcadeWeapon=null;__kaspOwner.__kaspArcadeProgress=null;if(__kaspBar)__kaspBar.${show}(!1);${notify};return}` +
        `__kaspOwner.__kaspArcadeWeapon=__kaspShaft||__kaspScorpio;__kaspOwner.__kaspArcadeProgress=Math.max(0,Math.min(1,__kaspProgress));` +
        `if(!__kaspBar)__kaspBar=__kaspOwner.__kaspArcadeReloadBar=__kaspOwner.__kaspArcadeHudCreate();` +
        `__kaspBar.${show}(__kaspOwner.__kaspArcadeHudVisible!==false);` +
        `__kaspBar.${setProgress}(__kaspOwner.__kaspArcadeProgress);` +
        `__kaspOwner.__kaspArcadeHudSync();${notify}` +
        `}catch(__kaspError){__kaspOwner.__kaspArcadeReloadFailed=!0;try{var __kaspBar=__kaspOwner.__kaspArcadeReloadBar;if(__kaspBar)__kaspBar.${show}(!1);window.__kaspArcadeReloadDebug.reportError(String(__kaspError))}catch(__kaspIgnored){}}}`;
    const sync = `function(){try{var b=this.__kaspArcadeReloadBar,o=this.${barField};if(this.__kaspArcadeReloadFailed||!b||!o)return;` +
        `b.${dimensions[0][3]}(o.${widthGetters[0]}());b.${dimensions[0][4]}(o.${heightGetters[0]}());` +
        `b.${placement[0][1]}(o.${placement[0][4]},o.${heightGetters[0]}());` +
        `b.${show}(this.__kaspArcadeHudVisible!==false&&this.__kaspArcadeProgress!=null)` +
        `}catch(e){this.__kaspArcadeReloadFailed=true;try{if(b)b.${show}(false);if(window.__kaspArcadeReloadDebug)window.__kaspArcadeReloadDebug.reportError(String(e))}catch(ignored){}}}`;
    const projection = projections[0];
    const project = `b.${projection.method}=function(view,rect){try{var base=__kaspOwner.${barField};` +
        `base.${projection.method}(view,rect);rect.${projection.y}+=rect.${projection.height}` +
        `}catch(e){rect.${projection.width}=0;rect.${projection.height}=0;__kaspOwner.__kaspArcadeReloadFailed=true;` +
        `try{b.${show}(false);window.__kaspArcadeReloadDebug.reportError(String(e))}catch(ignored){}}};`;
    const factoryPatch = `,(function(__kaspOwner){try{${dispose('__kaspOwner')};` +
        `__kaspOwner.__kaspArcadeReloadFailed=false;__kaspOwner.__kaspArcadeProgress=null;__kaspOwner.__kaspArcadeWeapon=null;` +
        `__kaspOwner.__kaspArcadeHudCreate=function(){var b=${arcadeFactory};${attachment[1]}(b,${attachment[2]});${project}b.${show}(false);${attachment[4]}(__kaspOwner).${attachment[6]}(b);return b};` +
        `__kaspOwner.__kaspArcadeHudSync=${sync};__kaspOwner.__kaspArcadeHudUpdate=${update};__kaspOwner.__kaspArcadeHudUpdate()` +
        `}catch(e){if(window.__kaspArcadeReloadDebug)window.__kaspArcadeReloadDebug.reportError(String(e))}})(${owner})`;
    const edits: { index: number; text: string }[] = [
        { index: init.header.index! + factoryEnd + attachment.index + attachment[0].length, text: factoryPatch },
        { index: init.header.index! + frame.index + frame[0].length, text: `,(${frame[2]}.__kaspArcadeHudUpdate&&${frame[2]}.__kaspArcadeHudUpdate())` },
        { index: visibility.index + visibility[0].length, text: `,${visibility[2]}.__kaspArcadeHudVisible=!!${visibility[4]},(${visibility[2]}.__kaspArcadeHudSync&&${visibility[2]}.__kaspArcadeHudSync())` },
        { index: cleanup[0].end - 1, text: `;try{${dispose('this')};this.__kaspArcadeHudCreate=null;this.__kaspArcadeHudUpdate=null;this.__kaspArcadeHudSync=null;this.__kaspArcadeWeapon=null;this.__kaspArcadeProgress=null}catch(e){}` }
    ];
    if (suppliesSibling && supplyLayout && centeredFlags.length === 1) {
        const hudToken = suppliesSibling[4] ? `${suppliesSibling[4]}(${hudType![1] || hudType![2]})` : hudType![1] || hudType![2];
        const supplyShift = `(function(owner){try{if(!owner.${centeredFlags[0][1]})return 0;` +
            `var hud=owner.${suppliesSibling[2]}().${suppliesSibling[3]}(${hudToken}),bar=hud&&hud.__kaspArcadeReloadBar;` +
            `return bar&&hud.__kaspArcadeWeapon&&hud.__kaspArcadeProgress!=null&&!hud.__kaspArcadeReloadFailed&&hud.__kaspArcadeHudVisible!==false?bar.${heightGetters[0]}():0` +
            `}catch(e){return 0}})(this)`;
        const call = supplyLayout.call;
        const args = argumentList(call[0].slice(call[0].indexOf('(') + 1, -1));
        const offsetAt = call[0].indexOf(args[4], call[0].indexOf(args[3]) + args[3].length);
        edits.push({ index: supplyLayout.header.index! + call.index! + offsetAt, text: '(' });
        edits.push({ index: supplyLayout.header.index! + call.index! + offsetAt + args[4].length, text: `+${supplyShift})` });
    } else status.issues.push('centered-supplies-layout-missing-or-ambiguous');
    for (const method of methods) {
        if (method.header === init.header || method.header === cleanup[0].header) continue;
        if (method.body.includes(`this.${barField}`) || /onLayoutSizeChanged/.test(method.body))
            edits.push({ index: method.end - 1, text: ';if(this.__kaspArcadeHudSync)this.__kaspArcadeHudSync()' });
    }
    const resizeMethod = layoutMethods[0];
    if (!edits.some(edit => edit.index === resizeMethod.end - 1))
        edits.push({ index: resizeMethod.end - 1, text: ';if(this.__kaspArcadeHudSync)this.__kaspArcadeHudSync()' });
    let patched = code;
    for (const edit of edits.sort((a, b) => b.index - a.index)) patched = patched.slice(0, edit.index) + edit.text + patched.slice(edit.index);
    status.hooked = true;
    status.panel = 'local-hud';
    return done(patched);
}
