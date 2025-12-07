namespace XarChat.FList2.FList2Api.Implementation
{
    public class TestBasicAuthHandler : DelegatingHandler
    {
        public TestBasicAuthHandler(HttpMessageHandler inner)
            : base(inner)
        {
        }

        private const string AUTH_USERNAME = "f-list-alpha";
        private const string AUTH_PASSWORD = "anNz3fkADwLYjrCMLWQd";

        public KeyValuePair<string, string>? CsrfHeader = null;

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (request.Headers.UserAgent.Count == 0)
            {
                request.Headers.UserAgent.Add(new System.Net.Http.Headers.ProductInfoHeaderValue("XarChatLib", "dev"));
            }

            if (request.RequestUri?.Host == "test.f-list.net")
            {
                request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Basic",
                    Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"{AUTH_USERNAME}:{AUTH_PASSWORD}")));
                if (CsrfHeader is not null)
                {
                    request.Headers.Add(CsrfHeader.Value.Key, CsrfHeader.Value.Value);
                }
            }

            return base.SendAsync(request, cancellationToken);
        }
    }
}
