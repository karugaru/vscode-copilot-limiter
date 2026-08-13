# Copilot Limiter

Copilot Limiter は、VS Code の Copilot Agent が呼び出すサブエージェントを、選択した 1 つの Copilot モデルに固定する拡張機能です。

## できること

- `Copilot Limiter: Select Subagent Model` で利用可能な Copilot モデルを選択
- 選択したモデルの ID と qualified name を runSubagent 用のポリシーへ保存
- `.github/hooks/copilot-limiter.json` の `PreToolUse` hook で `runSubagent` の `tool_input.model` を選択モデルへ書き換え
- `SubagentStart` hook で起動されたサブエージェントを監査し、`.github/copilot-limiter/runSubagent-audit.jsonl` に記録

## 必要条件

- Visual Studio Code 1.125.0 以降
- GitHub Copilot Chat にサインインしていること
- Language Model API から Copilot モデルが利用可能であること

## 使い方

1. 拡張機能を開発ホストまたは VSIX からインストールします。
2. コマンドパレットで `Copilot Limiter: Select Subagent Model` を実行します。
3. サブエージェントに許可する Copilot モデルを選択します。モデルポリシーと hook が生成されます。
4. 通常の Copilot Agent からサブエージェントを呼び出すと、hook が `runSubagent` のモデルを選択値へ書き換えます。

生成された hook は `runSubagent` の実行前にモデル入力を書き換えます。現在の VS Code のツール名が `runSubagent`、`agent/runSubagent`、または同等の名前である場合を対象にし、実際に受け取ったツール名・要求モデル・強制モデルを監査ログへ残します。

モデルを設定し直した場合は、選択コマンドがモデルポリシーと hook を更新します。設定ファイルを直接変更した場合は `Copilot Limiter: Apply Model Policy` を実行してください。

## コマンド

- `Copilot Limiter: Select Subagent Model`: Copilot モデルを選択し、モデルポリシーと hook を生成または更新
- `Copilot Limiter: Apply Model Policy`: 現在の設定からモデルポリシーと hook を再生成
- `Copilot Limiter: Show Policy Status`: 現在のモデル ID と表示名を表示

## 設定

- `copilotLimiter.subagentModelId`: 選択した Copilot モデルの厳密な ID。通常は選択コマンドが設定します。
- `copilotLimiter.subagentModelName`: hook に渡す qualified model name。通常は選択コマンドが設定します。

## Hook の制約

Agent hooks は Preview 機能です。`SubagentStart` 自体はモデルを変更できないため、モデル強制は `PreToolUse` の `updatedInput` に依存します。VS Code が将来 `runSubagent` の入力スキーマやツール名を変更した場合は、監査ログと Agent Debug Logs を確認して hook を更新してください。

hook が読み込まれていない場合や、`runSubagent` の入力がオブジェクトでない場合は、モデルを推測して実行せず拒否します。組織ポリシーで Agent hooks が無効化されている環境では、この経路の強制は使えません。

hook を生成した後に無効化するには、`.github/hooks/copilot-limiter.json` を削除し、必要に応じて `.github/copilot-limiter` を削除してください。

## API の制約

hook を使わない場合、VS Code の公開拡張 API だけでは標準 Copilot Agent の内部 `runSubagent` 呼び出しを横から監視できません。この拡張は hook が有効な workspace を対象にします。

組織全体で全セッションを統制する必要がある場合は、VS Code / GitHub Copilot の組織向け AI ポリシーを併用してください。

## 開発

```powershell
npm install
npm run compile
npm run lint
npm test
```

`F5` で Extension Development Host を起動し、コマンドパレットからモデルを選択して動作を確認できます。

## リリースノート

### 0.0.1

- Copilot Limiter の初期実装
