using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using System.Security.Cryptography.X509Certificates;
using System.Security.Cryptography;
using Microsoft.Extensions.DependencyInjection;
using XarChat.Backend.Features.LocalDataCache;
using XarChat.Backend.Features.LocalDataCache.Sqlite;
using XarChat.Backend.Features.FListApi.CachingImpl;
using XarChat.Backend.Features.FListApi.Impl;
using XarChat.Backend.Features.FListApi;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http.Features;
using XarChat.Backend.Features.AppFileServer;
using XarChat.Backend.Features.AppFileServer.FileSystem;
using Microsoft.AspNetCore.Mvc;
using XarChat.Backend.Features.MimeTypeMapper;
using XarChat.Backend.Features.MimeTypeMapper.Impl;
using Microsoft.AspNetCore.Http;
using XarChat.Backend.UrlHandlers.FListApiProxy;
using XarChat.Backend.UrlHandlers.ChatSocket;
using XarChat.Backend.Features.AppConfiguration;
using XarChat.Backend.Features.AppConfiguration.Impl;
using XarChat.Backend.UrlHandlers.LaunchUrl;
using XarChat.Backend.UrlHandlers.ImageProxy;
using XarChat.Backend.Features.AppSettings;
using XarChat.Backend.Features.AppSettings.AppDataFile;
using XarChat.Backend.Features.AppFileServer.ContentZip;
using XarChat.Backend.UrlHandlers.AppSettings;
using XarChat.Backend.UrlHandlers.XCHostFunctions;
using XarChat.Backend.Features.CommandLine;
using XarChat.Backend.Features.ChatLogging;
using XarChat.Backend.Features.ChatLogging.Sqlite;
using XarChat.Backend.Network;
using XarChat.Backend.Network.Impl;
using XarChat.Backend.Features.EIconIndexing;
using XarChat.Backend.Features.EIconIndexing.XariahNet;
using XarChat.Backend.Features.NewAppSettings;
using XarChat.Backend.Features.NewAppSettings.Sqlite;
using XarChat.Backend.UrlHandlers.Logs;
using XarChat.Backend.Features.UpdateChecker;
using System.Diagnostics;
using XarChat.Backend.UrlHandlers.EIconLoader;
using Microsoft.Extensions.Logging;
using XarChat.Backend.Features.EIconUpdateSubmitter;
using XarChat.Backend.Features.EIconUpdateSubmitter.Impl;
using System.Net.Sockets;
using System.Net;
using XarChat.Backend.Features.CommandableWindows;
using XarChat.Backend.UrlHandlers.WIndowCommands;
using XarChat.Backend.Features.MemoryHinter;
using XarChat.Backend.Features.MemoryHinter.Impl;
using XarChat.Backend.Features.StartupTasks;
using XarChat.Backend.Features.ChatLogging.Sqlite.Search;
using XarChat.Backend.UrlHandlers.FileChooser;
using XarChat.Backend.Features.EIconLoader;
using XarChat.Backend.Features.CrashLogWriter;
using XarChat.Backend.Features.CrashLogWriter.Impl;
using XarChat.Backend.Features.EIconLoader.Impl;
using XarChat.Backend.Features.TimingSet;
using XarChat.Backend.Features.TimingSet.Impl;
using XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.AppReady;
using XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.ShowDevTools;
using XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.WindowStateControl;
using XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.ChatLogging;
using XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.UpdateAppBadge;
using XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.IdleMonitor;
using XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.UpdateChecking;
using XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.GetFileData;
using XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.ConfigData;
using XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.EIconSearch;
using XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.ZoomLevel;
using XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.GetMemo;
using XarChat.Backend.Features.StyleUpdateWatcher;
using XarChat.Backend.Features.EIconFavoriteManager;
using XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.GetLocaleList;
using XarChat.Backend.Logging;
using XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.AppSettings;
using XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.FlashWindow;

namespace XarChat.Backend
{
    public class XarChatBackend
    {
        private readonly IBackendServiceSetup _backendServiceSetup;
        private readonly ICommandLineOptions _commandLineOptions;
        private readonly IUpdateChecker _updateChecker;

        public XarChatBackend(
            IBackendServiceSetup backendServiceSetup,
            ICommandLineOptions commandLineOptions,
            IUpdateChecker updateChecker)
        {
            _backendServiceSetup = backendServiceSetup;
            _commandLineOptions = commandLineOptions;
            _updateChecker = updateChecker;

            _portNumber = new TaskCompletionSource<(int, int)>();
            _serviceProviderTCS = new TaskCompletionSource<IServiceProvider>();
        }

        private TaskCompletionSource<(int AssetPort, int WSPort)> _portNumber;
        private TaskCompletionSource<IServiceProvider> _serviceProviderTCS;

        public async Task<int> GetAssetPortNumber() => _portNumber != null
            ? (await _portNumber.Task).AssetPort
            : throw new InvalidOperationException();

        public async Task<int> GetWSPortNumber() => _portNumber != null
            ? (await _portNumber.Task).WSPort
            : throw new InvalidOperationException();

        public async Task<IServiceProvider> GetServiceProviderAsync()
            => _serviceProviderTCS != null ? (await _serviceProviderTCS.Task) : throw new InvalidOperationException();

        private int GetFreePort()
        {
            //        var checkPort = 600;
            //        while (checkPort < 1024)
            //        {
            //            using var l = new TcpListener(IPAddress.Loopback, checkPort);
            //            try
            //            {
            //	l.Start();
            //                l.Stop();
            //                return checkPort;
            //}
            //            catch { }
            //            checkPort++;
            //        }
            return 0;
        }

        public async Task RunAsync(Action<string> startupLogWriter, CancellationToken cancellationToken)
        {
            startupLogWriter("XarChatBackend.RunAsync - setting MinThreads");
            ThreadPool.SetMinThreads(
                Math.Min(20, System.Environment.ProcessorCount),
                Math.Min(20, System.Environment.ProcessorCount));
            //ThreadPool.SetMinThreads(100, 100);

            startupLogWriter("XarChatBackend.RunAsync - creating webapp builder");
            var builder = WebApplication.CreateSlimBuilder();

            startupLogWriter("XarChatBackend.RunAsync - configuring Kestrel");
            builder.WebHost.UseKestrel(options =>
            {
                options.Limits.Http2.MaxStreamsPerConnection = 1_000_000;
                options.Limits.MaxConcurrentConnections = 1_000_000;

                var sscert = GetSelfSignedCertificate();

                var freePort = GetFreePort();

                // Create an HTTP/1 listener for UI assets
                options.Listen(System.Net.IPAddress.Loopback, freePort /* 0 */, configure =>
                {
                    configure.UseHttps(sscert);
                    configure.Protocols =
                        Microsoft.AspNetCore.Server.Kestrel.Core.HttpProtocols.Http1AndHttp2;
                });
            });

            startupLogWriter("XarChatBackend.RunAsync - configuring app services");
            ConfigureServices(builder);

            startupLogWriter("XarChatBackend.RunAsync - building app");
            await using var app = builder.Build();

            _serviceProviderTCS.SetResult(app.Services);

            startupLogWriter("XarChatBackend.RunAsync - registering appstartup handler");
            app.Lifetime.ApplicationStarted.Register(() =>
            {
                startupLogWriter("XarChatBackend.RunAsync.AppStartup - getting server instance");
                var server = app.Services.GetRequiredService<IServer>();
                var features = server.Features;

                startupLogWriter("XarChatBackend.RunAsync.AppStartup - getting asset port");
                var port = GetServerAssetPort(features);
                //var wsPort = GetServerWSPort(features);
                var wsPort = port;
                System.Diagnostics.Debug.WriteLine($"port = {port}");

                startupLogWriter($"XarChatBackend.RunAsync.AppStartup - exposing asset port ({port},{wsPort})");
                _portNumber.SetResult((port, wsPort));
            });
            using var reg = cancellationToken.Register(() =>
            {
                app.Lifetime.StopApplication();
            });

            startupLogWriter("XarChatBackend.RunAsync - starting eicon index populate");
            _ = app.Services.GetService<IEIconIndex>()?.InitializeAsync(app.Lifetime.ApplicationStopping);

            startupLogWriter("XarChatBackend.RunAsync - configuring app");
            Configure(startupLogWriter, app);

            startupLogWriter("XarChatBackend.RunAsync - calling runasync");
            await app.RunAsync();
        }

        private int GetServerAssetPort(IFeatureCollection features)
        {
            var addressFeature = features.Get<IServerAddressesFeature>();
            if (addressFeature != null)
            {
                foreach (var address in addressFeature.Addresses)
                {
                    var addressUri = new Uri(address);
                    if (addressUri.Host != "127.0.0.1")
                    {
                        continue;
                    }
                    var port = addressUri.Port; // Int32.Parse(addressParts.Last());
                    return port;
                }
            }
            return -1;
        }

        private int GetServerWSPort(IFeatureCollection features)
        {
            var addressFeature = features.Get<IServerAddressesFeature>();
            if (addressFeature != null)
            {
                foreach (var address in addressFeature.Addresses)
                {
                    //var addressParts = new Uri(address).Host.Split(":");
                    var addressUri = new Uri(address);
                    if (addressUri.Host != "[::1]")
                    {
                        continue;
                    }
                    var port = addressUri.Port; // Int32.Parse(addressParts.Last());
                    return port;
                }
            }
            return -1;
        }

        private void ConfigureServices(WebApplicationBuilder builder)
        {
            var services = builder.Services;

            services.AddHttpClient();
            services.AddHttpClient<IFListApi>()
                .ConfigurePrimaryHttpMessageHandler(() =>
                {
                    var handler = new HttpClientHandler();
                    handler.MaxConnectionsPerServer = 2;
                    return handler;
                });

            services.AddSingleton<IUpdateChecker>(_updateChecker);

            services.AddSingleton<IAppConfiguration, AppConfigurationImpl>();

            services.AddSingleton<IAppSettingsManager, AppDataAppSettingsManager>();
            services.AddSingleton<IMimeTypeMapper, MimeTypeMapperImpl>();
            services.AddSingleton<ILocalDataCache, SqliteLocalDataCacheImpl>();

            services.AddSingleton<SqliteChatLogWriter>();
            services.AddSingleton<IChatLogWriter>(sp => sp.GetRequiredService<SqliteChatLogWriter>());
            services.AddSingleton<IStartupTask>(sp => sp.GetRequiredService<SqliteChatLogWriter>().StartupTask);
            services.AddSingleton<IChatLogSearch, SqliteChatLogSearch>();

            //services.AddSingleton<IProxiedImageCache, ProxiedImageCache>();
            services.AddMemoryCache();
            services.AddSingleton<IProxiedImageCache2, SimplerProxiedImageCache>();
            services.AddSingleton<IHttpClientProvider, HttpClientProvider>();

            services.AddSingleton<INewAppSettings, SqliteNewAppSettings>();

            services.AddSingleton<IEIconIndex, XariahNetEIconIndex>();
            services.AddSingleton<DataUpdateSubmitter>();
            services.AddHostedService(sp => sp.GetRequiredService<DataUpdateSubmitter>());
            services.AddSingleton<IDataUpdateSubmitter>(sp => sp.GetRequiredService<DataUpdateSubmitter>());

            services.AddSingleton<IEIconLoader, EIconLoaderImpl>();

            services.AddSingleton<ICrashLogWriter, CrashLogWriterImpl>();

            services.AddScoped<ITimingSetFactory, TimingSetFactoryImpl>();

            SetupXCHostCommandHandlers(services);

            services.AddSingleton<FListApiImpl>();
            services.AddSingleton<IFListApi>(sp =>
            {
                var innerApi = sp.GetRequiredService<FListApiImpl>();
                var localDataCache = sp.GetRequiredService<ILocalDataCache>();

                var result = new CachingFListApiImpl(innerApi, localDataCache);
                return result;
            });
            services.AddSingleton<IFalsifiedClientTicketManager, FalsifiedClientTicketManager>();

            services.AddSingleton<ICommandLineOptions>(_commandLineOptions);
            if (!String.IsNullOrWhiteSpace(_commandLineOptions.LogToFile))
            {
                var sw = new StreamWriter(_commandLineOptions.LogToFile, append: true);
                sw.AutoFlush = true;
                builder.Logging.AddProvider(new CustomFileLoggerProvider(sw));
            }

            services.AddSingleton<IAppFileServer>(sp =>
            {
                var cfg = sp.GetRequiredService<IAppConfiguration>();
                Console.WriteLine("cfg.ContentDirectory = " + cfg.ContentDirectory);
                if (cfg.ContentDirectory.StartsWith("res:"))
                {
                    var result = ActivatorUtilities.CreateInstance<ContentZipAppFileServer>(sp);
                    return result;
                }
                else
                {
                    var result = ActivatorUtilities.CreateInstance<FileSystemAppFileServer>(sp, cfg.ContentDirectory);
                    return result;
                }
            });

            services.AddXCHostSession();

            services.AddSingleton<ICommandableWindowRegistry, CommandableWindowRegistry>();

            _backendServiceSetup.ConfigureServices(services);

            if (!services.Any(sd => sd.ServiceType == typeof(IMemoryHinter)))
            {
                services.AddSingleton<IMemoryHinter, NullMemoryHinter>();
            }

            services.AddHostedService<StyleUpdateWatcher>();

            services.AddSingleton<IEIconFavoriteBlockManager, 
                XarChat.Backend.Features.EIconFavoriteBlockManager.Impl.EIconFavoriteBlockManager>();
        }

        private void SetupXCHostCommandHandlers(IServiceCollection services)
        {
            services.AddSingleton<IXCHostCommandHandlerFactory, XCHostCommandHandlerFactoryImpl>();

            services.AddXCHostCommandHandler<AppReadyCommandHandler>("appReady");
            services.AddXCHostCommandHandler<ShowDevToolsCommandHandler>("showDevTools");
            services.AddXCHostCommandHandler<WinMinimizeCommandHandler>("win.minimize");
            services.AddXCHostCommandHandler<WinMaximizeCommandHandler>("win.maximize");
            services.AddXCHostCommandHandler<WinRestoreCommandHandler>("win.restore");
            services.AddXCHostCommandHandler<WinCloseCommandHandler>("win.close");
            services.AddXCHostCommandHandler<LogChannelMessageCommandHandler>("log.ChannelMessage");
            services.AddXCHostCommandHandler<LogPMConvoMessageCommandHandler>("log.PMConvoMessage");
            services.AddXCHostCommandHandler<EndCharacterSessionCommandHandler>("endCharacterSession");
            services.AddXCHostCommandHandler<UpdateAppBadgeCommandHandler>("updateAppBadge");
            services.AddXCHostCommandHandler<AddIdleMonitorRegistrationCommandHandler>("addIdleMonitorRegistration");
            services.AddXCHostCommandHandler<RemoveIdleMonitorRegistrationCommandHandler>("removeIdleMonitorRegistration");
            services.AddXCHostCommandHandler<AddUpdateCheckerRegistrationCommandHandler>("addUpdateCheckerMonitorRegistration");
            services.AddXCHostCommandHandler<RemoveUpdateCheckerRegistrationCommandHandler>("removeUpdateCheckerMonitorRegistration");
            services.AddXCHostCommandHandler<RelaunchToApplyUpdateCommandHandler>("relaunchToApplyUpdate");
            services.AddXCHostCommandHandler<LoginSuccessCommandHandler>("loginSuccess");
            services.AddXCHostCommandHandler<GetFileDataCommandHandler>("getcssdata");
            services.AddXCHostCommandHandler<GetAllCssCommandHandler>("getallcss");
            services.AddXCHostCommandHandler<GetFileDataCommandHandler>("getsvgdata");
            services.AddXCHostCommandHandler<GetConfigDataCommandHandler>("getconfig");
            services.AddXCHostCommandHandler<SetConfigDataCommandHandler>("setconfig");
            services.AddXCHostCommandHandler<SubmitEIconMetadataCommandHandler>("submiteiconmetadata");
            services.AddXCHostCommandHandler<SetZoomLevelCommandHandler>("setZoomLevel");
            services.AddXCHostCommandHandler<GetMemoCommandHandler>("getMemo");
            services.AddXCHostCommandHandler<GetLocaleListCommandHandler>("getLocales");
            services.AddXCHostCommandHandler<GetAppSettingsCommandHandler>("getAppSettings");
            services.AddXCHostCommandHandler<SetAppSettingsCommandHandler>("setAppSettings");
            services.AddXCHostCommandHandler<FlashWindowCommandHandler>("flashWindow");
        }

        private object _concurrentCountLock = new object();
        private int _concurrentRequestCount = 0;
        private int _concurrentHighwater = 0;

        private void Configure(Action<string> startupLogWriter, WebApplication app)
        {
            try
            {
                app.Use(async (httpContext, next) =>
                {
                    var requestStartAt = DateTimeOffset.UtcNow;
                    httpContext.Items.Add("RequestStartAt", requestStartAt);

                    //lock (_concurrentCountLock)
                    //{
                    //    _concurrentRequestCount++;
                    //    if (_concurrentRequestCount > _concurrentHighwater)
                    //    {
                    //        _concurrentHighwater = _concurrentRequestCount;
                    //        System.Diagnostics.Debug.WriteLine(
                    //            $"[{DateTimeOffset.UtcNow.ToString("R")}] concurrent highwater = {_concurrentHighwater} - {httpContext.Request.Path}");
                    //    }
                    //}
                    //Stopwatch stopwatch = Stopwatch.StartNew();
                    //try
                    //{
                    var requestSW = Stopwatch.StartNew();
                    httpContext.Response.OnStarting(async () =>
                    {
                        requestSW.Stop();
                        httpContext.Response.Headers.Append("X-Backend-Time-To-ResponseStart-MS", requestSW.ElapsedMilliseconds.ToString());
                    });
                    await next(httpContext);
                    //}
                    //finally
                    //{
                    //    lock (_concurrentCountLock)
                    //    {
                    //        _concurrentRequestCount--;
                    //    }
                    //    stopwatch.Stop();
                    //    System.Diagnostics.Debug.WriteLine(
                    //            $"[{DateTimeOffset.UtcNow.ToString("R")}] request took {stopwatch.ElapsedMilliseconds}ms - {httpContext.Request.Path}");
                    //}
                });

                {
                    // initialize chat log
                    startupLogWriter("XarChatBackend.Configure initialing chatlogwriter");
                    var clw = app.Services.GetRequiredService<IChatLogWriter>();
                }

                startupLogWriter("XarChatBackend.Configure calling usewebsockets");
                app.UseWebSockets();

                startupLogWriter("XarChatBackend.Configure mapping /");
                app.MapGet("/", () => "Hello world!");

                startupLogWriter("XarChatBackend.Configure mapping app");
                app.MapGet("/app/{*relPath}", async (
                        HttpContext httpContext,
                        string relPath,
                        CancellationToken cancellationToken) =>
                {
                    try
                    {
                        var afs = httpContext.RequestServices.GetRequiredService<IAppFileServer>();
                        var result = await afs.HandleRequestAsync(relPath, cancellationToken);
                        httpContext.Response.Headers.Add("Cache-Control", "no-cache, no-store");
                        return result;
                    }
                    catch (Exception ex)
                    {
                        return Results.Ok(ex.ToString());
                    }
                });

                startupLogWriter("XarChatBackend.Configure mapping eicon");
                app.UseEIconLoader("/api/eicon");
                startupLogWriter("XarChatBackend.Configure mapping image proxy handler");
                app.UseImageProxyHandler("/api/proxyImageUrl");
                startupLogWriter("XarChatBackend.Configure mapping url launcher");
                app.UseLaunchUrlHandler("/api/launchUrl");
                startupLogWriter("XarChatBackend.Configure mapping chatsocket");
                app.UseChatSocketProxy("/api/chatSocket");
                startupLogWriter("XarChatBackend.Configure mapping flist api proxy");
                app.UseFListApiProxy("/api/flist");
                startupLogWriter("XarChatBackend.Configure mapping xchost");
                app.UseXCHostFunctions("/api/xchost");
                startupLogWriter("XarChatBackend.Configure mapping log handler");
                app.UseLogsHandler("/api/logs");
                startupLogWriter("XarChatBackend.Configure mapping appsettings");
                app.UseFileChooserHandler("/api/localFile");
                startupLogWriter("XarChatBackend.Configure mapping filechooser");
                app.UseAppSettings();
                startupLogWriter("XarChatBackend.Configure windowcommand");
                app.UseWindowCommands();
            }
            catch (Exception ex)
            {
                startupLogWriter("XarChatBackend.Configure unhandled exception: " + ex.ToString());
                throw;
            }
        }

        private X509Certificate2 GetSelfSignedCertificate()
        {
            var password = Guid.NewGuid().ToString();
            var commonName = "MyCommonName";
            var rsaKeySize = 2048;
            var years = 5;
            var hashAlgorithm = HashAlgorithmName.SHA256;

            using (var rsa = RSA.Create(rsaKeySize))
            {
                var request = new CertificateRequest($"cn={commonName}", rsa, hashAlgorithm, RSASignaturePadding.Pkcs1);

                request.CertificateExtensions.Add(
                  new X509KeyUsageExtension(X509KeyUsageFlags.DataEncipherment | X509KeyUsageFlags.KeyEncipherment | X509KeyUsageFlags.DigitalSignature, false)
                );
                request.CertificateExtensions.Add(
                  new X509EnhancedKeyUsageExtension(
                    new OidCollection { new Oid("1.3.6.1.5.5.7.3.1") }, false)
                );

                var certificate = request.CreateSelfSigned(DateTimeOffset.Now.AddDays(-1), DateTimeOffset.Now.AddYears(years));
                //certificate.FriendlyName = commonName;

                // Return the PFX exported version that contains the key
                return new X509Certificate2(
                    certificate.Export(X509ContentType.Pfx, password),
                    password,
                    X509KeyStorageFlags.UserKeySet);
                //X509KeyStorageFlags.MachineKeySet);
            }
        }
    }
}