"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export async function loginAction(fd: FormData) {
  const email = String(fd.get("email") ?? "");
  const password = String(fd.get("password") ?? "");
  const user = await signIn(email, password);

  // khách đăng nhập ở đây sẽ bị đẩy vòng lặp, nên chặn ngay
  if (!user || (user.role !== "manager" && user.role !== "carrier")) {
    if (user) await signOut();
    redirect("/admin/login?error=1");
  }

  await writeAudit({ actorId: user.id, actorEmail: user.email, action: "auth.login", targetType: "user", targetId: user.id });
  redirect(user.role === "carrier" ? "/admin/orders" : "/admin");
}

export async function logoutAction() {
  await signOut();
  redirect("/admin/login");
}
