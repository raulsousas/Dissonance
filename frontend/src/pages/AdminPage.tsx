/**
 * AdminPage — Discord-themed administration dashboard for managing users and email allowlist.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as Avatar from '@radix-ui/react-avatar'
import {
  Shield,
  ShieldAlert,
  ArrowLeft,
  Users,
  Mail,
  Plus,
  Trash2,
  Search,
  CheckCircle,
  AlertCircle,
  UserCheck,
} from 'lucide-react'
import {
  useAdminUsers,
  usePromoteUser,
  useRevokeUserAccess,
  useAllowedEmails,
  useAddAllowedEmail,
  useRemoveAllowedEmail,
} from '@/hooks/useAdmin'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/stores/toastStore'

type Tab = 'users' | 'allowlist'

export default function AdminPage() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [search, setSearch] = useState('')
  const [newEmail, setNewEmail] = useState('')

  const { data: users = [], isLoading: usersLoading } = useAdminUsers()
  const promoteUser = usePromoteUser()
  const revokeAccess = useRevokeUserAccess()

  const { data: allowedEmails = [], isLoading: emailsLoading } = useAllowedEmails()
  const addEmail = useAddAllowedEmail()
  const removeEmail = useRemoveAllowedEmail()

  const filteredUsers = users.filter(
    (u) =>
      u.displayName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  )

  async function handlePromote(userId: string, name: string) {
    if (window.confirm(`Deseja promover ${name} a Administrador?`)) {
      try {
        await promoteUser.mutateAsync(userId)
        toast.success(`Usuário ${name} promovido a Administrador!`)
      } catch (err: any) {
        toast.error('Erro ao promover usuário', err.message)
      }
    }
  }

  async function handleRevoke(userId: string, name: string) {
    if (
      window.confirm(
        `Deseja revogar todas as sessões de ${name}? O usuário será desconectado imediatamente.`
      )
    ) {
      try {
        await revokeAccess.mutateAsync(userId)
        toast.success(`Sessões de ${name} revogadas com sucesso!`)
      } catch (err: any) {
        toast.error('Erro ao revogar sessões', err.message)
      }
    }
  }

  async function handleAddEmail(e: React.FormEvent) {
    e.preventDefault()
    const email = newEmail.trim().toLowerCase()
    if (!email) return

    try {
      await addEmail.mutateAsync(email)
      toast.success(`E-mail ${email} adicionado à allowlist!`)
      setNewEmail('')
    } catch (err: any) {
      toast.error('Erro ao adicionar e-mail', err.message)
    }
  }

  async function handleRemoveEmail(email: string) {
    if (window.confirm(`Remover ${email} da allowlist?`)) {
      try {
        await removeEmail.mutateAsync(email)
        toast.success(`E-mail ${email} removido da allowlist.`)
      } catch (err: any) {
        toast.error('Erro ao remover e-mail', err.message)
      }
    }
  }

  return (
    <div className="flex h-full w-full bg-[#1e1f22] text-[#f2f3f5] overflow-hidden select-none">
      {/* Left Navigation Sidebar */}
      <div className="w-64 bg-[#2b2d31] flex flex-col border-r border-[#1f2023] shrink-0">
        <div className="p-4 border-b border-[#1f2023] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#5865f2] text-white">
              <Shield size={20} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-[#f2f3f5]">Painel Admin</h1>
              <span className="text-[11px] text-[#949ba4]">Guilda System</span>
            </div>
          </div>
        </div>

        <nav className="p-3 space-y-1 flex-1">
          <button
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors cursor-pointer text-left ${
              activeTab === 'users'
                ? 'bg-[#3f4248] text-white font-semibold'
                : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
            }`}
          >
            <Users size={18} />
            <span>Gerenciar Usuários</span>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[#1e1f22] text-[#949ba4]">
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('allowlist')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors cursor-pointer text-left ${
              activeTab === 'allowlist'
                ? 'bg-[#3f4248] text-white font-semibold'
                : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
            }`}
          >
            <Mail size={18} />
            <span>Allowlist de E-mails</span>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[#1e1f22] text-[#949ba4]">
              {allowedEmails.length}
            </span>
          </button>
        </nav>

        {/* Back to Chat Button */}
        <div className="p-3 border-t border-[#1f2023]">
          <button
            onClick={() => navigate('/app')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-semibold bg-[#1e1f22] hover:bg-[#35373c] text-[#dbdee1] transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Voltar ao Chat</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-[#313338] flex flex-col overflow-y-auto p-8">
        <div className="max-w-4xl w-full mx-auto space-y-6">
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-[#f2f3f5]">Usuários Registrados</h2>
                  <p className="text-xs text-[#949ba4]">
                    Gerencie cargos, permissões e sessões de usuários no sistema.
                  </p>
                </div>

                <div className="relative w-64">
                  <Search size={15} className="absolute left-3 top-2.5 text-[#949ba4]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nome ou e-mail..."
                    className="w-full pl-9 pr-3 py-1.5 rounded bg-[#1e1f22] text-sm text-[#f2f3f5] outline-none border border-[#1e1f22] focus:border-[#5865f2]"
                  />
                </div>
              </div>

              {/* Users Table */}
              <div className="bg-[#2b2d31] rounded-lg border border-[#1f2023] overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#1f2023] bg-[#232428] text-[#949ba4] font-bold uppercase tracking-wider">
                      <th className="p-3.5">Usuário</th>
                      <th className="p-3.5">E-mail</th>
                      <th className="p-3.5">Cargo</th>
                      <th className="p-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f2023]">
                    {usersLoading ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-[#949ba4]">
                          Carregando usuários...
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-[#949ba4]">
                          Nenhum usuário encontrado.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isAdmin = u.role === 'admin'
                        const isMe = u.id === currentUser?.id

                        return (
                          <tr key={u.id} className="hover:bg-[#35373c] transition-colors">
                            <td className="p-3.5 flex items-center gap-2.5">
                              <Avatar.Root className="w-8 h-8 rounded-full overflow-hidden block bg-[#1e1f22]">
                                <Avatar.Image src={u.avatarUrl ?? undefined} alt={u.displayName} />
                                <Avatar.Fallback className="w-full h-full flex items-center justify-center font-bold text-white bg-[#5865f2]">
                                  {u.displayName[0]?.toUpperCase()}
                                </Avatar.Fallback>
                              </Avatar.Root>
                              <span className="font-semibold text-[#f2f3f5]">{u.displayName}</span>
                            </td>
                            <td className="p-3.5 text-[#dbdee1]">{u.email}</td>
                            <td className="p-3.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                                  isAdmin
                                    ? 'bg-[#5865f2]/20 text-[#5865f2] border border-[#5865f2]/40'
                                    : 'bg-[#1e1f22] text-[#949ba4]'
                                }`}
                              >
                                {isAdmin ? 'Admin' : 'Membro'}
                              </span>
                            </td>
                            <td className="p-3.5 text-right space-x-2">
                              {!isAdmin && (
                                <button
                                  onClick={() => handlePromote(u.id, u.displayName)}
                                  className="px-2.5 py-1 rounded bg-[#5865f2] hover:bg-[#4752c4] text-white font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                                  title="Promover a Admin"
                                >
                                  <UserCheck size={13} />
                                  <span>Promover</span>
                                </button>
                              )}

                              {!isMe && (
                                <button
                                  onClick={() => handleRevoke(u.id, u.displayName)}
                                  className="px-2.5 py-1 rounded bg-[#f23f43]/15 hover:bg-[#f23f43]/25 text-[#f23f43] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                                  title="Revogar todas as sessões"
                                >
                                  <ShieldAlert size={13} />
                                  <span>Desconectar</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'allowlist' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-[#f2f3f5]">Allowlist de E-mails</h2>
                <p className="text-xs text-[#949ba4]">
                  E-mails nesta lista têm permissão garantida para efetuar login no Guilda.
                </p>
              </div>

              {/* Add Email Form */}
              <form onSubmit={handleAddEmail} className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="novo.usuario@empresa.com"
                  className="flex-1 px-3.5 py-2 rounded bg-[#1e1f22] text-sm text-[#f2f3f5] outline-none border border-[#1e1f22] focus:border-[#5865f2]"
                />
                <button
                  type="submit"
                  disabled={!newEmail.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-semibold bg-[#23a55a] hover:bg-[#1f914f] text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Plus size={16} />
                  <span>Permitir E-mail</span>
                </button>
              </form>

              {/* Allowed Emails List */}
              <div className="bg-[#2b2d31] rounded-lg border border-[#1f2023] overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#1f2023] bg-[#232428] text-[#949ba4] font-bold uppercase tracking-wider">
                      <th className="p-3.5">E-mail Permitido</th>
                      <th className="p-3.5 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f2023]">
                    {emailsLoading ? (
                      <tr>
                        <td colSpan={2} className="p-8 text-center text-[#949ba4]">
                          Carregando allowlist...
                        </td>
                      </tr>
                    ) : allowedEmails.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="p-8 text-center text-[#949ba4]">
                          Nenhum e-mail adicionado manualmente. Todos os usuários com convites ou logins prévios continuam autorizados.
                        </td>
                      </tr>
                    ) : (
                      allowedEmails.map((email) => (
                        <tr key={email} className="hover:bg-[#35373c] transition-colors">
                          <td className="p-3.5 font-medium text-[#f2f3f5] flex items-center gap-2">
                            <CheckCircle size={15} className="text-[#23a55a]" />
                            <span>{email}</span>
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => handleRemoveEmail(email)}
                              className="p-1.5 rounded text-[#949ba4] hover:text-[#f23f43] hover:bg-[#1e1f22] transition-colors cursor-pointer"
                              title="Remover da allowlist"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
