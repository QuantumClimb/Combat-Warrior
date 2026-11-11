/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Command Input Buffer for Fighting Games.
 * Maintains an input history queue (e.g. 30 frames) to recognize:
 * 1. Motion inputs (e.g. Down -> Forward + HP for Projectile)
 * 2. Directional normals (e.g. Down + HP for Uppercut, Back + LK for Sweep)
 * 3. Input buffering (retaining button presses for reversal execution on first actionable frame)
 * 
 * Pure logic class with 0 external dependencies for easy Godot porting.
 */

import { InputSnapshot, RawInput } from './CombatTypes';

export interface BufferedCommand {
  command: string; // e.g. 'ICE_PROJECTILE', 'UPPERCUT', 'SWEEP', 'HIGH_PUNCH', etc.
  frame: number;
}

export class InputBuffer {
  public history: InputSnapshot[] = [];
  public maxHistory: number = 30;
  private previousRaw: RawInput = {
    up: false,
    down: false,
    left: false,
    right: false,
    lp: false,
    hp: false,
    lk: false,
    hk: false,
    block: false,
  };

  constructor(maxHistory: number = 30) {
    this.maxHistory = maxHistory;
  }

  /**
   * Pushes a new raw input tick into the buffer, normalized for fighter's facing direction.
   */
  public push(raw: RawInput, facing: number, currentFrame: number): InputSnapshot {
    const forward = facing === 1 ? raw.right : raw.left;
    const back = facing === 1 ? raw.left : raw.right;

    const prevForward = facing === 1 ? this.previousRaw.right : this.previousRaw.left;
    const prevBack = facing === 1 ? this.previousRaw.left : this.previousRaw.right;

    const snapshot: InputSnapshot = {
      frame: currentFrame,
      up: raw.up,
      down: raw.down,
      forward,
      back,
      lp: raw.lp,
      hp: raw.hp,
      lk: raw.lk,
      hk: raw.hk,
      block: raw.block,

      justUp: raw.up && !this.previousRaw.up,
      justDown: raw.down && !this.previousRaw.down,
      justForward: forward && !prevForward,
      justBack: back && !prevBack,
      justLp: raw.lp && !this.previousRaw.lp,
      justHp: raw.hp && !this.previousRaw.hp,
      justLk: raw.lk && !this.previousRaw.lk,
      justHk: raw.hk && !this.previousRaw.hk,
      justBlock: raw.block && !this.previousRaw.block,
    };

    this.history.unshift(snapshot);
    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }

    this.previousRaw = { ...raw };
    return snapshot;
  }

  public getLatest(): InputSnapshot | null {
    return this.history[0] || null;
  }

  /**
   * Checks if a button was pressed within the last `window` frames (input buffering).
   */
  public wasJustPressed(
    button: 'lp' | 'hp' | 'lk' | 'hk' | 'block',
    window: number = 4
  ): boolean {
    const checkLen = Math.min(window, this.history.length);
    for (let i = 0; i < checkLen; i++) {
      const snap = this.history[i];
      if (button === 'lp' && snap.justLp) return true;
      if (button === 'hp' && snap.justHp) return true;
      if (button === 'lk' && snap.justLk) return true;
      if (button === 'hk' && snap.justHk) return true;
      if (button === 'block' && snap.justBlock) return true;
    }
    return false;
  }

  /**
   * Evaluates special command motions and buffered moves in order of priority:
   * 1. Special Motions (e.g. QCF + HP)
   * 2. Command Normals (e.g. Down + HP Uppercut, Back + LK Sweep)
   * 3. Basic Attacks (HP, LP, HK, LK)
   */
  public evaluateCommand(canExecuteSpecials: boolean = true): string | null {
    if (this.history.length === 0) return null;
    const latest = this.history[0];

    // Priority 1: Special Moves - QCF + HP (Ice Blast / Fireball)
    // Motion: Down -> (Down+Forward optional) -> Forward within 18 frames + HP pressed
    if (canExecuteSpecials && this.wasJustPressed('hp', 5)) {
      if (this.detectQCF(18)) {
        return 'ICE_PROJECTILE';
      }
    }

    // Priority 2: Command Normals
    // Classic MK Uppercut: Down held + HP pressed (or justDown + HP)
    if (this.wasJustPressed('hp', 4) && (latest.down || this.wasDirectionHeld('down', 6))) {
      return 'UPPERCUT';
    }

    // Sweep: Back held + LK pressed
    if (this.wasJustPressed('lk', 4) && (latest.back || this.wasDirectionHeld('back', 6))) {
      return 'SWEEP';
    }

    // Priority 3: Basic Attacks
    if (this.wasJustPressed('hp', 4)) {
      return 'HIGH_PUNCH';
    }
    if (this.wasJustPressed('lp', 4)) {
      return 'LOW_PUNCH';
    }
    if (this.wasJustPressed('hk', 4)) {
      return 'HIGH_KICK';
    }
    if (this.wasJustPressed('lk', 4)) {
      return 'LOW_KICK';
    }

    return null;
  }

  /**
   * Detects Quarter Circle Forward: Down -> [Down+Forward] -> Forward
   */
  private detectQCF(window: number = 18): boolean {
    const limit = Math.min(window, this.history.length);
    let step = 0; // 0 = need forward, 1 = need down-forward or down, 2 = need down

    for (let i = 0; i < limit; i++) {
      const snap = this.history[i];

      if (step === 0) {
        // Need forward direction at or very near button press
        if (snap.forward) {
          step = 1;
        }
      } else if (step === 1) {
        // Looking backwards for down-forward or pure down
        if (snap.down && snap.forward) {
          step = 2;
        } else if (snap.down && !snap.forward) {
          // Found direct down without diagonal (still valid QCF)
          return true;
        }
      } else if (step === 2) {
        // Looking backwards for down
        if (snap.down) {
          return true;
        }
      }
    }

    return false;
  }

  private wasDirectionHeld(dir: 'down' | 'back' | 'forward' | 'up', window: number = 6): boolean {
    const limit = Math.min(window, this.history.length);
    for (let i = 0; i < limit; i++) {
      if (this.history[i][dir]) return true;
    }
    return false;
  }

  /**
   * Consumes the buffer after an attack is triggered to avoid double execution.
   */
  public consumeInputs(): void {
    const checkLen = Math.min(5, this.history.length);
    for (let i = 0; i < checkLen; i++) {
      this.history[i].justLp = false;
      this.history[i].justHp = false;
      this.history[i].justLk = false;
      this.history[i].justHk = false;
    }
  }

  /**
   * Clears entire buffer (e.g. on round restart).
   */
  public clear(): void {
    this.history = [];
    this.previousRaw = {
      up: false,
      down: false,
      left: false,
      right: false,
      lp: false,
      hp: false,
      lk: false,
      hk: false,
      block: false,
    };
  }
}
