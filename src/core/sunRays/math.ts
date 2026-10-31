import type { V3 } from '../rainWeather/mapSurface';

export interface SunProjection { vp: Float32Array; floor: number; top: number; }
/** Whole-map light space. Neither camera position nor camera rotation enters it. */
export function sunProjection(vertices: Float32Array, direction: V3): SunProjection | undefined {
    if (!vertices.length || vertices.length % 9 || !direction.every(Number.isFinite)) return;
    const length = Math.hypot(...direction);
    if (length < .001) return;
    const sun = direction.map(value => value / length) as V3;
    const cross = (a: V3, b: V3): V3 => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    let right = cross(Math.abs(sun[2]) < .95 ? [0,0,1] : [0,1,0], sun);
    const rl = Math.hypot(...right); right = right.map(value => value / rl) as V3;
    const up = cross(sun, right), back = sun.map(value => -value) as V3;
    const basis = [right, up, back], lo = [Infinity,Infinity,Infinity], hi = [-Infinity,-Infinity,-Infinity];
    let floor = Infinity, top = -Infinity;
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i], y = vertices[i+1], z = vertices[i+2];
        if (![x,y,z].every(Number.isFinite)) return;
        floor = Math.min(floor,z); top = Math.max(top,z);
        for (let axis = 0; axis < 3; axis++) {
            const b = basis[axis], value = b[0]*x+b[1]*y+b[2]*z;
            lo[axis] = Math.min(lo[axis],value); hi[axis] = Math.max(hi[axis],value);
        }
    }
    const vp = new Float32Array(16); vp[15] = 1;
    for (let axis = 0; axis < 3; axis++) {
        // Margin is fixed in world space, not snapped to a camera-following grid.
        lo[axis] -= 600; hi[axis] += 600;
        const scale = 2 / Math.max(1,hi[axis]-lo[axis]);
        for (let component = 0; component < 3; component++) vp[component*4+axis] = basis[axis][component]*scale;
        vp[12+axis] = -(hi[axis]+lo[axis])/(hi[axis]-lo[axis]);
    }
    return { vp, floor, top };
}
