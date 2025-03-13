import { CharacterGenderConvert } from "../shared/CharacterGender";
import { CharacterName } from "../shared/CharacterName";
import { CharacterSet, CharacterStatus } from "../shared/CharacterSet";
import { OnlineStatus, OnlineStatusConvert } from "../shared/OnlineStatus";
import { IDisposable, EmptyDisposable, asDisposable } from "./Disposable";

export function addCharacterOnlineStatusListenerLightweight(charSet?: CharacterSet | null, name?: CharacterName | null, el?: HTMLElement): IDisposable {
    if (charSet && name && el) {

        let lastAssignedStatus: string | null = null;
        const assignStatus = (status: CharacterStatus) => {
            if (lastAssignedStatus) {
                el.classList.remove(lastAssignedStatus);
            }
            lastAssignedStatus = `onlinestatus-${OnlineStatusConvert.toString(status.status).toLowerCase()}`;
            el.classList.add(lastAssignedStatus);
        };

        const csListener = charSet.addStatusListenerDebug(
            [ "CharacterOnlineStatusListenerLightweight", name ], 
            name, assignStatus);
        assignStatus(charSet.getCharacterStatus(name));

        let disposed = false;
        return asDisposable(() => {
            if (!disposed) {
                disposed = true;
                csListener.dispose();
                if (lastAssignedStatus) {
                    el.classList.remove(lastAssignedStatus);
                }
            }
        });
    }
    else {
        return EmptyDisposable;
    }
}

export function addCharacterGenderListenerLightweight(
    charSet?: CharacterSet | null, name?: CharacterName | null, el?: HTMLElement, includeOfflineStatus: boolean = false): IDisposable {

    if (charSet && name && el) {

        let lastAssignedClasses: string[] | null = null;
        const assignStatus = (status: CharacterStatus) => {
            if (lastAssignedClasses) {
                for (let c of lastAssignedClasses) {
                    el.classList.remove(c);
                }
                lastAssignedClasses = [];
            }

            if (status.status == OnlineStatus.OFFLINE && includeOfflineStatus) {
                lastAssignedClasses ??= [];
                lastAssignedClasses.push("gender-offline");
            }
            else {
                lastAssignedClasses ??= [];
                lastAssignedClasses.push(`gender-${CharacterGenderConvert.toString(status.gender).toLowerCase()}`);
            }

            if (status.isBookmark) {
                lastAssignedClasses ??= [];
                lastAssignedClasses.push("char-is-bookmark");
            }
            if (status.isFriend) {
                lastAssignedClasses ??= [];
                lastAssignedClasses.push("char-is-friend");
            }

            if (lastAssignedClasses) {
                for (let c of lastAssignedClasses) {
                    el.classList.add(c);
                }
            }
        };

        const csListener = charSet.addStatusListenerDebug(
            [ "CharacterGenderListenerLightweight", name ], 
            name, assignStatus);
        assignStatus(charSet.getCharacterStatus(name));

        let disposed = false;
        return asDisposable(() => {
            if (!disposed) {
                disposed = true;
                csListener.dispose();
                if (lastAssignedClasses) {
                    for (let c of lastAssignedClasses) {
                        el.classList.remove(c);
                    }
                }
            }
        });
    }
    else {
        return EmptyDisposable;
    }
}