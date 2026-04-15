"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AudioWaveform,
  LogOut,
  Mic2,
  Palette,
  PlayCircle,
  Plug,
  Settings,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthStore, isAuthRequired } from "@/lib/auth-store";

const settingsNavKeys = [
  { labelKey: "settings.playbackNav" as const, path: "/app/settings/playback", icon: PlayCircle },
  { labelKey: "settings.crossfades" as const, path: "/app/settings/crossfades", icon: AudioWaveform },
  { labelKey: "settings.input" as const, path: "/app/settings/input", icon: Mic2 },
  { labelKey: "settings.integrations" as const, path: "/app/settings/integrations", icon: Plug },
  { labelKey: "settings.appearance" as const, path: "/app/settings/appearance", icon: Palette },
] as const;

function navActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/app/settings/playback" && pathname === "/app/settings") return true;
  return false;
}

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const { username, logout } = useAuthStore();
  const showSignOut = isAuthRequired() && Boolean(username);

  return (
    <div className="app-page-settings">
      <div className="mb-8 flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold text-foreground">{t("settings.title")}</h1>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:gap-6">
        <nav className="-mx-1 flex flex-shrink-0 flex-row flex-wrap gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] md:mx-0 md:w-48 md:flex-col md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden">
          {settingsNavKeys.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm transition-colors md:py-2 ${
                navActive(pathname, item.path)
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {t(item.labelKey)}
            </Link>
          ))}
          {showSignOut ? (
            <div className="mt-2 border-t border-border pt-2 md:mt-3 md:w-full md:pt-3">
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  router.replace("/login");
                }}
                className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive md:py-2"
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden />
                {t("auth.signOut")}
              </button>
            </div>
          ) : null}
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
