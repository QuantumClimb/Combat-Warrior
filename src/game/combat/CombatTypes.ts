/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Pure combat logic type definitions.
 * Designed to be 100% decoupled from Phaser and easily portable to Godot (GDScript / C#).
 */

export enum FighterState {
  IDLE = 'IDLE',
  WALK_FORWARD = 'WALK_FORWARD',
  WALK_BACK = 'WALK_BACK',
  CROUCH = 'CROUCH',
  JUMP = 'JUMP',
  ATTACK = 'ATTACK',
  HITSTUN = 'HITSTUN',
  BLOCKSTUN = 'BLOCKSTUN',
  KNOCKDOWN = 'KNOCKDOWN',
}

export enum AttackType {
  HIGH = 'HIGH', // Hits standing opponents. Whiffs on neutral crouch without block! Blocked standing.
  MID = 'MID',   // Hits standing and crouching. Blocked standing or crouching.
  LOW = 'LOW',   // Hits standing and crouching. Pierces high block; must be crouched-blocked!
}

export enum BlockState {
  NONE = 'NONE',
  HIGH_BLOCK = 'HIGH_BLOCK',
  LOW_BLOCK = 'LOW_BLOCK',
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HurtboxSet {
  head: Rect;
  torso: Rect;
  legs: Rect;
}

export interface AttackData {
  id: string;
  name: string;
  startupFrames: number;
  activeFrames: number;
  recoveryFrames: number;
  totalFrames: number;
  damage: number;
  chipDamage: number;
  hitstunFrames: number;
  blockstunFrames: number;
  attackType: AttackType;
  // Local offset relative to fighter origin (feet x=0, y=0)
  hitbox: Rect;
  pushbackOnHit: number;
  pushbackOnBlock: number;
  causesKnockdown: boolean;
  launchVelocityY?: number;
  launchVelocityX?: number;
  cancelsIntoSpecial?: boolean;
  spawnsProjectile?: boolean;
}

export interface RawInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  lp: boolean;    // Low Punch
  hp: boolean;    // High Punch
  lk: boolean;    // Low Kick
  hk: boolean;    // High Kick
  block: boolean; // Dedicated Block button
}

export interface InputSnapshot {
  frame: number;
  up: boolean;
  down: boolean;
  forward: boolean;
  back: boolean;
  lp: boolean;
  hp: boolean;
  lk: boolean;
  hk: boolean;
  block: boolean;
  // Just pressed edge triggers this tick
  justLp: boolean;
  justHp: boolean;
  justLk: boolean;
  justHk: boolean;
  justBlock: boolean;
  justUp: boolean;
  justDown: boolean;
  justForward: boolean;
  justBack: boolean;
}

export type CombatEventType =
  | 'HIT_CONNECTED'
  | 'ATTACK_BLOCKED'
  | 'ATTACK_WHIFFED'
  | 'KNOCKDOWN_HIT'
  | 'KNOCKDOWN_LAND'
  | 'PROJECTILE_SPAWNED'
  | 'STATE_CHANGED'
  | 'SPECIAL_EXECUTED';

export interface CombatEvent {
  type: CombatEventType;
  fighterId: number; // 1 or 2
  targetId?: number;
  attack?: AttackData;
  damage?: number;
  isChip?: boolean;
  isHighWhiff?: boolean;
  x?: number;
  y?: number;
  frame: number;
  meta?: any;
}
