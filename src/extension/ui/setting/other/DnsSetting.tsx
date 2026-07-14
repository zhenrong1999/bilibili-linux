import { Button, Card, Input, Select, Switch, Row, Col } from "antd"
import { useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import type { RootState } from "../../store"
import { saveDnsConfig, type DnsConfig } from "../../store/dns"
import useNotification from "antd/es/notification/useNotification"
import { useTranslation } from "react-i18next"
import { createLogger } from "../../../../common/log"

const log = createLogger("dns-setting")

const { TextArea } = Input

export default function DnsSetting() {
  const { t } = useTranslation()
  const dispatcher = useDispatch()
  const [notify, ctx] = useNotification()

  const dnsState = useSelector<RootState, DnsConfig>(store => store.dns)
  const [dnsSetting, updateSetting] = useState<DnsConfig>({
    enableBuiltInResolver: !!dnsState.enableBuiltInResolver,
    secureDnsMode: dnsState.secureDnsMode || 'automatic',
    secureDnsServers: dnsState.secureDnsServers || [],
    enableAdditionalDnsQueryTypes: dnsState.enableAdditionalDnsQueryTypes !== false,
  })

  const updateSettingValue = <K extends keyof DnsConfig>(key: K, value: DnsConfig[K]) => {
    updateSetting(pre => ({ ...pre, [key]: value }))
  }

  const saveSetting = () => {
    dispatcher(saveDnsConfig(dnsSetting))
    // 同步到 main process
    try {
      window.biliBridge.callNativeSync('config/dnsConfig', JSON.stringify(dnsSetting))
    } catch (e) {
      log.error('failed to send dns config to main process', e)
    }
    notify.info({ message: t('设置已保存') })
  }

  return (
    <>
      {ctx}
      <Card title={t("DNS 设置")}>
        <div>
          <Row>
            <Col span={6}>{t("内置DNS解析器")}：</Col>
            <Col>
              <Switch
                checked={dnsSetting.enableBuiltInResolver}
                onChange={e => updateSettingValue('enableBuiltInResolver', e)}
              />
            </Col>
          </Row>
          <br />
          <Row>
            <Col span={6}>{t("安全DNS模式")}：</Col>
            <Col>
              <Select
                value={dnsSetting.secureDnsMode}
                style={{ width: 160 }}
                onChange={v => updateSettingValue('secureDnsMode', v)}
                options={[
                  { value: 'off', label: t('关闭') },
                  { value: 'automatic', label: t('自动') },
                  { value: 'secure', label: t('安全') },
                ]}
              />
            </Col>
          </Row>
          <br />
          <Row>
            <Col span={6}>{t("DoH服务器")}：</Col>
            <Col flex="auto">
              <TextArea
                rows={3}
                disabled={dnsSetting.secureDnsMode === 'off'}
                placeholder={t("每行一个DoH服务器地址，如：https://cloudflare-dns.com/dns-query")}
                value={dnsSetting.secureDnsServers.join('\n')}
                onChange={e => {
                  const lines = e.target.value.split('\n').filter(l => l.trim())
                  updateSettingValue('secureDnsServers', lines)
                }}
              />
            </Col>
          </Row>
          <br />
          <Row>
            <Col span={6}>{t("附加DNS查询类型")}：</Col>
            <Col>
              <Switch
                checked={dnsSetting.enableAdditionalDnsQueryTypes}
                onChange={e => updateSettingValue('enableAdditionalDnsQueryTypes', e)}
              />
            </Col>
          </Row>
          <br />
          <Row>
            <Button onClick={saveSetting}>{t("保存")}</Button>
          </Row>
        </div>
      </Card>
    </>
  )
}
