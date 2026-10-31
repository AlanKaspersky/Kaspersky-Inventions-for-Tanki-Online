import { SUN_RAYS } from './config';
export const SUN_VERTEX = `#version 300 es
precision highp float;out vec2 uv;
void main(){vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;
export const SHADOW_VERTEX = `#version 300 es
precision highp float;layout(location=0)in vec3 position;uniform mat4 uSunVP;
void main(){gl_Position=uSunVP*vec4(position,1.);}`;
export const SHADOW_FRAGMENT = `#version 300 es
precision highp float;void main(){}`;
const WORLD = `
uniform mat4 uInvVP;uniform vec3 uCamera;uniform sampler2D uDepth;uniform float uDistance;
uniform vec4 uSunParams;uniform vec2 uSunLimits;uniform int uSteps;
uniform vec3 uSunTint,uHazeColour;uniform vec4 uHazeParams,uLook;
uniform vec4 uFinish;
vec3 worldAt(vec2 q,float d){vec4 p=uInvVP*vec4(q*2.-1.,d*2.-1.,1.);return p.xyz/p.w;}
float sceneDistance(vec2 q){float d=texture(uDepth,q).r;return d>=.999999?uDistance:min(uDistance,length(worldAt(q,d)-uCamera));}
`;
export const VOLUME_FRAGMENT = `#version 300 es
precision highp float;precision highp int;in vec2 uv;out vec4 o;
${WORLD}
uniform highp sampler2DShadow uShadow;uniform mat4 uSunVP;
uniform vec3 uSun,uColour;uniform float uFloor,uCeiling,uStrength,uFade,uTime;
uint pcg(uint v){uint s=v*747796405u+2891336453u;uint w=((s>>((s>>28u)+4u))^s)*277803737u;return(w>>22u)^w;}
float hash3(ivec3 p){return float(pcg(uint(p.x)+pcg(uint(p.y)+pcg(uint(p.z)))))*(1./4294967296.);}
float noise3(vec3 p){ivec3 i=ivec3(floor(p));vec3 f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(mix(hash3(i),hash3(i+ivec3(1,0,0)),f.x),mix(hash3(i+ivec3(0,1,0)),hash3(i+ivec3(1,1,0)),f.x),f.y),
mix(mix(hash3(i+ivec3(0,0,1)),hash3(i+ivec3(1,0,1)),f.x),mix(hash3(i+ivec3(0,1,1)),hash3(i+ivec3(1,1,1)),f.x),f.y),f.z);}
float visibility(vec3 p){
 vec3 q=(uSunVP*vec4(p,1.)).xyz*.5+.5;
 // Above/in front of all collision geometry the air is sunlit, not a black fog wall.
 if(q.z<=0.)return 1.;
 if(q.z>=1.)return 0.;
 if(any(lessThan(q.xy,vec2(0.)))||any(greaterThan(q.xy,vec2(1.))))return 1.;
 vec2 texel=1./vec2(textureSize(uShadow,0));
 float spread=.35+uFinish.x*.5;
 return .5*(texture(uShadow,vec3(q.xy-texel*spread,q.z-.00035))+texture(uShadow,vec3(q.xy+texel*spread,q.z-.00035)));
}
void main(){
 vec3 direction=normalize(worldAt(uv,1.)-uCamera);float end=sceneDistance(uv);
 int steps=uSteps>0?uSteps:${SUN_RAYS.steps};
 float step_=end/float(steps),transmission=1.;vec3 scattered=vec3(0.);
 // Stable pixel stratification; no random phase every frame and no temporal-history trails.
 float jitter=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
 float g=${SUN_RAYS.anisotropy}+uSunParams.y,mu=dot(direction,uSun);
 float phase=(1.-g*g)/pow(max(.01,1.+g*g-2.*g*mu),1.5);
 for(int i=0;i<96;i++){if(i>=steps)break;
  float travel=(float(i)+.2+.6*jitter)*step_;vec3 p=uCamera+direction*travel;
  float height=p.z-uFloor;
  float heightFade=(1.-smoothstep(2500.,uCeiling-uFloor+8500.,height))*smoothstep(-300.,100.,height);
  float mist=.65+.35*noise3(p*.0006+vec3(uTime*.008,0.,0.));
  float density=${SUN_RAYS.extinction}*heightFade*mist*uFade*(1.+uSunParams.x);
  float alpha=1.-exp(-density*step_);
  float lit=visibility(p);
  scattered+=transmission*alpha*lit*uColour*uSunTint*(.08+.85*min(phase,8.))*uStrength;
  transmission*=1.-alpha;
 }
 // Bound the atmospheric highlight independently of the user's surface-light gain.
 float highlight=max(.01,.22+uSunLimits.x);scattered=highlight*(1.-exp(-scattered/highlight));
 o=vec4(scattered,transmission);
}`;
export const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;in vec2 uv;out vec4 o;
${WORLD}
uniform sampler2D uVolume;
uniform highp sampler2DShadow uShadow;uniform mat4 uSunVP;uniform vec3 uSun;
uniform float uStrength,uFade;uniform sampler2D uScene;
uniform vec3 uSunDisk;
uniform sampler2D uBloom;uniform float uBloomStrength;
void sunDisk(inout vec4 colour){
 // Infinite directional source. Native scene depth clips buildings and tanks.
 vec3 ray=normalize(worldAt(uv,1.)-uCamera);
 float separation=length(ray-normalize(uSun)),radius=max(.00001,uSunDisk.x);
 float aa=max(fwidth(separation),.00001);
 float disk=1.-smoothstep(radius-aa,radius+aa,separation);
 float halo=exp(-pow(separation/(radius*5.),2.))*uSunDisk.z;
 float fade=clamp(uFade,0.,1.);
 vec3 source=mix(uSunTint,vec3(1.),.55)*min(2.,uSunDisk.y);
 colour.rgb=mix(colour.rgb,source,disk*fade*min(1.,uSunDisk.y));
 // Smooth, bounded glare independent of the uncapped surface-light strength.
 colour.rgb+=uSunTint*(1.-exp(-halo*.22))*fade*min(1.,uSunDisk.y);
}
float surfaceVisibility(vec3 p){vec3 q=(uSunVP*vec4(p,1.)).xyz*.5+.5;
 if(q.z<=0.)return 1.;if(q.z>=1.)return 0.;
 if(any(lessThan(q.xy,vec2(0.)))||any(greaterThan(q.xy,vec2(1.))))return 1.;
 float centre=texture(uShadow,vec3(q.xy,q.z-.0006));
 if(uFinish.x<=0.)return centre;
 vec2 t=uFinish.x/vec2(textureSize(uShadow,0));
 return .3*centre+.175*(texture(uShadow,vec3(q.xy+vec2(t.x,0.),q.z-.0006))+texture(uShadow,vec3(q.xy-vec2(t.x,0.),q.z-.0006))+
 texture(uShadow,vec3(q.xy+vec2(0.,t.y),q.z-.0006))+texture(uShadow,vec3(q.xy-vec2(0.,t.y),q.z-.0006)));}
void appearance(inout vec4 light,float depth){
 // No extra pass or history: use the existing, format-compatible scene copy.
 vec3 scene=texture(uScene,uv).rgb;
 vec3 colour=light.rgb+light.a*scene;
 bool sky=depth>=.999999;
 float distance_=sky?uDistance:length(worldAt(uv,depth)-uCamera);
 float haze=(1.-exp(-max(0.,distance_-uHazeParams.y)/max(1.,uHazeParams.z)))*uHazeParams.x*uFade;
 // Distance haze is softly capped; shadows and near surfaces retain detail.
 colour=mix(colour,uHazeColour*.72,min(.65,haze)*(sky?.35:1.));
 if(sky)colour*=mix(vec3(1.),uSunTint,uHazeParams.w*uFade);
 if(uBloomStrength>0.)colour+=texture(uBloom,uv).rgb*uBloomStrength*uFade;
 float exposure=exp2(uLook.x*uFade);
 colour=colour*exposure/(1.+max(vec3(0.),colour)*max(0.,exposure-1.));
 colour=(colour-.35)*mix(1.,uLook.y,uFade)+.35;
 float luminance=dot(colour,vec3(.2126,.7152,.0722));
 colour=mix(vec3(luminance),colour,mix(1.,uLook.z,uFade));
 // A restrained luminance curve preserves chroma and leaves bright materials legible.
 float y=max(0.,dot(colour,vec3(.2126,.7152,.0722)));
 float curved=smoothstep(0.,1.,clamp(y,0.,1.));
 colour*=mix(y,curved,uFinish.z*uFade)/max(y,.00001);
 // Full colour replaces the native destination; destination alpha is preserved by the caller.
 light=vec4(max(vec3(0.),colour),0.);
}
void main(){
 vec2 size=vec2(textureSize(uVolume,0)),p=uv*size-.5,base=floor(p),f=fract(p);
 float target=sceneDistance(uv),total=0.;vec4 sum=vec4(0.);
 for(int y=0;y<2;y++)for(int x=0;x<2;x++){
  vec2 q=(base+vec2(x,y)+.5)/size;
  float delta=abs(sceneDistance(q)-target);
  float weight=(x==0?1.-f.x:f.x)*(y==0?1.-f.y:f.y)*exp(-delta/max(25.,target*.012));
  sum+=texture(uVolume,q)*weight;total+=weight;
 }
 // At an unresolved thin silhouette preserve the native image instead of leaking a bright halo.
 o=total>.0001?sum/total:vec4(0.,0.,0.,1.);
 float depth=texture(uDepth,uv).r;
 if(depth>=.999999){o.rgb=min(o.rgb,vec3(max(0.,.06+uSunLimits.y)));o.a=mix(1.,o.a,.15);appearance(o,depth);sunDisk(o);return;}
 vec3 pWorld=worldAt(uv,depth);
 // Derive a surface normal from the nearest continuous depth neighbours, not a distant silhouette.
 vec2 pixel=1./vec2(textureSize(uDepth,0));
 vec3 l=worldAt(uv-vec2(pixel.x,0.),texture(uDepth,uv-vec2(pixel.x,0.)).r)-pWorld;
 vec3 r=worldAt(uv+vec2(pixel.x,0.),texture(uDepth,uv+vec2(pixel.x,0.)).r)-pWorld;
 vec3 b=worldAt(uv-vec2(0.,pixel.y),texture(uDepth,uv-vec2(0.,pixel.y)).r)-pWorld;
 vec3 t=worldAt(uv+vec2(0.,pixel.y),texture(uDepth,uv+vec2(0.,pixel.y)).r)-pWorld;
 vec3 dx=length(l)<length(r)?-l:r,dy=length(b)<length(t)?-b:t;
 vec3 normal=cross(dx,dy);float normalLength=length(normal);
 if(normalLength>.0001){normal/=normalLength;if(dot(normal,uCamera-pWorld)<0.)normal=-normal;
  float visible=surfaceVisibility(pWorld);
  float gain=(.55+uSunParams.z)*(1.-exp(-uStrength*.05))*uFade*max(0.,dot(normal,uSun))*visible;
  // Global directional enhancement follows the map surface; it is independent of viewing distance.
  vec3 baseColour=texture(uScene,uv).rgb;
  o.rgb+=baseColour*gain*uSunTint;
  o.rgb+=baseColour*vec3(.78,.88,1.)*uFinish.y*uFade*min(1.,uStrength*.25)*(1.-visible*.65)*(.5+.5*normal.z);
 }
 appearance(o,depth);
}`;

/** Quarter-resolution bright extraction followed by two separable Gaussian passes.
 * Own implementation: no Minecraft pack code, assets or pipeline dependencies. */
export const BLOOM_EXTRACT_FRAGMENT=`#version 300 es
precision highp float;in vec2 uv;out vec4 o;uniform sampler2D uSource;uniform vec2 uPixel;uniform float uThreshold;
void main(){
 vec3 c=(texture(uSource,uv+uPixel*vec2(-1.,-1.)).rgb+texture(uSource,uv+uPixel*vec2(1.,-1.)).rgb+
 texture(uSource,uv+uPixel*vec2(-1.,1.)).rgb+texture(uSource,uv+uPixel*vec2(1.,1.)).rgb)*.25;
 float y=max(c.r,max(c.g,c.b)),knee=.1;
 float soft=clamp(y-uThreshold+knee,0.,2.*knee);soft=soft*soft/(4.*knee);
 float amount=max(y-uThreshold,soft)/max(y,.00001);
 o=vec4(c*amount,1.);
}`;
export const BLOOM_BLUR_FRAGMENT=`#version 300 es
precision highp float;in vec2 uv;out vec4 o;uniform sampler2D uSource;uniform vec2 uAxis;
void main(){vec3 c=texture(uSource,uv).rgb*.4;
 c+=(texture(uSource,uv-uAxis).rgb+texture(uSource,uv+uAxis).rgb)*.24;
 c+=(texture(uSource,uv-uAxis*2.).rgb+texture(uSource,uv+uAxis*2.).rgb)*.06;o=vec4(c,1.);}`;
