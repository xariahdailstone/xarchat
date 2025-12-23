import { ChannelName } from "../shared/ChannelName";
import { CharacterName } from "../shared/CharacterName";
import { CancellationToken } from "../util/CancellationTokenSource";
import { HostInterop } from "../util/hostinterop/HostInterop";
import { IterableUtils } from "../util/IterableUtils";
import { PlatformUtils } from "../util/PlatformUtils";
import { StringUtils } from "../util/StringUtils";
import { AppViewModel } from "../viewmodel/AppViewModel";
import { LogFileMaintenanceDialogViewModel } from "../viewmodel/dialogs/LogFileMaintenanceDialogViewModel";
import { addNotifRoutes } from "./ConfigSchemaItem-MigrationFuncs";

export const ConfigSchemaVersion: number = 1;

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
    allowEmpty?: boolean;
    min?: number;
    max?: number;
    maxLength?: number;
    fieldWidth?: string;
    defaultValue: unknown;
    configBlockKey: string;
    items?: ConfigSchemaItemDefinition[];
    hidden?: boolean;
    notYetImplemented?: boolean;
    notifRouteOptions?: ConfigSchemaNotifRouteItemOptions;
    actionButtons?: ActionButtonDefinition[];
    initializeDisplay?: () => any;
    enableIf?: (options: EnableIfOptions) => boolean;
    calculateValue?: (options: CalculateValueOptions) => any;
    migrations?: { [version: number]: (previousValue: any) => any };
}

export interface ActionButtonDefinition {
    readonly title: string;
    readonly onClick: (args: ActionButtonClickArgs) => any;
}

export interface ActionButtonClickArgs {
    readonly appViewModel: AppViewModel;
}

export interface ConfigSchemaNotifRouteItemOptions {
    hasChannelContext?: boolean;
    hasCharacterContext?: boolean;
    canToast?: boolean;
    canGoToNotifications?: boolean;
}

export interface CalculateValueOptions {
    myCharacterName?: CharacterName;
    interlocutorName?: CharacterName;
    channelCategory?: string;
    channelName?: string;
    getConfigEntryById: (id: string) => unknown;
}

export interface EnableIfOptions {
    myCharacterName?: CharacterName;
    interlocutorName?: CharacterName;
    channelCategory?: string;
    channelName?: string;
    getConfigEntryById: (id: string) => unknown;
}

export interface ConfigSchemaItemDefinitionSection {
    id?: string;
    scope?: ConfigSchemaScopeType[];
    sectionTitle: string;
    description?: string;
    descriptionByScope?: { [key in ConfigSchemaScopeType]: string };
    items: ConfigSchemaItemDefinition[];
    hidden?: boolean;
}

export interface ConfigSchemaOptionDefinition {
    id: string;
    type: ConfigSchemaOptionItemType;
    prompt?: string;
    value?: unknown;
}
export interface ConfigSchemaSelectOptionDefinition {
    value: any;
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
                return "When message contains";
            case PingLineItemMatchStyle.WHOLE_WORD:
                return "When message has as a whole word";
            case PingLineItemMatchStyle.REGEX:
                return "When message matches a regex pattern";
        }
    }
}
export interface PingLineItemDefinition {
    text: string;
    matchStyle: PingLineItemMatchStyle;
}

export type ConfigSchemaItemDefinition = (ConfigSchemaItemDefinitionItem | ConfigSchemaItemDefinitionSection);

export type ConfigSchemaItemType = "text" | "boolean" | "integer" | "number" | "text[]" | "pinglist" | 
    "radio" | "timespan" | "color" | "color-hs" | "bgcolorcontrol" | "notifroutes" | "select" | "displaytext";
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

function generateNumericOptions(min: number, max: number): ConfigSchemaSelectOptionDefinition[] {
    const results: ConfigSchemaSelectOptionDefinition[] = [];
    for (let i = min; i <= max; i++) {
        results.push({ value: i.toString(), displayValue: i.toString() });
    }
    return results;
}

const spellCheckLanguageItem: ConfigSchemaItemDefinitionItem = {
    id: "spellCheckLanguage",
    scope: getScopeArray(["global"]),
    title: "Spell Check Language",
    description: "Which language should be used to check spelling? (Changes to this setting require a restart of XarChat)",
    type: "select",
    selectOptions: [
        { value: "default", displayValue: "System Default" }
    ],
    defaultValue: 0,
    configBlockKey: "spellCheckLanguage"
};

const chanRetentionPeriodNote = "(If you log in with more than one character, note that channel logs are shared among all " +
    "characters.  For any specific channel, the longest configured retention period that applies to that channel across all " +
    "your characters will be used.)";

const shortcutKeyCombiningPrefixString = PlatformUtils.shortcutKeyCombiningPrefixString;
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
                    id: "useGpuAcceleration",
                    scope: getScopeArray(["global"]),
                    title: "GPU Acceleration Enabled",
                    description: "Make use of your GPU to improve the performance of the XarChat user interface. (Changes to this setting require a restart of XarChat)",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "useGpuAcceleration"
                },
                spellCheckLanguageItem,
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
                    title: "Restore Status on Login",
                    description: "Restore your previous status when logging in or reconnecting.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "restoreStatusMessageOnLogin"
                },
                {
                    id: "autoUrlPaste",
                    scope: getScopeArray(["global"]),
                    title: "Automatically add [url] tags to pasted URLs",
                    description: "When pasting in a URL, automatically add [url] tags around the URL when appropriate.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "autoUrlPaste"
                },
                {
                    id: "sendMessageShortcut",
                    scope: getScopeArray(["global"]),
                    title: "Send Message Shortcut",
                    description: "Choose whether Enter or Shift+Enter sends the currently entered message.",
                    type: "select",
                    selectOptions: [
                        { value: "enter", displayValue: "Enter (Default)" },
                        { value: "shiftenter", displayValue: "Shift+Enter" }
                    ],
                    defaultValue: "enter",
                    configBlockKey: "sendMessageShortcut"
                },                
                {
                    id: "eiconSearch.enabled",
                    scope: getScopeArray(["global"]),
                    title: "EIcon Search",
                    description: `Use ${shortcutKeyCombiningPrefixString}E to open the eicon search instead of just inserting [eicon][/eicon] tags. (When disabled, ${shortcutKeyCombiningPrefixString}Alt+E opens eicon search instead.)`,
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "eiconSearch.enabled"
                },
                {
                    id: "openPmTabForIncomingTyping",
                    scope: getScopeArray(["global"]),
                    title: "Open a PM Tab on Typing",
                    description: "Should XarChat open a PM tab (if you don't have one already open) when someone starts typing a private message to you?",
                    type: "select",
                    selectOptions: [
                        { value: 0, displayValue: "No" },
                        { value: 1, displayValue: "Yes" },
                        { value: 2, displayValue: "Yes and Ping" },
                    ],
                    defaultValue: 0,
                    configBlockKey: "openPmTabForIncomingTyping.enabled"
                },
                {
                    scope: getScopeArray(["global"]),
                    sectionTitle: "Links and Images",
                    items: [
                        {
                            id: "showImagePreviewPopups",
                            scope: getScopeArray(["global"]),
                            title: "Show Image Preview Popups",
                            description: "Show a preview of images and certain other links when the mouse pointer is hovered over them.",
                            type: "boolean",
                            defaultValue: true,
                            configBlockKey: "showImagePreviewPopups"
                        },
                        {
                            id: "launchImagesInternally",
                            scope: getScopeArray(["global"]),
                            title: "Use Internal Image Viewer",
                            description: "Show images using XarChat's internal image viewer pane when clicked instead of opening them in your browser.",
                            type: "boolean",
                            defaultValue: true,
                            configBlockKey: "launchImagesInternally"
                        },
                        {
                            id: "urlLaunchExecutable",
                            scope: getScopeArray(["global"]),
                            title: "Custom Command for Opening Links",
                            description: "Specify a custom command-line command to open links clicked within XarChat.  To use the default " +
                                "behavior of opening links in your system default web browser, leave this field blank.  When specifying a " +
                                "custom command, use \"%s\" as a placeholder for the URL of the link being opened.  If the main executable " +
                                "to be run has spaces in its name or path, enclose it within double-quotes.",
                            type: "text",
                            defaultValue: "",
                            fieldWidth: "200em",
                            actionButtons: [
                                {
                                    "title": "Test URL Launch",
                                    "onClick": (args) => {
                                        HostInterop.launchUrl(args.appViewModel, "https://xariah.net/", true);
                                    }
                                }
                            ],
                            configBlockKey: "urlLaunchExecutable"
                        },
                    ]
                },
                {
                    scope: getScopeArray(["global"]),
                    sectionTitle: "Auto Idle/Away",
                    items: [
                        {
                            id: "autoAway",
                            scope: getScopeArray(["global"]),
                            title: "Auto Away",
                            description: "Automatically change your status to Away when your computer is locked.",
                            type: "boolean",
                            defaultValue: true,
                            configBlockKey: "autoAway"
                        },                        
                        {
                            id: "autoIdle",
                            scope: getScopeArray(["global"]),
                            title: "Auto Idle",
                            description: "Automatically change your status to Idle when your computer input is idle.",
                            type: "boolean",
                            defaultValue: true,
                            configBlockKey: "autoIdle"
                        },
                        {
                            id: "idleAfterMinutes",
                            scope: getScopeArray(["global"]),
                            title: "Auto Idle After",
                            description: "How many minutes your computer must be idle before setting auto idle.",
                            type: "number",
                            min: 1,
                            max: 60 * 24,
                            defaultValue: 10,
                            fieldWidth: "calc(9px * 5)",
                            configBlockKey: "idleAfterMinutes",
                            enableIf: (opts) => {
                                if (opts.getConfigEntryById("autoIdle") == true) {
                                    return true;
                                }
                                else {
                                    return false;
                                }
                            }
                        }                
                    ]
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
                        },
                        {
                            id: "flashTaskbarButton",
                            scope: getScopeArray(["global"]),
                            title: "Flash Taskbar Button on Pings and Unseen PMs",
                            description: "Flash the Windows taskbar button for XarChat when a ping or unseen private message is received.",
                            type: "boolean",
                            defaultValue: true,
                            configBlockKey: "flashTaskbarButton"
                        }
                    ]
                },
                {
                    scope: getScopeArray(["global", "char", "convo"]),
                    sectionTitle: "Notifications",
                    description: "Configure where notification messages for various events are displayed.",
                    items: [
                        {
                            scope: getScopeArray(["global", "char"]),
                            id: getFullRoutedNotificationConfigName("errorGet"),
                            title: "Error Messages",
                            description: "Error messages sent by F-Chat.",
                            type: "notifroutes",
                            notifRouteOptions: { canToast: true, canGoToNotifications: true },
                            defaultValue: "console,*currenttab,notification,toast,notification",
                            configBlockKey: getFullRoutedNotificationConfigName("errorGet"),
                            notYetImplemented: true,
                            migrations: {
                                1: (v) => { 
                                    return addNotifRoutes(v, [ "toast", "notification" ]);
                                }
                            },
                            hidden: true
                        },
                        {
                            scope: getScopeArray(["global", "char"]),
                            id: getFullRoutedNotificationConfigName("broadcastGet"),
                            title: "Admin Broadcasts",
                            description: "Broadcasts sent by chat administrators to all online characters.",
                            type: "notifroutes",
                            notifRouteOptions: { canToast: true, canGoToNotifications: true },
                            defaultValue: "*everywhere,toast,notification",
                            configBlockKey: getFullRoutedNotificationConfigName("broadcastGet"),
                            notYetImplemented: true,
                            migrations: {
                                1: (v) => { 
                                    return addNotifRoutes(v, [ "toast", "notification" ]);
                                }
                            },
                            hidden: true
                        },
                        {
                            scope: getScopeArray(["global", "char"]),
                            id: getFullRoutedNotificationConfigName("systemMessageGet"),
                            title: "System Message",
                            description: "Uncategorized messages sent by the F-Chat system.",
                            type: "notifroutes",
                            notifRouteOptions: { canToast: true, canGoToNotifications: true },
                            defaultValue: "console,currenttab,targetchannel,toast,notification",
                            configBlockKey: getFullRoutedNotificationConfigName("systemMessageGet"),
                            notYetImplemented: true,
                            migrations: {
                                1: (v) => { 
                                    return addNotifRoutes(v, [ "toast", "notification" ]);
                                }
                            },
                            hidden: true
                        },
                        {
                            scope: getScopeArray(["global", "char"]),
                            id: getFullRoutedNotificationConfigName("friendAddRemove"),
                            title: "Friend Added/Removed",
                            description: "A character was added or removed from your friends list.",
                            type: "notifroutes",
                            defaultValue: "console,currenttab,pmconvo,toast,notification",
                            configBlockKey: getFullRoutedNotificationConfigName("friendAddRemove"),
                            notifRouteOptions: {
                                hasCharacterContext: true,
                                canToast: true,
                                canGoToNotifications: true
                            },
                            migrations: {
                                1: (v) => { 
                                    return addNotifRoutes(v, [ "toast", "notification" ]);
                                }
                            }
                        },
                        {
                            scope: getScopeArray(["global", "char"]),
                            id: getFullRoutedNotificationConfigName("friendRequest"),
                            title: "Friend Request",
                            description: "A character requested to be your friend.",
                            type: "notifroutes",
                            defaultValue: "console,currenttab,pmconvo,toast,notification",
                            configBlockKey: getFullRoutedNotificationConfigName("friendRequest"),
                            notifRouteOptions: {
                                hasCharacterContext: true,
                                canToast: true,
                                canGoToNotifications: true
                            },
                            migrations: {
                                1: (v) => { 
                                    return addNotifRoutes(v, [ "toast", "notification" ]);
                                }
                            }
                        },
                        {
                            scope: getScopeArray(["global", "char"]),
                            id: getFullRoutedNotificationConfigName("bookmarkAddRemove"),
                            title: "Bookmark Added/Removed",
                            description: "A character was added or removed from your bookmarks list.",
                            type: "notifroutes",
                            defaultValue: "console,currenttab,pmconvo,toast,notification",
                            configBlockKey: getFullRoutedNotificationConfigName("bookmarkAddRemove"),
                            notifRouteOptions: {
                                hasCharacterContext: true,
                                canToast: true,
                                canGoToNotifications: true
                            },
                            migrations: {
                                1: (v) => { 
                                    return addNotifRoutes(v, [ "toast", "notification" ]);
                                }
                            }
                        },
                        {
                            scope: getScopeArray(["global", "char"]),
                            id: getFullRoutedNotificationConfigName("interestAddRemove"),
                            title: "Interest Added/Removed",
                            description: "A character was added or removed from your interests list.",
                            type: "notifroutes",
                            defaultValue: "console,currenttab,pmconvo,toast,notification",
                            configBlockKey: getFullRoutedNotificationConfigName("interestAddRemove"),
                            notifRouteOptions: {
                                hasCharacterContext: true,
                                canToast: true,
                                canGoToNotifications: true
                            },
                            migrations: {
                                1: (v) => { 
                                    return addNotifRoutes(v, [ "toast", "notification" ]);
                                }
                            }
                        },
                        {
                            scope: getScopeArray(["global", "char"]),
                            id: getFullRoutedNotificationConfigName("ignoreAddRemove"),
                            title: "Ignore Added/Removed",
                            description: "A character was added or removed from your ignore list.",
                            type: "notifroutes",
                            defaultValue: "console,currenttab,pmconvo,toast,notification",
                            configBlockKey: getFullRoutedNotificationConfigName("ignoreAddRemove"),
                            notifRouteOptions: {
                                hasCharacterContext: true,
                                canToast: true,
                                canGoToNotifications: true
                            },
                            migrations: {
                                1: (v) => { 
                                    return addNotifRoutes(v, [ "toast", "notification" ]);
                                }
                            }
                        },
                        {
                            scope: getScopeArray(["global", "char"]),
                            id: getFullRoutedNotificationConfigName("serverOpAddRemove"),
                            title: "Server Operator Added/Removed",
                            description: "A character was promoted or demoted to/from F-Chat server operator status by the chat administrators.",
                            type: "notifroutes",
                            defaultValue: "console,*currenttab,pmconvo,notification",
                            configBlockKey: getFullRoutedNotificationConfigName("serverOpAddRemove"),
                            notifRouteOptions: {
                                hasCharacterContext: true,
                                canToast: true,
                                canGoToNotifications: true
                            },
                            migrations: {
                                1: (v) => { 
                                    return addNotifRoutes(v, [ "notification" ]);
                                }
                            }
                        },
                        {
                            scope: getScopeArray(["global", "char"]),
                            id: getFullRoutedNotificationConfigName("meStatusUpdate"),
                            title: "Your Character Status Updated",
                            description: "Your character status was updated.",
                            type: "notifroutes",
                            notifRouteOptions: { canToast: true, canGoToNotifications: true },
                            defaultValue: "console,currenttab,toast,notification",
                            configBlockKey: getFullRoutedNotificationConfigName("meStatusUpdate"),
                            migrations: {
                                1: (v) => { 
                                    return addNotifRoutes(v, [ "toast","notification" ]);
                                }
                            }
                        },
                        {
                            scope: getScopeArray(["global", "char"]),
                            id: getFullRoutedNotificationConfigName("friendStatusUpdate"),
                            title: "Friend Character Status Updated",
                            description: "A friend updated their character status.",
                            type: "notifroutes",
                            defaultValue: "console,currenttab,pmconvo,toast,notification",
                            configBlockKey: getFullRoutedNotificationConfigName("friendStatusUpdate"),
                            notifRouteOptions: {
                                hasCharacterContext: true,
                                canToast: true,
                                canGoToNotifications: true
                            },
                            migrations: {
                                1: (v) => { 
                                    return addNotifRoutes(v, [ "toast","notification" ]);
                                }
                            }
                        },
                        {
                            scope: getScopeArray(["global", "char"]),
                            id: getFullRoutedNotificationConfigName("bookmarkStatusUpdate"),
                            title: "Bookmark Character Status Updated",
                            description: "A bookmark updated their character status.",
                            type: "notifroutes",
                            defaultValue: "console,currenttab,pmconvo,toast,notification",
                            configBlockKey: getFullRoutedNotificationConfigName("bookmarkStatusUpdate"),
                            notifRouteOptions: {
                                hasCharacterContext: true,
                                canToast: true,
                                canGoToNotifications: true
                            },
                            migrations: {
                                1: (v) => { 
                                    return addNotifRoutes(v, [ "toast","notification" ]);
                                }
                            }
                        },
                        {
                            scope: getScopeArray(["global", "char"]),
                            id: getFullRoutedNotificationConfigName("interestStatusUpdate"),
                            title: "Interest Character Status Updated",
                            description: "An interest updated their character status.",
                            type: "notifroutes",
                            defaultValue: "console,currenttab,pmconvo,toast,notification",
                            configBlockKey: getFullRoutedNotificationConfigName("interestStatusUpdate"),
                            notifRouteOptions: {
                                hasCharacterContext: true,
                                canToast: true,
                                canGoToNotifications: true
                            },
                            migrations: {
                                1: (v) => { 
                                    return addNotifRoutes(v, [ "toast","notification" ]);
                                }
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
                                hasCharacterContext: true,
                                canToast: true,
                                canGoToNotifications: true
                            }
                        },
                        {
                            scope: getScopeArray(["global", "char"]),
                            id: getFullRoutedNotificationConfigName("friendOnlineChange"),
                            title: "Friend Online/Offline",
                            description: "A friend came online or went offline.",
                            type: "notifroutes",
                            defaultValue: "console,currenttab,pmconvo,toast,notification",
                            configBlockKey: getFullRoutedNotificationConfigName("friendOnlineChange"),
                            notifRouteOptions: {
                                hasCharacterContext: true,
                                canToast: true,
                                canGoToNotifications: true
                            },
                            migrations: {
                                1: (v) => { 
                                    return addNotifRoutes(v, [ "toast","notification" ]);
                                }
                            }
                        },
                        {
                            scope: getScopeArray(["global", "char"]),
                            id: getFullRoutedNotificationConfigName("bookmarkOnlineChange"),
                            title: "Bookmark Online/Offline",
                            description: "A bookmark came online or went offline.",
                            type: "notifroutes",
                            defaultValue: "console,currenttab,pmconvo,toast,notification",
                            configBlockKey: getFullRoutedNotificationConfigName("bookmarkOnlineChange"),
                            notifRouteOptions: {
                                hasCharacterContext: true,
                                canToast: true,
                                canGoToNotifications: true
                            },
                            migrations: {
                                1: (v) => { 
                                    return addNotifRoutes(v, [ "toast","notification" ]);
                                }
                            }
                        },
                        {
                            scope: getScopeArray(["global", "char"]),
                            id: getFullRoutedNotificationConfigName("interestOnlineChange"),
                            title: "Interest Online/Offline",
                            description: "An interest came online or went offline.",
                            type: "notifroutes",
                            defaultValue: "console,currenttab,pmconvo,toast,notification",
                            configBlockKey: getFullRoutedNotificationConfigName("interestOnlineChange"),
                            notifRouteOptions: {
                                hasCharacterContext: true,
                                canToast: true,
                                canGoToNotifications: true
                            },
                            migrations: {
                                1: (v) => { 
                                    return addNotifRoutes(v, [ "toast","notification" ]);
                                }
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
                                hasCharacterContext: true,
                                canToast: true,
                                canGoToNotifications: true
                            }
                        },
                        {
                            scope: getScopeArray(["global", "char"]),
                            id: getFullRoutedNotificationConfigName("meKicked"),
                            title: "You Kicked/Banned From Channel",
                            description: "You were kicked, banned, or timed out from a channel.",
                            type: "notifroutes",
                            defaultValue: "*console,*currenttab,*targetchannel,toast,notification",
                            configBlockKey: getFullRoutedNotificationConfigName("meKicked"),
                            notifRouteOptions: {
                                hasChannelContext: true,
                                canToast: true,
                                canGoToNotifications: true
                            },
                            migrations: {
                                1: (v) => { 
                                    return addNotifRoutes(v, [ "toast","notification" ]);
                                }
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
                                hasChannelContext: true,
                                canToast: true,
                                canGoToNotifications: true
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
                                hasCharacterContext: true,
                                canToast: true,
                                canGoToNotifications: true
                            }
                        },
                        {
                            scope: getScopeArray(["global", "char"]),
                            id: getFullRoutedNotificationConfigName("chanInvited"),
                            title: "Channel Invite Received",
                            description: "An invitation to join a channel was received.",
                            type: "notifroutes",
                            defaultValue: "console,currenttab,pmconvo,toast,notification",
                            configBlockKey: getFullRoutedNotificationConfigName("chanInvited"),
                            notifRouteOptions: {
                                hasChannelContext: false, // can't see an invite when you're already in the channel!
                                hasCharacterContext: true,
                                canToast: true,
                                canGoToNotifications: true
                            },
                            migrations: {
                                1: (v) => { 
                                    return addNotifRoutes(v, [ "toast","notification" ]);
                                }
                            }
                        },
                        {
                            scope: getScopeArray(["global", "char"]),
                            id: getFullRoutedNotificationConfigName("noteGet"),
                            title: "Note Received",
                            description: "A new note on F-List was received.",
                            type: "notifroutes",
                            defaultValue: "console,pmconvo,currenttab,toast,notification",
                            configBlockKey: getFullRoutedNotificationConfigName("noteGet"),
                            notifRouteOptions: {
                                hasCharacterContext: true,
                                canToast: true,
                                canGoToNotifications: true
                            },
                            migrations: {
                                1: (v) => { 
                                    return addNotifRoutes(v, [ "toast","notification" ]);
                                }
                            }
                        },
                        {
                            id: "perCharMessageRouting.enabled",
                            scope: getScopeArray(["convo"]),
                            title: "Customize Status Update Notifications",
                            description: "",
                            descriptionByScope: {
                                "global": "Invalid setting.",
                                "char": "Invalid setting.",
                                "char.chancategory": "Invalid setting.",
                                "char.chan": "Invalid setting.",
                                "char.convo": "Should online/offline/status update notifications for \"$CONVOCHAR$\" be treated specially?"
                            },
                            type: "select",
                            selectOptions: [
                                { value: "default", displayValue: "Use Defaults" },
                                { value: "override", displayValue: "Use Settings Below" }
                            ],
                            defaultValue: "default",
                            configBlockKey: "perCharMessageRouting.enabled"
                        },
                        {
                            id: "perCharMessageRouting.onlineChange.routing",
                            scope: getScopeArray(["convo"]),
                            title: "Customized Online/Offline Update Notification Routing",
                            description: "",
                            descriptionByScope: {
                                "global": "Invalid setting.",
                                "char": "Invalid setting.",
                                "char.chancategory": "Invalid setting.",
                                "char.chan": "Invalid setting.",
                                "char.convo": "Use these routing settings for online/offline notifications for \"$CONVOCHAR$\""
                            },
                            type: "notifroutes",
                            defaultValue: "console,currenttab,pmconvo",
                            configBlockKey: "perCharMessageRouting.onlineChange.routing",
                            notifRouteOptions: {
                                hasCharacterContext: true
                            },
                            enableIf: (opts) => {
                                if (opts.getConfigEntryById("perCharMessageRouting.enabled") == "override") {
                                    return true;
                                }
                                else {
                                    return false;
                                }
                            }
                        },
                        {
                            id: "perCharMessageRouting.statusUpdate.routing",
                            scope: getScopeArray(["convo"]),
                            title: "Customized Status Update Notification Routing",
                            description: "",
                            descriptionByScope: {
                                "global": "Invalid setting.",
                                "char": "Invalid setting.",
                                "char.chancategory": "Invalid setting.",
                                "char.chan": "Invalid setting.",
                                "char.convo": "Use these routing settings for status change notifications for \"$CONVOCHAR$\""
                            },
                            type: "notifroutes",
                            defaultValue: "console,currenttab,pmconvo,toast,notification",
                            configBlockKey: "perCharMessageRouting.statusUpdate.routing",
                            notifRouteOptions: {
                                hasCharacterContext: true,
                                canToast: true
                            },
                            enableIf: (opts) => {
                                if (opts.getConfigEntryById("perCharMessageRouting.enabled") == "override") {
                                    return true;
                                }
                                else {
                                    return false;
                                }
                            },
                            migrations: {
                                1: (v) => { 
                                    return addNotifRoutes(v, [ "toast","notification" ]);
                                }
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
                    id: "nickname",
                    scope: getScopeArray(["convo"]),
                    title: "Character Nickname",
                    description: "Enter a nickname that will appear next to this character's name in most places where it gets displayed.",
                    type: "text",
                    maxLength: 40,
                    defaultValue: "",
                    configBlockKey: "nickname"
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
                    description: "Show friends and bookmarks together in the friends tab and in channel character lists.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "joinFriendsAndBookmarks"
                },
                {
                    id: "friendsTabLocation",
                    scope: getScopeArray(["global"]),
                    title: "Friends/Bookmarks Tab Location",
                    description: "Show the friends and bookmarks tab on which side of the interface?",
                    type: "select",
                    selectOptions: [
                        { value: "left", displayValue: "Left (Default)" },
                        { value: "right", displayValue: "Right" }
                    ],
                    defaultValue: "left",
                    configBlockKey: "friendsTabLocation"
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
                        "global": `Change the size of the font in the chat message stream for channels and PM conversations. (You can change the size of everything with ${shortcutKeyCombiningPrefixString}ScrollWheel.)`,
                        "char": `Change the size of the font in the chat message stream for channels and PM conversations. (You can change the size of everything with ${shortcutKeyCombiningPrefixString}ScrollWheel.)`,
                        "char.chancategory": `Change the size of the font in the chat message stream for channels in this category. (You can change the size of everything with ${shortcutKeyCombiningPrefixString}ScrollWheel.)`,
                        "char.chan": `Change the size of the font in the chat message stream for this channel. (You can change the size of everything with ${shortcutKeyCombiningPrefixString}ScrollWheel.)`,
                        "char.convo": `Change the size of the font in the chat message stream for PM conversations with \"$CONVOCHAR$\". (You can change the size of everything with ${shortcutKeyCombiningPrefixString}ScrollWheel.)`
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
                    id: "showChatTextboxToolbar",
                    scope: getScopeArray(["global"]),
                    title: "Show Chat Textbox Toolbar",
                    description: "Show a BBCode editing toolbar above the chat entry textbox.",
                    type: "boolean",
                    defaultValue: false,
                    configBlockKey: "chat.textbox.toolbarShown"
                },
                {
                    id: "showChatTextboxStatusBar",
                    scope: getScopeArray(["global"]),
                    title: "Show Chat Textbox Toolbar",
                    description: "Show a word/character count status bar below the chat entry textbox.",
                    type: "boolean",
                    defaultValue: false,
                    configBlockKey: "chat.textbox.statusBarShown"
                },
                {
                    scope: getScopeArray(["global"]),
                    sectionTitle: "Left Bar",
                    description: "",
                    items: [
                        {
                            id: "leftBar.sectionOrdering",
                            scope: getScopeArray(["global"]),
                            title: "Chats List Section Ordering",
                            description: "What order should sections be shown in the left bar channel/PM list?",
                            type: "select",
                            selectOptions: [
                                { value: "cp", displayValue: "Channels, Private Messages" },
                                { value: "pc", displayValue: "Private Messages, Channels" }
                            ],
                            defaultValue: "cp",
                            configBlockKey: "leftBar.sectionOrdering"
                        },
                        {
                            id: "leftBar.density",
                            scope: getScopeArray(["global"]),
                            title: "Chats List Item Density",
                            description: "How dense should items be packed in the left bar channel/PM list?",
                            type: "select",
                            selectOptions: [
                                { value: "normal", displayValue: "Normal" },
                                { value: "dense", displayValue: "Dense" }
                            ],
                            defaultValue: "normal",
                            configBlockKey: "leftBar.density"
                        }
                    ]
                },
                {
                    scope: getScopeArray(["global", "char", "chan"]),
                    sectionTitle: "Unseen Messages",
                    description: "",
                    items: [
                        {
                            id: "unseenIndicator",
                            scope: getScopeArray(["global", "char", "chan"]),
                            title: "Track Unseen Messages",
                            description: "",
                            descriptionByScope: {
                                "global": "Channels should track when new unseen messages that do not include ping words have arrived.",
                                "char": "Channels should track when new unseen messages that do not include ping words have arrived.",
                                "char.chancategory": "Channels in this category should track when new unseen messages that do not include ping words have arrived.",
                                "char.chan": "This channel should track when new unseen messages that do not include ping words have arrived.",
                                "char.convo": "invalid"
                            },
                            type: "boolean",
                            defaultValue: true,
                            configBlockKey: "showUnseenIndicator"
                        },
                        {
                            id: "unseenIndicatorStyle",
                            scope: getScopeArray(["global"]),
                            title: "Unseen Messages Indicator Style",
                            description: "Choose how a channel shows that it has unseen messages that do not include ping words. (This only appears if the channel is tracking unseen messages.)",
                            type: "select",
                            selectOptions: [
                                { value: "standard", displayValue: "Dot on Window Edge (Default)" },
                                { value: "title", displayValue: "Dot on Channel Title" },
                                { value: "highlight", displayValue: "Highlight Background Color" },
                            ],
                            defaultValue: "standard",
                            configBlockKey: "unseenIndicatorStyle"
                        },
                        {
                            id: "unseenIndicatorHighlightColor",
                            scope: getScopeArray(["global"]),
                            title: "Unseen Messages Indicator Highlight Color",
                            description: "Select a background color to highlight channels that have unseen messages. (Only used when the indicator style is set to highlight background color.)",
                            type: "bgcolorcontrol",
                            defaultValue: "246;36;1",
                            configBlockKey: "unseenIndicatorHighlightColor"
                        },
                    ]
                },
                {
                    scope: getScopeArray(["global"]),
                    sectionTitle: "Locale",
                    description: "Configure localization settings for XarChat.",
                    items: [
                        {
                            id: "locale.dateFormat",
                            scope: getScopeArray(["global"]),
                            title: "Date Formatting",
                            description: "Select the format used for displaying dates.",
                            type: "select",
                            selectOptions: [
                                { value: "default", displayValue: "Use Auto-Detected Setting" },
                                { value: "mdyyyy", displayValue: "M/D/YYYY" },
                                { value: "mmddyyyy", displayValue: "MM/DD/YYYY" },
                                { value: "dmyyyy", displayValue: "D/M/YYYY" },
                                { value: "ddmmyyyy", displayValue: "DD/MM/YYYY" },
                                { value: "yyyymmdd", displayValue: "YYYY/MM/DD" }
                            ],
                            defaultValue: "default",
                            configBlockKey: "locale.dateFormat"
                        },
                        {
                            id: "locale.timeFormat",
                            scope: getScopeArray(["global"]),
                            title: "Time Formatting",
                            description: "Select the format used for displaying times.",
                            type: "select",
                            selectOptions: [
                                { value: "default", displayValue: "Use Auto-Detected Setting" },
                                { value: "12h", displayValue: "12 Hour (AM/PM)" },
                                { value: "24h", displayValue: "24 Hour" }
                            ],
                            defaultValue: "default",
                            configBlockKey: "locale.timeFormat"
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
                            type: "bgcolorcontrol",
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
                                    id: "color.gender.male-trans",
                                    title: "Male (Trans)",
                                    description: "",
                                    type: "color",
                                    defaultValue: "#5bcefa",
                                    configBlockKey: "color.gender.male-trans",
                                    hidden: true
                                },                                
                                {
                                    scope: getScopeArray(["global"]),
                                    id: "color.gender.female-trans",
                                    title: "Female (Trans)",
                                    description: "",
                                    type: "color",
                                    defaultValue: "#f5a9ba",
                                    configBlockKey: "color.gender.female-trans",
                                    hidden: true
                                },                                
                                {
                                    scope: getScopeArray(["global"]),
                                    id: "color.gender.intersex",
                                    title: "Intersex",
                                    description: "",
                                    type: "color",
                                    defaultValue: "#ae9487",
                                    configBlockKey: "color.gender.intersex",
                                    hidden: true
                                },                                
                                {
                                    scope: getScopeArray(["global"]),
                                    id: "color.gender.nonbinary",
                                    title: "Non-Binary",
                                    description: "",
                                    type: "color",
                                    defaultValue: "#16b78e",
                                    configBlockKey: "color.gender.nonbinary",
                                    hidden: true
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
                            sectionTitle: "Friends and Bookmarks",
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
                                },
                                {
                                    id: "useBookmarkColor",
                                    scope: getScopeArray(["global"]),
                                    title: "Use Bookmark Color",
                                    description: "Colorize bookmarks' names with a distinct 'Bookmark' color.",
                                    type: "boolean",
                                    defaultValue: false,
                                    configBlockKey: "useBookmarkColor"
                                },
                                {
                                    scope: getScopeArray(["global"]),
                                    id: "color.bookmark",
                                    title: "Bookmark",
                                    description: "",
                                    type: "color",
                                    defaultValue: "#FCBA03",
                                    configBlockKey: "color.bookmark"
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
                {
                    scope: getScopeArray(["global", "char", "chan", "convo"]),
                    sectionTitle: "Profiles",
                    items: [
                        {
                            id: "profileLimitIndent",
                            scope: getScopeArray(["global", "char"]),
                            title: "Limit Indentation",
                            description: "Limit excessive indentation in profiles.",
                            type: "boolean",
                            defaultValue: true,
                            configBlockKey: "profileLimitIndent"
                        }
                    ]
                },
                {
                    scope: getScopeArray(["global", "char", "chan", "convo"]),
                    sectionTitle: "EIcons",
                    items: [
                        {
                            id: "eiconDisplaySize",
                            scope: getScopeArray(["global", "char", "chan", "convo"]),
                            title: "EIcon Display Size",
                            description: "",
                            descriptionByScope: {
                                "global": "Select a size to display eicon images.",
                                "char": "Select a size to display eicon images when signed in as \"$MYCHAR$\".",
                                "char.chancategory": "Select a size to display eicon images for channels in the \"$CHANCATEGORY$\" category.",
                                "char.chan": "Select a size to display eicon images in this channel.",
                                "char.convo": "Select a size to display eicon images in PM conversations with \"$CONVOCHAR$\"."
                            },
                            type: "select",
                            selectOptions: [
                                { value: "small", displayValue: "Small" },
                                { value: "normal", displayValue: "Normal" },
                                { value: "large", displayValue: "Large" }
                            ],
                            defaultValue: "normal",
                            configBlockKey: "eiconDisplaySize"
                        },
                        // {
                        //     id: "eiconMaxCountChat",
                        //     scope: getScopeArray(["global", "char", "chan", "convo"]),
                        //     title: "Maximum EIcons per Message",
                        //     description: "",
                        //     descriptionByScope: {
                        //         "global": "Maximum number of eicons to show per message.",
                        //         "char": "Maximum number of eicons to show per message when signed in as \"$MYCHAR$\".",
                        //         "char.chancategory": "Maximum number of eicons to show per message for channels in the \"$CHANCATEGORY$\" category.",
                        //         "char.chan": "Maximum number of eicons to show per message in this channel.",
                        //         "char.convo": "Maximum number of eicons to show per message in PM conversations with \"$CONVOCHAR$\"."
                        //     },
                        //     type: "select",
                        //     selectOptions: [
                        //         { value: "none", displayValue: "No Limit" },
                        //         ...generateNumericOptions(0, 20)
                        //     ],
                        //     defaultValue: "none",
                        //     configBlockKey: "eiconMaxCountChat"
                        // },
                        // {
                        //     id: "eiconMaxCountAd",
                        //     scope: getScopeArray(["global", "char", "chan"]),
                        //     title: "Maximum EIcons per Ad",
                        //     description: "",
                        //     descriptionByScope: {
                        //         "global": "Maximum number of eicons to show per ad.",
                        //         "char": "Maximum number of eicons to show per ad when signed in as \"$MYCHAR$\".",
                        //         "char.chancategory": "Maximum number of eicons to show per ad for channels in the \"$CHANCATEGORY$\" category.",
                        //         "char.chan": "Maximum number of eicons to show per ad in this channel.",
                        //         "char.convo": "INVALID"
                        //     },
                        //     type: "select",
                        //     selectOptions: [
                        //         { value: "none", displayValue: "No Limit" },
                        //         ...generateNumericOptions(0, 20)
                        //     ],
                        //     defaultValue: "none",
                        //     configBlockKey: "eiconMaxCountAd"
                        // }
                    ]
                }
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
                    description: "",
                    descriptionByScope: {
                        "global": "Log all channels and PM conversations to a local file.",
                        "char": "Log all channels and PM conversations to a local file for \"$MYCHAR$\".",
                        "char.chancategory": "Log all channels in the \"$CHANCATEGORY$\" category to a local file.",
                        "char.chan": "Log this channel to a local file.",
                        "char.convo": "Log PM conversations with \"$CONVOCHAR$\" to a local file."
                    },
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "loggingEnabled"
                },
                {
                    id: "logFileSize",
                    scope: getScopeArray(["global"]),
                    title: "Total Log Size",
                    description: "The current total size of your entire chat log file, including all channels and PM conversations.",
                    type: "displaytext",
                    defaultValue: "",
                    configBlockKey: "logFileSize",
                    initializeDisplay: () => {
                        HostInterop.logFileMaintenance.refreshLogFileSizeAsync(CancellationToken.NONE);
                    },
                    calculateValue: (cvo) => {
                        return StringUtils.numberToApproximateFileSize(HostInterop.logFileMaintenance.logFileSize);
                    },
                    actionButtons: [
                        { 
                            title: "Log File Maintenance...", 
                            onClick: async (args) => {
                                const dlg = new LogFileMaintenanceDialogViewModel(args.appViewModel);
                                await args.appViewModel.showDialogAsync(dlg);
                            }
                        }
                    ]
                },
                {
                    id: "retentionPeriod.chan",
                    scope: getScopeArray(["global", "char", "chan"]),
                    title: "Channel Message Log Retention",
                    description: "",
                    descriptionByScope: {
                        "global": "How long to keep chat channel messages in the log file. " + chanRetentionPeriodNote,
                        "char": "How long to keep chat channel messages in the log file. " + chanRetentionPeriodNote,
                        "char.chancategory": "How long to keep messages for channels in the \"$CHANCATEGORY$\" category in the log file. " + chanRetentionPeriodNote,
                        "char.chan": "How long to keep messages for this channel in the log file. " + chanRetentionPeriodNote,
                        "char.convo": "Invalid setting."
                    },
                    type: "timespan",
                    defaultValue: 2160,  // 90 days * 24 hours
                    configBlockKey: "loggingRetentionChannel",
                    notYetImplemented: true
                },
                {
                    id: "retentionPeriod.convo",
                    scope: getScopeArray(["global", "char", "convo"]),
                    title: "Private Message Log Retention",
                    description: "",
                    descriptionByScope: {
                        "global": "How long to keep private messages in the log file.",
                        "char": "How long to keep private messages in the log file.",
                        "char.chancategory": "Invalid setting.",
                        "char.chan": "Invalid setting.",
                        "char.convo": "How long to keep private messages from \"$CONVOCHAR$\" in the log file."
                    },
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

(async () => {
    const locales = await HostInterop.getAvailableLocales(CancellationToken.NONE);
    for (let l of locales) {
        spellCheckLanguageItem.selectOptions?.push({ value: l.code, displayValue: l.name });
    }
})();