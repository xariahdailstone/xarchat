using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using XarChat.Backend.Common;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers
{
    public abstract class XCHostCommandHandlerBase : IXCHostCommandHandler
    {
        public async Task HandleCommandAsync(XCHostCommandContext context, CancellationToken cancellationToken)
        {
            this.CommandContext = context;
            await HandleCommandAsync(cancellationToken);
        }

        protected XCHostCommandContext CommandContext { get; private set; } = null!;

        protected abstract Task HandleCommandAsync(CancellationToken cancellationToken);
    }

    public abstract class AsyncXCHostCommandHandlerBase : IAsyncXCHostCommandHandler
    {
        public async Task HandleCommandAsync(XCHostCommandContext context, CancellationToken cancellationToken)
        {
            this.CommandContext = context;
            await HandleCommandAsync(cancellationToken);
        }

        protected XCHostCommandContext CommandContext { get; private set; } = null!;

        protected abstract Task HandleCommandAsync(CancellationToken cancellationToken);
    }

    public abstract class XCHostCommandHandlerBase<TArgs> : IXCHostCommandHandler
    {
        public async Task HandleCommandAsync(XCHostCommandContext context, CancellationToken cancellationToken)
        {
            this.CommandContext = context;
            var jsonTypeInfo = SourceGenerationContext.Default.GetTypeInfo(typeof(TArgs))!;
            var args = (TArgs)JsonSerializer.Deserialize(context.Args, jsonTypeInfo)!;
            await HandleCommandAsync(args, cancellationToken);
        }

        protected XCHostCommandContext CommandContext { get; private set; } = null!;

        protected abstract Task HandleCommandAsync(TArgs args, CancellationToken cancellationToken);
    }

    public abstract class AsyncXCHostCommandHandlerBase<TArgs> : IAsyncXCHostCommandHandler
    {
        public async Task HandleCommandAsync(XCHostCommandContext context, CancellationToken cancellationToken)
        {
            this.CommandContext = context;
            var jsonTypeInfo = SourceGenerationContext.Default.GetTypeInfo(typeof(TArgs))!;
            var args = (TArgs)JsonSerializer.Deserialize(context.Args, jsonTypeInfo)!;
            await HandleCommandAsync(args, cancellationToken);
        }

        protected XCHostCommandContext CommandContext { get; private set; } = null!;

        protected abstract Task HandleCommandAsync(TArgs args, CancellationToken cancellationToken);
    }
}
