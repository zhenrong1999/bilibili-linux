import { Button, Card, Col, Row, Select, Switch } from "antd"
import { useEffect, useRef, useState } from "react"
import { createLogger } from "../../../../common/log"
import useNotification from "antd/es/notification/useNotification"
import { useTranslation } from "react-i18next"

const log = createLogger("thread-ripper")
const CHANNEL = "__BILI_RANGE_ACCELERATOR_V1__"

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

function normalize(payload: Record<string, unknown>): ThreadRipperSettings {
  const conc = Number(payload.concurrency)
  const mode = String(payload.mode)
  const compat = String(payload.compatibilityMode)
  return {
    enabled: payload.enabled !== false,
    mode: mode === "overseas" ? "overseas" : "mainland",
    concurrency: [4, 8, 16, 32, 64, 128].includes(conc) ? conc : 8,
    compatibilityMode: compat === "a" || compat === "b" ? compat : "off",
  }
}

export default function ThreadRipper() {
  const { t } = useTranslation()
  const [notify, ctx] = useNotification()
  const [settings, setSettings] = useState<ThreadRipperSettings>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)
  const [hasRealSettings, setHasRealSettings] = useState(false)
  const receivedRef = useRef(false)

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.data?.channel !== CHANNEL) return
      if (event.data.type === "settings") {
        const next = normalize(event.data.payload || {})
        log.info("received settings:", next)
        setSettings(next)
        receivedRef.current = true
        setHasRealSettings(true)
        setLoaded(true)
      }
    }
    window.addEventListener("message", onMessage)
    // Request current settings from thread-ripper's bridge
    window.postMessage({ channel: CHANNEL, type: "settings-request" }, "*")
    // Fallback: if thread-ripper isn't loaded, show defaults after a short wait
    const timer = setTimeout(() => {
      if (!receivedRef.current) setLoaded(true)
    }, 2000)
    return () => {
      window.removeEventListener("message", onMessage)
      clearTimeout(timer)
    }
  }, [])

  const update = (key: keyof ThreadRipperSettings, value: boolean | number | string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const save = () => {
    window.postMessage({
      channel: CHANNEL,
      type: "settings-update",
      payload: {
        enabled: settings.enabled,
        mode: settings.mode,
        concurrency: settings.concurrency,
        compatibilityMode: settings.compatibilityMode,
      },
    }, "*")
    log.info("sent settings-update:", settings)
    if (hasRealSettings) {
      notify.info({ message: t("设置已保存") })
    } else {
      notify.warning({ message: t("未检测到线程撕裂者"), description: t("设置可能不会生效") })
    }
  }

  if (!loaded) return null

  return (
    <>
      {ctx}
      <Card title={t("线程撕裂者")}>
        {!hasRealSettings && (
          <Row style={{ marginBottom: 12 }}>
            <Col>
              <span style={{ color: "#faad14" }}>{t("未检测到线程撕裂者，设置可能不会生效")}</span>
            </Col>
          </Row>
        )}
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
