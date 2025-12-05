using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Photino;
using Photino.NET;
//using PhotinoNET;
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO.Pipes;
using System.Reflection;
using System.Web;
using Wacton.Unicolour;
using XarChat.AutoUpdate;
using XarChat.AutoUpdate.Impl.Disabled;
using XarChat.Backend;
using XarChat.Backend.Features.AppConfiguration;
using XarChat.Backend.Features.CommandLine.Impl;
using XarChat.Backend.Features.SingleInstanceManager.ProfileLockFile;

#if LINUX
using XarChat.Backend.Linux;
using XarChat.Backend.Linux.AppDataFolder;
#endif
#if MAC
using XarChat.Backend.Mac;
using XarChat.Backend.Mac.AppDataFolder;
#endif
using XarChat.Backend.Photino.Services.WindowControl;

namespace XarChatLinuxPhotino
{
    class Program
    {
        [STAThread]
        static int Main(string[] args)
        {
            var clArgs = new ArrayCommandLineOptions(args);
            
            var profilePath = FindProfilePath(clArgs);
            var sim = new ProfileLockFileSingleInstanceManager(profilePath);
            if (!sim.TryBecomeSingleInstance(out var acquiredInstanceDisposable))
            {
                Console.WriteLine("activated other existing instance");
                return 0;
            }

            using var acquiredInstanceDisposableUsing = acquiredInstanceDisposable;

            var stopCTS = new CancellationTokenSource();

            var window = new PhotinoWindow();
            var wc = new PhotinoWindowControl(window);
#if LINUX
            var autoUpdater = AutoUpdateManagerFactory.Create(
                    new FileInfo("asdf"),
                    args,
                    new DirectoryInfo(profilePath),
                    new Version(AssemblyVersionInfo.XarChatVersion),
                    "linux-amd64",
                    AssemblyVersionInfo.XarChatBranch);

            ThreadPool.QueueUserWorkItem(delegate
            {
                autoUpdater.StartUpdateChecks();
            });

            var backend = new XarChatBackend(new LinuxBackendServiceSetup(wc), clArgs, autoUpdater);
#endif
#if MAC

            var autoUpdater = AutoUpdateManagerFactory.Create(
                    new FileInfo("asdf"),
                    args,
                    new DirectoryInfo(profilePath),
                    new Version(AssemblyVersionInfo.XarChatVersion),
                    "macos-arm64",
                    AssemblyVersionInfo.XarChatBranch);

            ThreadPool.QueueUserWorkItem(delegate
            {
                autoUpdater.StartUpdateChecks();
            });

            var backend = new XarChatBackend(new MacBackendServiceSetup(wc), clArgs, autoUpdater);
#endif
            var backendRunTask = Task.Run(async () => {
                try
                {
                    await backend.RunAsync(x => Console.WriteLine(x), stopCTS.Token);
                }
                catch (Exception ex)
                {
                    Console.WriteLine(ex.ToString());
                    acquiredInstanceDisposable.Dispose();
                    System.Environment.Exit(1);
                }
            });

#if LINUX
            var windowTitle = "XarChat";

            var iconFileName = Path.Combine(profilePath, "xarchat.png");
            if (!File.Exists(iconFileName))
            {
                using var resStream =
                    (from rn in Assembly.GetExecutingAssembly().GetManifestResourceNames()
                     where rn.EndsWith(".xarchat.png")
                     select Assembly.GetExecutingAssembly().GetManifestResourceStream(rn)).First();
                using var outf = File.Create(iconFileName);
                resStream.CopyTo(outf);
                outf.Flush();
            }

#endif
#if MAC
            var windowTitle = "XarChat";
#endif

            window
                .SetDevToolsEnabled(false)
                .SetWebSecurityEnabled(false)
                .SetIgnoreCertificateErrorsEnabled(true)
                .SetTitle(windowTitle)
                .SetUseOsDefaultSize(true)
                .SetUseOsDefaultLocation(true)
                .SetMinSize(600, 400)
                .SetMaxSize(99999, 99999)
#if LINUX
                .SetTitlebarColor(0, 0, 0)
                .SetIconFile(iconFileName)
                .SetBrowserControlInitParameters("{\"set_enable_developer_extras\":true,\"set_disable_web_security\":true}")
#endif
#if MAC
                .SetBrowserControlInitParameters("{\"developerExtrasEnabled\":true}")
#endif
                ;
            

            Console.WriteLine("waiting for asset port...");
            var assetPortNumber = backend.GetAssetPortNumber().Result;
            Console.WriteLine("waiting for ws port...");
            var wsPortNumber = backend.GetWSPortNumber().Result;
            // TODO: set browser control profile path

            Console.WriteLine("launching...");
            window.Load($"https://localhost:{assetPortNumber}/app/index.html" +
                $"?XarHostMode=2" +
                $"&ClientVersion={HttpUtility.UrlEncode(AssemblyVersionInfo.XarChatVersion)}" +
#if LINUX
                $"&ClientPlatform=linux-x64" +
#endif
#if MAC
                $"&ClientPlatform=macos-arm64" +
#endif
                $"&ClientBranch={HttpUtility.UrlEncode(AssemblyVersionInfo.XarChatBranch)}" +
                $"&devmode=true" +
                $"&wsport={wsPortNumber}");
            //window.Load("http://192.168.1.212/trf/svgembedtest");

            try
            {
                Task.Run(async () => 
                {
                    while (!stopCTS.IsCancellationRequested)
                    {
                        await acquiredInstanceDisposable.GetActivationRequestAsync(stopCTS.Token);
                        // TODO: activate my window
                        window.Restore();
                    }
                });

                //window.Load("https://google.com/");
                window.WindowClosing += (sender, args) => {
                    window.LoadRawString("");
                    return false;
                };
                //window.WindowSizeChanged += (sender, args) => {
                //    var w = window.Width;
                //    var h = window.Height;
                //    try
                //    {
                //        window.SendWebMessage($"{{ \"type\": \"clientresize\", \"bounds\": [ {w}, {h} ] }}");
                //    }
                //    catch { }
                //};
                window.WindowCreated += (sender, args) => {
                    Console.WriteLine("window created");
#if !LINUX
                    Console.WriteLine($"Resizable = {window.Resizable}");
                    window.Resizable = false;
                    Console.WriteLine($"Resizable = {window.Resizable}");
                    window.Resizable = true;
                    Console.WriteLine($"Resizable = {window.Resizable}");
               
#endif
#if LINUX
                    Task.Run(async () => {
                        var sp = await backend.GetServiceProviderAsync();
                        var cancellationToken = sp.GetRequiredService<IHostApplicationLifetime>().ApplicationStopping;
                        
                        var ac = sp.GetRequiredService<IAppConfiguration>();
                        using var subscr = ac.OnValueChanged("global.bgColor", (value, changeMetadata) => {
                            try
                            {
                                string valStr;
                                if (value == null)
                                {
                                    valStr = "255;7";
                                }
                                else
                                {
                                    valStr = value.ToString();
                                }

                                Console.WriteLine($"global.bgColor === {valStr}");
                                var parts = valStr.Split(';');
                                var hue = Convert.ToDouble(parts[0]);
                                var sat = Convert.ToDouble(parts[1]) / 100d;
                                var brightnessFactor = parts.Length > 2 ? Convert.ToDouble(parts[2]) : 1d;

                                Console.WriteLine($"HSL === {hue}, {sat}, {brightnessFactor * 15d / 100d}");
                                // TODO:
                                Unicolour x = new(ColourSpace.Hsl, hue, sat, (brightnessFactor * 15d) / 100d);

                                var r = (int)Math.Floor(x.Rgb.R * 255d);
                                var g = (int)Math.Floor(x.Rgb.G * 255d);
                                var b = (int)Math.Floor(x.Rgb.B * 255d);
                                Console.WriteLine($"COLOR === {r},{g},{b}");
                                window.SetTitlebarColor(r, g, b);
                            }
                            catch { }
                        }, true);
                        try {
                            await Task.Delay(-1, cancellationToken);
                        }
                        catch when (cancellationToken.IsCancellationRequested) { }
                    });

#endif
                    //window.ShowDevTools();
                };

                window.WaitForClose();

                Console.WriteLine("Window closed");            
                stopCTS.Cancel();

                Console.WriteLine("waiting for app end");            
                backendRunTask.Wait();

                Console.WriteLine("returning 0");
                return 0;
            }
            finally
            {
                // Fixes leftover WebKitGtk processes
                CleanupChildProcesses();
            }
        }

        private static string FindProfilePath(ArrayCommandLineOptions clo)
        {
#if MAC
            var adl = new MacAppDataFolder(clo);
#else
            var adl = new LinuxAppDataFolder(clo);
#endif
			var appDataFolder = adl.GetAppDataFolder();
            var fi = new FileInfo(appDataFolder);
            return fi.FullName;
        }

        private static void CleanupChildProcesses()
        {
            void killChildrenOf(int id, bool alsoSelf)
            {
                try
                {
                    var procDir = Path.Combine("/proc", id.ToString(), "task");
                    foreach (var taskDir in Directory.GetDirectories(procDir))
                    {
                        var childrenFile = Path.Combine(taskDir, "children");
                        try
                        {
                            using (var fr = File.OpenText(childrenFile))
                            {
                                var childPids = fr.ReadToEnd().Split(' ');
                                foreach (var childPidStr in childPids)
                                {
                                    try 
                                    {
                                        if (Int32.TryParse(childPidStr, out var c))
                                        {
                                            killChildrenOf(c, true);
                                        }
                                    }
                                    catch { }
                                }
                            }
                        }
                        catch { }
                    }
                }
                catch { }
                Console.WriteLine($"Reaping child {id}");
                Process.GetProcessById(id).Kill();
            };

            var myPid = Process.GetCurrentProcess().Id;
            killChildrenOf(myPid, false);
        }
    }
}
