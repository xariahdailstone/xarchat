using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using XarChat.Backend.Features.NotificationBadge;
using static XarChat.Backend.UrlHandlers.XCHostFunctions.WebSocketXCHostSession;

namespace XarChat.Backend.UrlHandlers.XCHostFunctions.CommandHandlers.UpdateAppBadge
{
    internal class UpdateAppBadgeCommandHandler : AsyncXCHostCommandHandlerBase<UpdateAppBadgeArgs>
    {
        private readonly INotificationBadgeManager _notificationBadgeManager;

        public UpdateAppBadgeCommandHandler(INotificationBadgeManager notificationBadgeManager)
        {
            _notificationBadgeManager = notificationBadgeManager;
        }

        protected override Task HandleCommandAsync(UpdateAppBadgeArgs args, CancellationToken cancellationToken)
        {
            var pingCount = args.PingCount ?? ((args.HasPings ?? false) ? 1 : 0);
            var unseenCount = args.UnseenCount ?? ((args.HasUnseen ?? false) ? 1 : 0);

            //var nbt = (pingCount > 0) ? NotificationBadgeType.PingsWithCount(pingCount) :
            //    (unseenCount > 0) ? NotificationBadgeType.UnseenWithCount(unseenCount) :
            //    NotificationBadgeType.None;

            _notificationBadgeManager.SetNotificationBadge(pingCount, unseenCount);
            return Task.CompletedTask;
        }
    }
}
