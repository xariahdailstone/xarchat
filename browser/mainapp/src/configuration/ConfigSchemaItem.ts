export interface ConfigSchemaDefinition {
    settings: ConfigSchemaItemDefinition[];
}

export interface ConfigSchemaItemDefinitionNew {
    id?: string;
    scope?: ConfigSchemaScopeType[];
    title: string;
    description?: string;
    type: ConfigSchemaItemType;
    options?: ConfigSchemaOptionDefinition[];
    defaultValue: unknown;
    configBlockKey: string;
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

export type ConfigSchemaItemDefinition = (ConfigSchemaItemDefinitionNew | ConfigSchemaItemDefinitionSection);

export type ConfigSchemaItemType = "text" | "boolean" | "text[]" | "radio" | "timespan" | "color" | "color-hs";
export type ConfigSchemaOptionItemType = "string" | "file";
export type ConfigSchemaScopeType = "global" | "char" | "char.chan" | "char.convo";

export const ConfigSchema: ConfigSchemaDefinition = {
    settings: [
        {
            scope: [ "global", "char", "char.chan", "char.convo" ],
            sectionTitle: "General Settings",
            items: [
                {
                    id: "autoIdle",
                    scope: [ "global", "char" ],
                    title: "Auto Idle",
                    description: "Automatically change your status to Idle when your computer input is idle.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "autoIdle.enabled"
                },
                {
                    id: "autoreconnect",
                    scope: [ "global", "char" ],
                    title: "Automatically Reconnect",
                    description: "Automatically attempt to reconnect to chat when the connection is lost unexpectedly.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "autoReconnect"
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
                    type: "text[]",
                    defaultValue: [],
                    configBlockKey: "pingWords"
                },
                {
                    id: "checkForUpdates",
                    scope: [ "global" ],
                    title: "Automatically Check For Updates",
                    description: "Check for new versions of XarChat when they are released.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "checkForUpdates"
                },
                {
                    id: "submitNewEIcons",
                    scope: [ "global" ],
                    title: "Submit New EIcons to xariah.net",
                    description: "Send newly seen eicons to xariah.net's eicon search index.",
                    type: "boolean",
                    defaultValue: true,
                    configBlockKey: "submitNewEIcons"
                },
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
                    configBlockKey: "loggingEnabled"
                },
                {
                    id: "retentionPeriod.chan",
                    scope: [ "global", "char", "char.chan" ],
                    title: "Channel Message Log Retention",
                    description: "How long to keep channel messages in the log file.",
                    type: "timespan",
                    defaultValue: 2160,  // 90 days * 24 hours
                    configBlockKey: "loggingEnabled"
                },
                {
                    id: "retentionPeriod.convo",
                    scope: [ "global", "char", "char.convo" ],
                    title: "Private Message Log Retention",
                    description: "How long to keep private messages in the log file.",
                    type: "timespan",
                    defaultValue: 120000,  // 5000 days * 24 hours
                    configBlockKey: "loggingEnabled"
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
                    configBlockKey: "sound.event.connect"
                },
                {
                    id: "sound.event.disconnect",
                    scope: [ "global", "char" ],
                    title: "Connected",
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
                    configBlockKey: "sound.event.disconnect"
                },
                {
                    id: "sound.event.pm",
                    scope: [ "global", "char", "char.convo" ],
                    title: "Connected",
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
                    configBlockKey: "sound.event.pm"
                },
                {
                    id: "sound.event.ping",
                    scope: [ "global", "char", "char.chan" ],
                    title: "Connected",
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
                    configBlockKey: "sound.event.ping"
                },
            ]
        },
        {
            scope: [ "global" ],
            sectionTitle: "Colors",
            description: "Choose colors for various parts of the XarChat interface.",
            items: [
                {
                    id: "backgroundcolor",
                    title: "Background",
                    type: "color-hs",
                    defaultValue: [0, 0],
                    configBlockKey: "bgColor"
                },
                {
                    sectionTitle: "Genders",
                    items: [
                        {
                            id: "gender.male",
                            title: "Male",
                            type: "color",
                            defaultValue: "#6699FF",
                            configBlockKey: "color.gender.male"
                        },
                        {
                            id: "gender.female",
                            title: "Female",
                            type: "color",
                            defaultValue: "#FF6699",
                            configBlockKey: "color.gender.female"
                        },
                        {
                            id: "gender.herm",
                            title: "Hermaphrodite",
                            type: "color",
                            defaultValue: "#9B30FF",
                            configBlockKey: "color.gender.herm"
                        },
                        {
                            id: "gender.male-herm",
                            title: "Male Hermaphrodite",
                            type: "color",
                            defaultValue: "#007FFF",
                            configBlockKey: "color.gender.male-herm"
                        },
                        {
                            id: "gender.shemale",
                            title: "Shemale",
                            type: "color",
                            defaultValue: "#CC66FF",
                            configBlockKey: "color.gender.shemale"
                        },
                        {
                            id: "gender.cunt-boy",
                            title: "Cuntboy",
                            type: "color",
                            defaultValue: "#00CC66",
                            configBlockKey: "color.gender.cunt-boy"
                        },
                        {
                            id: "gender.transgender",
                            title: "Transgender",
                            type: "color",
                            defaultValue: "#EE8822",
                            configBlockKey: "color.gender.transgender"
                        },
                        {
                            id: "gender.none",
                            title: "None",
                            type: "color",
                            defaultValue: "#FFFFBB",
                            configBlockKey: "color.gender.none"
                        },
                    ]
                }
            ]
        }
    ]
};