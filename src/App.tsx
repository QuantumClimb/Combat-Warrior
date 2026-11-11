/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Mortal Kombat 2D Arcade Combat Engine & Frame Data Prototype.
 * Decoupled 60 FPS Combat Architecture in Phaser 3 built for Godot 4 console porting.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import { 
  Play, 
  Pause, 
  SkipForward, 
  RotateCcw, 
  Eye, 
  Volume2, 
  VolumeX, 
  BookOpen, 
  Gamepad2, 
  Flame, 
  Zap,
  ArrowRight,
  Home
} from 'lucide-react';
import { CombatScene, DummyBehavior } from './game/phaser/CombatScene';
import { CombatEngine } from './game/combat/CombatEngine';
import { soundEffects } from './game/audio/SoundEffects';
import { GodotPortingGuide } from './components/GodotPortingGuide';
import { VirtualGamepad } from './components/VirtualGamepad';
import { FighterState } from './game/combat/CombatTypes';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<CombatScene | null>(null);

  // Game UI State
  const [engineState, setEngineState] = useState<CombatEngine | null>(null);
  const [isGameStarted, setIsGameStarted] = useState<boolean>(false);
  const [showGodotGuide, setShowGodotGuide] = useState<boolean>(false);
  const [showVirtualPad, setShowVirtualPad] = useState<boolean>(false);

  // Engine control state
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1.0);
  const [showHitboxes, setShowHitboxes] = useState<boolean>(true);
  const [dummyMode, setDummyMode] = useState<DummyBehavior>('CPU_AI');
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Initialize Phaser Game
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new CombatScene();
    sceneRef.current = scene;

    scene.onStateUpdate = (engine: CombatEngine) => {
      // Throttle UI update every 2 simulation frames
      if (engine.simulationFrame % 2 === 0) {
        setEngineState(engine);
      }
    };

    scene.onPauseToggle = (paused: boolean) => {
      setIsPaused(paused);
    };

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: 960,
      height: 540,
      backgroundColor: '#0a0c14',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: {
        pixelArt: true,
        antialias: false,
      },
      scene: [scene],
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  // Global Keyboard listener for Start, Pause, and Resume
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      if (!isGameStarted) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleStartGame();
        }
        return;
      }

      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        togglePause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGameStarted, isPaused]);

  // Actions
  const handleStartGame = () => {
    setIsGameStarted(true);
    setIsPaused(false);
    sceneRef.current?.startGame();
  };

  const togglePause = () => {
    if (!sceneRef.current) return;
    const nextPaused = !isPaused;
    sceneRef.current.isPaused = nextPaused;
    setIsPaused(nextPaused);
  };

  const handleResumeGame = () => {
    if (!sceneRef.current) return;
    sceneRef.current.resumeGame();
    setIsPaused(false);
  };

  const handleReturnToTitle = () => {
    if (!sceneRef.current) return;
    sceneRef.current.returnToTitle();
    setIsGameStarted(false);
    setIsPaused(false);
  };

  const stepOneFrame = () => {
    if (!sceneRef.current) return;
    sceneRef.current.stepOnce = true;
    setIsPaused(true);
  };

  const handleSpeedChange = (speed: number) => {
    if (!sceneRef.current) return;
    sceneRef.current.simulationSpeed = speed;
    setSimulationSpeed(speed);
  };

  const handleHitboxToggle = () => {
    if (!sceneRef.current) return;
    const nextVal = !showHitboxes;
    sceneRef.current.showHitboxes = nextVal;
    setShowHitboxes(nextVal);
  };

  const handleDummyChange = (mode: DummyBehavior) => {
    if (!sceneRef.current) return;
    sceneRef.current.dummyMode = mode;
    setDummyMode(mode);
  };

  const handleResetMatch = () => {
    if (!sceneRef.current) return;
    sceneRef.current.resetSimulation();
  };

  const handleMuteToggle = () => {
    soundEffects.isMuted = !isMuted;
    setIsMuted(!isMuted);
  };

  // Helper getters for HUD
  const p1 = engineState?.fighter1;
  const p2 = engineState?.fighter2;

  const p1Attack = p1?.fsm.currentAttack;
  const p1State = p1?.fsm.currentState || FighterState.IDLE;
  const p1Frame = p1?.fsm.stateFrame || 0;
  const p1Advantage = p1?.lastAdvantage;

  return (
    <div className="relative w-screen h-screen bg-stone-950 text-stone-100 flex flex-col font-sans select-none overflow-hidden">
      {/* 1. TITLE SCREEN: Visible until user presses Start */}
      {!isGameStarted && (
        <div className="absolute inset-0 z-50 bg-stone-950/95 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
          <div className="max-w-xl mx-auto space-y-6">
            <div className="flex items-center justify-center gap-3">
              <Flame className="w-10 h-10 text-red-600 animate-pulse" />
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-widest text-amber-400 font-mono uppercase drop-shadow-[0_4px_12px_rgba(255,200,0,0.4)]">
                KOMBAT CORE
              </h1>
              <Flame className="w-10 h-10 text-red-600 animate-pulse" />
            </div>

            <p className="text-sm md:text-base text-stone-300 font-medium leading-relaxed">
              Decoupled 60 FPS 2D Arcade Fighting Game Prototype for Phaser 3 & Godot Porting.
              Pure FSM, Input Buffer, Frame-Counting Attacks & Dedicated Block.
            </p>

            <div className="bg-stone-900/80 border border-stone-800 rounded-lg p-4 text-xs font-mono text-stone-300 text-left space-y-2">
              <div className="text-amber-400 font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Player 1 Arcade Controls:</span>
                <span className="text-[10px] text-stone-500 font-normal">WASD + U/J/I/K/L</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                <div><span className="text-cyan-400 font-semibold">WASD</span> : Move / Jump / Crouch</div>
                <div><span className="text-cyan-400 font-semibold">Space / L</span> : Dedicated Block</div>
                <div><span className="text-amber-300 font-semibold">U</span> : High Punch (Fast poke)</div>
                <div><span className="text-amber-300 font-semibold">J</span> : Low Punch (Mid)</div>
                <div><span className="text-amber-300 font-semibold">I</span> : High Kick</div>
                <div><span className="text-amber-300 font-semibold">K</span> : Low Kick (Hits Low)</div>
                <div><span className="text-red-400 font-semibold">Down + U</span> : MK Uppercut (Launch!)</div>
                <div><span className="text-red-400 font-semibold">Down, Forward + U</span> : Ice Blast</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <button
                onClick={handleStartGame}
                className="px-8 py-3.5 bg-red-700 hover:bg-red-600 active:bg-red-800 text-white font-black tracking-widest uppercase rounded-lg shadow-xl shadow-red-950/70 transition-all hover:scale-105 cursor-pointer font-mono flex items-center gap-2"
              >
                <span>ENTER KOMBAT (START)</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowGodotGuide(true)}
                className="px-4 py-3 bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs tracking-wider uppercase rounded-lg border border-stone-700 transition-colors cursor-pointer flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4 text-amber-400" />
                <span>Godot Porting Blueprint</span>
              </button>
            </div>
            <div className="text-stone-400 text-[11px] font-mono">
              Press <span className="text-stone-200 font-bold">ENTER</span> or <span className="text-stone-200 font-bold">SPACE</span> to Start · <span className="text-stone-200 font-bold">ESC</span> to Pause
            </div>
          </div>
        </div>
      )}

      {/* 2. PAUSED SPLASH SCREEN: Visible when paused during active combat */}
      {isGameStarted && isPaused && (
        <div className="absolute inset-0 z-45 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center select-none animate-fadeIn">
          <div className="max-w-lg w-full bg-stone-950 border-2 border-stone-800 rounded-xl p-6 md:p-8 shadow-2xl space-y-6">
            {/* Header */}
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2 text-red-500">
                <Flame className="w-6 h-6 animate-pulse" />
                <h2 className="text-3xl md:text-4xl font-black tracking-widest text-amber-400 font-mono uppercase drop-shadow-[0_2px_10px_rgba(255,200,0,0.4)]">
                  PAUSED
                </h2>
                <Flame className="w-6 h-6 animate-pulse" />
              </div>
              <p className="text-xs text-stone-400 uppercase tracking-widest font-mono">
                Combat Simulation Halted at Frame {engineState?.simulationFrame || 0}
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-col gap-2.5 max-w-xs mx-auto">
              <button
                onClick={handleResumeGame}
                className="w-full py-3 bg-red-700 hover:bg-red-600 active:bg-red-800 text-white font-black tracking-widest uppercase rounded-lg shadow-lg shadow-red-950/60 transition-all cursor-pointer font-mono flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                <span>RESUME KOMBAT</span>
              </button>

              <button
                onClick={stepOneFrame}
                className="w-full py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs tracking-wider uppercase rounded-lg border border-stone-700 transition-colors cursor-pointer flex items-center justify-center gap-2 font-mono"
              >
                <SkipForward className="w-4 h-4 text-cyan-400" />
                <span>STEP 1 FRAME (F60 TICK)</span>
              </button>

              <button
                onClick={handleResetMatch}
                className="w-full py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs tracking-wider uppercase rounded-lg border border-stone-700 transition-colors cursor-pointer flex items-center justify-center gap-2 font-mono"
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <span>RESTART MATCH</span>
              </button>

              <button
                onClick={() => setShowGodotGuide(true)}
                className="w-full py-2 bg-stone-900 hover:bg-stone-800 text-stone-300 font-semibold text-xs tracking-wider uppercase rounded-lg border border-stone-700/60 transition-colors cursor-pointer flex items-center justify-center gap-2 font-mono"
              >
                <BookOpen className="w-4 h-4 text-amber-400" />
                <span>FRAME DATA & GODOT BLUEPRINT</span>
              </button>

              <button
                onClick={handleReturnToTitle}
                className="w-full py-2 bg-stone-900/60 hover:bg-stone-900 text-stone-400 hover:text-stone-200 font-semibold text-xs tracking-wider uppercase rounded-lg border border-stone-800 transition-colors cursor-pointer flex items-center justify-center gap-2 font-mono mt-1"
              >
                <Home className="w-4 h-4" />
                <span>RETURN TO TITLE SCREEN</span>
              </button>
            </div>

            {/* Quick Move List Inset */}
            <div className="bg-stone-900/80 border border-stone-800 rounded-lg p-3 text-left font-mono text-[11px] text-stone-300 space-y-1.5">
              <div className="text-amber-400 font-bold uppercase text-[10px] tracking-wider mb-1">
                Kombat Frame Reference:
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-stone-400">
                <div><span className="text-stone-200 font-bold">U (HP):</span> 5f Startup (High Poke)</div>
                <div><span className="text-stone-200 font-bold">J (LP):</span> 6f Startup (Mid Poke)</div>
                <div><span className="text-stone-200 font-bold">K (LK):</span> 7f Startup (Hits Low!)</div>
                <div><span className="text-stone-200 font-bold">I (HK):</span> 9f Startup (High Kick)</div>
                <div><span className="text-red-400 font-bold">Down+U:</span> MK Uppercut (Launch)</div>
                <div><span className="text-cyan-400 font-bold">QCF+U:</span> Ice Blast Projectile</div>
              </div>
            </div>

            <div className="text-stone-400 text-[10px] font-mono">
              Press <span className="text-stone-200 font-bold">ESC</span> or <span className="text-stone-200 font-bold">P</span> to Resume Kombat
            </div>
          </div>
        </div>
      )}

      {/* Arcade Header HUD: Health Bars & Fight Timer */}
      <header className="relative z-20 w-full px-4 pt-3 pb-2 bg-gradient-to-b from-stone-950 via-stone-900/90 to-transparent flex items-center justify-between border-b border-stone-800/60">
        {/* P1 Sub-Zero Health Bar */}
        <div className="flex-1 max-w-[38%]">
          <div className="flex items-center justify-between text-xs font-mono font-bold tracking-wider mb-1">
            <span className="text-cyan-400 uppercase drop-shadow-[0_0_8px_rgba(0,220,255,0.4)]">
              SUB-ZERO
            </span>
            <span className="text-stone-400 tabular-nums">
              {p1 ? Math.round(p1.health) : 100}%
            </span>
          </div>
          <div className="h-5 bg-stone-950 border-2 border-amber-600/80 rounded-xs overflow-hidden p-0.5 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-green-500 transition-all duration-75"
              style={{ width: `${p1 ? (p1.health / p1.maxHealth) * 100 : 100}%` }}
            />
          </div>
        </div>

        {/* Center Round Timer & MK Emblem */}
        <div className="flex flex-col items-center justify-center px-4">
          <div className="w-10 h-10 rounded-full border-2 border-amber-500/80 bg-stone-900 flex items-center justify-center text-amber-400 shadow-md">
            <Flame className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-xs font-mono font-black text-amber-400 mt-0.5 tracking-widest">
            {isPaused ? 'PAUSED' : '60 FPS'}
          </div>
        </div>

        {/* P2 Scorpion Health Bar */}
        <div className="flex-1 max-w-[38%]">
          <div className="flex items-center justify-between text-xs font-mono font-bold tracking-wider mb-1">
            <span className="text-stone-400 tabular-nums">
              {p2 ? Math.round(p2.health) : 100}%
            </span>
            <span className="text-amber-400 uppercase drop-shadow-[0_0_8px_rgba(255,200,0,0.4)]">
              SCORPION
            </span>
          </div>
          <div className="h-5 bg-stone-950 border-2 border-amber-600/80 rounded-xs overflow-hidden p-0.5 shadow-inner flex justify-end">
            <div
              className="h-full bg-gradient-to-l from-red-600 via-amber-500 to-green-500 transition-all duration-75"
              style={{ width: `${p2 ? (p2.health / p2.maxHealth) * 100 : 100}%` }}
            />
          </div>
        </div>
      </header>

      {/* Main Playfield: Phaser 3 Canvas Container */}
      <main className="relative flex-1 w-full bg-black flex items-center justify-center overflow-hidden">
        <div ref={containerRef} className="w-full h-full flex items-center justify-center" />

        {/* Floating Combo Counter on active hits */}
        {p1 && p1.comboHits > 1 && (
          <div className="absolute top-12 left-10 pointer-events-none z-30 font-mono">
            <div className="text-3xl font-black text-yellow-400 italic tracking-wider drop-shadow-[0_3px_6px_rgba(0,0,0,0.9)] animate-bounce">
              {p1.comboHits} HITS!
            </div>
          </div>
        )}

        {/* Frame Advantage Floating Chip */}
        {p1Advantage && (
          <div className="absolute top-4 right-10 pointer-events-none z-30 font-mono">
            <div
              className={`px-3 py-1 text-xs font-bold rounded border ${
                p1Advantage.value > 0
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                  : p1Advantage.value < 0
                  ? 'bg-red-950/80 border-red-500 text-red-300'
                  : 'bg-stone-900/80 border-stone-600 text-stone-300'
              }`}
            >
              {p1Advantage.moveName}: {p1Advantage.value > 0 ? `+${p1Advantage.value}` : p1Advantage.value} on {p1Advantage.type}
              {p1Advantage.value <= -10 && ' (PUNISHABLE!)'}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Frame Data & Input Buffer Inspector HUD */}
      <footer className="relative z-20 w-full bg-stone-900/95 border-t border-stone-800 text-xs font-mono">
        {/* Frame Data & Input Queue Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 px-4 py-2.5 items-center border-b border-stone-800/80">
          {/* Left: Input Buffer Stream (P1 Last 8 inputs) */}
          <div className="md:col-span-5 flex items-center gap-2 overflow-x-auto py-0.5">
            <span className="text-stone-400 uppercase text-[11px] font-bold shrink-0 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Input Queue:</span>
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {p1?.inputBuffer.history.slice(0, 10).map((snap, i) => {
                const dir = snap.down && snap.forward ? '↘' 
                  : snap.down && snap.back ? '↙' 
                  : snap.down ? '⬇' 
                  : snap.up ? '⬆' 
                  : snap.forward ? '➡' 
                  : snap.back ? '⬅' 
                  : '•';

                const btns = [
                  snap.hp && 'HP',
                  snap.lp && 'LP',
                  snap.hk && 'HK',
                  snap.lk && 'LK',
                  snap.block && 'BLK',
                ].filter(Boolean);

                return (
                  <div
                    key={`${snap.frame}-${i}`}
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border ${
                      i === 0
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                        : 'bg-stone-800 border-stone-700 text-stone-400'
                    }`}
                  >
                    <span>{dir}</span>
                    {btns.length > 0 && (
                      <span className="text-cyan-300 font-semibold">{btns.join('+')}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Center: Live Attack Frame Breakdown Bar */}
          <div className="md:col-span-4 flex flex-col justify-center">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-stone-300 font-semibold">
                State: <span className="text-cyan-400">{p1State}</span>
                {p1Attack && ` (${p1Attack.name})`}
              </span>
              <span className="text-stone-400 tabular-nums">
                {p1Attack ? `F: ${p1Frame} / ${p1Attack.totalFrames}` : `F: ${p1Frame}`}
              </span>
            </div>

            {/* Visual Frame Bar: Startup (Yellow), Active (Red), Recovery (Gray) */}
            {p1Attack ? (
              <div className="relative h-2.5 w-full bg-stone-950 rounded-xs overflow-hidden flex border border-stone-700">
                {/* Startup frames */}
                <div
                  className="bg-amber-400 h-full"
                  style={{ width: `${(p1Attack.startupFrames / p1Attack.totalFrames) * 100}%` }}
                  title={`Startup: ${p1Attack.startupFrames}f`}
                />
                {/* Active frames */}
                <div
                  className="bg-red-500 h-full"
                  style={{ width: `${(p1Attack.activeFrames / p1Attack.totalFrames) * 100}%` }}
                  title={`Active: ${p1Attack.activeFrames}f`}
                />
                {/* Recovery frames */}
                <div
                  className="bg-stone-600 h-full flex-1"
                  title={`Recovery: ${p1Attack.recoveryFrames}f`}
                />
                {/* Current needle marker */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_4px_#fff]"
                  style={{ left: `${Math.min(100, (p1Frame / p1Attack.totalFrames) * 100)}%` }}
                />
              </div>
            ) : (
              <div className="h-2.5 w-full bg-stone-800 rounded-xs border border-stone-700/60 flex items-center justify-center text-[9px] text-stone-500">
                Actionable / Neutral
              </div>
            )}
          </div>

          {/* Right: Hitbox & Advantage Stats */}
          <div className="md:col-span-3 flex items-center justify-end gap-3 text-[11px]">
            <div className="text-right">
              <div className="text-stone-400 text-[10px]">Attack Property:</div>
              <div className="font-bold text-amber-300">
                {p1Attack ? p1Attack.attackType : 'None'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-stone-400 text-[10px]">Advantage:</div>
              <div className={`font-bold ${
                p1Advantage && p1Advantage.value > 0 ? 'text-emerald-400' : p1Advantage && p1Advantage.value < 0 ? 'text-red-400' : 'text-stone-300'
              }`}>
                {p1Advantage ? (p1Advantage.value > 0 ? `+${p1Advantage.value}` : p1Advantage.value) : '0'}
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar & Simulation Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-stone-950">
          {/* Play/Pause/Step & Speed */}
          <div className="flex items-center gap-2">
            <button
              onClick={togglePause}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-bold transition-colors cursor-pointer ${
                isPaused
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-200'
              }`}
              title="Pause / Resume 60 FPS Logic (Esc / P)"
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{isPaused ? 'RESUME' : 'PAUSE'}</span>
            </button>

            <button
              onClick={stepOneFrame}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 cursor-pointer"
              title="Advance exactly 1 fixed 60Hz tick"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>STEP 1 FRAME</span>
            </button>

            {/* Speed Selector */}
            <div className="flex items-center gap-1 bg-stone-900 border border-stone-800 rounded p-0.5">
              {[1.0, 0.5, 0.2].map((spd) => (
                <button
                  key={spd}
                  onClick={() => handleSpeedChange(spd)}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                    simulationSpeed === spd
                      ? 'bg-amber-500 text-stone-950'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Dummy Mode / AI Selector */}
          <div className="flex items-center gap-2">
            <span className="text-stone-400 text-[11px]">Opponent:</span>
            <select
              value={dummyMode}
              onChange={(e) => handleDummyChange(e.target.value as DummyBehavior)}
              className="bg-stone-900 border border-stone-700 rounded px-2.5 py-1 text-stone-200 text-xs font-mono cursor-pointer focus:outline-hidden focus:border-amber-500"
            >
              <option value="CPU_AI">CPU AI (Active Bot)</option>
              <option value="STAND_DUMMY">Stand Dummy</option>
              <option value="CROUCH_DUMMY">Crouch Dummy (Test High Whiff)</option>
              <option value="BLOCK_HIGH_DUMMY">Block High (Low Pierces)</option>
              <option value="BLOCK_LOW_DUMMY">Block Low (Mid Hits)</option>
              <option value="JUMP_DUMMY">Jump Dummy (Anti-Air)</option>
              <option value="LOCAL_P2">Local P2 (Arrows + Numpad)</option>
            </select>
          </div>

          {/* Feature Toggles & Modals */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleHitboxToggle}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border transition-colors cursor-pointer text-xs ${
                showHitboxes
                  ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-300'
                  : 'bg-stone-900 border-stone-800 text-stone-500'
              }`}
              title="Toggle Hurtboxes (Green) and Hitboxes (Red) [H]"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Hitboxes: {showHitboxes ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={() => setShowVirtualPad(!showVirtualPad)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border transition-colors cursor-pointer text-xs ${
                showVirtualPad
                  ? 'bg-cyan-950/60 border-cyan-500/80 text-cyan-300'
                  : 'bg-stone-900 border-stone-800 text-stone-400'
              }`}
              title="Show Onscreen Touch / Mouse Controls"
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>Touch Pad</span>
            </button>

            <button
              onClick={handleResetMatch}
              className="p-1.5 rounded bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-white cursor-pointer"
              title="Reset Match & Positions"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={handleMuteToggle}
              className="p-1.5 rounded bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-white cursor-pointer"
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setShowGodotGuide(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold transition-colors cursor-pointer text-xs"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Godot Blueprint</span>
            </button>
          </div>
        </div>

        {/* On-Screen Virtual Gamepad when enabled */}
        {showVirtualPad && <VirtualGamepad scene={sceneRef.current} />}
      </footer>

      {/* Godot 4 Porting Blueprint Modal */}
      <GodotPortingGuide isOpen={showGodotGuide} onClose={() => setShowGodotGuide(false)} />
    </div>
  );
}
