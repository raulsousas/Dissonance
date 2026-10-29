/**
 * UserSettingsModal — Discord-style full-screen overlay settings modal.
 */

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import * as Avatar from '@radix-ui/react-avatar'
import { X, Camera, LogOut, User, Volume2, Palette, Check, Shield } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/stores/toastStore'
import { useThemeStore } from '@/stores/themeStore'

interface Props {
  open: boolean
  onClose: () => void
}

type Tab = 'account' | 'appearance' | 'voice'

export function UserSettingsModal({ open, onClose }: Props) {
  const { currentUser, logout, updateUser } = useAuth()
  const { theme, setTheme } = useThemeStore()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('account')
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? '')
  const [status, setStatus] = useState(currentUser?.status ?? 'online')
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl ?? '')
  const [customStatus, setCustomStatus] = useState(() => localStorage.getItem('guilda-custom-status') || '')
  const [bannerColor, setBannerColor] = useState(() => localStorage.getItem('guilda-banner-color') || '#5865f2')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName)
      setStatus(currentUser.status || 'online')
      setAvatarUrl(currentUser.avatarUrl ?? '')
      setCustomStatus(localStorage.getItem('guilda-custom-status') || '')
      setBannerColor(localStorage.getItem('guilda-banner-color') || '#5865f2')
    }
  }, [currentUser, open])

  const BANNER_COLORS = ['#5865f2', '#eb459e', '#57f287', '#fee75c', '#ed4245', '#1e1f22', '#3ba55d', '#00a8fc']

  if (!currentUser) return null

  const hasChanges =
    displayName !== currentUser.displayName ||
    status !== currentUser.status ||
    avatarUrl !== (currentUser.avatarUrl ?? '') ||
    customStatus !== (localStorage.getItem('guilda-custom-status') || '') ||
    bannerColor !== (localStorage.getItem('guilda-banner-color') || '#5865f2')

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        if (data.attachment?.url) {
          setAvatarUrl(data.attachment.url)
        }
      }
    } catch (err) {
      console.error('Failed to upload avatar:', err)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaveSuccess(false)
    try {
      await updateUser({
        displayName,
        status: status as any,
        avatarUrl: avatarUrl || null,
      })
      localStorage.setItem('guilda-custom-status', customStatus)
      localStorage.setItem('guilda-banner-color', bannerColor)
      window.dispatchEvent(new Event('guilda-custom-status-updated'))
      setSaveSuccess(true)
      toast.success('Perfil atualizado com sucesso!')
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (err) {
      console.error('Failed to update profile:', err)
      toast.error('Erro ao salvar perfil')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#1B1C20] flex select-none overflow-hidden text-[#F2F3F5]">
          <Dialog.Content className="flex w-full h-full outline-none">
            {/* Left Settings Navigation Bar */}
            <div className="w-60 bg-[#202127] flex justify-end py-14 pr-6 shrink-0 border-r border-[#3C3F48]/40">
              <div className="w-48 space-y-1">
                <p className="px-2.5 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#858B98]">
                  Configurações do Usuário
                </p>

                <button
                  onClick={() => setActiveTab('account')}
                  className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer text-left ${
                    activeTab === 'account'
                      ? 'bg-[#34363E] text-white font-bold'
                      : 'text-[#858B98] hover:bg-[#3B3E47]/50 hover:text-[#F2F3F5]'
                  }`}
                >
                  <User size={16} /> Minha Conta
                </button>

                <button
                  onClick={() => setActiveTab('appearance')}
                  className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer text-left ${
                    activeTab === 'appearance'
                      ? 'bg-[#34363E] text-white font-bold'
                      : 'text-[#858B98] hover:bg-[#3B3E47]/50 hover:text-[#F2F3F5]'
                  }`}
                >
                  <Palette size={16} /> Aparência
                </button>

                <button
                  onClick={() => setActiveTab('voice')}
                  className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer text-left ${
                    activeTab === 'voice'
                      ? 'bg-[#34363E] text-white font-bold'
                      : 'text-[#858B98] hover:bg-[#3B3E47]/50 hover:text-[#F2F3F5]'
                  }`}
                >
                  <Volume2 size={16} /> Voz & Vídeo
                </button>

                {currentUser.role === 'admin' && (
                  <button
                    onClick={() => {
                      onClose()
                      navigate('/admin')
                    }}
                    className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-sm font-bold text-[#7667F5] hover:bg-[#7667F5]/10 transition-colors cursor-pointer text-left"
                  >
                    <Shield size={16} /> Painel Admin
                  </button>
                )}

                <div className="pt-2 pb-1">
                  <div className="h-px bg-[#3C3F48] mx-2" />
                </div>

                <button
                  onClick={() => {
                    onClose()
                    logout()
                  }}
                  className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-sm font-semibold text-[#F04747] hover:bg-[#F04747]/10 transition-colors cursor-pointer text-left"
                >
                  <LogOut size={16} /> Sair da Conta
                </button>
              </div>
            </div>

            {/* Right Settings Content Area */}
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

              {activeTab === 'account' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold text-[#F2F3F5]">Minha Conta</h2>

                  {/* Profile Card Container */}
                  <div className="rounded-xl bg-[#202127] overflow-hidden border border-[#3C3F48]/40">
                    <div className="h-24 relative" style={{ background: bannerColor }} />
                    <div className="px-6 pb-6 relative">
                      <div className="flex items-end justify-between -mt-12 mb-4">
                        <div className="relative group">
                          <Avatar.Root className="w-20 h-20 rounded-full border-4 border-[#202127] overflow-hidden block bg-[#2B2D33]">
                            <Avatar.Image
                              src={avatarUrl || currentUser.avatarUrl || undefined}
                              alt={displayName}
                              className="w-full h-full object-cover"
                            />
                            <Avatar.Fallback className="w-full h-full flex items-center justify-center text-2xl font-bold text-white bg-[#7667F5]">
                              {displayName[0]?.toUpperCase() ?? '?'}
                            </Avatar.Fallback>
                          </Avatar.Root>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-semibold transition-opacity cursor-pointer"
                          >
                            <Camera size={18} className="mb-0.5" />
                            <span>MUDAR</span>
                          </button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAvatarUpload}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 rounded-lg text-xs font-bold bg-[#7667F5] hover:bg-[#6857ea] text-white transition-colors cursor-pointer shadow-xs"
                        >
                          Trocar Avatar
                        </button>
                      </div>

                      <div className="space-y-4 bg-[#2B2D33] p-4 rounded-xl border border-[#3C3F48]/40">
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-[#858B98] block mb-1">
                            Nome de exibição
                          </label>
                          <input
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-[#1B1C20] text-[#F2F3F5] text-sm outline-none border border-[#3C3F48] focus:border-[#7667F5] transition-all"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-[#858B98] block mb-1">
                            E-mail
                          </label>
                          <input
                            readOnly
                            value={currentUser.email}
                            className="w-full px-3 py-2 rounded-lg bg-[#1B1C20] text-[#858B98] text-sm outline-none opacity-80 cursor-not-allowed border border-[#3C3F48]/40"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-[#858B98] block mb-1">
                            Status
                          </label>
                          <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as any)}
                            className="w-full px-3 py-2 rounded-lg bg-[#1B1C20] text-[#F2F3F5] text-sm outline-none border border-[#3C3F48] focus:border-[#7667F5] cursor-pointer"
                          >
                            <option value="online">🟢 Disponível</option>
                            <option value="away">🟡 Ausente</option>
                            <option value="dnd">🔴 Não Perturbe</option>
                            <option value="invisible">⚪ Invisível</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-[#858B98] block mb-1">
                            Recado / Status Personalizado
                          </label>
                          <input
                            value={customStatus}
                            onChange={(e) => setCustomStatus(e.target.value)}
                            placeholder="O que está acontecendo? (ex: Jogando CS2, Ouvindo música...)"
                            className="w-full px-3 py-2 rounded-lg bg-[#1B1C20] text-[#F2F3F5] text-sm outline-none border border-[#3C3F48] focus:border-[#7667F5] transition-all"
                          />
                        </div>

                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[#858B98] mb-1">
                              Chamados de atenção
                            </p>
                            <p className="text-xs text-[#B5BAC3] leading-relaxed">
                              Permite que seus amigos chamem sua atenção com um aviso discreto.
                              Desative para não receber nenhum.
                            </p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={currentUser.allowNudges !== false}
                            aria-label="Permitir chamados de atenção"
                            onClick={async () => {
                              const next = currentUser.allowNudges === false
                              await updateUser({ allowNudges: next })
                              queryClient.invalidateQueries({ queryKey: ['friends'] })
                              toast.success(next ? 'Chamados de atenção ativados' : 'Chamados de atenção desativados')
                            }}
                            className={`relative shrink-0 w-10 h-6 rounded-full transition-colors cursor-pointer ${
                              currentUser.allowNudges !== false ? 'bg-[#35C98A]' : 'bg-[#3C3F48]'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                                currentUser.allowNudges !== false ? 'translate-x-4' : ''
                              }`}
                            />
                          </button>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-[#858B98] block mb-2">
                            Cor do Banner
                          </label>
                          <div className="flex gap-2">
                            {BANNER_COLORS.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setBannerColor(c)}
                                style={{ background: c }}
                                className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                                  bannerColor === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Save changes footer bar */}
                  {hasChanges && (
                    <div className="fixed bottom-6 max-w-xl w-full p-3.5 rounded-xl bg-[#202127] flex items-center justify-between shadow-2xl border border-[#3C3F48] animate-in fade-in slide-in-from-bottom-2">
                      <span className="text-xs text-[#F2F3F5] font-medium">
                        Cuidado — você tem alterações não salvas!
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setDisplayName(currentUser.displayName)
                            setStatus(currentUser.status)
                            setAvatarUrl(currentUser.avatarUrl ?? '')
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#B5BAC3] hover:text-white cursor-pointer"
                        >
                          Redefinir
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={saving || !displayName.trim()}
                          className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#35C98A] hover:bg-[#30b57c] text-white transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                        >
                          {saving ? 'Salvando...' : saveSuccess ? 'Salvo!' : 'Salvar Alterações'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'appearance' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold text-[#f2f3f5]">Aparência</h2>

                  <div className="space-y-3">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#b5bac1] block">
                      Tema
                    </label>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Dark */}
                      <button
                        type="button"
                        onClick={() => setTheme('dark')}
                        className={`p-4 rounded-lg flex flex-col gap-3 text-left border transition-all cursor-pointer relative ${
                          theme === 'dark'
                            ? 'border-[#5865f2] bg-[#2b2d31]'
                            : 'border-[#232428] bg-[#1e1f22] hover:border-[#3f4248]'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-sm font-bold text-[#f2f3f5]">Escuro</span>
                          {theme === 'dark' && <Check size={16} className="text-[#5865f2]" />}
                        </div>
                        <div className="h-10 rounded bg-[#313338] border border-[#232428] flex items-center px-2.5 gap-2">
                          <div className="w-3 h-3 rounded-full bg-[#5865f2]" />
                          <div className="w-12 h-2 rounded bg-[#4e5058]" />
                        </div>
                      </button>

                      {/* AMOLED */}
                      <button
                        type="button"
                        onClick={() => setTheme('amoled')}
                        className={`p-4 rounded-lg flex flex-col gap-3 text-left border transition-all cursor-pointer relative ${
                          theme === 'amoled'
                            ? 'border-[#5865f2] bg-[#111214]'
                            : 'border-[#232428] bg-[#000000] hover:border-[#3f4248]'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-sm font-bold text-[#f2f3f5]">Midnight (AMOLED)</span>
                          {theme === 'amoled' && <Check size={16} className="text-[#5865f2]" />}
                        </div>
                        <div className="h-10 rounded bg-[#000000] border border-[#232428] flex items-center px-2.5 gap-2">
                          <div className="w-3 h-3 rounded-full bg-[#5865f2]" />
                          <div className="w-12 h-2 rounded bg-[#232428]" />
                        </div>
                      </button>

                      {/* Light */}
                      <button
                        type="button"
                        onClick={() => setTheme('light')}
                        className={`p-4 rounded-lg flex flex-col gap-3 text-left border transition-all cursor-pointer relative ${
                          theme === 'light'
                            ? 'border-[#5865f2] bg-[#ebedef]'
                            : 'border-[#232428] bg-[#ffffff] hover:border-[#3f4248]'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-sm font-bold text-[#2e3338]">Claro</span>
                          {theme === 'light' && <Check size={16} className="text-[#5865f2]" />}
                        </div>
                        <div className="h-10 rounded bg-[#f2f3f5] border border-[#d4d7dc] flex items-center px-2.5 gap-2">
                          <div className="w-3 h-3 rounded-full bg-[#5865f2]" />
                          <div className="w-12 h-2 rounded bg-[#b5bac1]" />
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'voice' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold text-[#f2f3f5]">Configurações de Voz & Vídeo</h2>

                  <div className="bg-[#2b2d31] p-4 rounded-lg space-y-4">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-[#b5bac1] block mb-1">
                        Dispositivo de Entrada
                      </label>
                      <select className="w-full px-3 py-2 rounded bg-[#1e1f22] text-[#f2f3f5] text-sm outline-none cursor-pointer">
                        <option>Microfone Padrão do Sistema</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-[#b5bac1] block mb-1">
                        Dispositivo de Saída
                      </label>
                      <select className="w-full px-3 py-2 rounded bg-[#1e1f22] text-[#f2f3f5] text-sm outline-none cursor-pointer">
                        <option>Alto-falantes / Fones Padrão</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-[#b5bac1] block mb-2">
                        Sensibilidade de Entrada
                      </label>
                      <input
                        type="range"
                        defaultValue={75}
                        className="w-full accent-[#5865f2] cursor-pointer"
                      />
                    </div>
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
