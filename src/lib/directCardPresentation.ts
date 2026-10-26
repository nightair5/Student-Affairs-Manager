/** Truncates only the card view. Details and persisted titles keep the full name. */
export const directCardTitle=(title:string)=>title.length>24?title.slice(0,24)+'…':title
export function visibleDirectTags(tags:readonly string[]|undefined,shownFacts:string,title:string):string[]{
  return [...new Set(tags??[])].filter(tag=>!shownFacts.includes(tag)&&!(tag==='如符合条件'&&title.startsWith('如符合条件')))
}
