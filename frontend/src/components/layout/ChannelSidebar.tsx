import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, Hash, Volume2, Plus, UserPlus, Settings, LogOut, FolderPlus, X, MicOff, Headphones } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Dialog from '@radix-ui/react-dialog'
import * as Avatar from '@radix-ui/react-avatar'
import { useServerDetail, useChannels, useCreateChannel, useCreateCategory, useCreateInvite, useLeaveServer, type Channel } from '@/hooks/useServers'
import { useAuth } from '@/hooks/useAuth'
import { useVoiceStore } from '@/stores/voiceStore'
import { useVoice } from '@/hooks/useVoice'
import { usePresence } from '@/hooks/usePresence'
import { ServerSettingsModal } from '@/components/modals/ServerSettingsModal'
import { toast } from '@/stores/toastStore'

interface Props {
  serverId: string | null
}

export default function ChannelSidebar({ serverId }: Props) {
  const { currentUser, isLoading: authLoading } = useAuth()
  const { data: server } = useServerDetail(serverId)
  const { data: categories = [] } = useChannels(serverId)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [serverSettingsOpen, setServerSettingsOpen] = useState(false)
  const [targetChannel, setTargetChannel] = useState<Channel | null>(null)

  if (!serverId) return <EmptySidebar />
  if (!server || authLoading) return <LoadingSidebar />

  // Compare both as lowercase strings to guard against casing differences
  const isOwner = !!currentUser && currentUser.id.toLowerCase() === server.ownerId.toLowerCase()

  function handleOpenInvite(channel?: Channel) {
    setTargetChannel(channel ?? null)
    setInviteOpen(true)
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg-secondary)' }}>
      <ServerHeader
        server={server}
        isOwner={isOwner}
        onOpenInvite={() => handleOpenInvite()}
        onOpenSettings={() => setServerSettingsOpen(true)}
      />
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
        {categories.map((cat) => (
          <CategorySection
            key={cat.id}
            category={cat}
            serverId={server.id}
            isOwner={isOwner}
            onOpenInvite={handleOpenInvite}
          />
        ))}
        {/* Show setup UI whenever there are no channels — owner can act, non-owner sees message */}
        {categories.length === 0 && (
          <EmptyChannelState serverId={server.id} canCreate={isOwner} />
        )}
      </div>

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        serverId={server.id}
        serverName={server.name}
        channel={targetChannel}
      />

      <ServerSettingsModal
        open={serverSettingsOpen}
        onClose={() => setServerSettingsOpen(false)}
        serverId={server.id}
      />
    </div>
  )
}

function EmptyChannelState({ serverId, canCreate }: { serverId: string; canCreate: boolean }) {
  const createCategory = useCreateCategory()
  const createChannel = useCreateChannel()
  const [step, setStep] = useState<'idle' | 'category' | 'channel'>('idle')
  const [name, setName] = useState('')

  async function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    // Create a default "General" category first, then create the channel inside it
    const cat = await createCategory.mutateAsync({ serverId, name: 'General' })
    await createChannel.mutateAsync({ serverId, attrs: { name: name.trim(), categoryId: cat.id } })
    setName('')
    setStep('idle')
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await createCategory.mutateAsync({ serverId, name: name.trim() })
    setName('')
    setStep('idle')
  }

  if (step === 'channel') {
    return (
      <form onSubmit={handleCreateChannel} className="px-3 mt-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
          New text channel
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="general"
          autoFocus
          className="w-full px-3 py-2 rounded text-sm outline-none"
          style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-accent)' }}
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!name.trim() || createChannel.isPending || createCategory.isPending}
            className="flex-1 py-1.5 rounded text-xs font-semibold transition-opacity disabled:opacity-50"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            {createChannel.isPending || createCategory.isPending ? 'Creating…' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => { setStep('idle'); setName('') }}
            className="px-3 py-1.5 rounded text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Cancel
          </button>
        </div>
      </form>
    )
  }

  if (step === 'category') {
    return (
      <form onSubmit={handleCreateCategory} className="px-3 mt-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
          New category
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Category name"
          autoFocus
          className="w-full px-3 py-2 rounded text-sm outline-none"
          style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-accent)' }}
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!name.trim() || createCategory.isPending}
            className="flex-1 py-1.5 rounded text-xs font-semibold transition-opacity disabled:opacity-50"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            {createCategory.isPending ? 'Creating…' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => { setStep('idle'); setName('') }}
            className="px-3 py-1.5 rounded text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Cancel
          </button>
        </div>
      </form>
    )
  }

  if (!canCreate) {
    return (
      <p className="text-xs px-4 mt-6" style={{ color: 'var(--color-text-muted)' }}>
        No channels yet.
      </p>
    )
  }

  return (
    <div className="px-3 mt-6 space-y-2">
      <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
        No channels yet. Create one to start chatting.
      </p>
      <button
        onClick={() => { setStep('channel'); setName('') }}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors hover:opacity-90"
        style={{ background: 'var(--color-accent)', color: '#fff' }}
      >
        <Hash size={15} />
        Create a text channel
      </button>
      <button
        onClick={() => { setStep('category'); setName('') }}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors"
        style={{ background: 'var(--color-bg-surface, var(--color-bg-tertiary))', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
      >
        <FolderPlus size={15} />
        Create a category
      </button>
    </div>
  )
}

function ServerHeader({
  server,
  isOwner,
  onOpenInvite,
  onOpenSettings,
}: {
  server: { id: string; name: string; ownerId: string }
  isOwner: boolean
  onOpenInvite: () => void
  onOpenSettings: () => void
}) {
  const navigate = useNavigate()
  const leaveServer = useLeaveServer()

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex items-center justify-between w-full px-4 h-12 font-bold text-sm shadow-sm hover:bg-[#35373c] transition-colors cursor-pointer border-b"
          style={{ color: '#f2f3f5', borderColor: 'var(--color-border)' }}
        >
          <span className="truncate">{server.name}</span>
          <ChevronDown size={18} className="shrink-0 ml-1 text-[#949ba4]" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-56 rounded-md p-1.5 shadow-2xl z-50 text-xs font-semibold"
          style={{ background: '#111214', border: '1px solid var(--color-border)' }}
          sideOffset={4}
        >
          <MenuItem icon={<UserPlus size={14} />} label="Convidar pessoas" onClick={onOpenInvite} highlight />
          {isOwner && (
            <MenuItem icon={<Settings size={14} />} label="Configurações do servidor" onClick={onOpenSettings} />
          )}
          {!isOwner && (
            <MenuItem
              icon={<LogOut size={14} />}
              label="Sair do servidor"
              danger
              onClick={async () => {
                await leaveServer.mutateAsync(server.id)
                navigate('/app')
              }}
            />
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function CategorySection({
  category,
  serverId,
  isOwner,
  onOpenInvite,
}: {
  category: any
  serverId: string
  isOwner: boolean
  onOpenInvite: (channel: Channel) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const { channelId } = useParams()
  const navigate = useNavigate()
  const createChannel = useCreateChannel()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'text' | 'voice'>('text')

  async function handleAddChannel(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    const created = await createChannel.mutateAsync({
      serverId,
      attrs: { name: newName.trim(), type: newType, categoryId: category.id },
    })
    setNewName('')
    setNewType('text')
    setAdding(false)
    if (created?.id) {
      navigate(`/app/servers/${serverId}/channels/${created.id}`)
    }
  }

  return (
    <div className="pt-2">
      <button
        className="group flex items-center gap-1 w-full px-1 py-1 text-[11px] font-bold uppercase tracking-wider text-[#949ba4] hover:text-[#dbdee1] cursor-pointer"
        onClick={() => setCollapsed((c) => !c)}
      >
        <ChevronDown size={12} className={`transition-transform duration-150 ${collapsed ? '-rotate-90' : ''}`} />
        <span className="flex-1 text-left truncate">{category.name}</span>
        {isOwner && (
          <span
            onClick={(e) => { e.stopPropagation(); setAdding(true) }}
            className="opacity-0 group-hover:opacity-100 hover:text-white transition-opacity p-0.5 cursor-pointer"
            title="Criar canal"
          >
            <Plus size={14} />
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="mt-0.5 space-y-0.5">
          {category.channels.map((ch: Channel) => (
            <ChannelRow
              key={ch.id}
              channel={ch}
              serverId={serverId}
              active={ch.id === channelId}
              onClick={() => navigate(`/app/servers/${serverId}/channels/${ch.id}`)}
              onInvite={() => onOpenInvite(ch)}
            />
          ))}

          {adding && (
            <form onSubmit={handleAddChannel} className="px-2 py-2 space-y-1.5 rounded bg-[#1e1f22] mt-1">
              <div className="flex gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setNewType('text')}
                  className={`flex-1 py-1 rounded font-medium flex items-center justify-center gap-1 cursor-pointer ${
                    newType === 'text' ? 'bg-[#5865f2] text-white' : 'text-[#949ba4]'
                  }`}
                >
                  <Hash size={12} /> Texto
                </button>
                <button
                  type="button"
                  onClick={() => setNewType('voice')}
                  className={`flex-1 py-1 rounded font-medium flex items-center justify-center gap-1 cursor-pointer ${
                    newType === 'voice' ? 'bg-[#5865f2] text-white' : 'text-[#949ba4]'
                  }`}
                >
                  <Volume2 size={12} /> Voz
                </button>
              </div>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={newType === 'voice' ? 'Geral de Voz' : 'novo-canal'}
                autoFocus
                className="w-full px-2 py-1 rounded text-xs outline-none bg-[#2b2d31] text-[#f2f3f5] border border-[#3f4248]"
              />
              <div className="flex gap-1">
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className="flex-1 py-1 rounded text-[11px] font-semibold bg-[#5865f2] text-white transition-opacity disabled:opacity-50 cursor-pointer"
                >
                  Criar
                </button>
                <button
                  type="button"
                  onClick={() => { setAdding(false); setNewName('') }}
                  className="px-2 py-1 rounded text-[11px] text-[#949ba4] hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

interface VoiceTreeUser {
  id: string
  name: string
  avatarUrl?: string | null
  isSpeaking: boolean
  isMuted: boolean
  isDeafened: boolean
  isScreenSharing: boolean
}

function ChannelRow({
  channel,
  serverId,
  active,
  onClick,
  onInvite,
}: {
  channel: Channel
  serverId: string
  active: boolean
  onClick: () => void
  onInvite: () => void
}) {
  const Icon = channel.type === 'voice' ? Volume2 : Hash
  const isVoice = channel.type === 'voice'

  const voiceStore = useVoiceStore()
  const { joinVoice } = useVoice()
  const { onlineUsers } = usePresence()

  const isCurrentVoiceActive =
    voiceStore.activeChannelId === channel.id &&
    (voiceStore.isConnected || voiceStore.isConnecting)

  // Compute connected voice users
  let voiceUsers: VoiceTreeUser[] = []

  if (isVoice) {
    if (isCurrentVoiceActive) {
      voiceUsers = voiceStore.participants.map((p) => {
        const presenceInfo = onlineUsers[p.identity]
        return {
          id: p.identity,
          name: p.name || presenceInfo?.displayName || 'Usuário',
          avatarUrl: presenceInfo?.avatarUrl,
          isSpeaking: p.isSpeaking,
          isMuted: p.isMuted,
          isDeafened: p.isDeafened,
          isScreenSharing: p.isScreenSharing || p.isVideoEnabled,
        }
      })
    } else {
      // Find presence users registered in this voice channel
      const presenceInChannel = Object.values(onlineUsers).filter(
        (u) => u.voiceChannelId === channel.id
      )
      voiceUsers = presenceInChannel.map((u) => ({
        id: u.userId,
        name: u.displayName || 'Usuário',
        avatarUrl: u.avatarUrl,
        isSpeaking: false,
        isMuted: false,
        isDeafened: false,
        isScreenSharing: false,
      }))
    }
  }

  const hasConnectedUsers = voiceUsers.length > 0

  function handleRowClick() {
    onClick()
    if (isVoice && voiceStore.activeChannelId !== channel.id) {
      joinVoice(channel.id, serverId, channel.name)
    }
  }

  return (
    <div className="space-y-0.5">
      <div
        onClick={handleRowClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleRowClick()
        }}
        className={`group flex items-center justify-between w-full px-2 py-1.5 rounded text-sm transition-colors text-left cursor-pointer select-none ${
          active
            ? 'bg-[#3f4248] text-white font-semibold'
            : isVoice && (isCurrentVoiceActive || hasConnectedUsers)
            ? 'text-[#dbdee1] hover:bg-[#35373c]'
            : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Icon
            size={18}
            className={`shrink-0 ${
              active
                ? 'text-white'
                : isVoice && (isCurrentVoiceActive || hasConnectedUsers)
                ? 'text-[#23a55a]'
                : 'text-[#80848e] group-hover:text-[#dbdee1]'
            }`}
          />
          <span className="truncate">{channel.name}</span>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onInvite()
            }}
            className="p-1 rounded text-[#949ba4] hover:text-[#f2f3f5] hover:bg-[#2b2d31] transition-colors cursor-pointer"
            title="Convite para o canal"
          >
            <UserPlus size={15} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
            }}
            className="p-1 rounded text-[#949ba4] hover:text-[#f2f3f5] hover:bg-[#2b2d31] transition-colors cursor-pointer"
            title="Editar canal"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* Voice Participants Tree List */}
      {isVoice && hasConnectedUsers && (
        <div className="pl-6 pr-1 py-0.5 space-y-0.5">
          {voiceUsers.map((user) => (
            <VoiceParticipantTreeItem key={user.id} user={user} />
          ))}
        </div>
      )}
    </div>
  )
}

function VoiceParticipantTreeItem({ user }: { user: VoiceTreeUser }) {
  return (
    <div className="group flex items-center justify-between px-2 py-1 rounded hover:bg-[#35373c] transition-colors cursor-pointer select-none">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Avatar with speaking ring */}
        <div className="relative shrink-0">
          <Avatar.Root
            className={`w-5 h-5 rounded-full overflow-hidden block bg-[#2b2d31] transition-all ${
              user.isSpeaking ? 'ring-2 ring-[#23a55a]' : ''
            }`}
          >
            <Avatar.Image
              src={user.avatarUrl ?? undefined}
              alt={user.name}
              className="w-full h-full object-cover"
            />
            <Avatar.Fallback className="w-full h-full flex items-center justify-center text-[10px] font-semibold text-white bg-[#5865f2]">
              {user.name[0]?.toUpperCase()}
            </Avatar.Fallback>
          </Avatar.Root>
        </div>

        {/* Display name */}
        <span
          className={`text-xs truncate transition-colors ${
            user.isSpeaking
              ? 'text-[#23a55a] font-medium'
              : 'text-[#949ba4] group-hover:text-[#dbdee1]'
          }`}
        >
          {user.name}
        </span>
      </div>

      {/* Right icons: muted, deafened, screen sharing */}
      <div className="flex items-center gap-1 shrink-0 text-[#949ba4]">
        {user.isScreenSharing && (
          <span className="px-1 py-0.2 text-[9px] font-bold uppercase rounded bg-[#5865f2] text-white">
            AO VIVO
          </span>
        )}
        {user.isMuted && (
          <span title="Mutado" className="text-[#f23f43]">
            <MicOff size={13} />
          </span>
        )}
        {user.isDeafened && (
          <span title="Ensurdecido" className="text-[#f23f43]">
            <Headphones size={13} />
          </span>
        )}
      </div>
    </div>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  danger = false,
  highlight = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
  highlight?: boolean
}) {
  return (
    <DropdownMenu.Item
      onSelect={onClick}
      className={`flex items-center justify-between px-2.5 py-2 rounded text-xs font-semibold cursor-pointer outline-none transition-colors ${
        danger
          ? 'text-[#f23f43] hover:bg-[#f23f43] hover:text-white'
          : highlight
          ? 'text-[#5865f2] hover:bg-[#5865f2] hover:text-white'
          : 'text-[#dbdee1] hover:bg-[#5865f2] hover:text-white'
      }`}
    >
      <span>{label}</span>
      {icon}
    </DropdownMenu.Item>
  )
}

function InviteModal({
  open,
  onClose,
  serverId,
  serverName,
  channel,
}: {
  open: boolean
  onClose: () => void
  serverId: string
  serverName?: string
  channel?: Channel | null
}) {
  const createInvite = useCreateInvite()
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open && !code && !createInvite.isPending) {
      createInvite.mutateAsync({ serverId }).then((invite) => {
        setCode(invite.code)
      }).catch((err) => {
        console.error('Falha ao gerar convite', err)
      })
    }
    if (!open) {
      setCode(null)
      setCopied(false)
    }
  }, [open, serverId])

  function copyLink() {
    if (!code) return
    navigator.clipboard.writeText(`${window.location.origin}/invite/${code}`)
    setCopied(true)
    toast.success('Link de convite copiado!', 'Cole no chat ou envie para seus amigos.')
    setTimeout(() => setCopied(false), 2000)
  }

  const channelLabel = channel ? (channel.type === 'voice' ? channel.name : `#${channel.name}`) : null

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs" />
        <Dialog.Content
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-lg p-6 shadow-2xl bg-[#313338] text-[#dbdee1] border border-[#232428] outline-none"
        >
          <div className="flex items-center justify-between mb-2">
            <Dialog.Title className="text-base font-bold text-[#f2f3f5]">
              {channelLabel ? `Convidar amigos para ${channelLabel}` : `Convidar amigos para ${serverName || 'o servidor'}`}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-[#949ba4] hover:text-[#f2f3f5] p-1 rounded transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <p className="text-xs text-[#949ba4] mb-4">
            Envie este link para qualquer pessoa para dar acesso imediato ao servidor.
          </p>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase text-[#b5bac1] tracking-wider">
              Link de convite do servidor
            </label>
            <div className="flex gap-2">
              <input
                readOnly
                value={code ? `${window.location.origin}/invite/${code}` : (createInvite.isPending ? 'Gerando link...' : '')}
                className="flex-1 px-3 py-2 rounded bg-[#1e1f22] text-[#f2f3f5] text-xs font-mono outline-none border border-[#1e1f22] focus:border-[#5865f2]"
              />
              <button
                onClick={copyLink}
                disabled={!code}
                className={`px-4 py-2 rounded text-xs font-semibold text-white transition-colors cursor-pointer disabled:opacity-50 ${
                  copied ? 'bg-[#23a55a]' : 'bg-[#5865f2] hover:bg-[#4752c4]'
                }`}
              >
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
            <p className="text-[11px] text-[#949ba4] pt-1">
              Seu link de convite nunca expira e pode ser compartilhado livremente.
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function EmptySidebar() {
  return (
    <div className="flex flex-col h-full items-center justify-center p-4" style={{ background: 'var(--color-bg-secondary)' }}>
      <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>Select a server</p>
    </div>
  )
}

function LoadingSidebar() {
  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg-secondary)' }}>
      <div className="h-12 animate-pulse" style={{ background: 'var(--color-bg-tertiary)' }} />
    </div>
  )
}
