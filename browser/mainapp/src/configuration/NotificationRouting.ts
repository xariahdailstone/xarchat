
export class NotificationRouting {
    constructor(str: string) {
        for (let substr of str.split(",")) {
            const isImportant = substr.startsWith("*");
            const substrStripped = isImportant ? substr.substring(1) : substr;
            const targetValue = isImportant ? "important" : "yes";

            switch (substrStripped) {
                case "console":
                    this.console = targetValue;
                    break;
                case "currenttab":
                    this.currentTab = targetValue;
                    break;
                case "pmconvo":
                    this.pmConvo = targetValue;
                    break;
                case "targetchannel":
                    this.targetChannel = targetValue;
                    break;
                case "everywhere":
                    this.everywhere = targetValue;
                    break;
            }
        }
    }

    toString() {
        const parts: (string | null)[] = [];
        const gpart = (target: string, value: NotificationRoutingTargetSetting) => {
            switch (value) {
                case "no":
                    return null;
                case "yes":
                    return target;
                case "important":
                    return `*${target}`;
            }
        };

        parts.push(gpart("console", this.console));
        parts.push(gpart("currenttab", this.currentTab));
        parts.push(gpart("pmconvo", this.pmConvo));
        parts.push(gpart("targetchannel", this.targetChannel));
        parts.push(gpart("everywhere", this.everywhere));

        const filteredParts = parts.filter(x => x != null);
        return filteredParts.join(",");
    }

    console: NotificationRoutingTargetSetting = "no";
    currentTab: NotificationRoutingTargetSetting = "no";
    pmConvo: NotificationRoutingTargetSetting = "no";
    targetChannel: NotificationRoutingTargetSetting = "no";
    everywhere: NotificationRoutingTargetSetting = "no";
}

export type NotificationRoutingTargetSetting = "no" | "yes" | "important";
