using System.Diagnostics.CodeAnalysis;
using System.Reflection;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;
using XarChat.Backend.Bridge1to2.Messages;

namespace XarChat.Backend.Bridge1to2
{
    public abstract class DefaultMessageCodeMapBase : IMessageCodeClassMap
    {
        public static IEnumerable<FChatMessageDefinitionMetadata> EnumerateMetadataFromTypeList(IEnumerable<Type> types)
        {
            foreach (var msgType in types)
            {
                var mca = msgType.GetCustomAttribute<MessageCodeAttribute>();
                if (mca is not null)
                {
                    yield return new FChatMessageDefinitionMetadata(mca.Code, msgType, mca.HasBody);
                }
            }
        }

        public static IEnumerable<FChatMessageDefinitionMetadata> EnumerateMetadataFromJsonSerializerContext(JsonSerializerContext jsc)
        {
            var propQuery =
                from pi in jsc.GetType().GetProperties()
                where typeof(JsonTypeInfo).IsAssignableFrom(pi.PropertyType)
                select pi;

            foreach (var pi in propQuery)
            {
                var msgType = ((JsonTypeInfo)pi.GetValue(jsc)!).Type;
                var mca = msgType.GetCustomAttribute<MessageCodeAttribute>();
                if (mca is not null)
                {
                    yield return new FChatMessageDefinitionMetadata(mca.Code, msgType, mca.HasBody);
                }
            }
        }

        private readonly IReadOnlyDictionary<string, FChatMessageDefinitionMetadata> _metadataByCode;
        private readonly IReadOnlyDictionary<Type, FChatMessageDefinitionMetadata> _metadataByClass;

        protected DefaultMessageCodeMapBase(IEnumerable<FChatMessageDefinitionMetadata> metadatas)
        {
            _metadataByCode = metadatas.ToDictionary(md => md.MessageCode, md => md);
            _metadataByClass = metadatas.ToDictionary(md => md.MessageClass, md => md);
        }

        public bool TryGetMetadataByClass(Type messageClass, [NotNullWhen(true)] out FChatMessageDefinitionMetadata? metadata)
            => _metadataByClass.TryGetValue(messageClass, out metadata);

        public bool TryGetMetadataByCode(string code, [NotNullWhen(true)] out FChatMessageDefinitionMetadata? metadata)
            => _metadataByCode.TryGetValue(code, out metadata);
    }
}
