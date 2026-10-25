/** Freeze every validated native foliage vertex path, including the calm breeze.
 * The original model, UVs, fog and shadow coordinates remain in place. */
export function treeWindShader(source:string,instanced:boolean):string{
 if(source.includes('/* kiStaticFoliage */'))return source;
 const anchor=instanced?'vertexWorldPosition = getPositionModifiedByWind(vertexWorldPosition, time, windStrength);':'vec3 localPosition = position + positionOffset;';
 if(!source.includes(anchor))return source;
 // A zero-initialized uniform keeps native mandatory wind uniforms active at
 // link time. It is never written, so no native source can animate foliage.
 return 'uniform float kiFoliageMotion;\n'+source.replace(anchor,instanced?'/* kiStaticFoliage */ if(kiFoliageMotion>0.){'+anchor+'}':'/* kiStaticFoliage */ vec3 localPosition = position; if(kiFoliageMotion>0.)localPosition+=positionOffset;');
}
