
export enum TypingStatus {
    NONE,
    TYPING,
    IDLE
}

export class TypingStatusConvert {
    static toString(status: TypingStatus): string {
        switch(status) {
            case TypingStatus.TYPING:
                return "typing";
            case TypingStatus.IDLE:
                return "paused";
            case TypingStatus.NONE:
            default:
                return "clear";
        }
    }

    static toTypingStatus(str: string): TypingStatus | null {
        switch (str.toLowerCase()) {
            case "clear":
                return TypingStatus.NONE;
            case "paused":
                return TypingStatus.IDLE;
            case "typing":
                return TypingStatus.TYPING;
            default:
                return null;
        }
    }
}