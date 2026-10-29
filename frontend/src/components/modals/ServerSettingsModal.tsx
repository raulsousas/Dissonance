/**
 * ServerSettingsModal — Discord-style full-screen overlay for managing server settings.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import * as Avatar from '@radix-ui/react-avatar'
import { X, Trash2, Users, Link, Sliders, AlertTriangle } from 'lucide-react'
import { useServerDetail, useInvites, useDeleteInvite, useDeleteServer } from '@/hooks/useServers'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/stores/toastStore'

interface Props {
  open: boolean
  onClose: () => void
  serverId: string
}

type Tab = 'overview' | 'members' | 'invites' | 'delete'

export function ServerSettingsModal({ open, onClose, serverId }: Props) {
  const { data: server } = useServerDetail(serverId)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const { data: invites = [] } = useInvites(serverId, open && activeTab === 'invites')
  const deleteInvite = useDeleteInvite()
  const deleteServer = useDeleteServer()
  const navigate = useNavigate()
  const { currentUser } = useAuth()

  const [name, setName] = useState(server?.name ?? '')
  const [description, setDescription] = useState(server?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  if (!server) return null

  const hasChanges = name !== server.name || description !== (server.description ?? '')
  const isOwner = !!currentUser && currentUser.id.toLowerCase() === server.ownerId.toLowerCase()

  async function handleSave() {
    setSaving(true)
    setSaveSuccess(false)
    try {
      const res = await fetch(`/api/servers/${serverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
        credentials: 'include',
      })
      if (res.ok) {
        setSaveSuccess(true)
        toast.success('Configurações do servidor salvas!')
        setTimeout(() => setSaveSuccess(false), 2000)
      } else {
        toast.error('Erro ao atualizar servidor')
      }
    } catch (err) {
      console.error('Failed to update server:', err)
      toast.error('Erro de conexão ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteServer() {
    if (window.confirm(`Tem certeza absoluta de que deseja excluir ${server?.name}? Esta ação é irreversível.`)) {
      try {
        await deleteServer.mutateAsync(serverId)
        toast.success('Servidor excluído')
        onClose()
        navigate('/app')
      } catch (err) {
        console.error('Failed to delete server:', err)
        toast.error('Falha ao excluir servidor')
      }
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#1B1C20] flex select-none overflow-hidden text-[#F2F3F5]">
          <Dialog.Content className="flex w-full h-full outline-none">
            {/* Left Sidebar */}
            <div className="w-60 bg-[#202127] flex justify-end py-14 pr-6 shrink-0 border-r border-[#3C3F48]/40">
              <div className="w-48 space-y-1">
                <p className="px-2.5 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#858B98] truncate">
                  {server.name}
                </p>

                <button
                  onClick={() => setActiveTab('overview')}
                  className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer text-left ${
                    activeTab === 'overview'
                      ? 'bg-[#34363E] text-white font-bold'
                      : 'text-[#858B98] hover:bg-[#3B3E47]/50 hover:text-[#F2F3F5]'
                  }`}
                >
                  <Sliders size={16} /> Visão Geral
                </button>

                <button
                  onClick={() => setActiveTab('members')}
                  className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer text-left ${
                    activeTab === 'members'
                      ? 'bg-[#34363E] text-white font-bold'
                      : 'text-[#858B98] hover:bg-[#3B3E47]/50 hover:text-[#F2F3F5]'
                  }`}
                >
                  <Users size={16} /> Membros
                </button>

                <button
                  onClick={() => setActiveTab('invites')}
                  className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer text-left ${
                    activeTab === 'invites'
                      ? 'bg-[#34363E] text-white font-bold'
                      : 'text-[#858B98] hover:bg-[#3B3E47]/50 hover:text-[#F2F3F5]'
                  }`}
                >
                  <Link size={16} /> Convites
                </button>

                {isOwner && (
                  <>
                    <div className="pt-2 pb-1">
                      <div className="h-px bg-[#3C3F48] mx-2" />
                    </div>

                    <button
                      onClick={() => setActiveTab('delete')}
                      className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer text-left ${
                        activeTab === 'delete'
                          ? 'bg-[#F04747]/20 text-[#F04747] font-bold'
                          : 'text-[#F04747] hover:bg-[#F04747]/10'
                      }`}
                    >
                      <Trash2 size={16} /> Excluir Servidor
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Right Content */}
            <div className="flex-1 bg-[#1B1C20] py-14 px-10 overflow-y-auto max-w-2xl relative text-[#F2F3F5]">
              {/* Close Button + ESC indicator */}
              <div className="fixed top-12 right-16 flex flex-col items-center gap-1 z-50">
                <Dialog.Close asChild>
                  <button
                    className="w-9 h-9 rounded-full border border-[#858B98] text-[#858B98] hover:text-white hover:border-white flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Fechar"
                  >
                    <X size={18} />
                  </button>
                </Dialog.Close>
                <span className="text-[11px] font-bold text-[#858B98]">ESC</span>
              </div>

              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold text-[#F2F3F5]">Visão Geral do Servidor</h2>

                  <div className="p-4 rounded-xl bg-[#2B2D33] border border-[#3C3F48]/40 space-y-4">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-[#858B98] block mb-1">
                        Nome do Servidor
                      </label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#1B1C20] text-[#F2F3F5] text-sm outline-none border border-[#3C3F48] focus:border-[#7667F5] transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-[#858B98] block mb-1">
                        Descrição do Servidor
                      </label>
                      <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Conte um pouco sobre o que é este servidor..."
                        className="w-full px-3 py-2 rounded-lg bg-[#1B1C20] text-[#F2F3F5] text-sm outline-none border border-[#3C3F48] focus:border-[#7667F5] resize-none transition-all"
                      />
                    </div>
                  </div>

                  {hasChanges && (
                    <div className="p-3.5 rounded-xl bg-[#202127] flex items-center justify-between border border-[#3C3F48]">
                      <span className="text-xs text-[#F2F3F5] font-medium">
                        Você tem alterações pendentes.
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setName(server.name)
                            setDescription(server.description ?? '')
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#B5BAC3] hover:text-white cursor-pointer"
                        >
                          Redefinir
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={saving || !name.trim()}
                          className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#35C98A] hover:bg-[#30b57c] text-white transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                        >
                          {saving ? 'Salvando...' : saveSuccess ? 'Salvo!' : 'Salvar Alterações'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'members' && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-[#F2F3F5]">
                    Membros do Servidor ({server.members?.length ?? 0})
                  </h2>

                  <div className="p-2 rounded-xl bg-[#2B2D33] border border-[#3C3F48]/40 space-y-1">
                    {server.members?.map((m) => (
                      <div
                        key={m.userId}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-[#34363E] transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar.Root className="w-8 h-8 rounded-full overflow-hidden block bg-[#1B1C20]">
                            <Avatar.Image src={m.avatarUrl ?? undefined} alt={m.displayName} />
                            <Avatar.Fallback className="w-full h-full flex items-center justify-center text-xs font-bold text-white bg-[#7667F5]">
                              {m.displayName[0]?.toUpperCase()}
                            </Avatar.Fallback>
                          </Avatar.Root>
                          <span className="text-sm font-semibold text-[#F2F3F5]">{m.displayName}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#1B1C20] text-[#858B98] border border-[#3C3F48]">
                          {m.userId === server.ownerId ? 'Dono' : m.role?.name ?? 'Membro'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'invites' && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-[#f2f3f5]">
                    Convites Ativos ({invites.length})
                  </h2>

                  <div className="p-2 rounded-lg bg-[#2b2d31] space-y-1">
                    {invites.length === 0 ? (
                      <p className="text-xs text-[#949ba4] p-3 text-center">
                        Nenhum convite ativo encontrado.
                      </p>
                    ) : (
                      invites.map((inv) => (
                        <div
                          key={inv.code}
                          className="flex items-center justify-between p-2.5 rounded bg-[#1e1f22] text-xs"
                        >
                          <div>
                            <p className="font-mono text-[#f2f3f5] font-semibold">{inv.code}</p>
                            <p className="text-[11px] text-[#949ba4]">Usos: {inv.uses}</p>
                          </div>
                          <button
                            onClick={() => deleteInvite.mutate({ serverId, code: inv.code })}
                            className="p-1.5 rounded text-[#949ba4] hover:text-[#f23f43] hover:bg-[#35373c] transition-colors cursor-pointer"
                            title="Revogar convite"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'delete' && isOwner && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold text-[#f23f43]">Excluir Servidor</h2>

                  <div className="p-4 rounded-lg bg-[#2b2d31] border border-[#f23f43]/40 space-y-3">
                    <div className="flex items-center gap-2 text-[#f23f43]">
                      <AlertTriangle size={20} />
                      <p className="text-sm font-bold">Zona de Perigo</p>
                    </div>
                    <p className="text-xs text-[#dbdee1] leading-relaxed">
                      Ao excluir o servidor <strong>{server.name}</strong>, todos os canais, mensagens, anexos e configurações serão excluídos permanentemente.
                    </p>
                    <button
                      onClick={handleDeleteServer}
                      className="px-4 py-2 rounded text-xs font-semibold bg-[#f23f43] hover:bg-[#da373c] text-white transition-colors cursor-pointer"
                    >
                      Excluir {server.name}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
