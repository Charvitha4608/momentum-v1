import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getProfile } from "@/app/actions/profile"
import { getAvailability } from "@/app/actions/availability"
import { ProfileForm } from "@/components/profile-form"
import { AvailabilitySettings } from "@/components/availability-settings"
import { AppShell } from "@/components/app-shell"

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const [profile, availability] = await Promise.all([getProfile(), getAvailability()])

  return (
    <AppShell active="/profile" title="Profile">
      <div className="flex flex-col gap-6">
        <ProfileForm profile={profile} />
        <AvailabilitySettings initial={availability} />
      </div>
    </AppShell>
  )
}
