import {useEffect,useState} from 'react'

/** Refresh visible date groupings after midnight and when a background tab returns. */
export function useCurrentTime():Date {
  const [time,setTime]=useState(()=>Date.now())
  useEffect(()=>{
    const refresh=()=>setTime(Date.now())
    const interval=window.setInterval(refresh,60_000)
    document.addEventListener('visibilitychange',refresh)
    return ()=>{window.clearInterval(interval);document.removeEventListener('visibilitychange',refresh)}
  },[])
  return new Date(time)
}
