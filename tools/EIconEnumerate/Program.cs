
using Microsoft.Extensions.Logging.Abstractions;
using System.Security;
using XarChat.FList2.FList2Api.Implementation;

namespace EIconEnumerate
{
    class Program
    {
        public static async Task<int> Main(string[] args)
        {
            var cancellationToken = CancellationToken.None;

            var factory = new DefaultFList2ApiFactory(NullLogger<DefaultFList2ApiFactory>.Instance);
            await using var api = await factory.CreateAsync(new XarChat.FList2.FList2Api.FList2ApiOptions()
                {
                    BaseUri = new Uri("https://test.f-list.net/")
                },
                new XarChat.FList2.FList2Api.Entities.LoginArgs()
                {
                    Username = System.Environment.GetEnvironmentVariable("USERNAME") ?? throw new ApplicationException("USERNAME env var required"),
                    Password = System.Environment.GetEnvironmentVariable("PASSWORD") ?? throw new ApplicationException("PASSWORD env var required")
                },
                cancellationToken);

            using var outf = File.CreateText("eiconslist.txt");

            var curPage = 0;
            while (true)
            {
                var sres = await api.SearchEIconsAsync(
                    new() { SearchTerm = "", Page = curPage }, cancellationToken);

                if (sres.Icons.Count > 0)
                {
                    Console.WriteLine($"==> Page {curPage + 1} of {(sres.Total / sres.Icons.Count) + 1}");
                }
                foreach (var i in sres.Icons)
                {
                    Console.WriteLine(i.Name);
                    outf.WriteLine(i.Name);
                }
                outf.Flush();

                if (sres.Icons.Count == 0)
                {
                    break;
                }

                curPage++;
            }
            outf.Flush();

            return 0;
        }
    }
}