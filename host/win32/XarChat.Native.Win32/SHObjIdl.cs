using PInvoke = Windows.Win32.PInvoke;

namespace XarChat.Native.Win32
{
    public static class SHObjIdl
    {
        public static void SetCurrentProcessExplicitAppUserModelID(string appId)
        {
            PInvoke.SetCurrentProcessExplicitAppUserModelID(appId);
        }
    }
}
