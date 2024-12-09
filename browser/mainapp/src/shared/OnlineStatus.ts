import { CharacterGender } from "./CharacterGender";

export enum OnlineStatus {
    OFFLINE,
    ONLINE,
    LOOKING,
    BUSY,
    AWAY,
    DND,
    IDLE,
    CROWN
}


export class OnlineStatusConvert {
    static getRandom(): OnlineStatus {
        return Math.floor(Math.random() * 7);
    }

    static isValid(value: (string | null | undefined)): boolean {
        switch (value?.toLowerCase()) {
            case "offline":
            case "online":
            case "away":
            case "idle":
            case "dnd":
            case "busy":
            case "looking":
            case "crown":
                return true;
            default:
                return false;
        }
    }

    static toOnlineStatus(value: (string | null | undefined)): (OnlineStatus | null) {
        switch (value?.toLowerCase()) {
            case "offline":
                return OnlineStatus.OFFLINE;
            case "online":
                return OnlineStatus.ONLINE;
            case "away":
                return OnlineStatus.AWAY;
            case "idle":
                return OnlineStatus.IDLE;
            case "dnd":
                return OnlineStatus.DND;
            case "busy":
                return OnlineStatus.BUSY;
            case "looking":
                return OnlineStatus.LOOKING;
            case "crown":
                return OnlineStatus.CROWN;
            default:
                return null;
        }        
    }

    static toString(status: OnlineStatus): string;
    static toString(status: (OnlineStatus | null | undefined)): (string | null);
    static toString(status: (OnlineStatus | null | undefined)): (string | null) {
        switch (status) {
            case OnlineStatus.OFFLINE:
                return "Offline";
            case OnlineStatus.ONLINE:
                return "Online";
            case OnlineStatus.AWAY:
                return "Away";
            case OnlineStatus.IDLE:
                return "Idle";
            case OnlineStatus.DND:
                return "DND";
            case OnlineStatus.BUSY:
                return "Busy";
            case OnlineStatus.LOOKING:
                return "Looking";
            case OnlineStatus.CROWN:
                return "Crown";
            default:
                return null;
        }
    }
}