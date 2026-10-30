/** Preserve ordinary text while making explicitly provided web links usable. */
export function TextWithLinks({text}:{text:string}){
  return <>{text.split(/(https?:\/\/[^\s<>（）()【】]+)/giu).map((part,index)=>{
    if(!/^https?:\/\//iu.test(part))return part
    const url=part.replace(/[，。；、.!?]+$/u,''),tail=part.slice(url.length)
    return <span key={index}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a>{tail}</span>
  })}</>
}
