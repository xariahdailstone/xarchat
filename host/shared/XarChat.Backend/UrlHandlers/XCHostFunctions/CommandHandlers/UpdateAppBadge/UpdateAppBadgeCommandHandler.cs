using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.NotificationBadge;
using static XarChat.Backend.UrlHandlers.XCHostFunctions.WebSocketXCHostSession;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.UpdateAppBadge
{
    internal class UpdateAppBadgeCommandHandler : XCHostCommandHandlerBase<UpdateAppBadgeArgs>
    {
        private readonly INotificationBadgeManager _notificationBadgeManager;

        public UpdateAppBadgeCommandHandler(INotificationBadgeManager notificationBadgeManager)
        {
            _notificationBadgeManager = notificationBadgeManager;
        }

        protected override Task HandleCommandAsync(UpdateAppBadgeArgs args, CancellationToken cancellationToken)
        {
            var nbt = args.HasPings ? NotificationBadgeType.PingsWithCount(1) :
                args.HasUnseen ? NotificationBadgeType.Mentions :
                NotificationBadgeType.None;
            _notificationBadgeManager.SetNotificationBadge(nbt);
            return Task.CompletedTask;
        }
    }
}
