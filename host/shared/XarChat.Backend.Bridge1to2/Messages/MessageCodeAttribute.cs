namespace XarChat.Backend.Bridge1to2.Messages
{
    [AttributeUsage(AttributeTargets.Class, AllowMultiple = false, Inherited = false)]
    public sealed class MessageCodeAttribute : Attribute
    {
        public required string Code { get; set; }

        public bool HasBody { get; set; } = true;
    }
}
