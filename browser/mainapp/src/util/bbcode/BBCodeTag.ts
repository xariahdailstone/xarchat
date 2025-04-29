import { BBCodeParseContext, BBCodeTagContent, Token } from "./BBCode";


export class BBCodeTag {

    constructor(options: BBCodeTagOptions);
    constructor(
        tagName: string,
        hasClosingTag: boolean,
        acceptArg: boolean,
        convert: BBCodeConvertFunc);
    constructor(
        optionsOrtagName: unknown,
        hasClosingTag?: boolean,
        acceptArg?: boolean,
        convert?: BBCodeConvertFunc) {

        let options: BBCodeTagOptions;

        if (typeof optionsOrtagName == 'string') {
            options = {
                tagName: optionsOrtagName,
                hasClosingTag: hasClosingTag as boolean,
                acceptArg: acceptArg as boolean,
                convert: convert as BBCodeConvertFunc
            };
        }
        else {
            options = optionsOrtagName as BBCodeTagOptions;
        }

        this._options = { ...options };
    }

    private _options: BBCodeTagOptions;

    get tagName(): String { return this._options.tagName; }
    get hasClosingTag(): boolean { return this._options.hasClosingTag; }
    get acceptArg(): boolean { return this._options.acceptArg; }
    get convert(): BBCodeConvertFunc { return this._options.convert; }
    get disallowedContainedTags(): string[] | undefined { return this._options.disallowedContainedTags; }

    isAllowedContainedTag(tagName: string) {
        if (this.disallowedContainedTags) {
            for (let v of this.disallowedContainedTags) {
                if (tagName.toLowerCase() == v.toLowerCase()) {
                    return false;
                }
            }
        }
        return true;
    }

    isValidStart(tok: Token): boolean {
        //if (tok.tagArgument && !this.acceptArg) return false;
        return true;
    }
}

export type BBCodeConvertFunc = (context: BBCodeParseContext, arg: string | undefined, content: BBCodeTagContent) => (Node | Node[]);

export interface BBCodeTagOptions {
    tagName: string;
    hasClosingTag: boolean;
    acceptArg: boolean;
    convert: BBCodeConvertFunc;
    disallowedContainedTags?: string[];
}