
const dtf = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });
const dtfDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'numeric', year: 'numeric' });
const dtfWithDate = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" });
const dtfLongWithLongDate = new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "long" });

export interface LocaleViewModelOptions {
    convertTime: (d: Date, format: TimeFormatSpecifier) => string;
    convertDate: (d: Date, format: DateFormatSpecifier) => string;
}

// short = 5:52 PM
// medium = 5:52:29 PM
// long = 5:52:29 PM EDT
// full = 5:52:29 PM Eastern Daylight Time
export type TimeFormatSpecifier = "short" | "medium" | "long" | "full";

// short = 8/4/25
// nshort = 8/4/2025
// medium = Aug 4, 2025
// long = August 4, 2025
// full = Monday, August 4, 2025
export type DateFormatSpecifier = "short" | "nshort" | "medium" | "long" | "full";

export class LocaleViewModel {
    public static readonly defaultConvertTime = (d: Date, format: TimeFormatSpecifier) => {
        return new Intl.DateTimeFormat(undefined, { timeStyle: format }).format(d);
    };

    public static readonly defaultConvertDate = (d: Date, format: DateFormatSpecifier) => {
        switch (format) {
            default:
            case "nshort":
                {
                    const sb: string[] = [];
                    for (let p of new Intl.DateTimeFormat(undefined, { day: "numeric", month: "numeric", year: "numeric" }).formatToParts(d)) {
                        if (p.type == "year") {
                            sb.push(d.getFullYear().toString());
                        }
                        else {
                            sb.push(p.value);
                        }
                    }
                    return sb.join("");
                }
            case "short":
            case "medium":
            case "long":
            case "full":
                return new Intl.DateTimeFormat(undefined, { dateStyle: format }).format(d);
        }
    };

    static readonly default: LocaleViewModel = new LocaleViewModel();

    constructor(options?: LocaleViewModelOptions) {
        this._options = {
            convertDate: options?.convertDate ?? LocaleViewModel.defaultConvertDate,
            convertTime: options?.convertTime ?? LocaleViewModel.defaultConvertTime
        };
    }

    private readonly _options: LocaleViewModelOptions;

    getTimeString(d: Date, format: TimeFormatSpecifier) {
        try {
            const result = this._options.convertTime(d, format);
            return result;
        }
        catch (e) {
            console.error(e);
            throw e;
        }
    }

    getDateString(d: Date, format: DateFormatSpecifier) {
        try {
            const result = this._options.convertDate(d, format);
            return result;
        }
        catch (e) {
            console.error(e);
            throw e;
        }
    }

    getShortTimeString(d: Date) {
        return this.getTimeString(d, "short");
    }

    getNumericDateString(d: Date) {
        return this.getDateString(d, "nshort");
    }

    getNumericDateWithShortTimeString(d: Date) {
        return this.getNumericDateString(d) + " " + this.getShortTimeString(d);
    }
}