import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, Hash, Volume2, Plus, Link, Settings, LogOut, FolderPlus } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Dialog from '@radix-ui/react-dialog'
import { useServerDetail, useChannels, useCreateChannel, useCreateCategory, useCreateInvite, useLeaveServer, type Channel } from '@/hooks/useServers'
import { useAuth } from '@/hooks/useAuth'

interface Props {
  serverId: string | null
}

export default function ChannelSidebar({ serverId }: Props) {
  const { currentUser, isLoading: authLoading } = useAuth()
  const { data: server } = useServerDetail(serverId)
  const { data: categories = [] } = useChannels(serverId)

  if (!serverId) return <EmptySidebar />
  if (!server || authLoading) return <LoadingSidebar />

  // Compare both as lowercase strings to guard against casing differences
  const isOwner = !!currentUser && currentUser.id.toLowerCase() === server.ownerId.toLowerCase()

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg-secondary)' }}>
      <ServerHeader server={server} isOwner={isOwner} />
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
        {categories.map((cat) => (
          <CategorySection key={cat.id} category={cat} serverId={server.id} isOwner={isOwner} />
        ))}
        {/* Show setup UI whenever there are no channels — owner can act, non-owner sees message */}
        {categories.length === 0 && (
          <EmptyChannelState serverId={server.id} canCreate={isOwner} />
        )}
      </div>
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

function ServerHeader({ server, isOwner }: { server: { id: string; name: string; ownerId: string }; isOwner: boolean }) {
  const navigate = useNavigate()
  const leaveServer = useLeaveServer()
  const [inviteOpen, setInviteOpen] = useState(false)

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className="flex items-center justify-between w-full px-4 h-12 font-semibold text-sm shadow-sm hover:opacity-90 transition-opacity"
            style={{ color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border)' }}
          >
            <span className="truncate">{server.name}</span>
            <ChevronDown size={16} className="shrink-0 ml-1" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="min-w-52 rounded-md p-1 shadow-xl z-50"
            style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' }}
            sideOffset={4}
          >
            <MenuItem icon={<Link size={14} />} label="Create Invite" onClick={() => setInviteOpen(true)} />
            {isOwner && (
              <MenuItem icon={<Settings size={14} />} label="Server Settings" onClick={() => navigate(`/app/servers/${server.id}/settings`)} />
            )}
            {!isOwner && (
              <MenuItem
                icon={<LogOut size={14} />}
                label="Leave Server"
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

      {/* Invite modal */}
      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} serverId={server.id} />
    </>
  )
}

function CategorySection({ category, serverId, isOwner }: { category: any; serverId: string; isOwner: boolean }) {
  const [collapsed, setCollapsed] = useState(false)
  const { channelId } = useParams()
  const navigate = useNavigate()
  const createChannel = useCreateChannel()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  async function handleAddChannel(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    await createChannel.mutateAsync({ serverId, attrs: { name: newName.trim(), categoryId: category.id } })
    setNewName('')
    setAdding(false)
  }

  return (
    <div>
      <button
        className="flex items-center gap-1 w-full px-1 py-1 text-xs font-semibold uppercase tracking-wide hover:opacity-80"
        style={{ color: 'var(--color-text-muted)' }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <ChevronDown size={12} className={`transition-transform ${collapsed ? '-rotate-90' : ''}`} />
        <span className="flex-1 text-left">{category.name}</span>
        {isOwner && (
          <span
            onClick={(e) => { e.stopPropagation(); setAdding(true) }}
            className="ml-auto hover:opacity-100 opacity-60"
          >
            <Plus size={14} />
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="mt-1 space-y-0.5">
          {category.channels.map((ch: Channel) => (
            <ChannelItem
              key={ch.id}
              channel={ch}
              active={ch.id === channelId}
              onClick={() => navigate(`/app/servers/${serverId}/channels/${ch.id}`)}
            />
          ))}

          {adding && (
            <form onSubmit={handleAddChannel} className="px-2 py-1">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="new-channel"
                autoFocus
                onBlur={() => { if (!newName.trim()) setAdding(false) }}
                className="w-full px-2 py-1 rounded text-xs outline-none"
                style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-accent)' }}
              />
            </form>
          )}
        </div>
      )}
    </div>
  )
}

function ChannelItem({ channel, active, onClick }: { channel: Channel; active: boolean; onClick: () => void }) {
  const Icon = channel.type === 'voice' ? Volume2 : Hash
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-sm transition-colors"
      style={{
        background: active ? 'var(--color-bg-tertiary)' : 'transparent',
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
      }}
    >
      <Icon size={16} className="shrink-0" />
      <span className="truncate">{channel.name}</span>
    </button>
  )
}

function InviteModal({ open, onClose, serverId }: { open: boolean; onClose: () => void; serverId: string }) {
  const createInvite = useCreateInvite()
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function generate() {
    const invite = await createInvite.mutateAsync({ serverId })
    setCode(invite.code)
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) { onClose(); setCode(null) } }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.7)' }} />
        <Dialog.Content
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-lg p-6 shadow-2xl"
          style={{ background: 'var(--color-bg-tertiary)' }}
        >
          <Dialog.Title className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Invite people
          </Dialog.Title>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
            Share this link to invite friends to the server.
          </p>

          {!code ? (
            <button
              onClick={generate}
              disabled={createInvite.isPending}
              className="w-full py-2 rounded-md font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--color-accent)', color: '#fff' }}
            >
              {createInvite.isPending ? 'Generating…' : 'Generate Invite Link'}
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                readOnly
                value={`${window.location.origin}/invite/${code}`}
                className="flex-1 px-3 py-2 rounded-md text-sm outline-none"
                style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
              />
              <button
                onClick={copyLink}
                className="px-4 py-2 rounded-md font-semibold text-sm transition-opacity hover:opacity-90"
                style={{ background: copied ? 'var(--color-online)' : 'var(--color-accent)', color: '#fff' }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function MenuItem({ icon, label, onClick, danger = false }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <DropdownMenu.Item
      onSelect={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded text-sm cursor-pointer outline-none"
      style={{ color: danger ? 'var(--color-danger)' : 'var(--color-text-primary)' }}
    >
      {icon}
      {label}
    </DropdownMenu.Item>
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
