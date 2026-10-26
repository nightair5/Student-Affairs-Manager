// Only already aligned facts with the same declared owner participate.
export function mergeOwnedLocations(entries,valueOf){
 const pieces=[]
 for(const e of [...entries].sort((a,b)=>a.span.start-b.span.start)){
  const value=valueOf(e.span.literal,'地点').trim()
  if(!value||pieces.some(p=>p.includes(value)))continue
  for(let i=pieces.length-1;i>=0;i--)if(value.includes(pieces[i]))pieces.splice(i,1)
  pieces.push(value)
 }
 return pieces.join(' · ').slice(0,160)
}
