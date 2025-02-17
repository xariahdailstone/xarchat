import { IterableUtils } from "../util/IterableUtils";

export interface ConfigSchemaDefinition {
    settings: ConfigSchemaItemDefinition[];
}

export interface ConfigSchemaItemDefinitionItem {
    id?: string;
    scope?: ConfigSchemaScopeType[];
    title: string;
    description?: string;
    descriptionByScope?: { [key in ConfigSchemaScopeType]: string };
    type: ConfigSchemaItemType;
    options?: ConfigSchemaOptionDefinition[];
    selectOptions?: ConfigSchemaSelectOptionDefinition[];
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
    descriptionByScope?: { [key in ConfigSchemaScopeType]: string };
    items: ConfigSchemaItemDefinition[];
}

export interface ConfigSchemaOptionDefinition {
    id: string;
    type: ConfigSchemaOptionItemType;
    prompt?: string;
    value?: unknown;
}
export interface ConfigSchemaSelectOptionDefinition {
    value: string;
    displayValue: string;
}

export enum PingLineItemMatchStyle {
    CONTAINS = "contains",
    WHOLE_WORD = "whole-word",
    REGEX = "regex"
}
export class PingLineItemMatchStyleConvert {
    static toString(style: PingLineItemMatchStyle) {
        switch (style) {
            default:
            case PingLineItemMatchStyle.CONTAINS:
                return "Contains";
            case PingLineItemMatchStyle.WHOLE_WORD:
                return "Whole Word";
            case PingLineItemMatchStyle.REGEX:
                return "Regex";
        }
    }
}
export interface PingLineItemDefinition {
    text: string;
    matchStyle: PingLineItemMatchStyle;
}

export type ConfigSchemaItemDefinition = (ConfigSchemaItemDefinitionItem | ConfigSchemaItemDefinitionSection);

export type ConfigSchemaItemType = "text" | "boolean" | "text[]" | "pinglist" | "radio" | "timespan" | "color" | "color-hs" | "notifroutes" | "select";
export type ConfigSchemaOptionItemType = "string" | "file";
export type ConfigSchemaScopeType = "global" | "char" | "char.chancategory" | "char.chan" | "char.convo";
export type ConfigSchemaScopeTypeSimple = "global" | "char" | "chan" | "convo";

export type RoutedNotificationEventName = "errorGet" | "broadcastGet" | "systemMessageGet" | "friendAddRemove" | "friendRequest" | "bookmarkAddRemove" |
    "interestAddRemove" | "ignoreAddRemove" | "serverOpAddRemove" | 
    "meStatusUpdate" | "friendStatusUpdate" | "bookmarkStatusUpdate" | "interestStatusUpdate" | "otherStatusUpdate" |
    "friendOnlineChange" | "bookmarkOnlineChange" | "interestOnlineChange" | "otherOnlineChange" | 
    "meKicked" | "otherKicked" | "chanOpChange" |
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
            sectionTitle: "Behavior",
            description: "These settings control how XarChat acts.",
            items: [
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
                    id: "autoUrlPaste",
                    scope: getScopeArray(["global"]),
                    title: "Automatically add [url] tags to pasted URLs.",
                    description: "When pasting in a URL, automatically add [url] tags around the URL when appropriate.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "autoUrlPaste"
                },
                {
                    scope: getScopeArray(["global", "char", "chan", "convo"]),
                    sectionTitle: "Ping Settings",
                    items: [
                        {
                            id: "allowPings",
                            scope: getScopeArray(["global", "char", "chan", "convo"]),
                            title: "Allow Pings",
                            description: "",
                            descriptionByScope: {
                                "global": "Allow pings from any source.",
                                "char": "Allow pings from any source for a login session for \"$MYCHAR$\".",
                                "char.chancategory": "Allow pings from any channels in the \"$CHANCATEGORY$\" category.",
                                "char.chan": "Allow pings from this channel.",
                                "char.convo": "Allow pings from any messages sent by \"$CONVOCHAR$\""
                            },
                            type: "boolean",
                            defaultValue: true,
                            configBlockKey: "allowPings"
                        },
                        {
                            id: "allowPingsInAds",
                            scope: getScopeArray(["global", "char", "chan"]),
                            title: "Allow Pings in Ads",
                            description: "Allow pings from roleplay ad messages.",
                            type: "boolean",
                            defaultValue: false,
                            configBlockKey: "allowPingsInAds"
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
                            type: "pinglist",
                            defaultValue: [],
                            configBlockKey: "pingWords"
                        }
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
                            id: getFullRoutedNotificationConfigName("otherStatusUpdate"),
                            title: "Anyone Else Status Updated",
                            description: "Someone who is not a friend, bookmark, or interest updated their character status.",
                            type: "notifroutes",
                            defaultValue: "pmconvo",
                            configBlockKey: getFullRoutedNotificationConfigName("otherStatusUpdate"),
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
                            id: getFullRoutedNotificationConfigName("otherOnlineChange"),
                            title: "Anyone Else Online/Offline",
                            description: "Someone who is not a friend, bookmark, or interest came online or went offline.",
                            type: "notifroutes",
                            defaultValue: "pmconvo",
                            configBlockKey: getFullRoutedNotificationConfigName("otherOnlineChange"),
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
        },
        {
            scope: getScopeArray(["global", "char", "chan", "convo"]),
            sectionTitle: "Display",
            description: "Settings that control how XarChat looks.",
            items: [
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
                    id: "highlightMyMessages",
                    scope: getScopeArray(["global", "char", "chan", "convo"]),
                    title: "Highlight My Messages",
                    description: "",
                    descriptionByScope: {
                        "global": "Highlight messages sent by me with a lighter background color.",
                        "char": "Highlight messages sent by me with a lighter background color.",
                        "char.chancategory": "Highlight messages sent by me with a lighter background color.",
                        "char.chan": "Highlight messages sent by me with a lighter background color.",
                        "char.convo": "Highlight messages sent by me with a lighter background color in PM conversations with \"$CONVOCHAR$\"."
                    },
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "highlightMyMessages"
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
                {
                    id: "messageDisplayStyle",
                    scope: getScopeArray(["global", "char", "chan", "convo"]),
                    title: "Message Display Style",
                    description: "Select a display style for messages.",
                    type: "select",
                    selectOptions: [
                        { value: "fchat", displayValue: "F-Chat" },
                        { value: "discord", displayValue: "Discord" },
                    ],
                    defaultValue: "fchat",
                    configBlockKey: "messageDisplayStyle"
                },
                {
                    id: "chatFontSize",
                    scope: getScopeArray(["global", "char", "chan", "convo"]),
                    title: "Chat Font Size",
                    description: "",
                    descriptionByScope: {
                        "global": "Change the size of the font in the chat message stream for channels and PM conversations. (You can change the size of everything with Ctrl+ScrollWheel.)",
                        "char": "Change the size of the font in the chat message stream for channels and PM conversations. (You can change the size of everything with Ctrl+ScrollWheel.)",
                        "char.chancategory": "Change the size of the font in the chat message stream for channels in this category. (You can change the size of everything with Ctrl+ScrollWheel.)",
                        "char.chan": "Change the size of the font in the chat message stream for this channel. (You can change the size of everything with Ctrl+ScrollWheel.)",
                        "char.convo": "Change the size of the font in the chat message stream for PM conversations with \"$CONVOCHAR$\". (You can change the size of everything with Ctrl+ScrollWheel.)"
                    },
                    type: "select",
                    selectOptions: [
                        { value: "9", displayValue: "9" },
                        { value: "10", displayValue: "10" },
                        { value: "11", displayValue: "11" },
                        { value: "12", displayValue: "12" },
                        { value: "13", displayValue: "13" },
                        { value: "14", displayValue: "14" },
                        { value: "15", displayValue: "15" },
                        { value: "16", displayValue: "16" },
                        { value: "17", displayValue: "17" },
                        { value: "18", displayValue: "18" },
                    ],
                    defaultValue: "12",
                    configBlockKey: "chatFontSize"
                },
                {
                    id: "subtextSize",
                    scope: getScopeArray(["global"]),
                    title: "Sub/Sup Text Size",
                    description: "Select sizing for text in [sub] and [sup] tags.",
                    type: "select",
                    selectOptions: [
                        { value: "60%", displayValue: "60%" },
                        { value: "70%", displayValue: "70%" },
                        { value: "80%", displayValue: "80% (Normal)" },
                        { value: "90%", displayValue: "90%" },
                        { value: "100%", displayValue: "100% (Disabled)" }
                    ],
                    defaultValue: "80%",
                    configBlockKey: "subtextSize"
                },
                {
                    id: "collapseAds",
                    scope: getScopeArray(["global", "char", "chan"]),
                    title: "Collapse Large Ads",
                    description: "Show large ads in a collapsed format by default.",
                    type: "boolean",
                    defaultValue: "true",
                    configBlockKey: "collapseAds"
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
                            scope: getScopeArray(["global"]),
                            sectionTitle: "Friends",
                            items: [
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
                                }
                            ]
                        },
                        {
                            scope: getScopeArray(["global"]),
                            sectionTitle: "Online Statuses",
                            items: [
                                {
                                    scope: getScopeArray(["global"]),
                                    id: "color.status.offline",
                                    title: "Offline",
                                    description: "",
                                    type: "color",
                                    defaultValue: "#444444",
                                    configBlockKey: "color.status.offline"
                                },
                                {
                                    scope: getScopeArray(["global"]),
                                    id: "color.status.online",
                                    title: "Online",
                                    description: "",
                                    type: "color",
                                    defaultValue: "#5555FF",
                                    configBlockKey: "color.status.online"
                                },
                                {
                                    scope: getScopeArray(["global"]),
                                    id: "color.status.looking",
                                    title: "Looking for RP",
                                    description: "",
                                    type: "color",
                                    defaultValue: "#88FF88",
                                    configBlockKey: "color.status.looking"
                                },
                                {
                                    scope: getScopeArray(["global"]),
                                    id: "color.status.busy",
                                    title: "Busy",
                                    description: "",
                                    type: "color",
                                    defaultValue: "#881111",
                                    configBlockKey: "color.status.busy"
                                },
                                {
                                    scope: getScopeArray(["global"]),
                                    id: "color.status.away",
                                    title: "Away",
                                    description: "",
                                    type: "color",
                                    defaultValue: "#AAAA44",
                                    configBlockKey: "color.status.away"
                                },
                                {
                                    scope: getScopeArray(["global"]),
                                    id: "color.status.dnd",
                                    title: "Do Not Disturb",
                                    description: "",
                                    type: "color",
                                    defaultValue: "#CC4444",
                                    configBlockKey: "color.status.dnd"
                                },
                                {
                                    scope: getScopeArray(["global"]),
                                    id: "color.status.idle",
                                    title: "Idle",
                                    description: "",
                                    type: "color",
                                    defaultValue: "#3333AA",
                                    configBlockKey: "color.status.idle"
                                },
                                {
                                    scope: getScopeArray(["global"]),
                                    id: "color.status.crown",
                                    title: "Crown",
                                    description: "Crown is a special status that can only be set by global chat moderators.",
                                    type: "color",
                                    defaultValue: "#FFFF00",
                                    configBlockKey: "color.status.crown"
                                },
                            ]
                        }
                    ]
                },
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