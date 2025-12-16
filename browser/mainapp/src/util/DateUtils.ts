import { TimeSpanUtils } from "./TimeSpanUtils";

const DateTimeFormats = {
    ChatTimestampToday: new Intl.DateTimeFormat(undefined, { timeStyle: "short" }),
    ChatTimestampNotToday: new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" })
};

const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "long" });

export class DateUtils {
    static getMonthName(mon: number) {
        const d = new Date(1900, mon, 1, 0, 0, 0, 0);
        const result = monthFormatter.format(d);
        return result;
    }

    static areSameDate(a: Date, b: Date) {
        const aDate = a.getFullYear().toString() + '-' + a.getMonth().toString() + '-' + a.getDate().toString();
        const bDate = b.getFullYear().toString() + '-' + b.getMonth().toString() + '-' + b.getDate().toString();
        return (aDate == bDate);
    }

    static formatForChatTimestamp(d: Date) {
        return DateUtils.areSameDate(new Date(), d) ?
            DateTimeFormats.ChatTimestampToday.format(d) :
            DateTimeFormats.ChatTimestampNotToday.format(d);
    }

    static add(a: Date, ms: number) {
        return new Date(a.getTime() + ms);
    }

    static addMilliseconds(d: Date, ms: number) {
        return new Date(d.getTime() + ms);
    }

    static addDays(d: Date, days: number) {
        return new Date(d.getTime() + TimeSpanUtils.fromDays(days));
    }
}
