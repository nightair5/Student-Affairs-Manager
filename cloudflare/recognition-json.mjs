/** Lossless container decoding only. Never repair a field or extract JSON
 * from a mixed prose response. The upstream raw remains separately retained. */
export function parseRecognitionJson(content){
 if(typeof content!=='string')throw Error('RECOGNITION_JSON_STRING_REQUIRED')
 // A whole JSON code fence may use an uppercase language label or place
 // the object on the same line. Still parse the entire enclosed value:
 // prose, multiple containers and malformed JSON remain errors.
 const text=content.trim(),fence=/^```(?:json)?[ \t]*(?:\r?\n)?([\s\S]*?)(?:\r?\n)?[ \t]*```$/iu.exec(text)
 const value=JSON.parse(fence?fence[1]:text)
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('RECOGNITION_JSON_OBJECT_REQUIRED')
 return value
}
