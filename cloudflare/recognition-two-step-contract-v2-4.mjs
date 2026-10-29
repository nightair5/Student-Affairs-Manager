import {twoStepSchema,validateTwoStep,twoStepSystemPrompt as oldPrompt,validateExampleAlignment as validatePrevious} from './recognition-two-step-contract-v2-3.mjs'
export {twoStepSchema,validateTwoStep}
export const TWO_STEP_VERSION='recognition-two-step-2.4.0'
// The series and its topic describe a single event. The topic remains a
// literal activity-content fact, not a second event or a guessed title.
export const themeExample=['【校园影像工作坊 第三讲】\n记录城市：街区影像实践\n时间：4月9日14:00', {items:[{id:'a',kind:'活动',name:'校园影像工作坊 第三讲',quote:'校园影像工作坊 第三讲'}],facts:[{type:'活动内容',quote:'记录城市：街区影像实践',item:'a'},{type:'开始',quote:'4月9日14:00',item:'a'}],noAction:true}]
export function validateExampleAlignment(){validatePrevious();const [source,raw]=themeExample;if(!validateTwoStep(raw).valid)throw Error('EXAMPLE_SCHEMA');for(const list of [raw.items,raw.facts]){let previous=-1;for(const value of list){const at=source.indexOf(value.quote);if(at<previous||at<0)throw Error('EXAMPLE_QUOTE_NOT_LITERAL_OR_ORDERED');previous=at}}return true}
export function twoStepSystemPrompt(){validateExampleAlignment();const prompt=oldPrompt()+'\n活动系列名和分行的具体主题都要保留：系列写入同一活动名称，主题原文作为该活动的活动内容，不要拆成另一活动。\n示例：'+themeExample[0]+' => '+JSON.stringify(themeExample[1]);if(prompt.length>3000)throw Error('TWO_STEP_SYSTEM_TOO_LONG_'+prompt.length);return prompt}
