import { createSlice } from '@reduxjs/toolkit';

export interface DnsConfig {
  enableBuiltInResolver: boolean
  secureDnsMode: 'off' | 'automatic' | 'secure'
  secureDnsServers: string[]
  enableAdditionalDnsQueryTypes: boolean
}

const initialState: DnsConfig = (() => {
  try {
    const saved = localStorage.getItem('dns_config')
    if (saved) return JSON.parse(saved)
  } catch { /* use defaults */ }
  return {
    enableBuiltInResolver: false,
    secureDnsMode: 'automatic',
    secureDnsServers: [],
    enableAdditionalDnsQueryTypes: true,
  }
})()

export const dnsSlice = createSlice({
  name: 'dns',
  initialState,
  reducers: {
    saveDnsConfig: (state, action) => {
      const data = action.payload as DnsConfig
      state.enableBuiltInResolver = data.enableBuiltInResolver
      state.secureDnsMode = data.secureDnsMode
      state.secureDnsServers = data.secureDnsServers
      state.enableAdditionalDnsQueryTypes = data.enableAdditionalDnsQueryTypes
      localStorage.setItem('dns_config', JSON.stringify(state))
    },
    dnsSyncState: (state, action) => {
      return { ...state, ...action.payload }
    },
  },
})

export const { saveDnsConfig, dnsSyncState } = dnsSlice.actions
export default dnsSlice.reducer
