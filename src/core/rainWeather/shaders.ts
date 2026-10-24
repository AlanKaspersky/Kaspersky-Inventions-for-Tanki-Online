export const FULL_VERTEX = `#version 300 es
precision highp float;
uniform float uSky;
out vec2 uv;
void main(){vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);uv=p*.5+.5;gl_Position=vec4(p,uSky,1.);}`;
const COMMON = `
precision highp float;precision highp int;
uniform mat4 uInvVP;
uniform vec3 uCam;
uniform float uTime,uRain,uCloud,uSeed,uFade;
uniform vec4 uFogColor;
uniform vec3 uFog; // enabled, near, far
out vec4 o;
uint pcg(uint v){uint s=v*747796405u+2891336453u;uint w=((s>>((s>>28u)+4u))^s)*277803737u;return(w>>22u)^w;}
float hash(uint v){return float(pcg(v))*(1./4294967296.);}
float h3(ivec3 p){return hash(uint(p.x)+pcg(uint(p.y)+pcg(uint(p.z))));}
float noise3(vec3 p){ivec3 i=ivec3(floor(p));vec3 f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);
return mix(mix(mix(h3(i),h3(i+ivec3(1,0,0)),f.x),mix(h3(i+ivec3(0,1,0)),h3(i+ivec3(1,1,0)),f.x),f.y),
mix(mix(h3(i+ivec3(0,0,1)),h3(i+ivec3(1,0,1)),f.x),mix(h3(i+ivec3(0,1,1)),h3(i+ivec3(1,1,1)),f.x),f.y),f.z);}
vec3 worldAt(vec2 uv,float depth){vec4 p=uInvVP*vec4(uv*2.-1.,depth*2.-1.,1.);return p.xyz/p.w;}
float fogAt(float distance_){return uFog.x*smoothstep(uFog.y,uFog.z,distance_)*uFogColor.a;}
`;
export const CLOUD_FRAGMENT = `#version 300 es
${COMMON}
in vec2 uv;
uniform float uCloudBase,uThickness;
float fbm(vec3 p){float v=0.,a=.52;for(int i=0;i<4;i++){v+=a*noise3(p);p=p*2.03+vec3(11.1,3.7,9.2);a*=.48;}return v;}
float density(vec3 p){
 float height=(p.z-uCloudBase)/uThickness;
 float profile=smoothstep(0.,.16,height)*(1.-smoothstep(.58,1.,height));
 vec3 q=vec3(p.xy*.00023+vec2(uTime*.004,-uTime*.0018),height*1.8);
 float broad=fbm(q+uSeed*.0001);
 float detail=noise3(q*5.1+vec3(3.,11.,7.));
 float base=smoothstep(mix(.63,.30,uCloud),mix(.89,.62,uCloud),broad)*smoothstep(0.,.25,uCloud);
 return base*mix(.75,1.,detail)*profile;
}
void main(){
 // World-aligned hemispherical atlas. Neither camera pose nor scene-depth
 // silhouettes are baked into the cached cloud image.
 float azimuth=(uv.x*2.-1.)*3.141592654,elevation=uv.y*1.570796327;
 vec3 direction=vec3(cos(azimuth)*cos(elevation),sin(azimuth)*cos(elevation),sin(elevation));
 if(direction.z<.012){o=vec4(0.);return;}
 float first=uCloudBase/direction.z;
 float last=(uCloudBase+uThickness)/direction.z;
 if(last<=first){o=vec4(0.);return;}
 float step_=(last-first)/12.,transmission=1.;vec3 color=vec3(0.);
 // Identical stratified sample positions on neighbouring rays: no texel-sized
 // random density jumps while a thin cloud is just becoming visible.
 for(int i=0;i<12;i++){
   float jitter=.5+.18*sin(float(i)*2.399963);
   float distance_=first+(float(i)+jitter)*step_;
   vec3 p=direction*distance_;float d=density(p);
   if(d>.004){
     float shadow=density(p+vec3(-900.,500.,1100.));
     float height=clamp((p.z-uCloudBase)/uThickness,0.,1.);
     vec3 ambient=mix(vec3(.24,.28,.34),vec3(.72,.76,.81),height*.65+.2)*mix(1.,.30,uRain);
     vec3 light=vec3(.78,.79,.78)*exp(-shadow*3.5)*mix(.7,.04,uRain);
     vec3 shade=ambient+light;
     // Native fog option and map colour; much nearer horizontal whitening keeps
     // overhead structure while distant cloud masses merge with the horizon.
     float haze=min(.88,fogAt(length(p.xy)));
     float fogLight=clamp(dot(uFogColor.rgb,vec3(.2126,.7152,.0722)),.65,.8);
     vec3 hazeColor=vec3(fogLight-.02,fogLight,fogLight+.025);
     shade=mix(shade,hazeColor,haze);
     float alpha=1.-exp(-d*min(step_/uThickness,1.5)*4.);
     color+=transmission*alpha*shade;transmission*=1.-alpha;
     if(transmission<.025)break;
   }
 }
 float horizon=smoothstep(.012,.09,direction.z);
 o=vec4(color,1.-transmission)*horizon;
}`;
export const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;in vec2 uv;uniform sampler2D uCloudTexture;uniform float uFade,uBoltFlash;uniform vec3 uBoltDirection;uniform mat4 uInvVP;out vec4 o;
vec4 cloudSample(vec2 p){
 vec2 size=vec2(textureSize(uCloudTexture,0)),pixel=p*size-.5,index=floor(pixel),f=fract(pixel),g=1.-f;
 vec2 w0=g*g*g/6.,w1=(3.*f*f*f-6.*f*f+4.)/6.,w2=(-3.*f*f*f+3.*f*f+3.*f+1.)/6.,w3=f*f*f/6.;
 vec2 a=w0+w1,b=w2+w3,lo=(index-1.+w1/a+.5)/size,hi=(index+1.+w3/b+.5)/size;
 return mix(mix(texture(uCloudTexture,lo),texture(uCloudTexture,vec2(hi.x,lo.y)),b.x),
            mix(texture(uCloudTexture,vec2(lo.x,hi.y)),texture(uCloudTexture,hi),b.x),b.y);
}
void main(){
 vec4 near_=uInvVP*vec4(uv*2.-1.,-1.,1.),far_=uInvVP*vec4(uv*2.-1.,1.,1.);
 vec3 direction=normalize(far_.xyz/far_.w-near_.xyz/near_.w);
 if(direction.z<=0.){o=vec4(0.);return;}
 vec2 skyUV=vec2(atan(direction.y,direction.x)/6.283185307+.5,asin(clamp(direction.z,0.,1.))/1.570796327);
 vec4 cloud=cloudSample(skyUV);
 float glow=exp(-max(0.,1.-dot(direction,uBoltDirection))*450.)*uBoltFlash;
 cloud.rgb+=vec3(.6,.72,1.)*glow*cloud.a*.25;
 o=cloud*uFade;
}`;
export const RAIN_VERTEX = `#version 300 es
precision highp float;precision highp int;
uniform mat4 uVP;uniform vec3 uCam;uniform vec2 uViewport;
uniform float uTime,uRain,uSeed,uWind,uCount;
out vec2 q;out float opacity;out float distance_;
uint pcg(uint v){uint s=v*747796405u+2891336453u;uint w=((s>>((s>>28u)+4u))^s)*277803737u;return(w>>22u)^w;}
float h(uint id,uint salt){return float(pcg(id+pcg(salt+uint(uSeed))))*(1./4294967296.);}
void main(){
 uint id=uint(gl_InstanceID);float size=h(id,3u),speed=mix(6200.,10800.,size);
 vec3 velocity=vec3(-uWind*speed*.4,-uWind*speed*.12,-speed);
 vec2 box=vec2(10000.);float height=7000.;
 vec2 xy=(fract(vec2(h(id,1u),h(id,2u))+(velocity.xy*uTime-uCam.xy)/box+.5)-.5)*box+uCam.xy;
 float phase=fract(h(id,4u)+(velocity.z*uTime-uCam.z)/height+.5);
 vec3 head=vec3(xy,(phase-.5)*height+uCam.z);
 vec3 view=uCam-head;distance_=length(view);
 vec3 axis=normalize(velocity);vec3 side=cross(axis,view);if(length(side)<.001)side=vec3(1.,0.,0.);side=normalize(side);
 vec4 clip=uVP*vec4(head,1.),delta=uVP*vec4(side,0.);
 float pixels=length((delta.xy*clip.w-clip.xy*delta.w)/max(clip.w*clip.w,.001)*uViewport*.5);
 float width=max(.9+size*.7,.6/max(pixels,.0001));
 float sign_=float(gl_VertexID&1)*2.-1.,along=float(gl_VertexID>>1);
 vec3 p=head-axis*speed*mix(.012,.026,uRain)*along+side*sign_*width;
 gl_Position=uVP*vec4(p,1.);q=vec2(sign_,along);
 float rim=1.-smoothstep(.62,1.,length((xy-uCam.xy)/5000.));
 opacity=(.24+.30*size)*rim*smoothstep(.0,.08,phase)*(1.-smoothstep(.92,1.,phase))
   *smoothstep(150.,550.,distance_)*smoothstep(0.,64.,uCount-float(gl_InstanceID));
}`;
export const ATMOSPHERE_FRAGMENT = `#version 300 es
precision highp float;uniform float uStorm,uRain,uFade,uBoltFlash;out vec4 o;
void main(){
 float dark=clamp(uStorm*.57+uRain*.075,0.,.62);
 // A continuous uniform colour grade, independent of depth-cache cadence and
 // transparent billboards. It must be applied to every presentation frame.
 dark*=1.-uBoltFlash*.85;
 o=vec4(vec3(.025,.035,.055)*dark,dark)*uFade;
}`;
export const LIGHTNING_VERTEX=`#version 300 es
precision highp float;
layout(location=0)in vec3 aStart;layout(location=1)in vec3 aEnd;layout(location=2)in vec2 aStyle;
uniform mat4 uVP;uniform vec2 uViewport;out vec2 q;out float energy;
void main(){
 float side=float(gl_VertexID&1)*2.-1.,along=float(gl_VertexID>>1);q=vec2(side,along);energy=aStyle.x;
 vec4 a=uVP*vec4(aStart,1.),b=uVP*vec4(aEnd,1.);
 if(a.w<=0.||b.w<=0.){gl_Position=vec4(2.,2.,2.,1.);return;}
 vec2 delta=(b.xy/b.w-a.xy/a.w)*uViewport;
 vec2 normal=vec2(-delta.y,delta.x)/max(length(delta),.001);
 vec4 clip=mix(a,b,along);clip.xy+=normal*side*(7.*aStyle.y)*2./uViewport*clip.w;
 // The bolt is beyond the playable map: native terrain depth hides it, without
 // clipping its distant world-space path at the game's camera far plane.
 gl_Position=vec4(clip.xy,clip.w*.9999998,clip.w);
}`;
export const LIGHTNING_FRAGMENT=`#version 300 es
precision highp float;in vec2 q;in float energy;uniform float uPower,uFade;out vec4 o;
void main(){float halo=exp(-q.x*q.x*4.)*.32,core=exp(-q.x*q.x*90.)*2.4;
 vec3 colour=vec3(.38,.58,1.)*halo+vec3(1.,.99,.96)*core;
 o=vec4(colour*energy*uPower*uFade,0.);
}`;
export const RAIN_FRAGMENT = `#version 300 es
precision highp float;in vec2 q;in float opacity;in float distance_;uniform float uFade;
uniform vec3 uFog;uniform vec4 uFogColor;out vec4 o;
void main(){float aa=max(fwidth(q.x),.04);float edge=1.-smoothstep(1.-aa,1.,abs(q.x));
float core=exp(-q.x*q.x*5.);float a=opacity*edge*pow(1.-q.y,1.5)*(.25+.75*core)*uFade;
vec3 color=mix(vec3(.57,.70,.79),vec3(.94,.97,1.),core);
float fog=uFog.x*smoothstep(uFog.y,uFog.z,distance_)*uFogColor.a;
o=vec4(mix(color,uFogColor.rgb,fog)*a,a);}`;
export const IMPACT_FRAGMENT = `#version 300 es
${COMMON}
in vec2 uv;uniform sampler2D uDepth;
void main(){
float depth=texture(uDepth,uv).r;if(depth>.999999)discard;
vec3 p=worldAt(uv,depth);vec3 normal=cross(dFdx(p),dFdy(p));
float flatness=abs(normal.z)/max(length(normal),.00001);if(flatness<.65)discard;
vec2 cell=floor(p.xy/110.);uint key=uint(int(cell.x))+pcg(uint(int(cell.y))+uint(uSeed));
float period=.45+hash(key)*.5,age=fract(uTime/period+hash(key+1u))*period;
if(age>.16||hash(key+2u)>uRain*.65)discard;
vec2 center=(cell+.4+.2*vec2(hash(key+3u),hash(key+4u)))*110.;
vec2 delta=(p.xy-center)/(4.+age*130.);float r=length(delta);if(r>1.)discard;
float spokes=pow(max(0.,cos(atan(delta.y,delta.x)*7.+hash(key+5u)*6.28)),8.);
float crown=spokes*smoothstep(.1,.3,r)*(1.-smoothstep(.55,1.,r));
float contact=exp(-r*r*30.)*(1.-smoothstep(.01,.06,age));
float a=(crown*.5+contact*.35)*smoothstep(0.,.012,age)*(1.-smoothstep(.05,.16,age))*flatness*uFade;
a*=1.-smoothstep(3500.,8500.,distance(p,uCam));
o=vec4(vec3(.72,.81,.87)*a,a);
}`;
