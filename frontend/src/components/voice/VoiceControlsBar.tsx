import { useNavigate } from 'react-router-dom'
import {
  PhoneOff,
  Video,
  VideoOff,
  ScreenShare,
  Tv,
  Wifi,
  Activity,
  Gamepad2,
  Sparkles,
} from 'lucide-react'
import { useVoice } from '@/hooks/useVoice'
import { useServerDetail } from '@/hooks/useServers'

export function VoiceControlsBar() {
  const navigate = useNavigate()
  const {
    isConnected,
    isConnecting,
    activeChannelId,
    activeServerId,
    activeChannelName,
    isVideoEnabled,
    isScreenSharing,
    leaveVoice,
    toggleVideo,
    toggleScreenShare,
  } = useVoice()

  const { data: server } = useServerDetail(activeServerId)

  if (!isConnected && !isConnecting) return null

  return (
    <div className="flex flex-col select-none bg-[#111214] border-t border-[#1f2023] p-2 space-y-2">
      {/* Active Screen Share Preview Card (when user is sharing screen) */}
      {isScreenSharing && (
        <div className="flex items-center justify-between p-2 rounded-lg bg-[#1e1f22] border border-[#2b2d31]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-md bg-[#5865f2] flex items-center justify-center text-white shrink-0 shadow">
              <Tv size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#f2f3f5] truncate">Tela 1</p>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-[#f47fff] flex items-center gap-0.5">
                  <Activity size={10} /> 720p 60FPS
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={toggleScreenShare}
            title="Parar de transmitir"
            className="p-1.5 rounded-md hover:bg-[#35373c] text-[#949ba4] hover:text-[#f23f43] transition-colors cursor-pointer"
          >
            <ScreenShare size={16} />
          </button>
        </div>
      )}

      {/* Voice Status & Quick Controls */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={() => {
            if (activeServerId && activeChannelId) {
              navigate(`/app/servers/${activeServerId}/channels/${activeChannelId}`)
            }
          }}
          className="flex items-center gap-2 text-left min-w-0 flex-1 hover:opacity-90 transition-opacity cursor-pointer mr-2"
        >
          <div className="relative shrink-0">
            <Wifi size={18} className="text-[#23a55a] animate-pulse" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold leading-tight text-[#23a55a]">
              {isConnecting ? 'Conectando RTC...' : 'Voz conectada'}
            </p>
            <p className="text-[11px] truncate text-[#949ba4] font-medium leading-tight">
              {activeChannelName || 'Canal de Voz'}
              {server?.name ? ` / ${server.name}` : ''}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={leaveVoice}
            title="Desconectar"
            aria-label="Desconectar"
            className="p-1.5 rounded-md hover:bg-[#f23f43]/20 text-[#949ba4] hover:text-[#f23f43] transition-colors cursor-pointer"
          >
            <PhoneOff size={18} />
          </button>
        </div>
      </div>

      {/* 4 Discord Action Buttons Grid */}
      <div className="grid grid-cols-4 gap-1.5 pt-0.5">
        <button
          onClick={toggleVideo}
          title={isVideoEnabled ? 'Desligar Câmera' : 'Ligar Câmera'}
          aria-label={isVideoEnabled ? 'Desligar Câmera' : 'Ligar Câmera'}
          className={`flex items-center justify-center h-8 rounded-lg transition-colors cursor-pointer ${
            isVideoEnabled
              ? 'bg-[#23a55a] text-white hover:bg-[#1f914f]'
              : 'bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1]'
          }`}
        >
          {isVideoEnabled ? <Video size={16} /> : <VideoOff size={16} />}
        </button>

        <button
          onClick={toggleScreenShare}
          title={isScreenSharing ? 'Parar Compartilhamento' : 'Compartilhar Tela'}
          aria-label={isScreenSharing ? 'Parar Compartilhamento' : 'Compartilhar Tela'}
          className={`flex items-center justify-center h-8 rounded-lg transition-colors cursor-pointer ${
            isScreenSharing
              ? 'bg-[#23a55a] text-white hover:bg-[#1f914f]'
              : 'bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1]'
          }`}
        >
          <ScreenShare size={16} />
        </button>

        <button
          title="Atividades e Jogos"
          aria-label="Atividades e Jogos"
          className="flex items-center justify-center h-8 rounded-lg bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] transition-colors cursor-pointer"
        >
          <Gamepad2 size={16} />
        </button>

        <button
          title="Efeitos Sonoros"
          aria-label="Efeitos Sonoros"
          className="flex items-center justify-center h-8 rounded-lg bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] transition-colors cursor-pointer"
        >
          <Sparkles size={16} />
        </button>
      </div>
    </div>
  )
}
