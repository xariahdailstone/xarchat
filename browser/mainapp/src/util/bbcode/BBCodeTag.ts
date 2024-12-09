import { BBCodeParseContext, BBCodeTagContent, Token } from "./BBCode";


export class BBCodeTag {
    constructor(
        public readonly tagName: string,
        public readonly hasClosingTag: boolean,
        public readonly acceptArg: boolean,
        public readonly convert: (context: BBCodeParseContext, arg: string | undefined, content: BBCodeTagContent) => (Node | Node[])) {
    }

    isValidStart(tok: Token): boolean {
        //if (tok.tagArgument && !this.acceptArg) return false;
        return true;
    }
}

