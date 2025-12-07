using System.Collections.Concurrent;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Channels;
using XarChat.Backend.Bridge1to2.Messages.Client;
using XarChat.Backend.Bridge1to2.Messages.Server;
using XarChat.Backend.Bridge1to2.StrongTypes;
using XarChat.FList2.Common.StrongTypes;
using XarChat.FList2.FList2Api;
using XarChat.FList2.FList2Api.Entities;
using XarChat.FList2.FList2Api.Implementation.Firehose;
using XarChat.FList2.FList2Api.Implementation.Firehose.Messages;
using XarChat.FList2.FList2Api.Implementation.Firehose.Messages.Incoming;
using XarChat.FList2.FList2Api.Implementation.Firehose.Messages.Outgoing;

namespace XarChat.Backend.Bridge1to2.Implementation
{
    internal class DefaultBridgeConnection : IBridgeConnection
    {
        private static IReadOnlyDictionary<Type, ClientMessageHandler> ClientMessageHandlers
            = (new List<ClientMessageHandler>
            {
                new ClientMessageHandler<CHAClientMessage>((bc, cmpargs, msg) => bc.HandleClientCHAAsync(cmpargs, msg)),
                new ClientMessageHandler<JCHClientMessage>((bc, cmpargs, msg) => bc.HandleClientJCHAsync(cmpargs, msg)),
                new ClientMessageHandler<LCHClientMessage>((bc, cmpargs, msg) => bc.HandleClientLCHAsync(cmpargs, msg)),
                new ClientMessageHandler<MSGClientMessage>((bc, cmpargs, msg) => bc.HandleClientMSGAsync(cmpargs, msg)),
                new ClientMessageHandler<ORSClientMessage>((bc, cmpargs, msg) => bc.HandleClientORSAsync(cmpargs, msg)),
                new ClientMessageHandler<PRIClientMessage>((bc, cmpargs, msg) => bc.HandleClientPRIAsync(cmpargs, msg)),
                new ClientMessageHandler<STAClientMessage>((bc, cmpargs, msg) => bc.HandleClientSTAAsync(cmpargs, msg)),
                new ClientMessageHandler<TPNClientMessage>((bc, cmpargs, msg) => bc.HandleClientTPNAsync(cmpargs, msg)),
                new ClientMessageHandler<XPMClientMessage>((bc, cmpargs, msg) => bc.HandleClientXPMAsync(cmpargs, msg)),
                new ClientMessageHandler<XSNClientMessage>((bc, cmpargs, msg) => bc.HandleClientXSNAsync(cmpargs, msg)),

            }).ToDictionary(h => h.ClientMessageType, h => h);

        private static IReadOnlyDictionary<Type, FirehoseMessageHandler> FirehoseMessageHandlers
            = (new List<FirehoseMessageHandler>
            {
                new FirehoseMessageHandler<ChannelMessageReceived>((bc, cmpargs, msg) => bc.HandleChannelMessageReceivedAsync(cmpargs, msg)),
                new FirehoseMessageHandler<PMConvoMessageReceived>((bc, cmpargs, msg) => bc.HandlePMConvoMessageReceivedAsync(cmpargs, msg)),
                new FirehoseMessageHandler<CharacterJoinedChannel>((bc, cmpargs, msg) => bc.HandleCharacterJoinedChannelAsync(cmpargs, msg)),
                new FirehoseMessageHandler<CharacterLeftChannel>((bc, cmpargs, msg) => bc.HandleCharacterLeftChannelAsync(cmpargs, msg)),
                new FirehoseMessageHandler<CharacterPresenceChanged>((bc, cmpargs, msg) => bc.HandleCharacterPresenceChangedAsync(cmpargs, msg)),
                new FirehoseMessageHandler<PMConvoHasUnreadMessage>((bc, cmpargs, msg) => bc.HandlePMConvoHasUnreadMessageAsync(cmpargs, msg)),

            }).ToDictionary(h => h.FirehoseMessageType, h => h);

        private readonly Channel<FChatClientMessage> _incomingClientMessagesChannel = Channel.CreateUnbounded<FChatClientMessage>();
        private readonly Channel<FChatServerMessage> _outgoingServerMessagesChannel = Channel.CreateUnbounded<FChatServerMessage>();

        private readonly CancellationTokenSource _disposeCTS = new CancellationTokenSource();
        private readonly Task _processLoopTask;

        public DefaultBridgeConnection(DefaultBridge1to2Manager manager)
        {
            this.DefaultBridge1to2Manager = manager;
            _processLoopTask = RunProcessLoopAsync(_disposeCTS.Token);
        }

        public DefaultBridge1to2Manager DefaultBridge1to2Manager { get; }

        public async ValueTask DisposeAsync()
        {
            if (!_disposeCTS.IsCancellationRequested)
            {
                _disposeCTS.Cancel();
                await _processLoopTask;
                await DefaultBridge1to2Manager.ConnectionClosedAsync(this);
            }
        }

        private async Task RunProcessLoopAsync(CancellationToken cancellationToken)
        {
            try
            {
                await RunProcessLoopInternalAsync(cancellationToken);
            }
            catch when (cancellationToken.IsCancellationRequested) { }
            catch (Exception ex)
            {
                Console.WriteLine(ex.ToString());
                throw;
            }
            finally
            {
                _outgoingServerMessagesChannel.Writer.Complete();
            }
        }

        //private class BridgedChannelInfo
        //{
        //    public required ChannelId FList2ChannelId { get; set; }

        //    public required ChannelName FList2ChannelName { get; set; }

        //    public required string FList1ChannelName { get; }

        //    public required string FList1ChannelTitle { get; set; }

        //    public required string ChannelDescription { get; set; }
        //}

        //private readonly SemaphoreSlim _bridgedChannelInfosSem = new SemaphoreSlim(1);
        //private readonly List<BridgedChannelInfo> _bridgedChannelInfos = new List<BridgedChannelInfo>();

        private readonly BridgedChannelInfoCollection _bridgedChannelInfoCollection = new BridgedChannelInfoCollection();
        private readonly BridgedCharacterInfoCollection _bridgedCharacterInfoCollection = new BridgedCharacterInfoCollection();

        //private readonly SemaphoreSlim _channelIdToTitleSem = new SemaphoreSlim(1);
        //private Dictionary<ChannelId, ChannelName> _channelIdToTitle = new Dictionary<ChannelId, ChannelName>();

        private async Task RunProcessLoopInternalAsync(CancellationToken cancellationToken)
        {
            async Task WriteMessageFunc(FChatServerMessage message, CancellationToken cancellationToken) =>
                await _outgoingServerMessagesChannel.Writer.WriteAsync(message, cancellationToken);

            async Task<FChatClientMessage> ReadMessageFunc(CancellationToken cancellationToken) =>
                await _incomingClientMessagesChannel.Reader.ReadAsync(cancellationToken);

            var loginRes = await TryHandleIncomingLoginAsync(cancellationToken);
            if (loginRes is null)
            {
                await WriteMessageFunc(ServerError.InvalidIDNMessage.ERRMessage, cancellationToken);
                return;
            }
            await using var apiRefUsing = loginRes.Value.ApiRef;
            var api = loginRes.Value.ApiRef.FList2Api;
            var apiFirehose = api.Firehose;
            var myCharacterName = loginRes.Value.CharacterName;

            List<ChatEnabledCharacters> chatEnabledChars;
            {
                chatEnabledChars = await api.GetChatEnabledCharactersAsync(cancellationToken).AsAsyncEnumerable(cancellationToken).ToListAsync(cancellationToken);
                if (!chatEnabledChars.Where(cec => cec.CharacterName == myCharacterName).Any())
                {
                    var newCharList = chatEnabledChars.Select(c => c.CharacterId).ToList();
                    var userChars = await api.GetUserCharacters(cancellationToken);
                    var cid = userChars.CharacterList.Where(c => c.CharacterName == myCharacterName).First().Id;
                    newCharList.Add(cid);
                    await api.SetChatEnabledCharactersAsync(new SetChatEnabledCharactersArgs()
                    {
                        ChatEnabledCharacterIdList = newCharList
                    }, cancellationToken);

                    chatEnabledChars = await api.GetChatEnabledCharactersAsync(cancellationToken).AsAsyncEnumerable(cancellationToken).ToListAsync(cancellationToken);
                }
            }
            var chatEnabledChar = chatEnabledChars
                .Where(cec => cec.CharacterName == myCharacterName)
                .FirstOrDefault();
            if (chatEnabledChar is null)
            {
                await WriteMessageFunc(ServerError.CharNotChatEnabled.ERRMessage, cancellationToken);
                return;
            }

            myCharacterName = chatEnabledChar.CharacterName;
            var myCharacterId = chatEnabledChar.CharacterId;
            var myGenderColor = chatEnabledChar.GenderColor;
            var myAvatarPath = chatEnabledChar.AvatarUrlPath;

            await _outgoingServerMessagesChannel.Writer.WriteAsync(new IDNServerMessage()
            {
                Character = myCharacterName
            }, cancellationToken);

            using var loopsCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);

            var cargs = new ClientMessageProcessingArgs(
                api, apiFirehose, myCharacterId, myCharacterName, myGenderColor, myAvatarPath,
                WriteMessageFunc, loopsCts.Token);

            _bridgedCharacterInfoCollection.SetClientMessageProcessingArgs(cargs);

            await OutputInitialConnectionMessagesAsync(
                api, 
                chatEnabledChar.CharacterId,
                myCharacterName, 
                CharacterGender.Parse(chatEnabledChar.GenderColor),
                WriteMessageFunc,
                cancellationToken);

            var loopTasks = new List<Task>()
            {
                RunFirehoseReceiveLoopAsync(cargs),
                RunClientMessageProcessLoopAsync(cargs, ReadMessageFunc)
            };

            try
            {
                await Task.WhenAny(loopTasks);
            }
            finally
            {
                loopsCts.Cancel();
                await Task.WhenAll(loopTasks);
            }
        }

        private async Task RunClientMessageProcessLoopAsync(
            ClientMessageProcessingArgs cargs,
            Func<CancellationToken, Task<FChatClientMessage>> readMessageFunc)
        {
            try
            {
                while (!cargs.CancellationToken.IsCancellationRequested)
                {
                    var msg = await readMessageFunc(cargs.CancellationToken);

                    if (ClientMessageHandlers.TryGetValue(msg.GetType(), out var handlerFunc))
                    {
                        await handlerFunc.OnMessageFunc(this, cargs, msg);
                    }
                    else if (msg is UnknownClientMessage ucmMsg)
                    {
                        await cargs.WriteMessageFunc(new SYSServerMessage()
                        {
                            Message = $"Unhandled client message: {ucmMsg.Code}"
                        }, cargs.CancellationToken);
                    }
                    else
                    {
                        await cargs.WriteMessageFunc(new SYSServerMessage()
                        {
                            Message = $"Unhandled client message: {msg.GetType().Name}"
                        }, cargs.CancellationToken);
                    }
                }
            }
            catch when (cargs.CancellationToken.IsCancellationRequested) { }
        }

        private async Task HandleClientXPMAsync(ClientMessageProcessingArgs args, XPMClientMessage xpmMsg)
        {
            if (xpmMsg.Action == PMConversationAction.Opened)
            {
                var needOpenSentToServer = true;
                if (_bridgedCharacterInfoCollection.TryGetBridgedCharacterInfo(xpmMsg.Character, out var bci))
                {
                    needOpenSentToServer = !bci.HasOpenPMConversation;
                    bci.HasOpenPMConversation = true;
                }
                else
                {
                    bci = await GetOrCreateBridgedCharacterInfoByCharacterName(args.FList2Api, xpmMsg.Character, args.CancellationToken);
                    needOpenSentToServer = true;
                    bci.HasOpenPMConversation = true;
                }

                if (needOpenSentToServer)
                {
                    await args.FList2Api.OpenChatPMConversationAsync(new OpenChatPMConversationArgs()
                    {
                        AuthorId = args.MyCharacterId,
                        RecipientId = bci.CharacterId
                    }, args.CancellationToken);
                }
            }
            else
            {
                var needCloseSentToServer = true;
                if (_bridgedCharacterInfoCollection.TryGetBridgedCharacterInfo(xpmMsg.Character, out var bci))
                {
                    needCloseSentToServer = bci.HasOpenPMConversation;
                    bci.HasOpenPMConversation = false;
                }
                else
                {
                    needCloseSentToServer = false;
                }

                if (needCloseSentToServer)
                {
                    await args.FList2Api.CloseChatPMConversationAsync(new CloseChatPMConversationArgs()
                    {
                        AuthorId = args.MyCharacterId,
                        RecipientId = bci!.CharacterId
                    }, args.CancellationToken);
                }
            }
        }

        private async Task HandleClientXSNAsync(ClientMessageProcessingArgs args, XSNClientMessage xsnMsg)
        {
            if (xsnMsg.TabIdentifier.StartsWith("ch:"))
            {
                FL1ChannelName f1cn = FL1ChannelName.Create(xsnMsg.TabIdentifier.Substring(3));
                if (_bridgedChannelInfoCollection.TryGetBridgedChannelInfo(f1cn, out var bci))
                {
                    // TODO: API remove channel unread notification
                }
            }
            else if (xsnMsg.TabIdentifier.StartsWith("pm:"))
            {
                CharacterName cn = CharacterName.Create(xsnMsg.TabIdentifier.Substring(3));
                await args.FList2Api.RemoveChatPMConversationUnread(new PMConversationUnreadResponseItem()
                {
                    CharacterId = args.MyCharacterId,
                    Character1Id = args.MyCharacterId,
                    Character2Id = await GetCharacterIdFromCharacterNameAsync(args.FList2Api, cn, args.CancellationToken)
                }, args.CancellationToken);
            }
        }

        private async Task<BridgedCharacterInfo> UpdateBridgedCharacterInfoAsync(
            CharacterId id, CharacterName name, string? genderColor, string? avatarUrlPath, 
            CharacterStatus? characterStatus, string? statusMessage, CancellationToken cancellationToken)
        {
            if (!_bridgedCharacterInfoCollection.TryGetBridgedCharacterInfo(id, out var bci))
            {
                bci = new BridgedCharacterInfo(
                    characterId: id,
                    characterName: name,
                    genderColor: genderColor,
                    avatarUrlPath: avatarUrlPath,
                    characterStatus: characterStatus ?? CharacterStatus.OFFLINE,
                    statusMessage: statusMessage);
                await _bridgedCharacterInfoCollection.AddAsync(bci, cancellationToken);
            }
            else
            {
                await bci.UpdateDataAsync(
                    name,
                    genderColor ?? bci.GenderColor,
                    avatarUrlPath ?? bci.AvatarUrlPath,
                    characterStatus ?? bci.CharacterStatus,
                    statusMessage ?? bci.StatusMessage,
                    cancellationToken);
            }
            return bci;
        }

        private async ValueTask<CharacterId> GetCharacterIdFromCharacterNameAsync(
            IFList2Api api,
            CharacterName characterName, CancellationToken cancellationToken)
        {
            if (_bridgedCharacterInfoCollection.TryGetBridgedCharacterInfo(characterName, out var bci))
            {
                return bci.CharacterId;
            }
            else
            {
                // TODO: get from API?
                throw new NotImplementedException();
            }
        }

        private async Task HandleClientTPNAsync(ClientMessageProcessingArgs args, TPNClientMessage tpnMsg)
        {
            if (tpnMsg.Character == args.MyCharacterName)
            {
                await args.WriteMessageFunc(new TPNServerMessage()
                {
                    Character = args.MyCharacterName,
                    Status = tpnMsg.Status
                }, args.CancellationToken);
            }
        }

        private async Task HandleClientJCHAsync(ClientMessageProcessingArgs args, JCHClientMessage jchMsg)
        {
            if (_bridgedChannelInfoCollection.TryGetBridgedChannelInfo(jchMsg.Channel, out var bci) && !bci.WeAreInChannel)
            {
                await args.FList2Api.JoinChannelAsync(new JoinChannelArgs()
                {
                    CharacterId = args.MyCharacterId,
                    ChannelId = bci.FL2ChannelId
                }, args.CancellationToken);

                await ReenumerateJoinedChannelsAsync(args);
            }
            else
            {
                // TODO: maybe try to re-get channel list?
                await args.WriteMessageFunc(ServerError.UnknownFL2Channel.ERRMessage, args.CancellationToken);
            }
        }

        private async Task HandleClientLCHAsync(ClientMessageProcessingArgs args, LCHClientMessage lchMsg)
        {
            if (_bridgedChannelInfoCollection.TryGetBridgedChannelInfo(lchMsg.Channel, out var bci) && bci.WeAreInChannel)
            {
                await args.FList2Api.LeaveChannelAsync(new LeaveChannelArgs()
                {
                    ChannelId = bci.FL2ChannelId,
                    CharacterId = args.MyCharacterId
                }, args.CancellationToken);
                bci.WeAreInChannel = false;

                await args.WriteMessageFunc(new LCHServerMessage()
                {
                    Channel = lchMsg.Channel,
                    Character = args.MyCharacterName
                }, args.CancellationToken);
            }
            else
            {
                // TODO: maybe try to re-get channel list?
                await args.WriteMessageFunc(ServerError.UnknownFL2Channel.ERRMessage, args.CancellationToken);
            }
        }

        private async Task HandleClientMSGAsync(ClientMessageProcessingArgs args, MSGClientMessage msgMsg)
        {
            if (_bridgedChannelInfoCollection.TryGetBridgedChannelInfo(msgMsg.Channel, out var bci))
            {
                var scm = new SendChannelMessage()
                {
                    Author = new CharacterInfo()
                    {
                        Id = args.MyCharacterId,
                        Name = args.MyCharacterName,
                        AvatarPath = args.MyAvatarPath
                    },
                    ChannelId = bci.FL2ChannelId,
                    ChannelName = bci.FL2ChannelName,
                    GenderColor = args.MyGenderColor,
                    IsMeMessage = msgMsg.Message.StartsWith("/me "),
                    Body = msgMsg.Message.StartsWith("/me ") ? msgMsg.Message.Substring(3) : msgMsg.Message,
                };
                await args.Firehose.WriteAsync(scm, args.CancellationToken);
            }
        }

        private async Task<BridgedCharacterInfo> GetOrCreateBridgedCharacterInfoByCharacterName(
            IFList2Api api, CharacterName characterName, CancellationToken cancellationToken)
        {
            if (!_bridgedCharacterInfoCollection.TryGetBridgedCharacterInfo(characterName, out var bci))
            {
                var profileResp = await api.GetCharacterProfileAsync(new GetCharacterProfileArgs()
                {
                    CharacterName = characterName
                }, cancellationToken);

                bci = new BridgedCharacterInfo(
                    characterId: profileResp.CharacterId,
                    characterName: profileResp.CharacterName,
                    avatarUrlPath: profileResp.BasicDetails.AvatarPath,
                    genderColor: CharacterGender.Parse(profileResp.ProfileAttributeHighlights.Where(h => h.AttributeName == "Gender").First().AttributeValue).GenderColor
                );
                await _bridgedCharacterInfoCollection.AddAsync(bci, cancellationToken);
            }
            return bci;
        }

        private async Task HandleClientPRIAsync(ClientMessageProcessingArgs args, PRIClientMessage priMsg)
        {
            var bci = await GetOrCreateBridgedCharacterInfoByCharacterName(args.FList2Api, priMsg.Recipient, args.CancellationToken);

            var smsg = new SendPrivateMessageMessage()
            {
                Author = new CharacterInfo()
                {
                    Id = args.MyCharacterId,
                    Name = args.MyCharacterName,
                    AvatarPath = args.MyAvatarPath,
                },
                Recipient = new CharacterInfo()
                {
                    Id = bci.CharacterId,
                    Name = bci.CharacterName,
                    AvatarPath = bci.AvatarUrlPath ?? ""  // TODO: use default value
                },
                Body = priMsg.Message.StartsWith("/me ") ? priMsg.Message.Substring(4) : priMsg.Message,
                IsMeMessage = priMsg.Message.StartsWith("/me "),
                GenderColor = args.MyGenderColor,
                Type = "SELF_AUTHORED"
            };
            await args.Firehose.WriteAsync(smsg, args.CancellationToken);
        }

        private async Task HandleClientCHAAsync(ClientMessageProcessingArgs cargs, CHAClientMessage orsMsg)
        {
            var cancellationToken = cargs.CancellationToken;

            var chanListResp = await cargs.FList2Api.GetChannelListAsync(new GetChannelListArgs()
            {
                ChannelListType = ChannelListType.OfficialChannels
            }, cancellationToken);

            var respMsg = new CHAServerMessage()
            {
                Channels = chanListResp.List.Select(cli =>
                {
                    var bci = ProcessChannelListItem(cli, true);

                    return new CHAOfficialChannelItem()
                    {
                        Name = bci.FL1ChannelName,
                        Mode = ChannelMode.Chat,
                        Characters = cli.ActiveCharacterCount
                    };
                }).ToList()
            };
            await cargs.WriteMessageFunc(respMsg, cancellationToken);
        }

        private async Task HandleClientSTAAsync(ClientMessageProcessingArgs cargs, STAClientMessage staMsg)
        {
            var args = new ChangeCharacterPresenceArgs()
            {
                CharacterId = cargs.MyCharacterId,
                Status = staMsg.Status.ToFL2CharacterStatus(),
                StatusMessage = staMsg.StatusMessage ?? ""
            };
            await cargs.FList2Api.ChangeChatCharacterPresenceAsync(args, cargs.CancellationToken);
        }

        private async Task HandleClientORSAsync(ClientMessageProcessingArgs cargs, ORSClientMessage orsMsg)
        {
            var cancellationToken = cargs.CancellationToken;

            var chanListResp = await cargs.FList2Api.GetChannelListAsync(new GetChannelListArgs()
            {
                ChannelListType = ChannelListType.PrivateOpenChannels
            }, cancellationToken);

            var respMsg = new ORSServerMessage()
            {
                Channels = chanListResp.List.Select(cli =>
                {
                    var bci = ProcessChannelListItem(cli, false);

                    return new ORSPrivateChannelItem()
                    {
                        Name = bci.FL1ChannelName,
                        Title = bci.FL1ChannelTitle,
                        Characters = cli.ActiveCharacterCount
                    };
                }).ToList()
            };
            await cargs.WriteMessageFunc(respMsg, cancellationToken);
        }

        private async Task RunFirehoseReceiveLoopAsync(
            ClientMessageProcessingArgs cargs)
        {
            try
            {
                while (!cargs.CancellationToken.IsCancellationRequested)
                {
                    var fhIncomingMsg = await cargs.Firehose.ReadAsync(cargs.CancellationToken);
                    if (fhIncomingMsg is null)
                    {
                        break;
                    }
                    else if (FirehoseMessageHandlers.TryGetValue(fhIncomingMsg.GetType(), out var handler))
                    {
                        await handler.OnMessageFunc(this, cargs, fhIncomingMsg);
                    }
                    else
                    {
                        await cargs.WriteMessageFunc(new SYSServerMessage()
                        {
                            Message = $"Unhandled Firehose Message Received: {fhIncomingMsg.GetType().Name}"
                        }, cargs.CancellationToken);
                    }
                }
            }
            catch when (cargs.CancellationToken.IsCancellationRequested) { }
        }

        private async Task HandleChannelMessageReceivedAsync(ClientMessageProcessingArgs args, ChannelMessageReceived msg)
        {
            if (_bridgedChannelInfoCollection.TryGetBridgedChannelInfo(msg.ChannelId, out var bci) && bci.WeAreInChannel)
            {
                await args.WriteMessageFunc(new MSGServerMessage()
                {
                    Character = msg.Author.Name,
                    Channel = bci.FL1ChannelName,
                    Message = msg.IsMeMessage ? $"/me {msg.Body}" : msg.Body
                }, args.CancellationToken);
            }
        }

        private async Task HandlePMConvoMessageReceivedAsync(ClientMessageProcessingArgs args, PMConvoMessageReceived msg)
        {
            // Skip messages pertaining to other characters on our account
            if (msg.Author.Name != args.MyCharacterName && msg.Recipient.Name != args.MyCharacterName) { return; }

            var interlocutor = msg.Author.Name != args.MyCharacterName
                ? msg.Author
                : msg.Recipient;

            if (msg.Type == "RECIPIENT_AUTHORED") // this means this message is for *receiving* a private message
            {
                if (msg.Recipient.Name != args.MyCharacterName) { return; }

                await args.WriteMessageFunc(new PRIServerMessage()
                {
                    Character = interlocutor.Name,
                    Message = msg.IsMeMessage ? $"/me {msg.Body}" : msg.Body,
                    Recipient = args.MyCharacterName
                }, args.CancellationToken);
            }
            else if (msg.Type == "SELF_AUTHORED") // this means the message is for *sending* a private message
            {
                if (msg.Author.Name != args.MyCharacterName) { return; }

                if (_bridgedCharacterInfoCollection.TryGetBridgedCharacterInfo(msg.Author.Name, out var bci))
                {
                    await args.WriteMessageFunc(new XHMServerMessage()
                    {
                        Channel = "pm:" + interlocutor.Name.Value,
                        Character = bci.CharacterName,
                        CharacterGender = CharacterGender.Parse(bci.GenderColor ?? CharacterGender.UnknownGenderColor),
                        CharacterStatus = bci.CharacterStatus.ToFL1CharacterStatus(),
                        Seen = true,
                        MessageType = "MSG",
                        Message = msg.IsMeMessage ? $"/me {msg.Body}" : msg.Body
                    }, args.CancellationToken);
                }
            }
        }

        private async Task HandlePMConvoHasUnreadMessageAsync(ClientMessageProcessingArgs args, PMConvoHasUnreadMessage msg)
        {
            var interlocutorCharacterId = msg.PrivateChatId.Character1Id != args.MyCharacterId
                ? msg.PrivateChatId.Character1Id
                : msg.PrivateChatId.Character2Id;
            if (_bridgedCharacterInfoCollection.TryGetBridgedCharacterInfo(interlocutorCharacterId, out var bci))
            {
                await args.WriteMessageFunc(new XPUServerMessage()
                {
                    Recipient = bci.CharacterName,
                    HasUnread = false
                }, args.CancellationToken);
            }
        }

        private async Task HandleCharacterLeftChannelAsync(ClientMessageProcessingArgs args, CharacterLeftChannel msg)
        {
            if (_bridgedChannelInfoCollection.TryGetBridgedChannelInfo(msg.ChannelId, out var bci) && bci.WeAreInChannel)
            {
                foreach (var tch in msg.Characters)
                {
                    await args.WriteMessageFunc(new LCHServerMessage()
                    {
                        Channel = bci.FL1ChannelName,
                        Character = tch.CharacterName
                    }, args.CancellationToken);
                }
            }
        }

        private async Task HandleCharacterJoinedChannelAsync(ClientMessageProcessingArgs args, CharacterJoinedChannel msg)
        {
            if (_bridgedChannelInfoCollection.TryGetBridgedChannelInfo(msg.ChannelId, out var bci) && bci.WeAreInChannel)
            {
                if (bci.WeAreInChannel)
                {
                    foreach (var tch in msg.Characters)
                    {
                        await args.WriteMessageFunc(new JCHServerMessage()
                        {
                            Channel = bci!.FL1ChannelName,
                            Title = bci is not null ? bci.FL1ChannelTitle : FL1ChannelTitle.Create(""),
                            Character = new CharacterIdentity() { Identity = tch.CharacterName }
                        }, args.CancellationToken);
                    }
                }
                else
                {
                    // We just joined the channel from another client, re-enumerate the joined channels list.
                    await ReenumerateJoinedChannelsAsync(args);
                }
            }
            else
            {
                // We just joined a channel we have no current knowledge of, re-enumerate the joined channels list.
                await ReenumerateJoinedChannelsAsync(args);
            }
        }

        private async Task HandleCharacterPresenceChangedAsync(ClientMessageProcessingArgs args, CharacterPresenceChanged msg)
        {
            foreach (var cinfo in msg.List)
            {
                if (_bridgedCharacterInfoCollection.TryGetBridgedCharacterInfo(cinfo.CharacterId, out var bci))
                {
                    await bci.UpdateDataAsync(
                        statusMessage: cinfo.StatusMessage ?? "",
                        characterStatus: cinfo.PublicStatusView.Status is not null
                            ? CharacterStatus.Parse(cinfo.PublicStatusView.Status)
                            : CharacterStatus.OFFLINE);
                }
            }
        }

        private const string FL1ChannelNamePrefix = "FL2ID-";

        private static FL1ChannelName FL2ChannelIdToFL1ChannelName(ChannelId channelId)
        {
            return FL1ChannelName.Create($"{FL1ChannelNamePrefix}{channelId}");
        }

        private static ChannelId ParseFL2ChannelIdFromFL1ChannelName(FL1ChannelName fl1ChannelName)
        {
            return ChannelId.Create(fl1ChannelName.Value.Substring(FL1ChannelNamePrefix.Length));
        }

        private BridgedChannelInfo ProcessChannelListItem(GetChannelListResponseItem item, bool isOfficialChannel)
        {
            if (_bridgedChannelInfoCollection.TryGetBridgedChannelInfo(item.Id, out var bci))
            {
                bci.FL2ChannelId = item.Id;
                bci.FL2ChannelName = item.Name;
                bci.FL1ChannelName = isOfficialChannel ? FL1ChannelName.Create(item.Name.Value) : FL2ChannelIdToFL1ChannelName(item.Id);
                bci.FL1ChannelTitle = FL1ChannelTitle.Create(item.Name.Value);
                bci.Description = item.Description ?? "";
            }
            else
            {
                bci = new BridgedChannelInfo()
                {
                    FL2ChannelId = item.Id,
                    FL2ChannelName = item.Name,
                    FL1ChannelName = isOfficialChannel ? FL1ChannelName.Create(item.Name.Value) : FL2ChannelIdToFL1ChannelName(item.Id),
                    FL1ChannelTitle = FL1ChannelTitle.Create(item.Name.Value),
                    Description = item.Description ?? "",
                    WeAreInChannel = false
                };
                _bridgedChannelInfoCollection.Add(bci);
            }
            return bci;
        }

        private async Task ReenumerateJoinedChannelsAsync(ClientMessageProcessingArgs cargs)
        {
            // TODO: add logic to find channels we think we're in but not anymore, so we can simulate an LCH for them

            var cancellationToken = cargs.CancellationToken;
            var api = cargs.FList2Api;
            var myCharacterId = cargs.MyCharacterId;
            var myCharacterName = cargs.MyCharacterName;
            var writeMessageFunc = cargs.WriteMessageFunc;

            var openChansResp = await api.GetChatJoinedChannelsAsync(cancellationToken);
            foreach (var charOpenChanInfo in openChansResp.Items.Where(oci => oci.CharacterId == myCharacterId))
            {
                foreach (var openChanInfo in charOpenChanInfo.OpenChannels)
                {
                    var needJCH = false;

                    if (_bridgedChannelInfoCollection.TryGetBridgedChannelInfo(openChanInfo.ChannelId, out var bci))
                    {
                        bci.FL2ChannelName = openChanInfo.ChannelName;
                        needJCH = !bci.WeAreInChannel;
                        bci.WeAreInChannel = true;
                    }
                    else
                    {
                        bci = new BridgedChannelInfo()
                        {
                            FL2ChannelId = openChanInfo.ChannelId,
                            FL2ChannelName = openChanInfo.ChannelName,
                            FL1ChannelName = FL2ChannelIdToFL1ChannelName(openChanInfo.ChannelId),
                            FL1ChannelTitle = FL1ChannelTitle.Create(openChanInfo.ChannelName.Value!),
                            Description = "",
                            WeAreInChannel = true
                        };
                        needJCH = true;
                        _bridgedChannelInfoCollection.Add(bci);
                    }

                    var activeCharsResp = await api.GetChannelActiveCharactersAsync(new GetChannelActiveCharactersArgs()
                    {
                        ChannelId = openChanInfo.ChannelId
                    }, cancellationToken);
                    foreach (var ac in activeCharsResp.List)
                    {
                        if (ac.BadgeList.Contains("CHANNEL_OWNER"))
                        {
                            bci.ChannelOwner = ac.CharacterName;
                        }

                        await UpdateBridgedCharacterInfoAsync(ac.Id, ac.CharacterName, ac.GenderColor, ac.CharacterAvatarPath,
                            ac.Presence.PublicStatusView.Status, ac.Presence.StatusMessage, cancellationToken);
                    }

                    if (needJCH)
                    {
                        await writeMessageFunc(new JCHServerMessage()
                        {
                            Channel = bci.FL1ChannelName,
                            Title = bci.FL1ChannelTitle,
                            Character = new() { Identity = myCharacterName }
                        }, cancellationToken);

                        await writeMessageFunc(new COLServerMessage()
                        {
                            Channel = bci.FL1ChannelName,
                            OpList = bci.ChannelOwner is not null
                                ? [bci.ChannelOwner]
                                : []
                        }, cancellationToken);

                        {
                            var ichChars = new List<CharacterIdentity>();
                            foreach (var ch in activeCharsResp.List)
                            {
                                ichChars.Add(new CharacterIdentity()
                                {
                                    Identity = ch.CharacterName
                                });
                            }

                            await writeMessageFunc(new ICHServerMessage()
                            {
                                Channel = bci.FL1ChannelName,
                                Mode = ChannelMode.Chat,
                                Users = ichChars
                            }, cancellationToken);
                        }

                        await writeMessageFunc(new CDSServerMessage()
                        {
                            Channel = bci.FL1ChannelName,
                            Description = bci.Description ?? ""
                        }, cancellationToken);

                        var cmHistResp = await api.GetChannelMessageHistoryAsync(new GetChannelMessageHistoryArgs()
                        {
                            ChannelId = openChanInfo.ChannelId
                        }, cancellationToken);
                        await writeMessageFunc(new XHMServerMessage()
                        {
                            Channel = "ch:" + bci.FL1ChannelName.Value,
                            MessageType = "CLR"
                        }, cancellationToken);
                        foreach (var msg in cmHistResp.List)
                        {
                            await UpdateBridgedCharacterInfoAsync(msg.Author.Id, msg.Author.Name, msg.GenderColor,
                                msg.Author.AvatarPath, null, null, cancellationToken);

                            await writeMessageFunc(new XHMServerMessage()
                            {
                                Channel = "ch:" + bci.FL1ChannelName.Value,
                                MessageType = "MSG",
                                AsOf = msg.Timestamp.ToUnixTimeMilliseconds(),
                                Character = msg.Author.Name,
                                CharacterGender = CharacterGender.Parse(msg.GenderColor),
                                CharacterStatus = CharacterStatus.OFFLINE.ToFL1CharacterStatus(), // XXX:
                                Seen = true,
                                Message = msg.IsMeMessage ? $"/me {msg.Body}" : msg.Body
                            }, cancellationToken);
                        }
                    }
                }
            }
        }

        private async Task OutputInitialConnectionMessagesAsync(
            IFList2Api api, 
            CharacterId myCharacterId,
            CharacterName myCharacterName, 
            CharacterGender myCharacterGender,
            Func<FChatServerMessage, CancellationToken, Task> writeMessageFunc,
            CancellationToken cancellationToken)
        {
            // Send XarChat-specific XNN message (notify client extended messages are supported)
            await writeMessageFunc(new XNNServerMessage(), cancellationToken);

            await UpdateBridgedCharacterInfoAsync(myCharacterId, myCharacterName, null, null,
                CharacterStatus.OFFLINE, null, cancellationToken);

            {
                var getOfficialListTask = api.GetChannelListAsync(
                    new GetChannelListArgs() { ChannelListType = ChannelListType.OfficialChannels }, cancellationToken);
                var getOpenPrivateListTask = api.GetChannelListAsync(
                    new GetChannelListArgs() { ChannelListType = ChannelListType.PrivateOpenChannels }, cancellationToken);
                await Task.WhenAll(getOfficialListTask, getOpenPrivateListTask);

                var officialList = await getOfficialListTask;
                var openPrivateList = await getOpenPrivateListTask;

                foreach (var officialChannel in officialList.List)
                {
                    ProcessChannelListItem(officialChannel, true);
                }
                foreach (var openPrivateChannel in openPrivateList.List)
                {
                    ProcessChannelListItem(openPrivateChannel, false);
                }
            }

            // TODO: Send server variables

            // Send HLO
            await writeMessageFunc(new HLOServerMessage()
                {
                    Message = "Welcome to the XarChat 1-to-2 Chat Gateway!"
                }, cancellationToken);

            // Send CON
            // Since v2 doesn't let you know everyone who's connected to the server, we always return 0 here.
            await writeMessageFunc(new CONServerMessage()
            {
                Count = 0
            }, cancellationToken);

            // Send friends/bookmarks list
            {
                var friends = new List<CharacterName>();

                var gflResp = await api.GetFriendsListAsync(cancellationToken);
                if (gflResp.Characters.TryGetValue(myCharacterName, out var friendItemList))
                {
                    foreach (var friendItem in friendItemList)
                    {
                        await UpdateBridgedCharacterInfoAsync(friendItem.FriendId, friendItem.FriendName,
                            null, friendItem.FriendAvatarPath, null, null, cancellationToken);

                        friends.Add(friendItem.FriendName);
                    }
                }

                // TODO: Get bookmarks list!!!

                await writeMessageFunc(new FRLServerMessage() { Characters = friends }, cancellationToken);
            }

            // Send ignore list
            {
                var ignChars = new List<CharacterName>();

                var ignResp = await api.GetChatIgnoreList(cancellationToken);
                foreach (var ignEntry in ignResp.CharacterIdList)
                {
                    // XXX: MISSING - No way to get charactername from characterid!
                }

                await writeMessageFunc(new IGNServerMessage() { Action = IgnoreListAction.Init, Characters = ignChars }, cancellationToken);
            }

            // Send list of chatops
            {
                // XXX: MISSING - No way to get list of chatops?
                await writeMessageFunc(new ADLServerMessage() { Ops = [] }, cancellationToken);
            }

            // Send connected user list
            {
                // XXX: No way to get list of all connected characters, send empty array
                await writeMessageFunc(new LISServerMessage()
                {
                    Characters = []
                }, cancellationToken);
            }

            // Send our own NLN
            {
                await UpdateBridgedCharacterInfoAsync(myCharacterId, myCharacterName, null, null,
                    CharacterStatus.ONLINE, null, cancellationToken);

                await writeMessageFunc(new NLNServerMessage()
                {
                    Identity = myCharacterName,
                    Gender = myCharacterGender,
                    Status = CharacterStatus.ONLINE.ToFL1CharacterStatus()
                }, cancellationToken);
            }

            // TODO: Send a JCH/COL/ICH/CDS for every channel the user is in, also send XHM backlog messages
            await ReenumerateJoinedChannelsAsync(new ClientMessageProcessingArgs(
                FList2Api: api,
                Firehose: api.Firehose,
                MyCharacterId: myCharacterId,
                MyCharacterName: myCharacterName,
                MyGenderColor: myCharacterGender.GenderColor,
                MyAvatarPath: "",
                WriteMessageFunc: writeMessageFunc,
                CancellationToken: cancellationToken
            ));

            // TODO: Send an XPM for every PM convo the user is in, also send XHM backlog messages
            {
                var openpmsresp = await api.GetChatOpenPMConversationsAsync(cancellationToken);
                foreach (var openPmsInfo in openpmsresp.List.Where(x => x.CharacterId == myCharacterId))
                {
                    // TODO: got character presence here, need to communicate it to the user
                    foreach (var pmConvoInfo in openPmsInfo.List)
                    {
                        // XXX: CharacterName or RecipientName?  (whichever isn't myCharacterName?)
                        var interlocutorName = pmConvoInfo.RecipientName;
                        var interlocutorId = pmConvoInfo.RecipientId;

                        var bci = await UpdateBridgedCharacterInfoAsync(pmConvoInfo.RecipientId, pmConvoInfo.RecipientName,
                            null, pmConvoInfo.RecipientAvatarPath, pmConvoInfo.Presence.PublicStatusView.Status,
                            pmConvoInfo.Presence.StatusMessage, cancellationToken);
                        bci.HasOpenPMConversation = true;

                        await writeMessageFunc(new XPMServerMessage()
                        {
                            Character = interlocutorName
                        }, cancellationToken);

                        var pmHistResp = await api.GetChatPMConversationHistoryAsync(new GetChatPMConversationHistoryArgs()
                        {
                            MyCharacterId = myCharacterId,
                            InterlocutorCharacterId = interlocutorId
                        }, cancellationToken);
                        foreach (var msg in pmHistResp.List)
                        {
                            await writeMessageFunc(new XHMServerMessage()
                            {
                                Channel = "pm:" + interlocutorName.Value,
                                MessageType = "MSG",
                                AsOf = msg.Timestamp.ToUnixTimeMilliseconds(),
                                Character = msg.Author.Name,
                                CharacterGender = CharacterGender.Parse(msg.GenderColor),
                                CharacterStatus = CharacterStatus.OFFLINE.ToFL1CharacterStatus(), // XXX:
                                Seen = true,
                                Message = msg.IsMeMessage ? $"/me {msg.Body}" : msg.Body
                            }, cancellationToken);
                        }
                    }
                }
            }

            // TODO: handle channel unreads

            // Handle PM unreads
            {
                var pmUnreadsResp = await api.GetChatPMConversationUnreadsAsync(cancellationToken);
                foreach (var pmu in pmUnreadsResp)
                {
                    if (pmu.CharacterId == myCharacterId)
                    {
                        var interlocutorCharacterId = pmu.Character1Id != myCharacterId
                            ? pmu.Character1Id
                            : pmu.Character2Id;
                        if (_bridgedCharacterInfoCollection.TryGetBridgedCharacterInfo(interlocutorCharacterId, out var bci))
                        {
                            await writeMessageFunc(new XPUServerMessage()
                            {
                                Recipient = bci.CharacterName,
                                HasUnread = true
                            }, cancellationToken);
                        }
                    }
                }
            }

            // TODO: Need to send XHM console messages? (probably not)

            await writeMessageFunc(new XICServerMessage(), cancellationToken);
        }

        private async Task<(IFlist2ApiReference ApiRef, CharacterName CharacterName)?> TryHandleIncomingLoginAsync(CancellationToken cancellationToken)
        {
            var expectIDNMessage = await _incomingClientMessagesChannel.Reader.ReadAsync(cancellationToken);
            if (expectIDNMessage is not IDNClientMessage idnMsg)
            {
                return null;
            }

            var accountName = idnMsg.Account;
            var password = idnMsg.Ticket;
            var charName = idnMsg.Character;

            // TODO: do 2 login
            var apiRef = await DefaultBridge1to2Manager.FList2ApiInstanceManager.GetOrCreateFList2ApiAsync(accountName, password, cancellationToken);

            

            return (apiRef, charName);
        }

        public async Task IngestIncomingMessageAsync(FChatClientMessage clientMessage, CancellationToken cancellationToken)
        {
            await _incomingClientMessagesChannel.Writer.WriteAsync(clientMessage, cancellationToken);
        }

        public async Task RunOutgoingMessageLoopAsync(Func<FChatServerMessage, CancellationToken, Task> serverMessageEmittedFunc, CancellationToken cancellationToken)
        {
            try
            {
                while (!cancellationToken.IsCancellationRequested)
                {
                    var rmsg = await _outgoingServerMessagesChannel.Reader.ReadAsync(cancellationToken);
                    await serverMessageEmittedFunc(rmsg, cancellationToken);
                }
            }
            catch when (cancellationToken.IsCancellationRequested) { }
        }
    }

    internal static class TaskEnumerableExtensions
    {
        public static async IAsyncEnumerable<T> AsAsyncEnumerable<T>(this Task<IList<T>> enumTask, 
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            await await Task.WhenAny(enumTask, Task.Delay(-1, cancellationToken));
            var e = await enumTask;
            foreach (var item in e)
            {
                yield return item;
            }
        }
    }

    internal record ClientMessageProcessingArgs(
        IFList2Api FList2Api,
        IFirehose Firehose,
        CharacterId MyCharacterId,
        CharacterName MyCharacterName,
        string MyGenderColor,
        string MyAvatarPath,
        Func<FChatServerMessage, CancellationToken, Task> WriteMessageFunc,
        CancellationToken CancellationToken
    );

    internal abstract class ClientMessageHandler
    {
        protected ClientMessageHandler(
            Type clientMessageType,
            Func<DefaultBridgeConnection, ClientMessageProcessingArgs, FChatClientMessage, Task> onMessageFunc)
        {
            this.ClientMessageType = clientMessageType;
            this.OnMessageFunc = onMessageFunc;
        }

        public Type ClientMessageType { get; }

        public Func<DefaultBridgeConnection, ClientMessageProcessingArgs, FChatClientMessage, Task> OnMessageFunc { get; }
    }

    internal class ClientMessageHandler<TMessage> : ClientMessageHandler
        where TMessage: FChatClientMessage
    {
        public ClientMessageHandler(Func<DefaultBridgeConnection, ClientMessageProcessingArgs, TMessage, Task> onMessageFunc)
            : base(
                  typeof(TMessage),
                  (dbc, cmpargs, msg) => onMessageFunc(dbc, cmpargs, (TMessage)msg))
        {
        }
    }

    internal abstract class FirehoseMessageHandler
    {
        protected FirehoseMessageHandler(
            Type firehoseMessageType,
            Func<DefaultBridgeConnection, ClientMessageProcessingArgs, IFirehoseIncomingMessage, Task> onMessageFunc)
        {
            this.FirehoseMessageType = firehoseMessageType;
            this.OnMessageFunc = onMessageFunc;
        }

        public Type FirehoseMessageType { get; }

        public Func<DefaultBridgeConnection, ClientMessageProcessingArgs, IFirehoseIncomingMessage, Task> OnMessageFunc { get; }
    }

    internal class FirehoseMessageHandler<TMessage> : FirehoseMessageHandler
        where TMessage : IFirehoseIncomingMessage
    {
        public FirehoseMessageHandler(Func<DefaultBridgeConnection, ClientMessageProcessingArgs, TMessage, Task> onMessageFunc)
            : base(
                  typeof(TMessage),
                  (dbc, cmpargs, msg) => onMessageFunc(dbc, cmpargs, (TMessage)msg))
        {
        }
    }
}
