
export class SlashCommandViewModel {
    constructor(
        public readonly command: string[],
        public readonly title: string,
        public readonly description: string
    ) {
    }
}