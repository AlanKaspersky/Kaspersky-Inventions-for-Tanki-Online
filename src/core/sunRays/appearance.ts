/** Artistic temperature tint, neutral at 6500 K. It does not claim spectral rendering. */
export function temperatureTint(kelvin:number):[number,number,number]{
    const k=Number.isFinite(kelvin)?Math.max(2500,Math.min(10000,kelvin)):6500;
    if(k<=6500){const t=(6500-k)/4000;return [1,1-.45*t,1-.74*t];}
    const t=(k-6500)/3500;return [1-.28*t,1-.15*t,1];
}
