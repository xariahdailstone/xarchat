using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using XarChat.Backend.Bridge1to2.Messages;
using XarChat.Backend.Bridge1to2.Messages.Client;

namespace XarChat.Backend.Bridge1to2
{
    public interface IFChatMessageSerializer<T>
        where T : FChatMessage
    {
        string Serialize(T message);
    }

    public class FChatMessageSerializer<T> : IFChatMessageSerializer<T>
        where T : FChatMessage
    {
        public FChatMessageSerializer(IMessageCodeClassMap messageCodeClassMap, JsonSerializerContext serializerContext)
        {
            this.MessageCodeClassMap = messageCodeClassMap;
            this.SerializerContext = serializerContext;
        }

        public IMessageCodeClassMap MessageCodeClassMap { get; }

        public JsonSerializerContext SerializerContext { get; }

        public string Serialize(T message)
        {
            var messageClass = message.GetType();
            if (MessageCodeClassMap.TryGetMetadataByClass(messageClass, out var md))
            {
                if (!md.HasBody)
                {
                    return md.MessageCode;
                }
                else
                {
                    var jsonTypeInfo = SerializerContext.GetTypeInfo(messageClass);
                    if (jsonTypeInfo is not null)
                    {
                        var jsonStr = JsonSerializer.Serialize(message, jsonTypeInfo);
                        return $"{md.MessageCode} {jsonStr}";
                    }
                    else
                    {
                        throw new ApplicationException($"No JSON type info for message class: {messageClass.Name}");
                    }
                }
            }
            else
            {
                throw new ApplicationException($"Unknown message class: {messageClass.Name}");
            }
        }
    }

    public interface IFChatMessageDeserializer<T>
        where T : FChatMessage
    {
        T Deserialize(string serializedMessage);
    }

    public class FChatMessageDeserializer<T> : IFChatMessageDeserializer<T>
        where T : FChatMessage
    {
        public FChatMessageDeserializer(
            IMessageCodeClassMap messageCodeClassMap, 
            JsonSerializerContext serializerContext,
            Func<string, string?, T> unknownMessageFunc)
        {
            this.MessageCodeClassMap = messageCodeClassMap;
            this.SerializerContext = serializerContext;
            this.UnknownMessageFunc = unknownMessageFunc;
        }

        public IMessageCodeClassMap MessageCodeClassMap { get; }

        public JsonSerializerContext SerializerContext { get; }

        public Func<string, string?, T> UnknownMessageFunc { get; }

        public T Deserialize(string serializedMessage)
        {
            var spacePos = serializedMessage.IndexOf(' ');
            var code = spacePos == -1 ? serializedMessage : serializedMessage.Substring(0, spacePos);
            var body = spacePos == -1 ? "" : serializedMessage.Substring(spacePos + 1);

            if (MessageCodeClassMap.TryGetMetadataByCode(code, out var md))
            {
                if (!md.HasBody)
                {
                    var result = Activator.CreateInstance(md.MessageClass)!;
                    return (T)result;
                }
                else
                {
                    var jsonTypeInfo = SerializerContext.GetTypeInfo(md.MessageClass);
                    if (jsonTypeInfo is not null)
                    {
                        var msgInstance = JsonSerializer.Deserialize(body, jsonTypeInfo)!;
                        return (T)msgInstance;
                    }
                    else
                    {
                        throw new ApplicationException($"Missing JSON serialization info for message code: {code}");
                    }
                }
            }
            else
            {
                return UnknownMessageFunc(code, body);
            }
        }
    }
}
