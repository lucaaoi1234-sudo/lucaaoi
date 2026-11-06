"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import { useSettings } from "@/lib/client/data";
import { DEFAULT_SETTINGS, settingsSchema, type SettingsInput } from "@/lib/validation/schemas";
import { Alert, Button, Card, Field, PageHeader, Spinner, inputClass } from "./ui";
import { Crosshair } from "./Crosshair";

const QUALITY_LABEL: Record<SettingsInput["graphicsQuality"], string> = {
  LOW: "Thấp — tối ưu cho máy yếu / di động",
  MEDIUM: "Trung bình — cân bằng",
  HIGH: "Cao — hiệu ứng đầy đủ, cần GPU mạnh",
};

export function SettingsView() {
  const { user } = useAuth();
  const { settings, status, error, save, isGuest } = useSettings();
  const [draft, setDraft] = useState<SettingsInput>(settings);
  const [draftSource, setDraftSource] = useState<SettingsInput>(settings);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // Khi cài đặt đã lưu thay đổi (tải xong / lưu thành công), đồng bộ bản nháp ngay trong lúc render.
  if (draftSource !== settings) {
    setDraftSource(settings);
    setDraft(settings);
  }

  const update = <K extends keyof SettingsInput>(key: K, value: SettingsInput[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setMessage(null);
  };

  const onSave = async () => {
    const check = settingsSchema.safeParse(draft);
    if (!check.success) {
      const errs: Record<string, string> = {};
      for (const issue of check.error.issues) errs[String(issue.path[0])] ??= issue.message;
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    setMessage(null);
    try {
      await save(check.data);
      setMessage({
        tone: "success",
        text: isGuest ? "Đã lưu cài đặt trên trình duyệt này." : "Đã lưu cài đặt vào tài khoản.",
      });
    } catch (e) {
      setMessage({ tone: "error", text: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  const crosshairPreview = draft.crosshairSize;

  return (
    <>
      <PageHeader
        eyebrow="Tuỳ chỉnh"
        title="Cài đặt"
        description={
          isGuest
            ? "Bạn đang ở chế độ khách: cài đặt được lưu trong trình duyệt. Đăng nhập để đồng bộ giữa các thiết bị."
            : `Cài đặt của ${user?.displayName ?? "bạn"} được đồng bộ trên máy chủ.`
        }
      />

      {status === "loading" && <Spinner label="Đang tải cài đặt…" />}
      {status === "error" && <Alert>{error}</Alert>}

      {status === "ready" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Card title="Điều khiển & hiển thị" subtitle="Áp dụng ở lần vào phòng tập tiếp theo">
            <div className="grid gap-6 sm:grid-cols-2">
              <Field
                label={`Độ nhạy chuột: ${draft.sensitivity.toFixed(2)}×`}
                error={fieldErrors.sensitivity}
                hint="Áp dụng khi con trỏ bị khóa (Pointer Lock). Khi không khóa, tâm ngắm bám đúng vị trí con trỏ."
              >
                <input
                  type="range"
                  min={0.1}
                  max={5}
                  step={0.05}
                  value={draft.sensitivity}
                  onChange={(e) => update("sensitivity", Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </Field>

              <Field label={`Kích thước tâm ngắm: ${draft.crosshairSize}px`} error={fieldErrors.crosshairSize}>
                <input
                  type="range"
                  min={4}
                  max={40}
                  step={1}
                  value={draft.crosshairSize}
                  onChange={(e) => update("crosshairSize", Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </Field>

              <Field label="Màu tâm ngắm" error={fieldErrors.crosshairColor}>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={draft.crosshairColor}
                    onChange={(e) => update("crosshairColor", e.target.value)}
                    className="h-10 w-16 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                    aria-label="Chọn màu tâm ngắm"
                  />
                  <input
                    className={inputClass}
                    value={draft.crosshairColor}
                    onChange={(e) => update("crosshairColor", e.target.value)}
                    maxLength={7}
                    spellCheck={false}
                  />
                </div>
              </Field>

              <Field label={`Âm lượng hiệu ứng: ${draft.volume}%`} error={fieldErrors.volume}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={draft.volume}
                  onChange={(e) => update("volume", Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </Field>

              <Field label={`Góc nhìn (FOV dọc): ${draft.fov}°`} error={fieldErrors.fov} hint="Góc lớn hơn thấy được nhiều hơn nhưng méo hơn.">
                <input
                  type="range"
                  min={50}
                  max={100}
                  step={1}
                  value={draft.fov}
                  onChange={(e) => update("fov", Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </Field>

              <Field label="Chất lượng đồ hoạ" error={fieldErrors.graphicsQuality} hint={QUALITY_LABEL[draft.graphicsQuality]}>
                <select
                  className={inputClass}
                  value={draft.graphicsQuality}
                  onChange={(e) => update("graphicsQuality", e.target.value as SettingsInput["graphicsQuality"])}
                >
                  <option value="LOW">Thấp</option>
                  <option value="MEDIUM">Trung bình</option>
                  <option value="HIGH">Cao</option>
                </select>
              </Field>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={onSave} disabled={saving}>
                {saving ? "Đang lưu…" : "Lưu cài đặt"}
              </Button>
              <Button variant="ghost" onClick={() => setDraft({ ...DEFAULT_SETTINGS })} disabled={saving}>
                Khôi phục mặc định
              </Button>
              {message && (
                <span role="status" className={`text-sm ${message.tone === "success" ? "text-lime" : "text-rose-300"}`}>
                  {message.text}
                </span>
              )}
            </div>
          </Card>

          <Card title="Xem trước tâm ngắm">
            <div className="relative flex aspect-square items-center justify-center rounded-xl border border-white/5 bg-gradient-to-b from-slate-900 to-void">
              <Crosshair size={crosshairPreview} color={draft.crosshairColor} />
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Tâm ngắm trong trận luôn hiển thị đúng vị trí con trỏ chuột.
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
