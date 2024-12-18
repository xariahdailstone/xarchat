using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Common
{
    internal static class ColorConverting
    {
        public static RgbColor ColorToRgb(
            Color color)
        {
            return new(color.R, color.G, color.B, color.A);
        }

        public static Color RgbToColor(
            RgbColor rgb)
        {
            return Color.FromArgb(rgb.Alpha, rgb.Red, rgb.Green, rgb.Blue);
        }

        public static HsbColor RgbToHsb(
            RgbColor rgb)
        {
            // _NOTE #1: Even though we're dealing with a very small range of
            // numbers, the accuracy of all calculations is fairly important.
            // For this reason, I've opted to use double data types instead
            // of float, which gives us a little bit extra precision (recall
            // that precision is the number of significant digits with which
            // the result is expressed).

            var r = rgb.Red / 255d;
            var g = rgb.Green / 255d;
            var b = rgb.Blue / 255d;

            var minValue = getMinimumValue(r, g, b);
            var maxValue = getMaximumValue(r, g, b);
            var delta = maxValue - minValue;

            double hue = 0;
            double saturation;
            var brightness = maxValue * 100;

            if (Math.Abs(maxValue - 0) < 0.00001 || Math.Abs(delta - 0) < 0.00001)
            {
                hue = 0;
                saturation = 0;
            }
            else
            {
                // _NOTE #2: FXCop insists that we avoid testing for floating 
                // point equality (CA1902). Instead, we'll perform a series of
                // tests with the help of 0.00001 that will provide 
                // a more accurate equality evaluation.

                if (Math.Abs(minValue - 0) < 0.00001)
                {
                    saturation = 100;
                }
                else
                {
                    saturation = delta / maxValue * 100;
                }

                if (Math.Abs(r - maxValue) < 0.00001)
                {
                    hue = (g - b) / delta;
                }
                else if (Math.Abs(g - maxValue) < 0.00001)
                {
                    hue = 2 + (b - r) / delta;
                }
                else if (Math.Abs(b - maxValue) < 0.00001)
                {
                    hue = 4 + (r - g) / delta;
                }
            }

            hue *= 60;
            if (hue < 0)
            {
                hue += 360;
            }

            return new(
                hue,
                saturation,
                brightness,
                rgb.Alpha);
        }

        public static HslColor RgbToHsl(
            RgbColor rgb)
        {
            var varR = rgb.Red / 255.0; //Where RGB values = 0 ÷ 255
            var varG = rgb.Green / 255.0;
            var varB = rgb.Blue / 255.0;

            var varMin = getMinimumValue(varR, varG, varB); //Min. value of RGB
            var varMax = getMaximumValue(varR, varG, varB); //Max. value of RGB
            var delMax = varMax - varMin; //Delta RGB value

            double h;
            double s;
            var l = (varMax + varMin) / 2;

            if (Math.Abs(delMax - 0) < 0.00001) //This is a gray, no chroma...
            {
                h = 0; //HSL results = 0 ÷ 1
                s = 0;
                // UK:
                //				s = 1.0;
            }
            else //Chromatic data...
            {
                if (l < 0.5)
                {
                    s = delMax / (varMax + varMin);
                }
                else
                {
                    s = delMax / (2.0 - varMax - varMin);
                }

                var delR = ((varMax - varR) / 6.0 + delMax / 2.0) / delMax;
                var delG = ((varMax - varG) / 6.0 + delMax / 2.0) / delMax;
                var delB = ((varMax - varB) / 6.0 + delMax / 2.0) / delMax;

                if (Math.Abs(varR - varMax) < 0.00001)
                {
                    h = delB - delG;
                }
                else if (Math.Abs(varG - varMax) < 0.00001)
                {
                    h = 1.0 / 3.0 + delR - delB;
                }
                else if (Math.Abs(varB - varMax) < 0.00001)
                {
                    h = 2.0 / 3.0 + delG - delR;
                }
                else
                {
                    // Uwe Keim.
                    h = 0.0;
                }

                if (h < 0.0)
                {
                    h += 1.0;
                }
                if (h > 1.0)
                {
                    h -= 1.0;
                }
            }

            // --

            return new(
                h * 360.0,
                s * 100.0,
                l * 100.0,
                rgb.Alpha);
        }

        public static RgbColor HsbToRgb(
            HsbColor hsb)
        {
            double red = 0, green = 0, blue = 0;

            double h = hsb.Hue;
            var s = (double)hsb.Saturation / 100;
            var b = (double)hsb.Brightness / 100;

            if (Math.Abs(s - 0) < 0.00001)
            {
                red = b;
                green = b;
                blue = b;
            }
            else
            {
                // the color wheel has six sectors.

                var sectorPosition = h / 60;
                var sectorNumber = (int)Math.Floor(sectorPosition);
                var fractionalSector = sectorPosition - sectorNumber;

                var p = b * (1 - s);
                var q = b * (1 - s * fractionalSector);
                var t = b * (1 - s * (1 - fractionalSector));

                // Assign the fractional colors to r, g, and b
                // based on the sector the angle is in.
                switch (sectorNumber)
                {
                    case 0:
                        red = b;
                        green = t;
                        blue = p;
                        break;

                    case 1:
                        red = q;
                        green = b;
                        blue = p;
                        break;

                    case 2:
                        red = p;
                        green = b;
                        blue = t;
                        break;

                    case 3:
                        red = p;
                        green = q;
                        blue = b;
                        break;

                    case 4:
                        red = t;
                        green = p;
                        blue = b;
                        break;

                    case 5:
                        red = b;
                        green = p;
                        blue = q;
                        break;
                }
            }

            var nRed = Convert.ToInt32(red * 255);
            var nGreen = Convert.ToInt32(green * 255);
            var nBlue = Convert.ToInt32(blue * 255);

            return new(nRed, nGreen, nBlue, hsb.Alpha);
        }

        public static RgbColor HslToRgb(
            HslColor hsl)
        {
            double red, green, blue;

            var h = hsl.PreciseHue / 360.0;
            var s = hsl.PreciseSaturation / 100.0;
            var l = hsl.PreciseLight / 100.0;

            if (Math.Abs(s - 0.0) < 0.00001)
            {
                red = l;
                green = l;
                blue = l;
            }
            else
            {
                double var2;

                if (l < 0.5)
                {
                    var2 = l * (1.0 + s);
                }
                else
                {
                    var2 = l + s - s * l;
                }

                var var1 = 2.0 * l - var2;

                red = hue2Rgb(var1, var2, h + 1.0 / 3.0);
                green = hue2Rgb(var1, var2, h);
                blue = hue2Rgb(var1, var2, h - 1.0 / 3.0);
            }

            // --

            var nRed = Convert.ToInt32(red * 255.0);
            var nGreen = Convert.ToInt32(green * 255.0);
            var nBlue = Convert.ToInt32(blue * 255.0);

            return new(nRed, nGreen, nBlue, hsl.Alpha);
        }

        private static double hue2Rgb(
            double v1,
            double v2,
            double vH)
        {
            if (vH < 0.0)
            {
                vH += 1.0;
            }
            if (vH > 1.0)
            {
                vH -= 1.0;
            }
            if (6.0 * vH < 1.0)
            {
                return v1 + (v2 - v1) * 6.0 * vH;
            }
            if (2.0 * vH < 1.0)
            {
                return v2;
            }
            if (3.0 * vH < 2.0)
            {
                return v1 + (v2 - v1) * (2.0 / 3.0 - vH) * 6.0;
            }

            return v1;
        }

        /// <summary>
        /// Determines the maximum value of all of the numbers provided in the
        /// variable argument list.
        /// </summary>
        private static double getMaximumValue(
            params double[] values)
        {
            var maxValue = values[0];

            if (values.Length >= 2)
            {
                for (var i = 1; i < values.Length; i++)
                {
                    var num = values[i];
                    maxValue = Math.Max(maxValue, num);
                }
            }

            return maxValue;
        }

        /// <summary>
        /// Determines the minimum value of all of the numbers provided in the
        /// variable argument list.
        /// </summary>
        private static double getMinimumValue(
            params double[] values)
        {
            var minValue = values[0];

            if (values.Length >= 2)
            {
                for (var i = 1; i < values.Length; i++)
                {
                    var num = values[i];
                    minValue = Math.Min(minValue, num);
                }
            }

            return minValue;
        }
    }

    public sealed class HsbColor(double hue,
    double saturation,
    double brightness,
    int alpha)
    {
        /// <summary>
        /// Gets or sets the hue. Values from 0 to 360.
        /// </summary>
        public double PreciseHue { get; } = hue;

        /// <summary>
        /// Gets or sets the saturation. Values from 0 to 100.
        /// </summary>
        public double PreciseSaturation { get; } = saturation;

        /// <summary>
        /// Gets or sets the brightness. Values from 0 to 100.
        /// </summary>
        public double PreciseBrightness { get; } = brightness;

        public int Hue => Convert.ToInt32(PreciseHue);

        public int Saturation => Convert.ToInt32(PreciseSaturation);

        public int Brightness => Convert.ToInt32(PreciseBrightness);

        /// <summary>
        /// Gets or sets the alpha. Values from 0 to 255.
        /// </summary>
        public int Alpha { get; } = alpha;

        public static HsbColor FromColor(
            Color color)
        {
            return ColorConverting.ColorToRgb(color).ToHsbColor();
        }

        public static HsbColor FromRgbColor(
            RgbColor color)
        {
            return color.ToHsbColor();
        }

        public static HsbColor FromHsbColor(
            HsbColor color)
        {
            return new(color.PreciseHue, color.PreciseSaturation, color.PreciseBrightness, color.Alpha);
        }

        public static HsbColor FromHslColor(
            HslColor color)
        {
            return FromRgbColor(color.ToRgbColor());
        }

        public override string? ToString()
        {
            return $@"Hue: {Hue}; saturation: {Saturation}; brightness: {Brightness}.";
        }

        public Color ToColor()
        {
            return ColorConverting.HsbToRgb(this).ToColor();
        }

        public RgbColor ToRgbColor()
        {
            return ColorConverting.HsbToRgb(this);
        }

        public HsbColor ToHsbColor()
        {
            return new(PreciseHue, PreciseSaturation, PreciseBrightness, Alpha);
        }

        public HslColor ToHslColor()
        {
            return ColorConverting.RgbToHsl(ToRgbColor());
        }

        public override bool Equals(object? obj)
        {
            var equal = false;

            if (obj is HsbColor color)
            {
                if (Math.Abs(PreciseHue - color.PreciseHue) < 0.00001 &&
                    Math.Abs(PreciseSaturation - color.PreciseSaturation) < 0.00001 &&
                    Math.Abs(PreciseBrightness - color.PreciseBrightness) < 0.00001 &&
                    Alpha == color.Alpha)
                {
                    equal = true;
                }
            }

            return equal;
        }

        public override int GetHashCode()
        {
            return $@"H:{Hue}-S:{Saturation}-B:{Brightness}-A:{Alpha}".GetHashCode();
        }
    }

    public sealed class HslColor(
    double hue,
    double saturation,
    double light,
    int alpha)
    {
        /// <summary>
        /// Gets the hue. Values from 0 to 360.
        /// </summary>
        public int Hue => Convert.ToInt32(PreciseHue);

        /// <summary>
        /// Gets the precise hue. Values from 0 to 360.
        /// </summary>
        public double PreciseHue { get; } = hue;

        /// <summary>
        /// Gets the saturation. Values from 0 to 100.
        /// </summary>
        public int Saturation => Convert.ToInt32(PreciseSaturation);

        /// <summary>
        /// Gets the precise saturation. Values from 0 to 100.
        /// </summary>
        public double PreciseSaturation { get; } = saturation;

        /// <summary>
        /// Gets the light. Values from 0 to 100.
        /// </summary>
        public int Light => Convert.ToInt32(PreciseLight);

        /// <summary>
        /// Gets the precise light. Values from 0 to 100.
        /// </summary>
        public double PreciseLight { get; } = light;

        /// <summary>
        /// Gets the alpha. Values from 0 to 255
        /// </summary>
        public int Alpha { get; } = alpha;

        public static HslColor FromColor(Color color)
        {
            return ColorConverting.RgbToHsl(ColorConverting.ColorToRgb(color));
        }

        public static HslColor FromRgbColor(RgbColor color)
        {
            return color.ToHslColor();
        }

        public static HslColor FromHslColor(HslColor color)
        {
            return new(
                color.PreciseHue,
                color.PreciseSaturation,
                color.PreciseLight,
                color.Alpha);
        }

        public static HslColor FromHsbColor(HsbColor color)
        {
            return FromRgbColor(color.ToRgbColor());
        }

        public override string? ToString()
        {
            return Alpha < 255
                ? $@"hsla({Hue}, {Saturation}%, {Light}%, {Alpha / 255f})"
                : $@"hsl({Hue}, {Saturation}%, {Light}%)";
        }

        public Color ToColor()
        {
            return ColorConverting.HslToRgb(this).ToColor();
        }

        public RgbColor ToRgbColor()
        {
            return ColorConverting.HslToRgb(this);
        }

        public HslColor ToHslColor()
        {
            return this;
        }

        public HsbColor ToHsbColor()
        {
            return ColorConverting.RgbToHsb(ToRgbColor());
        }

        public override bool Equals(object? obj)
        {
            var equal = false;

            if (obj is HslColor color)
            {
                if (Math.Abs(Hue - color.PreciseHue) < 0.00001 &&
                    Math.Abs(Saturation - color.PreciseSaturation) < 0.00001 &&
                    Math.Abs(Light - color.PreciseLight) < 0.00001 &&
                    Alpha == color.Alpha)
                {
                    equal = true;
                }
            }

            return equal;
        }

        public override int GetHashCode()
        {
            return $@"H:{PreciseHue}-S:{PreciseSaturation}-L:{PreciseLight}-A:{Alpha}".GetHashCode();
        }
    }

    public sealed class RgbColor(
    int red,
    int green,
    int blue,
    int alpha)
    {
        /// <summary>
        /// Gets or sets the red component. Values from 0 to 255.
        /// </summary>
        public int Red { get; } = red;

        /// <summary>
        /// Gets or sets the green component. Values from 0 to 255.
        /// </summary>
        public int Green { get; } = green;

        /// <summary>
        /// Gets or sets the blue component. Values from 0 to 255.
        /// </summary>
        public int Blue { get; } = blue;

        /// <summary>
        /// Gets or sets the alpha component. Values from 0 to 255.
        /// </summary>
        public int Alpha { get; } = alpha;

        public static RgbColor FromColor(
            Color color)
        {
            return ColorConverting.ColorToRgb(color);
        }

        public static RgbColor FromRgbColor(
            RgbColor color)
        {
            return new(color.Red, color.Green, color.Blue, color.Alpha);
        }

        public static RgbColor FromHsbColor(
            HsbColor color)
        {
            return color.ToRgbColor();
        }

        public static RgbColor FromHslColor(
            HslColor color)
        {
            return color.ToRgbColor();
        }

        public override string? ToString()
        {
            return Alpha < 255 ? $@"rgba({Red}, {Green}, {Blue}, {Alpha / 255d})" : $@"rgb({Red}, {Green}, {Blue})";
        }

        public Color ToColor()
        {
            return ColorConverting.RgbToColor(this);
        }

        public RgbColor ToRgbColor()
        {
            return this;
        }

        public HsbColor ToHsbColor()
        {
            return ColorConverting.RgbToHsb(this);
        }

        public HslColor ToHslColor()
        {
            return ColorConverting.RgbToHsl(this);
        }

        public override bool Equals(object? obj)
        {
            var equal = false;

            if (obj is RgbColor color)
            {
                if (Red == color.Red && Blue == color.Blue && Green == color.Green && Alpha == color.Alpha)
                {
                    equal = true;
                }
            }

            return equal;
        }

        public override int GetHashCode()
        {
            return $@"R:{Red}-G:{Green}-B:{Blue}-A:{Alpha}".GetHashCode();
        }
    }
}