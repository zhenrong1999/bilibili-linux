import { Button, Card, Col, Row, Select, Switch } from "antd"
import { useEffect, useState } from "react"
import { createLogger } from "../../../../common/log"
import useNotification from "antd/es/notification/useNotification"
import { useTranslation } from "react-i18next"

const log = createLogger("thread-ripper")

const STORAGE_KEYS: string[] = ["enabled", "mode", "concurrency", "compatibilityMode"]

interface ThreadRipperSettings {
  compatibilityMode: "off" | "a" | "b"
  concurrency: number
  enabled: boolean
  mode: "mainland" | "overseas"
}

const DEFAULTS: ThreadRipperSettings = {
  compatibilityMode: "off",
  concurrency: 8,
  enabled: true,
  mode: "mainland",
}

export default function ThreadRipper() {
  const { t } = useTranslation()
  const [notify, ctx] = useNotification()
  const [settings, setSettings] = useState<ThreadRipperSettings>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    chrome.storage.sync.get(STORAGE_KEYS, (stored: Record<string, unknown>) => {
      log.info("loaded settings:", stored)
      const conc = Number(stored.concurrency)
      const mode = String(stored.mode)
      const compat = String(stored.compatibilityMode)
      setSettings({
        enabled: stored.enabled !== false,
        mode: mode === "overseas" ? "overseas" : "mainland",
        concurrency: [4, 8, 16, 32, 64, 128].includes(conc) ? conc : 8,
        compatibilityMode: compat === "a" || compat === "b" ? compat : "off",
      })
      setLoaded(true)
    })
  }, [])

  const update = (key: keyof ThreadRipperSettings, value: boolean | number | string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const save = () => {
    chrome.storage.sync.set(settings, () => {
      if (chrome.runtime.lastError) {
        notify.error({ message: t("保存失败"), description: chrome.runtime.lastError.message })
        return
      }
      log.info("saved:", settings)
      notify.info({ message: t("设置已保存") })
    })
  }

  if (!loaded) return null

  return (
    <>
      {ctx}
      <Card title={t("线程撕裂者")}>
        <Row>
          <Col span={6}>{t("功能开关")}：</Col>
          <Col>
            <Switch checked={settings.enabled} onChange={e => update("enabled", e)} />
          </Col>
        </Row>
        <br />
        <Row style={{ alignItems: "center" }}>
          <Col span={6}>{t("CDN模式")}：</Col>
          <Col>
            <Select
              value={settings.mode}
              style={{ width: 180 }}
              onChange={v => update("mode", v)}
              options={[
                { value: "mainland", label: t("大陆CDN（推荐）") },
                { value: "overseas", label: t("海外CDN") },
              ]}
            />
          </Col>
        </Row>
        <br />
        <Row style={{ alignItems: "center" }}>
          <Col span={6}>{t("并发线程")}：</Col>
          <Col>
            <Select
              value={settings.concurrency}
              style={{ width: 180 }}
              onChange={v => update("concurrency", v)}
              options={[4, 8, 16, 32, 64, 128].map(n => ({ value: n, label: String(n) }))}
            />
          </Col>
        </Row>
        <br />
        <Row style={{ alignItems: "center" }}>
          <Col span={6}>{t("兼容模式")}：</Col>
          <Col>
            <Select
              value={settings.compatibilityMode}
              style={{ width: 180 }}
              onChange={v => update("compatibilityMode", v)}
              options={[
                { value: "off", label: t("标准模式") },
                { value: "a", label: t("兼容模式 A") },
                { value: "b", label: t("兼容模式 B") },
              ]}
            />
          </Col>
        </Row>
        <br />
        <Row>
          <Button onClick={save}>{t("保存")}</Button>
        </Row>
      </Card>
    </>
  )
}
