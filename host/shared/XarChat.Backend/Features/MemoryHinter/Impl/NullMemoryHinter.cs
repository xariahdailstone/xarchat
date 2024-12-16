namespace XarChat.Backend.Features.MemoryHinter.Impl
{
    internal class NullMemoryHinter : IMemoryHinter
    {
        public void ReduceWorkingSet() { }
    }
}
