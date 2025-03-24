import { ObservableValue } from "../../util/Observable";
import { ObservableExpression } from "../../util/ObservableExpression";
import { AppViewModel } from "../AppViewModel";
import { ContextPopupViewModel } from "./PopupViewModel";

export class ColorRGBSelectPopupViewModel extends ContextPopupViewModel {
    constructor(parent: AppViewModel, contextElement: HTMLElement) {
        super(parent, contextElement);
        this._rgbStringOE = new ObservableExpression(
            () => this.rgbString,
            (v) => { if (v) { this.onChange(v); } },
            (err) => {});
    }

    override dismissed(): void {
        super.dismissed();
        this.onChange = () => {};
        this._rgbStringOE.dispose();
    }

    private _rgbStringOE: ObservableExpression<string>;
    private _rgbColor: ObservableValue<[number, number, number]> = new ObservableValue<[number, number, number]>([0, 0, 0])
        .withName("ColorRGBSelectPopupViewModel._rgbColor");

    get red(): number { return this._rgbColor.value[0]; }
    set red(value: number) {
        const rgb = this._rgbColor.value;
        rgb[0] = value;
        this.setRGB(rgb[0], rgb[1], rgb[2]);
    }

    get green(): number { return this._rgbColor.value[1]; }
    set green(value: number) {
        const rgb = this._rgbColor.value;
        rgb[1] = value;
        this.setRGB(rgb[0], rgb[1], rgb[2]);
    }

    get blue(): number { return this._rgbColor.value[2]; }
    set blue(value: number) {
        const rgb = this._rgbColor.value;
        rgb[2] = value;
        this.setRGB(rgb[0], rgb[1], rgb[2]);
    }

    get hue(): number {
        const rgb = this._rgbColor.value;
        const hsb = this.rgbToHwb(rgb[0], rgb[1], rgb[2]);
        return hsb.h;
    }
    set hue(value: number) {
        const rgb = this._rgbColor.value;
        const hsb = this.rgbToHwb(rgb[0], rgb[1], rgb[2]);
        hsb.h = value;
        const newRGB = this.hwbToRgb(hsb.h, hsb.w, hsb.b);
        this.setRGB(newRGB.r, newRGB.g, newRGB.b);
    }

    get white(): number {
        const rgb = this._rgbColor.value;
        const hsb = this.rgbToHwb(rgb[0], rgb[1], rgb[2]);
        return hsb.w;
    }
    set white(value: number) {
        const rgb = this._rgbColor.value;
        const hsb = this.rgbToHwb(rgb[0], rgb[1], rgb[2]);
        hsb.w = value;
        const newRGB = this.hwbToRgb(hsb.h, hsb.w, hsb.b);
        this.setRGB(newRGB.r, newRGB.g, newRGB.b);
    }

    get saturation(): number {
        const rgb = this._rgbColor.value;
        const hsb = this.rgbToHsb(rgb[0], rgb[1], rgb[2]);
        return hsb.s;
    }
    set saturation(value: number) {
        const rgb = this._rgbColor.value;
        const hsb = this.rgbToHsl(rgb[0], rgb[1], rgb[2]);
        hsb.s = value;
        const newRGB = this.hslToRgb(hsb.h, hsb.s, hsb.l);
        this.setRGB(newRGB.r, newRGB.g, newRGB.b);
    }

    get brightness(): number {
        const rgb = this._rgbColor.value;
        const hsb = this.rgbToHsb(rgb[0], rgb[1], rgb[2]);
        return hsb.b;
    }
    set brightness(value: number) {
        const rgb = this._rgbColor.value;
        const hsb = this.rgbToHsb(rgb[0], rgb[1], rgb[2]);
        hsb.b = value;
        const newRGB = this.hsbToRgb(hsb.h, hsb.s, hsb.b);
        this.setRGB(newRGB.r, newRGB.g, newRGB.b);
    }

    get black(): number {
        const rgb = this._rgbColor.value;
        const hsb = this.rgbToHwb(rgb[0], rgb[1], rgb[2]);
        return hsb.b;
    }
    set black(value: number) {
        const rgb = this._rgbColor.value;
        const hsb = this.rgbToHwb(rgb[0], rgb[1], rgb[2]);
        hsb.b = value;
        const newRGB = this.hwbToRgb(hsb.h, hsb.w, hsb.b);
        this.setRGB(newRGB.r, newRGB.g, newRGB.b);
    }

    private hueToRgb(t1: number, t2: number, hue: number) {
        if (hue < 0) hue += 6;
        if (hue >= 6) hue -= 6;
        if (hue < 1) return (t2 - t1) * hue + t1;
        else if(hue < 3) return t2;
        else if(hue < 4) return (t2 - t1) * (4 - hue) + t1;
        else return t1;
    }

    private hslToRgb(hue: number, sat: number, light: number) {
        let t1, t2, r, g, b;
        hue = hue / 60;
        if ( light <= 0.5 ) {
          t2 = light * (sat + 1);
        } else {
          t2 = light + sat - (light * sat);
        }
        t1 = light * 2 - t2;
        r = this.hueToRgb(t1, t2, hue + 2) * 255;
        g = this.hueToRgb(t1, t2, hue) * 255;
        b = this.hueToRgb(t1, t2, hue - 2) * 255;
        return {r : r, g : g, b : b};
    }

    private hwbToRgb(hue: number, white: number, black: number) {
        var i, rgb, rgbArr = [], tot;
        rgb = this.hslToRgb(hue, 1, 0.50);
        rgbArr[0] = rgb.r / 255;
        rgbArr[1] = rgb.g / 255;
        rgbArr[2] = rgb.b / 255;
        tot = white + black;
        if (tot > 1) {
          white = Number((white / tot).toFixed(2));
          black = Number((black / tot).toFixed(2));
        }
        for (i = 0; i < 3; i++) {
          rgbArr[i] *= (1 - (white) - (black));
          rgbArr[i] += (white);
          rgbArr[i] = Number(rgbArr[i] * 255);
        }
        return {r : Math.round(rgbArr[0]), g : Math.round(rgbArr[1]), b : Math.round(rgbArr[2]) };
    }

    private rgbToHwb(r: number, g: number, b: number) {
        let h, w, bl;
        r = r / 255;
        g = g / 255;
        b = b / 255;
        let max = Math.max(r, g, b);
        let min = Math.min(r, g, b);
        // let chroma = max - min;
        // if (chroma == 0) {
        //   h = 0;
        // } else if (r == max) {
        //   h = (((g - b) / chroma) % 6) * 360;
        // } else if (g == max) {
        //   h = ((((b - r) / chroma) + 2) % 6) * 360;
        // } else {
        //   h = ((((r - g) / chroma) + 4) % 6) * 360;
        // }
        w = min;
        bl = 1 - max;

        const hue = this.rgbToHsl(r, g, b).h;
        return {h : hue, w : w, b : bl};
    }

    private rgbToHsl(r: number, g: number, b: number) {
        let min, max, i, l, s, maxcolor, h, rgb = [];
        rgb[0] = r / 255;
        rgb[1] = g / 255;
        rgb[2] = b / 255;
        min = rgb[0];
        max = rgb[0];
        maxcolor = 0;
        for (i = 0; i < rgb.length - 1; i++) {
          if (rgb[i + 1] <= min) {min = rgb[i + 1];}
          if (rgb[i + 1] >= max) {max = rgb[i + 1];maxcolor = i + 1;}
        }
        if (maxcolor == 0) {
          h = (rgb[1] - rgb[2]) / (max - min);
        }
        if (maxcolor == 1) {
          h = 2 + (rgb[2] - rgb[0]) / (max - min);
        }
        if (maxcolor == 2) {
          h = 4 + (rgb[0] - rgb[1]) / (max - min);
        }
        if (h == null || isNaN(h)) {h = 0;}
        h = h * 60;
        if (h < 0) {h = h + 360; }
        l = (min + max) / 2;
        if (min == max) {
          s = 0;
        } else {
          if (l < 0.5) {
            s = (max - min) / (max + min);
          } else {
            s = (max - min) / (2 - max - min);
          }
        }
        s = s;
        return {h : h, s : s, l : l};
    }

    private rgbToHsb(r: number, g: number, b: number) {
        r /= 255;
        g /= 255;
        b /= 255;
        const v = Math.max(r, g, b);
        const n = v - Math.min(r, g, b);
        const h =
          n === 0
            ? 0
            : n && v === r
              ? (g - b) / n
              : v === g
                ? 2 + (b - r) / n
                : 4 + (r - g) / n;
        return { h: 60 * (h < 0 ? h + 6 : h), s: v && (n / v) /* * 100 */, b: v /* * 100 */ };
    }

    private hsbToRgb(h: number, s: number, b: number) {
        /* s /= 100;
        b /= 100; */
        const k = (n: number) => (n + h / 60) % 6;
        const f = (n: number) => b * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
        return { r: Math.round(255 * f(5)), g: Math.round(255 * f(3)), b: Math.round(255 * f(1)) };
      };

    setRGB(red: number, green: number, blue: number) {
        this._rgbColor.value = [red, green, blue];
    }
    setHSB(hue: number, saturation: number, brightness: number) {
        const rgb = this.hsbToRgb(hue, saturation, brightness);
        this._rgbColor.value = [rgb.r, rgb.g, rgb.b];
    }
    setHWB(hue: number, white: number, black: number) {
        const rgb = this.hwbToRgb(hue, white, black);
        this._rgbColor.value = [rgb.r, rgb.g, rgb.b];
    }

    get rgbString() {
        return `#${this.toHex2(this.red)}${this.toHex2(this.green)}${this.toHex2(this.blue)}`;
    }
    set rgbString(value: string) {
        if (value.startsWith("#")) {
            value = value.substring(1);
        }
        const red = parseInt(value.substring(0, 2), 16);
        const green = parseInt(value.substring(2, 4), 16);
        const blue = parseInt(value.substring(4, 6), 16);
        this.setRGB(red, green, blue);
    }

    toHex2(v: number) {
        let r = v.toString(16);
        while (r.length < 2) {
            r = "0" + r;
        }
        return r;
    }

    onChange: (value: string) => void = () => {};
}