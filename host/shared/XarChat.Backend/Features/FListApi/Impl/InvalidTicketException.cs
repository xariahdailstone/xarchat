namespace XarChat.Backend.Features.FListApi.Impl
{
    public class InvalidTicketException : ApplicationException
    {
        public InvalidTicketException()
            : base("Invalid API Ticket")
        { 
        }
    }

    public class FListApiException : ApplicationException
    {
        public FListApiException(string message, Exception? innerException = null)
            : base(message, innerException)
        {
            
        }
    }
}
