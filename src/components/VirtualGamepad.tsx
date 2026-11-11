/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Virtual Gamepad Controls.
 * Allows quick touch / mouse testing of attacks, directions, and special motions.
 */

import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Shield } from 'lucide-react';
import { CombatScene } from '../game/phaser/CombatScene';

interface Props {
  scene: CombatScene | null;
}

export const VirtualGamepad: React.FC<Props> = ({ scene }) => {
  if (!scene) return null;

  const setButton = (key: 'up' | 'down' | 'left' | 'right' | 'lp' | 'hp' | 'lk' | 'hk' | 'block', isDown: boolean) => {
    scene.p1RawInput[key] = isDown;
  };

  const triggerMotion = (type: 'UPPERCUT' | 'ICE_BLAST' | 'SWEEP') => {
    if (type === 'UPPERCUT') {
      // Down + HP
      scene.p1RawInput.down = true;
      scene.p1RawInput.hp = true;
      setTimeout(() => {
        scene.p1RawInput.hp = false;
        scene.p1RawInput.down = false;
      }, 50);
    } else if (type === 'SWEEP') {
      // Back + LK
      const backKey = scene.combatEngine.fighter1.facing === 1 ? 'left' : 'right';
      scene.p1RawInput[backKey] = true;
      scene.p1RawInput.lk = true;
      setTimeout(() => {
        scene.p1RawInput.lk = false;
        scene.p1RawInput[backKey] = false;
      }, 50);
    } else if (type === 'ICE_BLAST') {
      // Down -> Forward + HP simulation
      const fwdKey = scene.combatEngine.fighter1.facing === 1 ? 'right' : 'left';
      scene.p1RawInput.down = true;
      setTimeout(() => {
        scene.p1RawInput.down = false;
        scene.p1RawInput[fwdKey] = true;
        scene.p1RawInput.hp = true;
        setTimeout(() => {
          scene.p1RawInput[fwdKey] = false;
          scene.p1RawInput.hp = false;
        }, 50);
      }, 35);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-stone-900/90 border-t border-stone-800 text-xs font-mono select-none">
      {/* Direction Pad */}
      <div className="flex items-center gap-1.5">
        <span className="text-stone-400 text-[10px] uppercase font-bold mr-1">Move:</span>
        <button
          onMouseDown={() => setButton('left', true)}
          onMouseUp={() => setButton('left', false)}
          onTouchStart={() => setButton('left', true)}
          onTouchEnd={() => setButton('left', false)}
          className="w-8 h-8 rounded bg-stone-800 active:bg-cyan-600 border border-stone-700 flex items-center justify-center text-stone-200 active:text-white"
          title="Left (A)"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          onMouseDown={() => setButton('down', true)}
          onMouseUp={() => setButton('down', false)}
          onTouchStart={() => setButton('down', true)}
          onTouchEnd={() => setButton('down', false)}
          className="w-8 h-8 rounded bg-stone-800 active:bg-cyan-600 border border-stone-700 flex items-center justify-center text-stone-200 active:text-white"
          title="Crouch (S)"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
        <button
          onMouseDown={() => setButton('up', true)}
          onMouseUp={() => setButton('up', false)}
          onTouchStart={() => setButton('up', true)}
          onTouchEnd={() => setButton('up', false)}
          className="w-8 h-8 rounded bg-stone-800 active:bg-cyan-600 border border-stone-700 flex items-center justify-center text-stone-200 active:text-white"
          title="Jump (W)"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
        <button
          onMouseDown={() => setButton('right', true)}
          onMouseUp={() => setButton('right', false)}
          onTouchStart={() => setButton('right', true)}
          onTouchEnd={() => setButton('right', false)}
          className="w-8 h-8 rounded bg-stone-800 active:bg-cyan-600 border border-stone-700 flex items-center justify-center text-stone-200 active:text-white"
          title="Right (D)"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Attack Buttons */}
      <div className="flex items-center gap-2">
        <span className="text-stone-400 text-[10px] uppercase font-bold mr-1">Attacks:</span>
        <button
          onMouseDown={() => setButton('hp', true)}
          onMouseUp={() => setButton('hp', false)}
          onTouchStart={() => setButton('hp', true)}
          onTouchEnd={() => setButton('hp', false)}
          className="px-2.5 py-1.5 rounded bg-amber-500/20 active:bg-amber-500 border border-amber-500/40 text-amber-300 active:text-stone-950 font-bold"
          title="High Punch (U)"
        >
          HP
        </button>
        <button
          onMouseDown={() => setButton('lp', true)}
          onMouseUp={() => setButton('lp', false)}
          onTouchStart={() => setButton('lp', true)}
          onTouchEnd={() => setButton('lp', false)}
          className="px-2.5 py-1.5 rounded bg-stone-800 active:bg-cyan-600 border border-stone-700 text-stone-200 active:text-white font-bold"
          title="Low Punch (J)"
        >
          LP
        </button>
        <button
          onMouseDown={() => setButton('hk', true)}
          onMouseUp={() => setButton('hk', false)}
          onTouchStart={() => setButton('hk', true)}
          onTouchEnd={() => setButton('hk', false)}
          className="px-2.5 py-1.5 rounded bg-amber-500/20 active:bg-amber-500 border border-amber-500/40 text-amber-300 active:text-stone-950 font-bold"
          title="High Kick (I)"
        >
          HK
        </button>
        <button
          onMouseDown={() => setButton('lk', true)}
          onMouseUp={() => setButton('lk', false)}
          onTouchStart={() => setButton('lk', true)}
          onTouchEnd={() => setButton('lk', false)}
          className="px-2.5 py-1.5 rounded bg-stone-800 active:bg-cyan-600 border border-stone-700 text-stone-200 active:text-white font-bold"
          title="Low Kick (K)"
        >
          LK
        </button>
        <button
          onMouseDown={() => setButton('block', true)}
          onMouseUp={() => setButton('block', false)}
          onTouchStart={() => setButton('block', true)}
          onTouchEnd={() => setButton('block', false)}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-blue-600/30 active:bg-blue-500 border border-blue-500/50 text-blue-300 active:text-white font-bold"
          title="Dedicated Block (L / Space)"
        >
          <Shield className="w-3.5 h-3.5" />
          <span>BLOCK</span>
        </button>
      </div>

      {/* One-Click Command Triggers */}
      <div className="flex items-center gap-1.5">
        <span className="text-stone-400 text-[10px] uppercase font-bold mr-1">Command Macros:</span>
        <button
          onClick={() => triggerMotion('UPPERCUT')}
          className="px-2 py-1 rounded bg-red-950/60 hover:bg-red-900 border border-red-700/50 text-red-300 text-[11px]"
          title="Down + HP"
        >
          Uppercut
        </button>
        <button
          onClick={() => triggerMotion('ICE_BLAST')}
          className="px-2 py-1 rounded bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-700/50 text-cyan-300 text-[11px]"
          title="QCF + HP (Down -> Forward + HP)"
        >
          Ice Blast
        </button>
        <button
          onClick={() => triggerMotion('SWEEP')}
          className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-300 text-[11px]"
          title="Back + LK"
        >
          Sweep
        </button>
      </div>
    </div>
  );
};
