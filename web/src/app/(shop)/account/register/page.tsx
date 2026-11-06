import Link from "next/link";
import { redirect } from "next/navigation";
import { registerAction } from "@/actions/account";
import { GoogleButton } from "@/components/auth/google-button";
import { currentUser } from "@/lib/auth";

export const metadata = { title: "Create account" };

const MESSAGES: Record<string, string> = {
  format: "Email không hợp lệ, hoặc mật khẩu dưới 8 ký tự.",
  taken: "Email này đã có tài khoản — đăng nhập thay.",
};

export default async function AccountRegister({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  if (await currentUser()) redirect("/account");

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-5 py-16 sm:px-8">
      <p className="label">Account</p>
      <h1 className="mt-3 font-serif text-3xl font-light">Create account</h1>
      <p className="mt-3 text-sm text-ink-soft">Đơn guest trước đây dùng cùng email sẽ tự hiện trong lịch sử.</p>

      <GoogleButton next={next ?? "/account"} />

      <form action={registerAction} className="space-y-4">
        <input type="hidden" name="next" value={next ?? "/account"} />
        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" required autoComplete="email" className="mt-2 w-full border border-line bg-transparent px-3 py-2.5 text-sm focus:border-ink focus:outline-none" />
        </label>
        <label className="block">
          <span className="label">Password (8+ characters)</span>
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className="mt-2 w-full border border-line bg-transparent px-3 py-2.5 text-sm focus:border-ink focus:outline-none" />
        </label>
        {error ? <p className="text-sm text-brass">{MESSAGES[error] ?? "Check your details."}</p> : null}
        <button className="w-full border border-ink px-6 py-3 text-[0.7rem] uppercase tracking-[0.18em] transition-colors duration-300 ease-[var(--ease-out-soft)] hover:bg-ink hover:text-ivory">
          Create account
        </button>
      </form>

      <p className="mt-6 text-sm text-taupe">
        Already have one?{" "}
        <Link href={`/account/login?next=${encodeURIComponent(next ?? "/account")}`} className="link-underline text-ink">
          Sign in
        </Link>
      </p>
    </div>
  );
}
