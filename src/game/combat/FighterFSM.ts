/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Pure Finite State Machine (FSM) for Fighters.
 * Manages states: IDLE, WALK_FORWARD, WALK_BACK, CROUCH, JUMP, ATTACK, HITSTUN, BLOCKSTUN, KNOCKDOWN.
 * Fully decoupled from Phaser scene/physics so it can be ported directly to Godot.
 */

import { AttackData, FighterState } from './CombatTypes';

export type AttackPhase = 'STARTUP' | 'ACTIVE' | 'RECOVERY' | 'NONE';

export class FighterFSM {
  public currentState: FighterState = FighterState.IDLE;
  public previousState: FighterState = FighterState.IDLE;
  public stateFrame: number = 0; // Frames spent in current state
  public currentAttack: AttackData | null = null;
  public attackHitConnected: boolean = false; // Prevents multi-hitting on same move unless intended

  public stunDuration: number = 0; // Hitstun or Blockstun duration
  public knockdownDuration: number = 0; // Ground recovery frames

  constructor(initialState: FighterState = FighterState.IDLE) {
    this.currentState = initialState;
    this.previousState = initialState;
    this.stateFrame = 0;
  }

  /**
   * Advances the FSM by 1 fixed tick (1/60s).
   */
  public tick(): void {
    this.stateFrame++;

    // Automatic state progression based on frame counts
    if (this.currentState === FighterState.ATTACK) {
      if (this.currentAttack && this.stateFrame >= this.currentAttack.totalFrames) {
        this.transitionTo(FighterState.IDLE);
        this.currentAttack = null;
        this.attackHitConnected = false;
      }
    } else if (this.currentState === FighterState.HITSTUN) {
      if (this.stateFrame >= this.stunDuration) {
        this.transitionTo(FighterState.IDLE);
      }
    } else if (this.currentState === FighterState.BLOCKSTUN) {
      if (this.stateFrame >= this.stunDuration) {
        this.transitionTo(FighterState.IDLE);
      }
    }
  }

  /**
   * Transitions to a new state if valid.
   */
  public transitionTo(newState: FighterState, attackData?: AttackData, stunFrames?: number): boolean {
    if (this.currentState === newState && newState !== FighterState.ATTACK) {
      return false;
    }

    this.previousState = this.currentState;
    this.currentState = newState;
    this.stateFrame = 0;

    if (newState === FighterState.ATTACK && attackData) {
      this.currentAttack = attackData;
      this.attackHitConnected = false;
    } else if (newState !== FighterState.ATTACK) {
      this.currentAttack = null;
    }

    if ((newState === FighterState.HITSTUN || newState === FighterState.BLOCKSTUN) && stunFrames !== undefined) {
      this.stunDuration = stunFrames;
    }

    return true;
  }

  /**
   * Checks if fighter is actionable (can walk, jump, crouch, or initiate an attack).
   */
  public isActionable(): boolean {
    return (
      this.currentState === FighterState.IDLE ||
      this.currentState === FighterState.WALK_FORWARD ||
      this.currentState === FighterState.WALK_BACK ||
      this.currentState === FighterState.CROUCH
    );
  }

  /**
   * Evaluates the current phase of an ongoing attack.
   */
  public getAttackPhase(): AttackPhase {
    if (this.currentState !== FighterState.ATTACK || !this.currentAttack) {
      return 'NONE';
    }

    const { startupFrames, activeFrames } = this.currentAttack;

    if (this.stateFrame < startupFrames) {
      return 'STARTUP';
    } else if (this.stateFrame < startupFrames + activeFrames) {
      return 'ACTIVE';
    } else {
      return 'RECOVERY';
    }
  }

  /**
   * Returns true if attack is currently in its active hitbox frames and hasn't already hit.
   */
  public isHitboxActive(): boolean {
    return (
      this.currentState === FighterState.ATTACK &&
      this.getAttackPhase() === 'ACTIVE' &&
      !this.attackHitConnected
    );
  }

  public isBlocking(): boolean {
    return this.currentState === FighterState.BLOCKSTUN;
  }

  public isStunned(): boolean {
    return (
      this.currentState === FighterState.HITSTUN ||
      this.currentState === FighterState.BLOCKSTUN ||
      this.currentState === FighterState.KNOCKDOWN
    );
  }
}
