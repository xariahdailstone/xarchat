using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using Windows.Win32;
using Windows.Win32.Foundation;
using Windows.Win32.UI.WindowsAndMessaging;

namespace XarChat.Native.Win32.Wrapped
{
    public class MessageLoop : SynchronizationContext
    {
        private static readonly uint WM_RUNTASK;

        private class TaskReceiverWindow : IDisposable
        {
            private readonly MessageLoop _messageLoop;
            private readonly WindowClass _windowClass;
            private readonly HWND _hwnd;

            public static IntPtr HWND_MESSAGE = new IntPtr(-3);

            public unsafe TaskReceiverWindow(MessageLoop messageLoop)
            {
                _messageLoop = messageLoop;

                var classNameStr = "TaskReceiverWindow";
                fixed (char* classNameStrPtr  = classNameStr)
                {
                    _windowClass = WindowClass.Register(classNameStr, WndProc2);
                    _hwnd = PInvoke.CreateWindowEx((WINDOW_EX_STYLE)0, new PCWSTR((char*)((IntPtr)_windowClass.Atom).ToPointer()), 
                        new PCWSTR(classNameStrPtr), (WINDOW_STYLE)0,
                        0, 0, 0, 0, new HWND(HWND_MESSAGE), HMENU.Null, new HINSTANCE(PInvoke.GetModuleHandle((PCWSTR)null)));
                }
            }

            public void Dispose()
            {
                PInvoke.DestroyWindow(_hwnd);
                _windowClass.Dispose();
            }

            public HWND HWND => _hwnd;

            internal nint WndProc2(WindowHandle hwnd, uint message, nuint wParam, nint lParam)
            {
                if (message == WM_RUNTASK)
                {
                    _messageLoop.ExecuteRunTask(wParam);
                    return (LRESULT)0;
                }
                return PInvoke.DefWindowProc(new HWND(hwnd.Handle), message, wParam, lParam);
            }
        }

        static MessageLoop()
        {
            WM_RUNTASK = User32.RegisterWindowMessage("WM_RUNTASK");
        }

        private readonly Thread _uiThread;
        private readonly TaskReceiverWindow _taskReceiverWindow;

        public MessageLoop()
        {
            _uiThread = Thread.CurrentThread;
            _taskReceiverWindow = new TaskReceiverWindow(this);
        }

        private readonly Dictionary<nuint, Action> _pendingCallbacks = new Dictionary<nuint, Action>();
        private int _nextCallbackId = 0;

        public void Post(Action action) => Post(_ => action(), null);

        public override void Post(SendOrPostCallback d, object? state)
        {
            var funcKey = (nuint)Interlocked.Increment(ref _nextCallbackId);

            var invokeFunc = (Action)(() =>
            {
                try { d(state); }
                catch { }
                lock (_pendingCallbacks)
                {
                    _pendingCallbacks.Remove(funcKey);
                }
            });
            lock (_pendingCallbacks)
            {
                _pendingCallbacks.Add(funcKey, invokeFunc);
            }

            System.Diagnostics.Debug.WriteLine($"PostMessage WM_RUNTASK to {_taskReceiverWindow.HWND}");
            if (!PInvoke.PostMessage(_taskReceiverWindow.HWND, WM_RUNTASK, new WPARAM((nuint) funcKey), IntPtr.Zero))
            {
                System.Diagnostics.Debug.WriteLine($"FAILED to posted Message WM_RUNTASK");
            }
            else
            {
                System.Diagnostics.Debug.WriteLine($"Posted Message WM_RUNTASK");
            }
        }

        public void Send(Action action) => Send(_ => action(), null);

        public override void Send(SendOrPostCallback d, object? state)
        {
            if (IsRunningOnUiThread)
            {
                try { d(state); }
                catch { }
            }
            else
            {
                using var mre = new ManualResetEvent(false);
                Post((innerState) =>
                {
                    try
                    {
                        d(state);
                    }
                    finally
                    {
                        mre.Set();
                    }
                }, state);
                mre.WaitOne();
            }
        }

        public bool IsRunningOnUiThread => Thread.CurrentThread == _uiThread;

        private void EnsureRunningOnUIThread()
        {
            if (!IsRunningOnUiThread)
            {
                throw new InvalidOperationException("Must be on UI thread");
            }
        }

        public int Run()
        {
            _breakout = false;
            EnsureRunningOnUIThread();

            MSG msg;

            BOOL getMessageResult;
            while ((getMessageResult = PInvoke.GetMessage(out msg, HWND.Null, 0, 0)) != 0)
            {
                if (getMessageResult == -1)
                {
                    throw new ApplicationException("GetMessage returned -1");
                }
                else
                {
                    PInvoke.TranslateMessage(msg);
                    PInvoke.DispatchMessage(msg);
                }

                if (_breakout)
                {
                    return 0;
                }
            }

            return unchecked((int)msg.wParam.Value);
        }

        private bool _breakout = false;

        public void Breakout()
        {
            if (IsRunningOnUiThread)
            {
                _breakout = true;
            }
            else
            {
                this.Post(() =>
                {
                    _breakout = true;
                });
            }
        }

        private void ExecuteRunTask(nuint wParam)
        {
            System.Diagnostics.Debug.WriteLine("got WM_RUNTASK");
            Action? func;
            lock (_pendingCallbacks)
            {
                if (!_pendingCallbacks.TryGetValue(wParam, out func))
                {
                    func = null;
                }
            }
            if (func != null)
            {
                System.Diagnostics.Debug.WriteLine("handling WM_RUNTASK");

                var restoreSyncContext = SynchronizationContext.Current;
                SynchronizationContext.SetSynchronizationContext(this);
                try 
                { 
                    func(); 
                }
                catch (Exception ex)
                {
                    OnLogTaskFailure?.Invoke(this, new LogTaskFailureEventArgs(ex.ToString(), false));
                }
                SynchronizationContext.SetSynchronizationContext(restoreSyncContext);

                System.Diagnostics.Debug.WriteLine("handled WM_RUNTASK");
            }
            else
            {
                System.Diagnostics.Debug.WriteLine("null WM_RUNTASK");
            }
        }

        public EventHandler<LogTaskFailureEventArgs>? OnLogTaskFailure;

        //private bool HandleTaskMessage(ref MSG msg)
        //{
        //    if (msg.message == WM_RUNTASK)
        //    {
        //        System.Diagnostics.Debug.WriteLine("got WM_RUNTASK");
        //        Action? func;
        //        lock (_pendingCallbacks)
        //        {
        //            if (!_pendingCallbacks.TryGetValue((int)msg.wParam, out func))
        //            {
        //                func = null;
        //            }
        //        }
        //        if (func != null)
        //        {
        //            System.Diagnostics.Debug.WriteLine("handling WM_RUNTASK");
        //            try { func(); }
        //            catch { }
        //        }
        //        else
        //        {
        //            System.Diagnostics.Debug.WriteLine("null WM_RUNTASK");
        //        }
        //        return true;
        //    }
        //    else
        //    {
        //        return false;
        //    }
        //}
    }

    public class LogTaskFailureEventArgs : EventArgs
    {
        public LogTaskFailureEventArgs(string content, bool fatal)
        {
            this.Content = content;
            this.Fatal = fatal;
        }

        public string Content { get; }

        public bool Fatal { get; }
    }
}
