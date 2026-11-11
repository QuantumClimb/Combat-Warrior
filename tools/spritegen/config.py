"""Character + animation definitions for the MVP sprite batch."""

STYLE = (
    "High-quality 2D pixel art, classic arcade fighting game style (Street Fighter / Mortal Kombat era), "
    "detailed pixel shading, strong dark outlines, rich but controlled palette, clearly readable silhouette, "
    "consistent pixel density in every frame."
)

LAYOUT = (
    "LAYOUT: one spritesheet containing exactly {n} frames arranged {grid}, in playback order (left to right, then top to bottom). "
    "Each frame shows the FULL body (head to feet, hair, hands, feet, nothing cropped) with wide empty green space between frames so no limbs or effects overlap neighbouring frames. "
    "Side-view 2D fighting-game perspective, the character faces RIGHT in every frame. Fixed camera, identical character scale in every frame, "
    "every frame in a row sits on the same invisible ground line; never shift frames up or down to show height, even for jumps (show the pose only). "
    "BACKGROUND: completely flat uniform chroma-key green #00FF00. No gradients, no textures, no shadows, no ground, no scenery, no glow or motion-blur effects, "
    "Keep every frame well inside the image with at least 80px of empty green margin to the image edges (nothing may touch or be cut by the edge). "
    "no text, no labels, no numbers, no borders, no grid lines. No weapons; the character is unarmed."
)

CHARACTERS = {
    "bhadran": {
        "identity": (
            "Character: BHADRAN, a muscular Indian Kalaripayattu warrior, about 30-35 years old. Medium brown skin, long black hair in a high topknot with loose flowing strands, "
            "thick black beard and moustache, intense expression, red tilak mark on forehead, gold hoop earring, wooden bead necklace, bare upper body, white cloth arm wraps and brown leather wrist bindings, "
            "cream baggy dhoti with gold borders, deep red waist sash tied at the waist, barefoot. "
            "Match the supplied reference sheet EXACTLY (face, costume, colours, proportions)."
        ),
    },
    "rudrani": {
        "identity": (
            "Character: RUDRANI, a fit athletic Indian Silambam warrior woman, about 28-30 years old. Medium brown skin, long black hair in a single long braid with white jasmine flowers pinned at the back of her head, "
            "red bindi, gold hoop earrings, sleeveless crimson cropped top with gold trim, gold armlets and bracelets and anklets, cream baggy dhoti with gold borders, red waist sash, barefoot. "
            "Match the supplied reference sheet EXACTLY (face, costume, colours, proportions). She is UNARMED: do not draw the silambam staff or any weapon."
        ),
    },
}

# name: (frames, fps, loop, airborne, pose description per frame)
ANIMS = {
    "idle": (4, 8, True, False,
        "Fighting-stance idle breathing loop. Knees bent, fists up guarding, weight low. Frame 1: neutral stance. Frame 2: chest rises slightly, body a few pixels higher. Frame 3: highest point of the breath. Frame 4: settling back down. Differences between frames are subtle."),
    "walk": (4, 8, True, False,
        "Walking-forward cycle in a low fighting stance, guard hands up, side view. EXACTLY 4 frames in one row, and the legs must look clearly DIFFERENT in every frame: "
        "Frame 1: CONTACT - front foot planted far ahead with heel down, back foot far behind on its toes, legs spread WIDE apart in a long stride. "
        "Frame 2: DOWN - weight over the front leg, front knee bent, back foot lifting off the floor. "
        "Frame 3: PASSING - back leg swinging forward past the standing leg, back foot lifted off the ground, legs nearly together. "
        "Frame 4: CONTACT of the opposite leg - legs spread WIDE apart again with the other foot forward. "
        "Exaggerate the leg positions so the stride cycle is obvious; the upper body stays steady."),
    "crouch": (3, 12, False, False,
        "Crouch transition. Frame 1: starting to bend knees. Frame 2: half crouch. Frame 3: full low crouch, torso upright, guard hands up, head lowered."),
    "jump": (4, 10, False, True,
        "Straight-up jump. Frame 1: crouched anticipation just before launch (on ground). Frame 2: rising, legs tucked slightly, in air. Frame 3: apex, knees tucked, in air. Frame 4: falling, legs extending down toward the ground."),
    "high_punch": (3, 14, False, False,
        "Standing high punch (straight punch to head height). Frame 1: wind-up, fist pulled back at hip. Frame 2: arm fully extended straight forward at head height, torso twisted, front-lunging stance. Frame 3: arm retracting back to guard."),
    "low_punch": (3, 14, False, False,
        'Standing low jab to the stomach, side view. The three frames must look clearly DIFFERENT. Frame 1: torso coiled back, jabbing fist pulled tight to the hip, shoulders turned away. Frame 2: arm FULLY EXTENDED straight forward at waist height, shoulders rotated into the punch, front knee bent, body leaning forward. Frame 3: arm snapping back to the guard, body returning upright.'),
    "low_kick": (3, 12, False, False,
        "Standing low kick aimed at shin height. Frame 1: knee lifted, chambered. Frame 2: leg extended forward and low, foot at shin height. Frame 3: leg retracting back to stance."),
    "high_kick": (3, 12, False, False,
        'Standing high roundhouse kick to head height, side view. The three frames must look clearly DIFFERENT. Frame 1: wind-up - standing on the back leg, kicking knee lifted and bent, foot tucked, fists up (NO extended leg yet). Frame 2: the kicking leg fully extended straight forward at head height, torso leaning back. Frame 3: the leg snapping back down, knee bent, foot lowering toward the ground, returning to stance.'),
    "uppercut": (4, 12, False, False,
        "Rising uppercut. Frame 1: crouched wind-up, fist low behind. Frame 2: driving upward, fist rising to chin level. Frame 3: fully extended upward, body off the ground slightly, fist above head. Frame 4: landing back into stance."),
    "sweep": (4, 12, False, False,
        "Low leg sweep. Frame 1: dropping low into crouch, one hand on the ground. Frame 2: leg beginning to swing. Frame 3: leg fully extended along the ground, sweeping forward. Frame 4: recovering to crouch."),
    "jump_punch": (3, 12, False, True,
        "Air punch. All frames in mid-air. Frame 1: airborne, fist pulled back. Frame 2: arm extended forward and slightly down in a diving punch. Frame 3: arm retracting, falling."),
    "jump_kick": (3, 12, False, True,
        'Flying air kick, all frames in mid-air, side view. Do NOT draw a tucked ball. Frame 1: airborne, body leaning forward, one knee raised toward the chest ready to kick, arms out for balance. Frame 2: one leg fully extended forward and slightly down in a flying kick, torso leaning back. Frame 3: kicking leg retracting, both feet reaching down toward landing.'),
    "block": (2, 8, False, False,
        "Standing high block. Frame 1: raising both forearms in front of face and chest, bracing. Frame 2: held block, arms crossed in front, shoulders hunched, leaning slightly back."),
    "low_block": (2, 8, False, False,
        "Crouching low block. Frame 1: dropping into crouch, forearms lowering. Frame 2: held crouch block, forearms crossed low in front of shins and lower body, head down."),
    "hit": (3, 12, False, False,
        "Hit reaction from being punched in the face. Frame 1: head snapping back, eyes squeezed shut. Frame 2: torso recoiling backward, arms flung out. Frame 3: staggering back, recovering."),
    "knockdown": (4, 10, False, False,
        "Knocked down. Frame 1: struck, body leaning back, feet leaving ground slightly. Frame 2: falling backward, body diagonal in the air. Frame 3: hitting the ground, back flat. Frame 4: lying flat on the back on the ground, defeated, face up."),
    "getup": (3, 10, False, False,
        'Getting up from lying on the back, side view. Frame 1: lying on the back, head toward the LEFT, body centred in the frame with margin around it, one hand starting to push. Frame 2: kneeling/crouched, one hand pushing off the ground. Frame 3: standing in fighting stance.'),
}

def grid_for(n):
    return 2 if n >= 5 else 1

# vertical lift (fraction of standing height) per frame for airborne anims, applied in post
LIFT = {"jump": [0, 0, 0, 0], "jump_punch": [0, 0, 0], "jump_kick": [0, 0, 0]}  # engine moves the fighter; no baked-in lift

# Scale normalisation: the model draws every sheet at a slightly different size, so each sheet is scaled
# so that a reference frame hits (fraction * standing height).  (frame selector, fraction of stand height)
# selector: "max" / "min" of the frame heights, or a frame index.  Tune these if a move looks too big/small.
SCALE_REF = {
    "idle": ("max", 1.0), "walk": ("max", 0.98), "high_punch": ("max", 1.0), "low_punch": ("max", 0.97),
    "low_kick": ("max", 1.0), "high_kick": ("max", 1.0), "block": ("min", 1.0), "hit": ("max", 1.0),
    "uppercut": (3, 1.0), "getup": (2, 1.0), "crouch": (0, 0.88), "low_block": ("max", 0.72),
    "sweep": ("max", 0.40), "jump": ("max", 0.60), "jump_punch": ("max", 0.72), "jump_kick": ("max", 0.68),
    "knockdown": (0, 0.85),
}
