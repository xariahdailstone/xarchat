using HtmlAgilityPack;
using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Threading.Channels;

namespace XarChat.Backend.Features.ChatLogImport.FChat3
{
    public abstract class ChatLogImporterBase : IChatLogImporter
    {
        private readonly Channel<ChatLogImportWorkflowStep> _presentedStepChannel
            = Channel.CreateBounded<ChatLogImportWorkflowStep>(new BoundedChannelOptions(1)
            {
                FullMode = BoundedChannelFullMode.Wait,
                SingleReader = true,
                SingleWriter = true,
            });

        private readonly Channel<ChatLogImportWorkflowStep> _returnedStepChannel
            = Channel.CreateBounded<ChatLogImportWorkflowStep>(new BoundedChannelOptions(1)
            {
                FullMode = BoundedChannelFullMode.Wait,
                SingleReader = true,
                SingleWriter = true,
            });

        public abstract string ImportSourceName { get; }

        private CancellationToken? _runCancellationToken = null;

        public async IAsyncEnumerable<ChatLogImportWorkflowStep> BeginImportWorkflowAsync(
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            _runCancellationToken = cts.Token;
            var runWorkflowTask = Task.Run(async () =>
            {
                try
                {
                    await RunImportWorkflowAsync(_runCancellationToken.Value);
                }
                catch (Exception ex)
                {
                    // TODO: log the failure reason
                    await ShowMessageAsync(
                        title: "Import Failed",
                        body: $"The import failed with an unexpected error: {ex.Message}",
                        buttons: [
                            new() { Title = "Bummer, Dude", ActionCode = "" }
                        ]);
                }
                finally
                {
                    _presentedStepChannel.Writer.Complete();
                }
            });

            try
            {
                while (true)
                {
                    var pstep = await _presentedStepChannel.Reader.ReadAsync(cancellationToken);
                    yield return pstep;
                    await pstep.WaitForResultAsync(cancellationToken);
                    await _returnedStepChannel.Writer.WriteAsync(pstep, cancellationToken);
                }
            }
            finally
            {
                cts.Cancel();
                try { await runWorkflowTask; }
                catch { }
                _runCancellationToken = null;
            }
        }

        protected abstract Task RunImportWorkflowAsync(CancellationToken cancellationToken);

        protected async Task YieldStep(ChatLogImportWorkflowStep step)
        {
            await _presentedStepChannel.Writer.WriteAsync(step, _runCancellationToken!.Value);
            await _returnedStepChannel.Reader.ReadAsync(_runCancellationToken!.Value);
        }

        protected async Task<string?> ShowMessageAsync(
            string title, string body, List<ChatLogImportWorkflowShowMessageButton> buttons)
        {
            var mstep = new ChatLogImportWorkflowShowMessageStep()
            {
                Title = title,
                Body = body
            };
            mstep.Buttons.AddRange(buttons);

            await YieldStep(mstep);

            return mstep.ClientResponse!.ResultCode;
        }

        protected async Task<string?> ChooseFileAsync(
            string title, string body, List<string> extensions)
        {
            var mstep = new ChatLogImportWorkflowFileChooserStep()
            {
                Title = title,
                Body = body,
                Extensions = extensions
            };

            await YieldStep(mstep);

            return mstep.ClientResponse!.SelectedFilename;
        }

        protected async Task<string?> ChooseDirectoryAsync(
            string title, string body)
        {
            var mstep = new ChatLogImportWorkflowDirectoryChooserStep()
            {
                Title = title,
                Body = body
            };

            await YieldStep(mstep);

            return mstep.SelectedDirectory;
        }

        public async Task<(List<ChannelIdentifier> SelectedChannels, List<PMConversationIdentifier> SelectedPMConversations)> ChooseWhatToImportAsync(
            List<ChannelIdentifier> availableChannels,
            List<PMConversationIdentifier> availablePMConversations)
        {
            var mstep = new ChatLogImportWorkflowChooseWhatToImportStep()
            {
                AvailableChannels = availableChannels,
                AvailablePMConversations = availablePMConversations
            };

            await YieldStep(mstep);

            return (mstep.ClientResponse!.SelectedChannels ?? [], mstep.ClientResponse!.SelectedPMConversations ?? []);
        }

        public async Task RunWithProgressAsync(
            string title,
            string body,
            Func<RunWithProgressArgs, Task> executeAsyncFunc)
        {
            var rwpargs = new RunWithProgressArgs()
            {
                Title = title,
                Body = body,
                CurrentPercentage = 0,
            };
            var runTask = Task.Run(async () =>
            {
                try
                {
                    await executeAsyncFunc(rwpargs);
                }
                finally
                {
                    rwpargs.IsComplete = true;
                }
            });

            while (!rwpargs.IsComplete)
            {
                await rwpargs.WaitForUpdateAsync(_runCancellationToken!.Value);
                var mstep = new ChatLogImportWorkflowShowProgressStep()
                {
                    Title = rwpargs.Title,
                    Body = rwpargs.Body,
                    CurrentPercentage = rwpargs.CurrentPercentage,
                };
                await YieldStep(mstep);
            }
        }
    }

    public class RunWithProgressArgs
    {
        public required string Title 
        {
            get;
            set
            {
                if (value != field)
                {
                    field = value;
                    _currentCTS.Cancel();
                }
            }
        }

        public required string Body
        {
            get;
            set
            {
                if (value != field)
                {
                    field = value;
                    _currentCTS.Cancel();
                }
            }
        }

        public required int CurrentPercentage 
        {
            get;
            set
            {
                if (value != field)
                {
                    field = value;
                    _currentCTS.Cancel();
                }
            }
        }

        internal bool IsComplete { get; set; } = false;


        private CancellationTokenSource _currentCTS = new CancellationTokenSource();

        internal async Task WaitForUpdateAsync(CancellationToken cancellationToken)
        {
            try
            {
                using var combinedCTS = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                await Task.Delay(-1, combinedCTS.Token);
            }
            catch when (_currentCTS.IsCancellationRequested) 
            {
                _currentCTS = new CancellationTokenSource();
            }
        }
    }

    internal class FChat3ChatLogImporter : ChatLogImporterBase
    {
        private string AppName => "F-Chat 3.0";

        public override string ImportSourceName => $"{AppName}";

        protected override async Task RunImportWorkflowAsync(
            CancellationToken cancellationToken)
        {
            await ShowMessageAsync(
                title: $"{AppName} Log Importer",
                body: $@"This importer will walk you through importing your chat logs from
                        the {AppName} application into XarChat.  You will be walked through
                        the following steps:

                        [list][*][b]Finding your {AppName} logs directory[/b]
                        [*][b]Confirming which logs you want to import[/b][/list]

                        After performing this import, your selected logs will be imported into XarChat.  [b]Your
                        logs will not be removed from {AppName}.[/b]",
                buttons: [
                    new() { Title = "Continue", ActionCode = "OK" }
                ]);

            var logDirectory = await GetLogDirectoryAsync();
            if (logDirectory == null) { return; }

            // TODO:
            var foundChannels = new List<ChannelIdentifier>();
            var foundPMConversations = new List<PMConversationIdentifier>();

            var (selectedChannels, selectedPMConversations) = await ChooseWhatToImportAsync(foundChannels, foundPMConversations);

            var itemCount = selectedChannels.Count + selectedPMConversations.Count;
            if (itemCount > 0)
            {
                await RunWithProgressAsync(
                    title: "Importing Logs",
                    body: "Please wait, importing your logs...",
                    executeAsyncFunc: async (args) =>
                    {
                        var itemsDone = 0;
                        void AddDoneItem()
                        {
                            itemsDone++;
                            var pctDone = (int)Math.Truncate((double)itemsDone / (double)itemCount);
                            args.CurrentPercentage = pctDone;
                        }

                        
                        foreach (var channel in selectedChannels)
                        {
                            await ImportChannelAsync(logDirectory, channel.ChannelName, channel.ChannelTitle, cancellationToken);
                            AddDoneItem();
                        }
                        foreach (var pmConvo in selectedPMConversations)
                        {
                            await ImportPMConversationAsync(logDirectory, pmConvo.MyCharacterName, pmConvo.InterlocutorCharacterName, cancellationToken);
                            AddDoneItem();
                        }
                    });

                await ShowMessageAsync(
                    title: "Import Complete!",
                    body: "Your logs have been imported!",
                    buttons: [
                        new() { Title = "Finish", ActionCode = "" }
                    ]);
                return;
            }
            else
            {
                await ShowMessageAsync(
                    title: "Nothing To Import",
                    body: "You didn't select anything to import, so nothing was imported.",
                    buttons: [
                        new() { Title = "Finish", ActionCode = "" }
                    ]);
                return;
            }
        }

        private async Task ImportChannelAsync(string logDirectory, string? channelName, string? channelTitle, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        private async Task ImportPMConversationAsync(string logDirectory, string myCharacterName, string interlocutorCharacterName, CancellationToken cancellationToken)
        {
            throw new NotImplementedException();
        }

        private async Task<string?> GetLogDirectoryAsync()
        {
            try
            {
                var isWindows = true;
                var isMacos = false;
                var isLinux = false;

                string? settingsFileName = null;
                string? logDirectory = null;

                if (isWindows)
                {
                    var settingsFilePath = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "fchat", "data");
                    settingsFileName = Path.Combine(settingsFilePath, "settings");
                }
                else
                {
                    throw new ApplicationException("don't know how to get default dir on this platform");
                }

                if (settingsFileName != null && File.Exists(settingsFileName))
                {
                    using var f = File.OpenText(settingsFileName);
                    var jsonStr = await f.ReadToEndAsync()!;
                    var jsonObj = JsonSerializer.Deserialize(jsonStr, FChat3LogImporterJsonSerializerContext.Default.JsonObject)!;
                    if (jsonObj["logDirectory"] != null)
                    {
                        logDirectory = (string)jsonObj["logDirectory"]!;
                    }
                    else
                    {
                        logDirectory = Path.GetDirectoryName(settingsFileName);
                    }
                }

                if (logDirectory != null)
                {
                    var confirmResult = await ShowMessageAsync(
                        title: "Confirm Log Directory",
                        body: $"Your log directory for F-Chat 3.0 was detected to be:\n\n[noparse]{logDirectory}[/noparse]\n\nIs this correct?",
                        buttons: [
                            new() {
                                Title = "Yes",
                                ActionCode = "yes"
                            },
                            new() {
                                Title = "No, Choose Another",
                                ActionCode = "no"
                            },
                        ]);
                    if (confirmResult == "yes")
                    {
                        return logDirectory;
                    }
                }
            }
            catch { }

            var selectedDir = await ChooseDirectoryAsync(
                title: "Select Log Directory",
                body: "Your F-Chat 3.0 log directory could not be automatically identified.  Please choose its location.");

            // TODO: verify this directory has at least one valid character subdirectory

            return selectedDir;
        }
    }

    [JsonSerializable(typeof(JsonObject))]
    public partial class FChat3LogImporterJsonSerializerContext : JsonSerializerContext
    { }
}
