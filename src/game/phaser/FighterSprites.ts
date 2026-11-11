/**
 * Sprite rendering for fighters. Reads the spritesheet manifests produced by tools/spritegen
 * (public/sprites/<char>/<char>.json) and picks the animation + frame deterministically from
 * the engine's FSM state, so visuals stay in lockstep with the 60Hz simulation (hitstop included).
 */
import * as Phaser from 'phaser';
import { BlockState, FighterState } from '../combat/CombatTypes';
import { FighterLogic } from '../combat/FighterLogic';

export const CHARACTER_BY_PLAYER: Record<number, string> = { 1: 'bhadran', 2: 'rudrani' };
const SPRITE_SCALE = 0.775;  // sheets are authored ~240px tall; 0.775 = 25% larger than the original 0.62
const SHEET_PAD = 8;         // transparent padding under the feet baked into each frame cell

const ATTACK_ANIM: Record<string, string> = {
  HIGH_PUNCH: 'high_punch', LOW_PUNCH: 'low_punch', LOW_KICK: 'low_kick', HIGH_KICK: 'high_kick',
  UPPERCUT: 'uppercut', SWEEP: 'sweep', ICE_PROJECTILE: 'high_punch',
  JUMP_PUNCH: 'jump_punch', JUMP_KICK: 'jump_kick',
};

interface Manifest {
  animations: Record<string, { frame_count: number; frame_size: [number, number] }>;
}

/** Queue manifests + spritesheets. Call from Scene.preload(). */
export function preloadFighterSprites(scene: Phaser.Scene): void {
  for (const char of Object.values(CHARACTER_BY_PLAYER)) {
    scene.load.json(`${char}-manifest`, `sprites/${char}/${char}.json`);
    scene.load.once(`filecomplete-json-${char}-manifest`, (_k: string, _t: string, m: Manifest) => {
      for (const [name, a] of Object.entries(m.animations)) {
        scene.load.spritesheet(`${char}_${name}`, `sprites/${char}/${char}_${name}.png`, {
          frameWidth: a.frame_size[0], frameHeight: a.frame_size[1], endFrame: a.frame_count - 1,
        });
      }
    });
  }
}

export class FighterSprite {
  private sprite: Phaser.GameObjects.Sprite;
  private manifest: Manifest;
  private char: string;

  constructor(private scene: Phaser.Scene, playerId: number) {
    this.char = CHARACTER_BY_PLAYER[playerId];
    this.manifest = scene.cache.json.get(`${this.char}-manifest`);
    for (const name of Object.keys(this.manifest.animations)) {
      scene.textures.get(`${this.char}_${name}`).setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    this.sprite = scene.add.sprite(0, 0, `${this.char}_idle`, 0).setScale(SPRITE_SCALE).setDepth(10);
  }

  destroy(): void { this.sprite.destroy(); }

  update(f: FighterLogic): void {
    const { anim, frame } = this.pick(f);
    const info = this.manifest.animations[anim] ?? this.manifest.animations.idle;
    const key = `${this.char}_${this.manifest.animations[anim] ? anim : 'idle'}`;
    const idx = Phaser.Math.Clamp(Math.floor(frame), 0, info.frame_count - 1);
    if (this.sprite.texture.key !== key) this.sprite.setTexture(key);
    this.sprite.setFrame(idx);
    this.sprite.setOrigin(0.5, (info.frame_size[1] - SHEET_PAD) / info.frame_size[1]);
    this.sprite.setPosition(f.x, f.y);
    this.sprite.setFlipX(f.facing === -1);
  }

  private n(anim: string): number { return this.manifest.animations[anim]?.frame_count ?? 1; }

  private pick(f: FighterLogic): { anim: string; frame: number } {
    const fsm = f.fsm;
    const sf = fsm.stateFrame;
    switch (fsm.currentState) {
      case FighterState.ATTACK: {
        const atk = fsm.currentAttack;
        const anim = (atk && ATTACK_ANIM[atk.id]) || 'high_punch';
        const total = atk?.totalFrames ?? 1;
        return { anim, frame: (sf / total) * this.n(anim) };
      }
      case FighterState.HITSTUN:
        return { anim: 'hit', frame: (sf / Math.max(1, fsm.stunDuration)) * this.n('hit') };
      case FighterState.BLOCKSTUN: {
        const low = f.getBlockState() === BlockState.LOW_BLOCK;
        return { anim: low ? 'low_block' : 'block', frame: sf < 4 ? 0 : 1 };
      }
      case FighterState.KNOCKDOWN: {
        if (f.isAirborne) return { anim: 'knockdown', frame: f.vy < -2 ? 0 : 1 };
        const t = f.knockdownWakeupTimer;
        if (t > 18) return { anim: 'knockdown', frame: 2 };
        if (t > 8) return { anim: 'knockdown', frame: 3 };
        return { anim: 'getup', frame: ((8 - t) / 8) * this.n('getup') };
      }
      case FighterState.JUMP: {
        if (sf < 3 && !f.isAirborne) return { anim: 'jump', frame: 0 };
        if (f.vy < -6) return { anim: 'jump', frame: 1 };
        if (f.vy < 3) return { anim: 'jump', frame: 2 };
        return { anim: 'jump', frame: 3 };
      }
      case FighterState.CROUCH: {
        const low = f.getBlockState() === BlockState.LOW_BLOCK;
        if (low) return { anim: 'low_block', frame: sf < 4 ? 0 : 1 };
        return { anim: 'crouch', frame: sf / 3 };
      }
      case FighterState.WALK_FORWARD:
      case FighterState.WALK_BACK: {
        const n = this.n('walk');
        // ~one stride per 33 ticks forward (3.6px/tick) to limit foot sliding; backward walk is slower (2.6px/tick)
        const ticksPerFrame = fsm.currentState === FighterState.WALK_BACK ? 11 : 8;
        const step = Math.floor(sf / ticksPerFrame) % n;
        return { anim: 'walk', frame: fsm.currentState === FighterState.WALK_BACK ? n - 1 - step : step };
      }
      default: {
        if (f.getBlockState() === BlockState.HIGH_BLOCK) return { anim: 'block', frame: 1 };
        return { anim: 'idle', frame: Math.floor(sf / 12) % this.n('idle') };
      }
    }
  }
}
