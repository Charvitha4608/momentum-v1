import { redirect } from "next/navigation"
import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { getHelpDoc } from "@/app/actions/help"
import { HelpAssistant } from "@/components/help-assistant"
import { AppShell } from "@/components/app-shell"

export default async function HelpPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const doc = await getHelpDoc()

  return (
    <AppShell active="/help" title="Help" subtitle="Ask how anything in Momentum works">
      <HelpAssistant doc={doc} />
    </AppShell>
  )
}
