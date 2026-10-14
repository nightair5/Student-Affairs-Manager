import {resolve} from 'node:path'
import {observedSettledBatch} from './settled-batch-observed-readonly.mjs'
import {verifyRoleComparison,ROOT,BATCH,COUNT} from './afternoon-role-comparison.mjs'
export function afternoonRoleScene(){return observedSettledBatch({root:ROOT,execution:resolve('.data/afternoon-mainline-20261008/execution'),batch:BATCH,count:COUNT,verifyPacket:verifyRoleComparison})}
