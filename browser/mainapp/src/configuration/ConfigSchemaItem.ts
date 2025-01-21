import { IterableUtils } from "../util/IterableUtils";

export interface ConfigSchemaDefinition {
    settings: ConfigSchemaItemDefinition[];
}

export interface ConfigSchemaItemDefinitionItem {
    id?: string;
    scope?: ConfigSchemaScopeType[];
    title: string;
    description?: string;
    type: ConfigSchemaItemType;
    options?: ConfigSchemaOptionDefinition[];
    defaultValue: unknown;
    configBlockKey: string;
    items?: ConfigSchemaItemDefinition[];
    notYetImplemented?: boolean;
    notifRouteOptions?: ConfigSchemaNotifRouteItemOptions;
}

export interface ConfigSchemaNotifRouteItemOptions {
    hasChannelContext?: boolean;
    hasCharacterContext?: boolean;
}

export interface ConfigSchemaItemDefinitionSection {
    id?: string;
    scope?: ConfigSchemaScopeType[];
    sectionTitle: string;
    description?: string;
    items: ConfigSchemaItemDefinition[];
}

export interface ConfigSchemaOptionDefinition {
    id: string;
    type: ConfigSchemaOptionItemType;
    prompt?: string;
    value?: unknown;
}

export type ConfigSchemaItemDefinition = (ConfigSchemaItemDefinitionItem | ConfigSchemaItemDefinitionSection);

export type ConfigSchemaItemType = "text" | "boolean" | "text[]" | "radio" | "timespan" | "color" | "color-hs" | "notifroutes";
export type ConfigSchemaOptionItemType = "string" | "file";
export type ConfigSchemaScopeType = "global" | "char" | "char.chancategory" | "char.chan" | "char.convo";
export type ConfigSchemaScopeTypeSimple = "global" | "char" | "chan" | "convo";

export type RoutedNotificationEventName = "errorGet" | "broadcastGet" | "systemMessageGet" | "friendAddRemove" | "friendRequest" | "bookmarkAddRemove" |
    "interestAddRemove" | "ignoreAddRemove" | "serverOpAddRemove" | "meStatusUpdate" | "friendStatusUpdate" | "bookmarkStatusUpdate" |
    "interestStatusUpdate" | "friendOnlineChange" | "bookmarkOnlineChange" | "interestOnlineChange" | "meKicked" | "otherKicked" | "chanOpChange" |
    "chanInvited" | "noteGet";
export function getFullRoutedNotificationConfigName(en: RoutedNotificationEventName) {
    return `notifrouting.${en}`;
}

function getScopeArray(def: ConfigSchemaScopeTypeSimple[]): ConfigSchemaScopeType[] {
    const result: ConfigSchemaScopeType[] = [];
    const defQueryable = IterableUtils.asQueryable(def);
    if (defQueryable.where(i => i == "global").any()) {
        result.push("global");
    }
    if (defQueryable.where(i => i == "char").any()) {
        result.push("char");
    }
    if (defQueryable.where(i => i == "chan").any()) {
        result.push("char.chancategory");
        result.push("char.chan");
    }
    if (defQueryable.where(i => i == "convo").any()) {
        result.push("char.convo");
    }
    return result;
}

export const ConfigSchema: ConfigSchemaDefinition = {
    settings: [
        {
            scope: getScopeArray(["global", "char", "chan", "convo"]),
            sectionTitle: "General Settings",
            description: "These settings are still under development!  Check back in future versions of XarChat!",
            items: [
                {
                    id: "autoIdle",
                    scope: getScopeArray(["global", "char"]),
                    title: "Auto Idle",
                    description: "Automatically change your status to Idle when your computer input is idle.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "autoIdle"
                },
                {
                    id: "autoAway",
                    scope: getScopeArray(["global", "char"]),
                    title: "Auto Away",
                    description: "Automatically change your status to Away when your computer is locked.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "autoAway"
                },
                {
                    id: "autoReconnect",
                    scope: getScopeArray(["global", "char"]),
                    title: "Automatically Reconnect",
                    description: "Automatically attempt to reconnect to chat when the connection is lost unexpectedly.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "autoReconnect"
                },
                {
                    id: "restoreStatusMessageOnLogin",
                    scope: getScopeArray(["global", "char"]),
                    title: "Restore Status Message on Login",
                    description: "Restore your previous status message when logging in or reconnecting.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "restoreStatusMessageOnLogin"
                },
                {
                    id: "pingCharName",
                    scope: getScopeArray(["global", "char", "chan"]),
                    title: "Ping On Your Character Name",
                    description: "Highlight and generate a ping sound effect when a message when seen in chat contains your character name.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "pingCharName"
                },
                {
                    id: "pingWords",
                    scope: getScopeArray(["global", "char", "chan"]),
                    title: "Other Ping Words",
                    description: "Other words that will cause a message to get highlighted and generate a ping sound effect when seen in chat.",
                    type: "text[]",
                    defaultValue: [],
                    configBlockKey: "pingWords"
                },
                {
                    id: "unseenIndicator",
                    scope: getScopeArray(["global", "char", "chan"]),
                    title: "Show Unseen Messages Indicator",
                    description: "Show a white dot on channels where new unseen messages that do not include ping words have arrived.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "showUnseenIndicator"
                },
                {
                    id: "checkForUpdates",
                    scope: getScopeArray(["global"]),
                    title: "Automatically Check For Updates",
                    description: "Check for new versions of XarChat when they are released.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "checkForUpdates",
                    notYetImplemented: true
                },
                {
                    id: "highlightMyMessages",
                    scope: getScopeArray(["global", "char", "chan", "convo"]),
                    title: "Highlight My Messages",
                    description: "Highlight to messages from me with a lighter background color.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "highlightMyMessages"
                },
                {
                    id: "autoUrlPaste",
                    scope: getScopeArray(["global"]),
                    title: "Automatically add [url] tags to pasted URLs.",
                    description: "When pasting in a URL, automatically add [url] tags around the URL when appropriate.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "autoUrlPaste"
                },
                {
                    id: "joinFriendsAndBookmarks",
                    scope: getScopeArray(["global", "char"]),
                    title: "Show Friends and Bookmarks Together",
                    description: "Show friends and bookmarks together in the left bar tab strip and in channel character lists.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "joinFriendsAndBookmarks"
                },
                // {
                //     id: "submitNewEIcons",
                //     scope: [ "global" ],
                //     title: "Submit New EIcons to xariah.net",
                //     description: "Send newly seen eicons to xariah.net's eicon search index.",
                //     type: "boolean",
                //     defaultValue: true,
                //     configBlockKey: "submitNewEIcons",
                //     notYetImplemented: true
                // },
            ]
        },
        {
            scope: getScopeArray(["global", "char", "chan", "convo"]),
            sectionTitle: "Logging Options",
            items: [
                {
                    id: "loggingEnabled",
                    scope: getScopeArray(["global", "char", "chan", "convo"]),
                    title: "Enable Logging",
                    description: "Log chat to a local file.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "loggingEnabled",
                    notYetImplemented: true
                },
                {
                    id: "retentionPeriod.chan",
                    scope: getScopeArray(["global", "char", "chan"]),
                    title: "Channel Message Log Retention",
                    description: "How long to keep channel messages in the log file.",
                    type: "timespan",
                    defaultValue: 2160,  // 90 days * 24 hours
                    configBlockKey: "loggingRetentionChannel",
                    notYetImplemented: true
                },
                {
                    id: "retentionPeriod.convo",
                    scope: getScopeArray(["global", "char", "convo"]),
                    title: "Private Message Log Retention",
                    description: "How long to keep private messages in the log file.",
                    type: "timespan",
                    defaultValue: 120000,  // 5000 days * 24 hours
                    configBlockKey: "loggingRetentionConvo",
                    notYetImplemented: true
                }
            ]
        },
        {
            scope: getScopeArray(["global", "char", "chan", "convo"]),
            sectionTitle: "Sounds",
            description: "Configure the sounds XarChat will play on various events.",
            items: [
                {
                    id: "sound.event.connect",
                    scope: getScopeArray(["global", "char"]),
                    title: "Connected",
                    description: "Sound to play when a connection to chat is established.",
                    type: "radio",
                    options: [
                        {
                            id: "none",
                            type: "string",
                            prompt: "None",
                            value: "none:"
                        },
                        {
                            id: "default",
                            type: "string",
                            prompt: "Default",
                            value: "default:"
                        },
                        {
                            id: "file",
                            type: "file",
                            prompt: "Choose File",
                            value: "file:@"
                        },
                    ],
                    defaultValue: "default:",
                    configBlockKey: "sound.event.connect"
                },
                {
                    id: "sound.event.disconnect",
                    scope: getScopeArray(["global", "char"]),
                    title: "Disconnected",
                    description: "Sound to play when a connection to chat is lost.",
                    type: "radio",
                    options: [
                        {
                            id: "none",
                            type: "string",
                            prompt: "None",
                            value: "none:"
                        },
                        {
                            id: "default",
                            type: "string",
                            prompt: "Default",
                            value: "default:"
                        },
                        {
                            id: "file",
                            type: "file",
                            prompt: "Choose File",
                            value: "file:@"
                        },
                    ],
                    defaultValue: "default:",
                    configBlockKey: "sound.event.disconnect"
                },
                {
                    id: "sound.event.pm",
                    scope: getScopeArray(["global", "char", "convo"]),
                    title: "New Private Message",
                    description: "Sound to play when a new unseen private message is received.",
                    type: "radio",
                    options: [
                        {
                            id: "none",
                            type: "string",
                            prompt: "None",
                            value: "none:"
                        },
                        {
                            id: "default",
                            type: "string",
                            prompt: "Default",
                            value: "default:"
                        },
                        {
                            id: "file",
                            type: "file",
                            prompt: "Choose File",
                            value: "file:@"
                        },
                    ],
                    defaultValue: "default:",
                    configBlockKey: "sound.event.pm"
                },
                {
                    id: "sound.event.ping",
                    scope: getScopeArray(["global", "char", "chan"]),
                    title: "Ping",
                    description: "Sound to play when a message containing a ping word is received.",
                    type: "radio",
                    options: [
                        {
                            id: "none",
                            type: "string",
                            prompt: "None",
                            value: "none:"
                        },
                        {
                            id: "default",
                            type: "string",
                            prompt: "Default",
                            value: "default:"
                        },
                        {
                            id: "file",
                            type: "file",
                            prompt: "Choose File",
                            value: "file:@"
                        },
                    ],
                    defaultValue: "default:",
                    configBlockKey: "sound.event.ping"
                },
            ]
        },
        {
            scope: getScopeArray(["global"]),
            sectionTitle: "Colors",
            description: "Choose colors for various parts of the XarChat interface.",
            items: [
                {
                    scope: getScopeArray(["global"]),
                    id: "backgroundcolor",
                    title: "Background",
                    description: "Background color throughout XarChat.",
                    type: "color-hs",
                    defaultValue: "225;7",
                    configBlockKey: "bgColor"
                },
                {
                    scope: getScopeArray(["global"]),
                    sectionTitle: "Genders",
                    items: [
                        {
                            scope: getScopeArray(["global"]),
                            id: "color.gender.male",
                            title: "Male",
                            description: "",
                            type: "color",
                            defaultValue: "#6699FF",
                            configBlockKey: "color.gender.male"
                        },
                        {
                            scope: getScopeArray(["global"]),
                            id: "color.gender.female",
                            title: "Female",
                            description: "",
                            type: "color",
                            defaultValue: "#FF6699",
                            configBlockKey: "color.gender.female"
                        },
                        {
                            scope: getScopeArray(["global"]),
                            id: "color.gender.herm",
                            title: "Hermaphrodite",
                            description: "",
                            type: "color",
                            defaultValue: "#9B30FF",
                            configBlockKey: "color.gender.herm"
                        },
                        {
                            scope: getScopeArray(["global"]),
                            id: "color.gender.male-herm",
                            title: "Male Hermaphrodite",
                            description: "",
                            type: "color",
                            defaultValue: "#007FFF",
                            configBlockKey: "color.gender.male-herm"
                        },
                        {
                            scope: getScopeArray(["global"]),
                            id: "color.gender.shemale",
                            title: "Shemale",
                            description: "",
                            type: "color",
                            defaultValue: "#CC66FF",
                            configBlockKey: "color.gender.shemale"
                        },
                        {
                            scope: getScopeArray(["global"]),
                            id: "color.gender.cunt-boy",
                            title: "Cuntboy",
                            description: "",
                            type: "color",
                            defaultValue: "#00CC66",
                            configBlockKey: "color.gender.cunt-boy"
                        },
                        {
                            scope: getScopeArray(["global"]),
                            id: "color.gender.transgender",
                            title: "Transgender",
                            description: "",
                            type: "color",
                            defaultValue: "#EE8822",
                            configBlockKey: "color.gender.transgender"
                        },
                        {
                            scope: getScopeArray(["global"]),
                            id: "color.gender.none",
                            title: "None",
                            description: "",
                            type: "color",
                            defaultValue: "#FFFFBB",
                            configBlockKey: "color.gender.none"
                        }
                    ]
                },
                {
                    id: "useFriendColor",
                    scope: getScopeArray(["global"]),
                    title: "Use Friend Color",
                    description: "Colorize friends' names with a distinct 'Friend' color.",
                    type: "boolean",
                    defaultValue: false,
                    configBlockKey: "useFriendColor"
                },
                {
                    scope: getScopeArray(["global"]),
                    id: "color.friend",
                    title: "Friend",
                    description: "",
                    type: "color",
                    defaultValue: "#00FF00",
                    configBlockKey: "color.friend"
                },
            ]
        },
        {
            scope: getScopeArray(["global", "char"]),
            sectionTitle: "Notifications",
            description: "Configure where notification messages for various events are displayed.",
            items: [
                {
                    scope: getScopeArray(["global", "char"]),
                    id: getFullRoutedNotificationConfigName("errorGet"),
                    title: "Error Messages",
                    description: "Error messages sent by F-Chat.",
                    type: "notifroutes",
                    defaultValue: "console,*currenttab",
                    configBlockKey: getFullRoutedNotificationConfigName("errorGet"),
                    notYetImplemented: true
                },
                {
                    scope: getScopeArray(["global", "char"]),
                    id: getFullRoutedNotificationConfigName("broadcastGet"),
                    title: "Admin Broadcasts",
                    description: "Broadcasts sent by chat administrators to all online characters.",
                    type: "notifroutes",
                    defaultValue: "*everywhere",
                    configBlockKey: getFullRoutedNotificationConfigName("broadcastGet"),
                    notYetImplemented: true
                },
                {
                    scope: getScopeArray(["global", "char"]),
                    id: getFullRoutedNotificationConfigName("systemMessageGet"),
                    title: "System Message",
                    description: "Uncategorized messages sent by the F-Chat system.",
                    type: "notifroutes",
                    defaultValue: "console,currenttab,targetchannel",
                    configBlockKey: getFullRoutedNotificationConfigName("systemMessageGet"),
                    notYetImplemented: true
                },
                {
                    scope: getScopeArray(["global", "char"]),
                    id: getFullRoutedNotificationConfigName("friendAddRemove"),
                    title: "Friend Added/Removed",
                    description: "A character was added or removed from your friends list.",
                    type: "notifroutes",
                    defaultValue: "console,currenttab,pmconvo",
                    configBlockKey: getFullRoutedNotificationConfigName("friendAddRemove"),
                    notifRouteOptions: {
                        hasCharacterContext: true
                    }
                },
                {
                    scope: getScopeArray(["global", "char"]),
                    id: getFullRoutedNotificationConfigName("friendRequest"),
                    title: "Friend Request",
                    description: "A character requested to be your friend.",
                    type: "notifroutes",
                    defaultValue: "console,currenttab,pmconvo",
                    configBlockKey: getFullRoutedNotificationConfigName("friendRequest"),
                    notifRouteOptions: {
                        hasCharacterContext: true
                    }
                },
                {
                    scope: getScopeArray(["global", "char"]),
                    id: getFullRoutedNotificationConfigName("bookmarkAddRemove"),
                    title: "Bookmark Added/Removed",
                    description: "A character was added or removed from your bookmarks list.",
                    type: "notifroutes",
                    defaultValue: "console,currenttab,pmconvo",
                    configBlockKey: getFullRoutedNotificationConfigName("bookmarkAddRemove"),
                    notifRouteOptions: {
                        hasCharacterContext: true
                    }
                },
                {
                    scope: getScopeArray(["global", "char"]),
                    id: getFullRoutedNotificationConfigName("interestAddRemove"),
                    title: "Interest Added/Removed",
                    description: "A character was added or removed from your interests list.",
                    type: "notifroutes",
                    defaultValue: "console,currenttab,pmconvo",
                    configBlockKey: getFullRoutedNotificationConfigName("interestAddRemove"),
                    notifRouteOptions: {
                        hasCharacterContext: true
                    }
                },
                {
                    scope: getScopeArray(["global", "char"]),
                    id: getFullRoutedNotificationConfigName("ignoreAddRemove"),
                    title: "Ignore Added/Removed",
                    description: "A character was added or removed from your ignore list.",
                    type: "notifroutes",
                    defaultValue: "console,currenttab,pmconvo",
                    configBlockKey: getFullRoutedNotificationConfigName("ignoreAddRemove"),
                    notifRouteOptions: {
                        hasCharacterContext: true
                    }
                },
                {
                    scope: getScopeArray(["global", "char"]),
                    id: getFullRoutedNotificationConfigName("serverOpAddRemove"),
                    title: "Server Operator Added/Removed",
                    description: "A character was promoted or demoted to/from F-Chat server operator status by the chat administrators.",
                    type: "notifroutes",
                    defaultValue: "console,*currenttab,pmconvo",
                    configBlockKey: getFullRoutedNotificationConfigName("serverOpAddRemove"),
                    notifRouteOptions: {
                        hasCharacterContext: true
                    }
                },
                {
                    scope: getScopeArray(["global", "char"]),
                    id: getFullRoutedNotificationConfigName("meStatusUpdate"),
                    title: "Your Character Status Updated",
                    description: "Your character status was updated.",
                    type: "notifroutes",
                    defaultValue: "console,currenttab",
                    configBlockKey: getFullRoutedNotificationConfigName("meStatusUpdate")
                },
                {
                    scope: getScopeArray(["global", "char"]),
                    id: getFullRoutedNotificationConfigName("friendStatusUpdate"),
                    title: "Friend Character Status Updated",
                    description: "A friend updated their character status.",
                    type: "notifroutes",
                    defaultValue: "console,currenttab,pmconvo",
                    configBlockKey: getFullRoutedNotificationConfigName("friendStatusUpdate"),
                    notifRouteOptions: {
                        hasCharacterContext: true
                    }
                },
                {
                    scope: getScopeArray(["global", "char"]),
                    id: getFullRoutedNotificationConfigName("bookmarkStatusUpdate"),
                    title: "Bookmark Character Status Updated",
                    description: "A bookmark updated their character status.",
                    type: "notifroutes",
                    defaultValue: "console,currenttab,pmconvo",
                    configBlockKey: getFullRoutedNotificationConfigName("bookmarkStatusUpdate"),
                    notifRouteOptions: {
                        hasCharacterContext: true
                    }
                },
                {
                    scope: getScopeArray(["global", "char"]),
                    id: getFullRoutedNotificationConfigName("interestStatusUpdate"),
                    title: "Interest Character Status Updated",
                    description: "An interest updated their character status.",
                    type: "notifroutes",
                    defaultValue: "console,currenttab,pmconvo",
                    configBlockKey: getFullRoutedNotificationConfigName("interestStatusUpdate"),
                    notifRouteOptions: {
                        hasCharacterContext: true
                    }
                },
                {
                    scope: getScopeArray(["global", "char"]),
                    id: getFullRoutedNotificationConfigName("friendOnlineChange"),
                    title: "Friend Online/Offline",
                    description: "A friend came online or went offline.",
                    type: "notifroutes",
                    defaultValue: "console,currenttab,pmconvo",
                    configBlockKey: getFullRoutedNotificationConfigName("friendOnlineChange"),
                    notifRouteOptions: {
                        hasCharacterContext: true
                    }
                },
                {
                    scope: getScopeArray(["global", "char"]),
                    id: getFullRoutedNotificationConfigName("bookmarkOnlineChange"),
                    title: "Bookmark Online/Offline",
                    description: "A bookmark came online or went offline.",
                    type: "notifroutes",
                    defaultValue: "console,currenttab,pmconvo",
                    configBlockKey: getFullRoutedNotificationConfigName("bookmarkOnlineChange"),
                    notifRouteOptions: {
                        hasCharacterContext: true
                    }
                },
                {
                    scope: getScopeArray(["global", "char"]),
                    id: getFullRoutedNotificationConfigName("interestOnlineChange"),
                    title: "Interest Online/Offline",
                    description: "An interest came online or went offline.",
                    type: "notifroutes",
                    defaultValue: "console,currenttab,pmconvo",
                    configBlockKey: getFullRoutedNotificationConfigName("interestOnlineChange"),
                    notifRouteOptions: {
                        hasCharacterContext: true
                    }
                },
                {
                    scope: getScopeArray(["global", "char"]),
                    id: getFullRoutedNotificationConfigName("interestOnlineChange"),
                    title: "Anyone Else Online/Offline",
                    description: "Someone who is not a friend, bookmark, or interest came online or went offline.",
                    type: "notifroutes",
                    defaultValue: "pmconvo",
                    configBlockKey: getFullRoutedNotificationConfigName("interestOnlineChange"),
                    notifRouteOptions: {
                        hasCharacterContext: true
                    }
                },
                {
                    scope: getScopeArray(["global", "char"]),
                    id: getFullRoutedNotificationConfigName("meKicked"),
                    title: "You Kicked/Banned From Channel",
                    description: "You were kicked, banned, or timed out from a channel.",
                    type: "notifroutes",
                    defaultValue: "*console,*currenttab,*targetchannel",
                    configBlockKey: getFullRoutedNotificationConfigName("meKicked"),
                    notifRouteOptions: {
                        hasChannelContext: true
                    }
                },
                {
                    scope: getScopeArray(["global", "char"]),
                    id: getFullRoutedNotificationConfigName("otherKicked"),
                    title: "Someone Else Kicked/Banned From Channel",
                    description: "Someone else was kicked, banned, or timed out from a channel.",
                    type: "notifroutes",
                    defaultValue: "targetchannel",
                    configBlockKey: getFullRoutedNotificationConfigName("otherKicked"),
                    notifRouteOptions: {
                        hasCharacterContext: true,
                        hasChannelContext: true
                    }
                },
                {
                    scope: getScopeArray(["global", "char"]),
                    id: getFullRoutedNotificationConfigName("chanOpChange"),
                    title: "Channel Owner/Operator Changed",
                    description: "A change was made to a channel's owner or operator list.",
                    type: "notifroutes",
                    defaultValue: "targetchannel",
                    configBlockKey: getFullRoutedNotificationConfigName("chanOpChange"),
                    notifRouteOptions: {
                        hasChannelContext: true,
                        hasCharacterContext: true
                    }
                },
                {
                    scope: getScopeArray(["global", "char"]),
                    id: getFullRoutedNotificationConfigName("chanInvited"),
                    title: "Channel Invite Received",
                    description: "An invitation to join a channel was received.",
                    type: "notifroutes",
                    defaultValue: "console,currenttab,pmconvo",
                    configBlockKey: getFullRoutedNotificationConfigName("chanInvited"),
                    notifRouteOptions: {
                        hasChannelContext: false, // can't see an invite when you're already in the channel!
                        hasCharacterContext: true
                    }
                },
                {
                    scope: getScopeArray(["global", "char"]),
                    id: getFullRoutedNotificationConfigName("noteGet"),
                    title: "Note Received",
                    description: "A new note on F-List was received.",
                    type: "notifroutes",
                    defaultValue: "console,pmconvo,currenttab",
                    configBlockKey: getFullRoutedNotificationConfigName("noteGet"),
                    notifRouteOptions: {
                        hasCharacterContext: true
                    }
                }
            ]
        }
    ]
};

const _schemaItemsByIdCache = new Map<string, ConfigSchemaItemDefinitionItem | null>();
export function getConfigSchemaItemById(id: string): ConfigSchemaItemDefinitionItem | null {
    const chk = (settings: ConfigSchemaItemDefinition[]) => {
        for (let s of settings) {
            if (s.id == id) {
                return s as ConfigSchemaItemDefinitionItem;
            }
            if (s.items) {
                const iresult = chk(s.items) as (ConfigSchemaItemDefinitionItem | null);
                if (iresult) {
                    return iresult;
                }
            }
        }
        return null;
    }

    if (_schemaItemsByIdCache.has(id)) {
        return _schemaItemsByIdCache.get(id)!;
    }
    else {
        const result = chk(ConfigSchema.settings);
        _schemaItemsByIdCache.set(id, result);
        return result;
    }
}