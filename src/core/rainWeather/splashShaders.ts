import { COMMON } from './shaders';
export const MAP_VERTEX=`#version 300 es
precision highp float;layout(location=0)in vec3 position;uniform mat4 uVP;out float worldZ;
void main(){worldZ=position.z;gl_Position=uVP*vec4(position,1.);}`;
export const MAP_FRAGMENT=`#version 300 es
precision highp float;in float worldZ;uniform vec3 uCam;
void main(){if(uCam.z<=worldZ+.5)discard;}`;
export const SPLASH_VERTEX=`#version 300 es
${COMMON}
layout(location=0)in vec3 aOrigin;layout(location=1)in vec3 aVelocity;
layout(location=2)in vec2 aTimes;layout(location=3)in vec3 aStyle;
uniform mat4 uVP;uniform vec2 uViewport;uniform vec3 uSplash;
uniform float uPuddles,uDetail;
out vec2 q;out float opacity;
void main(){
 float age=max(0.,uTime-aTimes.x),life=age/max(aTimes.y,.001);
 vec3 velocity=aVelocity*uSplash.x;float gravity=980.*uSplash.z;
 vec3 head=aOrigin+velocity*age-vec3(0.,0.,.5*gravity*age*age);
 vec3 tangent=normalize(velocity-vec3(0.,0.,gravity*age));
 vec3 side=cross(tangent,uCam-head);side=length(side)>.001?normalize(side):vec3(1.,0.,0.);
 vec4 clip=uVP*vec4(head,1.),delta=uVP*vec4(side,0.);
 float pixels=length((delta.xy*clip.w-clip.xy*delta.w)/max(.001,clip.w*clip.w)*uViewport*.5);
 float width=max(aStyle.x*uSplash.y,.55/max(pixels,.001));
 float edge=float(gl_VertexID&1)*2.-1.,along=float(gl_VertexID>>1);
 gl_Position=uVP*vec4(head-tangent*along*aStyle.y*uSplash.y+side*edge*width,1.);q=vec2(edge,along);
 opacity=smoothstep(0.,.025,age)*(1.-smoothstep(.25,1.,life))*step(0.,head.z-aOrigin.z+.5)*uRain*uFade;
}`;
export const SPLASH_FRAGMENT=`#version 300 es
precision highp float;in vec2 q;in float opacity;out vec4 o;
void main(){float a=exp(-q.x*q.x*4.)*(1.-q.y*.75)*opacity*.6;o=vec4(vec3(.74,.84,.92)*a,a);}`;
