using XarChat.Backend.Bridge1to2.Messages.Client;
using XarChat.Backend.Bridge1to2.Messages.Server;
using XarChat.FList2.Common.StrongTypes;

namespace XarChat.Backend.Bridge1to2.Tests
{
    [TestClass]
    public sealed class FChatMessageSerializationTests
    {
        [TestMethod]
        public void ServerMessageSerialize()
        {
            var map = new DefaultServerMessageCodeMap();
            var ser = new FChatMessageSerializer<FChatServerMessage>(map, ServerMessageJsonSerializerContext.Default);

            var msg = new IDNServerMessage() { Character = CharacterName.Create("Foobar") };
            var output = ser.Serialize(msg);

            Assert.AreEqual("IDN {\"character\":\"Foobar\"}", output);
        }

        [TestMethod]
        public void ClientMessageDeserialize()
        {
            var map = new DefaultClientMessageCodeMap();
            var ser = new FChatMessageDeserializer<FChatClientMessage>(
                map, 
                ClientMessageJsonSerializerContext.Default,
                (code, body) => throw new ApplicationException($"Unknown client message code: {code}"));

            var output = ser.Deserialize(@"IDN { ""account"":""test123"", ""ticket"":""test123pass"", ""method"":""ticket"", ""character"":""Foobar"" }");

            Assert.IsInstanceOfType<IDNClientMessage>(output);
            var idnMsg = (IDNClientMessage)output;
            Assert.AreEqual("test123", idnMsg.Account);
            Assert.AreEqual("test123pass", idnMsg.Ticket);
            Assert.AreEqual("ticket", idnMsg.Method);
            Assert.AreEqual(CharacterName.Create("Foobar"), idnMsg.Character);
        }
    }
}
