using Microsoft.Extensions.DependencyInjection;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend
{
    public interface IBackendServiceSetup
    {
        void ConfigureServices(IServiceCollection services);
    }
}
