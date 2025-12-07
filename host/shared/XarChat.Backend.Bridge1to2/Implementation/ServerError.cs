using XarChat.Backend.Bridge1to2.Messages.Server;

namespace XarChat.Backend.Bridge1to2.Implementation
{
    internal class ServerError
    {
        public static readonly ServerError UnknownFL2Channel = new(-11, "That channel's ID is not currently available");
        public static readonly ServerError CharNotChatEnabled = new(-10, "That character is not chat enabled");
        public static readonly ServerError InvalidIDNMessage = new(10, "Invalid IDN");

        private ServerError(int code, string message)
        {
            this.Code = code;
            this.Message = message;
            this.ERRMessage = new() { Code = code, Message = message };
        }
        
        public int Code { get; }
        public string Message { get; }
        public ERRServerMessage ERRMessage { get; }
    }
}
