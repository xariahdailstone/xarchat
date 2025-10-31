// import { LogSearchDate } from "../../viewmodel/LogSearchViewModel";
// import { LogSearchDateSelectionPopupViewModel } from "../../viewmodel/popups/LogSearchDateSelectionPopupViewModel";
// import { ContextPopupBase } from "./ContextPopupBase";
// import { PopupBase } from "./PopupFrame";

// export class LogSearchDateSelectionPopup extends ContextPopupBase<LogSearchDateSelectionPopupViewModel> {
//     constructor() {
//         super();

//         this.elMain.innerHTML = `
//             <div class="date-section">
//                 <div class="monthyear-bar">
//                     <button class="theme-button" id="btnMonthYear">July 2024</button>

//                     <button class="theme-button" id="btnPrevMonth">Prev</button>
//                     <button class="theme-button" id="btnNextMonth">Next</button>
//                 </div>
//                 <div class="monthyear-section">
//                 </div>
//                 <table class="day-section" id="elCalendarTable">
//                     <tr>
//                         <th>Su</th>
//                         <th>Mo</th>
//                         <th>Tu</th>
//                         <th>We</th>
//                         <th>Th</th>
//                         <th>Fr</th>
//                         <th>Sa</th>
//                     </tr>
//                     <tr>
//                         <td>30</td>
//                         <td>1</td>
//                         <td>2</td>
//                         <td>3</td>
//                         <td>4</td>
//                         <td>5</td>
//                         <td>6</td>
//                     </tr>
//                 </table>
//             </div>
//             <div class="time-section">
//                 <div class="hour-select" id="elHourSelect">
//                     <div>01</div>
//                     <div>02</div>
//                     <div>03</div>
//                 </div>
//                 <div class="minute-select" id="elMinuteSelect">
//                     <div>00</div>
//                     <div>01</div>
//                     <div>02</div>
//                 </div>
//                 <div class="second-select" id="elSecondSelect">
//                     <div>00</div>
//                     <div>01</div>
//                     <div>02</div>
//                 </div>
//                 <div class="dayperiod-select" id="elDayPeriodSelect">
//                     <div>AM</div>
//                     <div>PM</div>
//                 </div>
//             </div>
//             <div class="buttons-section">
//                 <button class="theme-button">Now</button>
//             </div>
//         `;

//         this.watchExpr(vm => vm, vm => {
//             if (vm) {
//                 this.initialize(vm);
//                 this.updateValueFromViewModel(vm.value);
//             }
//         });
//         this.watchExpr(vm => vm.value, v => {
//             if (v) {
//                 this.rebuildCalendarTable(v instanceof Date ? v : v.getDate());
//                 this.updateValueFromViewModel(v);
//             }
//         });
//     }

//     private initialize(vm: LogSearchDateSelectionPopupViewModel) {
//         const hourValues = vm.hourValues;
//         const minuteValues = vm.minuteValues;
//         const secondValues = vm.secondValues;
//         const dayPeriodValues = vm.dayPeriodValues;

//         this.elMain.classList.toggle("has-dayperiods", dayPeriodValues != null);

//         const getDayPeriodForRawHour = (hour: number) => {
//             if (dayPeriodValues == null) {
//                 return null;
//             }
//             for (let dp of dayPeriodValues) {
//                 if (hour >= dp.value) {
//                     return dp;
//                 }
//             }
//             return dayPeriodValues[0];
//         };
//         const populateValueSelects = (
//             elId: string, 
//             selectValueClass: string, 
//             values: { value: number, display: string }[],
//             onValueChanged: (element: HTMLDivElement, elementValue: number, v: Date) => any,
//             onClick: (elementValue: number) => any) => {

//             const elContainer = this.$(elId) as HTMLDivElement;
//             elContainer.innerHTML = "";
//             for (let vd of values) {
//                 const valueSelectEl = document.createElement("div");
//                 const myVd = vd;                
//                 valueSelectEl.classList.add(selectValueClass);
//                 valueSelectEl.innerText = vd.display;
//                 (valueSelectEl as any)["_onvaluechanged"] = (v: Date) => {
//                     onValueChanged(valueSelectEl, myVd.value, v);
//                 };
//                 valueSelectEl.addEventListener("click", () => {
//                     onClick(myVd.value);
//                 });
//                 elContainer.appendChild(valueSelectEl);
//             }
//         };

//         populateValueSelects("elHourSelect", "hourselect-value", hourValues,
//             (element, elementValue, v) => { 
//                 if (dayPeriodValues != null) {
//                     const vHours = v.getHours();
//                     let gotIt = false;
//                     for (let x of dayPeriodValues) {
//                         if (vHours == elementValue + x.value) { gotIt = true; }
//                     }
//                     element.classList.toggle("selected", gotIt);
//                 }
//                 else {
//                     element.classList.toggle("selected", v.getHours() == elementValue);
//                 }
//             },
//             (elementValue) => { 
//                 const d = this.getValueDateForUpdate();
//                 const curDayPeriod = getDayPeriodForRawHour(d.getHours());
//                 if (curDayPeriod == null) {
//                     d.setHours(elementValue);
//                 }
//                 else {
//                     d.setHours(elementValue + curDayPeriod.value);
//                 }
//             }
//         );
//         populateValueSelects("elMinuteSelect", "minuteselect-value", minuteValues,
//             (element, elementValue, v) => { element.classList.toggle("selected", v.getMinutes() == elementValue); },
//             (elementValue) => { 
//                 const d = this.getValueDateForUpdate();
//                 d.setMinutes(elementValue);
//             }
//         );
//         populateValueSelects("elSecondSelect", "secondselect-value", secondValues,
//             (element, elementValue, v) => { element.classList.toggle("selected", v.getSeconds() == elementValue); },
//             (elementValue) => { 
//                 const d = this.getValueDateForUpdate();
//                 d.setSeconds(elementValue);
//             }
//         );
//         populateValueSelects("elDayPeriodSelect", "dayperiodselect-value", dayPeriodValues ?? [],
//             (element, elementValue, v) => { 
//                 element.classList.toggle("selected", getDayPeriodForRawHour(v.getHours())?.value == elementValue);
//             },
//             (elementValue) => {
//                 const d = this.getValueDateForUpdate();
//                 const oldDayPart = (getDayPeriodForRawHour(d.getHours())?.value ?? 0);
//                 const oldOfsHours = d.getHours() - oldDayPart;
//                 d.setHours(oldOfsHours + elementValue);
//             }
//         );

//         this.rebuildCalendarTable(new Date());
//     }

//     private rebuildCalendarTable(target: Date) {
//         const elCalendarTable = this.$("elCalendarTable") as HTMLTableElement;
//         elCalendarTable.innerHTML = `<tr>
//             <th>Su</th>
//             <th>Mo</th>
//             <th>Tu</th>
//             <th>We</th>
//             <th>Th</th>
//             <th>Fr</th>
//             <th>Sa</th>
//         </tr>`;

//         // Set to first of month
//         target.setDate(1);
//         // Set back to start of week
//         target.setDate(1 - target.getDay());

//         for (let row = 0; row < 6; row++) {
//             const rowEl = document.createElement("tr");
//             for (let col = 0; col < 7; col++) {
//                 const myTarget = new Date(target.getTime());
//                 const cellEl = document.createElement("td");
//                 cellEl.innerText = target.getDate().toString();
//                 (cellEl as any)["_onvaluechanged"] = (v: Date) => {
//                     cellEl.classList.toggle("selected", v.getFullYear() == myTarget.getFullYear() && v.getMonth() == myTarget.getMonth() && v.getDate() == myTarget.getDate());
//                 };
//                 cellEl.addEventListener("click", () => {
//                     const d = this.getValueDateForUpdate();
//                     d.setFullYear(myTarget.getFullYear());
//                     d.setMonth(myTarget.getMonth());
//                     d.setDate(myTarget.getDate());
//                 });
//                 rowEl.appendChild(cellEl);
//                 target.setDate(target.getDate() + 1);
//             }
//             elCalendarTable.appendChild(rowEl);
//         }
//     }

//     private updateValueFromViewModel(v: LogSearchDate) {
//         if (!(v instanceof Date)) {
//             v = v.getDate();
//         }
        
//         const processEl = (el: Element) => {
//             const ovc = (el as any)["_onvaluechanged"];
//             if (typeof ovc == "function") {
//                 ovc(v);
//             }
//             for (let i = 0; i < el.children.length; i++) {
//                 const childEl = el.children.item(i);
//                 if (childEl) {
//                     processEl(childEl);
//                 }
//             }
//         };
//         processEl(this.elMain);
//     }

//     private getValueDateForUpdate(): Date { 
//         let v = this.viewModel?.value ?? new Date();
//         if (!(v instanceof Date)) {
//             v = v.getDate();
//             if (this.viewModel) {
//                 this.viewModel.value = v;
//             }
//         }
//         return v;
//     }
// }