/**
 * Lycero Office Desktop
 * Copyright © 2026 ITAC AI Heavy Industries. All rights reserved.
 */
import { useCallback, useEffect, useState } from 'react'
import type {
  McpClientsConfig,
  McpClientServerStatus,
  McpDiscoveredTool,
  McpServerClientConfig,
} from '../../shared/home-api'
import type { TFunc } from './locale'

const PRESET_TEMPLATES: Record<
  string,
  { label: string; desc: string; config: McpServerClientConfig }
> = {
  filesystem: {
    label: 'Thư mục tệp cục bộ (Filesystem)',
    desc: 'Cho phép Lycero Mate đọc, tìm kiếm và tạo tệp trong thư mục chỉ định',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', 'D:\\Documents'],
    },
  },
  postgres: {
    label: 'Cơ sở dữ liệu PostgreSQL',
    desc: 'Truy vấn bảng dữ liệu, học sinh, nhân sự hoặc hóa đơn vào Office Sheets',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost:5432/lycero_db'],
    },
  },
  sqlite: {
    label: 'Cơ sở dữ liệu SQLite',
    desc: 'Đọc và truy vấn nhanh tệp cơ sở dữ liệu cục bộ .sqlite/.db',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sqlite', '--db-path', 'D:\\data.db'],
    },
  },
  fetch: {
    label: 'Thu thập nội dung Web (Fetch)',
    desc: 'Cho phép AI cào và phân tích trực tiếp nội dung từ mọi đường link web',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch'],
    },
  },
}

export function McpClientsPane({ t }: { t: TFunc }) {
  const [config, setConfig] = useState<McpClientsConfig>({ mcpServers: {} })
  const [statuses, setStatuses] = useState<McpClientServerStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [testingServer, setTestingServer] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{
    server: string
    success: boolean
    message: string
  } | null>(null)
  const [expandedTools, setExpandedTools] = useState<string | null>(null)

  // Modal Thêm / Sửa server
  const [modalOpen, setModalOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formTransport, setFormTransport] = useState<'stdio' | 'sse'>('stdio')
  const [formCommand, setFormCommand] = useState('')
  const [formArgs, setFormArgs] = useState('')
  const [formUrl, setFormUrl] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const cfg = await window.aiOffice.getMcpClientsConfig()
      setConfig(cfg)
      const st = await window.aiOffice.getMcpServersStatus()
      setStatuses(st)
    } catch (err) {
      console.error('Failed to load MCP clients config:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const handleToggleEnable = async (name: string, currentDisabled?: boolean) => {
    const nextConfig: McpClientsConfig = {
      mcpServers: {
        ...config.mcpServers,
        [name]: {
          ...config.mcpServers[name]!,
          disabled: !currentDisabled,
        },
      },
    }
    setConfig(nextConfig)
    await window.aiOffice.saveMcpClientsConfig(nextConfig)
    void loadAll()
  }

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa cấu hình MCP Server "${name}"?`)) return
    const next = { ...config.mcpServers }
    delete next[name]
    const nextConfig = { mcpServers: next }
    setConfig(nextConfig)
    await window.aiOffice.saveMcpClientsConfig(nextConfig)
    void loadAll()
  }

  const handleTest = async (name: string) => {
    setTestingServer(name)
    setTestResult(null)
    try {
      const res = await window.aiOffice.testMcpServer(name)
      setTestResult({ server: name, success: res.success, message: res.message })
      void loadAll()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setTestResult({ server: name, success: false, message: msg })
    } finally {
      setTestingServer(null)
    }
  }

  const handleOpenModal = (name?: string) => {
    if (name && config.mcpServers[name]) {
      const target = config.mcpServers[name]!
      setEditingKey(name)
      setFormName(name)
      setFormTransport(target.url ? 'sse' : 'stdio')
      setFormCommand(target.command || '')
      setFormArgs(target.args ? target.args.join(' ') : '')
      setFormUrl(target.url || '')
    } else {
      setEditingKey(null)
      setFormName('')
      setFormTransport('stdio')
      setFormCommand('npx')
      setFormArgs('')
      setFormUrl('')
    }
    setModalOpen(true)
  }

  const handleApplyPreset = (presetKey: string) => {
    const p = PRESET_TEMPLATES[presetKey]
    if (!p) return
    setEditingKey(presetKey)
    setFormName(presetKey)
    setFormTransport(p.config.url ? 'sse' : 'stdio')
    setFormCommand(p.config.command || '')
    setFormArgs(p.config.args ? p.config.args.join(' ') : '')
    setFormUrl(p.config.url || '')
    setModalOpen(true)
  }

  const handleSaveModal = async () => {
    const trimmedName = formName.trim().replace(/\s+/g, '-')
    if (!trimmedName) {
      alert('Vui lòng nhập tên MCP Server')
      return
    }

    const newServerConfig: Partial<McpServerClientConfig> = {}
    if (formTransport === 'sse') {
      if (!formUrl.trim()) {
        alert('Vui lòng nhập URL máy chủ MCP')
        return
      }
      newServerConfig.url = formUrl.trim()
    } else {
      if (!formCommand.trim()) {
        alert('Vui lòng nhập lệnh thực thi (Command)')
        return
      }
      newServerConfig.command = formCommand.trim()
      newServerConfig.args = formArgs
        .trim()
        .split(' ')
        .filter((a) => a.length > 0)
    }

    const next = { ...config.mcpServers }
    if (editingKey && editingKey !== trimmedName) {
      delete next[editingKey]
    }
    next[trimmedName] = newServerConfig as McpServerClientConfig
    const nextConfig = { mcpServers: next }

    setConfig(nextConfig)
    await window.aiOffice.saveMcpClientsConfig(nextConfig)
    setModalOpen(false)
    void loadAll()
  }

  const serversList = Object.entries(config.mcpServers)

  return (
    <div className="set-pane mcp-clients-pane">
      <div className="set-pane-head">
        <h2 className="set-pane-title">Model Context Protocol (MCP)</h2>
        <p className="set-pane-desc">
          Chuẩn giao thức mở (2026-07-28 / Anthropic & W3C) cho phép Lycero Mate kết nối các công
          cụ bên ngoài như Database, Git, Filesystem, Google Drive, Notion. Tương thích hoàn toàn với
          cấu hình của Claude Desktop và Cursor.
        </p>
      </div>

      <div className="mcp-actions-bar" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => handleOpenModal()}
          style={{
            background: 'var(--color-accent-terracotta, #8B3A1A)',
            color: '#fff',
            border: 'none',
            padding: '7px 14px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          + Thêm MCP Server
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void window.aiOffice.openMcpConfigFile()}
          style={{
            padding: '7px 14px',
            borderRadius: '6px',
            border: '1px solid #DDD9CE',
            background: '#fff',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          📂 Sửa file JSON cấu hình
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void loadAll()}
          disabled={loading}
          style={{
            padding: '7px 14px',
            borderRadius: '6px',
            border: '1px solid #DDD9CE',
            background: '#fff',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          🔄 Làm mới
        </button>
      </div>

      {testResult && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            marginBottom: '14px',
            fontSize: '13px',
            backgroundColor: testResult.success ? '#f0f9f0' : '#fdf2f2',
            border: `1px solid ${testResult.success ? '#b2e2b2' : '#f5c6c6'}`,
            color: testResult.success ? '#1e7e34' : '#bd2130',
          }}
        >
          <strong>[{testResult.server}]</strong> {testResult.message}
        </div>
      )}

      {/* Danh sách máy chủ MCP đã cấu hình */}
      <div className="mcp-servers-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {serversList.length === 0 ? (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              backgroundColor: '#F9F8F3',
              borderRadius: '8px',
              border: '1px dashed #DDD9CE',
              color: '#6B6860',
              fontSize: '13.5px',
            }}
          >
            Chưa có MCP Server nào được cấu hình. Hãy thêm server mới hoặc chọn nhanh từ danh mục mẫu bên dưới.
          </div>
        ) : (
          serversList.map(([name, srv]) => {
            const st = statuses.find((s) => s.name === name)
            const isTesting = testingServer === name
            const isExpanded = expandedTools === name
            const tools = st?.tools || []

            return (
              <div
                key={name}
                style={{
                  border: '1px solid #DDD9CE',
                  borderRadius: '8px',
                  backgroundColor: srv.disabled ? '#F4F2EB' : '#fff',
                  padding: '14px 16px',
                  opacity: srv.disabled ? 0.75 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        backgroundColor: srv.url ? '#e8f4fd' : '#fbf0ea',
                        color: srv.url ? '#0d6efd' : '#8B3A1A',
                        textTransform: 'uppercase',
                      }}
                    >
                      {srv.url ? 'HTTP SSE' : 'STDIO'}
                    </span>
                    <strong style={{ fontSize: '14px', color: '#1C1B18' }}>{name}</strong>
                    {srv.disabled ? (
                      <span style={{ fontSize: '12px', color: '#999' }}>● Đã tắt</span>
                    ) : (
                      <span
                        style={{
                          fontSize: '12px',
                          color: st?.status === 'connected' ? '#28a745' : '#e67e22',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        ● {st?.status === 'connected' ? `Đã kết nối (${tools.length} tools)` : 'Chưa kết nối'}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => void handleToggleEnable(name, srv.disabled)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        borderRadius: '4px',
                        border: '1px solid #DDD9CE',
                        background: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      {srv.disabled ? 'Bật' : 'Tắt'}
                    </button>
                    {!srv.disabled && (
                      <button
                        type="button"
                        onClick={() => void handleTest(name)}
                        disabled={isTesting}
                        style={{
                          padding: '4px 10px',
                          fontSize: '12px',
                          borderRadius: '4px',
                          border: '1px solid #DDD9CE',
                          background: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        {isTesting ? 'Đang thử...' : '⚡ Thử kết nối'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenModal(name)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        borderRadius: '4px',
                        border: '1px solid #DDD9CE',
                        background: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(name)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        borderRadius: '4px',
                        border: '1px solid #f5c6c6',
                        background: '#fff',
                        color: '#c82333',
                        cursor: 'pointer',
                      }}
                    >
                      Xóa
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '8px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    color: '#555',
                    backgroundColor: '#F9F8F3',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    overflowX: 'auto',
                  }}
                >
                  {srv.url || `${srv.command} ${(srv.args || []).join(' ')}`}
                </div>

                {tools.length > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setExpandedTools(isExpanded ? null : name)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#8B3A1A',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {isExpanded ? '▲ Thu gọn danh sách công cụ' : `▼ Xem ${tools.length} công cụ phát hiện được`}
                    </button>

                    {isExpanded && (
                      <div
                        style={{
                          marginTop: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          paddingLeft: '8px',
                          borderLeft: '2px solid #8B3A1A',
                        }}
                      >
                        {tools.map((t) => (
                          <div key={t.name} style={{ fontSize: '12px' }}>
                            <strong style={{ color: '#1C1B18' }}>{t.name}</strong>
                            {t.description && (
                              <span style={{ color: '#6B6860', marginLeft: '6px' }}>
                                — {t.description}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Mẫu cấu hình nhanh có sẵn */}
      <div style={{ marginTop: '28px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px', color: '#1C1B18' }}>
          Mẫu Kết Nối Phổ Biến (Khởi Tạo Nhanh)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {Object.entries(PRESET_TEMPLATES).map(([key, item]) => (
            <div
              key={key}
              style={{
                border: '1px solid #DDD9CE',
                borderRadius: '8px',
                padding: '12px 14px',
                backgroundColor: '#F9F8F3',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <div>
                <strong style={{ fontSize: '13px', color: '#1C1B18' }}>{item.label}</strong>
                <p style={{ fontSize: '11.5px', color: '#6B6860', margin: '4px 0 0' }}>{item.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => handleApplyPreset(key)}
                style={{
                  alignSelf: 'flex-start',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#8B3A1A',
                  background: 'none',
                  border: '1px solid #ebd3c8',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: '#fff',
                }}
              >
                + Áp dụng mẫu
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Thêm / Chỉnh Sửa MCP Server */}
      {modalOpen && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            className="modal"
            style={{
              backgroundColor: '#fff',
              borderRadius: '10px',
              width: '520px',
              maxWidth: '90vw',
              padding: '24px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#1C1B18' }}>
              {editingKey ? `Chỉnh sửa MCP Server: ${editingKey}` : 'Thêm MCP Server Mới'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '4px' }}>
                  Tên Server (Mã định danh):
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="ví dụ: filesystem, postgres, github..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #DDD9CE',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                  Kiểu Giao Thức Kết Nối:
                </label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="radio"
                      name="transport"
                      checked={formTransport === 'stdio'}
                      onChange={() => setFormTransport('stdio')}
                    />
                    Lệnh cục bộ (STDIO Subprocess)
                  </label>
                  <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="radio"
                      name="transport"
                      checked={formTransport === 'sse'}
                      onChange={() => setFormTransport('sse')}
                    />
                    Máy chủ HTTP SSE (Remote/Local URL)
                  </label>
                </div>
              </div>

              {formTransport === 'stdio' ? (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '4px' }}>
                      Lệnh Thực Thi (Command):
                    </label>
                    <input
                      type="text"
                      value={formCommand}
                      onChange={(e) => setFormCommand(e.target.value)}
                      placeholder="npx, python, node, uvx..."
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #DDD9CE',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '4px' }}>
                      Các Đối Số (Args, cách nhau dấu cách):
                    </label>
                    <input
                      type="text"
                      value={formArgs}
                      onChange={(e) => setFormArgs(e.target.value)}
                      placeholder="-y @modelcontextprotocol/server-... [options]"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #DDD9CE',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '4px' }}>
                    Địa Chỉ URL Máy Chủ SSE:
                  </label>
                  <input
                    type="url"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    placeholder="https://mcp.mycompany.com/sse hoặc http://localhost:8000/sse"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #DDD9CE',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: '20px',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModalOpen(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: '1px solid #DDD9CE',
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleSaveModal()}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  background: 'var(--color-accent-terracotta, #8B3A1A)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Lưu Cấu Hình
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
