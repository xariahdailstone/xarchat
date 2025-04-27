import { CharacterName } from "../shared/CharacterName";

export interface ServerADLMessage {
    ops: string[];
}

export interface ServerAOPMessage {
    character: string;
}

export interface ServerBROMessage {
    character: string;
    message: string;
}

export interface ServerCBUMessage {
    operator: string;
    character: string;
    channel: string;
}

export interface ServerCDSMessage {
    channel: string;
    description: string;
}

export interface ServerCHAMessage {
        // CHA {"channels": [{"name":"Avians","mode":"chat","characters":20},{"name":"World of Warcraft","mode":"both","characters":77}... }
    channels: { 
        name: string,
        mode: string,
        characters: number
    }[];
}

export interface ServerCIUMessage {
    name: string;
    sender: string;
    title: string;
}

export interface ServerCKUMessage {
    operator: string;
    character: string;
    channel: string;
}

export interface ServerCOAMessage {
    channel: string;
    character: string;
}

export interface ServerCOLMessage {
    channel: string;
    oplist: string[];
}

export interface ServerCONMessage {
    count: number;
}

export interface ServerCORMessage {
    channel: string;
    character: string;
}

export interface ServerCSOMessage {
    channel: string;
    character: string;
}

export interface ServerCTUMessage {
    channel: string;
    operator: string;
    character: string;
    length: number;
}

export interface ServerDOPMessage {
    character: string;
}

export interface ServerERRMessage {
    number: number;
    message: string;
}

export interface ServerFLNMessage {
    character: string;
}

export interface ServerFRLMessage {
    characters: string[];
}

export interface ServerHLOMessage {
    message: string;
}

export interface ServerICHMessage {
    channel: string;
    mode: string;
    users: { identity: string }[];
}

export interface ServerRMOMessage {
    channel: string;
    mode: string;
}

export interface ServerIDNMessage {
    character: string;
}

export interface ServerIGNMessage {
    action: string;
    character?: string;
    characters?: string[];
}

export interface ServerJCHMessage {
    channel: string;
    character: { identity: string };
    title: string;
}

export interface ServerLCHMessage {
    channel: string;
    character: string;
}

export interface ServerLISMessage {
    characters: [string,string,string,string][];
}

export interface ServerLRPMessage {
    channel: string;
    character: string;
    message: string;
}

export interface ServerMSGMessage {
    channel: string;
    character: string;
    message: string;
}

export interface ServerNLNMessage {
    identity: string;
    gender: string;
    status: string;
}

export interface ServerORSMessage {
    // ORS ORS { channels: [{"name":"ADH-300f8f419e0c4814c6a8","characters":0,"title":"Ariel's Fun Club"}...] }
    channels: { 
        name: string,
        title: string,
        characters: number
    }[];
}

export interface ServerPRIMessage {
    character: string;
    message: string;
}

export interface ServerRLLMessage {
    channel?: string;
    character: string;
    recipient?: string;
    endresult?: number;
    message: string;
    results?: number[];
    rolls?: string[];
    type: "dice" | "bottle";
    target?: string;
}

export interface ServerRTBMessage {
    type: "trackadd" | "trackrem" | "note" | "friendadd" | "friendremove" | "friendrequest";  // TODO:
    name?: string; // sent on "trackadd" and "trackrem"
    sender?: string;  // sent on "note"
    subject?: string;  // sent on "note"
    id?: number; // sent on "note" - URL to note is: https://www.f-list.net/view_note.php?note_id=${id}
}

export interface ServerSTAMessage {
    character: string;
    status: string;
    statusmsg: string;
}

export interface ServerSYSMessage {
    channel?: string;
    message: string;
}

export interface ServerTPNMessage {
    character: string;
    status: string;
}

export interface ServerVARMessage {
    variable: string;
    value: string | number | string[];
}

export interface ServerXHMMessage {
    asof: number;
    channel: string;  // "ch:name", "pm:name",  "con"
    character: string;
    characterGender: string;
    characterStatus: string;
    endresult: number | null;
    message: string;
    messagetype: string; // "CLR", "MSG", "LRP", "BRO", "SPIN", "ROLL"
    results: number[] | null;
    rolls: string[] | null;
    seen: boolean;
    target: string | null;
}
