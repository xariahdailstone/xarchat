import { ChannelName } from "../../shared/ChannelName";
import { CharacterGender } from "../../shared/CharacterGender";
import { CharacterName } from "../../shared/CharacterName";
import { OnlineStatus } from "../../shared/OnlineStatus";
import { IDisposable, asDisposable } from "../Disposable";
import { IHostInterop } from "./IHostInterop";
import { loadHostInterop } from "./HostInteropLoader";

declare const XCHost: any;

const freg = new FinalizationRegistry<() => void>(heldValue => {
    try { heldValue(); }
    catch { }
});
function onFinalize(obj: object, callback: () => void): IDisposable {
    const unregisterToken = {};
    freg.register(obj, callback, unregisterToken);
    return asDisposable(() => freg.unregister(unregisterToken));
}

export interface HostLocaleInfo {
    code: string;
    name: string;
}

export interface LoggedMessage {
    speakingCharacter: CharacterName;
    messageType: LogMessageType;
    messageText: string;
    timestamp: Date;
    speakingCharacterGender: CharacterGender;
    speakingCharacterOnlineStatus: OnlineStatus;
}

export interface LogPMConvoMessage extends LoggedMessage {
    myCharacterName: CharacterName;
    interlocutor: CharacterName; 
}

export interface LogChannelMessage extends LoggedMessage {
    channelName: ChannelName;
    channelTitle: string;
}

export interface EIconSearchResults {
    totalCount: number;
    results: string[];
}

export enum HostWindowState {
    NORMAL,
    MINIMZED,
    MAXIMIZED
}


export type ChooseLocalFileOptions = {
    title?: string | null,
    file?: string | null,
    filters?: ({ name: string, extensions: string[] }[])
}

export type ConfigKeyValue = { key: string, value: (unknown | null)};

export const NOW = () => (new Date()).getTime();

export interface HostInteropSocket extends IDisposable {
    sendAsync(data: string): Promise<void>;
    receiveAsync(): Promise<string | null>;
}

export enum LogMessageType {
    CHAT = 0,
    AD = 1,
    ROLL = 2,
    SPIN = 3
}

export interface HostLaunchUrlResponse {
    loadInternally?: boolean;
    url?: string;
}

export const HostInterop: IHostInterop = loadHostInterop();
(window as any)["__hostinterop"] = HostInterop;

