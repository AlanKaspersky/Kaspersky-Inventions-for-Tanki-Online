export const MAP_THEMES=['SUMMER_DAY','SUMMER_EVENING','SUMMER_NIGHT','AUTUMN_DAY','WINTER_DAY','WINTER_NIGHT','SPACE'] as const;
export type MapTheme=typeof MAP_THEMES[number];
/** Native map title, optionally followed by its battle-mode code. No substring
 * matching: a user-created battle name must not disable another map's puddles. */
export function mapAllowsPuddles(name:unknown):boolean{
 if(typeof name!=='string')return true;
 const title=name.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
 return !/^(?:бойня|massacre)(?:\s*(?:\(|\[)?\s*(?:dm|tdm|ctf|cp|sge|rgb|jgr|tjr|asl|ar|as|rugby|sur|holiday|tar|tutorial)\s*(?:\)|\])?)?$/.test(title);
}
export function mapTheme(value:unknown):MapTheme|undefined{
 if(typeof value==='string'&&(MAP_THEMES as readonly string[]).includes(value))return value as MapTheme;
}
/** Multiplicative linear RGB tone; keep native fog and storm density independent. */
export function cloudTone(theme:MapTheme|undefined):[number,number,number]{
 switch(theme){
  case 'SUMMER_EVENING':return [.90,.86,.85];
  case 'SUMMER_NIGHT':return [.72,.78,.90];
  case 'WINTER_NIGHT':return [.78,.84,.95];
  case 'WINTER_DAY':return [.86,.92,1.];
  case 'AUTUMN_DAY':return [.83,.81,.78];
  default:return [1,1,1];
 }
}
