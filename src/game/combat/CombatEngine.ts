/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Pure 60Hz Combat Engine.
 * Master coordinator for fighters, projectiles, pushboxes, hit/hurtbox clashes,
 * stage boundaries, and hitstop freeze frames.
 * 
 * 100% independent of Phaser/DOM — designed to be ported 1:1 to Godot.
 */

import { CombatEvent, FighterState, RawInput } from './CombatTypes';
import { FighterLogic } from './FighterLogic';
import { HitboxManager } from './HitboxManager';
import { ProjectileLogic } from './ProjectileLogic';

export interface StageBounds {
  minX: number;
  maxX: number;
  groundY: number;
}

export class CombatEngine {
  public fighter1: FighterLogic;
  public fighter2: FighterLogic;
  public projectiles: ProjectileLogic[] = [];
  public stageBounds: StageBounds;

  public simulationFrame: number = 0;
  public hitstopRemaining: number = 0; // Hitstop freeze frames (impact pause)
  public screenShakeDuration: number = 0;
  public screenShakeIntensity: number = 0;

  public eventLog: CombatEvent[] = [];

  constructor(
    stageWidth: number = 960,
    groundY: number = 460
  ) {
    this.stageBounds = {
      minX: 70,
      maxX: stageWidth - 70,
      groundY,
    };

    // Bhadran (P1) and Rudrani (P2)
    this.fighter1 = new FighterLogic(1, 'BHADRAN', 300, groundY, 1, '#00e5ff');
    this.fighter2 = new FighterLogic(2, 'RUDRANI', 660, groundY, -1, '#ffd000');
  }

  /**
   * Ticks the combat simulation forward by exactly one 60Hz frame.
   */
  public tick(p1Input: RawInput, p2Input: RawInput): CombatEvent[] {
    const frameEvents: CombatEvent[] = [];

    // Handle Hitstop (micro-freeze on hit for fighting game impact weight)
    if (this.hitstopRemaining > 0) {
      this.hitstopRemaining--;
      // During hitstop, simulation physics freeze, but we still decrement timers
      return frameEvents;
    }

    this.simulationFrame++;

    // 1. Update Fighters
    const p1Events = this.fighter1.tick(p1Input, this.fighter2, this.simulationFrame);
    const p2Events = this.fighter2.tick(p2Input, this.fighter1, this.simulationFrame);

    frameEvents.push(...p1Events, ...p2Events);

    // Handle projectile spawn events
    for (const ev of frameEvents) {
      if (ev.type === 'PROJECTILE_SPAWNED' && ev.x !== undefined && ev.y !== undefined) {
        const owner = ev.fighterId === 1 ? this.fighter1 : this.fighter2;
        const proj = new ProjectileLogic(ev.fighterId, ev.x, ev.y, owner.facing);
        this.projectiles.push(proj);
      }
    }

    // 2. Update Projectiles
    for (const proj of this.projectiles) {
      proj.tick();

      // Check wall boundary
      if (proj.x < this.stageBounds.minX - 50 || proj.x > this.stageBounds.maxX + 50) {
        proj.active = false;
      }

      // Check collision with opposing fighter
      if (proj.active) {
        const target = proj.ownerId === 1 ? this.fighter2 : this.fighter1;
        const attacker = proj.ownerId === 1 ? this.fighter1 : this.fighter2;

        const hitRes = HitboxManager.evaluateHit(
          proj.getWorldHitbox(),
          proj.attackData,
          target.fsm.currentState,
          target.getBlockState(),
          target.getWorldHurtboxes()
        );

        if (hitRes.hit) {
          proj.active = false;
          target.receiveHit(proj.attackData, hitRes.blocked, attacker, this.simulationFrame);
          this.hitstopRemaining = hitRes.blocked ? 2 : 4;

          frameEvents.push({
            type: hitRes.blocked ? 'ATTACK_BLOCKED' : 'HIT_CONNECTED',
            fighterId: proj.ownerId,
            targetId: target.id,
            attack: proj.attackData,
            damage: hitRes.damage,
            isChip: hitRes.isChip,
            x: hitRes.contactPoint?.x || proj.x,
            y: hitRes.contactPoint?.y || proj.y,
            frame: this.simulationFrame,
          });
        }
      }
    }

    // Remove dead projectiles
    this.projectiles = this.projectiles.filter((p) => p.active);

    // 3. Resolve Direct Melee Hitboxes
    this.checkMeleeClash(this.fighter1, this.fighter2, frameEvents);
    this.checkMeleeClash(this.fighter2, this.fighter1, frameEvents);

    // 4. Resolve Pushbox Overlaps (Prevent walking through each other)
    this.resolvePushboxes();

    // 5. Constrain Fighters to Stage Bounds (Walls)
    this.constrainToBounds(this.fighter1);
    this.constrainToBounds(this.fighter2);

    // 6. Shake decay
    if (this.screenShakeDuration > 0) {
      this.screenShakeDuration--;
    }

    // Append to rolling log
    if (frameEvents.length > 0) {
      this.eventLog.push(...frameEvents);
      if (this.eventLog.length > 50) {
        this.eventLog.splice(0, this.eventLog.length - 50);
      }
    }

    return frameEvents;
  }

  /**
   * Checks if attacker's active melee hitbox connects with defender's hurtboxes.
   */
  private checkMeleeClash(
    attacker: FighterLogic,
    defender: FighterLogic,
    frameEvents: CombatEvent[]
  ): void {
    const hitbox = attacker.getActiveWorldHitbox();
    if (!hitbox || !attacker.fsm.currentAttack) return;

    const attack = attacker.fsm.currentAttack;
    const hitRes = HitboxManager.evaluateHit(
      hitbox,
      attack,
      defender.fsm.currentState,
      defender.getBlockState(),
      defender.getWorldHurtboxes()
    );

    if (hitRes.whiffHighDuck) {
      // Classic MK high attack whiffed harmlessly over neutral ducking opponent
      frameEvents.push({
        type: 'ATTACK_WHIFFED',
        fighterId: attacker.id,
        targetId: defender.id,
        attack,
        isHighWhiff: true,
        frame: this.simulationFrame,
      });
      return;
    }

    if (hitRes.hit) {
      // Mark attack as having connected so it doesn't hit again this swing
      attacker.fsm.attackHitConnected = true;

      // Apply hit/block to defender
      defender.receiveHit(
        attack,
        hitRes.blocked,
        attacker,
        this.simulationFrame,
        hitRes.launchVy,
        hitRes.launchVx
      );

      // Hitstop frames (impact freeze)
      this.hitstopRemaining = hitRes.blocked ? 3 : (attack.causesKnockdown ? 6 : 4);

      // Screen shake on heavy hits or uppercut
      if (attack.causesKnockdown || attack.damage >= 20) {
        this.screenShakeDuration = 10;
        this.screenShakeIntensity = 7;
      } else if (!hitRes.blocked) {
        this.screenShakeDuration = 4;
        this.screenShakeIntensity = 3;
      }

      frameEvents.push({
        type: hitRes.blocked ? 'ATTACK_BLOCKED' : (attack.causesKnockdown ? 'KNOCKDOWN_HIT' : 'HIT_CONNECTED'),
        fighterId: attacker.id,
        targetId: defender.id,
        attack,
        damage: hitRes.damage,
        isChip: hitRes.isChip,
        x: hitRes.contactPoint?.x || attacker.x + attacker.facing * 30,
        y: hitRes.contactPoint?.y || attacker.y - 100,
        frame: this.simulationFrame,
      });
    }
  }

  /**
   * Resolves pushbox overlaps so fighters push each other smoothly without jitter or pass-through.
   */
  private resolvePushboxes(): void {
    const pb1 = this.fighter1.getPushbox();
    const pb2 = this.fighter2.getPushbox();

    if (HitboxManager.aabbIntersects(pb1, pb2)) {
      const overlapX = (pb1.width / 2 + pb2.width / 2) - Math.abs(this.fighter1.x - this.fighter2.x);

      if (overlapX > 0) {
        const p1Left = this.fighter1.x < this.fighter2.x;
        const pushAmount = overlapX / 2;

        if (p1Left) {
          this.fighter1.x -= pushAmount;
          this.fighter2.x += pushAmount;
        } else {
          this.fighter1.x += pushAmount;
          this.fighter2.x -= pushAmount;
        }
      }
    }
  }

  /**
   * Clamps fighter position to stage boundaries.
   */
  private constrainToBounds(fighter: FighterLogic): void {
    if (fighter.x < this.stageBounds.minX) {
      fighter.x = this.stageBounds.minX;
      fighter.vx = 0;
    } else if (fighter.x > this.stageBounds.maxX) {
      fighter.x = this.stageBounds.maxX;
      fighter.vx = 0;
    }
  }

  public resetMatch(): void {
    this.fighter1.reset(300, 1);
    this.fighter2.reset(660, -1);
    this.projectiles = [];
    this.simulationFrame = 0;
    this.hitstopRemaining = 0;
    this.screenShakeDuration = 0;
    this.eventLog = [];
  }
}
