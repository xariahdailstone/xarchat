using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Windows.Win32;
using Windows.Win32.Foundation;

namespace XarChat.Native.Win32.Wrapped
{
    public class Cursor : IDisposable
    {
        private static readonly Lazy<Cursor> _nsSizeCursorLazy;

        unsafe static Cursor()
        {
            _nsSizeCursorLazy = new Lazy<Cursor>(() =>
            {
                var h = PInvoke.LoadCursor(HINSTANCE.Null, new PCWSTR((char*)((IntPtr)User32.IDC.SIZENS).ToPointer()));
                var result = new Cursor(h, false);
                return result;
            });
        }

        public static Cursor SizeNS => _nsSizeCursorLazy.Value;

        private readonly IntPtr _hCursor;
        private readonly bool _ownsHandle;

        public Cursor(IntPtr hCursor, bool ownsHandle)
        {
            _hCursor = hCursor;
            _ownsHandle = ownsHandle;
        }

        ~Cursor()
        {
            Dispose(false);
        }

        public void Dispose()
        {
            GC.SuppressFinalize(this);
            Dispose(true);
        }

        protected virtual void Dispose(bool disposing)
        {
            // TODO:
        }

        public IntPtr HCursor => _hCursor;
    }
}
