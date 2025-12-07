namespace XarChat.FList2.FList2Connection
{
    public interface IFList2ConnectionFactory
    {
        Task<IFList2Connection> CreateAsync(FList2ConnectionOptions options, CancellationToken cancellationToken);
    }
}
