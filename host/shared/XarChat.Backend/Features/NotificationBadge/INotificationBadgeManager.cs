using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace XarChat.Backend.Features.NotificationBadge
{
    public interface INotificationBadgeManager
    {
        void SetNotificationBadge(NotificationBadgeType notificationBadgeType);
    }
}
