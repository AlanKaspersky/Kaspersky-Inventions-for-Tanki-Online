const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');

const moduleRef = { exports: {} };
vm.runInNewContext(transformSync(fs.readFileSync(path.join(__dirname, '../src/core/arcadeReload.ts'), 'utf8'), {
    loader: 'ts', format: 'cjs'
}).code, { module: moduleRef, require: () => require('./test-client-patches.cjs') });
const { analyzeArcade } = require('./arcade-ast.cjs');
const patchArcadeReload = (source, report, plan) => moduleRef.exports.patchArcadeReload(source, report, plan || analyzeArcade(source));

const source = `
function Title() {this.nicknameAllowed=true;this.counter={toggle(){}}}
function LocalHud(){this.weaponBar=null;var t=this;this.setVisible=function(n){return function(t,n){var i=t.weaponBar;null==i||i.show(n)}(t,n)}}
function Shaft() {}
function Scorpio() {}
function Reload() {}
function Sensor() {}
function Position() {}
function Supplies(){this.centered=true}
function ShaftOwner() {}
function ScorpioOwner() {}
function NativeMaterial(context,foreground,background,border){this.context=context;this.foreground=foreground;this.background=background;this.border=border}
function color(rgb){return {rgb:rgb}}
function ShaftCooldown() {}
function proto(type) { return type.prototype; }
function token(type) { return type; }
function missing(label) { throw Error(label); }
function shaftGetter(t) { var n=t.shaft; if(null!=n)return n; missing('shaftWeapon') }
function scorpioGetter(t) { var n=t.scorpio; if(null!=n)return n; missing('scorpioWeapon') }
function reloadGetter(t) { var n=t.reload; if(null!=n)return n; missing('reloadTimeComponent') }
proto(ShaftOwner).init=function(){this.shaft=this.entity().required(token(Shaft))};
proto(ScorpioOwner).init=function(){this.scorpio=this.entity().required(token(Scorpio))};
proto(Sensor).init=function(){this.reload=this.entity().required(token(Reload))};
proto(Position).init=function(){this.hud=this.entity().optional(token(LocalHud));this.supplies=this.entity().optional(token(Supplies));var provider=function(){};provider.callableName='provideDefaultTitlePosition'};
proto(Supplies).position=function(x,y){placeRow(0,x,y,this.upper.values(),-54,x,y),placeRow(0,x,y,this.lower.values(),8,x,y)};
proto(Supplies).tick=function(){this.centered?this.disabled||this.hide():placeRow(0,0,0,this.lower.values(),-54,0,0)};
function localTank(t) { return t.find('LocalTank') }
function nativeProgress(t){var n,i=t.world().clock();if(compare(reloadGetter(t).end,i)>0){var r=subtract(reloadGetter(t).end,i);n=1-ratio(r,reloadGetter(t).duration)}else n=1;return n}
function compare(a,b){return a-b}
function subtract(a,b){return a-b}
function ratio(a,b){return a/b}
function add(a,b){return a+b}
proto(Shaft).prepare=function(){var t=this,m=this.machine;t.cooldown=m.register(new ShaftCooldown(t))};
proto(Shaft).tick=function(){this.stunned||this.paused||recharge(this,1);var t=this.active;null==t||t.advance()};
proto(ShaftCooldown).enter=function(message){var n=message?this.deadline:add(this.weapon.clock(),this.weapon.reloadDuration);this.deadline=n};
proto(ShaftCooldown).advance=function(){compare(this.weapon.clock(),this.deadline)>=0&&(this.weapon.ready(),true)};
function scorpioGain(w,time){return time/80}
proto(Scorpio).canShoot=function(time){return this.primary+scorpioGain(this,time)>=1};
function NativeBar(w,h,material,layer){allocate();this.material=material;this.layer=layer;this.shown=true;this.progressValue=0;this.setWidth(w),this.setHeight(h);this.vector={x:0,y:0,z:.5};this.anchorX=.5;this.anchorY=1}
proto(NativeBar).setWidth=function(t){this.widthValue=Math.max(0,t)};
proto(NativeBar).setHeight=function(t){this.heightValue=Math.max(0,t)};
proto(NativeBar).width=function(){return this.widthValue};
proto(NativeBar).isShown=function(){return this.shown};
proto(NativeBar).height=function(){return this.heightValue};
proto(NativeBar).place=function(t,n){move(this,t.x,t.y+n),this.vector.z=t.z,this.anchorX=t.x,this.anchorY=t.y};
proto(NativeBar).fill=function(t){this.progressValue=t};
proto(NativeBar).show=function(t){this.shown=t};
proto(NativeBar).project=function(view,rect){rect.left=view.scale*this.vector.x+(1-view.scale)*this.anchorX;rect.top=view.scale*this.vector.y+(1-view.scale)*this.anchorY;rect.w=this.widthValue*view.scale;rect.h=this.heightValue*view.scale};
proto(NativeBar).renderer=function(){return new Renderer(this)};
function Renderer(bar){this.bar=bar}
proto(Renderer).draw=function(frame,scene){this.bar.project(scene.view,shared().rect),this.bar.material.paint(shared().rect.left,shared().rect.top,this.bar.vector.z,shared().rect.w,shared().rect.h,this.bar.progressValue)};
function move(t,x,y){t.vector.x=x;t.vector.y=y}
function layer(t,l){t.layer=l}
function hudScene(t){return t.scene}
proto(LocalHud).init=function(){
    this.scene=hudScene(this.world());
    var t=this;
    var layout=function(n){var i,r,e;return r=n,null==(e=(i=t).weaponBar)||i.resize(e,r.view),true};
    layout.callableName='onLayoutSizeChanged';this.onLayout=layout;
    this.create=function(){return function(t,n){
        t.material=new NativeMaterial(1,color(16776960),color(3158064),.6);
        var r=rectangle(),e=r.layer(),u=new NativeBar(r.width(),r.height(),function(t){var n=t.material;if(null!=n)return n;missing('progressBarMaterial')}(t),'native layer');
        layer(u,e),u.fill(n),hudScene(t).add(u),t.weaponBar=u;
    }(t,1),true};
    this.receive=function(n){var i,r,e;return i=t,r=Event.progress,null==(e=i.weaponBar)||e.fill(r),true};
};
proto(LocalHud).dispose=function(){var t=this.weaponBar;null==t||hudScene(this).remove(t)};
proto(LocalHud).resize=function(t,n){t.setWidth(n.width),t.setHeight(n.height),move(t,n.x,n.y)};
proto(LocalHud).position=function(t,n){var e=this.weaponBar;null==e||move(e,t,n)};
function NativeName(){this.shown=true}
NativeName.prototype=Object.create(NativeBar.prototype);
function nativeAlive(state){return state==='ACTIVE'}
proto(Title).init=function(){this.healthBar='health';this.weaponBar='weapon';var cb=function(){};cb.callableName='configureBars';var caption=this.caption;if(caption==null){var mesh=new NativeName;caption=mesh;this.caption=caption}this.onState=function(event){return this.counter.toggle(1,!nativeAlive(event.lifeState)),true}};
proto(Title).frame=function(time,delta){if(this.caption)this.caption.show(this.nicknameAllowed)};
`;

function fixture({ renamed = false, minified = false, failExtra = false, initialWeapon = 'Shaft', preparedPlan, prefix = '' } = {}) {
    const identifiers = ['Title', 'LocalHud', 'Shaft', 'Scorpio', 'Reload', 'Sensor', 'ShaftOwner', 'ScorpioOwner', 'proto', 'token',
        'shaft', 'scorpio', 'reload', 'entity', 'required', 'optional', 'world', 'clock', 'end', 'duration', 'weaponBar',
        'show', 'place', 'height', 'fill', 'nativeProgress', 'reloadGetter', 'ShaftCooldown', 'cooldown', 'deadline', 'weapon',
        'reloadDuration', 'active', 'stunned', 'paused', 'primary', 'NativeBar', 'find', 'scene', 'add', 'remove', 'setWidth',
        'setHeight', 'widthValue', 'heightValue', 'width', 'vector', 'move', 'x', 'y', 'z', 'resize', 'position', 'material',
        'Renderer', 'bar', 'project', 'view', 'rect', 'left', 'top', 'w', 'h', 'scale',
        'Position', 'Supplies', 'supplies', 'centered', 'upper', 'lower', 'values', 'placeRow', 'NativeMaterial', 'color'];
    const rename = name => renamed && identifiers.includes(name) ? '$' + name + '$' : name;
    let input = renamed ? source.replace(new RegExp('\\b(' + identifiers.join('|') + ')\\b', 'g'), match => rename(match)) : source;
    if (minified) input = transformSync(input, { loader: 'js', minify: true }).code;
    // Public diagnostic labels are data, not native identifier names.
    input = input.replace(/(['"])\$weapon\$\1/g, (_, quote) => quote + 'weapon' + quote);
    input = prefix + input;
    const reports = [];
    const patched = patchArcadeReload(input, status => reports.push(status), preparedPlan);
    assert.equal(reports[0].hooked, true, JSON.stringify(reports[0]));
    assert.equal(reports[0].panel, 'local-hud');
    const errors = [], observations = [], children = [];
    let now = 100, scale = 1, local = true, allocations = 0;
    const scene = { [rename('add')]: row => children.push(row), [rename('remove')]: row => {
        const index = children.indexOf(row); if (index >= 0) children.splice(index, 1);
    } };
    const context = { allocate() { if (failExtra && ++allocations > 1) throw Error('native resource failure'); },
        rectangle: () => ({ [rename('width')]: () => 200 * scale, [rename('height')]: () => 6 * scale, layer: () => 'native layer' }),
        Event: { progress: .65 }, window: { __kaspArcadeReloadDebug: {
            reportError: message => errors.push(message), observe: sample => observations.push(sample)
        } }, [rename('placeRow')]: (_, x, y, row, offset) => { for (const icon of row) icon.y = y + offset; } };
    vm.runInNewContext(patched, context);
    const cooldown = new context[rename('ShaftCooldown')](); cooldown[rename('deadline')] = 160;
    const shaft = { [rename('cooldown')]: 3, [rename('active')]: cooldown,
        [rename('reloadDuration')]: 80, [rename('clock')]: () => now, [rename('stunned')]: false, [rename('paused')]: false };
    const scorpio = { [rename('primary')]: .25 };
    const reload = {
        get duration() { return shaft[rename('reloadDuration')]; }, set duration(value) { shaft[rename('reloadDuration')] = value; },
        get end() { return cooldown[rename('deadline')]; }, set end(value) { cooldown[rename('deadline')] = value; }
    };
    const components = new Map(initialWeapon ? [[context[rename(initialWeapon)], initialWeapon === 'Shaft' ? shaft : scorpio]] : []);
    const tank = { [rename('optional')]: type => components.get(type) || null };
    const world = { [rename('clock')]: () => now, [rename('find')]: () => local ? tank : null, [rename('scene')]: scene };
    const owner = new context[rename('LocalHud')]();
    Object.assign(owner, { [rename('world')]: () => world, [rename('material')]: { color: 'native yellow' } });
    owner.init(); owner.create();
    const upperIcons = [{}], lowerIcons = [{}];
    const supplies = new context[rename('Supplies')]();
    Object.assign(supplies, { [rename('entity')]: () => ({ [rename('optional')]: type => type === context[rename('LocalHud')] ? owner : null }),
        [rename('upper')]: { [rename('values')]: () => upperIcons }, [rename('lower')]: { [rename('values')]: () => lowerIcons } });
    return {
        input, patched, owner, errors, observations, children, reload, supplies, upperIcons, lowerIcons,
        get weapon() { return owner[rename('weaponBar')]; },
        get extra() { return owner.__kaspArcadeReloadBar; },
        tick: () => owner.receive(), setTime(value) { now = value; }, setVisible: value => owner.setVisible(value),
        resize(width, height, x, y) { owner.onLayout({ [rename('view')]: { [rename('width')]: width, [rename('height')]: height, [rename('x')]: x, [rename('y')]: y } }); },
        position(x, y) { owner[rename('position')](x, y); },
        setLocal(value) { local = value; },
        setCentered(value) { supplies[rename('centered')] = value; },
        placeSupplies(x, y) { supplies[rename('position')](x, y); },
        equip(name) {
            components.delete(context[rename('Shaft')]); components.delete(context[rename('Scorpio')]);
            if (name) components.set(context[rename(name)], name === 'Shaft' ? shaft : scorpio);
        },
        removeReload() { shaft[rename('reloadDuration')] = NaN; scorpio[rename('primary')] = undefined; },
        setScorpioProgress(value) { scorpio[rename('primary')] = value; },
        freeze(value) { shaft[rename('stunned')] = value; }, pause(value) { shaft[rename('paused')] = value; },
        setReloadActive(value) { shaft[rename('active')] = value ? cooldown : null; },
        project(bar, scale) {
            const rect = {}; bar[rename('project')]({ [rename('scale')]: scale }, rect);
            return Object.fromEntries(['left', 'top', 'w', 'h'].map(key => [key, rect[rename(key)]]));
        },
        value(bar, name) { return bar[rename(name)]; },
        title() { const title = new context[rename('Title')](); title.init(); return title; }
    };
}

test('local HUD clones its native mesh and reads primary cooldown independently of the original charge', () => {
    const f = fixture(); f.tick();
    assert.equal(f.extra.constructor, f.weapon.constructor);
    assert.notEqual(f.extra.material, f.weapon.material, 'the added row has an independent native material');
    assert.equal(f.extra.material.constructor, f.weapon.material.constructor);
    assert.equal(f.extra.material.foreground.rgb, 0xffbb1c);
    assert.equal(f.weapon.material.foreground.rgb, 0xffff00, 'native yellow indicator stays unchanged');
    assert.equal(f.extra.material.background.rgb, f.weapon.material.background.rgb);
    assert.equal(f.extra.material.border, f.weapon.material.border);
    assert.equal(f.extra.layer, f.weapon.layer);
    assert.equal(f.extra.widthValue, 200); assert.equal(f.extra.heightValue, 6);
    assert.equal(f.extra.progressValue, .25); assert.equal(f.weapon.progressValue, .65);
    const originalTitle = f.title();
    assert.equal(originalTitle.healthBar, 'health'); assert.equal(originalTitle.weaponBar, 'weapon');
    assert.equal(originalTitle.__kaspArcadeReloadBar, undefined, 'other tanks title renderer stays untouched');
    const extra = f.extra;
    f.setTime(140); f.tick(); assert.equal(extra.progressValue, .75);
    f.reload.end = 150; f.reload.duration = 20; f.tick(); assert.equal(extra.progressValue, .5);
    f.setTime(150); f.tick(); assert.equal(extra.progressValue, 1);
    assert.equal(f.extra, extra); assert.equal(f.children.length, 2);
    assert.equal(f.observations.at(-1).barCreated, true);
});

test('only local Shaft and Scorpio show the extra row and missing native telemetry hides it', () => {
    const unsupported = fixture({ initialWeapon: null }); unsupported.tick();
    assert.equal(unsupported.extra, undefined); assert.equal(unsupported.children.length, 1);
    const f = fixture();
    f.equip(null); f.tick(); assert.equal(f.extra.shown, false);
    f.equip('Scorpio'); f.tick(); assert.equal(f.extra.progressValue, .25); assert.equal(f.extra.shown, true);
    f.setScorpioProgress(.6); f.tick(); assert.equal(f.extra.progressValue, .6);
    f.setLocal(false); f.tick(); assert.equal(f.extra.shown, false);
    f.setLocal(true); f.equip('Shaft'); f.tick(); assert.equal(f.extra.shown, true);
    f.removeReload(); f.tick(); assert.equal(f.extra.shown, false);
    assert.equal(f.children.length, 2);
});

test('renaming and minification retain local HUD discovery and primary cooldown', () => {
    for (const config of [{ renamed: true }, { minified: true }, { renamed: true, minified: true }]) {
        const f = fixture(config); f.equip('Scorpio'); f.tick();
        assert.equal(f.extra.progressValue, .25); assert.equal(f.weapon.progressValue, .65);
        assert.equal(f.value(f.extra, 'material').foreground.rgb, 0xffbb1c);
        assert.equal(f.value(f.weapon, 'material').foreground.rgb, 0xffff00);
        f.resize(310, 10, 70, 130);
        assert.equal(f.value(f.extra, 'widthValue'), 310);
        assert.equal(f.value(f.extra, 'heightValue'), 10);
        assert.equal(f.value(f.value(f.extra, 'vector'), 'y'), 140);
        assert.equal(patchArcadeReload(f.patched), f.patched);
    }
});

test('extra row follows both projected positioning and fixed HUD resize, including native visibility', () => {
    const f = fixture();
    f.position(45, 100);
    assert.deepEqual({ ...f.extra.vector }, { x: 45, y: 106, z: .5 });
    f.resize(300, 9, 80, 150);
    assert.equal(f.extra.widthValue, 300); assert.equal(f.extra.heightValue, 9);
    assert.deepEqual({ ...f.extra.vector }, { x: 80, y: 159, z: .5 });
    f.setVisible(false); assert.equal(f.weapon.shown, false); assert.equal(f.extra.shown, false);
    f.setTime(140); f.tick(); assert.equal(f.extra.shown, false);
    f.setVisible(true); assert.equal(f.extra.shown, true); assert.equal(f.extra.progressValue, .75);
});

test('screen-space placement preserves alignment for centered and tank-following HUD at all UI scales', () => {
    for (const config of [{}, { renamed: true }, { minified: true }, { renamed: true, minified: true }]) {
        const f = fixture(config);
        for (const scale of [.75, 1, 1.25, 1.5]) {
            for (const [width, height, x, y] of [[140, 12, 400, 200], [304, 10, 30, 420]]) {
                f.resize(width, height, x, y);
                const base = f.project(f.weapon, scale), extra = f.project(f.extra, scale);
                assert.equal(extra.left, base.left, 'native HUD anchors must not shift the extra row sideways');
                assert.equal(extra.w, base.w); assert.equal(extra.h, base.h);
                assert.equal(extra.top, base.top + base.h);
                assert.equal(f.errors.length, 0);
            }
        }
    }
});

test('lower supply icons reserve one added row only for centered HUD with a visible supported weapon', () => {
    for (const config of [{}, { renamed: true }, { minified: true }, { renamed: true, minified: true }]) {
        const f = fixture(config);
        for (const weapon of ['Shaft', 'Scorpio']) {
            f.equip(weapon); f.tick(); f.setCentered(true);
            f.placeSupplies(45, 100); assert.equal(f.lowerIcons[0].y, 114);
            f.placeSupplies(45, 100); assert.equal(f.lowerIcons[0].y, 114, 'repeated frames must not accumulate an offset');
            assert.equal(f.upperIcons[0].y, 46, 'the upper status row keeps its native position');
            f.resize(300, 12, 45, 100); f.placeSupplies(45, 100); assert.equal(f.lowerIcons[0].y, 120);
            f.resize(200, 6, 45, 100);
            f.setCentered(false); f.placeSupplies(45, 100); assert.equal(f.lowerIcons[0].y, 108);
        }
        f.setCentered(true); f.setVisible(false); f.placeSupplies(45, 100); assert.equal(f.lowerIcons[0].y, 108);
        f.setVisible(true); f.equip(null); f.tick(); f.placeSupplies(45, 100); assert.equal(f.lowerIcons[0].y, 108);
        assert.equal(f.errors.length, 0);
    }
});

test('native lifecycle removes the added mesh and recreates exactly once after HUD reinitialization', () => {
    const f = fixture(); const extra = f.extra;
    f.owner.dispose(); assert.equal(f.children.length, 0); assert.equal(f.extra, null);
    f.owner.init(); f.owner.create(); f.tick();
    assert.equal(f.children.length, 2); assert.notEqual(f.extra, extra);
    f.owner.create(); f.tick();
    assert.equal(f.children.filter(row => row === f.extra).length, 1);
    assert.equal(f.children.includes(extra), false);
});

test('Shaft stun and pause retain cooldown until the game updates its deadline on resume', () => {
    for (const freeze of ['freeze', 'pause']) {
        const f = fixture(); f.tick();
        f[freeze](true); f.setReloadActive(false); f.setTime(140); f.tick(); assert.equal(f.extra.progressValue, .25);
        f[freeze](false); f.setReloadActive(true); f.reload.end = 200; f.tick(); assert.equal(f.extra.progressValue, .25);
        f.setTime(180); f.tick(); assert.equal(f.extra.progressValue, .75);
        f.setReloadActive(false); f.tick(); assert.equal(f.extra.progressValue, 1);
    }
});

test('native resource and telemetry failures do not interrupt original progress events', () => {
    const failed = fixture({ failExtra: true }); failed.tick(); failed.tick();
    assert.equal(failed.weapon.progressValue, .65); assert.equal(failed.errors.length, 1);
    const invalid = fixture(); invalid.tick(); invalid.reload.end = Infinity; invalid.tick();
    assert.equal(invalid.extra.shown, false); assert.equal(invalid.weapon.progressValue, .65);
    assert.equal(invalid.observations.at(-1).visible, false);
});

test('missing or ambiguous native contracts remain unchanged with diagnostics', () => {
    for (const input of ['console.log("hello")', source.replace('progressBarMaterial', 'changedMaterial'),
        source.replace('scorpioWeapon', 'changedWeapon'), source + 'function duplicate(t){return t.find("LocalTank")}']) {
        let status;
        assert.equal(patchArcadeReload(input, value => { status = value; }), input);
        assert.equal(status.hooked, false); assert.ok(status.issues.length > 0);
    }
});

test('prepared AST templates adapt to renamed game contracts without regenerating the plan', async () => {
    for (const minified of [false, true]) {
        const old = fixture({ minified });
        const updated = fixture({ renamed: true, minified, prefix: '/* another client release */\n' });
        const adapted = await moduleRef.exports.selectArcadeReloadPlan(updated.input, [analyzeArcade(old.input)]);
        assert.ok(adapted, 'unknown builds must be tried against the prepared templates');
        assert.equal(adapted.status.strategy, 'ast-template');
        const f = fixture({ renamed: true, minified, prefix: '/* another client release */\n', preparedPlan: adapted });
        f.tick(); assert.equal(f.value(f.extra, 'progressValue'), .25);
        f.equip('Scorpio'); f.setScorpioProgress(.6); f.tick(); assert.equal(f.value(f.extra, 'progressValue'), .6);
        f.resize(310, 10, 70, 130);
        assert.equal(f.project(f.extra, 1.25).top, f.project(f.weapon, 1.25).top + f.project(f.weapon, 1.25).h);
        f.setCentered(true); f.placeSupplies(45, 100); assert.equal(f.lowerIcons[0].y, 118);
        f.setVisible(false); assert.equal(f.value(f.extra, 'shown'), false);
        f.owner.dispose(); assert.equal(f.children.length, 0);
        assert.equal(f.errors.length, 0);
    }
});

test('unsupported adaptive structures and stale edits leave the native game untouched', async () => {
    const plan = analyzeArcade(source);
    assert.equal(await moduleRef.exports.selectArcadeReloadPlan(source.replace('progressBarMaterial', 'removedBar'), [plan]), undefined);
    const bad = { ...plan, edits: plan.edits.map((e,i) => i===2 ? { ...e, before:'stale' } : e) };
    let status;
    assert.equal(moduleRef.exports.patchArcadeReload(source,s=>{status=s},bad),source);
    assert.equal(status.hooked,false);assert.equal(status.issues[0],'arcade-edit-mismatch');
    const duplicate=source+'\n'+source.slice(source.indexOf("function localTank"),source.indexOf('function nativeProgress'));
    assert.equal(await moduleRef.exports.selectArcadeReloadPlan(duplicate,[plan]),undefined);
});

test('remote nickname and health rendering retains the original native code and behavior for every local weapon', () => {
    const native = {};
    vm.runInNewContext(source, native);
    for (const initialWeapon of ['Shaft', 'Scorpio', null]) {
        const f = fixture({ initialWeapon });
        const remote = f.title(), original = new native.Title(); original.init();
        for (const method of ['init', 'frame']) assert.equal(remote.constructor.prototype[method].toString(), native.Title.prototype[method].toString());
        for (const allowed of [false, true]) for (const state of ['SEMI_ACTIVE', 'ACTIVE', 'TELEPORT', 'DEAD_PHANTOM', 'DEAD']) {
            remote.nicknameAllowed = original.nicknameAllowed = allowed;
            remote.onState({ lifeState: state }); original.onState({ lifeState: state });
            remote.frame(0, 0); original.frame(0, 0);
            assert.equal(remote.caption.shown, original.caption.shown);
            assert.equal(remote.healthBar, original.healthBar); assert.equal(remote.weaponBar, original.weaponBar);
            assert.equal(Object.hasOwn(remote.caption, 'show'), false, 'native sprite visibility setter is not wrapped');
            assert.equal(Object.hasOwn(remote.caption, '__kaspSpawnNameGuard'), false);
            assert.equal(Object.hasOwn(remote, '__kaspNameplateGhost'), false);
        }
    }
});
