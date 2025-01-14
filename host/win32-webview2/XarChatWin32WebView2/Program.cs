using Microsoft.Extensions.DependencyInjection;
using Microsoft.Win32.SafeHandles;
using MinimalWin32Test.Properties;
using MinimalWin32Test.UI;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using XarChat.AutoUpdate;
using XarChat.Backend;
using XarChat.Backend.Features.AppConfiguration.Impl;
using XarChat.Backend.Features.CommandLine.Impl;
using XarChat.Backend.Features.CrashLogWriter;
using XarChat.Backend.Features.SingleInstanceManager.ProfileLockFile;
using XarChat.Backend.Features.StartupTasks;
using XarChat.Backend.Features.UpdateChecker.Null;
using XarChat.Backend.Win32;
using XarChat.Backend.Win32.AppDataFolder;
using XarChat.Native.Win32;
using XarChat.Native.Win32.Wrapped;
using static XarChat.Native.Win32.User32;

namespace MinimalWin32Test
{
    internal class Program
    {
        [STAThread]
        static int Main(string[] args)
        {
            var pid = Environment.ProcessId;
            var startupLogFile = Path.Combine(Path.GetTempPath(), $"XarChat.startup-{DateTime.Now.ToString("yyyyMMhddHHmmss")}-{pid}.log");
            if (File.Exists(startupLogFile))
            {
                try { File.Delete(startupLogFile); }
                catch { }
            }

            using var startupLogWriter = CreateStartupLogFile(startupLogFile);

            var writeStartupLog = (string message) => { try { startupLogWriter.WriteLine(message); } catch { } };

            var appRan = false;
            try
            {
                writeStartupLog($"XarChat {AssemblyVersionInfo.XarChatVersion}-{AssemblyVersionInfo.XarChatBranch} starting up...");

                writeStartupLog($"Finding profile path...");
                var profilePath = FindProfilePath(args);
                writeStartupLog($"profilePath = {profilePath}");

                writeStartupLog($"Starting AutoUpdateManagerFactory...");
                var autoUpdater = AutoUpdateManagerFactory.Create(
                    new FileInfo(Kernel32.GetMainModuleName()),
                    args,
                    new DirectoryInfo(profilePath),
                    new Version(AssemblyVersionInfo.XarChatVersion),
                    "win-x64",
                    AssemblyVersionInfo.XarChatBranch);

                writeStartupLog($"Looking for most recent EXE in profile dir...");
                if (autoUpdater.TryRunMostRecentAsync(CancellationToken.None).Result)
                {
                    writeStartupLog($"Most recent EXE run, exiting.");
                    return 0;
                }

                writeStartupLog($"Creating app mutex...");
                var sim = new ProfileLockFileSingleInstanceManager(profilePath);
                if (!sim.TryBecomeSingleInstance(out var acquiredInstanceDisposable))
                {
                    writeStartupLog("Instance already exists and was signalled, exiting.");
                    return 0;
                }

                using var acquiredInstanceDisposableUsing = acquiredInstanceDisposable;

                //var sim = SingleInstanceManager.TryCreate($"Local\\XarChatInstanceMutex-{MakeStringSafeForMutexName(profilePath)}", "XarChat");
                //if (sim == null)
                //{
                //    writeStartupLog($"Mutex already exists, exiting.");
                //    return 0;
                //}

                writeStartupLog("creating MessageLoop");
                var app = new MessageLoop();

                writeStartupLog($"CheckForWebView2Runtime...");
                if (!CheckForWebView2Runtime(args, app))
                {
                    Environment.Exit(1);
                }

                //SQLitePCL.raw.SetProvider(new SQLitePCL.SQLite3Provider_winsqlite3());

                var stopCTS = new CancellationTokenSource();

                writeStartupLog("creating BrowserWindowWindowControl");
                var wc = new BrowserWindowWindowControl(app);
                var clArgs = new ArrayCommandLineOptions(args);

                writeStartupLog("creating XarChatBackEnd");
                ThreadPool.QueueUserWorkItem(delegate
                {
                    autoUpdater.StartUpdateChecks();
                });
                var backend = new XarChatBackend(new Win32BackendServiceSetup(wc), clArgs, autoUpdater);
                var backendRunTask = Task.Run(async () =>
                {
                    try
                    {
                        await backend.RunAsync(writeStartupLog, stopCTS.Token);
                    }
                    catch (Exception ex)
                    {
                        var err = $"Failed to initialize backend. Please see this file for more details:\r\n\r\n" + startupLogFile;
                        User32.MessageBox(0, err, "XarChat initialization failed");
                        writeStartupLog($"Failed to initialize backend: " + ex.ToString());
                        Environment.Exit(1);
                    }
                });

                WaitForStartupTasks(app, backend);

                app.OnLogTaskFailure += (o, e) =>
                {
                    var sp = backend.GetServiceProviderAsync().Result;
                    var clw = sp.GetService<ICrashLogWriter>();
                    if (clw is not null)
                    {
                        clw.WriteCrashLog("MessageLop LogTaskFailure\n\n" + e.Content, e.Fatal);
                    }
                };
                AppDomain.CurrentDomain.UnhandledException += (o, e) =>
                {
                    var sp = backend.GetServiceProviderAsync().Result;
                    var clw = sp.GetService<ICrashLogWriter>();
                    if (clw is not null)
                    {
                        clw.WriteCrashLog("AppDomain Unhandled Exception\n\n" + e.ExceptionObject.ToString(), false);
                    }
                };

                writeStartupLog("creating BrowserWindow");
                var win = new BrowserWindow(app, backend, wc, clArgs);
                win.StartupLogWriter = startupLogWriter;
                wc.BrowserWindow = win;
                wc.ServiceProvider = backend.GetServiceProviderAsync().Result;

                writeStartupLog("showing BrowserWindow");
                win.Show();

                Task.Run(async () =>
                {
                    while (!stopCTS.IsCancellationRequested)
                    {
                        await acquiredInstanceDisposable.GetActivationRequestAsync(stopCTS.Token);
                        win.SetForegroundWindow();
                    }
                });

                writeStartupLog("running app, ending startup log");
                win.StartupLogWriter = null;
                startupLogWriter.Dispose();

                if (File.Exists(startupLogFile))
                {
                    try { File.Delete(startupLogFile); } catch { }
                }

                var exitCode = app.Run();
                appRan = true;

                System.Threading.Timer t = new System.Threading.Timer((_) =>
                {
                    Environment.Exit(exitCode);
                });
                t.Change(TimeSpan.FromSeconds(5), Timeout.InfiniteTimeSpan);

                stopCTS.Cancel();

                backendRunTask.Wait();

                if (autoUpdater.RelaunchOnExitRequested)
                {
                    //sim.Dispose();
                    acquiredInstanceDisposable.Dispose();
                    autoUpdater.TryRunMostRecentAsync(CancellationToken.None).Wait();
                }

                acquiredInstanceDisposable.Dispose();
                Environment.Exit(exitCode);

                GC.KeepAlive(sim);
                return 0;
            }
            catch (Exception ex)
            {
                if (!appRan)
                {
                    writeStartupLog("Initialization failed: " + ex.ToString());
                    var err = $"Failed to initialize backend. Please see this file for more details:\r\n\r\n" + startupLogFile;
                    User32.MessageBox(0, err, "XarChat initialization failed");
                }
                return 1;
            }
        }

        private static void WaitForStartupTasks(MessageLoop app, XarChatBackend backend)
        {
            var sp = backend.GetServiceProviderAsync().GetAwaiter().GetResult();
            var stasks = sp.GetServices<IStartupTask>();

            using var showDialogCTS = new CancellationTokenSource();
            showDialogCTS.CancelAfter(TimeSpan.FromSeconds(1));
            InitializationWindow? initWindow = null;

            using var autoResetEvent = new AutoResetEvent(false);
            var disposables = new List<IDisposable>();
            try
            {
                var monitorTask = Task.Run(() =>
                {
                    app.Post(() => { });

                    foreach (var task in stasks)
                    {
                        task.OnStatusChange(() =>
                        {
                            autoResetEvent.Set();
                        });
                    }
                    using var showReg = showDialogCTS.Token.Register(() =>
                    {
                        autoResetEvent.Set();
                    });

                    while (true)
                    {
                        autoResetEvent.WaitOne();

                        var tasksRemaining = 0;
                        var statusStr = "";
                        foreach (var task in stasks)
                        {
                            var taskStatus = task.Status;
                            if (!taskStatus.IsComplete)
                            {
                                statusStr = taskStatus.CurrentStatus;
                                tasksRemaining++;
                            }
                        }
                        if (tasksRemaining > 1)
                        {
                            statusStr = $"Waiting for {tasksRemaining} startup tasks...";
                        }

                        if (tasksRemaining > 0)
                        {
                            if (showDialogCTS.IsCancellationRequested)
                            {
                                app.Send(() =>
                                {
                                    if (showDialogCTS.IsCancellationRequested && initWindow == null)
                                    {
                                        initWindow = new InitializationWindow(app);
                                        initWindow.Show();
                                    }
                                    if (initWindow is not null)
                                    {
                                        initWindow.SetStatus(statusStr);
                                    }
                                });
                            }
                        }
                        else
                        {
                            var needBreakout = true;
                            if (showDialogCTS.IsCancellationRequested)
                            {
                                app.Send(() =>
                                {
                                    if (initWindow != null)
                                    {
                                        needBreakout = false;
                                        initWindow.Close();
                                    }
                                });
                            }
                            if (needBreakout)
                            {
                                app.Breakout();
                            }
                            break;
                        }
                    }
                });
                app.Run();
                monitorTask.Wait();
            }
            finally
            {
                foreach (var d in disposables)
                {
                    d.Dispose();
                }
            }
        }

        private static void MaybeShowInitWindowOnly(string[] args, MessageLoop messageLoop)
        {
            foreach (var arg in args)
            {
                if (arg == "--showinitwindow")
                {
                    var iw = new InitializationWindow(messageLoop);
                    iw.Show();

                    messageLoop.Run();
                }
            }
        }

        private static TextWriter CreateStartupLogFile(string startupLogFile)
        {
            try
            {
                var f = File.CreateText(startupLogFile);
                f.AutoFlush = true;
                return f;
            }
            catch
            {
                var ms = new MemoryStream();
                return new StreamWriter(ms);
            }
        }

        private static bool CheckForWebView2Runtime(string[] args, MessageLoop messageLoop)
        {
            if (args.Select(x => x.ToLower()).Contains("--skipwebview2check"))
            {
                return true;
            }

            var shouldFakeInstall = args.Select(x => x.ToLower()).Contains("--showinitwindow");
            var shouldFailFakeInstall = args.Select(x => x.ToLower()).Contains("--failinitwindow");

            var ver = GetWebView2RuntimeVersion();
            if (String.IsNullOrWhiteSpace(ver) || shouldFakeInstall)
            {
                var result = InstallWebView2Runtime(messageLoop, shouldFakeInstall, shouldFailFakeInstall);
                return result;
            }
            return true;
        }

        private static bool InstallWebView2Runtime(MessageLoop messageLoop, bool fakeInstall, bool failFakeInstall)
        {
            using var installingUi = new InstallingUI(messageLoop);
            //installingUi.SetStatus("Please wait, installing WebView2 runtime...");

            var result = false;
            var cancellationToken = CancellationToken.None;
            var installTask = Task.Run(async () =>
            {
                var downloadUrl = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";
                using var hc = new HttpClient();
                installingUi.SetStatus("Downloading Microsoft WebView2 runtime...");
                using var resp = await hc.GetAsync(downloadUrl, cancellationToken);

                var tmpDir = System.Environment.GetEnvironmentVariable("TEMP") ??
                    System.Environment.GetEnvironmentVariable("TMP") ?? ".";
                var tmpFn = Path.Combine(tmpDir, "WebView2Setup.exe");
                var retryCount = 2;
                while (File.Exists(tmpFn))
                {
                    tmpFn = Path.Combine(tmpDir, $"WebView2Setup ({retryCount++}).exe");
                }

                try
                {
                    using (var fileWriter = File.Create(tmpFn))
                    {
                        using var dataStream = await resp.Content.ReadAsStreamAsync();
                        await dataStream.CopyToAsync(fileWriter, cancellationToken);
                    }

                    installingUi.SetStatus("Download complete.");
                    if (!fakeInstall)
                    {
                        var psi = new ProcessStartInfo();
                        psi.UseShellExecute = false;
                        psi.FileName = tmpFn;
                        psi.WorkingDirectory = Path.GetDirectoryName(tmpFn);
                        psi.ArgumentList.Add("/silent");
                        psi.ArgumentList.Add("/install");
                        installingUi.SetStatus("Installing Microsoft WebView2 runtime...");
                        var installProcess = Process.Start(psi);
                        if (installProcess == null)
                        {
                            throw new ApplicationException("Could not run WebView2 installer");
                        }
                        await installProcess.WaitForExitAsync(cancellationToken);
                    }
                    else
                    {
                        installingUi.SetStatus("Installing Microsoft WebView2 runtime...");
                        await Task.Delay(2000);
                        if (failFakeInstall)
                        {
                            throw new ApplicationException("install fail fake");
                        }
                    }

                    var ver = GetWebView2RuntimeVersion();
                    if (String.IsNullOrWhiteSpace(ver))
                    {
                        throw new ApplicationException("WebView2 runtime did not appear to install");
                    }
                    else
                    {
                        installingUi.SetStatus("Microsoft WebView2 runtime install complete.");
                        await Task.Delay(1000);
                        result = true;
                        installingUi.Dispose();
                    }
                }
                catch (Exception ex)
                {
                    installingUi.SetStatus("Microsoft WebView2 runtime install failed.");

                    var deleteRetriesRemaining = 10;
                    while (deleteRetriesRemaining > 0)
                    {
                        try
                        {
                            File.Delete(tmpFn);
                            break;
                        }
                        catch
                        {
                            deleteRetriesRemaining--;
                            if (deleteRetriesRemaining > 0)
                            {
                                await Task.Delay(100);
                            }
                        }
                    }

                    installingUi.ShowError($"Microsoft WebView2 runtime installation failed: {ex.Message}");
                    installingUi.Dispose();
                    result = false;
                }
            });

            messageLoop.Run();
            installTask.Wait();
            return result;
        }

        private static string GetWebView2RuntimeVersion()
        {
            try
            {
                var result = Microsoft.Web.WebView2.Core.CoreWebView2Environment.GetAvailableBrowserVersionString();
                return result ?? "";
            }
            catch
            {
                return "";
            }
        }

        private static string FindProfilePath(string[] args)
        {
            var clo = new ArrayCommandLineOptions(args);
            var adl = new Win32AppDataFolderImpl(clo);
            var appDataFolder = adl.GetAppDataFolder();
            var fi = new FileInfo(appDataFolder);
            return fi.FullName;
        }

        private static string MakeStringSafeForMutexName(string str)
        {
            var result = new StringBuilder();
            foreach (var ch in str)
            {
                if (ch >= 'A' && ch <= 'Z' ||
                    ch >= 'a' && ch <= 'y' ||
                    ch >= '0' && ch <= '9')
                {
                    result.Append(ch);
                }
                else
                {
                    result.Append('z');
                    var v = (short)ch;
                    result.Append(v.ToString());
                    result.Append('z');
                }
            }
            return result.ToString();
        }
    }

    //public class Application : SynchronizationContext
    //{
    //    private static readonly uint WM_RUNTASK;

    //    private class TaskReceiverWindow : WindowBase
    //    {
    //        private readonly Application _app;

    //        public TaskReceiverWindow(Application app)
    //        {
    //            _app = app;
    //        }

    //        protected override WindowClass GetWindowClass()
    //        {
    //            return WindowClass.Register("TaskReceiverWindow", this.WndProc);
    //        }

    //        protected override (WindowStyles WindowStyles, ExtendedWindowStyles ExtendedWindowStyles) GetWindowStyles()
    //        {
    //            var styles = (WindowStyles)0;
    //            var extStyles = (ExtendedWindowStyles)0;
    //            return (styles, extStyles);
    //        }

    //        protected override nint WndProc(WindowHandle windowHandle, uint msg, IntPtr wParam, IntPtr lParam)
    //        {
    //            if (msg == WM_RUNTASK)
    //            {
    //                _app.ExecuteRunTask((int)wParam);
    //                return 0;
    //            }
    //            return base.WndProc(windowHandle, msg, wParam, lParam);
    //        }
    //    }

    //    static Application()
    //    {
    //        WM_RUNTASK = RegisterWindowMessage("WM_RUNTASK");
    //    }

    //    private readonly Thread _uiThread;
    //    private readonly TaskReceiverWindow _taskReceiverWindow;

    //    public Application()
    //    {
    //        _uiThread = Thread.CurrentThread;
    //        _taskReceiverWindow = new TaskReceiverWindow(this);
    //        _taskReceiverWindow.EnsureHandleCreated();
    //    }

    //    private readonly Dictionary<int, Action> _pendingCallbacks = new Dictionary<int, Action>();
    //    private int _nextCallbackId = 0;

    //    public void Post(Action action) => Post(_ => action(), null);

    //    public override void Post(SendOrPostCallback d, object? state)
    //    {
    //        var funcKey = Interlocked.Increment(ref _nextCallbackId);

    //        var invokeFunc = (Action)(() => 
    //        { 
    //            try { d(state); } 
    //            catch { }
    //            lock (_pendingCallbacks)
    //            {
    //                _pendingCallbacks.Remove(funcKey);
    //            }
    //        });
    //        lock (_pendingCallbacks)
    //        {
    //            _pendingCallbacks.Add(funcKey, invokeFunc);
    //        }

    //        System.Diagnostics.Debug.WriteLine($"PostMessage WM_RUNTASK to {_taskReceiverWindow.WindowHandle.Handle}");
    //        if (!PostMessage(_taskReceiverWindow.WindowHandle.Handle, WM_RUNTASK, funcKey, IntPtr.Zero))
    //        {
    //            System.Diagnostics.Debug.WriteLine($"FAILED to posted Message WM_RUNTASK");
    //        }
    //        else
    //        {
    //            System.Diagnostics.Debug.WriteLine($"Posted Message WM_RUNTASK");
    //        }
    //    }

    //    public void Send(Action action) => Send(_ => action(), null);

    //    public override void Send(SendOrPostCallback d, object? state)
    //    {
    //        if (IsRunningOnUiThread)
    //        {
    //            try { d(state); }
    //            catch { }
    //        }
    //        else
    //        {
    //            using var mre = new ManualResetEvent(false);
    //            Post((innerState) =>
    //            {
    //                try
    //                {
    //                    d(state);
    //                }
    //                finally
    //                {
    //                    mre.Set();
    //                }
    //            }, state);
    //            mre.WaitOne();
    //        }
    //    }

    //    public bool IsRunningOnUiThread => Thread.CurrentThread == _uiThread;

    //    private void EnsureRunningOnUIThread()
    //    {
    //        if (!IsRunningOnUiThread)
    //        {
    //            throw new InvalidOperationException("Must be on UI thread");
    //        }
    //    }

    //    public int Run()
    //    {
    //        EnsureRunningOnUIThread();

    //        MSG msg;

    //        int getMessageResult;
    //        while ((getMessageResult = GetMessage(out msg, 0, 0, 0)) != 0)
    //        {
    //            if (getMessageResult == -1)
    //            {
    //                throw new ApplicationException("GetMessage returned -1");
    //            }
    //            else
    //            {
    //                TranslateMessage(ref msg);
    //                DispatchMessage(ref msg);
    //            }
    //        }

    //        return unchecked((int)msg.wParam);
    //    }

    //    private void ExecuteRunTask(int wParam)
    //    {
    //        System.Diagnostics.Debug.WriteLine("got WM_RUNTASK");
    //        Action? func;
    //        lock (_pendingCallbacks)
    //        {
    //            if (!_pendingCallbacks.TryGetValue(wParam, out func))
    //            {
    //                func = null;
    //            }
    //        }
    //        if (func != null)
    //        {
    //            System.Diagnostics.Debug.WriteLine("handling WM_RUNTASK");

    //            var restoreSyncContext = SynchronizationContext.Current;
    //            SynchronizationContext.SetSynchronizationContext(this);
    //            try { func(); }
    //            catch { }
    //            SynchronizationContext.SetSynchronizationContext(restoreSyncContext);
    //        }
    //        else
    //        {
    //            System.Diagnostics.Debug.WriteLine("null WM_RUNTASK");
    //        }
    //    }

    //    //private bool HandleTaskMessage(ref MSG msg)
    //    //{
    //    //    if (msg.message == WM_RUNTASK)
    //    //    {
    //    //        System.Diagnostics.Debug.WriteLine("got WM_RUNTASK");
    //    //        Action? func;
    //    //        lock (_pendingCallbacks)
    //    //        {
    //    //            if (!_pendingCallbacks.TryGetValue((int)msg.wParam, out func))
    //    //            {
    //    //                func = null;
    //    //            }
    //    //        }
    //    //        if (func != null)
    //    //        {
    //    //            System.Diagnostics.Debug.WriteLine("handling WM_RUNTASK");
    //    //            try { func(); }
    //    //            catch { }
    //    //        }
    //    //        else
    //    //        {
    //    //            System.Diagnostics.Debug.WriteLine("null WM_RUNTASK");
    //    //        }
    //    //        return true;
    //    //    }
    //    //    else
    //    //    {
    //    //        return false;
    //    //    }
    //    //}
    //}

    internal class InstallingUI : IDisposable
    {
        private readonly MessageLoop _messageLoop;
        private readonly InitializationWindow _initializationWindow;

        public InstallingUI(MessageLoop messageLoop)
        {
            _messageLoop = messageLoop;
            _initializationWindow = new InitializationWindow(messageLoop);
            _initializationWindow.Show();
        }

        public void Dispose()
        {
            _initializationWindow.Close();
        }

        public void SetStatus(string str)
        {
            _initializationWindow.SetStatus(str);
        }

        public void ShowError(string message)
        {
            _initializationWindow.Invoke(() =>
            {
                User32.MessageBox(_initializationWindow.WindowHandle.Handle,
                    message, "XarChat Setup Failed");
            });
        }
    }

    //internal class xInstallingUI : IDisposable
    //{
    //    private readonly bool _createdConsole;
    //    private bool _disposed = false;

    //    public xInstallingUI()
    //    {
    //        if (Kernel32.AllocConsole())
    //        {
    //            _createdConsole = true;
    //            InitializeInStream();
    //            InitializeOutStream();
    //        }
    //        else
    //        {
    //            _createdConsole = false;
    //        }
    //    }

    //    public void Dispose()
    //    {
    //        if (!_disposed)
    //        {
    //            _disposed = true;
    //            if (_createdConsole)
    //            {
    //                Kernel32.FreeConsole();
    //            }
    //        }
    //    }

    //    private static void InitializeOutStream()
    //    {
    //        var fs = CreateFileStream("CONOUT$", 
    //            Kernel32.DesiredAccess.GenericWrite | Kernel32.DesiredAccess.GenericRead,
    //            Kernel32.FileShareMode.Write, 
    //            FileAccess.Write);
    //        if (fs != null)
    //        {
    //            var writer = new StreamWriter(fs) { AutoFlush = true };
    //            Console.SetOut(writer);
    //            Console.SetError(writer);
    //        }
    //    }

    //    private static void InitializeInStream()
    //    {
    //        var fs = CreateFileStream("CONIN$",
    //            Kernel32.DesiredAccess.GenericWrite | Kernel32.DesiredAccess.GenericRead,
    //            Kernel32.FileShareMode.Read,
    //            FileAccess.Read);
    //        if (fs != null)
    //        {
    //            Console.SetIn(new StreamReader(fs));
    //        }
    //    }

    //    private static FileStream? CreateFileStream(string name, Kernel32.DesiredAccess win32DesiredAccess, 
    //        Kernel32.FileShareMode win32ShareMode,
    //        FileAccess dotNetFileAccess)
    //    {
    //        var file = Kernel32.CreateFile(name, win32DesiredAccess, 
    //            win32ShareMode, 
    //            Kernel32.FileCreationDisposition.OpenExisting,
    //            Kernel32.FileFlagsAndAttributes.None /*FileAttributeNormal*/, null);
    //        if (!file.IsInvalid)
    //        {
    //            var fs = new FileStream(file, dotNetFileAccess);
    //            return fs;
    //        }
    //        return null;
    //    }

    //    public void SetStatus(string str)
    //    {
    //        Console.WriteLine(str);
    //    }
    //}
}