import * as assert from 'assert';
import { qualifiedModelName } from '../modelPolicy';

suite('Copilot Limiter model identity', () => {
    test('formats a model name with its vendor', () => {
        assert.strictEqual(
            qualifiedModelName({ name: 'GPT-5', vendor: 'copilot' }),
            'GPT-5 (copilot)',
        );
    });
});
