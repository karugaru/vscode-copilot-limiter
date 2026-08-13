# Copilot Limiter

Copilot Limiter is a VS Code extension that pins the subagents invoked by VS Code's Copilot Agent to one selected Copilot model.

## Features

- Select an available Copilot model with `Copilot Limiter: Select Subagent Model`
- Save the selected model ID and qualified name as the policy for `runSubagent`
- Rewrite `runSubagent`'s `tool_input.model` to the selected model with the `PreToolUse` hook in `.github/hooks/copilot-limiter.json`
- Audit launched subagents with the `SubagentStart` hook and record them in `.github/copilot-limiter/runSubagent-audit.jsonl`

## Requirements

- Visual Studio Code 1.125.0 or later
- Signed in to GitHub Copilot Chat
- Copilot models available through the Language Model API

## Usage

1. Install the extension in an Extension Development Host or from a VSIX.
2. Run `Copilot Limiter: Select Subagent Model` from the Command Palette.
3. Select the Copilot model to allow for subagents. The model policy and hook are generated.
4. Invoke a subagent from the regular Copilot Agent. The hook rewrites the `runSubagent` model to the selected value.

The generated hook rewrites the model input before `runSubagent` runs. It targets the current VS Code tool name when it is `runSubagent`, `agent/runSubagent`, or an equivalent name, and records the actual tool name, requested model, and enforced model in the audit log.

When you configure a different model, the selection command updates the model policy and hook. If you edit the configuration file directly, run `Copilot Limiter: Apply Model Policy`.

## Commands

- `Copilot Limiter: Select Subagent Model`: Select a Copilot model and generate or update the model policy and hook
- `Copilot Limiter: Apply Model Policy`: Regenerate the model policy and hook from the current settings
- `Copilot Limiter: Show Policy Status`: Show the current model ID and display name

## Settings

- `copilotLimiter.subagentModelId`: The exact ID of the selected Copilot model. This is normally set by the selection command.
- `copilotLimiter.subagentModelName`: The qualified model name passed to the hook. This is normally set by the selection command.

## Hook Limitations

Agent hooks are a Preview feature. Because `SubagentStart` cannot change the model itself, model enforcement depends on `updatedInput` from `PreToolUse`. If VS Code changes the `runSubagent` input schema or tool name in the future, check the audit log and Agent Debug Logs and update the hook as needed.

If the hook is not loaded or the `runSubagent` input is not an object, the hook rejects the request instead of guessing a model and executing it. This enforcement path is unavailable in environments where Agent hooks are disabled by organizational policy.

To disable the generated hook, delete `.github/hooks/copilot-limiter.json` and, if necessary, `.github/copilot-limiter`.

## API Limitations

Without a hook, the public VS Code extension API cannot monitor calls to the standard Copilot Agent's internal `runSubagent` from the side. This extension is intended for workspaces where the hook is enabled.

If you need to govern all sessions across an organization, use the organization-wide AI policies for VS Code and GitHub Copilot as well.

## Development

```powershell
npm install
npm run compile
npm run lint
npm test
```

Press `F5` to launch an Extension Development Host, then select a model from the Command Palette to verify the behavior.

## Release Notes

### 0.0.1

- Initial implementation of Copilot Limiter
