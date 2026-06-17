import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getNotifications } from "@/app/actions/notifications"
import { NotificationList } from "@/components/notification-list"
import { AppShell } from "@/components/app-shell"

export default async function NotificationsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const notifications = await getNotifications()

  return (
    <AppShell active="/notifications" title="Notifications">
      <NotificationList notifications={notifications} />
    </AppShell>
  )
}
