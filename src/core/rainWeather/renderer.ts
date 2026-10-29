import { SNOW, SNOW_VERTEX, SNOW_FRAGMENT, SNOW_STREAK_VERTEX, SNOW_STREAK_FRAGMENT } from '../snowWeather';
import type { Precipitation } from './schedule';
import { WEATHER } from './schedule';
import * as shader from './shaders';
import { buildBolt } from './lightning';
import type { LightningFrame } from './lightning';
import { PUDDLE_FRAGMENT, HIGH_PUDDLE_FRAGMENT, PUDDLE_SURFACE_REVISION } from './puddles';
import type { PuddleDetail } from './preferences';
import { DEFAULT_SURFACE_TUNING } from './tuning';
import type { SurfaceTuning } from './tuning';
import type { CollisionSurface } from './mapSurface';
import { MAP_VERTEX,MAP_FRAGMENT,SPLASH_VERTEX,SPLASH_FRAGMENT } from './splashShaders';
import { SPLASHES } from './splashes';
import { WEATHER_PALETTES } from './appearance';
import type { WeatherPalette } from './appearance';
// Only values read from this same context are restored.
type GLState = {
 prog:WebGLProgram|null;vao:WebGLVertexArrayObject|null;arrayBuffer:WebGLBuffer|null;unit:number;
 dtex:WebGLTexture|null;vtex:WebGLTexture|null;stex:WebGLTexture|null;
 dsampler:WebGLSampler|null;vsampler:WebGLSampler|null;ssampler:WebGLSampler|null;
 mtex:WebGLTexture|null;msampler:WebGLSampler|null;utext:WebGLTexture|null;usampler:WebGLSampler|null;clearDepth:number;cullMode:number;frontFace:number;
 blend:boolean;bsrc:number;bdst:number;bsrcA:number;bdstA:number;beq:number;beqA:number;
 depth:boolean;dmask:boolean;dfunc:number;cull:boolean;stencil:boolean;scissor:boolean;
 poly:boolean;polyF:number;polyU:number;cmask:boolean[];fb:WebGLFramebuffer|null;readfb:WebGLFramebuffer|null;
 discard:boolean;viewport:Int32Array;depthRange:Float32Array;a2c:boolean;drawBuffers:number[]|null;
};
type Program = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };
type CopyInfo = { format:number|null; samples:number; reason:string|null };
export interface RainFrame {
    vp: Float32Array; camera: [number,number,number]; time: number; seed: number; fade: number;
    precipitation?:Precipitation;
    rain: number; clouds: number; wind: number; flash: number; storm: number;
    fog: [number,number,number]; fogColor: [number,number,number,number];
    lightning?:LightningFrame;
    puddles?:number;
    puddleDetail?:PuddleDetail;
    surfaceTuning?:Readonly<SurfaceTuning>;
    map?:CollisionSurface;splashData?:Float32Array;nativeLighting?:boolean;
    cloudPalette?:WeatherPalette;cloudTone?:[number,number,number];sunDirection?:[number,number,number];skyDarkness?:number;
}
export type RainStage='sky'|'weather'|'all';
export function createRainRenderer(gl: WebGL2RenderingContext) {
 const UUNIT=11,DUNIT=12,VUNIT=13,SUNIT=14,MUNIT=15;
 const colourFormats=new Set<number>([gl.RGBA8,gl.RGB8,gl.RGB565,gl.RGBA4,gl.RGB5_A1,gl.RGB10_A2]);
 const defaultColourFormat=gl.getContextAttributes()?.alpha===false?gl.RGB8:gl.RGBA8;
 const info:{depthFormat?:number}={};
 const curRes:{depthTex:WebGLTexture|null;depthFbo:WebGLFramebuffer|null;depthWidth:number;depthHeight:number;depthFormat:number;depthReady:boolean}=
   {depthTex:null,depthFbo:null,depthWidth:0,depthHeight:0,depthFormat:0,depthReady:false};
 const invVP=new Float32Array(16); const programs:Program[]=[];
 let ready=false,disposed=false,vao:WebGLVertexArrayObject|null=null,cloudTex:WebGLTexture|null=null,cloudFbo:WebGLFramebuffer|null=null;
 let cw=0,ch=0,cloudAt=-Infinity;
 const cloudFloat=!!gl.getExtension('EXT_color_buffer_float');
 let snow:Program|undefined,snowStreak:Program|undefined,snowError:string|null=null,snowStreakError:string|null=null,snowFlakes=0,snowCrystals=0,snowStreaks=0;
 let cloud:Program,composite:Program,rain:Program,atmosphere:Program,bolt:Program;
 let boltBuffer:WebGLBuffer|null=null,boltVao:WebGLVertexArrayObject|null=null,boltKey='',boltCount=0;
 const puddlePrograms:Partial<Record<PuddleDetail,Program>>={},puddleErrors:Partial<Record<PuddleDetail,string>>={};
 let sceneTex:WebGLTexture|null=null,sceneFbo:WebGLFramebuffer|null=null,sw=0,sh=0,sceneFormat=0,lastPuddleDetail:PuddleDetail|null=null;
 const sceneCopy:CopyInfo={format:null,samples:0,reason:null},depthCopy:CopyInfo={format:null,samples:0,reason:null};
 type MapPass={vao:WebGLVertexArrayObject|null;buffer:WebGLBuffer|null;texture:WebGLTexture|null;fbo:WebGLFramebuffer|null;width:number;height:number;source?:Float32Array};
 const mapPasses:MapPass[]=Array.from({length:2},()=>({vao:null,buffer:null,texture:null,fbo:null,width:0,height:0}));
 let mapProgram:Program|undefined,mapSource:CollisionSurface|undefined,mapFrames=0,mapError:string|null=null;
 let splashProgram:Program|undefined,splashVao:WebGLVertexArrayObject|null=null,splashBuffer:WebGLBuffer|null=null,splashError:string|null=null,splashParticles=0;
 function releaseMap(){for(const p of mapPasses){gl.deleteVertexArray(p.vao);gl.deleteBuffer(p.buffer);gl.deleteTexture(p.texture);gl.deleteFramebuffer(p.fbo);Object.assign(p,{vao:null,buffer:null,texture:null,fbo:null,width:0,height:0,source:undefined});}mapSource=undefined;}
 function drawMap(f:RainFrame,S:GLState){
  if(!f.map?.vertices.length||mapError)return false;
  try{
   mapProgram??=owned(MAP_VERTEX,MAP_FRAGMENT,['uVP','uCam']);
   const hasBanks=(f.surfaceTuning||DEFAULT_SURFACE_TUNING).edgeInset>0&&!!f.map.supportVertices?.length;
   const w=S.viewport[2],h=S.viewport[3];
   gl.viewport(0,0,w,h);gl.colorMask(false,false,false,false);gl.disable(gl.BLEND);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);gl.disable(gl.CULL_FACE);gl.clearDepth(1);
   for(let i=0;i<(hasBanks?2:1);i++){
    const p=mapPasses[i],vertices=i===0?f.map.vertices:f.map.supportVertices!;
    if(!p.vao){p.vao=gl.createVertexArray();p.buffer=gl.createBuffer();gl.bindVertexArray(p.vao);gl.bindBuffer(gl.ARRAY_BUFFER,p.buffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);}
    gl.bindVertexArray(p.vao);gl.bindBuffer(gl.ARRAY_BUFFER,p.buffer);
    if(p.source!==vertices){gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);p.source=vertices;}
    const unit=i===0?MUNIT:UUNIT;gl.activeTexture(gl.TEXTURE0+unit);gl.bindSampler(unit,null);
    if(!p.texture||p.width!==w||p.height!==h){
     gl.deleteTexture(p.texture);gl.deleteFramebuffer(p.fbo);p.texture=gl.createTexture();p.fbo=gl.createFramebuffer();p.width=w;p.height=h;
     gl.bindTexture(gl.TEXTURE_2D,p.texture);gl.texStorage2D(gl.TEXTURE_2D,1,gl.DEPTH_COMPONENT24,w,h);
     gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
     gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,p.fbo);gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,p.texture,0);gl.drawBuffers([gl.NONE]);
     if(gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Collision mask framebuffer incomplete');
    }else gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,p.fbo);
    gl.bindTexture(gl.TEXTURE_2D,null);gl.clear(gl.DEPTH_BUFFER_BIT);gl.useProgram(mapProgram.p);gl.uniformMatrix4fv(mapProgram.u.uVP,false,f.vp);gl.uniform3fv(mapProgram.u.uCam,f.camera);gl.drawArrays(gl.TRIANGLES,0,vertices.length/3);gl.bindTexture(gl.TEXTURE_2D,p.texture);
   }
   // Full static collision depth closes raised banks; only the horizontal pass
   // authorizes water. Tanks and supply boxes cannot enter either owned mesh.
   if(!hasBanks){gl.activeTexture(gl.TEXTURE0+UUNIT);gl.bindSampler(UUNIT,null);gl.bindTexture(gl.TEXTURE_2D,mapPasses[0].texture);}
   mapSource=f.map;mapFrames++;return true;
  }catch(error){mapError=String(error);return false;}
  finally{
   gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,S.fb);gl.viewport(S.viewport[0],S.viewport[1],S.viewport[2],S.viewport[3]);gl.clearDepth(S.clearDepth);gl.cullFace(S.cullMode);gl.frontFace(S.frontFace);
   gl.disable(gl.CULL_FACE);gl.depthMask(false);gl.colorMask(true,true,true,false);gl.enable(gl.BLEND);gl.bindVertexArray(vao);
  }
 }
 let reflectionCopies=0,puddleFrames=0;
 function releaseReflections(){
   gl.deleteTexture(sceneTex);gl.deleteFramebuffer(sceneFbo);sceneTex=null;sceneFbo=null;sw=0;sh=0;sceneFormat=0;
 }
 function renderbufferInfo(target:number,attachment:number){
   if(gl.getFramebufferAttachmentParameter(target,attachment,gl.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE)!==gl.RENDERBUFFER)return null;
   const previous=gl.getParameter(gl.RENDERBUFFER_BINDING);
   gl.bindRenderbuffer(gl.RENDERBUFFER,gl.getFramebufferAttachmentParameter(target,attachment,gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME));
   try{return {format:gl.getRenderbufferParameter(gl.RENDERBUFFER,gl.RENDERBUFFER_INTERNAL_FORMAT) as number,
     width:gl.getRenderbufferParameter(gl.RENDERBUFFER,gl.RENDERBUFFER_WIDTH) as number,
     height:gl.getRenderbufferParameter(gl.RENDERBUFFER,gl.RENDERBUFFER_HEIGHT) as number};}
   finally{gl.bindRenderbuffer(gl.RENDERBUFFER,previous);}
 }
 function copyBounds(S:GLState,info:CopyInfo,size:{width:number;height:number}|null){
   const [x,y,w,h]=S.viewport;
   // WebGL MSAA resolve requires identical source/destination coordinates,
   // not merely equal rectangle sizes. Our viewport textures start at (0,0).
   if(info.samples>0&&(x!==0||y!==0)){info.reason='msaa-viewport-offset';return false;}
   if(x<0||y<0||w<1||h<1||(size&&(x+w>size.width||y+h>size.height))){info.reason='viewport-out-of-bounds';return false;}
   return true;
 }
 function copySceneColor(S:GLState){
   // Resolve into a separate colour texture. Never sample the render target that
   // is currently being written, and never borrow a native framebuffer attachment.
   gl.bindFramebuffer(gl.READ_FRAMEBUFFER,S.fb);
   try{
     sceneCopy.samples=gl.getParameter(gl.SAMPLES);sceneCopy.format=null;sceneCopy.reason=null;
     const attachment=gl.getParameter(gl.READ_BUFFER);
     if(attachment===gl.NONE){sceneCopy.reason='no-read-buffer';return false;}
     let format=gl.RGBA8 as number,size:{width:number;height:number}|null=null;
     if(S.fb){
       const type=gl.getFramebufferAttachmentParameter(gl.READ_FRAMEBUFFER,attachment,gl.FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE);
       // The experimental pass supports normalized colour; float/HDR stays native.
       if(type!==gl.UNSIGNED_NORMALIZED){sceneCopy.reason='unsupported-colour-type';return false;}
       if(gl.getFramebufferAttachmentParameter(gl.READ_FRAMEBUFFER,attachment,gl.FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING)!==gl.LINEAR){sceneCopy.reason='unsupported-colour-encoding';return false;}
       const buffer=renderbufferInfo(gl.READ_FRAMEBUFFER,attachment);size=buffer;
       if(sceneCopy.samples>0){
         if(!buffer){sceneCopy.reason='unknown-msaa-format';return false;}
         format=buffer.format;
       }
     }else{
       // alpha:false default buffers are RGB8 for WebGL blits, even if ANGLE
       // internally backs them with RGBA storage. MSAA cannot convert formats.
       format=defaultColourFormat;
       size={width:gl.drawingBufferWidth,height:gl.drawingBufferHeight};
     }
     sceneCopy.format=format;
     if(!colourFormats.has(format)){
       sceneCopy.reason='unsupported-colour-format';return false;
     }
     if(!copyBounds(S,sceneCopy,size))return false;
     const w=S.viewport[2],h=S.viewport[3];
     gl.activeTexture(gl.TEXTURE0+SUNIT);
     if(!sceneTex||sw!==w||sh!==h||sceneFormat!==format){
       releaseReflections();sceneTex=gl.createTexture();sceneFbo=gl.createFramebuffer();sw=w;sh=h;sceneFormat=format;
       if(!sceneTex||!sceneFbo)return false;
       gl.bindTexture(gl.TEXTURE_2D,sceneTex);gl.texStorage2D(gl.TEXTURE_2D,1,format,w,h);
       gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
       gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
       gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,sceneFbo);gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,sceneTex,0);
       if(gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){releaseReflections();return false;}
     }else gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,sceneFbo);
     gl.blitFramebuffer(S.viewport[0],S.viewport[1],S.viewport[0]+w,S.viewport[1]+h,0,0,w,h,gl.COLOR_BUFFER_BIT,gl.NEAREST);
     gl.bindTexture(gl.TEXTURE_2D,sceneTex);reflectionCopies++;return true;
   }finally{
     gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,S.fb);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,S.readfb);
   }
 }
  function copySceneDepth(S: GLState) {
    depthCopy.samples=gl.getParameter(gl.SAMPLES);depthCopy.format=null;depthCopy.reason=null;
    if (!boundHasDepth(S)) return false;
    const width = S.viewport[2], height = S.viewport[3];
    if (!(width > 0 && height > 0)) return false;
    const depthBits = gl.getParameter(gl.DEPTH_BITS), stencilBits = gl.getParameter(gl.STENCIL_BITS);
    // Chromium's default drawing buffer uses packed depth/stencil storage even with stencil:false.
    let packed = stencilBits > 0 || !S.fb;
    let format: number = packed ? (depthBits > 24 ? gl.DEPTH32F_STENCIL8 : gl.DEPTH24_STENCIL8)
      : depthBits > 24 ? gl.DEPTH_COMPONENT32F : depthBits > 16 ? gl.DEPTH_COMPONENT24 : gl.DEPTH_COMPONENT16;
    let sourceSize:{width:number;height:number}|null=S.fb?null:{width:gl.drawingBufferWidth,height:gl.drawingBufferHeight};
    if (S.fb) {
      const kind = gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE);
      if (kind === gl.RENDERBUFFER) {
        const buffer=renderbufferInfo(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT)!;
        format=buffer.format;sourceSize=buffer;
      } else if (kind === gl.TEXTURE) {
        const stencilSize = gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.FRAMEBUFFER_ATTACHMENT_STENCIL_SIZE);
        if (stencilSize > 0) format = depthBits > 24 ? gl.DEPTH32F_STENCIL8 : gl.DEPTH24_STENCIL8;
      }
    }
    if (format === gl.DEPTH_STENCIL) format = gl.DEPTH24_STENCIL8;
    if (format === gl.DEPTH_COMPONENT) format = gl.DEPTH_COMPONENT16;
    packed = format === gl.DEPTH24_STENCIL8 || format === gl.DEPTH32F_STENCIL8;
    info.depthFormat = format;
    depthCopy.format=format;
    if(!copyBounds(S,depthCopy,sourceSize))return false;
    const attachment = packed ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT;
    const resource = curRes;
    gl.activeTexture(gl.TEXTURE0 + DUNIT);
    try {
      if (!resource.depthTex || resource.depthWidth !== width || resource.depthHeight !== height || resource.depthFormat !== format) {
        if (resource.depthTex) gl.deleteTexture(resource.depthTex);
        if (resource.depthFbo) gl.deleteFramebuffer(resource.depthFbo);
        resource.depthTex = gl.createTexture(); resource.depthFbo = gl.createFramebuffer();
        resource.depthWidth = width; resource.depthHeight = height; resource.depthFormat = format;
        gl.bindTexture(gl.TEXTURE_2D,resource.depthTex);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texStorage2D(gl.TEXTURE_2D,1,format,width,height);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,resource.depthFbo);
        gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER,attachment,gl.TEXTURE_2D,resource.depthTex,0);
        gl.drawBuffers([gl.NONE]);
        resource.depthReady = gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      }
      if (!resource.depthReady) return false;
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER,S.fb);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,resource.depthFbo);
      const scissor = gl.isEnabled(gl.SCISSOR_TEST);
      gl.disable(gl.SCISSOR_TEST);
      try { gl.blitFramebuffer(S.viewport[0],S.viewport[1],S.viewport[0]+width,S.viewport[1]+height,0,0,width,height,gl.DEPTH_BUFFER_BIT,gl.NEAREST); }
      finally { if (scissor) gl.enable(gl.SCISSOR_TEST); }
      gl.bindTexture(gl.TEXTURE_2D,resource.depthTex);
      return true;
    } finally {
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,S.fb);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER,S.readfb);
      gl.activeTexture(S.unit);
    }
  }

  function invert4(m: ArrayLike<number>, out: Float32Array) {
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det || !isFinite(det)) return false;
    det = 1 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return true;
  }

  function saveState() {
    const S = {} as GLState;
    S.prog = gl.getParameter(gl.CURRENT_PROGRAM);
    S.vao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
    S.arrayBuffer=gl.getParameter(gl.ARRAY_BUFFER_BINDING);
    S.unit = gl.getParameter(gl.ACTIVE_TEXTURE);
    gl.activeTexture(gl.TEXTURE0 + DUNIT);
    S.dtex = gl.getParameter(gl.TEXTURE_BINDING_2D);
    S.dsampler = gl.getParameter(gl.SAMPLER_BINDING);
    gl.activeTexture(gl.TEXTURE0 + VUNIT);
    S.vtex = gl.getParameter(gl.TEXTURE_BINDING_2D);
    S.vsampler = gl.getParameter(gl.SAMPLER_BINDING);
    gl.activeTexture(gl.TEXTURE0 + SUNIT);
    S.stex = gl.getParameter(gl.TEXTURE_BINDING_2D);
    S.ssampler = gl.getParameter(gl.SAMPLER_BINDING);
    gl.activeTexture(gl.TEXTURE0+MUNIT);S.mtex=gl.getParameter(gl.TEXTURE_BINDING_2D);S.msampler=gl.getParameter(gl.SAMPLER_BINDING);
    gl.activeTexture(gl.TEXTURE0+UUNIT);S.utext=gl.getParameter(gl.TEXTURE_BINDING_2D);S.usampler=gl.getParameter(gl.SAMPLER_BINDING);
    gl.activeTexture(S.unit);
    S.blend = gl.isEnabled(gl.BLEND);
    S.bsrc = gl.getParameter(gl.BLEND_SRC_RGB); S.bdst = gl.getParameter(gl.BLEND_DST_RGB);
    S.bsrcA = gl.getParameter(gl.BLEND_SRC_ALPHA); S.bdstA = gl.getParameter(gl.BLEND_DST_ALPHA);
    S.beq = gl.getParameter(gl.BLEND_EQUATION_RGB); S.beqA = gl.getParameter(gl.BLEND_EQUATION_ALPHA);
    S.depth = gl.isEnabled(gl.DEPTH_TEST);
    S.dmask = gl.getParameter(gl.DEPTH_WRITEMASK);
    S.dfunc = gl.getParameter(gl.DEPTH_FUNC);
    S.cull = gl.isEnabled(gl.CULL_FACE);
    S.stencil = gl.isEnabled(gl.STENCIL_TEST);
    S.scissor = gl.isEnabled(gl.SCISSOR_TEST);
    S.poly = gl.isEnabled(gl.POLYGON_OFFSET_FILL);
    S.polyF = gl.getParameter(gl.POLYGON_OFFSET_FACTOR); S.polyU = gl.getParameter(gl.POLYGON_OFFSET_UNITS);
    S.cmask = gl.getParameter(gl.COLOR_WRITEMASK);
    S.fb = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    S.readfb = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
    S.discard = gl.isEnabled(gl.RASTERIZER_DISCARD);
    S.viewport = gl.getParameter(gl.VIEWPORT);
    S.depthRange = gl.getParameter(gl.DEPTH_RANGE);
    S.clearDepth=gl.getParameter(gl.DEPTH_CLEAR_VALUE);S.cullMode=gl.getParameter(gl.CULL_FACE_MODE);S.frontFace=gl.getParameter(gl.FRONT_FACE);
    S.a2c = gl.isEnabled(gl.SAMPLE_ALPHA_TO_COVERAGE);
    S.drawBuffers = null;
    if (S.fb) {
      const n = gl.getParameter(gl.MAX_DRAW_BUFFERS);
      const db = [];
      let active = 0;
      for (let i = 0; i < n; i++) { const v = gl.getParameter(gl.DRAW_BUFFER0 + i); db.push(v); if (v !== gl.NONE) active++; }
      if (active > 1) S.drawBuffers = db;
    }
    return S;
  }

  function restoreState(S: GLState) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, S.fb);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, S.readfb);
    gl.viewport(S.viewport[0], S.viewport[1], S.viewport[2], S.viewport[3]);
    gl.depthRange(S.depthRange[0],S.depthRange[1]);
    if (S.drawBuffers) gl.drawBuffers(S.drawBuffers);
    gl.activeTexture(gl.TEXTURE0 + DUNIT);
    gl.bindTexture(gl.TEXTURE_2D, S.dtex);
    gl.bindSampler(DUNIT, S.dsampler);
    gl.activeTexture(gl.TEXTURE0 + VUNIT);
    gl.bindTexture(gl.TEXTURE_2D, S.vtex);
    gl.bindSampler(VUNIT, S.vsampler);
    gl.activeTexture(gl.TEXTURE0 + SUNIT);
    gl.bindTexture(gl.TEXTURE_2D, S.stex);
    gl.bindSampler(SUNIT, S.ssampler);
    gl.activeTexture(gl.TEXTURE0+MUNIT);gl.bindTexture(gl.TEXTURE_2D,S.mtex);gl.bindSampler(MUNIT,S.msampler);
    gl.activeTexture(gl.TEXTURE0+UUNIT);gl.bindTexture(gl.TEXTURE_2D,S.utext);gl.bindSampler(UUNIT,S.usampler);
    gl.activeTexture(S.unit);
    gl.bindVertexArray(S.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,S.arrayBuffer);
    gl.useProgram(S.prog);
    S.blend ? gl.enable(gl.BLEND) : gl.disable(gl.BLEND);
    gl.blendFuncSeparate(S.bsrc, S.bdst, S.bsrcA, S.bdstA);
    gl.blendEquationSeparate(S.beq, S.beqA);
    S.depth ? gl.enable(gl.DEPTH_TEST) : gl.disable(gl.DEPTH_TEST);
    gl.depthMask(S.dmask);
    gl.depthFunc(S.dfunc);
    S.cull ? gl.enable(gl.CULL_FACE) : gl.disable(gl.CULL_FACE);
    gl.clearDepth(S.clearDepth);gl.cullFace(S.cullMode);gl.frontFace(S.frontFace);
    S.stencil ? gl.enable(gl.STENCIL_TEST) : gl.disable(gl.STENCIL_TEST);
    S.scissor ? gl.enable(gl.SCISSOR_TEST) : gl.disable(gl.SCISSOR_TEST);
    S.poly ? gl.enable(gl.POLYGON_OFFSET_FILL) : gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(S.polyF, S.polyU);
    gl.colorMask(S.cmask[0], S.cmask[1], S.cmask[2], S.cmask[3]);
    S.a2c ? gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE) : gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    S.discard ? gl.enable(gl.RASTERIZER_DISCARD) : gl.disable(gl.RASTERIZER_DISCARD);
  }

  function boundHasDepth(S: GLState) {
    try {
      if (!S.fb) { const a = gl.getContextAttributes(); return !!(a && a.depth); }
      // Query the depth attachment directly: a combined query is invalid for depth-only FBOs.
      return gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE) !== gl.NONE;
    } catch (e) { return false; }
  }

  function compile(type: number, src: string) {
    const s = gl.createShader(type);
    if(!s)throw Error('Cannot allocate rain shader');
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const message = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(message + '\n' + src.split('\n').slice(0, 3).join(' ')); }
    return s;
  }

  function program(vs: string, fs: string, names: string[]) {
    const p = gl.createProgram();
    if(!p)throw Error('Cannot allocate rain program');
    let vertex = null, fragment = null;
    try {
      vertex = compile(gl.VERTEX_SHADER, vs); fragment = compile(gl.FRAGMENT_SHADER, fs);
      gl.attachShader(p, vertex); gl.attachShader(p, fragment); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)||'Rain program link failed');
    } catch (error) { gl.deleteProgram(p); throw error; }
    finally { if (vertex) gl.deleteShader(vertex); if (fragment) gl.deleteShader(fragment); }
    const u: Record<string, WebGLUniformLocation | null> = {};
    names.forEach(function (n) { u[n] = gl.getUniformLocation(p, n); });
    return { p: p, u: u };
  }

  function uploadClean(fn: () => void) {
    const fields = [gl.UNPACK_FLIP_Y_WEBGL, gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, gl.UNPACK_ALIGNMENT,
      gl.UNPACK_ROW_LENGTH, gl.UNPACK_IMAGE_HEIGHT, gl.UNPACK_SKIP_ROWS, gl.UNPACK_SKIP_PIXELS, gl.UNPACK_SKIP_IMAGES];
    const values = fields.map(function (field) { return gl.getParameter(field); });
    const pbo = gl.getParameter(gl.PIXEL_UNPACK_BUFFER_BINDING);
    try {
      gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
      fields.forEach(function (field, i) { gl.pixelStorei(field, i === 2 ? 1 : 0); });
      fn();
    } finally {
      fields.forEach(function (field, i) { gl.pixelStorei(field, values[i]); });
      gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, pbo);
    }
  }

 const shared=['uInvVP','uCam','uTime','uRain','uCloud','uSeed','uFade','uFog','uFogColor','uDepth','uSkyDarkness'];
 function owned(vs:string,fs:string,names:string[]):Program {const p=program(vs,fs,names);programs.push(p);return p;}
 function prepareSnow(){
   if(!snow&&!snowError)try{snow=owned(SNOW_VERTEX,SNOW_FRAGMENT,[...shared,'uVP','uViewport','uWind','uCount','uIdOffset']);}catch(error){snowError=String(error);}
   return snow;
 }
 function prepareSnowStreaks(){
   if(!snowStreak&&!snowStreakError)try{snowStreak=owned(SNOW_STREAK_VERTEX,SNOW_STREAK_FRAGMENT,[...shared,'uVP','uViewport','uWind','uCount','uIdOffset']);}catch(error){snowStreakError=String(error);}
   return snowStreak;
 }
 function prepareReflections(detail:PuddleDetail):Program|undefined{
   if(puddlePrograms[detail])return puddlePrograms[detail];
   if(!puddleErrors[detail]){
     try{return puddlePrograms[detail]=owned(shader.FULL_VERTEX,detail==='high'?HIGH_PUDDLE_FRAGMENT:PUDDLE_FRAGMENT,[...shared,'uSky','uVP','uScene','uMapDepth','uMapSupportDepth','uCloudTexture','uPuddles','uWind','uRippleTuning','uWaveTuning','uOptics','uEdgeInset','uSunDirection','uCloudTone']);}
     catch(error){puddleErrors[detail]=String(error);}
   }
   // Optional water quality must never disable rain on a driver that rejects it.
   return detail==='high'?prepareReflections('low'):undefined;
 }
 function dispose(){
   disposed=true;for(const p of programs.splice(0))gl.deleteProgram(p.p);
   gl.deleteVertexArray(vao);gl.deleteTexture(cloudTex);gl.deleteFramebuffer(cloudFbo);
   gl.deleteVertexArray(boltVao);gl.deleteBuffer(boltBuffer);
   gl.deleteTexture(curRes.depthTex);gl.deleteFramebuffer(curRes.depthFbo);ready=false;
   releaseReflections();
   releaseMap();gl.deleteVertexArray(splashVao);gl.deleteBuffer(splashBuffer);
 }
 function warm(reflections=false,detail:PuddleDetail='low',precipitation:Precipitation='rain'){
   if(disposed)return;if(ready){if(reflections)prepareReflections(detail);if(precipitation==='snow')prepareSnow();return;}const state=saveState();
   try {
     cloud=owned(shader.FULL_VERTEX,shader.CLOUD_FRAGMENT,[...shared,'uSky','uCloudBase','uThickness','uCloudLow','uCloudHigh','uCloudHaze','uCloudTone']);
     composite=owned(shader.FULL_VERTEX,shader.COMPOSITE_FRAGMENT,['uSky','uCloudTexture','uFade','uInvVP','uBoltFlash','uBoltDirection']);
     atmosphere=owned(shader.FULL_VERTEX,shader.ATMOSPHERE_FRAGMENT,[...shared,'uSky','uStorm','uBoltFlash']);
     rain=owned(shader.RAIN_VERTEX,shader.RAIN_FRAGMENT,[...shared,'uVP','uViewport','uWind','uCount']);
     bolt=owned(shader.LIGHTNING_VERTEX,shader.LIGHTNING_FRAGMENT,['uVP','uViewport','uPower','uFade']);
     if(reflections)prepareReflections(detail);if(precipitation==='snow')prepareSnow();
     vao=gl.createVertexArray();cloudTex=gl.createTexture();cloudFbo=gl.createFramebuffer();ready=true;
     boltVao=gl.createVertexArray();boltBuffer=gl.createBuffer();
     if(!boltVao||!boltBuffer)throw Error('Cannot allocate lightning mesh');
     gl.bindVertexArray(boltVao);gl.bindBuffer(gl.ARRAY_BUFFER,boltBuffer);
     for(let i=0;i<3;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,i===2?2:3,gl.FLOAT,false,32,i*12);gl.vertexAttribDivisor(i,1);}
   } catch(error){dispose();throw error;} finally {restoreState(state);}
 }
 function use(p:Program,f:RainFrame){
   gl.useProgram(p.p);const u=p.u;
   gl.uniformMatrix4fv(u.uInvVP??null,false,invVP);gl.uniform3fv(u.uCam??null,f.camera);
   gl.uniform1f(u.uTime??null,f.time);gl.uniform1f(u.uRain??null,f.rain);gl.uniform1f(u.uCloud??null,f.clouds);
   gl.uniform3fv(u.uCloudTone??null,f.cloudTone??[1,1,1]);gl.uniform3fv(u.uSunDirection??null,f.sunDirection??[0,0,1]);
   gl.uniform1f(u.uSkyDarkness??null,f.skyDarkness??0);
   gl.uniform1f(u.uSeed??null,f.seed);gl.uniform1f(u.uFade??null,f.fade);
   gl.uniform3fv(u.uFog??null,f.fog);gl.uniform4fv(u.uFogColor??null,f.fogColor);gl.uniform1i(u.uDepth??null,DUNIT);
   gl.uniform1f(u.uSky??null,0);
 }
 let frames=0,depthCopies=0,cloudFrames=0;
 function draw(f:RainFrame,stage:RainStage='all'){
   snowFlakes=0;snowCrystals=0;snowStreaks=0;
   if(disposed||gl.isContextLost()||f.fade<=0)return;
   warm(false,'low',f.precipitation);if(!ready||!invert4(f.vp,invVP))return;
   if(f.clouds<.001&&f.rain<.001&&f.storm<.001){releaseReflections();return;}
   const sky=stage!=='weather',weather=stage!=='sky';
   const state=saveState();
   try {
     if(!boundHasDepth(state))return;
     const width=state.viewport[2],height=state.viewport[3];if(width<1||height<1)return;
     const refreshCloud=sky&&f.clouds>.001&&f.time-cloudAt>=1/WEATHER.cloudHz;
     const wet=sky&&f.precipitation!=='snow'&&Math.max(0,Math.min(1,f.puddles??0))*f.rain*f.fade>.002;
     const depthNeeded=weather&&f.rain>.03&&f.precipitation!=='snow'||wet;
     const depth=depthNeeded&&copySceneDepth(state);if(depth)depthCopies++;
     gl.disable(gl.STENCIL_TEST);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.CULL_FACE);
     gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);gl.disable(gl.RASTERIZER_DISCARD);gl.disable(gl.POLYGON_OFFSET_FILL);
     gl.depthMask(false);gl.bindVertexArray(vao);
     gl.depthRange(0,1);
     gl.bindSampler(DUNIT,null);gl.bindSampler(VUNIT,null);
     gl.bindSampler(SUNIT,null);
     gl.activeTexture(gl.TEXTURE0+DUNIT);gl.bindTexture(gl.TEXTURE_2D,curRes.depthTex);
     gl.activeTexture(gl.TEXTURE0+VUNIT);gl.bindTexture(gl.TEXTURE_2D,cloudTex);
     if(refreshCloud){
       const w=WEATHER.cloudWidth,h=WEATHER.cloudHeight;
       if(cw!==w||ch!==h){
         cw=w;ch=h;uploadClean(()=>gl.texImage2D(gl.TEXTURE_2D,0,cloudFloat?gl.RGBA16F:gl.RGBA8,w,h,0,gl.RGBA,cloudFloat?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null));
         gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
         gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
         gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,cloudFbo);gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,cloudTex,0);
         if(gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Cloud framebuffer incomplete');
       } else gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,cloudFbo);
       gl.viewport(0,0,cw,ch);gl.colorMask(true,true,true,true);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
       // A low resolution cloud pass never samples its own attached colour texture.
       gl.bindTexture(gl.TEXTURE_2D,null);use(cloud,f);
       const palette=f.cloudPalette||WEATHER_PALETTES.storm;gl.uniform3fv(cloud.u.uCloudLow,palette.low);gl.uniform3fv(cloud.u.uCloudHigh,palette.high);gl.uniform3fv(cloud.u.uCloudHaze,palette.haze);
       gl.uniform1f(cloud.u.uCloudBase,WEATHER.cloudBase);gl.uniform1f(cloud.u.uThickness,WEATHER.cloudThickness);
       gl.drawArrays(gl.TRIANGLES,0,3);cloudAt=f.time;cloudFrames++;
       gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,state.fb);gl.viewport(state.viewport[0],state.viewport[1],state.viewport[2],state.viewport[3]);
       gl.activeTexture(gl.TEXTURE0+VUNIT);gl.bindTexture(gl.TEXTURE_2D,cloudTex);
     }
     if(state.drawBuffers)gl.drawBuffers([state.drawBuffers[0],...state.drawBuffers.slice(1).map(()=>gl.NONE)]);
     gl.colorMask(true,true,true,false);gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);
     gl.blendFuncSeparate(gl.ONE,gl.ONE_MINUS_SRC_ALPHA,gl.ZERO,gl.ONE);
     if(sky&&f.clouds>.001&&cw){
       gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);use(composite,f);
       gl.uniform1f(composite.u.uSky,1);gl.uniform1i(composite.u.uCloudTexture,VUNIT);
       gl.uniform1f(composite.u.uBoltFlash,f.lightning?.flash??0);
       const strike=f.lightning;
       const direction=strike?[strike.origin[0]+Math.cos(strike.strike.azimuth)*strike.strike.radius-f.camera[0],strike.origin[1]+Math.sin(strike.strike.azimuth)*strike.strike.radius-f.camera[1],WEATHER.cloudBase-f.camera[2]]:[0,0,1];
       const length=Math.hypot(...direction);gl.uniform3f(composite.u.uBoltDirection,direction[0]/length,direction[1]/length,direction[2]/length);
       gl.drawArrays(gl.TRIANGLES,0,3);
     }
     if(sky&&f.lightning&&f.lightning.power>.001){
       const {strike,origin,power}=f.lightning,key=`${strike.seed}:${origin[0]}:${origin[1]}`;
       gl.bindVertexArray(boltVao);gl.bindBuffer(gl.ARRAY_BUFFER,boltBuffer);
       if(key!==boltKey){const data=buildBolt(strike,origin);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);boltCount=data.length/8;boltKey=key;}
       use(bolt,f);gl.uniformMatrix4fv(bolt.u.uVP,false,f.vp);gl.uniform2f(bolt.u.uViewport,width,height);gl.uniform1f(bolt.u.uPower,power);
       gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.blendFuncSeparate(gl.ONE,gl.ONE,gl.ZERO,gl.ONE);
       gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,boltCount);
       gl.bindVertexArray(vao);gl.blendFuncSeparate(gl.ONE,gl.ONE_MINUS_SRC_ALPHA,gl.ZERO,gl.ONE);
     }
     const mapped=wet&&depth&&drawMap(f,state);
     if(mapped&&cw&&copySceneColor(state)){
       // Opt-in compilation and colour-copy allocation; disabled puddles have no
       // reflection render pass. All opaque geometry is ready before this stage.
       const program=prepareReflections(f.puddleDetail==='high'?'high':'low');
       if(program){
         gl.disable(gl.DEPTH_TEST);use(program,f);
         gl.uniformMatrix4fv(program.u.uVP,false,f.vp);gl.uniform1i(program.u.uScene,SUNIT);gl.uniform1i(program.u.uCloudTexture,VUNIT);
         gl.uniform1f(program.u.uPuddles,Math.max(0,Math.min(1,f.puddles??0)));gl.uniform1f(program.u.uWind,f.wind);
         gl.uniform1i(program.u.uMapDepth,MUNIT);gl.uniform1i(program.u.uMapSupportDepth,UUNIT);
         const tuning=f.surfaceTuning||DEFAULT_SURFACE_TUNING;
         gl.uniform4f(program.u.uRippleTuning,tuning.rippleSizeReduction,tuning.rippleSpeed,tuning.rippleDensity,tuning.rippleStrength);
         gl.uniform3f(program.u.uWaveTuning,tuning.waveSizeReduction,tuning.waveSpeed,tuning.waveStrength);
         gl.uniform4f(program.u.uOptics,tuning.reflectionStrength,tuning.reflectionDistance,tuning.reflectionRoughness,tuning.refractionStrength);
         gl.uniform1f(program.u.uEdgeInset,tuning.edgeInset);
         gl.drawArrays(gl.TRIANGLES,0,3);puddleFrames++;lastPuddleDetail=program===puddlePrograms.high?'high':'low';
       }
     }else if(!wet&&sky&&sceneTex)releaseReflections();
     if(weather&&!f.nativeLighting&&(f.storm>.001||f.rain>.001)){
       gl.disable(gl.DEPTH_TEST);use(atmosphere,f);gl.uniform1f(atmosphere.u.uStorm,f.storm);
       gl.uniform1f(atmosphere.u.uBoltFlash,f.lightning?.flash??0);
       gl.drawArrays(gl.TRIANGLES,0,3);
     }
     if(weather&&f.rain>.001){
       // World-space droplets replace the old screen-space impact crowns.
       const data=f.precipitation==='snow'?undefined:f.splashData;
       if(data?.length&&!splashError){
        try{
         if(!splashProgram){
          splashProgram=owned(SPLASH_VERTEX,SPLASH_FRAGMENT,[...shared,'uVP','uViewport','uSplash','uPuddles','uDetail']);splashVao=gl.createVertexArray();splashBuffer=gl.createBuffer();
          gl.bindVertexArray(splashVao);gl.bindBuffer(gl.ARRAY_BUFFER,splashBuffer);
          gl.bufferData(gl.ARRAY_BUFFER,SPLASHES.capacity*SPLASHES.stride*4,gl.DYNAMIC_DRAW);
          for(const [index,size,offset]of [[0,3,0],[1,3,3],[2,2,6],[3,3,8]]){gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,size,gl.FLOAT,false,SPLASHES.stride*4,offset*4);gl.vertexAttribDivisor(index,1);}
         }
         const count=Math.min(SPLASHES.capacity,Math.floor(data.length/SPLASHES.stride));
         gl.bindVertexArray(splashVao);gl.bindBuffer(gl.ARRAY_BUFFER,splashBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,data.subarray(0,count*SPLASHES.stride));use(splashProgram,f);
         const tuning=f.surfaceTuning||DEFAULT_SURFACE_TUNING;
         gl.uniformMatrix4fv(splashProgram.u.uVP,false,f.vp);gl.uniform2f(splashProgram.u.uViewport,width,height);gl.uniform3f(splashProgram.u.uSplash,tuning.splashSpeed,tuning.splashSize,tuning.splashGravity);
         gl.uniform1f(splashProgram.u.uPuddles,f.puddles??0);gl.uniform1f(splashProgram.u.uDetail,f.puddleDetail==='high'?1:0);
         gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);splashParticles=count;gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,splashParticles);
        }catch(error){splashError=String(error);}finally{gl.bindVertexArray(vao);}
       }else splashParticles=0;
       const snowy=f.precipitation==='snow',particle=snowy?prepareSnow():rain;
       if(particle){
        gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
        const count=Math.round((snowy?SNOW.maxFlakes:WEATHER.maxDrops)*Math.min(1,f.rain));
        const streak=snowy&&f.wind>=.95?prepareSnowStreaks():undefined;
        const streakCount=streak?Math.round(count*SNOW.blizzardStreakShare):0,crystalCount=count-streakCount;
        const drawParticles=(program:Program,n:number,vertices:number,offset:number)=>{
         if(!n)return;use(program,f);
         gl.uniformMatrix4fv(program.u.uVP,false,f.vp);gl.uniform2f(program.u.uViewport,width,height);
         gl.uniform1f(program.u.uWind,f.wind);gl.uniform1f(program.u.uCount,n);gl.uniform1f(program.u.uIdOffset??null,offset);
         gl.drawArraysInstanced(snowy?gl.TRIANGLES:gl.TRIANGLE_STRIP,0,vertices,n);
        };
        drawParticles(particle,crystalCount,snowy?12:4,0);
        // Fixed ID partitions keep trajectories stable while precipitation fades.
        if(streak)drawParticles(streak,streakCount,6,SNOW.maxFlakes-Math.round(SNOW.maxFlakes*SNOW.blizzardStreakShare));
        if(snowy){snowFlakes=count;snowCrystals=crystalCount;snowStreaks=streakCount;}
       }
     }
     frames++;
   } finally {restoreState(state);}
 }
 return { warm,draw,dispose,clearReflections:()=>{releaseReflections();releaseMap();},status:()=>({ready,disposed,frames,snowFlakes,snowCrystals,snowStreaks,snowError,snowStreakError,depthCopies,cloudFrames,cloudSize:[cw,ch],cloudFloat,boltSegments:boltCount,depthFormat:info.depthFormat,
   puddleFrames,surfaceRevision:PUDDLE_SURFACE_REVISION,puddleDetail:lastPuddleDetail,puddleErrors:{...puddleErrors},reflectionCopies,reflectionSize:sceneTex?[sw,sh]:null,
   sceneCopy:{...sceneCopy},depthCopy:{...depthCopy},mapFrames,mapTriangles:mapSource?.triangles??0,mapError,splashParticles,splashError}) };
}
