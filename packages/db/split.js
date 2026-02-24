const fs = require('fs');

const input = fs.readFileSync('./packages/db/src/schema.ts', 'utf8');

const regexTable = /export const (\w+) = pgTable\([\s\S]*?\);\n/g;
const regexEnum = /export const (\w+) = pgEnum\([\s\S]*?\);\n/g;

const tables = {};
for (const match of input.matchAll(regexTable)) {
    tables[match[1]] = match[0];
}
const enums = {};
for (const match of input.matchAll(regexEnum)) {
    enums[match[1]] = match[0];
}

const groups = {
    enums: [
        'planEnum', 'userStatusEnum', 'crawlStatusEnum', 'issueCategoryEnum', 'issueSeverityEnum',
        'insightCategoryEnum', 'crawlScheduleEnum', 'llmProviderEnum', 'subscriptionStatusEnum',
        'paymentStatusEnum', 'integrationProviderEnum', 'eventStatusEnum', 'pipelineStatusEnum',
        'channelTypeEnum', 'scheduleFrequencyEnum', 'personaEnum', 'fixTypeEnum', 'fixStatusEnum',
        'shareLevelEnum', 'funnelStageEnum', 'keywordSourceEnum', 'discountTypeEnum', 'promoDurationEnum',
        'narrativeToneEnum', 'narrativeStatusEnum', 'reportTypeEnum', 'reportFormatEnum', 'reportStatusEnum',
        'orgRoleEnum', 'teamRoleEnum', 'alertSeverityEnum'
    ],
    identity: [
        'users', 'session', 'account', 'verification',
        'organizations', 'orgMembers', 'orgInvites',
        'auditLogs', 'adminAuditLogs',
        'teams', 'teamMembers', 'teamInvitations'
    ],
    projects: [
        'projects', 'personas', 'competitors', 'savedKeywords', 'scoringProfiles'
    ],
    crawling: [
        'crawlJobs', 'pages', 'pageScores', 'issues', 'crawlInsights', 'pageInsights',
        'discoveredLinks', 'customExtractors', 'actionItems'
    ],
    billing: [
        'subscriptions', 'payments', 'promos', 'planPriceHistory'
    ],
    features: [
        'visibilityChecks', 'competitorBenchmarks', 'projectIntegrations', 'pageEnrichments',
        'outboxEvents', 'reports', 'leads', 'notificationChannels', 'scheduledVisibilityQueries',
        'scanResults', 'apiTokens', 'contentFixes', 'reportSchedules', 'narrativeReports', 'alerts',
        'pipelineRuns', 'logUploads'
    ]
};

// Gather all items to check if we missed any
const assigned = new Set();
for (const v of Object.values(groups)) {
    for (const item of v) assigned.add(item);
}

for (const t of Object.keys(tables)) {
    if (!assigned.has(t)) groups.features.push(t);
}
for (const e of Object.keys(enums)) {
    if (!assigned.has(e)) groups.enums.push(e);
}

// Write the files
const baseImport = `import { pgTable, pgEnum, text, integer, real, boolean, timestamp, jsonb, index, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";\n\n`;

for (const [groupName, items] of Object.entries(groups)) {
    let fileContent = baseImport;

    // imports from other groups based on what is referenced
    // for simplicity in this generated AST, we just look at what words appear in the file text
    // and import from corresponding modules
    let code = "";
    for (const item of items) {
        if (tables[item]) code += tables[item] + "\n";
        if (enums[item]) code += enums[item] + "\n";
    }

    // Find references
    for (const [otherGroupName, otherItems] of Object.entries(groups)) {
        if (otherGroupName === groupName) continue;
        const requiredImports = [];
        for (const otherItem of otherItems) {
            if (code.includes(otherItem)) {
                requiredImports.push(otherItem);
            }
        }
        if (requiredImports.length > 0) {
            fileContent += `import { ${requiredImports.join(', ')} } from "./${otherGroupName}";\n`;
        }
    }

    fileContent += "\n" + code;
    fs.writeFileSync(`./packages/db/src/schema/${groupName}.ts`, fileContent);
}

// Write the index schema.ts
let indexContent = ``;
for (const groupName of Object.keys(groups)) {
    indexContent += `export * from "./schema/${groupName}";\n`;
}
fs.writeFileSync('./packages/db/src/schema.ts', indexContent);

console.log("Done splitting schema.");
