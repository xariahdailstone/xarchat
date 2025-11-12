using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.NotificationBadge;
using System.Drawing;
using Microsoft.WindowsAPICodePack.Taskbar;
using System.Drawing.Imaging;
using XarChat.Backend.Features.WindowControl;

namespace XarChat.Backend.Win32.NotificationBadge
{
    public class Win32NotificationBadgeManager : INotificationBadgeManager, IDisposable
    {
        private readonly IWin32WindowControl _win32WindowControl;

        private Icon? _previousIcon = null;

        public Win32NotificationBadgeManager(
            IWin32WindowControl win32WindowControl)
        {
            _win32WindowControl = win32WindowControl;

            _taskbarButtonCreatedHandler = TaskbarManager.Instance.AddTaskbarButtonCreatedHandler(_win32WindowControl, () =>
            {
                _lastShown = LastShownKind.Unknown;
                SetNotificationBadge(_lastShownPingCount, _lastShownUnseenCount);
            });
        }

        private readonly IDisposable _taskbarButtonCreatedHandler;

        public void Dispose()
        {
            _taskbarButtonCreatedHandler.Dispose();
        }

        private enum LastShownKind
        {
            Unknown,
            None,
            Unseen,
            Ping
        }

        private int _lastShownPingCount = 0;
        private int _lastShownUnseenCount = 0;
        private LastShownKind _lastShown = LastShownKind.None;

        public void SetNotificationBadge(int pingCount, int unseenCount)
        {
            System.Diagnostics.Debug.WriteLine($"Win32NotificationBadgeManager.SetNotificationBadge [{pingCount}, {unseenCount}]");
            var tbm = TaskbarManager.Instance;
            tbm.OwnerHandle = _win32WindowControl.WindowHandle;

            _lastShownPingCount = pingCount;
            _lastShownUnseenCount = unseenCount;

            Icon? ico;
            if (pingCount > 0 || unseenCount > 0)
            {
                var tShownKind = (pingCount > 0) ? LastShownKind.Ping
                    : (unseenCount > 0) ? LastShownKind.Unseen
                    : LastShownKind.None;

                if (tShownKind == _lastShown)
                {
                    return;
                }

                _lastShown = tShownKind;

                var bmp = new Bitmap(256, 256, System.Drawing.Imaging.PixelFormat.Format32bppArgb);
                using (var g = Graphics.FromImage(bmp))
                {
                    g.FillEllipse(
                        (pingCount > 0) ? Brushes.Red : Brushes.White, 32, 32, 256 - 64, 256 - 64);
                }

                using var ms = new MemoryStream();
                SaveAsIcon(bmp, ms);

                ms.Position = 0;
                ico = new Icon(ms);
                Console.WriteLine("Win32NotificationBadgeManager.SetNotificationBadge SetOverlayIcon");
                tbm.SetOverlayIcon(ico, "Alert");
                Console.WriteLine("Win32NotificationBadgeManager.SetNotificationBadge SetOverlayIcon done");
            }
            else
            {
                if (_lastShown == LastShownKind.None)
                {
                    return;
                }

                _lastShown = LastShownKind.None;

                ico = null;
                Console.WriteLine("Win32NotificationBadgeManager.SetNotificationBadge SetOverlayIcon nulls");
                tbm.SetOverlayIcon(null, null);
                Console.WriteLine("Win32NotificationBadgeManager.SetNotificationBadge SetOverlayIcon nulls done");
            }

            if (_previousIcon != null)
            {
                _previousIcon.Dispose();
            }
            _previousIcon = ico;
        }

        void SaveAsIcon(Bitmap SourceBitmap, Stream stream)
        {
            IconWriter.Write(stream, new List<Image>() { SourceBitmap });
        }
    }

    public static class IconWriter
    {
        public static void Write(Stream stream, IReadOnlyList<Image> images)
        {
            if (images.Any(image => image.Width > 256 || image.Height > 256))
                throw new ArgumentException("Image cannot have height or width greater than 256px.", "images");

            //
            // ICONDIR structure
            //

            WriteInt16(stream, 0); // reserved
            WriteInt16(stream, 1); // image type (icon)
            WriteInt16(stream, (short)images.Count); // number of images

            var encodedImages = images.Select(image => new
            {
                image.Width,
                image.Height,
                Bytes = EncodeImagePng(image)
            }).ToList();

            //
            // ICONDIRENTRY structure
            //

            const int iconDirSize = 6;
            const int iconDirEntrySize = 16;

            var offset = iconDirSize + (images.Count * iconDirEntrySize);

            foreach (var image in encodedImages)
            {
                stream.WriteByte((byte)image.Width);
                stream.WriteByte((byte)image.Height);
                stream.WriteByte(0); // no pallete
                stream.WriteByte(0); // reserved
                WriteInt16(stream, 0); // no color planes
                WriteInt16(stream, 32); // 32 bpp

                // image data length
                WriteInt32(stream, image.Bytes.Length);

                // image data offset
                WriteInt32(stream, offset);

                offset += image.Bytes.Length;
            }

            //
            // Image data
            //

            foreach (var image in encodedImages)
                stream.Write(image.Bytes, 0, image.Bytes.Length);
        }

        private static byte[] EncodeImagePng(Image image)
        {
            var stream = new MemoryStream();
            image.Save(stream, ImageFormat.Png);
            return stream.ToArray();
        }

        private static void WriteInt16(Stream stream, short s)
        {
            stream.WriteByte((byte)s);
            stream.WriteByte((byte)(s >> 8));
        }

        private static void WriteInt32(Stream stream, int i)
        {
            stream.WriteByte((byte)i);
            stream.WriteByte((byte)(i >> 8));
            stream.WriteByte((byte)(i >> 16));
            stream.WriteByte((byte)(i >> 24));
        }
    }
}
