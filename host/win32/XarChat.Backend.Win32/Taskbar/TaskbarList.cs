
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.Marshalling;

namespace Microsoft.WindowsAPICodePack.Taskbar
{
    /// <summary>
    /// Provides internal access to the functions provided by the ITaskbarList4 interface,
    /// without being forced to refer to it through another singleton.
    /// </summary>
    internal static class TaskbarList
    {
        private static object _syncLock = new object();

        private static ITaskbarList4 _taskbarList;
        internal static ITaskbarList4 Instance
        {
            get
            {
                if (_taskbarList == null)
                {
                    lock (_syncLock)
                    {
                        if (_taskbarList == null)
                        {
                            const uint CLSCTX_INPROC_SERVER = 1;
                            var clsid = Guid.Parse("56FDF344-FD6D-11d0-958A-006097C9A090");
                            //var IID_IUnknown = new Guid("00000000-0000-0000-C000-000000000046");
                            var IID_ITaskbarList4 = new Guid("c43dc798-95d1-4bea-9030-bb99e2983a1a");

                            IntPtr instance;
                            Ole32Methods.CoCreateInstance(ref clsid, null, CLSCTX_INPROC_SERVER, ref IID_ITaskbarList4, out instance);
                            var sbcw = new StrategyBasedComWrappers();
                            ITaskbarList4 tbl = (ITaskbarList4)sbcw.GetOrCreateObjectForComInstance(instance, CreateObjectFlags.None);

                            _taskbarList = tbl;
                            _taskbarList.HrInit();

                            //_taskbarList = (ITaskbarList4)new CTaskbarList();
                            //_taskbarList.HrInit();
                        }
                    }
                }

                return _taskbarList;
            }
        }

        public class Ole32Methods
        {
            [DllImport("ole32.Dll")]
            static public extern uint CoCreateInstance(ref Guid clsid,
               [MarshalAs(UnmanagedType.IUnknown)] object inner,
               uint context,
               ref Guid uuid,
               out IntPtr rReturnedComObject);
        }
    }
}