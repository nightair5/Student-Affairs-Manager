// GENERATED from src/recognition/schema.ts; do not edit.
// source-sha256: 81f636bcf62a4e35221ba7e620a0410b3cc39bbf7481882e42ab1222839eab40
const categories = new Set(['比赛', '保研', '课程', '老师任务', '其他']);
const inferenceLevels = new Set(['explicit', 'strong_inference', 'optional_suggestion']);
const priorities = new Set(['low', 'medium', 'high', 'urgent']);
const timePointTypes = new Set([
    'registration_deadline', 'submission_deadline', 'task_deadline', 'event_start',
    'event_end', 'result_announcement', 'planned_start',
]);
const notificationTypes = new Set([
    'new_project', 'project_addendum', 'project_correction', 'course_assignment', 'teacher_task',
    'event_notice', 'meeting_notice', 'material_submission', 'registration_notice', 'result_notice',
    'information_only', 'uncertain',
]);
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isStringArray(value, max = 50) {
    return Array.isArray(value) && value.length <= max && value.every((item) => typeof item === 'string' && item.trim().length > 0);
}
function boundedString(value, max, allowEmpty = false) {
    return typeof value === 'string' && value.length <= max && (allowEmpty || value.trim().length > 0);
}
function confidence(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}
function optionalBoolean(value) {
    return value === undefined || typeof value === 'boolean';
}
function validTask(value) {
    if (!isRecord(value))
        return false;
    return boundedString(value.tempId, 100)
        && (value.parentTempId === null || boundedString(value.parentTempId, 100))
        && (value.hierarchyType === 'task' || value.hierarchyType === 'subtask')
        && boundedString(value.title, 80)
        && boundedString(value.actionVerb, 20)
        && boundedString(value.actionObject, 80)
        && boundedString(value.description, 800, true)
        && isStringArray(value.completionCriteria, 12)
        && (value.estimatedMinutes === null || (typeof value.estimatedMinutes === 'number' && value.estimatedMinutes >= 5 && value.estimatedMinutes <= 10_080))
        && value.statusSuggestion === 'todo'
        && priorities.has(String(value.prioritySuggestion))
        && isStringArray(value.dependencyTempIds, 20)
        && isStringArray(value.materialTempIds, 20)
        && isStringArray(value.timePointTempIds, 20)
        && isStringArray(value.evidenceIds, 20)
        && confidence(value.confidence)
        && inferenceLevels.has(String(value.inferenceLevel))
        && typeof value.userConfirmationRequired === 'boolean'
        && optionalBoolean(value.selected);
}
function validTimePoint(value) {
    if (!isRecord(value))
        return false;
    return boundedString(value.tempId, 100)
        && timePointTypes.has(String(value.type))
        && boundedString(value.rawText, 160)
        && (value.normalizedValue === null || (boundedString(value.normalizedValue, 80) && !Number.isNaN(new Date(value.normalizedValue).getTime())))
        && boundedString(value.timezone, 80, true)
        && typeof value.isAllDay === 'boolean'
        && ['exact', 'date_only', 'relative', 'vague'].includes(String(value.precision))
        && typeof value.needsConfirmation === 'boolean'
        && isStringArray(value.relatedTaskTempIds, 30)
        && isStringArray(value.relatedMaterialTempIds, 30)
        && isStringArray(value.evidenceIds, 20)
        && confidence(value.confidence)
        && optionalBoolean(value.selected);
}
function validMaterial(value) {
    if (!isRecord(value))
        return false;
    return boundedString(value.tempId, 100)
        && boundedString(value.name, 160)
        && typeof value.required === 'boolean'
        && isStringArray(value.formatRequirements, 20)
        && isStringArray(value.namingRequirements, 20)
        && (value.quantity === null || (typeof value.quantity === 'number' && Number.isFinite(value.quantity)))
        && (value.submissionChannel === null || boundedString(value.submissionChannel, 160))
        && isStringArray(value.relatedTaskTempIds, 30)
        && isStringArray(value.evidenceIds, 20)
        && confidence(value.confidence)
        && optionalBoolean(value.selected);
}
function validEvent(value) {
    if (!isRecord(value))
        return false;
    return boundedString(value.tempId, 100)
        && boundedString(value.title, 160)
        && boundedString(value.description, 800, true)
        && (value.startTimePointTempId === null || boundedString(value.startTimePointTempId, 100))
        && (value.endTimePointTempId === null || boundedString(value.endTimePointTempId, 100))
        && (value.location === null || boundedString(value.location, 200))
        && isStringArray(value.evidenceIds, 20)
        && confidence(value.confidence)
        && inferenceLevels.has(String(value.inferenceLevel))
        && optionalBoolean(value.selected);
}
function validEvidence(value) {
    if (!isRecord(value))
        return false;
    const box = value.boundingBox;
    return boundedString(value.id, 100)
        && boundedString(value.sourceId, 100)
        && boundedString(value.quote ?? value.quotedText, 500)
        && ['title', 'deadline', 'materials', 'description', 'project', 'milestone', 'event', 'requirement'].includes(String(value.field))
        && (value.page === undefined || (typeof value.page === 'number' && Number.isFinite(value.page)))
        && (value.textStart === undefined || (typeof value.textStart === 'number' && Number.isFinite(value.textStart)))
        && (value.textEnd === undefined || (typeof value.textEnd === 'number' && Number.isFinite(value.textEnd)))
        && (box === undefined || (isRecord(box) && ['x', 'y', 'width', 'height'].every((key) => typeof box[key] === 'number' && Number.isFinite(box[key]))))
        && (value.extractionMethod === undefined || ['manual', 'demo', 'ocr', 'parser', 'ai'].includes(String(value.extractionMethod)))
        && (value.confidence === undefined || confidence(value.confidence));
}
function uniqueNonEmptyIds(values) {
    const ids = values.map((item) => isRecord(item) ? item.tempId : null);
    return ids.every((id) => boundedString(id, 100)) && new Set(ids).size === ids.length;
}
export const RECOGNITION_REPAIR_CONTRACT = Object.freeze({
    maxAttempts: 1,
    requireStrictValidationAfterRepair: true,
    requireEvidenceQuoteInSource: true,
    allowNewSemanticEntities: false,
    allowFailureDeletion: false,
});
function requiredFieldIssues(value) {
    const issues = [];
    const requireFields = (record, path, fields, allowedFields = fields) => {
        if (!isRecord(record))
            return;
        fields.forEach((field) => {
            if (!Object.hasOwn(record, field)) {
                issues.push({ category: 'schema', code: 'REQUIRED_FIELD_MISSING', path: path ? `${path}.${field}` : field });
            }
        });
        Object.keys(record).forEach((field) => {
            if (!allowedFields.includes(field)) {
                issues.push({ category: 'schema', code: 'UNKNOWN_FIELD', path: path ? `${path}.${field}` : field });
            }
        });
    };
    requireFields(value, '', [
        'schemaVersion', 'promptVersion', 'modelName', 'createdAt', 'sourceSummary', 'projectMatch',
        'projectSuggestion', 'milestones', 'standaloneTasks', 'materials', 'timePoints', 'events',
        'evidence', 'conflicts', 'ambiguities', 'ignoredContent', 'quality',
    ]);
    if (!isRecord(value))
        return issues;
    requireFields(value.sourceSummary, 'sourceSummary', [
        'title', 'sourceType', 'notificationType', 'summary', 'requiresAction', 'actionReason',
    ]);
    requireFields(value.projectMatch, 'projectMatch', [
        'decision', 'matchedProjectId', 'suggestedProjectTitle', 'confidence', 'reasons',
    ]);
    requireFields(value.quality, 'quality', [
        'overallConfidence', 'hierarchyConfidence', 'dateConfidence', 'evidenceCoverage', 'duplicateRisk',
        'overFragmentationRisk', 'missingActionRisk', 'needsHumanReview', 'reviewReasons',
    ]);
    const requireArrayItems = (items, path, fields, allowedFields = fields) => {
        if (!Array.isArray(items))
            return;
        items.forEach((item, index) => requireFields(item, `${path}[${index}]`, fields, allowedFields));
    };
    const taskFields = [
        'tempId', 'parentTempId', 'hierarchyType', 'title', 'actionVerb', 'actionObject', 'description',
        'completionCriteria', 'estimatedMinutes', 'statusSuggestion', 'prioritySuggestion',
        'dependencyTempIds', 'materialTempIds', 'timePointTempIds', 'evidenceIds', 'confidence',
        'inferenceLevel', 'userConfirmationRequired',
    ];
    requireArrayItems(value.standaloneTasks, 'standaloneTasks', taskFields, [...taskFields, 'selected']);
    const materialFields = [
        'tempId', 'name', 'required', 'formatRequirements', 'namingRequirements', 'quantity',
        'submissionChannel', 'relatedTaskTempIds', 'evidenceIds', 'confidence',
    ];
    requireArrayItems(value.materials, 'materials', materialFields, [...materialFields, 'selected']);
    const timePointFields = [
        'tempId', 'type', 'rawText', 'normalizedValue', 'timezone', 'isAllDay', 'precision',
        'needsConfirmation', 'relatedTaskTempIds', 'relatedMaterialTempIds', 'evidenceIds', 'confidence',
    ];
    requireArrayItems(value.timePoints, 'timePoints', timePointFields, [...timePointFields, 'selected']);
    const eventFields = [
        'tempId', 'title', 'description', 'startTimePointTempId', 'endTimePointTempId', 'location',
        'evidenceIds', 'confidence', 'inferenceLevel',
    ];
    requireArrayItems(value.events, 'events', eventFields, [...eventFields, 'selected']);
    requireArrayItems(value.evidence, 'evidence', ['id', 'sourceId', 'quote', 'field'], ['id', 'sourceId', 'quote', 'quotedText', 'field', 'page', 'textStart', 'textEnd', 'boundingBox', 'extractionMethod', 'confidence']);
    requireArrayItems(value.conflicts, 'conflicts', [
        'id', 'type', 'message', 'entityTempIds', 'evidenceIds', 'requiresDecision',
    ]);
    requireArrayItems(value.ambiguities, 'ambiguities', ['id', 'field', 'message', 'options', 'evidenceIds']);
    requireArrayItems(value.ignoredContent, 'ignoredContent', ['text', 'reason']);
    if (Array.isArray(value.milestones)) {
        value.milestones.forEach((milestone, milestoneIndex) => {
            const milestonePath = `milestones[${milestoneIndex}]`;
            requireFields(milestone, milestonePath, ['tempId', 'title', 'objective', 'order', 'evidenceIds', 'workPackages', 'tasks']);
            if (!isRecord(milestone))
                return;
            requireArrayItems(milestone.tasks, `${milestonePath}.tasks`, taskFields, [...taskFields, 'selected']);
            if (Array.isArray(milestone.workPackages)) {
                milestone.workPackages.forEach((workPackage, workPackageIndex) => {
                    const workPackagePath = `${milestonePath}.workPackages[${workPackageIndex}]`;
                    requireFields(workPackage, workPackagePath, ['tempId', 'title', 'objective', 'order', 'evidenceIds', 'tasks']);
                    if (isRecord(workPackage))
                        requireArrayItems(workPackage.tasks, `${workPackagePath}.tasks`, taskFields, [...taskFields, 'selected']);
                });
            }
        });
    }
    if (isRecord(value.projectSuggestion)) {
        const projectSuggestion = value.projectSuggestion;
        const projectFields = ['title', 'category', 'objective', 'description'];
        requireFields(projectSuggestion, 'projectSuggestion', projectFields);
        projectFields.forEach((field) => {
            requireFields(projectSuggestion[field], `projectSuggestion.${field}`, [
                'value', 'evidenceIds', 'confidence', 'inferenceLevel',
            ]);
        });
    }
    return issues;
}
function isValidCalendarDateTime(value) {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/u);
    if (!match)
        return false;
    const [, yearText, monthText, dayText, hourText = '00', minuteText = '00', secondText = '00'] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText);
    if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59)
        return false;
    return day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function collectSemanticIssues(value, options) {
    const issues = [];
    value.timePoints.forEach((point, index) => {
        if (point.normalizedValue !== null && !isValidCalendarDateTime(point.normalizedValue)) {
            issues.push({ category: 'semantic', code: 'TIME_POINT_NORMALIZED_VALUE_INVALID', path: `timePoints[${index}].normalizedValue` });
        }
    });
    if (typeof options.sourceContent === 'string') {
        value.evidence.forEach((evidence, index) => {
            if (!options.sourceContent?.includes(evidence.quote)) {
                issues.push({ category: 'semantic', code: 'EVIDENCE_QUOTE_NOT_IN_SOURCE', path: `evidence[${index}].quote`, referenceId: evidence.id });
            }
        });
    }
    return issues;
}
function semanticEntitySignatures(value) {
    if (!isRecord(value))
        return new Set();
    const signatures = new Set();
    const add = (kind, item, fields) => {
        if (!isRecord(item))
            return;
        const values = fields.map((field) => typeof item[field] === 'string' ? item[field].trim() : '');
        if (values.some(Boolean))
            signatures.add(`${kind}:${values.join('|')}`);
    };
    const addTasks = (tasks) => {
        if (Array.isArray(tasks))
            tasks.forEach((task) => add('task', task, ['title', 'actionVerb', 'actionObject']));
    };
    addTasks(value.standaloneTasks);
    if (Array.isArray(value.milestones)) {
        value.milestones.forEach((milestone) => {
            if (!isRecord(milestone))
                return;
            add('milestone', milestone, ['title', 'objective']);
            addTasks(milestone.tasks);
            if (Array.isArray(milestone.workPackages)) {
                milestone.workPackages.forEach((workPackage) => {
                    add('workPackage', workPackage, ['title', 'objective']);
                    if (isRecord(workPackage))
                        addTasks(workPackage.tasks);
                });
            }
        });
    }
    if (Array.isArray(value.materials))
        value.materials.forEach((item) => add('material', item, ['name']));
    if (Array.isArray(value.timePoints))
        value.timePoints.forEach((item) => add('timePoint', item, ['type', 'rawText', 'normalizedValue']));
    if (Array.isArray(value.events))
        value.events.forEach((item) => add('event', item, ['title', 'description']));
    if (Array.isArray(value.evidence))
        value.evidence.forEach((item) => add('evidence', item, ['quote', 'quotedText']));
    return signatures;
}
function failureSignatures(value) {
    if (!isRecord(value))
        return new Set();
    const signatures = new Set();
    const add = (kind, items) => {
        if (!Array.isArray(items))
            return;
        items.forEach((item) => {
            if (!isRecord(item))
                return;
            const id = typeof item.id === 'string' ? item.id.trim() : '';
            const message = typeof item.message === 'string' ? item.message.trim() : '';
            if (id || message)
                signatures.add(`${kind}:${id}|${message}`);
        });
    };
    add('conflict', value.conflicts);
    add('ambiguity', value.ambiguities);
    return signatures;
}
function collectReferenceIssues(result) {
    const issues = [];
    const tasks = [
        ...result.standaloneTasks,
        ...result.milestones.flatMap((milestone) => [
            ...milestone.tasks,
            ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks),
        ]),
    ];
    const taskIds = new Set(tasks.map((item) => item.tempId));
    const materialIds = new Set(result.materials.map((item) => item.tempId));
    const timePointIds = new Set(result.timePoints.map((item) => item.tempId));
    const evidenceIds = new Set(result.evidence.map((item) => item.id));
    const entityIds = new Set([
        ...taskIds,
        ...materialIds,
        ...timePointIds,
        ...result.events.map((item) => item.tempId),
        ...result.milestones.map((item) => item.tempId),
        ...result.milestones.flatMap((item) => item.workPackages.map((workPackage) => workPackage.tempId)),
    ]);
    const missing = (ids, existing, code, path) => {
        ids.forEach((id, index) => {
            if (!existing.has(id))
                issues.push({ category: 'reference', code, path: `${path}[${index}]`, referenceId: id });
        });
    };
    if (result.projectSuggestion) {
        Object.entries(result.projectSuggestion).forEach(([key, field]) => {
            missing(field.evidenceIds, evidenceIds, 'PROJECT_EVIDENCE_MISSING', `projectSuggestion.${key}.evidenceIds`);
        });
    }
    result.milestones.forEach((milestone, milestoneIndex) => {
        missing(milestone.evidenceIds, evidenceIds, 'MILESTONE_EVIDENCE_MISSING', `milestones[${milestoneIndex}].evidenceIds`);
        milestone.workPackages.forEach((workPackage, workPackageIndex) => {
            missing(workPackage.evidenceIds, evidenceIds, 'WORK_PACKAGE_EVIDENCE_MISSING', `milestones[${milestoneIndex}].workPackages[${workPackageIndex}].evidenceIds`);
        });
    });
    tasks.forEach((task, taskIndex) => {
        if (task.parentTempId !== null && !taskIds.has(task.parentTempId)) {
            issues.push({ category: 'reference', code: 'TASK_PARENT_MISSING', path: `tasks[${taskIndex}].parentTempId`, referenceId: task.parentTempId });
        }
        missing(task.dependencyTempIds, taskIds, 'TASK_DEPENDENCY_MISSING', `tasks[${taskIndex}].dependencyTempIds`);
        missing(task.materialTempIds, materialIds, 'TASK_MATERIAL_MISSING', `tasks[${taskIndex}].materialTempIds`);
        missing(task.timePointTempIds, timePointIds, 'TASK_TIME_POINT_MISSING', `tasks[${taskIndex}].timePointTempIds`);
        missing(task.evidenceIds, evidenceIds, 'TASK_EVIDENCE_MISSING', `tasks[${taskIndex}].evidenceIds`);
    });
    result.materials.forEach((material, materialIndex) => {
        missing(material.relatedTaskTempIds, taskIds, 'MATERIAL_TASK_MISSING', `materials[${materialIndex}].relatedTaskTempIds`);
        missing(material.evidenceIds, evidenceIds, 'MATERIAL_EVIDENCE_MISSING', `materials[${materialIndex}].evidenceIds`);
    });
    result.timePoints.forEach((point, pointIndex) => {
        missing(point.relatedTaskTempIds, taskIds, 'TIME_POINT_TASK_MISSING', `timePoints[${pointIndex}].relatedTaskTempIds`);
        missing(point.relatedMaterialTempIds, materialIds, 'TIME_POINT_MATERIAL_MISSING', `timePoints[${pointIndex}].relatedMaterialTempIds`);
        missing(point.evidenceIds, evidenceIds, 'TIME_POINT_EVIDENCE_MISSING', `timePoints[${pointIndex}].evidenceIds`);
    });
    result.events.forEach((event, eventIndex) => {
        if (event.startTimePointTempId !== null && !timePointIds.has(event.startTimePointTempId)) {
            issues.push({ category: 'reference', code: 'EVENT_TIME_POINT_MISSING', path: `events[${eventIndex}].startTimePointTempId`, referenceId: event.startTimePointTempId });
        }
        if (event.endTimePointTempId !== null && !timePointIds.has(event.endTimePointTempId)) {
            issues.push({ category: 'reference', code: 'EVENT_TIME_POINT_MISSING', path: `events[${eventIndex}].endTimePointTempId`, referenceId: event.endTimePointTempId });
        }
        missing(event.evidenceIds, evidenceIds, 'EVENT_EVIDENCE_MISSING', `events[${eventIndex}].evidenceIds`);
    });
    result.conflicts.forEach((conflict, conflictIndex) => {
        missing(conflict.entityTempIds, entityIds, 'CONFLICT_ENTITY_MISSING', `conflicts[${conflictIndex}].entityTempIds`);
        missing(conflict.evidenceIds, evidenceIds, 'CONFLICT_EVIDENCE_MISSING', `conflicts[${conflictIndex}].evidenceIds`);
    });
    result.ambiguities.forEach((ambiguity, ambiguityIndex) => {
        missing(ambiguity.evidenceIds, evidenceIds, 'AMBIGUITY_EVIDENCE_MISSING', `ambiguities[${ambiguityIndex}].evidenceIds`);
    });
    return issues;
}
function hasRecognitionResultShape(value) {
    if (!isRecord(value) || value.schemaVersion !== '2.0')
        return false;
    if (!boundedString(value.promptVersion, 80) || !boundedString(value.modelName, 80) || !boundedString(value.createdAt, 80))
        return false;
    if (!isRecord(value.sourceSummary) || !boundedString(value.sourceSummary.title, 160)
        || !boundedString(value.sourceSummary.sourceType, 30)
        || !notificationTypes.has(String(value.sourceSummary.notificationType))
        || !boundedString(value.sourceSummary.summary, 800, true)
        || typeof value.sourceSummary.requiresAction !== 'boolean'
        || !boundedString(value.sourceSummary.actionReason, 300, true))
        return false;
    if (!isRecord(value.projectMatch)
        || !['new_project', 'existing_project', 'standalone_task', 'uncertain'].includes(String(value.projectMatch.decision))
        || !(value.projectMatch.matchedProjectId === null || boundedString(value.projectMatch.matchedProjectId, 100))
        || !(value.projectMatch.suggestedProjectTitle === null || boundedString(value.projectMatch.suggestedProjectTitle, 160))
        || !confidence(value.projectMatch.confidence)
        || !isStringArray(value.projectMatch.reasons, 12))
        return false;
    if (value.projectSuggestion !== null) {
        if (!isRecord(value.projectSuggestion))
            return false;
        for (const key of ['title', 'category', 'objective', 'description']) {
            const field = value.projectSuggestion[key];
            if (!isRecord(field) || !isStringArray(field.evidenceIds, 20) || !confidence(field.confidence)
                || !inferenceLevels.has(String(field.inferenceLevel)))
                return false;
        }
        if (!boundedString(value.projectSuggestion.title.value, 160)
            || !categories.has(String(value.projectSuggestion.category.value))
            || !boundedString(value.projectSuggestion.objective.value, 500, true)
            || !boundedString(value.projectSuggestion.description.value, 1000, true))
            return false;
    }
    if (!Array.isArray(value.milestones) || value.milestones.length > 10)
        return false;
    for (const milestone of value.milestones) {
        if (!isRecord(milestone) || !boundedString(milestone.tempId, 100) || !boundedString(milestone.title, 100)
            || !boundedString(milestone.objective, 300, true) || typeof milestone.order !== 'number'
            || !isStringArray(milestone.evidenceIds, 20) || !Array.isArray(milestone.workPackages)
            || milestone.workPackages.length > 8 || !Array.isArray(milestone.tasks)
            || milestone.tasks.length > 20 || !milestone.tasks.every(validTask))
            return false;
        for (const workPackage of milestone.workPackages) {
            if (!isRecord(workPackage) || !boundedString(workPackage.tempId, 100) || !boundedString(workPackage.title, 100)
                || !boundedString(workPackage.objective, 300, true) || typeof workPackage.order !== 'number'
                || !isStringArray(workPackage.evidenceIds, 20) || !Array.isArray(workPackage.tasks)
                || workPackage.tasks.length > 20 || !workPackage.tasks.every(validTask))
                return false;
        }
    }
    if (!Array.isArray(value.standaloneTasks) || value.standaloneTasks.length > 20 || !value.standaloneTasks.every(validTask))
        return false;
    if (!Array.isArray(value.materials) || value.materials.length > 60 || !value.materials.every(validMaterial))
        return false;
    if (!Array.isArray(value.timePoints) || value.timePoints.length > 60 || !value.timePoints.every(validTimePoint))
        return false;
    if (!Array.isArray(value.events) || value.events.length > 30 || !value.events.every(validEvent))
        return false;
    if (!Array.isArray(value.evidence) || value.evidence.length > 120 || !value.evidence.every(validEvidence))
        return false;
    if (!Array.isArray(value.conflicts) || !value.conflicts.every((item) => isRecord(item)
        && boundedString(item.id, 100) && ['deadline', 'project_match', 'duplicate', 'hierarchy', 'other'].includes(String(item.type))
        && boundedString(item.message, 500) && isStringArray(item.entityTempIds, 30)
        && isStringArray(item.evidenceIds, 20) && typeof item.requiresDecision === 'boolean'))
        return false;
    if (!Array.isArray(value.ambiguities) || !value.ambiguities.every((item) => isRecord(item)
        && boundedString(item.id, 100) && boundedString(item.field, 100) && boundedString(item.message, 500)
        && isStringArray(item.options, 20) && isStringArray(item.evidenceIds, 20)))
        return false;
    if (!Array.isArray(value.ignoredContent) || !value.ignoredContent.every((item) => isRecord(item)
        && boundedString(item.text, 1000, true)
        && ['background', 'contact', 'address', 'policy', 'format_requirement', 'other'].includes(String(item.reason))))
        return false;
    if (!isRecord(value.quality))
        return false;
    const quality = value.quality;
    if (!['overallConfidence', 'hierarchyConfidence', 'dateConfidence', 'evidenceCoverage', 'duplicateRisk', 'overFragmentationRisk', 'missingActionRisk']
        .every((key) => confidence(quality[key]))
        || typeof quality.needsHumanReview !== 'boolean'
        || !isStringArray(quality.reviewReasons, 20))
        return false;
    return true;
}
export function validateRecognitionResult(value, options = {}) {
    const missingFields = requiredFieldIssues(value);
    if (missingFields.length)
        return { valid: false, failureCategory: 'schema', issues: missingFields };
    if (!hasRecognitionResultShape(value)) {
        return {
            valid: false,
            failureCategory: 'schema',
            issues: [{ category: 'schema', code: 'SCHEMA_INVALID', path: '$' }],
        };
    }
    const allTempEntities = [
        ...value.milestones,
        ...value.milestones.flatMap((milestone) => milestone.workPackages),
        ...value.milestones.flatMap((milestone) => [...milestone.tasks, ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks)]),
        ...value.standaloneTasks,
        ...value.materials,
        ...value.timePoints,
        ...value.events,
    ];
    const schemaIssues = [];
    if (!uniqueNonEmptyIds(allTempEntities)) {
        schemaIssues.push({ category: 'schema', code: 'DUPLICATE_ENTITY_ID', path: '$' });
    }
    if (new Set(value.evidence.map((item) => item.id)).size !== value.evidence.length) {
        schemaIssues.push({ category: 'schema', code: 'DUPLICATE_EVIDENCE_ID', path: 'evidence' });
    }
    if (schemaIssues.length)
        return { valid: false, failureCategory: 'schema', issues: schemaIssues };
    const referenceIssues = collectReferenceIssues(value);
    if (referenceIssues.length)
        return { valid: false, failureCategory: 'reference', issues: referenceIssues };
    const semanticIssues = collectSemanticIssues(value, options);
    if (semanticIssues.length)
        return { valid: false, failureCategory: 'semantic', issues: semanticIssues };
    return { valid: true, failureCategory: null, issues: [] };
}
export function isRecognitionResult(value) {
    return validateRecognitionResult(value).valid;
}
export function parseRecognitionResult(value) {
    if (!isRecognitionResult(value))
        throw new Error('DeepSeek 返回的 RecognitionResult 2.0 结构无效');
    return value;
}
export function validateRecognitionRepair(before, after, options) {
    if (options.attempt !== 1) {
        return {
            valid: false,
            harm: true,
            validation: {
                valid: false,
                failureCategory: 'semantic',
                issues: [{ category: 'semantic', code: 'REPAIR_ATTEMPT_LIMIT_EXCEEDED', path: '$' }],
            },
        };
    }
    const validation = validateRecognitionResult(after, { sourceContent: options.sourceContent });
    if (!validation.valid)
        return { valid: false, harm: false, validation };
    const beforeSignatures = semanticEntitySignatures(before);
    const added = [...semanticEntitySignatures(after)].filter((signature) => !beforeSignatures.has(signature));
    if (added.length) {
        return {
            valid: false,
            harm: true,
            validation: {
                valid: false,
                failureCategory: 'semantic',
                issues: [{ category: 'semantic', code: 'REPAIR_NEW_SEMANTIC_ENTITY_FORBIDDEN', path: '$' }],
            },
        };
    }
    const afterFailures = failureSignatures(after);
    const deletedFailures = [...failureSignatures(before)].filter((signature) => !afterFailures.has(signature));
    if (deletedFailures.length) {
        return {
            valid: false,
            harm: true,
            validation: {
                valid: false,
                failureCategory: 'semantic',
                issues: [{ category: 'semantic', code: 'REPAIR_FAILURE_DELETION_FORBIDDEN', path: '$' }],
            },
        };
    }
    return { valid: true, harm: false, validation };
}
