export interface ModelIdentity {
    readonly name: string;
    readonly vendor: string;
}

export function qualifiedModelName(model: ModelIdentity): string {
    return `${model.name} (${model.vendor})`;
}
