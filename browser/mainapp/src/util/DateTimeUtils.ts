
export class DateUtils {
    static addMilliseconds(d: Date, ms: number) {
        return new Date(d.getTime() + ms);
    }
}

export class TimeSpanUtils {
    static fromMilliseconds(ms: number) { return ms; }

    static fromSeconds(sec: number) { return sec * 1000; }

    static fromMinutes(min: number) { return min * 60 * 1000; }

    static fromHours(hr: number) { return hr * 60 * 60 * 1000; }

    static fromDays(d: number) { return d * 24 * 60 * 60 * 1000; }
}