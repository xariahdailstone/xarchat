const DateTimeFormats = {
    ChatTimestampToday: new Intl.DateTimeFormat(undefined, { timeStyle: "short" }),
    ChatTimestampNotToday: new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" })
};

export class DateUtils {
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
}
