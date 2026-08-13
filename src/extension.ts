import * as vscode from 'vscode';
import { qualifiedModelName } from './modelPolicy';

const CONFIGURATION_SECTION = 'copilotLimiter';
const MODEL_ID_SETTING = 'subagentModelId';
const MODEL_NAME_SETTING = 'subagentModelName';
const SELECT_MODEL_COMMAND = 'copilot-limiter.selectSubagentModel';
const APPLY_POLICY_COMMAND = 'copilot-limiter.applyModelPolicy';
const SHOW_STATUS_COMMAND = 'copilot-limiter.showPolicyStatus';
const COPILOT_VENDOR = 'copilot';
const POLICY_DIRECTORY = '.copilot-limiter';
const POLICY_FILE = 'model-policy.json';
const HOOK_DIRECTORY = '.github/hooks';
const HOOK_CONFIGURATION_FILE = 'copilot-limiter.json';
const HOOK_SCRIPT_FILE = 'copilot-limiter-hook.mjs';
const HOOK_COMMAND = 'node .copilot-limiter/copilot-limiter-hook.mjs';

interface ConfiguredModel {
    readonly id: string;
    readonly name: string;
    readonly vendor: string;
}

function readConfiguredModel(): ConfiguredModel | undefined {
    const configuration = vscode.workspace.getConfiguration(CONFIGURATION_SECTION);
    const id = configuration.get<string>(MODEL_ID_SETTING)?.trim();
    const name = configuration.get<string>(MODEL_NAME_SETTING)?.trim();

    if (!id || !name) {
        return undefined;
    }

    return { id, name, vendor: COPILOT_VENDOR };
}

function errorMessage(error: unknown): string {
    if (error instanceof vscode.LanguageModelError) {
        return `${error.message} (${error.code})`;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

async function writeModelPolicy(context: vscode.ExtensionContext, model: ConfiguredModel): Promise<boolean> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        void vscode.window.showErrorMessage('Open a workspace folder before applying the Copilot Limiter policy.');
        return false;
    }

    const githubDirectory = vscode.Uri.joinPath(workspaceFolder.uri, '.github');
    const hookDirectory = vscode.Uri.joinPath(workspaceFolder.uri, HOOK_DIRECTORY);
    const hookConfigurationUri = vscode.Uri.joinPath(hookDirectory, HOOK_CONFIGURATION_FILE);
    const policyDirectory = vscode.Uri.joinPath(workspaceFolder.uri, POLICY_DIRECTORY);
    const policyUri = vscode.Uri.joinPath(policyDirectory, POLICY_FILE);
    const hookScriptUri = vscode.Uri.joinPath(policyDirectory, HOOK_SCRIPT_FILE);
    const hookTemplateUri = vscode.Uri.joinPath(context.extensionUri, 'resources', HOOK_SCRIPT_FILE);
    const hookScript = await vscode.workspace.fs.readFile(hookTemplateUri);
    const hookConfiguration = {
        hooks: {
            PreToolUse: [{ type: 'command', command: HOOK_COMMAND, timeout: 10 }],
            SubagentStart: [{ type: 'command', command: HOOK_COMMAND, timeout: 10 }],
        },
    };

    await vscode.workspace.fs.createDirectory(githubDirectory);
    await vscode.workspace.fs.createDirectory(hookDirectory);
    await vscode.workspace.fs.createDirectory(policyDirectory);
    await vscode.workspace.fs.writeFile(
        policyUri,
        Buffer.from(`${JSON.stringify({ modelId: model.id, modelName: model.name, vendor: model.vendor }, null, 2)}\n`, 'utf8'),
    );
    await vscode.workspace.fs.writeFile(hookScriptUri, hookScript);
    await vscode.workspace.fs.writeFile(
        hookConfigurationUri,
        Buffer.from(`${JSON.stringify(hookConfiguration, null, 2)}\n`, 'utf8'),
    );

    return true;
}

async function selectSubagentModel(context: vscode.ExtensionContext): Promise<void> {
    let models: vscode.LanguageModelChat[];
    try {
        models = await vscode.lm.selectChatModels({ vendor: COPILOT_VENDOR });
    } catch (error) {
        void vscode.window.showErrorMessage(`Could not list Copilot models: ${errorMessage(error)}`);
        return;
    }

    if (models.length === 0) {
        void vscode.window.showWarningMessage('No Copilot language models are available. Sign in to Copilot and try again.');
        return;
    }

    const items = models.map(model => ({
        label: qualifiedModelName(model),
        description: `${model.family} ${model.version}`.trim(),
        detail: model.id,
        model,
    }));
    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select the only model allowed for Copilot Limiter subagents',
        matchOnDescription: true,
        matchOnDetail: true,
    });

    if (!picked) {
        return;
    }

    const configuration = vscode.workspace.getConfiguration(CONFIGURATION_SECTION);
    await configuration.update(MODEL_ID_SETTING, picked.model.id, vscode.ConfigurationTarget.Global);
    await configuration.update(MODEL_NAME_SETTING, qualifiedModelName(picked.model), vscode.ConfigurationTarget.Global);
    const selectedModel: ConfiguredModel = {
        id: picked.model.id,
        name: qualifiedModelName(picked.model),
        vendor: picked.model.vendor,
    };
    const policyApplied = await writeModelPolicy(context, selectedModel);
    if (policyApplied) {
        void vscode.window.showInformationMessage(
            `Copilot Limiter now enforces ${selectedModel.name} for runSubagent calls.`,
        );
    }
}

async function applyModelPolicy(context: vscode.ExtensionContext): Promise<void> {
    const model = readConfiguredModel();
    if (!model) {
        void vscode.window.showErrorMessage(
            'No subagent model is configured. Run "Copilot Limiter: Select Subagent Model" first.',
        );
        return;
    }

    const policyApplied = await writeModelPolicy(context, model);
    if (policyApplied) {
        void vscode.window.showInformationMessage(`Applied the runSubagent model policy for ${model.name}.`);
    }
}

function showPolicyStatus(): void {
    const model = readConfiguredModel();
    if (!model) {
        void vscode.window.showWarningMessage('Copilot Limiter is not configured.');
        return;
    }

    void vscode.window.showInformationMessage(`Copilot Limiter model: ${model.name} (${model.id})`);
}

export function activate(context: vscode.ExtensionContext): void {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = SELECT_MODEL_COMMAND;
    statusBarItem.tooltip = 'Select the Copilot Limiter subagent model';
    statusBarItem.show();

    const updateStatusBar = (): void => {
        const model = readConfiguredModel();
        statusBarItem.text = model ? `$(shield) Limiter: ${model.name}` : '$(shield) Limiter: unset';
    };
    updateStatusBar();

    context.subscriptions.push(
        statusBarItem,
        vscode.commands.registerCommand(SELECT_MODEL_COMMAND, () => selectSubagentModel(context)),
        vscode.commands.registerCommand(APPLY_POLICY_COMMAND, () => applyModelPolicy(context)),
        vscode.commands.registerCommand(SHOW_STATUS_COMMAND, showPolicyStatus),
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration(CONFIGURATION_SECTION)) {
                updateStatusBar();
            }
        }),
    );
}

export function deactivate(): void { }
