import { SUN_RAYS } from './config';
import { sunProjection } from './math';
import type { SunProjection } from './math';
import type { V3, CollisionSurface } from '../rainWeather/mapSurface';
import * as shader from './shaders';
import { DEFAULT_GRAPHICS_TUNING } from '../graphicsPreferences';
import type { GraphicsTuning } from '../graphicsPreferences';
import { temperatureTint } from './appearance';

export interface SunFrame {
    vp: Float32Array; camera: V3; direction: V3; colour: V3;
    map: CollisionSurface; time: number; fade: number; intensity: number;
    graphics?:Readonly<GraphicsTuning>;
}
type Program = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };
type Compile = (vs: string, fs: string, uniforms: string[]) => Program;
/** Caller owns native GL-state preservation and a format-compatible scene-depth copy. */
export function createSunPass(gl: WebGL2RenderingContext, compile: Compile, initial:Readonly<GraphicsTuning>=DEFAULT_GRAPHICS_TUNING) {
    const BLOOM=11,DEPTH=12, VOLUME=14, SHADOW=15;
    const world=['uInvVP','uCamera','uDepth','uDistance','uSunParams','uSunLimits','uSteps','uSunTint','uHazeColour','uHazeParams','uLook','uFinish'];
    const volume=compile(shader.SUN_VERTEX,shader.VOLUME_FRAGMENT,[...world,'uShadow','uSunVP','uSun','uColour','uFloor','uCeiling','uStrength','uFade','uTime']);
    const composite=compile(shader.SUN_VERTEX,shader.COMPOSITE_FRAGMENT,[...world,'uVolume','uShadow','uSunVP','uSun','uStrength','uFade','uScene','uSunDisk','uBloom','uBloomStrength']);
    const shadow=compile(shader.SHADOW_VERTEX,shader.SHADOW_FRAGMENT,['uSunVP']);
    const fullscreen=gl.createVertexArray(),mesh=gl.createVertexArray(),buffer=gl.createBuffer();
    if(!fullscreen||!mesh||!buffer){gl.deleteVertexArray(fullscreen);gl.deleteVertexArray(mesh);gl.deleteBuffer(buffer);throw Error('Cannot allocate solar geometry');}
    let depth:WebGLTexture|null=null,shadowFbo:WebGLFramebuffer|null=null;
    let image:WebGLTexture|null=null,imageFbo:WebGLFramebuffer|null=null,width=0,height=0;
    let source:Float32Array|undefined,projection:SunProjection|undefined,lastDirection:V3|undefined;
    let frames=0,shadowBuilds=0,disposed=false;
    let bloomExtract:Program|undefined,bloomBlur:Program|undefined,bloomError:string|null=null,bloomFrames=0;
    let bloomTargets:{texture:WebGLTexture;fbo:WebGLFramebuffer}[]=[],bloomWidth=0,bloomHeight=0;
    const floating=!!gl.getExtension('EXT_color_buffer_float');
    const shadowSize=Math.min(initial.sunShadow,gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);
    let steps=SUN_RAYS.steps as number;
    function texture(unit:number,value:WebGLTexture|null){gl.activeTexture(gl.TEXTURE0+unit);gl.bindSampler(unit,null);gl.bindTexture(gl.TEXTURE_2D,value);}
    function parameters(filter:number){
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    }
    function dispose(){
        if(disposed)return;disposed=true;
        gl.deleteVertexArray(fullscreen);gl.deleteVertexArray(mesh);gl.deleteBuffer(buffer);
        gl.deleteTexture(depth);gl.deleteFramebuffer(shadowFbo);gl.deleteTexture(image);gl.deleteFramebuffer(imageFbo);
        releaseBloom();
        source=undefined;projection=undefined;
    }
    function releaseBloom(){for(const t of bloomTargets){gl.deleteTexture(t.texture);gl.deleteFramebuffer(t.fbo);}bloomTargets=[];bloomWidth=0;bloomHeight=0;}
    function bloom(f:SunFrame,w:number,h:number):boolean{
        const tuning=f.graphics||DEFAULT_GRAPHICS_TUNING;
        if(tuning.sunBloom<=0){releaseBloom();return false;}
        if(bloomError)return false;
        try{
            bloomExtract??=compile(shader.SUN_VERTEX,shader.BLOOM_EXTRACT_FRAGMENT,['uSource','uPixel','uThreshold']);
            bloomBlur??=compile(shader.SUN_VERTEX,shader.BLOOM_BLUR_FRAGMENT,['uSource','uAxis']);
            const scale=Math.min(.25,384/w),rw=Math.max(1,Math.ceil(w*scale)),rh=Math.max(1,Math.ceil(h*scale));
            if(bloomWidth!==rw||bloomHeight!==rh){
                releaseBloom();
                for(let i=0;i<2;i++){
                    const tex=gl.createTexture(),fbo=gl.createFramebuffer();
                    if(!tex||!fbo){gl.deleteTexture(tex);gl.deleteFramebuffer(fbo);throw Error('Cannot allocate bloom target');}
                    bloomTargets.push({texture:tex,fbo});texture(BLOOM,tex);
                    gl.texStorage2D(gl.TEXTURE_2D,1,floating?gl.RGBA16F:gl.RGBA8,rw,rh);parameters(gl.LINEAR);
                    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
                    if(gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Bloom framebuffer incomplete');
                }
                bloomWidth=rw;bloomHeight=rh;
            }
            gl.bindVertexArray(fullscreen);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.BLEND);gl.colorMask(true,true,true,true);gl.viewport(0,0,rw,rh);
            texture(BLOOM,null);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,bloomTargets[0].fbo);gl.useProgram(bloomExtract.p);
            gl.uniform1i(bloomExtract.u.uSource,13);gl.uniform2f(bloomExtract.u.uPixel,1/w,1/h);gl.uniform1f(bloomExtract.u.uThreshold,tuning.sunBloomThreshold);gl.drawArrays(gl.TRIANGLES,0,3);
            gl.useProgram(bloomBlur.p);gl.uniform1i(bloomBlur.u.uSource,BLOOM);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,bloomTargets[1].fbo);texture(BLOOM,bloomTargets[0].texture);gl.uniform2f(bloomBlur.u.uAxis,tuning.sunBloomRadius/rw,0);gl.drawArrays(gl.TRIANGLES,0,3);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,bloomTargets[0].fbo);texture(BLOOM,bloomTargets[1].texture);gl.uniform2f(bloomBlur.u.uAxis,0,tuning.sunBloomRadius/rh);gl.drawArrays(gl.TRIANGLES,0,3);
            texture(BLOOM,bloomTargets[0].texture);bloomFrames++;return true;
        }catch(error){bloomError=String(error);releaseBloom();return false;}
    }
    function prepareShadow(f:SunFrame){
        const vertices=f.map.supportVertices;
        if(!vertices?.length||vertices.length/9>SUN_RAYS.maxShadowTriangles)throw Error('Static collision shadow mesh unavailable or exceeds budget');
        if(source===vertices&&lastDirection&&Math.hypot(...f.direction.map((v,i)=>v-lastDirection![i]))<.0001)return;
        const next=sunProjection(vertices,f.direction);if(!next)throw Error('Invalid sunlight projection');
        if(!depth){
            depth=gl.createTexture();shadowFbo=gl.createFramebuffer();if(!depth||!shadowFbo)throw Error('Cannot allocate solar shadow map');
            texture(SHADOW,depth);gl.texStorage2D(gl.TEXTURE_2D,1,gl.DEPTH_COMPONENT24,shadowSize,shadowSize);parameters(gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_FUNC,gl.LEQUAL);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,shadowFbo);gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,depth,0);gl.drawBuffers([gl.NONE]);
            if(gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Solar shadow framebuffer incomplete');
        }else gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,shadowFbo);
        texture(SHADOW,null);gl.bindVertexArray(mesh);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
        if(source!==vertices){gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);}
        gl.viewport(0,0,shadowSize,shadowSize);gl.colorMask(false,false,false,false);gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);gl.depthRange(0,1);gl.clearDepth(1);gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.useProgram(shadow.p);gl.uniformMatrix4fv(shadow.u.uSunVP,false,next.vp);gl.drawArrays(gl.TRIANGLES,0,vertices.length/3);
        source=vertices;projection=next;lastDirection=[...f.direction];shadowBuilds++;
    }
    function target(w:number,h:number,tuning:Readonly<GraphicsTuning>){
        const scale=Math.min(SUN_RAYS.resolutionScale,tuning.sunResolution/w);
        const rw=Math.max(1,Math.ceil(w*scale)),rh=Math.max(1,Math.ceil(h*scale));
        if(image&&width===rw&&height===rh){gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,imageFbo);return;}
        gl.deleteTexture(image);gl.deleteFramebuffer(imageFbo);image=gl.createTexture();imageFbo=gl.createFramebuffer();
        if(!image||!imageFbo)throw Error('Cannot allocate solar volume');
        width=rw;height=rh;texture(VOLUME,image);gl.texStorage2D(gl.TEXTURE_2D,1,floating?gl.RGBA16F:gl.RGBA8,width,height);parameters(gl.NEAREST);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,imageFbo);gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,image,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
        if(gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Solar volume framebuffer incomplete');
    }
    function common(p:Program,f:SunFrame,inv:Float32Array){
        gl.useProgram(p.p);gl.uniformMatrix4fv(p.u.uInvVP,false,inv);gl.uniform3fv(p.u.uCamera,f.camera);
        const tuning=f.graphics||DEFAULT_GRAPHICS_TUNING;steps=tuning.sunSteps;
        gl.uniform1i(p.u.uDepth,DEPTH);gl.uniform1f(p.u.uDistance,tuning.sunDistance*100);
        gl.uniform4f(p.u.uSunParams,tuning.sunDensity-1,tuning.sunAnisotropy-.62,tuning.sunSurface-.55,0);
        gl.uniform2f(p.u.uSunLimits,tuning.sunHighlight-.22,tuning.sunSky-.06);gl.uniform1i(p.u.uSteps,steps);
        gl.uniform3fv(p.u.uSunTint,temperatureTint(tuning.sunTemperature));
        gl.uniform3fv(p.u.uHazeColour,temperatureTint(tuning.sunHazeTemperature));
        gl.uniform4f(p.u.uHazeParams,tuning.sunHaze,tuning.sunHazeStart*100,tuning.sunHazeDistance*100,tuning.sunSkyWarmth);
        gl.uniform4f(p.u.uLook,tuning.sunExposure,tuning.sunContrast,tuning.sunSaturation,0);
        gl.uniform4f(p.u.uFinish,tuning.sunShadowSoftness,tuning.sunShadowFill,tuning.sunToneCurve,0);
    }
    function draw(f:SunFrame,inv:Float32Array,sceneDepth:WebGLTexture,viewport:Int32Array,destination:WebGLFramebuffer|null){
        if(disposed)return;
        gl.disable(gl.SCISSOR_TEST);gl.disable(gl.STENCIL_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.RASTERIZER_DISCARD);gl.disable(gl.POLYGON_OFFSET_FILL);gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
        prepareShadow(f);const hasBloom=bloom(f,viewport[2],viewport[3]);target(viewport[2],viewport[3],f.graphics||DEFAULT_GRAPHICS_TUNING);
        gl.viewport(0,0,width,height);gl.colorMask(true,true,true,true);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.BLEND);
        gl.bindVertexArray(fullscreen);texture(DEPTH,sceneDepth);texture(SHADOW,depth);texture(VOLUME,null);common(volume,f,inv);
        gl.uniform1i(volume.u.uShadow,SHADOW);gl.uniformMatrix4fv(volume.u.uSunVP,false,projection!.vp);
        gl.uniform3fv(volume.u.uSun,f.direction);gl.uniform3fv(volume.u.uColour,f.colour);
        gl.uniform1f(volume.u.uFloor,projection!.floor);gl.uniform1f(volume.u.uCeiling,projection!.top);
        gl.uniform1f(volume.u.uStrength,f.intensity);gl.uniform1f(volume.u.uFade,f.fade);gl.uniform1f(volume.u.uTime,f.time);
        gl.drawArrays(gl.TRIANGLES,0,3);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,destination);gl.viewport(viewport[0],viewport[1],viewport[2],viewport[3]);
        texture(VOLUME,image);common(composite,f,inv);gl.uniform1i(composite.u.uVolume,VOLUME);
        gl.uniform1i(composite.u.uShadow,SHADOW);gl.uniformMatrix4fv(composite.u.uSunVP,false,projection!.vp);
        gl.uniform3fv(composite.u.uSun,f.direction);gl.uniform1f(composite.u.uStrength,f.intensity);gl.uniform1f(composite.u.uFade,f.fade);
        gl.uniform1i(composite.u.uScene,13);
        const tuning=f.graphics||DEFAULT_GRAPHICS_TUNING;
        gl.uniform3f(composite.u.uSunDisk,tuning.sunDiskSize*Math.PI/360,tuning.sunDiskBrightness,tuning.sunHalo);
        gl.uniform1i(composite.u.uBloom,BLOOM);gl.uniform1f(composite.u.uBloomStrength,hasBloom?tuning.sunBloom:0);
        // RGB is accumulated radiance, A is transmission: C = L + T * native scene.
        // Do not multiply already accumulated radiance by alpha a second time.
        gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);gl.blendFuncSeparate(gl.ONE,gl.SRC_ALPHA,gl.ZERO,gl.ONE);gl.colorMask(true,true,true,false);
        gl.drawArrays(gl.TRIANGLES,0,3);frames++;
    }
    return {draw,dispose,status:()=>({frames,shadowBuilds,resolution:[width,height],shadowSize,floating,steps,bloom:{frames:bloomFrames,resolution:[bloomWidth,bloomHeight],error:bloomError},triangles:(source?.length??0)/9,disposed})};
}
