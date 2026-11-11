/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Frame Data Architecture.
 * Standardized attack data defining Startup, Active, and Recovery frames,
 * hitstun, blockstun, damage, hitboxes, and launch physics.
 */

import { AttackData, AttackType } from './CombatTypes';

export const MOVES: Record<string, AttackData> = {
  HIGH_PUNCH: {
    id: 'HIGH_PUNCH',
    name: 'High Punch',
    startupFrames: 5,
    activeFrames: 3,
    recoveryFrames: 8,
    totalFrames: 16,
    damage: 12,
    chipDamage: 2,
    hitstunFrames: 14,
    blockstunFrames: 9,
    attackType: AttackType.HIGH,
    // Box relative to feet: x=0 (center), y=0 (ground).
    // Fighter stands approx height 150. High punch is chest/head level.
    hitbox: { x: 20, y: -130, width: 62, height: 26 },
    pushbackOnHit: 3.5,
    pushbackOnBlock: 2.5,
    causesKnockdown: false,
    cancelsIntoSpecial: true,
  },

  LOW_PUNCH: {
    id: 'LOW_PUNCH',
    name: 'Low Punch',
    startupFrames: 6,
    activeFrames: 3,
    recoveryFrames: 7,
    totalFrames: 16,
    damage: 10,
    chipDamage: 2,
    hitstunFrames: 13,
    blockstunFrames: 8,
    attackType: AttackType.MID,
    // Torso level poke
    hitbox: { x: 20, y: -95, width: 55, height: 24 },
    pushbackOnHit: 3.0,
    pushbackOnBlock: 2.0,
    causesKnockdown: false,
    cancelsIntoSpecial: true,
  },

  LOW_KICK: {
    id: 'LOW_KICK',
    name: 'Low Kick',
    startupFrames: 7,
    activeFrames: 4,
    recoveryFrames: 11,
    totalFrames: 22,
    damage: 12,
    chipDamage: 3,
    hitstunFrames: 15,
    blockstunFrames: 10,
    attackType: AttackType.LOW, // Must be crouch-blocked!
    // Shin / ankle level
    hitbox: { x: 25, y: -40, width: 65, height: 26 },
    pushbackOnHit: 4.0,
    pushbackOnBlock: 3.0,
    causesKnockdown: false,
    cancelsIntoSpecial: false,
  },

  HIGH_KICK: {
    id: 'HIGH_KICK',
    name: 'High Kick',
    startupFrames: 9,
    activeFrames: 4,
    recoveryFrames: 14,
    totalFrames: 27,
    damage: 18,
    chipDamage: 4,
    hitstunFrames: 18,
    blockstunFrames: 12,
    attackType: AttackType.HIGH,
    // Head level roundhouse
    hitbox: { x: 25, y: -140, width: 68, height: 32 },
    pushbackOnHit: 6.0,
    pushbackOnBlock: 4.5,
    causesKnockdown: false,
    cancelsIntoSpecial: false,
  },

  UPPERCUT: {
    id: 'UPPERCUT',
    name: 'MK Uppercut',
    startupFrames: 10,
    activeFrames: 5,
    recoveryFrames: 24,
    totalFrames: 39,
    damage: 26,
    chipDamage: 5,
    hitstunFrames: 35,
    blockstunFrames: 16, // Heavy unsafe recovery on block (-8 frame advantage for opponent)
    attackType: AttackType.MID,
    // Massive upward arc hitbox
    hitbox: { x: 15, y: -160, width: 68, height: 85 },
    pushbackOnHit: 7.0,
    pushbackOnBlock: 5.0,
    causesKnockdown: true,
    launchVelocityY: -16.5, // Violent launch into air
    launchVelocityX: 7.0,
    cancelsIntoSpecial: false,
  },

  SWEEP: {
    id: 'SWEEP',
    name: 'Leg Sweep',
    startupFrames: 8,
    activeFrames: 5,
    recoveryFrames: 18,
    totalFrames: 31,
    damage: 14,
    chipDamage: 3,
    hitstunFrames: 30,
    blockstunFrames: 14,
    attackType: AttackType.LOW, // Trips unblocking or standing blockers!
    hitbox: { x: 20, y: -25, width: 85, height: 25 },
    pushbackOnHit: 5.0,
    pushbackOnBlock: 4.0,
    causesKnockdown: true,
    launchVelocityY: -8.0,
    launchVelocityX: 5.0,
    cancelsIntoSpecial: false,
  },

  ICE_PROJECTILE: {
    id: 'ICE_PROJECTILE',
    name: 'Ice Blast',
    startupFrames: 12,
    activeFrames: 3,
    recoveryFrames: 22,
    totalFrames: 37,
    damage: 16,
    chipDamage: 4,
    hitstunFrames: 28,
    blockstunFrames: 12,
    attackType: AttackType.HIGH,
    hitbox: { x: 40, y: -105, width: 40, height: 30 },
    pushbackOnHit: 4.0,
    pushbackOnBlock: 3.0,
    causesKnockdown: false,
    spawnsProjectile: true,
    cancelsIntoSpecial: false,
  },

  JUMP_PUNCH: {
    id: 'JUMP_PUNCH',
    name: 'Jump Punch',
    startupFrames: 6,
    activeFrames: 8,
    recoveryFrames: 8,
    totalFrames: 22,
    damage: 14,
    chipDamage: 3,
    hitstunFrames: 18,
    blockstunFrames: 12,
    attackType: AttackType.HIGH,
    hitbox: { x: 20, y: -90, width: 50, height: 35 },
    pushbackOnHit: 4.0,
    pushbackOnBlock: 3.0,
    causesKnockdown: false,
  },

  JUMP_KICK: {
    id: 'JUMP_KICK',
    name: 'Jump Kick',
    startupFrames: 7,
    activeFrames: 10,
    recoveryFrames: 10,
    totalFrames: 27,
    damage: 16,
    chipDamage: 3,
    hitstunFrames: 22,
    blockstunFrames: 13,
    attackType: AttackType.MID,
    hitbox: { x: 25, y: -70, width: 65, height: 40 },
    pushbackOnHit: 6.0,
    pushbackOnBlock: 4.0,
    causesKnockdown: true,
    launchVelocityY: -9.0,
    launchVelocityX: 6.0,
  },
};
