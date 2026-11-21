"use client";

import { Check, Save, ShieldCheck, User } from "lucide-react";
import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Switch } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { apiPatch, apiPut, useApi } from "@/lib/client/api";
import { CLIP_LENGTHS, SUBTITLE_STYLES } from "@/lib/plans";

export default function SettingsPage() {
  const toast = useToast();
  const { data: auth } = useApi<any>("/api/auth/me");
  const { data: settingsData, refresh } = useApi<{ settings: any }>("/api/settings");

  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [settings, setSettings] = useState<any>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (auth?.user) setName(auth.user.name ?? "");
  }, [auth]);

  useEffect(() => {
    if (settingsData?.settings) setSettings(settingsData.settings);
  }, [settingsData]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await apiPatch("/api/auth/profile", {
        name,
        ...(newPassword ? { currentPassword, newPassword } : {}),
      });
      setCurrentPassword("");
      setNewPassword("");
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not update the profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await apiPut("/api/settings", settings);
      toast.success("Defaults saved", "New projects will use these settings.");
      await refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-white">Settings</h1>
        <p className="mt-1 text-[13px] text-white/50">
          Account details and the defaults applied to every new project.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard className="p-5">
          <h2 className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-white">
            <User className="size-4 text-violet-300" /> Profile
          </h2>
          <form onSubmit={saveProfile} className="mt-4 space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={auth?.user?.email ?? ""} disabled />
            </div>
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label hint="to change">Current password</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <Label hint="8+ chars">New password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge tone="neutral">{auth?.user?.provider ?? "password"}</Badge>
                <Badge tone={auth?.user?.role === "admin" ? "rose" : "neutral"}>
                  {auth?.user?.role ?? "user"}
                </Badge>
              </div>
              <Button type="submit" loading={savingProfile} icon={<Save className="size-4" />}>
                Save
              </Button>
            </div>
          </form>
        </GlassCard>

        <GlassCard className="p-5">
          <h2 className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-white">
            <ShieldCheck className="size-4 text-mint-400" /> Project defaults
          </h2>
          {!settings ? (
            <p className="mt-6 text-[12.5px] text-white/35">Loading…</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Clip length</Label>
                  <Select
                    value={String(settings.targetLength)}
                    onChange={(value) => setSettings({ ...settings, targetLength: Number(value) })}
                    options={CLIP_LENGTHS.map((len) => ({ value: String(len), label: `${len} seconds` }))}
                  />
                </div>
                <div>
                  <Label>Clips per project</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={settings.requestedClips}
                    onChange={(e) =>
                      setSettings({ ...settings, requestedClips: Number(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Aspect ratio</Label>
                  <Select
                    value={settings.aspect}
                    onChange={(value) => setSettings({ ...settings, aspect: value })}
                    options={[
                      { value: "9:16", label: "9:16 vertical" },
                      { value: "16:9", label: "16:9 landscape" },
                      { value: "1:1", label: "1:1 square" },
                    ]}
                  />
                </div>
                <div>
                  <Label>Caption style</Label>
                  <Select
                    value={settings.subtitleStyle}
                    onChange={(value) => setSettings({ ...settings, subtitleStyle: value })}
                    options={SUBTITLE_STYLES.map((style) => ({ value: style.id, label: style.name }))}
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">
                <Switch
                  checked={settings.autoThumbnail}
                  onChange={(value) => setSettings({ ...settings, autoThumbnail: value })}
                  label="Generate thumbnails automatically"
                />
                <Switch
                  checked={settings.emailOnComplete}
                  onChange={(value) => setSettings({ ...settings, emailOnComplete: value })}
                  label="Email me when a project finishes"
                  description="Requires an email provider (RESEND_API_KEY)"
                />
              </div>

              <Button
                className="w-full"
                loading={savingSettings}
                onClick={saveSettings}
                icon={<Check className="size-4" />}
              >
                Save defaults
              </Button>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
