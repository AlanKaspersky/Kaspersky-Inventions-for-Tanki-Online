import { featureScope } from './featureRuntime';
import { clientSourceHash, resolveTemplateEdits, validatePatchEdits } from './clientPatches';
import type { PreparedPatchPlan } from './clientPatches';
import { readPageMessage } from './pageMessages';
import { gameDOM } from './gameDOM';

export interface BoxPickupPlan extends PreparedPatchPlan {
    format: 'ki-box-pickup-v1';
    status: { ready: boolean; issues: string[] };
}
export async function selectBoxPickupPlan(code: string, plans: readonly BoxPickupPlan[]): Promise<BoxPickupPlan | undefined> {
    const supported = plans.filter(plan => plan.format === 'ki-box-pickup-v1' && plan.status.ready);
    if (supported.some(plan => plan.sourceLength === code.length)) {
        const hash = await clientSourceHash(code);
        const exact = supported.find(plan => plan.sha256 === hash && plan.sourceLength === code.length);
        if (exact && validatePatchEdits(code, exact)) return exact;
    }
    for (const plan of [...supported].reverse()) {
        const adapted = resolveTemplateEdits(code, plan);
        if (adapted) return { ...plan, sourceLength: code.length, edits: adapted.edits };
    }
}
export const boxPickupPlanValid = (code: string, plan: BoxPickupPlan): boolean =>
    plan.format === 'ki-box-pickup-v1' && plan.status.ready && validatePatchEdits(code, plan);

// Visual parameters only. No supply amounts, pickup detection or rewards are changed.
export const BOX_PICKUP = Object.freeze({
    count: 14,             // Pieces emitted by one pickup.
    maxShards: 140,        // Hard scene-wide limit; oldest pieces are returned first.
    fadeStart: 2.2,        // Seconds before the pieces start fading.
    fadeDuration: .8,      // Seconds spent fading and shrinking.
    gravity: 2400,        // Visual acceleration in world units per second squared.
    speedHMin: 350, speedHMax: 950, // Horizontal launch speed range.
    speedVMin: 650, speedVMax: 1500, // Vertical launch speed range.
    boxHalf: 50,           // Native box half-size used to size pieces.
    groundOffset: 75,      // Ground fallback when the collision ray is unavailable.
    flashSec: .22,         // Duration of the picked-up box flash.
    glowSec: .7,           // Time for the orange tint to cool to the native color.
    bounce: .36,          // Fraction of vertical speed retained after a bounce.
    rayBudget: 6,          // Maximum terrain probes per animation frame.
    rayInterval: 100       // Minimum milliseconds between probes for one piece.
});

// These private native fields are supplied by the validated offline AST contract.
type Native = Record<string, unknown>;
const child = (object: Native, key: string): Native => object[key] as Native;
const invoke = (object: Native, key: string, ...args: unknown[]): unknown =>
    (object[key] as (...values: unknown[]) => unknown).apply(object, args);
const disposeGeometry = (geometry?: Native) => { if (typeof geometry?.dispose === 'function') invoke(geometry, 'dispose'); };
export type BoxSchema = Record<'box' | 'callback' | 'world' | 'render' | 'rotation' | 'position' | 'vectorSet' |
    'x' | 'y' | 'z' | 'scale' | 'pool' | 'release' | 'attach' | 'detach' | 'reset' | 'material' |
    'colorReset' | 'glow' | 'colorSet' | 'uniformScale' | 'opacity' | 'acquire' | 'ray' | 'rayPosition' | 'rayReset', string>;
interface Piece {
    box: Native; schema: BoxSchema; world: Native; born: number;
    x: number; y: number; z: number; vx: number; vy: number; vz: number;
    rx: number; ry: number; rz: number; wx: number; wy: number; wz: number;
    tx: number; ty: number; sx: number; sy: number; sz: number;
    ground: number; probeAt: number; landed: boolean; rest: boolean; released: boolean;
    restoreGeometry?: () => void;
}
interface Flash { box: Native; schema: BoxSchema; born: number; }
const random = (min: number, max: number) => min + Math.random() * (max - min);
const wrap = (value: number) => Math.atan2(Math.sin(value), Math.cos(value));

/** Uses native pooled renderers and native opacity, and restores owned geometry before pooling. */
export function installBoxPickup(page: Window) {
    const scope = featureScope('boxPickup', { budgetMs: 4 });
    const pieces: Piece[] = [], flashes = new Map<Native, Flash>();
    const meshes = new WeakMap<object, Native | null>();
    let enabled = false, frame = 0, last = 0, world: Native | null = null;
    let canvas: Element | null = null, hitType: (new () => Native) | null = null;
    let hit: Native | null = null, origin: Native | null = null, direction: Native | null = null;
    let rayDisabled = false, rays = 0;
    const stats = { spawned: 0, released: 0, pickups: 0 };
    const tint = (box: Native, s: BoxSchema, glow: number, green = .78, blue = .35) => {
        invoke(child(child(box, s.material), s.glow), s.colorSet, glow, glow * green, glow * blue, 0);
    };
    const restoreFlash = (record: Flash) => {
        try { invoke(record.box, record.schema.uniformScale, 1); invoke(record.box, record.schema.opacity, 1); tint(record.box, record.schema, 0); }
        catch { /* Native disposal may already have removed the renderer. */ }
    };
    const remove = (piece: Piece) => {
        if (piece.released) return;
        piece.released = true;
        try { invoke(piece.box, piece.schema.detach); } catch { }
        try { piece.restoreGeometry?.(); } catch { }
        try { invoke(piece.box, piece.schema.colorReset, null); } catch { }
        try { invoke(piece.box, piece.schema.release); } catch { }
        stats.released++;
    };
    const clear = () => {
        if (frame) { scope.cancelFrame(frame); frame = 0; }
        for (const piece of pieces.splice(0)) remove(piece);
        for (const record of flashes.values()) restoreFlash(record);
        flashes.clear(); world = null; canvas = null;
        hit = origin = direction = null; rayDisabled = false;
    };
    const sync = () => {
        let next = false;
        try { next = localStorage.getItem('k_box_pickup') === 'true'; } catch { }
        if (enabled && !next) clear();
        enabled = next;
    };
    scope.listen(page, 'kasp:settings-changed', sync);
    scope.listen(page, 'storage', sync);
    scope.interval(sync, 500);
    scope.listen(page, 'pagehide', clear);
    scope.listen(page, 'message', event => {
        const message = readPageMessage(event, page, 'kasp:battle-presence');
        if (message && !message.battle) clear();
    });
    scope.onCleanup(clear);
    sync();

    // Optional geometry adaptation is bounded and cached per renderer. Native engines
    // without BufferGeometry keep the original low-poly box fragments.
    const findMesh = (root: Native): Native | null => {
        if (meshes.has(root)) return meshes.get(root)!;
        const queue: Array<[Native, number]> = [[root, 0]], seen = new Set<object>();
        for (let at = 0; at < queue.length && at < 100; at++) {
            const [object, depth] = queue[at];
            if (!object || seen.has(object)) continue;
            seen.add(object);
            const geometry = object.geometry as Native | undefined;
            if ((geometry?.attributes as Native | undefined)?.position && typeof geometry?.setAttribute === 'function') {
                meshes.set(root, object); return object;
            }
            if (depth >= 5) continue;
            // Descriptors avoid invoking arbitrary engine getters while searching.
            for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(object))) {
                if (/parent|world|scene|pool|material|geometry|texture|renderer/i.test(key) || !('value' in descriptor)) continue;
                const value = descriptor.value;
                if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) continue;
                if (Array.isArray(value)) {
                    if (/children|objects|meshes|parts|nodes/i.test(key)) for (const item of value.slice(0, 24))
                        if (item && typeof item === 'object' && queue.length < 100) queue.push([item, depth + 1]);
                } else if (queue.length < 100) queue.push([value, depth + 1]);
            }
        }
        meshes.set(root, null); return null;
    };
    const shape = (root: Native, sides: number): (() => void) | undefined => {
        const mesh = findMesh(root);
        if (!mesh) return;
        const original = mesh.geometry as Native;
        let owned: Native | undefined;
        try {
            const Geometry = original.constructor as new () => Native;
            owned = new Geometry();
            const Attribute = child(child(original, 'attributes'), 'position').constructor as new (data: Float32Array, size: number) => unknown;
            const outline = Array.from({ length: sides }, (_, i) => {
                const angle = i * 2 * Math.PI / sides + random(-.19, .19), radius = random(.3, .57);
                return [Math.cos(angle) * radius, Math.sin(angle) * radius];
            });
            const vertices: number[] = [], depth = random(.12, .24);
            for (let i = 0; i < sides; i++) {
                const a = outline[i], b = outline[(i + 1) % sides];
                vertices.push(0,0,depth, ...a,depth, ...b,depth, 0,0,-depth, ...b,-depth, ...a,-depth,
                    ...a,depth, ...a,-depth, ...b,-depth, ...a,depth, ...b,-depth, ...b,depth);
            }
            invoke(owned, 'setAttribute', 'position', new Attribute(new Float32Array(vertices), 3));
            for (const method of ['computeVertexNormals', 'computeBoundingBox', 'computeBoundingSphere'])
                if (typeof owned[method] === 'function') invoke(owned, method);
            mesh.geometry = owned;
            const geometry = owned;
            return () => { if (mesh.geometry === geometry) mesh.geometry = original; disposeGeometry(geometry); };
        } catch { disposeGeometry(owned); }
    };
    const ground = (w: Native, position: Native, s: BoxSchema, x: number, y: number, z: number): number | null => {
        if (rayDisabled || !hitType || typeof w[s.ray] !== 'function') return null;
        try {
            if (!hit) hit = new hitType();
            if (!origin) {
                const Vector = position.constructor as new (x: number, y: number, z: number) => Native;
                origin = new Vector(0, 0, 0); direction = new Vector(0, 0, -1);
            }
            origin![s.x] = x; origin![s.y] = y; origin![s.z] = z;
            const ok = invoke(w, s.ray, origin, direction, 6000, 16, hit);
            const value = ok ? (hit![s.rayPosition] as Native | undefined)?.[s.z] : null;
            invoke(hit!, s.rayReset);
            return typeof value === 'number' && Number.isFinite(value) ? value : null;
        } catch { rayDisabled = true; return null; }
    };
    const step = (p: Piece, dt: number, now: number): boolean => {
        const age = (now - p.born) / 1000;
        if (age >= BOX_PICKUP.fadeStart + BOX_PICKUP.fadeDuration) return true;
        const s = p.schema, render = child(p.box, s.render);
        if (!p.rest) {
            p.vz -= BOX_PICKUP.gravity * dt;
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            if (p.vz < 0 && p.z - p.sz * BOX_PICKUP.boxHalf < p.ground + 300 && now >= p.probeAt && rays < BOX_PICKUP.rayBudget) {
                rays++; p.probeAt = now + BOX_PICKUP.rayInterval;
                const value = ground(p.world, child(render, s.position), s, p.x, p.y, p.z + 30);
                if (value !== null) p.ground = value;
            }
            const floor = p.ground + p.sz * BOX_PICKUP.boxHalf;
            if (p.z <= floor) {
                p.z = floor; p.landed = true;
                if (p.vz < -140) { p.vz *= -BOX_PICKUP.bounce; p.vx *= .6; p.vy *= .6; p.wx *= .5; p.wy *= .5; p.wz *= .6; }
                else {
                    p.vz = 0;
                    const friction = Math.max(0, 1 - 6 * dt);
                    p.vx *= friction; p.vy *= friction; p.wz *= friction;
                    p.rest = Math.hypot(p.vx, p.vy) < 8 && Math.abs(p.wz) < .3;
                }
            }
        }
        if (p.landed) {
            const k = 1 - Math.exp(-10 * dt);
            p.rx = wrap(p.rx); p.ry = wrap(p.ry);
            p.rx += (p.tx - p.rx) * k; p.ry += (p.ty - p.ry) * k; p.rz += p.wz * dt;
            if (p.rest) p.wx = p.wy = p.wz = 0;
        } else { p.rx += p.wx * dt; p.ry += p.wy * dt; p.rz += p.wz * dt; }
        invoke(child(render, s.position), s.vectorSet, p.x, p.y, p.z);
        invoke(child(render, s.rotation), s.vectorSet, p.rx, p.ry, p.rz);
        const glow = Math.max(0, 1 - age / BOX_PICKUP.glowSec);
        if (age <= BOX_PICKUP.glowSec + dt) tint(p.box, s, glow);
        if (age >= BOX_PICKUP.fadeStart) {
            const t = Math.min(1, (age - BOX_PICKUP.fadeStart) / BOX_PICKUP.fadeDuration), scale = 1 - t * t * (3 - 2 * t);
            invoke(child(render, s.scale), s.vectorSet, p.sx * scale, p.sy * scale, p.sz * scale);
            invoke(p.box, s.opacity, scale);
        }
        return false;
    };
    const tick = (now: number) => {
        frame = 0;
        if (!enabled || scope.disabled || canvas && !canvas.isConnected) { clear(); return; }
        const dt = Math.min(.033, Math.max(0, (now - last) / 1000)); last = now; rays = 0;
        for (let i = pieces.length - 1; i >= 0; i--) {
            const piece = pieces[i];
            let done = true;
            try { done = step(piece, dt, now); } catch (error) { scope.fail(error); }
            if (scope.disabled) return;
            if (done) { remove(piece); pieces.splice(i, 1); }
        }
        if (pieces.length) frame = scope.frame(tick);
    };
    const bridge = {
        captureRay(value: Native) {
            if (!hitType && value && typeof value.constructor === 'function') hitType = value.constructor as new () => Native;
        },
        start(anim: Native, box: Native, s: BoxSchema) {
            const old = flashes.get(anim); if (old) { restoreFlash(old); flashes.delete(anim); }
            if (!enabled || scope.disabled) return;
            scope.run(() => {
                const nextWorld = anim[s.world] as Native, render = box?.[s.render] as Native | undefined, position = render?.[s.position] as Native | undefined;
                if (!nextWorld || !position || ![s.x,s.y,s.z].every(key => Number.isFinite(position[key])) ||
                    ![s.reset,s.release,s.detach,s.attach,s.opacity,s.uniformScale,s.colorReset].every(key => typeof box[key] === 'function') ||
                    typeof (box[s.pool] as Native | undefined)?.[s.acquire] !== 'function') return;
                if (world && world !== nextWorld) clear();
                world = nextWorld;
                if (flashes.size >= 64) return;
                canvas = page.document?.querySelector(gameDOM.screens.battleCanvas) || null;
                const born = performance.now(), x = position[s.x] as number, y = position[s.y] as number, z = position[s.z] as number;
                const gz = ground(world!, position, s, x, y, z) ?? z - BOX_PICKUP.groundOffset;
                const count = pieces.length > BOX_PICKUP.maxShards * .8 ? Math.ceil(BOX_PICKUP.count / 2) : BOX_PICKUP.count;
                for (let i = 0; i < count; i++) {
                    while (pieces.length >= BOX_PICKUP.maxShards) remove(pieces.shift()!);
                    const fragment = invoke(child(box, s.pool), s.acquire) as Native;
                    if (!fragment || fragment === box) continue;
                    const roll = Math.random(), sides = roll < .36 ? 3 : roll < .68 ? 4 : Math.floor(random(5,8));
                    const angle = random(0, Math.PI * 2), speed = random(BOX_PICKUP.speedHMin, BOX_PICKUP.speedHMax);
                    const p: Piece = { box: fragment, schema: s, world: nextWorld, born,
                        x:x+random(-.4,.4)*BOX_PICKUP.boxHalf, y:y+random(-.4,.4)*BOX_PICKUP.boxHalf, z:z+random(-.2,.4)*BOX_PICKUP.boxHalf,
                        vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,vz:random(BOX_PICKUP.speedVMin,BOX_PICKUP.speedVMax),
                        rx:random(-3,3),ry:random(-3,3),rz:random(-3,3),wx:random(-14,14),wy:random(-14,14),wz:random(-14,14),
                        tx:random(-.09,.09),ty:random(-.09,.09),sx:random(.18,.5),sy:random(.16,.4),sz:random(.04,.15),
                        ground:gz,probeAt:born+BOX_PICKUP.rayInterval,landed:false,rest:false,released:false };
                    try {
                        invoke(fragment, s.reset); p.restoreGeometry = shape(fragment, sides); invoke(fragment, s.attach, nextWorld);
                        const object = child(fragment, s.render);
                        invoke(child(object, s.scale), s.vectorSet, p.sx,p.sy,p.sz);
                        invoke(child(object, s.position), s.vectorSet, p.x,p.y,p.z); invoke(child(object, s.rotation), s.vectorSet, p.rx,p.ry,p.rz);
                        tint(fragment,s,1); pieces.push(p); stats.spawned++;
                    } catch (error) { remove(p); throw error; }
                }
                flashes.set(anim,{box,schema:s,born}); stats.pickups++;
                if (!frame && pieces.length) { last = born; frame = scope.frame(tick); }
            });
            // A partial spawn failure must still retire any fragments already created.
            if (!frame && pieces.length && !scope.disabled) { last = performance.now(); frame = scope.frame(tick); }
        },
        frame(anim: Native, finish: () => void): boolean {
            const record = flashes.get(anim);
            if (!record || !enabled || scope.disabled) return false;
            try {
                const progress = (performance.now() - record.born) / (BOX_PICKUP.flashSec * 1000);
                if (progress < 1) {
                    invoke(record.box, record.schema.uniformScale, 1 + 1.1 * (1 - (1 - progress) ** 2));
                    invoke(record.box, record.schema.opacity, 1 - progress * progress); tint(record.box,record.schema,1-progress,.85,.45);
                } else {
                    flashes.delete(anim);
                    // Native completion is invoked exactly once, in its original order.
                    restoreFlash(record); finish();
                }
                return true;
            } catch (error) { flashes.delete(anim); restoreFlash(record); scope.fail(error); return true; }
        },
        stop(anim: Native) { const record = flashes.get(anim); if (record) { flashes.delete(anim); restoreFlash(record); } },
        status: () => ({ enabled, pieces: pieces.length, flashes: flashes.size, ...stats, runtime: scope.status() })
    };
    page.__kaspBoxPickup = bridge;
    return bridge;
}
