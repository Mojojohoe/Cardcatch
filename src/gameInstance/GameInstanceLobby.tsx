/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Users, RefreshCw, Check, Copy } from 'lucide-react';
import { HostLobbyPanel, GuestLobbyPanel } from '../components/LobbyRoomPanels';
import { PlayerSettingsMenu } from '../components/PlayerSettingsMenu';
import type { GameSettings, RoomData } from '../types';
import type { SavedLobbyPreset } from '../settings/gameSettingsConstants';
import type { GameService } from '../services/gameService';
import { normalizeGameSettings, CUSTOM_LOBBY_PRESET_ID } from '../settings/normalizeGameSettings';
import { preySideLabel } from './clipboardSuitTags';

export const GameInstanceJoinGate: React.FC<{
  isDual: boolean;
  playerName: string;
  setPlayerName: (v: string) => void;
  roomCode: string;
  setRoomCode: (v: string) => void;
  loading: boolean;
  error: string | null;
  onHost: () => void;
  onJoin: () => void;
}> = ({ isDual, playerName, setPlayerName, roomCode, setRoomCode, loading, error, onHost, onJoin }) => (
  <div className="relative h-full flex items-center justify-center p-4">
    <div className="absolute right-4 top-4 z-10">
      <PlayerSettingsMenu />
    </div>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-xs w-full bg-emerald-900/50 border border-emerald-800 rounded-2xl p-6 space-y-4"
    >
      <div className="text-center">
        <h2 className="text-xl font-black text-white uppercase tracking-tight">{isDual ? 'Guest Player' : 'Table Menu'}</h2>
        <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mt-1">Peer-to-peer table</p>
      </div>
      <div className="space-y-3">
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Your Nickname..."
          className="w-full bg-emerald-800/50 border-2 border-emerald-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
        />
        {!isDual && (
          <button
            onClick={onHost}
            disabled={loading}
            className="w-full bg-yellow-400 text-emerald-950 font-black py-2 rounded-lg text-sm uppercase flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw className="animate-spin w-4 h-4" /> : 'Host New Table'}
          </button>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            placeholder="Table Code..."
            className="flex-1 bg-emerald-800/50 border-2 border-emerald-700 rounded-lg px-3 text-sm text-white uppercase"
          />
          <button onClick={onJoin} disabled={loading} className="bg-emerald-700 py-2 px-3 rounded-lg text-white font-bold text-sm">
            {loading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Users className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {error && (
        <div className="text-[10px] text-red-400 animate-pulse bg-red-950/20 p-2 rounded border border-red-900/50">{error}</div>
      )}
    </motion.div>
  </div>
);

export const GameInstanceConnecting: React.FC = () => (
  <div className="relative h-full flex items-center justify-center text-emerald-400 text-[10px] font-mono animate-pulse">
    <div className="absolute right-3 top-3 z-10">
      <PlayerSettingsMenu />
    </div>
    Connecting…
  </div>
);

export const GameInstanceWaitingLobby: React.FC<{
  room: RoomData;
  roomId: string;
  isHost: boolean;
  loading: boolean;
  guestLobbyReady: boolean;
  showCopySuccess: boolean;
  onRoomIdCopy: () => void;
  onStartGame: () => void;
  serviceRef: React.MutableRefObject<GameService>;
}> = ({
  room,
  roomId,
  isHost,
  loading,
  guestLobbyReady,
  showCopySuccess,
  onRoomIdCopy,
  onStartGame,
  serviceRef,
}) => {
  const preyLab = preySideLabel(room.settings.hostRole);
  const linkCode = roomId ?? room.code;

  const patchLobbySettings = (partial: Partial<GameSettings>) => {
    serviceRef.current.syncSettings(
      normalizeGameSettings({ ...room.settings, ...partial, lobbyPresetId: CUSTOM_LOBBY_PRESET_ID }),
    );
  };

  const applyBuiltinPreset = (presetId: string, partial?: Partial<GameSettings>) => {
    serviceRef.current.syncSettings(normalizeGameSettings({ ...(partial ?? {}), lobbyPresetId: presetId }));
  };

  const applySavedLobbyPreset = (entry: SavedLobbyPreset) => {
    serviceRef.current.syncSettings(
      normalizeGameSettings({ ...(entry.settings as Partial<GameSettings>), lobbyPresetId: entry.id }),
    );
  };

  return (
    <div className="flex h-full flex-col space-y-6 overflow-y-auto p-6">
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <PlayerSettingsMenu />
      </div>
      {isHost ? (
        <HostLobbyPanel
          room={room}
          tableCode={linkCode}
          preySideLabelShort={preyLab}
          loading={loading}
          guestLobbyReady={guestLobbyReady}
          showCopySuccess={showCopySuccess}
          onRoomIdCopy={onRoomIdCopy}
          onPatchSettings={patchLobbySettings}
          onApplyPreset={applyBuiltinPreset}
          onApplySavedPreset={applySavedLobbyPreset}
          onStartGame={onStartGame}
        />
      ) : (
        <div className="flex-1 space-y-6">
          {room.guestLobbyNotice && (
            <div className="rounded-xl border border-amber-500/60 bg-amber-950/50 px-4 py-4 text-center shadow-[0_0_28px_rgba(245,158,11,0.12)]">
              <p className="text-[11px] font-black uppercase tracking-wider text-amber-100">{room.guestLobbyNotice}</p>
              <p className="mt-2 text-[10px] font-bold uppercase leading-snug text-amber-400/90">
                Settings changed — tap Ready below after you have re-read everything.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl border border-emerald-800 bg-emerald-900/30 p-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">TABLE LINK</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xl font-black text-white">{linkCode}</span>
                <button type="button" onClick={onRoomIdCopy} className="p-1 text-yellow-400">
                  {showCopySuccess ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">STATUS</span>
              <div className="animate-pulse text-xs font-black uppercase text-emerald-400">
                {Object.keys(room.players).length < 2
                  ? 'WAITING FOR PLAYER 2'
                  : guestLobbyReady
                    ? 'YOU ARE READY'
                    : 'CHECK SETTINGS & READY UP'}
              </div>
            </div>
          </div>

          <GuestLobbyPanel
            room={room}
            preyLab={preyLab}
            guestLobbyReady={guestLobbyReady}
            onToggleReady={() => void serviceRef.current.setLobbyReady(!guestLobbyReady)}
          />
          <p className="px-2 text-center text-[9px] font-bold uppercase tracking-tight text-emerald-600">
            Ready tells the host you have reviewed the rules above. Changing host settings clears Ready.
          </p>
        </div>
      )}
    </div>
  );
};
