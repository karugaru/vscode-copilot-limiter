import { appendFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const policyPath = join(scriptDirectory, 'model-policy.json');
const auditPath = join(scriptDirectory, 'runSubagent-audit.jsonl');

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function writeOutput(value) {
    process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function readInput() {
    let input = '';
    for await (const chunk of process.stdin) {
        input += chunk;
    }
    return JSON.parse(input);
}

async function readPolicy() {
    try {
        const policy = JSON.parse(await readFile(policyPath, 'utf8'));
        if (!isRecord(policy) || typeof policy.modelName !== 'string' || !policy.modelName.trim()) {
            return undefined;
        }
        return policy;
    } catch {
        return undefined;
    }
}

function isRunSubagent(toolName, toolInput) {
    const normalizedName = String(toolName ?? '').replaceAll('\\', '/').toLowerCase();
    if (normalizedName === 'runsubagent' || normalizedName.endsWith('/runsubagent') || normalizedName.endsWith(':runsubagent') || normalizedName.endsWith('.runsubagent')) {
        return true;
    }

    return (normalizedName === 'agent' || normalizedName.endsWith('/agent'))
        && isRecord(toolInput)
        && typeof toolInput.agentName === 'string'
        && typeof toolInput.prompt === 'string';
}

async function audit(event, input, details) {
    const record = {
        timestamp: new Date().toISOString(),
        hookEventName: event,
        toolName: input.tool_name,
        toolUseId: input.tool_use_id,
        agentType: input.agent_type,
        ...details,
    };
    await appendFile(auditPath, `${JSON.stringify(record)}\n`, 'utf8').catch(() => undefined);
}

async function main() {
    let input;
    try {
        input = await readInput();
    } catch (error) {
        console.error(`Copilot Limiter could not parse hook input: ${error.message}`);
        process.exitCode = 2;
        return;
    }

    const event = String(input.hook_event_name ?? '');
    const policy = await readPolicy();

    if (event === 'SubagentStart') {
        await audit(event, input, { modelName: policy?.modelName });
        writeOutput({
            hookSpecificOutput: {
                hookEventName: 'SubagentStart',
                additionalContext: policy
                    ? `Copilot Limiter policy: use ${policy.modelName} for this subagent.`
                    : 'Copilot Limiter has no configured model policy.',
            },
        });
        return;
    }

    if (event !== 'PreToolUse' || !isRunSubagent(input.tool_name, input.tool_input)) {
        writeOutput({ continue: true });
        return;
    }

    if (!policy) {
        writeOutput({
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: 'Copilot Limiter has no configured model policy; run the model selection command first.',
            },
        });
        return;
    }

    if (!isRecord(input.tool_input)) {
        writeOutput({
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: 'The runSubagent tool input is not an object, so its model cannot be enforced.',
            },
        });
        return;
    }

    const updatedInput = { ...input.tool_input, model: policy.modelName };
    await audit(event, input, {
        requestedModel: typeof input.tool_input.model === 'string' ? input.tool_input.model : undefined,
        forcedModel: policy.modelName,
    });
    writeOutput({
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            updatedInput,
            additionalContext: `Copilot Limiter replaced the requested subagent model with ${policy.modelName}.`,
        },
    });
}

main().catch(error => {
    console.error(`Copilot Limiter hook failed: ${error.message}`);
    process.exitCode = 2;
});
