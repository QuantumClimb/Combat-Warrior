/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Godot 4.x Porting Guide & Architecture Blueprint.
 * Outlines the direct 1:1 translation from this pure TypeScript engine into GDScript / C#.
 */

import React from 'react';
import { X, Cpu, Layers, GitBranch, Shield, Zap } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const GodotPortingGuide: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-stone-950 border border-stone-800 rounded-xl shadow-2xl text-stone-200 p-6 md:p-8 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-wider text-amber-400 uppercase font-mono">
                Godot 4.x Porting Blueprint
              </h2>
              <p className="text-xs text-stone-400">
                1:1 Architectural mapping from pure TypeScript logic to Godot Engine (GDScript / C#)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-6 space-y-6 text-sm">
          {/* Section 1: Pure Logic Decoupling */}
          <div className="bg-stone-900/60 border border-stone-800/80 rounded-lg p-5">
            <div className="flex items-center gap-2 text-amber-400 font-semibold mb-2">
              <Layers className="w-4 h-4" />
              <span>1. Zero-Dependency Logic Separation</span>
            </div>
            <p className="text-stone-300 leading-relaxed">
              In this prototype, every combat rule—FSM transitions, attack frames, input buffers, and AABB clash checks—is written in <span className="text-white font-mono">pure TypeScript</span> without importing any Phaser classes.
            </p>
            <p className="text-stone-400 mt-2 text-xs">
              This guarantees that when porting to Godot, the gameplay rules can be copied into pure <span className="text-amber-300 font-mono">RefCounted</span> classes or C# POCOs, completely decoupled from rendering and node trees.
            </p>
          </div>

          {/* Section 2: Mapping Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-stone-800 text-stone-400 bg-stone-900/40">
                  <th className="py-2.5 px-3">TS Prototype Class</th>
                  <th className="py-2.5 px-3">Godot 4.x Equivalent</th>
                  <th className="py-2.5 px-3">Role & Implementation Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60 text-stone-300">
                <tr>
                  <td className="py-2.5 px-3 text-cyan-400 font-semibold">CombatEngine.ts</td>
                  <td className="py-2.5 px-3 text-amber-300 font-semibold">CombatEngine.gd (Node)</td>
                  <td className="py-2.5 px-3 text-stone-400">
                    Runs inside <code className="text-stone-200">_physics_process(delta)</code> at fixed 60Hz tick rate. Resolves pushboxes and hit/hurtbox clashes.
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-cyan-400 font-semibold">FighterFSM.ts</td>
                  <td className="py-2.5 px-3 text-amber-300 font-semibold">FighterFSM.gd (RefCounted)</td>
                  <td className="py-2.5 px-3 text-stone-400">
                    Pure state machine with frame-counting pipeline (Startup, Active, Recovery, Stun).
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-cyan-400 font-semibold">InputBuffer.ts</td>
                  <td className="py-2.5 px-3 text-amber-300 font-semibold">InputBuffer.gd (RefCounted)</td>
                  <td className="py-2.5 px-3 text-stone-400">
                    Circular buffer of 30 frame snapshots. Recognizes motions (QCF, Down+HP) and input leniency buffering.
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-cyan-400 font-semibold">FrameData.ts</td>
                  <td className="py-2.5 px-3 text-amber-300 font-semibold">AttackData.tres (Custom Resource)</td>
                  <td className="py-2.5 px-3 text-stone-400">
                    Define attacks as Godot <code className="text-stone-200">Resource</code> files for easy editing in the Godot Inspector.
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-cyan-400 font-semibold">HitboxManager.ts</td>
                  <td className="py-2.5 px-3 text-amber-300 font-semibold">AABB Math or Area2D</td>
                  <td className="py-2.5 px-3 text-stone-400">
                    For deterministic rollback netcode, pure integer/float AABB math is preferred over physics engine queries.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 3: Rollback Netcode Ready */}
          <div className="bg-stone-900/60 border border-stone-800/80 rounded-lg p-5">
            <div className="flex items-center gap-2 text-cyan-400 font-semibold mb-2">
              <Zap className="w-4 h-4" />
              <span>2. Deterministic & Rollback Netcode (GGPO) Compatibility</span>
            </div>
            <p className="text-stone-300 leading-relaxed text-xs">
              Because the simulation runs on an accumulator-driven <span className="text-white font-mono">tick(p1Input, p2Input)</span> loop without depending on delta-time physics:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-xs text-stone-400">
              <li>State can be serialized into a binary snapshot (<code className="text-stone-300">save_state() / load_state()</code>).</li>
              <li>Compatible with Godot GGPO / Godot Rollback Netcode add-ons for lag-free online play.</li>
              <li>Replay recording simply requires saving the 60Hz raw input stream per frame.</li>
            </ul>
          </div>

          {/* Section 4: Classic MK Rule Checklist */}
          <div className="bg-stone-900/60 border border-stone-800/80 rounded-lg p-5">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-2">
              <Shield className="w-4 h-4" />
              <span>3. Classic Mortal Kombat Mechanics Implemented</span>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-stone-300 mt-2">
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Dedicated Block Button (Not hold back)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>High attacks whiff on neutral crouch</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Low attacks pierce standing high block</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>MK Uppercut with massive launch arc</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Chip damage on blocked special / normals</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Pushboxes preventing fighter clipping</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-stone-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
          >
            Got it, Return to Combat
          </button>
        </div>
      </div>
    </div>
  );
};
