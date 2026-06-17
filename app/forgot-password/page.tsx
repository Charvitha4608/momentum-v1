import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { ForgotPasswordForm } from "@/components/forgot-password-form"

export default async function ForgotPasswordPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect("/")

  return <ForgotPasswordForm />
}
