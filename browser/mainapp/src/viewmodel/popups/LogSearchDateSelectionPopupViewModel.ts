// import { observableProperty } from "../../util/ObservableBase";
// import { AppViewModel } from "../AppViewModel";
// import { LogSearchDate, SearchDate } from "../LogSearchViewModel";
// import { ContextPopupViewModel, PopupViewModel } from "./PopupViewModel";

// const dtf = new Intl.DateTimeFormat(undefined, { timeStyle: "full", dayPeriod: "narrow" });

// export class LogSearchDateSelectionPopupViewModel extends ContextPopupViewModel {
//     constructor(parent: AppViewModel, contextElement: HTMLElement, startingValue: LogSearchDate) {
//         super(parent, contextElement);
//         this.value = startingValue;
//     }

//     @observableProperty
//     value: LogSearchDate = SearchDate.Now;

//     get hourCycles(): ("h12" | "h23" | "h11" | "h24") {
//         const locale = new Intl.Locale(dtf.resolvedOptions().locale);
//         return locale.hourCycle ?? "h23";
//     }

//     get monthValuesFull(): { value: number, display: string }[] {
//         const dtf = new Intl.DateTimeFormat(undefined, { dateStyle: "full" });
//         const d = new Date();
        
//         const results = [];
//         for (let x = 0; x < 12; x++) {
//             d.setMonth(x);
//             const parts = dtf.formatToParts(d);
//             const minPart = parts.filter(p => p.type == "month")[0];
//             results.push({ value: x, display: minPart.value });
//         }
//         return results;
//     }

//     get monthValuesShort(): { value: number, display: string }[] {
//         const dtf = new Intl.DateTimeFormat(undefined, { dateStyle: "short" });
//         const d = new Date();
        
//         const results = [];
//         for (let x = 0; x < 12; x++) {
//             d.setMonth(x);
//             const parts = dtf.formatToParts(d);
//             const minPart = parts.filter(p => p.type == "month")[0];
//             results.push({ value: x, display: minPart.value });
//         }
//         return results;
//     }

//     get hourValues(): { value: number, display: string }[] {
//         const hourCycles = this.hourCycles;

//         const results = [];

//         switch (hourCycles) {
//             case "h12":
//                 results.push({ value: 0, display: "12" });
//                 for (let x = 1; x < 12; x++) {
//                     results.push({ value: x, display: x.toString() });
//                 }
//                 break;
//             case "h23":
//                 for (let x = 0; x < 24; x++) {
//                     results.push({ value: x, display: x.toString() });
//                 }
//                 break;
//             case "h11":
//                 for (let x = 0; x < 12; x++) {
//                     results.push({ value: x, display: x.toString() });
//                 }
//                 break;
//             case "h24":
//                 results.push({ value: 0, display: "24" });
//                 for (let x = 1; x < 24; x++) {
//                     results.push({ value: x, display: x.toString() });
//                 }
//                 break;
//         }

//         return results;
//     }

//     get minuteValues(): { value: number, display: string }[] {
//         const results = [];
//         const d = new Date();
//         for (let x = 0; x < 60; x++) {
//             d.setMinutes(x);
//             const parts = dtf.formatToParts(d);
//             const minPart = parts.filter(p => p.type == "minute")[0];
//             results.push({ value: x, display: minPart.value });
//         }
//         return results;
//     }

//     get secondValues(): { value: number, display: string }[] {
//         const results = [];
//         const d = new Date();
//         for (let x = 0; x < 60; x++) {
//             d.setSeconds(x);
//             const parts = dtf.formatToParts(d);
//             const minPart = parts.filter(p => p.type == "second")[0];
//             results.push({ value: x, display: minPart.value });
//         }
//         return results;
//     }

//     get dayPeriodValues(): ({ value: number, display: string }[] | null) {
//         const hv = this.hourValues;
//         if (hv.length == 24) {
//             return null;
//         }

//         let d = new Date();
//         let am = "AM";
//         let pm = "PM";

//         {
//             d.setHours(5);
//             const parts = dtf.formatToParts(d);
//             const dpPart = parts.filter(p => p.type == "dayPeriod");
//             am = dpPart[0].value;
//         }
//         {
//             d.setHours(17);
//             const laterParts = dtf.formatToParts(d);
//             const laterDpPart = laterParts.filter(p => p.type == "dayPeriod");
//             pm = laterDpPart[0].value;
//         }
        
//         return [
//             { value: 0, display: am },
//             { value: 12, display: pm },
//         ];
//     }
// }