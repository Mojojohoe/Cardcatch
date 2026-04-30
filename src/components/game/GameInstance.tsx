import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Copy, Check, Swords, Hash, Info, RefreshCw, Zap, Skull, Trophy, ChevronRight, Rabbit } from 'lucide-react';
import { GameService } from '../../services/gameService';
import { RoomData } from '../../types';
import { CardVisual, DesperationVignette, DesperationWheel, EndGameOverlay, SUIT_COLORS, SUIT_ICONS, TargetSuitWheel, WolfIcon } from './visuals';
import { RulesModal } from './RulesModal';

interface GameInstanceProps {
  instanceId: string;
  isDual?: boolean;
}

export const GameInstance: React.FC<GameInstanceProps> = ({ instanceId, isDual }) => {
  const serviceRef = useRef(new GameService());
  const [playerName, setPlayerName] = useState(isDual ? `Tester ${instanceId.slice(-1)}` : '');
  const [roomCode, setRoomCode] = useState('');
  const [room, setRoom] = useState<RoomData | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showDesperationWheel, setShowDesperationWheel] = useState(false);
  const [isWheelSpinning, setIsWheelSpinning] = useState(false);
  const myUid = serviceRef.current.getUid();

  useEffect(() => () => serviceRef.current.destroy(), []);

  useEffect(() => {
    if (room?.currentTurn && room.status === 'playing') {
      setIsWheelSpinning(true);
      const timer = setTimeout(() => setIsWheelSpinning(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [room?.currentTurn, room?.status]);

  const attachStateSync = (state: RoomData) => {
    setRoom(state);
    if (state.status === 'playing' && state.players[myUid]?.confirmed === false) {
      setSelectedCard(null);
    }
  };

  const handleCreateRoom = async () => {
    if (!playerName) return setError('Please enter your name');
    setLoading(true);
    setError(null);
    try {
      const id = await serviceRef.current.createRoom(playerName, attachStateSync);
      setRoomId(id);
    } catch (err: any) {
      setError(`Failed to create: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!playerName || !roomCode) return setError('Please enter name and code');
    setLoading(true);
    setError(null);
    try {
      await serviceRef.current.joinRoom(roomCode, playerName, attachStateSync);
      setRoomId(roomCode);
    } catch (err: any) {
      setError(`Failed to join: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayCard = async () => {
    if (!selectedCard || !roomId) return;
    setLoading(true);
    try {
      await serviceRef.current.playCard(selectedCard);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNextRound = async () => {
    setLoading(true);
    try {
      await serviceRef.current.proceedToNextRound();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = (settings: any) => serviceRef.current.syncSettings(settings);
  const handleOpenDesperationWheel = () => setShowDesperationWheel(true);
  const handleSpinDesperation = async () => {
    try {
      await serviceRef.current.spinDesperation();
    } catch (err: any) {
      setError(err.message);
    }
  };
  const handleResolveDesperation = async () => {
    try {
      await serviceRef.current.resolveDesperation();
      setShowDesperationWheel(false);
    } catch (err: any) {
      setError(err.message);
    }
  };
  const handleStartGame = async () => {
    setLoading(true);
    try {
      await serviceRef.current.startGame();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!roomId) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-xs w-full bg-emerald-900/50 border border-emerald-800 rounded-2xl p-6 space-y-4">
          <div className="text-center">
            <h2 className="text-xl font-black text-white uppercase tracking-tight">{isDual ? 'Guest Player' : 'Table Menu'}</h2>
            <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mt-1">P2P Tactical Sandbox</p>
          </div>
          <div className="space-y-3">
            <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Your Nickname..." className="w-full bg-emerald-800/50 border-2 border-emerald-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400" />
            {!isDual && (
              <button onClick={handleCreateRoom} disabled={loading} className="w-full bg-yellow-400 text-emerald-950 font-black py-2 rounded-lg text-sm uppercase flex items-center justify-center gap-2">
                {loading ? <RefreshCw className="animate-spin w-4 h-4" /> : 'Host New Table'}
              </button>
            )}
            <div className="flex gap-2">
              <input type="text" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} placeholder="Table Code..." className="flex-1 bg-emerald-800/50 border-2 border-emerald-700 rounded-lg px-3 text-sm text-white uppercase" />
              <button onClick={handleJoinRoom} disabled={loading} className="bg-emerald-700 py-2 px-3 rounded-lg text-white font-bold text-sm">
                {loading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Users className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {error && <div className="text-[10px] text-red-400 animate-pulse bg-red-950/20 p-2 rounded border border-red-900/50">{error}</div>}
        </motion.div>
      </div>
    );
  }

  if (!room) {
    return <div className="h-full flex items-center justify-center text-emerald-400 text-[10px] font-mono animate-pulse">ESTABLISHING P2P LINK...</div>;
  }

  const isHost = Object.keys(room.players)[0] === myUid;
  const me = room.players[myUid];
  if (!me) return <div className="h-full flex items-center justify-center text-[10px] uppercase">DESYNCED</div>;
  const opponentUid = Object.keys(room.players).find((uid) => uid !== myUid);
  const opponent = opponentUid ? room.players[opponentUid] : null;

  if (room.status === 'waiting') {
    return (
      <div className="h-full flex flex-col p-6 space-y-6 overflow-y-auto">
        <div className="flex justify-between items-center bg-emerald-900/30 p-4 rounded-xl border border-emerald-800">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">TABLE LINK</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-mono font-black text-white">{roomId}</span>
              <button onClick={() => { navigator.clipboard.writeText(roomId); setShowCopySuccess(true); setTimeout(() => setShowCopySuccess(false), 2000); }} className="text-yellow-400 p-1">
                {showCopySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">STATUS</span>
            <div className="text-xs font-black text-emerald-400 animate-pulse uppercase">{Object.keys(room.players).length < 2 ? 'WAITING FOR PLAYER 2' : 'READY TO ENGAGE'}</div>
          </div>
        </div>

        {isHost ? (
          <div className="flex-1 space-y-6">
            <div className="space-y-4">
              <h3 className="text-xs font-black text-yellow-400 uppercase tracking-widest border-l-4 border-yellow-400 pl-3">Combat Parameters</h3>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-emerald-500 uppercase">Host Primary Identity</label>
                  <div className="flex bg-emerald-900/50 p-1 rounded-xl border border-emerald-800">
                    {(['Predator', 'Prey', 'Preydator'] as const).map((r) => (
                      <button key={r} onClick={() => handleUpdateSettings({ ...room.settings, hostRole: r })} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${room.settings.hostRole === r ? 'bg-yellow-400 text-emerald-950 shadow-lg' : 'text-emerald-500 hover:text-white'}`}>{r}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-emerald-500 uppercase">Engagement Difficulty <span className="ml-2 text-yellow-500/80">({room.settings.hostRole === 'Prey' ? 'Host' : 'Guest'} Size)</span></label>
                  <div className="flex bg-emerald-900/50 p-1 rounded-xl border border-emerald-800">
                    {(['Fair', 'Normal', 'Hard', 'Impossible'] as const).map((d) => {
                      let ratio = '';
                      if (d === 'Fair') ratio = '10 vs 10';
                      if (d === 'Normal') ratio = '10 vs 6';
                      if (d === 'Hard') ratio = '10 vs 4';
                      if (d === 'Impossible') ratio = '10 vs 2';
                      return (
                        <button key={d} onClick={() => handleUpdateSettings({ ...room.settings, difficulty: d })} className={`flex-1 py-3 px-1 text-[8px] font-black uppercase rounded-lg transition-all flex flex-col items-center gap-0.5 ${room.settings.difficulty === d ? 'bg-yellow-400 text-emerald-950 shadow-lg' : 'text-emerald-500 hover:text-white'}`}>
                          <span>{d}</span><span className="opacity-70 text-[7px]">{ratio}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="px-3 py-3 bg-yellow-500/10 rounded-xl border border-yellow-500/30">
                    <p className="text-[11px] text-yellow-400 font-black leading-relaxed uppercase tracking-tight">
                      {room.settings.difficulty === 'Fair' && 'EQUAL FOOTING. BOTH SIDES HOLD FULL 10-CARD HANDS.'}
                      {room.settings.difficulty === 'Normal' && `STANDARD HUNT. ${room.settings.hostRole === 'Predator' ? 'GUEST' : room.settings.hostRole === 'Prey' ? 'HOST' : 'TARGET'} ENTERS WITH 6 CARDS.`}
                      {room.settings.difficulty === 'Hard' && `DESPERATE SURVIVAL. ${room.settings.hostRole === 'Predator' ? 'GUEST' : room.settings.hostRole === 'Prey' ? 'HOST' : 'TARGET'} HOLDS ONLY 4 CARDS.`}
                      {room.settings.difficulty === 'Impossible' && `ONE MISTAKE ENDS IT. ${room.settings.hostRole === 'Predator' ? 'GUEST' : room.settings.hostRole === 'Prey' ? 'HOST' : 'TARGET'} HAS 2 CARDS.`}
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleUpdateSettings({ ...room.settings, disableJokers: !room.settings.disableJokers })} className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${room.settings.disableJokers ? 'border-red-900/50 bg-red-950/20 text-red-500' : 'border-emerald-800 bg-emerald-900/20 text-emerald-500'}`}>
                  <Skull className="w-5 h-5 mb-1" /><span className="text-[10px] font-black uppercase">Jokers</span><span className="text-[8px] font-bold">{room.settings.disableJokers ? 'DISABLED' : 'ACTIVE'}</span>
                </button>
                <button onClick={() => handleUpdateSettings({ ...room.settings, disablePowerCards: !room.settings.disablePowerCards })} className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${room.settings.disablePowerCards ? 'border-red-900/50 bg-red-950/20 text-red-500' : 'border-emerald-800 bg-emerald-900/20 text-emerald-500'}`}>
                  <Zap className="w-5 h-5 mb-1" /><span className="text-[10px] font-black uppercase">Power Cards</span><span className="text-[8px] font-bold">{room.settings.disablePowerCards ? 'DISABLED' : 'ACTIVE'}</span>
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest border-l-4 border-purple-400 pl-3">Desperation Protocols</h3>
              <div className="bg-purple-950/20 border border-purple-900/50 p-4 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-purple-400 uppercase">Enable Desperation Mode</span>
                  <button onClick={() => handleUpdateSettings({ ...room.settings, enableDesperation: !room.settings.enableDesperation })} className={`w-12 h-6 rounded-full relative transition-colors ${room.settings.enableDesperation ? 'bg-purple-600' : 'bg-emerald-900'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${room.settings.enableDesperation ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
                {room.settings.enableDesperation && (
                  <div className="space-y-3 pt-2">
                    {room.settings.tiers.map((tier, idx) => (
                      <div key={idx} className="flex gap-2">
                        <div className="bg-purple-900/50 border border-purple-800 rounded px-2 py-1 flex items-center justify-center min-w-[60px]"><span className="text-[8px] font-black text-purple-300">TIER {idx + 1}</span></div>
                        <input type="text" value={tier} onChange={(e) => { const newTiers = [...room.settings.tiers]; newTiers[idx] = e.target.value; handleUpdateSettings({ ...room.settings, tiers: newTiers }); }} placeholder="Tier objective..." className="flex-1 bg-emerald-900/50 border border-emerald-800 rounded px-3 py-1 text-[10px] text-white focus:outline-none focus:border-purple-500" />
                        <button onClick={() => handleUpdateSettings({ ...room.settings, tiers: room.settings.tiers.filter((_, i) => i !== idx) })} className="text-red-500 hover:bg-red-950/40 p-1 rounded"><Hash className="w-4 h-4" /></button>
                      </div>
                    ))}
                    <button onClick={() => handleUpdateSettings({ ...room.settings, tiers: [...room.settings.tiers, `TIER ${room.settings.tiers.length + 1}`] })} className="w-full text-center py-2 border border-dashed border-purple-800 rounded text-[8px] font-black text-purple-400 uppercase hover:bg-purple-900/20">+ Add Protocol Tier</button>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {Object.keys(room.players).length < 2 ? (
                <div className="text-center py-4 bg-emerald-900/20 rounded-xl border border-dashed border-emerald-800"><span className="text-[10px] font-black text-emerald-700 animate-pulse uppercase">WAITING FOR PLAYER 2...</span></div>
              ) : (
                <button onClick={handleStartGame} disabled={loading} className="w-full py-4 bg-yellow-400 text-emerald-950 rounded-xl font-black uppercase tracking-widest text-sm shadow-[0_0_30px_rgba(250,204,21,0.3)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
                  {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <><Swords className="w-5 h-5" />COMMENCE ENGAGEMENT</>}
                </button>
              )}
              <p className="text-[8px] text-emerald-600 text-center font-bold uppercase tracking-tight">Only the host can initiate combat</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-6">
            <h3 className="text-xs font-black text-yellow-400 uppercase tracking-widest border-l-4 border-yellow-400 pl-3">Host Strategy</h3>
            <div className="bg-emerald-900/20 border border-emerald-800 p-6 rounded-2xl space-y-6 grayscale opacity-60">
              <div className="space-y-2"><span className="text-[10px] font-black text-emerald-500 uppercase">Host Identity</span><div className="text-xl font-black">{room.settings.hostRole}</div></div>
              <div className="space-y-2"><span className="text-[10px] font-black text-emerald-500 uppercase">Combat Difficulty</span><div className="text-xl font-black">{room.settings.difficulty}</div></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1"><span className="text-[10px] font-black text-emerald-500 uppercase">Jokers</span><span className="text-sm font-black">{room.settings.disableJokers ? 'OFF' : 'ON'}</span></div>
                <div className="flex flex-col gap-1"><span className="text-[10px] font-black text-emerald-500 uppercase">Desperation</span><span className="text-sm font-black">{room.settings.enableDesperation ? 'ACTIVE' : 'OFF'}</span></div>
              </div>
            </div>
            <div className="text-center"><div className="text-[10px] font-black text-emerald-600 animate-pulse">SYNCHRONIZING COMBAT PARAMETERS...</div></div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full bg-emerald-950/40 relative flex flex-col p-4 overflow-hidden border-x border-emerald-900/50">
      <DesperationVignette tier={me.desperationTier} totalTiers={room.settings.tiers.length} />
      {(showDesperationWheel || me.desperationSpinning || me.desperationResult) && !room.winner && (
        <DesperationWheel onSpin={handleSpinDesperation} onClose={() => setShowDesperationWheel(false)} onResolve={handleResolveDesperation} isSpinning={me.desperationSpinning} result={me.desperationResult} offset={me.desperationOffset} tiers={room.settings.tiers} currentTier={me.desperationTier + 1} isSpectator={false} />
      )}
      {opponent && (opponent.desperationSpinning || opponent.desperationResult) && !room.winner && (
        <DesperationWheel onSpin={() => {}} onClose={() => {}} onResolve={() => {}} isSpinning={opponent.desperationSpinning} result={opponent.desperationResult} offset={opponent.desperationOffset} tiers={room.settings.tiers} currentTier={opponent.desperationTier} isSpectator />
      )}
      <div className="flex justify-between items-center mb-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-bold text-emerald-500 uppercase">{roomId}</span>
            <button onClick={() => { navigator.clipboard.writeText(roomId); setShowCopySuccess(true); setTimeout(() => setShowCopySuccess(false), 2000); }} className="text-emerald-700 hover:text-yellow-400">
              {showCopySuccess ? <Check className="w-2 h-2" /> : <Copy className="w-2 h-2" />}
            </button>
          </div>
          <span className="text-xs font-black italic uppercase leading-none">{me.role}</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowRules(true)} className="text-emerald-500 hover:text-white flex items-center gap-1 text-[8px] font-black uppercase tracking-widest border border-emerald-800 px-2 py-1 rounded"><Info className="w-2 h-2" /> Rules</button>
          <div className="flex items-center gap-2">{opponent?.confirmed && <Check className="w-3 h-3 text-yellow-400 animate-bounce" />}<span className="text-[10px] font-bold text-emerald-500 uppercase">{opponent?.name || '...'}</span></div>
        </div>
      </div>

      {opponent && (
        <div className="flex justify-center -space-x-8 sm:-space-x-12 mb-4 opacity-80 scale-90 sm:scale-100 flex-nowrap h-28 items-center px-4">
          {Array.from({ length: opponent.hand.length }).map((_, i) => <CardVisual key={`opp-${i}`} card="" revealed={false} disabled role={opponent.role} delay={i * 0.08} />)}
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center gap-6 relative">
        <div className="absolute right-12 top-1/2 -translate-y-1/2 hidden lg:flex flex-col items-center">
          <div className="relative group">
            <div className="relative w-20 h-28">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="absolute inset-0 bg-purple-950 border-2 border-purple-600/50 rounded-lg shadow-2xl" style={{ transform: `translate(${-i * 2}px, ${-i * 2}px)` }}>
                  <div className="w-full h-full opacity-20 flex flex-col items-center justify-center p-3"><div className="w-full h-full flex flex-col items-center justify-center gap-1"><WolfIcon /><Rabbit className="w-8 h-8 text-purple-400" /></div></div>
                  <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,#ffffff_1px,transparent_1px)] bg-[size:10px_10px]" />
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-col items-center"><div className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.3em] font-mono">{room.deck.length}</div><div className="text-[8px] font-bold uppercase text-emerald-800 tracking-widest">REMAINING</div></div>
          </div>
        </div>

        {room.status === 'playing' ? (
          <div className="flex flex-col items-center transition-all duration-500">
            {opponent?.desperationTier > 0 && (
              <div className="absolute top-0 flex flex-col items-center gap-1 bg-purple-950/40 border border-purple-800/50 px-4 py-1.5 rounded-full mb-4">
                <span className="text-[8px] font-black text-purple-400 uppercase tracking-widest">OPPONENT DESPERATION</span>
                <span className="text-[10px] font-black text-white uppercase">{room.settings.tiers[opponent.desperationTier - 1]}</span>
              </div>
            )}
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-400 mb-6 h-4 text-center">{isWheelSpinning ? 'RE-ALIGNING ENGAGEMENT PROTOCOLS...' : 'TARGET IDENTIFIED'}</span>
            <AnimatePresence mode="wait">
              {isWheelSpinning ? (
                <motion.div key="wheel" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.2 }}>
                  <TargetSuitWheel suit={room.targetSuit} isSpinning={isWheelSpinning} offset={room.wheelOffset} />
                </motion.div>
              ) : (
                <motion.div key="target-card" initial={{ opacity: 0, rotateY: 90 }} animate={{ opacity: 1, rotateY: 0 }} className="flex flex-col items-center gap-3">
                  <div className="w-24 h-36 sm:w-32 sm:h-48 bg-yellow-400 rounded-2xl shadow-[0_0_40px_rgba(250,204,21,0.3)] flex flex-col items-center justify-center border-4 border-yellow-200 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,#000_1px,transparent_1px)] bg-[size:10px_10px]" />
                    <span className={`text-7xl sm:text-9xl drop-shadow-2xl ${room.targetSuit ? SUIT_COLORS[room.targetSuit] : ''}`}>{room.targetSuit ? SUIT_ICONS[room.targetSuit] : '?'}</span>
                  </div>
                  <span className={`text-xs font-black uppercase tracking-widest ${room.targetSuit ? SUIT_COLORS[room.targetSuit] : ''}`}>{room.targetSuit}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : room.status === 'results' && room.lastOutcome ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center p-8 text-center">
            <div className="mb-4">
              {room.lastOutcome.winnerUid !== 'draw' ? (
                <div className="flex flex-col items-center">
                  <span className={`text-4xl sm:text-6xl font-black uppercase tracking-tighter mb-2 ${room.players[room.lastOutcome.winnerUid].role === 'Predator' ? 'text-red-500' : room.players[room.lastOutcome.winnerUid].role === 'Prey' ? 'text-blue-400' : 'text-purple-500'}`}>{room.players[room.lastOutcome.winnerUid].name} WINS</span>
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">CLASH RESOLUTION COMPLETE</span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <span className="text-4xl sm:text-6xl font-black uppercase tracking-tighter mb-2 text-emerald-500">STALEMATE</span>
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">NO ASSETS RECOVERED</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-12 sm:gap-20 mb-12">
              {Object.entries(room.lastOutcome.cardsPlayed).map(([uid, card]) => (
                <div key={uid} className="flex flex-col items-center gap-4">
                  <span className={`text-[10px] font-black uppercase ${uid === myUid ? 'text-emerald-400' : 'text-emerald-600'}`}>{room.players[uid].name}</span>
                  <div className="relative">
                    <CardVisual card={card} noAnimate />
                    {room.lastOutcome?.winnerUid === uid && (
                      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1.2, opacity: 1 }} className="absolute -top-4 -right-4 bg-yellow-400 text-emerald-950 p-1.5 rounded-full shadow-lg z-10">
                        <Trophy className="w-4 h-4" />
                      </motion.div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <span className="text-sm font-bold text-white/80 max-w-xs mb-10">{room.lastOutcome.message}</span>
            <button onClick={handleNextRound} disabled={me.readyForNextRound} className={`flex items-center gap-3 px-12 py-4 rounded-full font-black uppercase tracking-widest text-sm transition-all ${me.readyForNextRound ? 'bg-emerald-900/30 text-emerald-700 border border-emerald-800' : 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.3)]'}`}>
              {me.readyForNextRound ? <><RefreshCw className="w-5 h-5 animate-spin" />Waiting for Response</> : <><ChevronRight className="w-5 h-5" />Engage Next Round</>}
            </button>
          </motion.div>
        ) : null}
      </div>

      <div className="mt-auto px-4 pb-4">
        {me.desperationTier > 0 && <div className="flex flex-col items-center mb-2"><span className="text-[10px] font-black text-purple-400 uppercase tracking-widest animate-pulse">Desperation Tier: {room.settings.tiers[me.desperationTier - 1]}</span></div>}
        <div className="flex justify-between items-end mb-2">
          <span className="text-[10px] font-bold opacity-50 uppercase tracking-tighter">Cards: {me.hand.length}</span>
          <div className="flex items-center gap-3">
            {me.hand.length === 1 && me.role !== 'Predator' && room.settings.enableDesperation && !me.confirmed && me.desperationTier < room.settings.tiers.length && (
              <motion.div initial={{ scale: 0, y: 50, x: '-50%' }} animate={{ scale: 1, y: 0, x: '-50%' }} className="absolute left-1/2 bottom-64 z-[50]">
                <button onClick={handleOpenDesperationWheel} className="bg-purple-900 border-2 border-purple-500 text-white px-10 py-6 rounded-3xl text-sm font-black uppercase flex flex-col items-center gap-3 hover:bg-purple-600 transition-all shadow-[0_0_60px_rgba(168,85,247,0.5)] hover:scale-110 active:scale-95 group relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-purple-500/20 to-transparent group-hover:from-purple-500/40 transition-all" />
                  <Skull className="w-8 h-8 relative z-10 animate-pulse" /><span className="relative z-10">Desperation Protocol</span><span className="text-[10px] opacity-60 relative z-10">{room.settings.tiers[me.desperationTier]}</span>
                </button>
              </motion.div>
            )}
            {selectedCard && !me.confirmed && <button onClick={handlePlayCard} disabled={loading} className="bg-yellow-400 text-emerald-950 px-6 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-yellow-400/20 active:scale-90 transition-all">Engage</button>}
            {me.confirmed && <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest animate-pulse">Target Locked</span>}
          </div>
        </div>
        <div className="flex justify-center -space-x-8 sm:-space-x-12 flex-nowrap h-40 items-end">
          {me.hand.map((card, i) => <CardVisual key={card} card={card} selected={selectedCard === card} disabled={me.confirmed} onClick={() => !me.confirmed && setSelectedCard(card)} role={me.role} delay={i * 0.08} />)}
        </div>
      </div>

      {room.status === 'finished' && (
        <EndGameOverlay
          iWon={room.winner === myUid}
          meRole={me.role}
          opponentName={opponent?.name}
          meDesperationTier={me.desperationTier}
          meDesperationResult={me.desperationResult}
          opponentDesperationTier={opponent?.desperationTier || 0}
          opponentDesperationResult={opponent?.desperationResult || null}
          tiers={room.settings.tiers}
          onExit={() => setRoomId(null)}
        />
      )}

      <RulesModal open={showRules} onClose={() => setShowRules(false)} />
    </div>
  );
};
