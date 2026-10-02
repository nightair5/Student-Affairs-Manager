import {it,expect} from 'vitest'
import {createD26SemanticFixture} from './semanticFixture'
import {validateRecognitionResult} from '../../recognition/schema'
it('semantic bridge can enter ordinary Capture strict Schema without sidecar masquerading as result fields',async()=>{
 for(const kind of ['conditions','revision'] as const){const f=await createD26SemanticFixture(kind);expect(validateRecognitionResult(f.result).issues).toEqual([])}
})
