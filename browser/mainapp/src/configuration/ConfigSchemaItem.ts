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
}

export interface ConfigSchemaItemDefinitionSection {
    id?: string;
    scope?: ConfigSchemaScopeType[];
    sectionTitle: string;
    description?: string;
    items: ConfigSchemaItemDefinition[];
}

export interface ConfigSchemaOptionDefinition {
    id?: string;
    type: ConfigSchemaOptionItemType;
    prompt?: string;
    value?: unknown;
}

export type ConfigSchemaItemDefinition = (ConfigSchemaItemDefinitionItem | ConfigSchemaItemDefinitionSection);

export type ConfigSchemaItemType = "text" | "boolean" | "text[]" | "radio" | "timespan" | "color" | "color-hs";
export type ConfigSchemaOptionItemType = "string" | "file";
export type ConfigSchemaScopeType = "global" | "char" | "char.chan" | "char.convo";

export const ConfigSchema: ConfigSchemaDefinition = {
    settings: [
        {
            scope: [ "global", "char", "char.chan", "char.convo" ],
            sectionTitle: "General Settings",
            description: "These settings are still under development!  Check back in future versions of XarChat!",
            items: [
                {
                    id: "autoIdle",
                    scope: [ "global", "char" ],
                    title: "Auto Idle",
                    description: "Automatically change your status to Idle when your computer input is idle.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "autoIdle"
                },
                {
                    id: "autoAway",
                    scope: [ "global", "char" ],
                    title: "Auto Away",
                    description: "Automatically change your status to Away when your computer is locked.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "autoAway"
                },
                {
                    id: "autoReconnect",
                    scope: [ "global", "char" ],
                    title: "Automatically Reconnect",
                    description: "Automatically attempt to reconnect to chat when the connection is lost unexpectedly.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "autoReconnect"
                },
                {
                    id: "restoreStatusMessageOnLogin",
                    scope: [ "global", "char" ],
                    title: "Restore Status Message on Login",
                    description: "Restore your previous status message when logging in or reconnecting.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "restoreStatusMessageOnLogin"
                },
                {
                    id: "pingWords",
                    scope: [ "global", "char", "char.chan" ],
                    title: "Ping Words",
                    description: "Words that will cause a message to get highlighted and generate a ping sound effect when seen in chat.",
                    type: "text[]",
                    defaultValue: [],
                    configBlockKey: "pingWords"
                },
                {
                    id: "unseenIndicator",
                    scope: [ "global", "char", "char.chan" ],
                    title: "Show Unseen Messages Indicator",
                    description: "Show a white dot on channels where new unseen messages that do not include ping words have arrived.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "showUnseenIndicator"
                },
                {
                    id: "checkForUpdates",
                    scope: [ "global" ],
                    title: "Automatically Check For Updates",
                    description: "Check for new versions of XarChat when they are released.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "checkForUpdates",
                    notYetImplemented: true
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
            scope: [ "global", "char", "char.chan", "char.convo" ],
            sectionTitle: "Logging Options",
            items: [
                {
                    id: "loggingEnabled",
                    scope: [ "global", "char", "char.chan", "char.convo" ],
                    title: "Enable Logging",
                    description: "Log chat to a local file.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "loggingEnabled",
                    notYetImplemented: true
                },
                {
                    id: "retentionPeriod.chan",
                    scope: [ "global", "char", "char.chan" ],
                    title: "Channel Message Log Retention",
                    description: "How long to keep channel messages in the log file.",
                    type: "timespan",
                    defaultValue: 2160,  // 90 days * 24 hours
                    configBlockKey: "loggingEnabled",
                    notYetImplemented: true
                },
                {
                    id: "retentionPeriod.convo",
                    scope: [ "global", "char", "char.convo" ],
                    title: "Private Message Log Retention",
                    description: "How long to keep private messages in the log file.",
                    type: "timespan",
                    defaultValue: 120000,  // 5000 days * 24 hours
                    configBlockKey: "loggingEnabled",
                    notYetImplemented: true
                }
            ]
        },
        {
            scope: [ "global", "char", "char.chan", "char.convo" ],
            sectionTitle: "Sounds",
            description: "Configure the sounds XarChat will play on various events.",
            items: [
                {
                    id: "sound.event.connect",
                    scope: [ "global", "char" ],
                    title: "Connected",
                    description: "Sound to play when a connection to chat is established.",
                    type: "radio",
                    options: [
                        {
                            type: "string",
                            prompt: "None",
                            value: ""
                        },
                        {
                            type: "string",
                            prompt: "Default",
                            value: null
                        },
                        {
                            type: "file",
                            prompt: "Choose File"
                        },
                    ],
                    defaultValue: null,
                    configBlockKey: "sound.event.connect",
                    notYetImplemented: true
                },
                {
                    id: "sound.event.disconnect",
                    scope: [ "global", "char" ],
                    title: "Disconnected",
                    description: "Sound to play when a connection to chat is lost.",
                    type: "radio",
                    options: [
                        {
                            type: "string",
                            prompt: "None",
                            value: ""
                        },
                        {
                            type: "string",
                            prompt: "Default",
                            value: null
                        },
                        {
                            type: "file",
                            prompt: "Choose File"
                        },
                    ],
                    defaultValue: null,
                    configBlockKey: "sound.event.disconnect",
                    notYetImplemented: true
                },
                {
                    id: "sound.event.pm",
                    scope: [ "global", "char", "char.convo" ],
                    title: "New Private Message",
                    description: "Sound to play when a new unseen private message is received.",
                    type: "radio",
                    options: [
                        {
                            type: "string",
                            prompt: "None",
                            value: ""
                        },
                        {
                            type: "string",
                            prompt: "Default",
                            value: null
                        },
                        {
                            type: "file",
                            prompt: "Choose File"
                        },
                    ],
                    defaultValue: null,
                    configBlockKey: "sound.event.pm",
                    notYetImplemented: true
                },
                {
                    id: "sound.event.ping",
                    scope: [ "global", "char", "char.chan" ],
                    title: "Ping",
                    description: "Sound to play when a message containing a ping word is received.",
                    type: "radio",
                    options: [
                        {
                            type: "string",
                            prompt: "None",
                            value: ""
                        },
                        {
                            type: "string",
                            prompt: "Default",
                            value: null
                        },
                        {
                            type: "file",
                            prompt: "Choose File"
                        },
                    ],
                    defaultValue: null,
                    configBlockKey: "sound.event.ping",
                    notYetImplemented: true
                },
            ]
        },
        {
            scope: [ "global" ],
            sectionTitle: "Colors",
            description: "Choose colors for various parts of the XarChat interface.",
            items: [
                {
                    scope: [ "global" ],
                    id: "backgroundcolor",
                    title: "Background",
                    description: "Background color throughout XarChat.",
                    type: "color-hs",
                    defaultValue: "225;7",
                    configBlockKey: "bgColor"
                },
                {
                    scope: [ "global" ],
                    sectionTitle: "Genders",
                    items: [
                        {
                            scope: [ "global" ],
                            id: "gender.male",
                            title: "Male",
                            description: "[Coming Soon]",
                            type: "color",
                            defaultValue: "#6699FF",
                            configBlockKey: "color.gender.male",
                            notYetImplemented: true
                        },
                        {
                            scope: [ "global" ],
                            id: "gender.female",
                            title: "Female",
                            description: "[Coming Soon]",
                            type: "color",
                            defaultValue: "#FF6699",
                            configBlockKey: "color.gender.female",
                            notYetImplemented: true
                        },
                        {
                            scope: [ "global" ],
                            id: "gender.herm",
                            title: "Hermaphrodite",
                            description: "[Coming Soon]",
                            type: "color",
                            defaultValue: "#9B30FF",
                            configBlockKey: "color.gender.herm",
                            notYetImplemented: true
                        },
                        {
                            scope: [ "global" ],
                            id: "gender.male-herm",
                            title: "Male Hermaphrodite",
                            description: "[Coming Soon]",
                            type: "color",
                            defaultValue: "#007FFF",
                            configBlockKey: "color.gender.male-herm",
                            notYetImplemented: true
                        },
                        {
                            scope: [ "global" ],
                            id: "gender.shemale",
                            title: "Shemale",
                            description: "[Coming Soon]",
                            type: "color",
                            defaultValue: "#CC66FF",
                            configBlockKey: "color.gender.shemale",
                            notYetImplemented: true
                        },
                        {
                            scope: [ "global" ],
                            id: "gender.cunt-boy",
                            title: "Cuntboy",
                            description: "[Coming Soon]",
                            type: "color",
                            defaultValue: "#00CC66",
                            configBlockKey: "color.gender.cunt-boy",
                            notYetImplemented: true
                        },
                        {
                            scope: [ "global" ],
                            id: "gender.transgender",
                            title: "Transgender",
                            description: "[Coming Soon]",
                            type: "color",
                            defaultValue: "#EE8822",
                            configBlockKey: "color.gender.transgender",
                            notYetImplemented: true
                        },
                        {
                            scope: [ "global" ],
                            id: "gender.none",
                            title: "None",
                            description: "[Coming Soon]",
                            type: "color",
                            defaultValue: "#FFFFBB",
                            configBlockKey: "color.gender.none",
                            notYetImplemented: true
                        },
                    ]
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
                return chk(s.items);
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