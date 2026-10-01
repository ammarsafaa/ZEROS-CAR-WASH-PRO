import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CarFront, Eye, EyeOff } from "lucide-react";
import { login, getSession, getLang, setLang, getTheme, setTheme } from "@/lib/db";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — ZEROS CAR WASH PRO" },
      { name: "description", content: "تسجيل الدخول إلى نظام إدارة مغسلة السيارات" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [lang, setL] = useState(getLang());

  useEffect(() => {
    setTheme(getTheme());
    setLang(getLang());
    const saved = localStorage.getItem("cwp_remember_user");
    if (saved) {
      setUsername(saved);
      setRemember(true);
    }
    if (getSession()) navigate({ to: "/" });
  }, [navigate]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = login(username.trim(), password);
    if (!s) {
      setError(lang === "ar" ? "اسم المستخدم أو كلمة المرور غير صحيحة" : "Invalid username or password");
      return;
    }
    if (remember) localStorage.setItem("cwp_remember_user", username.trim());
    else localStorage.removeItem("cwp_remember_user");
    navigate({ to: "/" });
  };

  const toggleLang = () => {
    const next = lang === "ar" ? "en" : "ar";
    setLang(next);
    setL(next);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <CarFront className="h-9 w-9" />
          </div>
          <h1 className="text-2xl font-bold">ZEROS CAR WASH PRO</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {lang === "ar" ? "نظام إدارة مغسلة السيارات" : "Car Wash Management System"}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {lang === "ar" ? "اسم المستخدم" : "Username"}
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {lang === "ar" ? "كلمة المرور" : "Password"}
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pe-10 text-sm outline-none focus:ring-2 focus:ring-ring"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            {lang === "ar" ? "تذكر اسم المستخدم" : "Remember username"}
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {lang === "ar" ? "تسجيل الدخول" : "Login"}
          </button>

          <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
            <button type="button" onClick={toggleLang} className="hover:text-foreground">
              {lang === "ar" ? "English" : "العربية"}
            </button>
            <span>v1.0.0</span>
          </div>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {lang === "ar"
            ? "المستخدم الافتراضي: admin / كلمة المرور: 123456"
            : "Default user: admin / password: 123456"}
        </p>
      </div>
    </div>
  );
}
