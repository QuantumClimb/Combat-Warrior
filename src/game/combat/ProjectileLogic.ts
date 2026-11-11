/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Pure Projectile Logic Entity.
 * Simulates traveling special moves (e.g. Ice Blast, Fireball) independent of Phaser.
 */

import { AttackData, AttackType, Rect } from './CombatTypes';

export class ProjectileLogic {
  public id: string;
  public ownerId: number; // 1 or 2
  public x: number;
  public y: number;
  public vx: number;
  public facing: number;
  public active: boolean = true;
  public currentFrame: number = 0;
  public maxLifetimeFrames: number = 75; // Disappears after 1.25s or wall contact
  public attackData: AttackData;

  constructor(ownerId: number, x: number, y: number, facing: number) {
    this.id = `proj_${Date.now()}_${Math.random()}`;
    this.ownerId = ownerId;
    this.x = x;
    this.y = y;
    this.facing = facing;
    this.vx = facing * 7.5; // Travels 7.5 px/frame = 450 px/s

    this.attackData = {
      id: 'ICE_PROJECTILE_HIT',
      name: 'Ice Blast Hit',
      startupFrames: 0,
      activeFrames: 999,
      recoveryFrames: 0,
      totalFrames: 999,
      damage: 15,
      chipDamage: 4,
      hitstunFrames: 30, // Long freeze stun!
      blockstunFrames: 14,
      attackType: AttackType.HIGH,
      hitbox: { x: -20, y: -20, width: 40, height: 40 },
      pushbackOnHit: 3.0,
      pushbackOnBlock: 4.0,
      causesKnockdown: false,
    };
  }

  public tick(): void {
    if (!this.active) return;
    this.currentFrame++;
    this.x += this.vx;

    if (this.currentFrame >= this.maxLifetimeFrames) {
      this.active = false;
    }
  }

  public getWorldHitbox(): Rect {
    return {
      x: this.x - 20,
      y: this.y - 20,
      width: 40,
      height: 40,
    };
  }
}
