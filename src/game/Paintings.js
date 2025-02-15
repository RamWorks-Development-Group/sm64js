/**
 * @file paintings.c
 *
 * Implements the rippling painting effect. Paintings are GraphNodes that exist without being connected
 * to any particular object.
 *
 * Paintings are defined in level data. Look at levels/castle_inside/painting.inc.c for examples.
 *
 * The ripple effect uses data that is split into several parts:
 *      The mesh positions are generated from a base mesh. See seg2_painting_triangle_mesh near the
 *          bottom of bin/segment2.c
 *
 *      The lighting for the ripple is also generated from a base table, seg2_painting_mesh_neighbor_tris
 *          in bin/segment2.c
 *
 *      Each painting's texture uses yet another table to map its texture to the mesh.
 *          These maps are in level data, see levels/castle_inside/painting.inc.c for example.
 *
 *      Finally, each painting has two display lists, normal and rippling, which are defined in the same
 *      level data file as the Painting itself. See levels/castle_inside/painting.inc.c.
 *
 *
 * Painting state machine:
 * Paintings spawn in the PAINTING_IDLE state
 *      From IDLE, paintings can change to PAINTING_RIPPLE or PAINTING_ENTERED
 *        - This state checks for ENTERED because if Mario waits long enough, a PROXIMITY painting could
 *          reset to IDLE
 *
 * Paintings in the PAINTING_RIPPLE state are passively rippling.
 *      For RIPPLE_TRIGGER_PROXIMITY paintings, this means Mario bumped the wall in front of the
 *          painting.
 *
 *      Paintings that use RIPPLE_TRIGGER_CONTINUOUS try to transition to this state as soon as possible,
 *          usually when Mario enters the room.
 *
 *      A PROXIMITY painting will automatically reset to IDLE if its ripple magnitude becomes small
 *          enough.
 *
 * Paintings in the PAINTING_ENTERED state have been entered by Mario.
 *      A CONTINUOUS painting will automatically reset to RIPPLE if its ripple magnitude becomes small
 *          enough.
 */

import {
    RIPPLE_TRIGGER_PROXIMITY, RIPPLE_TRIGGER_CONTINUOUS, PAINTING_IMAGE, PAINTING_ENV_MAP,
    ddd_painting,
    ccm_painting,
    hmc_painting,
    ttc_painting,
    ttm_painting,
    ssl_painting,
    sl_painting,
    wf_painting,
    jrb_painting,
    wdw_painting,
    thi_huge_painting,
    thi_tiny_painting,
    lll_painting
} from "../levels/castle_inside/painting.inc"
import { bob_painting } from "../levels/castle_inside/painting.inc"
import { sqrtf, round_float, guTranslate, guRotate, guScale } from "../engine/math_util"
import { G_IM_FMT_RGBA, G_MTX_MODELVIEW, G_MTX_MUL, G_MTX_NOPUSH, G_MTX_PUSH, gSP1Triangle, gSPDisplayList, gSPEndDisplayList, gSPMatrix, gSPPopMatrix, gSPVertex } from "../include/gbi"
import { gLoadBlockTexture, make_vertex } from "./GeoMisc"
import { dl_paintings_draw_ripples, dl_paintings_env_mapped_begin, dl_paintings_env_mapped_end, dl_paintings_rippling_begin, dl_paintings_rippling_end, seg2_painting_mesh_neighbor_tris, seg2_painting_triangle_mesh } from "../bin/segment2"
import { save_file_get_flags, save_file_get_star_flags, save_file_set_flags } from "./SaveFile"
import { LAYER_OPAQUE, LAYER_TRANSPARENT } from "../engine/GeoLayout"
import { GEO_CONTEXT_RENDER } from "../engine/graph_node"
import { oPosX, oPosY, oPosZ } from "../include/object_constants"
import { SURFACE_PAINTING_WARP_D3, SURFACE_PAINTING_WARP_D4, SURFACE_PAINTING_WARP_D5, SURFACE_PAINTING_WOBBLE_A6, SURFACE_PAINTING_WOBBLE_A7, SURFACE_PAINTING_WOBBLE_A8 } from "../include/surface_terrains"
import { s16 } from "../utils"
import { cotmc_painting } from "../levels/hmc/areas/1/painting.inc"

/// The default painting side length
export const PAINTING_SIZE = 614.0

export const PAINTING_ID_DDD = 7

export const BOARD_BOWSERS_SUB = 1

export const BOWSERS_SUB_BEATEN = 0x2
export const DDD_BACK = 0x1

export const PAINTING_IDLE = 0
export const PAINTING_RIPPLE = 1
export const PAINTING_ENTERED = 2


/**
 * Triggers a passive ripple on the left side of the painting.
 */
const RIPPLE_LEFT = 0x20

/**
 * Triggers a passive ripple in the middle the painting.
 */
const RIPPLE_MIDDLE = 0x10

/**
 * Triggers a passive ripple on the right side of the painting.
 */
const RIPPLE_RIGHT = 0x8

/**
 * Triggers an entry ripple on the left side of the painting.
 */
const ENTER_LEFT = 0x4

/**
 * Triggers an entry ripple in the middle of the painting.
 */
const ENTER_MIDDLE = 0x2

/**
 * Triggers an entry ripple on the right side of the painting.
 */
const ENTER_RIGHT = 0x1

/**
 * Use the 1/4th part of the painting that is nearest to Mario's current floor.
 */
const NEAREST_4TH = 30

/**
 * Use Mario's relative x position.
 * @see painting_mario_x
 */
const MARIO_X = 40

/**
 * Use the x center of the painting.
 */
const MIDDLE_X = 50

/**
 * Use Mario's relative y position.
 * @see painting_mario_y
 */
const MARIO_Y = 60

/**
 * Use Mario's relative z position.
 * @see painting_mario_z
 */
const MARIO_Z = 70

/**
 * Use the y center of the painting.
 */
const MIDDLE_Y = 80

/**
 * Does nothing to the timer.
 * Why -56 instead of false? Who knows.
 */
const DONT_RESET = -56

/**
 * Reset the timer to 0.
 */
const RESET_TIMER = 100

/// A copy of the type of floor Mario is standing on.
let gPaintingMarioFloorType
// A copy of Mario's position
let gPaintingMarioXPos
let gPaintingMarioYPos
let gPaintingMarioZPos

/**
 * When a painting is rippling, this mesh is generated each frame using the Painting's parameters.
 *
 * This mesh only contains the vertex positions and normals.
 * Paintings use an additional array to map textures to the mesh.
 */
let /* PaintingMeshVertex * */ gPaintingMesh

/**
 * The painting's surface normals, used to approximate each of the vertex normals (for gouraud shading).
 */
let /* Vec3f * */ gPaintingTriNorms

/**
 * The painting that is currently rippling. Only one painting can be rippling at once.
 */
export let /* Painting * */ gRipplingPainting

/**
 * Whether the DDD painting is moved forward, should being moving backwards, or has already moved backwards.
 */
export let gDddPaintingStatus

export let gPaintingMarioYEntry = 0.0;

const /* Painting * */ sHmcPaintings = [
    cotmc_painting,
    null,
]

const /* Painting * */ sInsideCastlePaintings = [
    bob_painting, ccm_painting, wf_painting,  jrb_painting,      lll_painting,
    ssl_painting, hmc_painting, ddd_painting, wdw_painting,      thi_tiny_painting,
    ttm_painting, ttc_painting, sl_painting,  thi_huge_painting,
    null,
]

const /* Painting * */ sTtmPaintings = [
    // ttm_slide_painting,
    null,
]

const sPaintingGroups = [
    sHmcPaintings,
    sInsideCastlePaintings,
    sTtmPaintings,
]

let gPaintingUpdateCounter = 1
let gLastPaintingUpdateCounter = 0

/**
 * Stop paintings in paintingGroup from rippling if their id is different from *idptr.
 */
export const stop_other_paintings = (painting, paintingGroup) => {
    let index
    let id = painting.id

    index = 0;
    while (paintingGroup[index] != null) {
        let painting = paintingGroup[index]

        // stop all rippling except for the selected painting
        if (painting.id != id) {
            painting.rippleStatus = 0
        }
        index++
    }
}

/**
 * @return Mario's y position inside the painting (bounded).
 */
export const painting_mario_y = (painting) => {
    //! Unnecessary use of double constants
    // Add 50 to make the ripple closer to Mario's center of mass.
    let relY = gPaintingMarioYPos - painting.position[1] + 50.0

    if (relY < 0.0) {
        relY = 0.0
    } else if (relY > painting.size) {
        relY = painting.size
    }
    return relY
}

/**
 * @return Mario's z position inside the painting (bounded).
 */
export const painting_mario_z = (painting) => {
    let relZ = painting.position[2] - gPaintingMarioZPos

    if (relZ < 0.0) {
        relZ = 0.0
    } else if (relZ > painting.size) {
        relZ = painting.size
    }
    return relZ
}

/**
 * @return The y origin for the ripple, based on ySource.
 *         For floor paintings, the z-axis is treated as y.
 */
export const painting_ripple_y = (painting, ySource) => {
    switch (ySource) {
        case MARIO_Y:
            return painting_mario_y(painting);   // normal wall paintings
        case MARIO_Z:
            return painting_mario_z(painting);   // floor paintings use X and Z
        case MIDDLE_Y:
            return painting.size / 2.0;   // some concentric ripples don't care about Mario
    }

    return 0.0;
}

/**
 * Return the quarter of the painting that is closest to the floor Mario entered.
 */
export const painting_nearest_4th = (painting) => {
    let firstQuarter = painting.size / 4.0;         // 1/4 of the way across the painting
    let secondQuarter = painting.size / 2.0;        // 1/2 of the way across the painting
    let thirdQuarter = painting.size * 3.0 / 4.0;   // 3/4 of the way across the painting

    if (painting.floorStatus[2] & RIPPLE_LEFT) {
        return firstQuarter
    } else if (painting.floorStatus[2] & RIPPLE_MIDDLE) {
        return secondQuarter
    } else if (painting.floorStatus[2] & RIPPLE_RIGHT) {
        return thirdQuarter

      // Same as ripple floors.
    } else if (painting.floorStatus[2] & ENTER_LEFT) {
        return firstQuarter
    } else if (painting.floorStatus[2] & ENTER_MIDDLE) {
        return secondQuarter
    } else if (painting.floorStatus[2] & ENTER_RIGHT) {
        return thirdQuarter
    }
}

/**
 * @return Mario's x position inside the painting (bounded).
 */
export const painting_mario_x = (painting) => {
    let relX = gPaintingMarioXPos - painting.position[0]

    if (relX < 0.0) {
        relX = 0.0
    } else if (relX > painting.size) {
        relX = painting.size
    }
    return relX
}

/**
 * @return The x origin for the ripple, based on xSource.
 */
export const painting_ripple_x = (painting, xSource) => {
    switch (xSource) {
        case NEAREST_4TH:   // normal wall paintings
            return painting_nearest_4th(painting);
        case MARIO_X:   // horizontally placed paintings use X and Z
            return painting_mario_x(painting);
        case MIDDLE_X:   // concentric rippling may not care about Mario
            return painting.size / 2.0;
    }
}

/**
 * Set the painting's state, causing it to start a passive ripple or a ripple from Mario entering.
 *
 * @param state The state to enter
 * @param painting,paintingGroup identifies the painting that is changing state
 * @param xSource,ySource what to use for the x and y origin of the ripple
 * @param resetTimer if 100, set the timer to 0
 */
const painting_state = (state, painting, paintingGroup, xSource, ySource, resetTimer) => {
    // make sure no other paintings are rippling
    stop_other_paintings(painting, paintingGroup);

    // use a different set of variables depending on the state
    switch (state) {
        case PAINTING_RIPPLE:
            painting.rippleMagnitude[0]    = painting.rippleMagnitude[1]
            painting.rippleDecay[0]      = painting.rippleDecay[1]
            painting.rippleRate[0]   = painting.rippleRate[1]
            painting.rippleDispersion[0] = painting.rippleDispersion[1]
            break

        case PAINTING_ENTERED:
            painting.rippleMagnitude[0]    = painting.rippleMagnitude[2]
            painting.rippleDecay[0]      = painting.rippleDecay[2]
            painting.rippleRate[0]   = painting.rippleRate[2]
            painting.rippleDispersion[0] = painting.rippleDispersion[1]
            break
    }

    painting.rippleStatus = state
    painting.currRippleXY[0] = painting_ripple_x(painting, xSource)
    painting.currRippleXY[1] = painting_ripple_y(painting, ySource)
    gPaintingMarioYEntry = gPaintingMarioYPos

      // Because true or false would be too simple...
    if (resetTimer == RESET_TIMER) {
        painting.currRippleTimer = 0.0
    }
    gRipplingPainting = painting
}

/**
 * Idle update function for wall paintings that use RIPPLE_TRIGGER_PROXIMITY.
 */
export const wall_painting_proximity_idle = (painting, paintingGroup) => {
      // Check for Mario triggering a ripple
    if (painting.floorStatus[2] & RIPPLE_LEFT) {
        painting_state(PAINTING_RIPPLE, painting, paintingGroup, NEAREST_4TH, MARIO_Y, RESET_TIMER)
    } else if (painting.floorStatus[2] & RIPPLE_MIDDLE) {
        painting_state(PAINTING_RIPPLE, painting, paintingGroup, NEAREST_4TH, MARIO_Y, RESET_TIMER)
    } else if (painting.floorStatus[2] & RIPPLE_RIGHT) {
        painting_state(PAINTING_RIPPLE, painting, paintingGroup, NEAREST_4TH, MARIO_Y, RESET_TIMER)

      // Check for Mario entering
    } else if (painting.floorStatus[2] & ENTER_LEFT) {
        painting_state(PAINTING_ENTERED, painting, paintingGroup, NEAREST_4TH, MARIO_Y, RESET_TIMER)
    } else if (painting.floorStatus[2] & ENTER_MIDDLE) {
        painting_state(PAINTING_ENTERED, painting, paintingGroup, NEAREST_4TH, MARIO_Y, RESET_TIMER)
    } else if (painting.floorStatus[2] & ENTER_RIGHT) {
        painting_state(PAINTING_ENTERED, painting, paintingGroup, NEAREST_4TH, MARIO_Y, RESET_TIMER)
    }
}

/**
 * Rippling update function for wall paintings that use RIPPLE_TRIGGER_PROXIMITY.
 */
export const wall_painting_proximity_rippling = (painting, paintingGroup) => {
    if (painting.floorStatus[2] & ENTER_LEFT) {
        painting_state(PAINTING_ENTERED, painting, paintingGroup, NEAREST_4TH, MARIO_Y, RESET_TIMER)
    } else if (painting.floorStatus[2] & ENTER_MIDDLE) {
        painting_state(PAINTING_ENTERED, painting, paintingGroup, NEAREST_4TH, MARIO_Y, RESET_TIMER)
    } else if (painting.floorStatus[2] & ENTER_RIGHT) {
        painting_state(PAINTING_ENTERED, painting, paintingGroup, NEAREST_4TH, MARIO_Y, RESET_TIMER)
    }
}

/**
 * Idle update function for wall paintings that use RIPPLE_TRIGGER_CONTINUOUS.
 */
export const wall_painting_continuous_idle = (painting, paintingGroup) => {
      // Check for Mario triggering a ripple
    if (painting.floorStatus[2] & RIPPLE_LEFT) {
        painting_state(PAINTING_RIPPLE, painting, paintingGroup, MIDDLE_X, MIDDLE_Y, RESET_TIMER)
    } else if (painting.floorStatus[2] & RIPPLE_MIDDLE) {
        painting_state(PAINTING_RIPPLE, painting, paintingGroup, MIDDLE_X, MIDDLE_Y, RESET_TIMER)
    } else if (painting.floorStatus[2] & RIPPLE_RIGHT) {
        painting_state(PAINTING_RIPPLE, painting, paintingGroup, MIDDLE_X, MIDDLE_Y, RESET_TIMER)

      // Check for Mario entering
    } else if (painting.floorStatus[2] & ENTER_LEFT) {
        painting_state(PAINTING_ENTERED, painting, paintingGroup, NEAREST_4TH, MARIO_Y, RESET_TIMER)
    } else if (painting.floorStatus[2] & ENTER_MIDDLE) {
        painting_state(PAINTING_ENTERED, painting, paintingGroup, NEAREST_4TH, MARIO_Y, RESET_TIMER)
    } else if (painting.floorStatus[2] & ENTER_RIGHT) {
        painting_state(PAINTING_ENTERED, painting, paintingGroup, NEAREST_4TH, MARIO_Y, RESET_TIMER)
    }
}

/**
 * Rippling update function for wall paintings that use RIPPLE_TRIGGER_CONTINUOUS.
 */
export const wall_painting_continuous_rippling = (painting, paintingGroup) => {
    if (painting.floorStatus[2] & ENTER_LEFT) {
        painting_state(PAINTING_ENTERED, painting, paintingGroup, NEAREST_4TH, MARIO_Y, DONT_RESET)
    } else if (painting.floorStatus[2] & ENTER_MIDDLE) {
        painting_state(PAINTING_ENTERED, painting, paintingGroup, NEAREST_4TH, MARIO_Y, DONT_RESET)
    } else if (painting.floorStatus[2] & ENTER_RIGHT) {
        painting_state(PAINTING_ENTERED, painting, paintingGroup, NEAREST_4TH, MARIO_Y, DONT_RESET)
    }
}

/**
 * Idle update function for floor paintings that use RIPPLE_TRIGGER_PROXIMITY.
 *
 * No floor paintings use RIPPLE_TRIGGER_PROXIMITY in the game.
 */
export const floor_painting_proximity_idle = (painting, paintingGroup) => {
      // Check for Mario triggering a ripple
    if (painting.floorStatus[2] & RIPPLE_LEFT) {
        painting_state(PAINTING_RIPPLE, painting, paintingGroup, MARIO_X, MARIO_Z, RESET_TIMER)
    } else if (painting.floorStatus[2] & RIPPLE_MIDDLE) {
        painting_state(PAINTING_RIPPLE, painting, paintingGroup, MARIO_X, MARIO_Z, RESET_TIMER)
    } else if (painting.floorStatus[2] & RIPPLE_RIGHT) {
        painting_state(PAINTING_RIPPLE, painting, paintingGroup, MARIO_X, MARIO_Z, RESET_TIMER)

      // Only check for Mario entering if he jumped below the surface
    } else if (painting.marioBelow[2]) {
        if (painting.currFloor & ENTER_LEFT) {
            painting_state(PAINTING_ENTERED, painting, paintingGroup, MARIO_X, MARIO_Z, RESET_TIMER)
        } else if (painting.currFloor & ENTER_MIDDLE) {
            painting_state(PAINTING_ENTERED, painting, paintingGroup, MARIO_X, MARIO_Z, RESET_TIMER)
        } else if (painting.currFloor & ENTER_RIGHT) {
            painting_state(PAINTING_ENTERED, painting, paintingGroup, MARIO_X, MARIO_Z, RESET_TIMER)
        }
    }
}

/**
 * Rippling update function for floor paintings that use RIPPLE_TRIGGER_PROXIMITY.
 *
 * No floor paintings use RIPPLE_TRIGGER_PROXIMITY in the game.
 */
export const floor_painting_proximity_rippling = (painting, paintingGroup) => {
    if (painting.marioBelow[2]) {
        if (painting.currFloor & ENTER_LEFT) {
            painting_state(PAINTING_ENTERED, painting, paintingGroup, MARIO_X, MARIO_Z, RESET_TIMER)
        } else if (painting.currFloor & ENTER_MIDDLE) {
            painting_state(PAINTING_ENTERED, painting, paintingGroup, MARIO_X, MARIO_Z, RESET_TIMER)
        } else if (painting.currFloor & ENTER_RIGHT) {
            painting_state(PAINTING_ENTERED, painting, paintingGroup, MARIO_X, MARIO_Z, RESET_TIMER)
        }
    }
}

/**
 * Idle update function for floor paintings that use RIPPLE_TRIGGER_CONTINUOUS.
 *
 * Both floor paintings (HMC and CotMC) are hidden behind a door, which hides the ripple's start up.
 * The floor just inside the doorway is RIPPLE_LEFT, so the painting starts rippling as soon as Mario
 * enters the room.
 */
export const floor_painting_continuous_idle = (painting, paintingGroup) => {
      // Check for Mario triggering a ripple
    if (painting.floorStatus[2] & RIPPLE_LEFT) {
        painting_state(PAINTING_RIPPLE, painting, paintingGroup, MIDDLE_X, MIDDLE_Y, RESET_TIMER)
    } else if (painting.floorStatus[2] & RIPPLE_MIDDLE) {
        painting_state(PAINTING_RIPPLE, painting, paintingGroup, MIDDLE_X, MIDDLE_Y, RESET_TIMER)
    } else if (painting.floorStatus[2] & RIPPLE_RIGHT) {
        painting_state(PAINTING_RIPPLE, painting, paintingGroup, MIDDLE_X, MIDDLE_Y, RESET_TIMER)

      // Check for Mario entering
    } else if (painting.currFloor & ENTER_LEFT) {
        painting_state(PAINTING_ENTERED, painting, paintingGroup, MARIO_X, MARIO_Z, RESET_TIMER)
    } else if (painting.currFloor & ENTER_MIDDLE) {
        painting_state(PAINTING_ENTERED, painting, paintingGroup, MARIO_X, MARIO_Z, RESET_TIMER)
    } else if (painting.currFloor & ENTER_RIGHT) {
        painting_state(PAINTING_ENTERED, painting, paintingGroup, MARIO_X, MARIO_Z, RESET_TIMER)
    }
}

/**
 * Rippling update function for floor paintings that use RIPPLE_TRIGGER_CONTINUOUS.
 */
export const floor_painting_continuous_rippling = (painting, paintingGroup) => {
    if (painting.marioBelow[2]) {
        if (painting.currFloor & ENTER_LEFT) {
            painting_state(PAINTING_ENTERED, painting, paintingGroup, MARIO_X, MARIO_Z, DONT_RESET)
        } else if (painting.currFloor & ENTER_MIDDLE) {
            painting_state(PAINTING_ENTERED, painting, paintingGroup, MARIO_X, MARIO_Z, DONT_RESET)
        } else if (painting.currFloor & ENTER_RIGHT) {
            painting_state(PAINTING_ENTERED, painting, paintingGroup, MARIO_X, MARIO_Z, DONT_RESET)
        }
    }
}

/**
 * Check for Mario entering one of the special floors associated with the painting.
 */
export const painting_update_floors = (painting) => {
    let paintingId = painting.id;
    let rippleLeft = 0;
    let rippleMiddle = 0;
    let rippleRight = 0;
    let enterLeft = 0;
    let enterMiddle = 0;
    let enterRight = 0;

    /* The area in front of every painting in the game (except HMC and CotMC, which   *\
    |* act a little differently) is made up of 3 special floor triangles with special *|
    |* (unique) surface types. This code checks which surface Mario is currently on   *|
    \* and sets a bitfield accordingly.                                               */

      // check if Mario's current floor is one of the special floors
    if (gPaintingMarioFloorType == paintingId * 3 + SURFACE_PAINTING_WOBBLE_A6) {
        rippleLeft = RIPPLE_LEFT
    }
    if (gPaintingMarioFloorType == paintingId * 3 + SURFACE_PAINTING_WOBBLE_A7) {
        rippleMiddle = RIPPLE_MIDDLE
    }
    if (gPaintingMarioFloorType == paintingId * 3 + SURFACE_PAINTING_WOBBLE_A8) {
        rippleRight = RIPPLE_RIGHT
    }
    if (gPaintingMarioFloorType == paintingId * 3 + SURFACE_PAINTING_WARP_D3) {
        enterLeft = ENTER_LEFT
    }
    if (gPaintingMarioFloorType == paintingId * 3 + SURFACE_PAINTING_WARP_D4) {
        enterMiddle = ENTER_MIDDLE
    }
    if (gPaintingMarioFloorType == paintingId * 3 + SURFACE_PAINTING_WARP_D5) {
        enterRight = ENTER_RIGHT
    }

    painting.lastFloor = painting.currFloor
    // at most 1 of these will be nonzero;
    painting.currFloor = rippleLeft + rippleMiddle + rippleRight + enterLeft + enterMiddle + enterRight

    // floorEntered is true iff currFloor is true and lastFloor is false
    // (Mario just entered the floor on this frame)
    painting.floorStatus[2] = (painting.lastFloor ^ painting.currFloor) & painting.currFloor

    painting.marioBelow[0] = painting.marioBelow[1]
      // Check if Mario has fallen below the painting (used for floor paintings)
    if (gPaintingMarioYPos < painting.position[1]) {
        painting.marioBelow[1] = 1
    } else {
        painting.marioBelow[1] = 0
    }

      // Mario "went under" if he was not under last frame, but is under now
    painting.marioBelow[2] = (painting.marioBelow[0] ^ painting.marioBelow[1]) & painting.marioBelow[1]
}

/**
 * Update the ripple's timer and magnitude, making it propagate outwards.
 *
 * Automatically changes the painting back to IDLE state (or RIPPLE for continuous paintings) if the
 * ripple's magnitude becomes small enough.
 */
export const painting_update_ripple_state = (painting) => {
    if (gPaintingUpdateCounter != gLastPaintingUpdateCounter) {
        painting.rippleMagnitude[0] *= painting.rippleDecay[0]

          //! After ~6.47 days, paintings with RIPPLE_TRIGGER_CONTINUOUS will increment this to
          //! 16777216 (1 << 24), at which point it will freeze (due to floating-point
          //! imprecision?) and the painting will stop rippling. This happens to HMC, DDD, and
          //! CotMC.
        painting.currRippleTimer += 1.0
    }
    if (painting.rippleTrigger == RIPPLE_TRIGGER_PROXIMITY) {
          // if the painting is barely rippling, make it stop rippling
        if (painting.rippleMagnitude[0] <= 1.0) {
            painting.rippleStatus = PAINTING_IDLE
            gRipplingPainting = null
        }
    } else if (painting.rippleTrigger == RIPPLE_TRIGGER_CONTINUOUS) {

          // if the painting is doing the entry ripple but the ripples are as small as those from the
          // passive ripple, make it do a passive ripple
          // If Mario goes below the surface but doesn't warp, the painting will eventually reset.
        if (painting.rippleStatus == PAINTING_ENTERED && painting.rippleMagnitude[0] <= painting.rippleMagnitude[1]) {

            painting.rippleStatus = PAINTING_RIPPLE
            painting.rippleMagnitude[0] = painting.rippleMagnitude[1]
            painting.rippleDecay[0] = painting.rippleDecay[1]
            painting.rippleRate[0] = painting.rippleRate[1]
            painting.rippleDispersion[0] = painting.rippleDispersion[1]
        }
    }
}

/**
 * @return the ripple function at posX, posY
 * note that posX and posY correspond to a point on the face of the painting, not actual axes
 */
export const calculate_ripple_at_point = (painting, posX, posY) => {
    /// Controls the peaks of the ripple.
    let rippleMag = painting.rippleMagnitude[0]
    /// Controls the ripple's frequency
    let rippleRate = painting.rippleRate[0]
    /// Controls how fast the ripple spreads
    let dispersionFactor = painting.rippleDispersion[0]
    /// How far the ripple has spread
    let rippleTimer = painting.currRippleTimer
    /// x and y ripple origin
    let rippleX = painting.currRippleXY[0]
    let rippleY = painting.currRippleXY[1]

        posX *= painting.size / PAINTING_SIZE
        posY *= painting.size / PAINTING_SIZE

    let distanceToOrigin = sqrtf((posX - rippleX) * (posX - rippleX) + (posY - rippleY) * (posY - rippleY))
        // A larger dispersionFactor makes the ripple spread slower
    let rippleDistance = distanceToOrigin / dispersionFactor
    if (rippleTimer < rippleDistance) {
          // if the ripple hasn't reached the point yet, make the point magnitude 0
        return false
    } else {
          // use a cosine wave to make the ripple go up and down,
          // scaled by the painting's ripple magnitude
        let rippleZ = rippleMag * Math.cos(rippleRate * (2 * Math.PI) * (rippleTimer - rippleDistance))

          // round it to an int and return it
        return round_float(rippleZ)
    }
}

/**
 * If movable, return the ripple function at (posX, posY)
 * else return false
 */
export const ripple_if_movable = (painting, movable, posX, posY) => {
    let rippleZ = 0

    if (movable) {
        rippleZ = calculate_ripple_at_point(painting, posX, posY)
    }
    return rippleZ
}

/**
 * Allocates and generates a mesh for the rippling painting effect by modifying the passed in `mesh`
 * based on the painting's current ripple state.
 *
 * The `mesh` table describes the location of mesh vertices, whether they move when rippling, and what
 * triangles they belong to.
 *
 * The static mesh passed in is organized into two lists. This function only uses the first list,
 * painting_calculate_triangle_normals below uses the second one.
 *
 * The first list describes the vertices in this format:
 *      numVertices
 *      v0 x, v0 y, movable
 *      ...
 *      vN x, vN y, movable
 *      Where x and y are from 0 to PAINTING_SIZE, movable is 0 or 1.
 *
 * The mesh used in game, seg2_painting_triangle_mesh, is in bin/segment2.c.
 */
export const painting_generate_mesh = (painting, mesh, numTris) => {
    let i

    gPaintingMesh = []
    // accesses are off by 1 since the first entry is the number of vertices
    for (i = 0; i < numTris; i++) {
        gPaintingMesh.push({
            pos: [0, 0, 0],
            norm: [0, 0, 0],
        });
        gPaintingMesh[i].pos[0] = mesh[i * 3 + 1],
        gPaintingMesh[i].pos[1] = mesh[i * 3 + 2],
        gPaintingMesh[i].pos[2] = ripple_if_movable(painting, mesh[i * 3 + 3],
                                    gPaintingMesh[i].pos[0], gPaintingMesh[i].pos[1]);
    }
}

/**
 * Calculate the surface normals of each triangle in the generated ripple mesh.
 *
 * The static mesh passed in is organized into two lists. This function uses the second list,
 * painting_generate_mesh above uses the first one.
 *
 * The second list in `mesh` describes the mesh's triangles in this format:
 *      numTris
 *      tri0 v0, tri0 v1, tri0 v2
 *      ...
 *      triN v0, triN v1, triN v2
 *      Where each v0, v1, v2 is an index into the first list in `mesh`.
 *
 * The mesh used in game, seg2_painting_triangle_mesh, is in bin/segment2.c.
 */
export const painting_calculate_triangle_normals = (mesh, numVtx, numTris) => {
    let i

    gPaintingTriNorms = [];
    for (i = 0; i < numTris; i++) {
        let tri = numVtx * 3 + i * 3 + 2;   // Add 2 because of the 2 length entries preceding the list
        let v0 = mesh[tri]
        let v1 = mesh[tri + 1]
        let v2 = mesh[tri + 2]

        let x0 = gPaintingMesh[v0].pos[0]
        let y0 = gPaintingMesh[v0].pos[1]
        let z0 = gPaintingMesh[v0].pos[2]

        let x1 = gPaintingMesh[v1].pos[0]
        let y1 = gPaintingMesh[v1].pos[1]
        let z1 = gPaintingMesh[v1].pos[2]

        let x2 = gPaintingMesh[v2].pos[0]
        let y2 = gPaintingMesh[v2].pos[1]
        let z2 = gPaintingMesh[v2].pos[2]

          // Cross product to find each triangle's normal vector
        gPaintingTriNorms[i] = [];
        gPaintingTriNorms[i][0] = (y1 - y0) * (z2 - z1) - (z1 - z0) * (y2 - y1)
        gPaintingTriNorms[i][1] = (z1 - z0) * (x2 - x1) - (x1 - x0) * (z2 - z1)
        gPaintingTriNorms[i][2] = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1)
    }
}

/**
 * Rounds a floating-point component of a normal vector to an s8 by multiplying it by 127 or 128 and
 * rounding away from 0.
 */
export const normalize_component = (comp) => {
    let rounded = 0;

    if (comp > 0.0) {
        rounded = comp * 127.0 + 0.5;   // round up
    } else if (comp < 0.0) {
        rounded = comp * 128.0 - 0.5;   // round down
    }

    return rounded
}

/**
 * Approximates the painting mesh's vertex normals by averaging the normals of all triangles sharing a
 * vertex. Used for Gouraud lighting.
 *
 * After each triangle's surface normal is calculated, the `neighborTris` table describes which triangles
 * each vertex should use when calculating the average normal vector.
 *
 * The table is a list of entries in this format:
 *      numNeighbors, tri0, tri1, ..., triN
 *
 *      Where each 'tri' is an index into gPaintingTriNorms.
 *      Entry i in `neighborTris` corresponds to the vertex at gPaintingMesh[i]
 *
 * The table used in game, seg2_painting_mesh_neighbor_tris, is in bin/segment2.c.
 */
export const painting_average_vertex_normals = (neighborTris, numVtx) => {
    let tri
    let i, j
    let neighbors
    let entry = 0

    for (i = 0; i < numVtx; i++) {
        let nx = 0.0
        let ny = 0.0
        let nz = 0.0

        // The first number of each entry is the number of adjacent tris
        neighbors = neighborTris[entry]
        for (j = 0; j < neighbors; j++) {
            tri = neighborTris[entry + j + 1]
            nx += gPaintingTriNorms[tri][0]
            ny += gPaintingTriNorms[tri][1]
            nz += gPaintingTriNorms[tri][2]
        }
          // Move to the next vertex's entry
        entry += neighbors + 1

          // average the surface normals from each neighboring tri
        nx /= neighbors
        ny /= neighbors
        nz /= neighbors
        let nlen = sqrtf(nx * nx + ny * ny + nz * nz)

        if (nlen == 0.0) {
            gPaintingMesh[i].norm[0] = 0
            gPaintingMesh[i].norm[1] = 0
            gPaintingMesh[i].norm[2] = 0
        } else {
            gPaintingMesh[i].norm[0] = normalize_component(nx / nlen)
            gPaintingMesh[i].norm[1] = normalize_component(ny / nlen)
            gPaintingMesh[i].norm[2] = normalize_component(nz / nlen)
        }
    }
}

/**
 * Creates a display list that draws the rippling painting, with 'img' mapped to the painting's mesh,
 * using 'textureMap'.
 *
 * If the textureMap doesn't describe the whole mesh, then multiple calls are needed to draw the whole
 * painting.
 */
export const render_painting = (img, tWidth, tHeight, textureMap, mapVerts, mapTris, alpha) => {
    let group
    let map
    let triGroup

    // We can fit 15 (16 / 3) vertices in the RSP's vertex buffer.
    // Group triangles by 5, with one remainder group.
    let triGroups = s16(mapTris / 5)
    let remGroupTris = mapTris % 5
    let numVtx = mapTris * 3;

    // let commands = triGroups * 2 + remGroupTris + 7;
    let verts = new Array(numVtx);
    let gfx = [];

    gLoadBlockTexture(gfx, tWidth, tHeight, G_IM_FMT_RGBA, img)

    // Draw the groups of 5 first
    for (group = 0; group < triGroups; group++) {

        // The triangle groups are the second part of the texture map.
        // Each group is a list of 15 mappings
        triGroup = mapVerts * 3 + group * 15 + 2
        for (map = 0; map < 15; map++) {
            // The mapping is just an index into the earlier part of the textureMap
            // Some mappings are repeated, for example, when multiple triangles share a vertex
            let mapping = textureMap[triGroup + map]

            // The first entry is the ID of the vertex in the mesh
            let meshVtx = textureMap[mapping * 3 + 1]

            // The next two are the texture coordinates for that vertex
            let tx = textureMap[mapping * 3 + 2]
            let ty = textureMap[mapping * 3 + 3]

            // Map the texture and place it in the verts array
            make_vertex(verts, group * 15 + map, gPaintingMesh[meshVtx].pos[0], gPaintingMesh[meshVtx].pos[1],
                        gPaintingMesh[meshVtx].pos[2], tx, ty, gPaintingMesh[meshVtx].norm[0],
                        gPaintingMesh[meshVtx].norm[1], gPaintingMesh[meshVtx].norm[2], alpha)
        }

        // Load the vertices and draw the 5 triangles
        gSPVertex(gfx, verts.slice(group * 15, verts.length), 15, 0)
        gSPDisplayList(gfx, dl_paintings_draw_ripples)
    }

    // One group left with < 5 triangles
    triGroup = mapVerts * 3 + triGroups * 15 + 2
    // Map the texture to the triangles
    for (map = 0; map < remGroupTris * 3; map++) {
        let mapping = textureMap[triGroup + map]
        let meshVtx = textureMap[mapping * 3 + 1]
        let tx = textureMap[mapping * 3 + 2]
        let ty = textureMap[mapping * 3 + 3]
        make_vertex(verts, triGroups * 15 + map, gPaintingMesh[meshVtx].pos[0], gPaintingMesh[meshVtx].pos[1],
                    gPaintingMesh[meshVtx].pos[2], tx, ty, gPaintingMesh[meshVtx].norm[0],
                    gPaintingMesh[meshVtx].norm[1], gPaintingMesh[meshVtx].norm[2], alpha)
    }

      // Draw the triangles individually
    gSPVertex(gfx, verts.slice(verts + triGroups * 15, verts.length), remGroupTris * 3, 0)
    for (group = 0; group < remGroupTris; group++) {
        gSP1Triangle(gfx, group * 3, group * 3 + 1, group * 3 + 2, 0)
    }

    gSPEndDisplayList(gfx)
    return gfx;
}

/**
 * Orient the painting mesh for rendering.
 */
export const painting_model_view_transform = (painting) => {
    let sizeRatio = painting.size / PAINTING_SIZE
    let rotX = new Array(4).fill(0).map(() => new Array(4).fill(0));
    let rotY = new Array(4).fill(0).map(() => new Array(4).fill(0));
    let translate = new Array(4).fill(0).map(() => new Array(4).fill(0));
    let scale = new Array(4).fill(0).map(() => new Array(4).fill(0));
    let gfx = [];

    guTranslate(translate, painting.position[0], painting.position[1], painting.position[2])
    guRotate(rotX, painting.rotation[0], 1.0, 0.0, 0.0)
    guRotate(rotY, painting.rotation[1], 0.0, 1.0, 0.0)
    guScale(scale, sizeRatio, sizeRatio, sizeRatio)

    gSPMatrix(gfx, translate, G_MTX_MODELVIEW | G_MTX_MUL | G_MTX_PUSH)
    gSPMatrix(gfx, rotX,      G_MTX_MODELVIEW | G_MTX_MUL | G_MTX_NOPUSH)
    gSPMatrix(gfx, rotY,      G_MTX_MODELVIEW | G_MTX_MUL | G_MTX_NOPUSH)
    gSPMatrix(gfx, scale,     G_MTX_MODELVIEW | G_MTX_MUL | G_MTX_NOPUSH)
    gSPEndDisplayList(gfx)

    return gfx
}

/**
 * Ripple a painting that has 1 or more images that need to be mapped
 */
export const painting_ripple_image = (painting) => {
    let imageCount = painting.imageCount
    let [tWidth, tHeight] = painting.textureWH
    let textureMaps = painting.textureMaps
    let textures = painting.textures
    let gfx = [];

    gSPDisplayList(gfx, painting_model_view_transform(painting))
    gSPDisplayList(gfx, dl_paintings_rippling_begin)
    gSPDisplayList(gfx, painting.rippleDList)

    // Map each image to the mesh's vertices
    for (let i = 0; i < imageCount; i++) {
        let textureMap = textureMaps[i]
        let meshVerts = textureMap[0]
        let meshTris = textureMap[meshVerts * 3 + 1]
        gSPDisplayList(gfx, render_painting(textures[i], tWidth, tHeight, textureMap, meshVerts, meshTris, painting.alpha));
    }

      // Update the ripple, may automatically reset the painting's state.
    painting_update_ripple_state(painting)

    gSPPopMatrix(gfx, G_MTX_MODELVIEW)
    gSPDisplayList(gfx, dl_paintings_rippling_end)
    gSPEndDisplayList(gfx)
    return gfx;
}

/**
 * Ripple a painting that has 1 "environment map" texture.
 */
export const painting_ripple_env_mapped = (painting) => {
    let meshVerts
    let meshTris
    let textureMap
    let [tWidth, tHeight] = painting.textureWH
    let textureMaps = painting.textureMaps
    let tArray = painting.textures
    let gfx = []

    if (dlist == null) {
        return dlist
    }

    gSPDisplayList(gfx, painting_model_view_transform(painting))
    gSPDisplayList(gfx, dl_paintings_env_mapped_begin)
    gSPDisplayList(gfx, painting.rippleDList)

      // Map the image to the mesh's vertices
    textureMap = textureMaps[0]
    meshVerts = textureMap[0]
    meshTris = textureMap[meshVerts * 3 + 1]
    gSPDisplayList(gfx, render_painting(tArray[0], tWidth, tHeight, textureMap, meshVerts, meshTris, painting.alpha))

      // Update the ripple, may automatically reset the painting's state.
    painting_update_ripple_state(painting)

    gSPPopMatrix(gfx, G_MTX_MODELVIEW)
    gSPDisplayList(gfx, dl_paintings_env_mapped_end)
    gSPEndDisplayList(gfx)
    return gfx;
}

/**
 * Generates a mesh, calculates vertex normals for lighting, and renders a rippling painting.
 * The mesh and vertex normals are regenerated and freed every frame.
 */
export const display_painting_rippling = (painting) => {
    let mesh = seg2_painting_triangle_mesh
    let neighborTris = seg2_painting_mesh_neighbor_tris
    let numVtx = mesh[0]
    let numTris = mesh[numVtx * 3 + 1]
    let dlist

      // Generate the mesh and its lighting data
    painting_generate_mesh(painting, mesh, numVtx)
    painting_calculate_triangle_normals(mesh, numVtx, numTris)
    painting_average_vertex_normals(neighborTris, numVtx)

      // Map the painting's texture depending on the painting's texture type.
    switch (painting.textureType) {
        case PAINTING_IMAGE:
            dlist = painting_ripple_image(painting)
            break
        case PAINTING_ENV_MAP:
            dlist = painting_ripple_env_mapped(painting)
            break
    }

    return dlist
}

/**
 * Render a normal painting.
 */
export const display_painting_not_rippling = (painting) => {
    let gfx = []

    gSPDisplayList(gfx, painting_model_view_transform(painting))
    gSPDisplayList(gfx, painting.normalDList)
    gSPPopMatrix(gfx, G_MTX_MODELVIEW)
    gSPEndDisplayList(gfx)
    return gfx;
}

/**
 * Clear Mario-related state and clear gRipplingPainting.
 */
export const reset_painting = (painting) => {
    painting.lastFloor = 0
    painting.currFloor = 0
    painting.floorStatus[2] = 0
    painting.marioBelow[0] = 0
    painting.marioBelow[1] = 0
    painting.marioBelow[2] = 0

    gRipplingPainting = null

    painting.rippleStatus = PAINTING_IDLE
    painting.rippleMagnitude[0] = 0.0
    painting.rippleDecay[0] = 1.0
    painting.rippleRate[0] = 0.0
    painting.rippleDispersion[0] = 0.0
    painting.currRippleTimer = 0.0
    painting.currRippleXY[0] = 0.0
    painting.currRippleXY[1] = 0.0
    if (painting == ddd_painting) {
          // Move DDD painting to initial position, in case the animation
          // that moves the painting stops during level unload.
        painting.position[0] = 3456.0
    }
}

/**
 * Controls the x coordinate of the DDD painting.
 *
 * Before Mario gets the "Board Bowser's Sub" star in DDD, the painting spawns at frontPos.
 *
 * If Mario just got the star, the painting's x coordinate moves to backPos at a rate of `speed` units.
 *
 * When the painting reaches backPos, a save flag is set so that the painting will spawn at backPos
 * whenever it loads.
 *
 * This function also sets gDddPaintingStatus, which controls the warp:
 *  0 (0b00): set x coordinate to frontPos
 *  2 (0b10): set x coordinate to backPos
 *  3 (0b11): same as 2. Bit 0 is ignored
 */
export const move_ddd_painting = (painting, frontPos, backPos, speed) => {
      // Obtain the DDD star flags
    let dddFlags = save_file_get_star_flags(gLinker.Area.gCurrSaveFileNum - 1, COURSE_DDD - 1)
      // Get the other save file flags
    let saveFileFlags = save_file_get_flags()
      // Find out whether Board Bowser's Sub was collected
    let bowsersSubBeaten = dddFlags & BOARD_BOWSERS_SUB
      // Check whether DDD has already moved back
    let dddBack = saveFileFlags & SAVE_FLAG_DDD_MOVED_BACK

    if (!bowsersSubBeaten && !dddBack) {
          // If we haven't collected the star or moved the painting, put the painting at the front
        painting.position[0] = frontPos
        gDddPaintingStatus = 0
    } else if (bowsersSubBeaten && !dddBack) {
          // If we've collected the star but not moved the painting back,
          // Each frame, move the painting by a certain speed towards the back area.
        painting.position[0] += speed
        gDddPaintingStatus = BOWSERS_SUB_BEATEN
        if (painting.position[0] >= backPos) {
            painting.position[0] = backPos
              // Tell the save file that we've moved DDD back.
            save_file_set_flags(SAVE_FLAG_DDD_MOVED_BACK)
        }
    } else if (bowsersSubBeaten && dddBack) {
          // If the painting has already moved back, place it in the back position.
        painting.position[0] = backPos
        gDddPaintingStatus = BOWSERS_SUB_BEATEN | DDD_BACK
    }
}

/**
 * Set the painting's node's layer based on its alpha
 */
export const set_painting_layer = (node, painting) => {
    switch (painting.alpha) {
        case 0xFF:   // Opaque
        node.flags = (node.flags & 0xFF) | (LAYER_OPAQUE << 8)
            break
        default:
            node.flags = (node.flags & 0xFF) | (LAYER_TRANSPARENT << 8)
            break
    }
}

/**
 * Display either a normal painting or a rippling one depending on the painting's ripple status
 */
export const display_painting = (painting) => {
    switch (painting.rippleStatus) {
        case PAINTING_IDLE:
            return display_painting_not_rippling(painting)
        default:
            return display_painting_rippling(painting)
    }
}

/**
 * Update function for wall paintings.
 * Calls a different update function depending on the painting's ripple trigger and current state.
 */
export const wall_painting_update = (painting, paintingGroup) => {
    if (painting.rippleTrigger == RIPPLE_TRIGGER_PROXIMITY) {
        switch (painting.rippleStatus) {
            case PAINTING_IDLE:
                wall_painting_proximity_idle(painting, paintingGroup)
                break
            case PAINTING_RIPPLE:
                wall_painting_proximity_rippling(painting, paintingGroup)
                break
        }
    } else if (painting.rippleTrigger == RIPPLE_TRIGGER_CONTINUOUS) {
        switch (painting.rippleStatus) {
            case PAINTING_IDLE:
                wall_painting_continuous_idle(painting, paintingGroup)
                break
            case PAINTING_RIPPLE:
                wall_painting_continuous_rippling(painting, paintingGroup)
                break
        }
    }
}

/**
 * Update function for floor paintings (HMC and CotMC)
 * Calls a different update function depending on the painting's ripple trigger and current state.
 *
 * No floor paintings use RIPPLE_TRIGGER_PROXIMITY in the game.
 */
export const floor_painting_update = (painting, paintingGroup) => {
    if (painting.rippleTrigger == RIPPLE_TRIGGER_PROXIMITY) {
        switch (painting.rippleStatus) {
            case PAINTING_IDLE:
                floor_painting_proximity_idle(painting, paintingGroup)
                break
            case PAINTING_RIPPLE:
                floor_painting_proximity_rippling(painting, paintingGroup)
                break
        }
    } else if (painting.rippleTrigger == RIPPLE_TRIGGER_CONTINUOUS) {
        switch (painting.rippleStatus) {
            case PAINTING_IDLE:
                floor_painting_continuous_idle(painting, paintingGroup)
                break
            case PAINTING_RIPPLE:
                floor_painting_continuous_rippling(painting, paintingGroup)
                break
        }
    }
}

/**
 * Render and update the painting whose id and group matches the values in the GraphNode's parameter.
 * Use PAINTING_ID(id, group) to set the right parameter in a level's geo layout.
 */
export const geo_painting_draw = (callContext, node, context) => {
    let group = (node.parameter >> 8) & 0xFF
    let id = node.parameter & 0xFF
    let paintingDlist = []
    let paintingGroup = sPaintingGroups[group]
    let painting = paintingGroup[id]

    if (painting == null) {
        return null
    }

    if (callContext != GEO_CONTEXT_RENDER) {
        reset_painting(painting)
    } else if (callContext == GEO_CONTEXT_RENDER) {
          // Update the ddd painting before drawing
        if (group == 1 && id == PAINTING_ID_DDD) {
            move_ddd_painting(painting, 3456.0, 5529.6, 20.0)
        }

          // Determine if the painting is transparent
        set_painting_layer(node, painting)

          // Draw before updating
        paintingDlist = display_painting(painting)

          // Update the painting
        painting_update_floors(painting)
        switch (s16(painting.rotation[0])) {
              // only paintings with 0 pitch are treated as walls
            case 0:
                wall_painting_update(painting, paintingGroup)
                break
            default:
                floor_painting_update(painting, paintingGroup)
                break
        }
    }
    return paintingDlist
}

/**
 * Update the painting system's local copy of Mario's current floor and position.
 */
export const geo_painting_update = (callContext, node, c) => {
    const gMarioObject = gLinker.ObjectListProcessor.gMarioObject
    let surface

      // Reset the update counter
    if (callContext != GEO_CONTEXT_RENDER) {
        gLastPaintingUpdateCounter = gLinker.GeoRenderer.gAreaUpdateCounter - 1
        gPaintingUpdateCounter = gLinker.GeoRenderer.gAreaUpdateCounter
    } else {
        gLastPaintingUpdateCounter = gPaintingUpdateCounter
        gPaintingUpdateCounter = gLinker.GeoRenderer.gAreaUpdateCounter

          // Store Mario's floor and position
        let fW = { floor: surface }
        gLinker.SurfaceCollision.find_floor(gMarioObject.rawData[oPosX], gMarioObject.rawData[oPosY], gMarioObject.rawData[oPosZ], fW);
        surface = fW.floor

        gPaintingMarioFloorType = surface.type
        gPaintingMarioXPos = gMarioObject.rawData[oPosX]
        gPaintingMarioYPos = gMarioObject.rawData[oPosY]
        gPaintingMarioZPos = gMarioObject.rawData[oPosZ]
    }
    return null
}

gLinker.geo_painting_draw = geo_painting_draw
gLinker.geo_painting_update = geo_painting_update