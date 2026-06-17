import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getProfile } from "@/app/actions/profile"
import { ProfileForm } from "@/components/profile-form"
import { AppShell } from "@/components/app-shell"

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const profile = await getProfile()

  return (
    <AppShell active="/profile" title="Profile">
      <ProfileForm profile={profile} />
    </AppShell>
  )
}
