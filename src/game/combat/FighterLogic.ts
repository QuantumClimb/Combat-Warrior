/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Pure Fighter Logic Entity.
 * Contains State Machine, Input Buffer, Kinematics, Stun timers, and Frame Advantage tracking.
 * Zero dependency on Phaser or DOM APIs — 1:1 portable to Godot (CharacterBody2D + Scripts).
 */

import { AttackData, BlockState, CombatEvent, FighterState, RawInput, Rect } from './CombatTypes';
import { FighterFSM } from './FighterFSM';
import { MOVES } from './FrameData';
import { HitboxManager, WorldHurtboxes } from './HitboxManager';
import { InputBuffer } from './InputBuffer';

export class FighterLogic {
  public id: number; // 1 or 2
  public name: string;
  public color: string;

  // Transform & Kinematics
  public x: number = 0;
  public y: number = 0;
  public groundY: number = 460;
  public vx: number = 0;
  public vy: number = 0;
  public facing: number = 1; // 1: facing right, -1: facing left

  // Combat Stats
  public health: number = 100;
  public maxHealth: number = 100;
  public comboHits: number = 0;

  // Components
  public fsm: FighterFSM;
  public inputBuffer: InputBuffer;

  // Knockdown & Physics variables
  public isAirborne: boolean = false;
  public knockdownWakeupTimer: number = 0;
  public isInvulnerable: boolean = false;

  // Frame Advantage Tracker (for training display)
  public lastAdvantage: { value: number; type: 'HIT' | 'BLOCK'; moveName: string } | null = null;

  // Constants
  public readonly WALK_FWD_SPEED = 3.6;
  public readonly WALK_BACK_SPEED = 2.6;
  public readonly JUMP_VELOCITY = -14.2;
  public readonly GRAVITY = 0.72;

  constructor(id: number, name: string, startX: number, groundY: number = 460, facing: number = 1, color: string = '#00e5ff') {
    this.id = id;
    this.name = name;
    this.x = startX;
    this.groundY = groundY;
    this.y = groundY;
    this.facing = facing;
    this.color = color;

    this.fsm = new FighterFSM(FighterState.IDLE);
    this.inputBuffer = new InputBuffer(30);
  }

  /**
   * Main fixed tick logic (invoked 60 times per second).
   */
  public tick(rawInput: RawInput, opponent: FighterLogic, currentFrame: number): CombatEvent[] {
    const events: CombatEvent[] = [];

    // 1. Record input in buffer
    const input = this.inputBuffer.push(rawInput, this.facing, currentFrame);

    // 2. Advance FSM
    const prevState = this.fsm.currentState;
    this.fsm.tick();

    if (prevState !== this.fsm.currentState) {
      events.push({
        type: 'STATE_CHANGED',
        fighterId: this.id,
        frame: currentFrame,
        meta: { from: prevState, to: this.fsm.currentState },
      });
    }

    // 3. Process State-Specific Behavior
    switch (this.fsm.currentState) {
      case FighterState.IDLE:
      case FighterState.WALK_FORWARD:
      case FighterState.WALK_BACK:
      case FighterState.CROUCH:
        this.handleActionableState(input, opponent, currentFrame, events);
        break;

      case FighterState.ATTACK:
        this.handleAttackState(currentFrame, events);
        break;

      case FighterState.JUMP:
        this.handleJumpState();
        break;

      case FighterState.HITSTUN:
        this.handleStunState();
        break;

      case FighterState.BLOCKSTUN:
        this.handleStunState();
        break;

      case FighterState.KNOCKDOWN:
        this.handleKnockdownState(currentFrame, events);
        break;
    }

    // 4. Update Position & Apply Ground Collision
    this.x += this.vx;
    this.y += this.vy;

    // Apply friction to horizontal velocity when grounded
    if (!this.isAirborne && this.fsm.currentState !== FighterState.WALK_FORWARD && this.fsm.currentState !== FighterState.WALK_BACK) {
      this.vx *= 0.8;
      if (Math.abs(this.vx) < 0.1) this.vx = 0;
    }

    // Ground landing check
    if (this.y >= this.groundY) {
      this.y = this.groundY;
      if (this.isAirborne && this.fsm.currentState === FighterState.JUMP) {
        this.isAirborne = false;
        this.vy = 0;
        this.vx = 0;
        this.fsm.transitionTo(FighterState.IDLE);
      }
    }

    // Auto-face opponent if grounded and actionable
    if (this.fsm.isActionable() && !this.isAirborne) {
      const dirToOpponent = opponent.x > this.x ? 1 : -1;
      this.facing = dirToOpponent;
    }

    return events;
  }

  /**
   * Actionable logic (Neutral, Walking, Ducking, Blocking, initiating attacks)
   */
  private handleActionableState(
    input: any,
    opponent: FighterLogic,
    currentFrame: number,
    events: CombatEvent[]
  ): void {
    // Check dedicated Block button
    // In MK: Holding Block while standing = High Block; while down = Low Block
    const isBlocking = input.block;

    // Check for attacks / specials first
    const command = this.inputBuffer.evaluateCommand(true);

    if (command && MOVES[command]) {
      const move = MOVES[command];
      this.fsm.transitionTo(FighterState.ATTACK, move);
      this.inputBuffer.consumeInputs();
      this.vx = 0; // Grounded attacks halt horizontal movement

      if (move.spawnsProjectile) {
        events.push({
          type: 'PROJECTILE_SPAWNED',
          fighterId: this.id,
          x: this.x + this.facing * 35,
          y: this.y - 105,
          frame: currentFrame,
          attack: move,
        });
      }
      return;
    }

    // If blocking, fighter cannot walk or crouch-walk
    if (isBlocking) {
      if (input.down) {
        this.fsm.transitionTo(FighterState.CROUCH);
      } else {
        this.fsm.transitionTo(FighterState.IDLE);
      }
      this.vx = 0;
      return;
    }

    // Jump
    if (input.up) {
      this.fsm.transitionTo(FighterState.JUMP);
      this.isAirborne = true;
      this.vy = this.JUMP_VELOCITY;
      if (input.forward) {
        this.vx = this.facing * 3.4;
      } else if (input.back) {
        this.vx = -this.facing * 3.0;
      } else {
        this.vx = 0;
      }
      return;
    }

    // Crouch
    if (input.down) {
      this.fsm.transitionTo(FighterState.CROUCH);
      this.vx = 0;
      return;
    }

    // Walk forward / back
    if (input.forward) {
      this.fsm.transitionTo(FighterState.WALK_FORWARD);
      this.vx = this.facing * this.WALK_FWD_SPEED;
    } else if (input.back) {
      this.fsm.transitionTo(FighterState.WALK_BACK);
      this.vx = -this.facing * this.WALK_BACK_SPEED;
    } else {
      this.fsm.transitionTo(FighterState.IDLE);
      this.vx = 0;
    }
  }

  /**
   * Attack state execution
   */
  private handleAttackState(currentFrame: number, events: CombatEvent[]): void {
    // Air attack physics
    if (this.isAirborne) {
      this.vy += this.GRAVITY;
      if (this.y >= this.groundY) {
        this.y = this.groundY;
        this.isAirborne = false;
        this.vy = 0;
        this.vx = 0;
        this.fsm.transitionTo(FighterState.IDLE);
      }
    }
  }

  /**
   * Jump state physics & air attacks
   */
  private handleJumpState(): void {
    this.vy += this.GRAVITY;

    // Check air attacks
    const command = this.inputBuffer.evaluateCommand(false);
    if (command === 'HIGH_PUNCH' || command === 'LOW_PUNCH') {
      this.fsm.transitionTo(FighterState.ATTACK, MOVES.JUMP_PUNCH);
      this.inputBuffer.consumeInputs();
    } else if (command === 'HIGH_KICK' || command === 'LOW_KICK') {
      this.fsm.transitionTo(FighterState.ATTACK, MOVES.JUMP_KICK);
      this.inputBuffer.consumeInputs();
    }
  }

  /**
   * Hitstun & Blockstun physics
   */
  private handleStunState(): void {
    // Apply slide decay
    this.vx *= 0.88;
    if (Math.abs(this.vx) < 0.1) this.vx = 0;
  }

  /**
   * Knockdown arc physics (e.g. from Uppercut launch or Sweep trip)
   */
  private handleKnockdownState(currentFrame: number, events: CombatEvent[]): void {
    if (this.isAirborne) {
      this.vy += this.GRAVITY;
      this.vx *= 0.98;

      if (this.y >= this.groundY) {
        // Slam into the ground
        this.y = this.groundY;
        this.isAirborne = false;
        this.vy = 0;
        this.vx = 0;
        this.knockdownWakeupTimer = 22; // Frames lying on ground before getting up

        events.push({
          type: 'KNOCKDOWN_LAND',
          fighterId: this.id,
          x: this.x,
          y: this.groundY,
          frame: currentFrame,
        });
      }
    } else {
      // Lying down recovery
      this.knockdownWakeupTimer--;
      if (this.knockdownWakeupTimer <= 0) {
        this.isInvulnerable = false;
        this.fsm.transitionTo(FighterState.IDLE);
      }
    }
  }

  /**
   * Handles taking a hit or block from an attack.
   */
  public receiveHit(
    attack: AttackData,
    isBlocked: boolean,
    attacker: FighterLogic,
    currentFrame: number,
    launchVy?: number,
    launchVx?: number
  ): void {
    this.comboHits = isBlocked ? 0 : this.comboHits + 1;

    // Apply damage
    const dmg = isBlocked ? attack.chipDamage : attack.damage;
    this.health = Math.max(0, this.health - dmg);

    // Pushback direction away from attacker
    const pushDir = this.x > attacker.x ? 1 : -1;
    const pushVal = isBlocked ? attack.pushbackOnBlock : attack.pushbackOnHit;
    this.vx = pushDir * pushVal;

    // Frame Advantage tracking:
    // Attacker remaining recovery frames vs Defender stun duration
    const attackerRemaining = attacker.fsm.currentAttack 
      ? (attacker.fsm.currentAttack.totalFrames - attacker.fsm.stateFrame) 
      : 0;
    const defenderStun = isBlocked ? attack.blockstunFrames : attack.hitstunFrames;
    const advantage = defenderStun - attackerRemaining;

    attacker.lastAdvantage = {
      value: advantage,
      type: isBlocked ? 'BLOCK' : 'HIT',
      moveName: attack.name,
    };

    if (isBlocked) {
      this.fsm.transitionTo(FighterState.BLOCKSTUN, undefined, attack.blockstunFrames);
      return;
    }

    // Knockdown launch
    if (attack.causesKnockdown || launchVy !== undefined) {
      this.fsm.transitionTo(FighterState.KNOCKDOWN);
      this.isAirborne = true;
      this.vy = launchVy !== undefined ? launchVy : -12;
      this.vx = pushDir * (launchVx !== undefined ? launchVx : 6);
      this.isInvulnerable = false;
    } else {
      this.fsm.transitionTo(FighterState.HITSTUN, undefined, attack.hitstunFrames);
    }
  }

  /**
   * Determines active BlockState based on inputs and state.
   */
  public getBlockState(): BlockState {
    const snap = this.inputBuffer.getLatest();
    if (!snap || !snap.block) {
      return BlockState.NONE;
    }

    // In MK, holding Block while crouched = Low Block, standing = High Block
    if (this.fsm.currentState === FighterState.CROUCH || snap.down) {
      return BlockState.LOW_BLOCK;
    }

    return BlockState.HIGH_BLOCK;
  }

  /**
   * Retrieves world-space hurtboxes.
   */
  public getWorldHurtboxes(): WorldHurtboxes {
    return HitboxManager.getWorldHurtboxes(this.fsm.currentState, this.x, this.y, this.facing);
  }

  /**
   * Retrieves world-space attack hitbox if in active frames.
   */
  public getActiveWorldHitbox(): Rect | null {
    if (!this.fsm.isHitboxActive() || !this.fsm.currentAttack) {
      return null;
    }

    return HitboxManager.toWorldRect(
      this.fsm.currentAttack.hitbox,
      this.x,
      this.y,
      this.facing
    );
  }

  public getPushbox(): Rect {
    return HitboxManager.getPushbox(this.x, this.y, this.fsm.currentState);
  }

  public reset(startX: number, facing: number): void {
    this.x = startX;
    this.y = this.groundY;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.health = this.maxHealth;
    this.comboHits = 0;
    this.isAirborne = false;
    this.isInvulnerable = false;
    this.fsm.transitionTo(FighterState.IDLE);
    this.inputBuffer.clear();
    this.lastAdvantage = null;
  }
}
