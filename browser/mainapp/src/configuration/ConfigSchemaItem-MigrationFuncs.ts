
type NotifRouteItem = "console" | "currenttab" | "targetchannel" | "pmconvo" | "toast" | "notification";

export function addNotifRoutes(currentValue: string, toAdd: NotifRouteItem[]) {
    const cv = (currentValue ?? "").split(',');
    for (let ta of toAdd) {
        if (cv.indexOf(ta) == -1) {
            cv.push(ta);
        }
    }
    return cv.join(",");
}