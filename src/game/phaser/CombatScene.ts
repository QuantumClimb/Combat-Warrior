/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Phaser 3 Combat Scene.
 * Implements:
 * 1. Accumulator-based fixed-step 60 FPS update loop.
 * 2. Visual rendering of fighters, stage, projectiles, blood/sparks.
 * 3. Debug Hitbox/Hurtbox graphics overlays (Green Hurtboxes, Red Hitboxes, Cyan Pushboxes).
 * 4. Keyboard input mapping (WASD + U/J/I/K/L/Space).
 */

import * as Phaser from 'phaser';
import { soundEffects } from '../audio/SoundEffects';
import { CombatEngine } from '../combat/CombatEngine';
import { AttackType, BlockState, CombatEvent, FighterState, RawInput } from '../combat/CombatTypes';
import { FighterLogic } from '../combat/FighterLogic';

export interface VisualParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  gravity?: number;
}

export type DummyBehavior =
  | 'LOCAL_P2'
  | 'STAND_DUMMY'
  | 'CROUCH_DUMMY'
  | 'BLOCK_HIGH_DUMMY'
  | 'BLOCK_LOW_DUMMY'
  | 'JUMP_DUMMY'
  | 'CPU_AI';

export class CombatScene extends Phaser.Scene {
  public combatEngine!: CombatEngine;

  // Fixed 60 FPS Accumulator
  public readonly FIXED_TIMESTEP: number = 1 / 60;
  public accumulator: number = 0;
  public simulationSpeed: number = 1.0;
  public isPaused: boolean = false;
  public isGameStarted: boolean = false;
  public stepOnce: boolean = false;
  public onPauseToggle?: (paused: boolean) => void;

  // Graphics layers
  private stageGraphics!: Phaser.GameObjects.Graphics;
  private fighterGraphics!: Phaser.GameObjects.Graphics;
  private projectileGraphics!: Phaser.GameObjects.Graphics;
  private debugGraphics!: Phaser.GameObjects.Graphics;
  private particleGraphics!: Phaser.GameObjects.Graphics;

  // Debug options
  public showHitboxes: boolean = true;
  public showPushboxes: boolean = true;
  public dummyMode: DummyBehavior = 'CPU_AI';

  // Input States
  public p1RawInput: RawInput = {
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

  public p2RawInput: RawInput = {
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

  // Visual particles
  private particles: VisualParticle[] = [];

  // Key tracking
  private keys: { [key: string]: Phaser.Input.Keyboard.Key } = {};

  // CPU AI State
  private cpuDecisionTimer: number = 0;
  private cpuNextAction: string = 'NEUTRAL';

  // UI Callback hook
  public onStateUpdate?: (engine: CombatEngine) => void;

  constructor() {
    super({ key: 'CombatScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    this.combatEngine = new CombatEngine(width, 450);

    // Create graphics display layers
    this.stageGraphics = this.add.graphics();
    this.fighterGraphics = this.add.graphics();
    this.projectileGraphics = this.add.graphics();
    this.particleGraphics = this.add.graphics();
    this.debugGraphics = this.add.graphics();

    // Register keyboard keys
    if (this.input.keyboard) {
      this.keys = this.input.keyboard.addKeys({
        // P1 Movement & Actions
        W: Phaser.Input.Keyboard.KeyCodes.W,
        A: Phaser.Input.Keyboard.KeyCodes.A,
        S: Phaser.Input.Keyboard.KeyCodes.S,
        D: Phaser.Input.Keyboard.KeyCodes.D,
        U: Phaser.Input.Keyboard.KeyCodes.U, // High Punch
        J: Phaser.Input.Keyboard.KeyCodes.J, // Low Punch
        I: Phaser.Input.Keyboard.KeyCodes.I, // High Kick
        K: Phaser.Input.Keyboard.KeyCodes.K, // Low Kick
        L: Phaser.Input.Keyboard.KeyCodes.L, // Dedicated Block
        SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE, // Block alternate

        // P2 Movement & Actions
        UP: Phaser.Input.Keyboard.KeyCodes.UP,
        DOWN: Phaser.Input.Keyboard.KeyCodes.DOWN,
        LEFT: Phaser.Input.Keyboard.KeyCodes.LEFT,
        RIGHT: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        NUM_7: Phaser.Input.Keyboard.KeyCodes.NUMPAD_SEVEN,
        NUM_4: Phaser.Input.Keyboard.KeyCodes.NUMPAD_FOUR,
        NUM_8: Phaser.Input.Keyboard.KeyCodes.NUMPAD_EIGHT,
        NUM_5: Phaser.Input.Keyboard.KeyCodes.NUMPAD_FIVE,
        NUM_0: Phaser.Input.Keyboard.KeyCodes.NUMPAD_ZERO,
        ENTER: Phaser.Input.Keyboard.KeyCodes.ENTER,

        // Quick Toggles & Pause
        H: Phaser.Input.Keyboard.KeyCodes.H, // Toggle Hitboxes
        ESC: Phaser.Input.Keyboard.KeyCodes.ESC,
        P: Phaser.Input.Keyboard.KeyCodes.P,
      }) as { [key: string]: Phaser.Input.Keyboard.Key };

      this.input.keyboard.on('keydown-H', () => {
        this.showHitboxes = !this.showHitboxes;
      });

      this.input.keyboard.on('keydown-ESC', () => {
        if (this.isGameStarted) {
          this.togglePause();
        }
      });

      this.input.keyboard.on('keydown-P', () => {
        if (this.isGameStarted) {
          this.togglePause();
        }
      });
    }
  }

  update(time: number, delta: number): void {
    // If game has not started yet, render animated background & idle fighters only
    if (!this.isGameStarted) {
      this.updateParticles();
      this.renderStage();
      this.renderFighters();
      this.debugGraphics.clear();
      return;
    }

    // 1. Gather Inputs (only if not paused)
    if (!this.isPaused || this.stepOnce) {
      this.pollInputs();
    } else {
      this.p1RawInput = this.getEmptyInput();
      this.p2RawInput = this.getEmptyInput();
    }

    // 2. Fixed 60 FPS Logic Accumulator
    if (!this.isPaused || this.stepOnce) {
      const dt = Math.min(delta / 1000, 0.05); // Clamp dt to prevent spiral of death
      this.accumulator += dt * this.simulationSpeed;

      while (this.accumulator >= this.FIXED_TIMESTEP) {
        // Pure 60Hz tick
        const events = this.combatEngine.tick(this.p1RawInput, this.p2RawInput);
        this.handleCombatEvents(events);

        this.accumulator -= this.FIXED_TIMESTEP;

        if (this.stepOnce) {
          this.stepOnce = false;
          this.isPaused = true;
          if (this.onPauseToggle) {
            this.onPauseToggle(true);
          }
          break;
        }
      }

      // Update Particles only when simulation is running
      this.updateParticles();
    }

    // 3. Render Everything
    this.renderStage();
    this.renderFighters();
    this.renderProjectiles();
    this.renderParticles();

    if (this.showHitboxes) {
      this.renderDebugBoxes();
    } else {
      this.debugGraphics.clear();
    }

    // 4. Notify React UI for HUD / Frame Data updates
    if (this.onStateUpdate) {
      this.onStateUpdate(this.combatEngine);
    }
  }

  /**
   * Polls keyboard inputs for P1 and evaluates dummy/CPU behavior for P2.
   */
  private pollInputs(): void {
    // P1 Keyboard polling
    this.p1RawInput = {
      up: !!this.keys.W?.isDown,
      down: !!this.keys.S?.isDown,
      left: !!this.keys.A?.isDown,
      right: !!this.keys.D?.isDown,
      hp: !!this.keys.U?.isDown,
      lp: !!this.keys.J?.isDown,
      hk: !!this.keys.I?.isDown,
      lk: !!this.keys.K?.isDown,
      block: !!this.keys.L?.isDown || !!this.keys.SPACE?.isDown,
    };

    // P2 Input behavior
    switch (this.dummyMode) {
      case 'LOCAL_P2':
        this.p2RawInput = {
          up: !!this.keys.UP?.isDown,
          down: !!this.keys.DOWN?.isDown,
          left: !!this.keys.LEFT?.isDown,
          right: !!this.keys.RIGHT?.isDown,
          hp: !!this.keys.NUM_7?.isDown,
          lp: !!this.keys.NUM_4?.isDown,
          hk: !!this.keys.NUM_8?.isDown,
          lk: !!this.keys.NUM_5?.isDown,
          block: !!this.keys.NUM_0?.isDown || !!this.keys.ENTER?.isDown,
        };
        break;

      case 'STAND_DUMMY':
        this.p2RawInput = this.getEmptyInput();
        break;

      case 'CROUCH_DUMMY':
        this.p2RawInput = { ...this.getEmptyInput(), down: true };
        break;

      case 'BLOCK_HIGH_DUMMY':
        this.p2RawInput = { ...this.getEmptyInput(), block: true };
        break;

      case 'BLOCK_LOW_DUMMY':
        this.p2RawInput = { ...this.getEmptyInput(), down: true, block: true };
        break;

      case 'JUMP_DUMMY':
        this.p2RawInput = { ...this.getEmptyInput(), up: this.combatEngine.simulationFrame % 60 === 0 };
        break;

      case 'CPU_AI':
        this.updateCpuAi();
        break;
    }
  }

  /**
   * Smart AI logic that spaces, throws projectiles, blocks incoming attacks, and uses uppercuts.
   */
  private updateCpuAi(): void {
    const p1 = this.combatEngine.fighter1;
    const p2 = this.combatEngine.fighter2;
    const dist = Math.abs(p2.x - p1.x);

    this.p2RawInput = this.getEmptyInput();
    this.cpuDecisionTimer--;

    // Defensive Reaction: If P1 is attacking, react based on attack height
    if (p1.fsm.currentState === FighterState.ATTACK && p1.fsm.currentAttack && dist < 160) {
      const atk = p1.fsm.currentAttack;
      if (atk.attackType === AttackType.LOW) {
        // Crouch block against low kicks/sweeps
        this.p2RawInput.down = true;
        this.p2RawInput.block = true;
      } else if (atk.attackType === AttackType.HIGH && Math.random() < 0.4) {
        // Duck without block to demonstrate classic MK high whiff!
        this.p2RawInput.down = true;
        this.p2RawInput.block = false;
      } else {
        // High block
        this.p2RawInput.block = true;
      }
      return;
    }

    // Reaction to projectile: Block or Jump
    if (this.combatEngine.projectiles.length > 0) {
      const proj = this.combatEngine.projectiles[0];
      if (proj.ownerId === 1 && Math.abs(p2.x - proj.x) < 220) {
        if (Math.random() < 0.3) {
          this.p2RawInput.up = true; // Jump over
          this.p2RawInput.left = p2.facing === 1 ? false : true;
        } else {
          this.p2RawInput.block = true; // Block
        }
        return;
      }
    }

    // Anti-Air: If P1 is jumping towards CPU, execute Uppercut!
    if (p1.isAirborne && dist < 120 && p2.fsm.isActionable()) {
      this.p2RawInput.down = true;
      this.p2RawInput.hp = true; // Uppercut anti-air!
      return;
    }

    // Offense / Neutral Decisions
    if (this.cpuDecisionTimer <= 0) {
      this.cpuDecisionTimer = Phaser.Math.Between(15, 35);
      const rand = Math.random();

      if (dist > 300) {
        // Far: Walk forward or throw projectile
        this.cpuNextAction = rand < 0.4 ? 'PROJECTILE' : 'ADVANCE';
      } else if (dist > 110) {
        // Mid-range: Walk forward, sweep, or low kick
        this.cpuNextAction = rand < 0.3 ? 'ADVANCE' : (rand < 0.6 ? 'SWEEP' : 'LOW_KICK');
      } else {
        // Close range: High punch poke, Uppercut, or High kick
        this.cpuNextAction = rand < 0.3 ? 'HIGH_PUNCH' : (rand < 0.6 ? 'UPPERCUT' : 'HIGH_KICK');
      }
    }

    // Execute decided action
    switch (this.cpuNextAction) {
      case 'ADVANCE':
        if (p2.facing === 1) this.p2RawInput.right = true;
        else this.p2RawInput.left = true;
        break;

      case 'PROJECTILE':
        // Motion buffer simulation: Down -> Forward -> HP
        this.p2RawInput.down = true;
        if (p2.facing === 1) this.p2RawInput.right = true;
        else this.p2RawInput.left = true;
        this.p2RawInput.hp = true;
        break;

      case 'UPPERCUT':
        this.p2RawInput.down = true;
        this.p2RawInput.hp = true;
        break;

      case 'SWEEP':
        if (p2.facing === 1) this.p2RawInput.left = true;
        else this.p2RawInput.right = true;
        this.p2RawInput.lk = true;
        break;

      case 'HIGH_PUNCH':
        this.p2RawInput.hp = true;
        break;

      case 'LOW_KICK':
        this.p2RawInput.lk = true;
        break;

      case 'HIGH_KICK':
        this.p2RawInput.hk = true;
        break;
    }
  }

  private getEmptyInput(): RawInput {
    return {
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

  /**
   * Processes combat events emitted by the 60Hz logic simulation.
   */
  private handleCombatEvents(events: CombatEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'HIT_CONNECTED':
          soundEffects.playHit(false);
          this.spawnHitSparks(ev.x || 400, ev.y || 300, 0xff0033, 14); // Classic red blood splash
          break;

        case 'KNOCKDOWN_HIT':
          soundEffects.playUppercutBoom();
          this.spawnHitSparks(ev.x || 400, ev.y || 300, 0xff1122, 28); // Massive blood explosion
          break;

        case 'ATTACK_BLOCKED':
          soundEffects.playBlock();
          this.spawnHitSparks(ev.x || 400, ev.y || 300, 0xffdd44, 10); // Yellow metallic sparks
          break;

        case 'ATTACK_WHIFFED':
          soundEffects.playWhoosh();
          break;

        case 'KNOCKDOWN_LAND':
          soundEffects.playGroundSlam();
          this.spawnDust(ev.x || 400, ev.y || 450);
          break;

        case 'PROJECTILE_SPAWNED':
          soundEffects.playProjectileLaunch();
          break;
      }
    }
  }

  /**
   * Renders the atmospheric Mortal Kombat Stone Courtyard stage.
   */
  private renderStage(): void {
    const g = this.stageGraphics;
    g.clear();

    const w = this.scale.width;
    const h = this.scale.height;
    const groundY = this.combatEngine.stageBounds.groundY;

    // Screen Shake offset
    let shakeX = 0;
    let shakeY = 0;
    if (this.combatEngine.screenShakeDuration > 0) {
      const intensity = this.combatEngine.screenShakeIntensity;
      shakeX = (Math.random() - 0.5) * intensity;
      shakeY = (Math.random() - 0.5) * intensity;
    }
    this.cameras.main.setScroll(shakeX, shakeY);

    // Deep Moody Sky
    g.fillGradientStyle(0x0a0c14, 0x0a0c14, 0x1b1328, 0x1b1328, 1);
    g.fillRect(0, 0, w, groundY);

    // Ominous Moon
    g.fillStyle(0xf5eedb, 0.85);
    g.fillCircle(w / 2, 90, 52);
    g.fillStyle(0x0a0c14, 0.2);
    g.fillCircle(w / 2 + 15, 80, 48);

    // Distant Temple Silhouettes & Peaks
    g.fillStyle(0x121422, 1);
    g.beginPath();
    g.moveTo(0, groundY - 140);
    g.lineTo(120, groundY - 210);
    g.lineTo(240, groundY - 140);
    g.lineTo(380, groundY - 240);
    g.lineTo(520, groundY - 150);
    g.lineTo(660, groundY - 230);
    g.lineTo(820, groundY - 160);
    g.lineTo(w, groundY - 220);
    g.lineTo(w, groundY);
    g.lineTo(0, groundY);
    g.closePath();
    g.fillPath();

    // Stone Pillars / Courtyard Wall
    g.fillStyle(0x1a1c28, 1);
    g.fillRect(50, 80, 45, groundY - 80);
    g.fillRect(w - 95, 80, 45, groundY - 80);

    // Pillar Caps
    g.fillStyle(0x282c3f, 1);
    g.fillRect(40, 70, 65, 14);
    g.fillRect(w - 105, 70, 65, 14);

    // Flickering Flame Braziers on Pillars
    const flameTime = this.time.now * 0.008;
    const flameFlicker = Math.sin(flameTime * 5) * 4;

    // Left Brazier Fire
    g.fillStyle(0xff4400, 0.8);
    g.fillCircle(72, 60 + flameFlicker, 16);
    g.fillStyle(0xffcc00, 0.9);
    g.fillCircle(72, 57 + flameFlicker, 9);

    // Right Brazier Fire
    g.fillStyle(0xff4400, 0.8);
    g.fillCircle(w - 73, 60 - flameFlicker, 16);
    g.fillStyle(0xffcc00, 0.9);
    g.fillCircle(w - 73, 57 - flameFlicker, 9);

    // Ground Slabs (Stone Floor)
    g.fillStyle(0x242836, 1);
    g.fillRect(0, groundY, w, h - groundY);

    // Stone Slab Line Details
    g.lineStyle(2, 0x141620, 0.8);
    g.lineBetween(0, groundY, w, groundY);
    g.lineBetween(0, groundY + 35, w, groundY + 35);
    g.lineBetween(0, groundY + 75, w, groundY + 75);

    // Vertical tile breaks
    for (let x = 30; x < w; x += 110) {
      g.lineBetween(x, groundY, x, groundY + 35);
      g.lineBetween(x + 55, groundY + 35, x + 55, groundY + 75);
      g.lineBetween(x + 20, groundY + 75, x + 20, h);
    }

    // Dragon Emblem Circle on floor in center
    g.lineStyle(3, 0x3a4055, 0.4);
    g.strokeCircle(w / 2, groundY + 45, 60);
  }

  /**
   * Renders both fighters using stylized segmented ninja sprites.
   */
  private renderFighters(): void {
    const g = this.fighterGraphics;
    g.clear();

    this.drawFighter(g, this.combatEngine.fighter1);
    this.drawFighter(g, this.combatEngine.fighter2);
  }

  /**
   * Procedural stylized character renderer based on FSM state and direction.
   */
  private drawFighter(g: Phaser.GameObjects.Graphics, fighter: FighterLogic): void {
    const { x, y, facing, color } = fighter;
    const isP1 = fighter.id === 1;
    const state = fighter.fsm.currentState;
    const frame = fighter.fsm.stateFrame;

    // Palette
    const primaryColor = isP1 ? 0x00d4ff : 0xffcc00; // Cyan (Sub-Zero) vs Yellow (Scorpion)
    const darkSuitColor = 0x14161c;
    const skinColor = 0xd8a47f;
    const accentColor = isP1 ? 0x88eeff : 0xffea77;

    // Ground shadow
    g.fillStyle(0x000000, 0.4);
    const shadowWidth = state === FighterState.CROUCH ? 54 : 44;
    g.fillEllipse(x, y + 2, shadowWidth, 12);

    // Poses calculation based on state
    let headX = x;
    let headY = y - 135;
    let torsoY = y - 105;
    let armFrontX = x + facing * 18;
    let armFrontY = y - 100;
    let armBackX = x - facing * 12;
    let armBackY = y - 98;
    let legFrontX = x + facing * 10;
    let legBackX = x - facing * 10;

    // State Pose adjustments
    if (state === FighterState.IDLE) {
      // Breathing bob
      const breath = Math.sin(this.time.now * 0.005) * 2;
      headY += breath;
      torsoY += breath;
      armFrontX = x + facing * 20;
      armFrontY = y - 95 + breath;
    } else if (state === FighterState.WALK_FORWARD || state === FighterState.WALK_BACK) {
      const walkCycle = Math.sin(this.time.now * 0.015) * 8;
      legFrontX += walkCycle * facing;
      legBackX -= walkCycle * facing;
      headY += Math.abs(walkCycle * 0.4);
    } else if (state === FighterState.CROUCH) {
      headY = y - 80;
      torsoY = y - 55;
      armFrontX = x + facing * 18;
      armFrontY = y - 60;
    } else if (state === FighterState.KNOCKDOWN) {
      // Airborne launch or lying flat on ground
      if (fighter.isAirborne) {
        headY = y - 40;
        headX = x - facing * 25;
        torsoY = y - 30;
      } else {
        // Lying on floor
        headY = y - 15;
        headX = x - facing * 35;
        torsoY = y - 15;
      }
    } else if (state === FighterState.HITSTUN) {
      // Head flinch back
      headX -= facing * 8;
      headY += 4;
      torsoY += 2;
    } else if (state === FighterState.BLOCKSTUN || fighter.getBlockState() !== BlockState.NONE) {
      // Defensive guard (arms tucked in front)
      const isCrouched = fighter.fsm.currentState === FighterState.CROUCH;
      armFrontX = x + facing * 14;
      armFrontY = isCrouched ? y - 65 : y - 110;
      armBackX = x + facing * 12;
      armBackY = isCrouched ? y - 60 : y - 105;
    } else if (state === FighterState.ATTACK && fighter.fsm.currentAttack) {
      const atk = fighter.fsm.currentAttack;

      if (atk.id === 'HIGH_PUNCH') {
        // Extended punch arm
        armFrontX = x + facing * 52;
        armFrontY = y - 118;
      } else if (atk.id === 'LOW_PUNCH') {
        armFrontX = x + facing * 46;
        armFrontY = y - 85;
      } else if (atk.id === 'LOW_KICK') {
        legFrontX = x + facing * 54;
      } else if (atk.id === 'HIGH_KICK') {
        legFrontX = x + facing * 56;
        headX -= facing * 10;
      } else if (atk.id === 'UPPERCUT') {
        // Rising fist to the sky!
        headY = y - 145;
        torsoY = y - 115;
        armFrontX = x + facing * 25;
        armFrontY = y - 165; // High uppercut fist!
      } else if (atk.id === 'SWEEP') {
        headY = y - 60;
        torsoY = y - 40;
        legFrontX = x + facing * 60;
      }
    }

    // Draw Legs
    g.lineStyle(8, darkSuitColor, 1);
    g.lineBetween(x, torsoY + 20, legBackX, y);
    g.lineBetween(x, torsoY + 20, legFrontX, y);

    // Shin guards / Ninja wraps
    g.lineStyle(5, primaryColor, 1);
    g.lineBetween(legBackX, y - 18, legBackX, y);
    g.lineBetween(legFrontX, y - 18, legFrontX, y);

    // Torso / Tunic
    const torsoHeight = state === FighterState.CROUCH ? 30 : 45;
    g.fillStyle(darkSuitColor, 1);
    g.fillRect(x - 16, torsoY - 15, 32, torsoHeight);

    // Ninja Tunic V-Stripe (Sub-Zero Cyan / Scorpion Yellow)
    g.fillStyle(primaryColor, 1);
    g.fillRect(x - 12, torsoY - 15, 8, torsoHeight);
    g.fillRect(x + 4, torsoY - 15, 8, torsoHeight);

    // Waist Sash / Belt
    g.fillStyle(accentColor, 1);
    g.fillRect(x - 15, torsoY + torsoHeight - 18, 30, 6);

    // Back Arm
    g.lineStyle(7, darkSuitColor, 1);
    g.lineBetween(x - facing * 8, torsoY - 5, armBackX, armBackY);

    // Head (Ninja Cowl + Mask)
    g.fillStyle(darkSuitColor, 1);
    g.fillCircle(headX, headY, 15);

    // Ninja Cowl Primary Wrap
    g.fillStyle(primaryColor, 1);
    g.fillRect(headX - 11, headY - 14, 22, 6); // Forehead headband
    g.fillRect(headX + (facing === 1 ? 0 : -14), headY - 2, 14, 12); // Mask lower face

    // Skin (Eye slit)
    g.fillStyle(skinColor, 1);
    g.fillRect(headX + (facing === 1 ? 2 : -10), headY - 6, 8, 4);

    // Glowing Eye
    g.fillStyle(0xffffff, 1);
    g.fillRect(headX + (facing === 1 ? 4 : -8), headY - 5, 3, 2);

    // Front Arm
    g.lineStyle(7, primaryColor, 1);
    g.lineBetween(x + facing * 8, torsoY - 5, armFrontX, armFrontY);

    // Fist / Hand
    g.fillStyle(skinColor, 1);
    g.fillCircle(armFrontX, armFrontY, 5);
  }

  /**
   * Renders active projectiles (Ice Blast or Fireball).
   */
  private renderProjectiles(): void {
    const g = this.projectileGraphics;
    g.clear();

    for (const proj of this.combatEngine.projectiles) {
      if (!proj.active) continue;

      const isSubZero = proj.ownerId === 1;
      const coreColor = isSubZero ? 0xffffff : 0xffffaa;
      const glowColor = isSubZero ? 0x00e5ff : 0xff4400;

      // Outer Glow
      g.fillStyle(glowColor, 0.4);
      g.fillCircle(proj.x, proj.y, 22);

      // Core
      g.fillStyle(glowColor, 0.85);
      g.fillCircle(proj.x, proj.y, 14);
      g.fillStyle(coreColor, 1);
      g.fillCircle(proj.x, proj.y, 7);

      // Particle Trail
      if (Math.random() < 0.8) {
        this.particles.push({
          x: proj.x - proj.vx * 0.5 + (Math.random() - 0.5) * 8,
          y: proj.y + (Math.random() - 0.5) * 8,
          vx: -proj.vx * 0.2 + (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          color: glowColor,
          size: Phaser.Math.Between(3, 6),
          alpha: 0.8,
          life: 0,
          maxLife: 15,
        });
      }
    }
  }

  /**
   * Renders the decoupled Hitbox & Hurtbox debug overlay:
   * - Green = Hurtboxes (Head, Torso, Legs)
   * - Red = Hitboxes (Active attack volumes)
   * - Cyan = Pushbox
   */
  private renderDebugBoxes(): void {
    const g = this.debugGraphics;
    g.clear();

    const drawBox = (rect: { x: number; y: number; width: number; height: number }, fill: number, stroke: number, fillAlpha: number = 0.25) => {
      g.fillStyle(fill, fillAlpha);
      g.fillRect(rect.x, rect.y, rect.width, rect.height);
      g.lineStyle(2, stroke, 0.9);
      g.strokeRect(rect.x, rect.y, rect.width, rect.height);
    };

    const renderFighterBoxes = (fighter: FighterLogic) => {
      const hurt = fighter.getWorldHurtboxes();

      // Green Hurtboxes: Head, Torso, Legs
      drawBox(hurt.head, 0x00ff88, 0x00ff88, 0.2);
      drawBox(hurt.torso, 0x00ff88, 0x00ff88, 0.2);
      drawBox(hurt.legs, 0x00ff88, 0x00ff88, 0.2);

      // Red Hitbox during Active frames
      const hitbox = fighter.getActiveWorldHitbox();
      if (hitbox) {
        drawBox(hitbox, 0xff0044, 0xff0044, 0.5);
      }

      // Pushbox (Cyan)
      if (this.showPushboxes) {
        const pb = fighter.getPushbox();
        drawBox(pb, 0x00d4ff, 0x00d4ff, 0.1);
      }

      // Origin Point
      g.fillStyle(0xffffff, 1);
      g.fillCircle(fighter.x, fighter.y, 3);
    };

    renderFighterBoxes(this.combatEngine.fighter1);
    renderFighterBoxes(this.combatEngine.fighter2);

    // Projectile Hitboxes
    for (const proj of this.combatEngine.projectiles) {
      if (proj.active) {
        drawBox(proj.getWorldHitbox(), 0xff0044, 0xff0044, 0.4);
      }
    }
  }

  private spawnHitSparks(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Phaser.Math.FloatBetween(2, 8);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        color,
        size: Phaser.Math.Between(2, 5),
        alpha: 1,
        life: 0,
        maxLife: Phaser.Math.Between(15, 30),
        gravity: 0.35, // Droplet fall
      });
    }
  }

  private spawnDust(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y - 2,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 2,
        color: 0x8890a5,
        size: Phaser.Math.Between(3, 7),
        alpha: 0.6,
        life: 0,
        maxLife: 20,
      });
    }
  }

  private updateParticles(): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life++;
      p.x += p.vx;
      p.y += p.vy;

      if (p.gravity) {
        p.vy += p.gravity;
        // Floor splash stick
        if (p.y >= this.combatEngine.stageBounds.groundY) {
          p.y = this.combatEngine.stageBounds.groundY;
          p.vx *= 0.5;
          p.vy = 0;
        }
      }

      p.alpha = 1 - p.life / p.maxLife;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }
  }

  private renderParticles(): void {
    const g = this.particleGraphics;
    g.clear();

    for (const p of this.particles) {
      g.fillStyle(p.color, p.alpha);
      g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }

  public resetSimulation(): void {
    this.combatEngine.resetMatch();
    this.particles = [];
    this.accumulator = 0;
  }

  public startGame(): void {
    this.isGameStarted = true;
    this.isPaused = false;
    this.resetSimulation();
    soundEffects.announce('Round 1... Fight!');
  }

  public togglePause(): void {
    this.isPaused = !this.isPaused;
    if (this.onPauseToggle) {
      this.onPauseToggle(this.isPaused);
    }
  }

  public pauseGame(): void {
    this.isPaused = true;
    if (this.onPauseToggle) {
      this.onPauseToggle(true);
    }
  }

  public resumeGame(): void {
    this.isPaused = false;
    if (this.onPauseToggle) {
      this.onPauseToggle(false);
    }
  }

  public returnToTitle(): void {
    this.isGameStarted = false;
    this.isPaused = false;
    this.resetSimulation();
    if (this.onPauseToggle) {
      this.onPauseToggle(false);
    }
  }
}
