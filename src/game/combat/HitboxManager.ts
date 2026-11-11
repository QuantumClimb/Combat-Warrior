/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Decoupled Hitbox & Hurtbox Collision System.
 * Manages AABB bounds for:
 * - Hurtboxes: Head, Torso, Legs (green)
 * - Hitboxes: Attack volumes during Active Frames (red)
 * - Pushboxes: Fighter collision volumes preventing walk-through (yellow/blue)
 * 
 * Pure math & logic with zero game-engine dependencies.
 */

import { AttackData, AttackType, BlockState, FighterState, HurtboxSet, Rect } from './CombatTypes';

export interface WorldHurtboxes {
  head: Rect;
  torso: Rect;
  legs: Rect;
}

export interface HitResult {
  hit: boolean;
  blocked: boolean;
  isChip: boolean;
  whiffHighDuck: boolean; // Classic MK: High attacks whiff over ducking opponent
  damage: number;
  hitstun: number;
  blockstun: number;
  pushback: number;
  causesKnockdown: boolean;
  launchVy?: number;
  launchVx?: number;
  contactPoint?: { x: number; y: number };
}

export class HitboxManager {
  /**
   * Computes dynamic local hurtboxes based on state (standing vs crouching vs jumping).
   * Fighter origin: feet at (0, 0), head upward (negative Y).
   */
  public static getLocalHurtboxes(state: FighterState): HurtboxSet {
    if (state === FighterState.CROUCH) {
      // Crouched hurtbox is squatted down
      return {
        head: { x: -20, y: -90, width: 40, height: 26 },
        torso: { x: -24, y: -64, width: 48, height: 34 },
        legs: { x: -26, y: -30, width: 52, height: 30 },
      };
    } else if (state === FighterState.KNOCKDOWN) {
      // Fallen / in air knockdown
      return {
        head: { x: -22, y: -60, width: 44, height: 25 },
        torso: { x: -25, y: -45, width: 50, height: 30 },
        legs: { x: -25, y: -20, width: 50, height: 22 },
      };
    } else if (state === FighterState.JUMP) {
      // Airborne tucked posture
      return {
        head: { x: -18, y: -130, width: 36, height: 28 },
        torso: { x: -22, y: -102, width: 44, height: 42 },
        legs: { x: -20, y: -60, width: 40, height: 35 },
      };
    }

    // Default Standing / Walking / Idle / Attack / Hitstun / Blockstun
    return {
      head: { x: -18, y: -145, width: 36, height: 30 },
      torso: { x: -22, y: -115, width: 44, height: 50 },
      legs: { x: -24, y: -65, width: 48, height: 65 },
    };
  }

  /**
   * Transforms local rect to world coordinates based on position and facing direction.
   */
  public static toWorldRect(local: Rect, worldX: number, worldY: number, facing: number): Rect {
    // If facing left (-1), horizontal box flips relative to fighter origin
    const x = facing === 1 
      ? worldX + local.x 
      : worldX - local.x - local.width;

    return {
      x,
      y: worldY + local.y,
      width: local.width,
      height: local.height,
    };
  }

  /**
   * Retrieves world-space hurtboxes for a fighter.
   */
  public static getWorldHurtboxes(
    state: FighterState,
    worldX: number,
    worldY: number,
    facing: number
  ): WorldHurtboxes {
    const local = this.getLocalHurtboxes(state);
    return {
      head: this.toWorldRect(local.head, worldX, worldY, facing),
      torso: this.toWorldRect(local.torso, worldX, worldY, facing),
      legs: this.toWorldRect(local.legs, worldX, worldY, facing),
    };
  }

  /**
   * Retrieves world-space pushbox.
   */
  public static getPushbox(worldX: number, worldY: number, state: FighterState): Rect {
    const height = state === FighterState.CROUCH ? 85 : 140;
    const width = 44;
    return {
      x: worldX - width / 2,
      y: worldY - height,
      width,
      height,
    };
  }

  /**
   * Tests AABB intersection between two rectangles.
   */
  public static aabbIntersects(a: Rect, b: Rect): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  /**
   * Resolves attack hit against a defender, applying Classic MK rules:
   * - High attacks whiff against neutral crouch without block!
   * - High attacks blocked by High Block.
   * - Mid attacks blocked by High Block or Low Block.
   * - Low attacks pierce High Block; can only be blocked by Low Block!
   */
  public static evaluateHit(
    attackerHitbox: Rect,
    attack: AttackData,
    defenderState: FighterState,
    defenderBlockState: BlockState,
    defenderHurtboxes: WorldHurtboxes
  ): HitResult {
    // Check if hitbox clashes with any hurtbox
    const hitHead = this.aabbIntersects(attackerHitbox, defenderHurtboxes.head);
    const hitTorso = this.aabbIntersects(attackerHitbox, defenderHurtboxes.torso);
    const hitLegs = this.aabbIntersects(attackerHitbox, defenderHurtboxes.legs);

    if (!hitHead && !hitTorso && !hitLegs) {
      return {
        hit: false,
        blocked: false,
        isChip: false,
        whiffHighDuck: false,
        damage: 0,
        hitstun: 0,
        blockstun: 0,
        pushback: 0,
        causesKnockdown: false,
      };
    }

    // Classic MK Rule 1: High attacks WHIFF against a crouched opponent who is NOT blocking!
    // (In MK1-UMK3, ducking under high punches/fireballs without blocking lets them sail harmlessly over)
    if (attack.attackType === AttackType.HIGH && defenderState === FighterState.CROUCH && defenderBlockState === BlockState.NONE) {
      return {
        hit: false,
        blocked: false,
        isChip: false,
        whiffHighDuck: true,
        damage: 0,
        hitstun: 0,
        blockstun: 0,
        pushback: 0,
        causesKnockdown: false,
      };
    }

    // Defender Blocking Logic
    let isBlocked = false;

    if (defenderBlockState === BlockState.HIGH_BLOCK) {
      if (attack.attackType === AttackType.HIGH || attack.attackType === AttackType.MID) {
        isBlocked = true;
      }
      // Low attacks pierce High Block! isBlocked remains false
    } else if (defenderBlockState === BlockState.LOW_BLOCK) {
      if (attack.attackType === AttackType.LOW || attack.attackType === AttackType.MID) {
        isBlocked = true;
      }
      // In MK, standard high attacks are also absorbed or whiffed by low block
      if (attack.attackType === AttackType.HIGH) {
        isBlocked = true;
      }
    }

    const contactX = (attackerHitbox.x + attackerHitbox.width / 2);
    const contactY = (attackerHitbox.y + attackerHitbox.height / 2);

    if (isBlocked) {
      return {
        hit: true,
        blocked: true,
        isChip: true,
        whiffHighDuck: false,
        damage: attack.chipDamage,
        hitstun: 0,
        blockstun: attack.blockstunFrames,
        pushback: attack.pushbackOnBlock,
        causesKnockdown: false,
        contactPoint: { x: contactX, y: contactY },
      };
    }

    // Unblocked Clean Hit
    return {
      hit: true,
      blocked: false,
      isChip: false,
      whiffHighDuck: false,
      damage: attack.damage,
      hitstun: attack.hitstunFrames,
      blockstun: 0,
      pushback: attack.pushbackOnHit,
      causesKnockdown: attack.causesKnockdown,
      launchVy: attack.launchVelocityY,
      launchVx: attack.launchVelocityX,
      contactPoint: { x: contactX, y: contactY },
    };
  }
}
