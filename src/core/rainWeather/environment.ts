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

/** A native map title is available in matchmaking even when the optional
 * lobby BattleCreateParameters/theme event never fires. Missing theme is not
 * a reason to block rain. Titles here come from BattleStatistics, not a custom
 * battle name. Explicit native themes take precedence over title markers. */
export function mapWeather(theme:MapTheme|undefined,name:unknown,nativeSnow=false):'rain'|'snow'|null|undefined{
 if(theme==='SPACE')return null;
 if(theme==='WINTER_DAY'||theme==='WINTER_NIGHT')return 'snow';
 if(typeof name!=='string'||!name.trim())return undefined;
 if(!theme){
  const words=name.normalize('NFKC').toLowerCase().split(/[^a-zа-яё]+/u);
  if(words.some(word=>['space','космос','космический','космическая'].includes(word)))return null;
  if(nativeSnow===true)return 'snow';
  if(words.some(word=>['winter','snow','snowy','зима','зимний','зимняя','зимнее','зимние','снег','снежный','снежная','снежное'].includes(word)))return 'snow';
 }
 return mapAllowsPuddles(name)?'rain':null;
}
