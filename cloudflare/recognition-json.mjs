/** Lossless container decoding only. Never repair a field or extract JSON
 * from a mixed prose response. The upstream raw remains separately retained. */
export function parseRecognitionJson(content){
 if(typeof content!=='string')throw Error('RECOGNITION_JSON_STRING_REQUIRED')
 const text=content.trim(),fence=/^```(?:json)?\s*\n([\s\S]*?)\n```$/u.exec(text)
 const value=JSON.parse(fence?fence[1]:text)
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('RECOGNITION_JSON_OBJECT_REQUIRED')
 return value
}
