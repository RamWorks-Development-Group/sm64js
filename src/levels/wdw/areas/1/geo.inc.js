// Wdw

import {
    SCREEN_WIDTH, SCREEN_HEIGHT
} from "../../../../game/Skybox"

import {
    GEO_NODE_SCREEN_AREA, GEO_OPEN_NODE, GEO_ZBUFFER, GEO_NODE_ORTHO, GEO_BACKGROUND,
    GEO_CLOSE_NODE, GEO_CAMERA_FRUSTUM_WITH_FUNC, GEO_CAMERA, GEO_DISPLAY_LIST, GEO_ASM,
    GEO_RENDER_OBJ, GEO_END,
    BACKGROUND_UNDERWATER_CITY, LAYER_OPAQUE, LAYER_ALPHA, LAYER_TRANSPARENT,
    LAYER_TRANSPARENT_DECAL
} from "../../../../engine/GeoLayout"

import {
    geo_skybox_main, geo_envfx_main
} from "../../../../game/LevelGeo"

import {
    geo_camera_fov, geo_camera_main
} from "../../../../game/Camera"

import { wdw_seg7_dl_07009AB0 } from "./1/model.inc"

import { wdw_seg7_dl_0700A138 } from "./2/model.inc"

import { wdw_seg7_dl_07012798 } from "./3/model.inc"

import {
     //, geo_cannon_circle_base
} from "../../../../game/ObjectHelpers"

import {
    geo_wdw_set_initial_water_level, geo_movtex_pause_control, geo_movtex_draw_water_regions
} from "../../../../game/MovingTexture"
import { wdw_seg7_dl_07012908 } from "../../double_arrows/model.inc"


// 0x0E000658
export const wdw_geo_000658 = () => {return [
    GEO_NODE_SCREEN_AREA(10, SCREEN_WIDTH/2, SCREEN_HEIGHT/2, SCREEN_WIDTH/2, SCREEN_HEIGHT/2),
    GEO_OPEN_NODE(),
        GEO_ZBUFFER(0),
        GEO_OPEN_NODE(),
            GEO_NODE_ORTHO(100),
            GEO_OPEN_NODE(),
                GEO_BACKGROUND(BACKGROUND_UNDERWATER_CITY, geo_skybox_main),
            GEO_CLOSE_NODE(),
        GEO_CLOSE_NODE(),
        GEO_ZBUFFER(1),
        GEO_OPEN_NODE(),
            GEO_CAMERA_FRUSTUM_WITH_FUNC(45, 100, 12800, geo_camera_fov),
            GEO_OPEN_NODE(),
                GEO_CAMERA(1, 0, 2000, 6000, -4352, 0, -4352, geo_camera_main),
                GEO_OPEN_NODE(),
                    GEO_DISPLAY_LIST(LAYER_OPAQUE, wdw_seg7_dl_07009AB0),
                    GEO_DISPLAY_LIST(LAYER_ALPHA, wdw_seg7_dl_0700A138),
                    GEO_DISPLAY_LIST(LAYER_TRANSPARENT, wdw_seg7_dl_07012798),
                    GEO_DISPLAY_LIST(LAYER_TRANSPARENT_DECAL, wdw_seg7_dl_07012908),
                    GEO_ASM(0, geo_wdw_set_initial_water_level),
                    GEO_ASM(0, geo_movtex_pause_control),
                    GEO_ASM(0x1101, geo_movtex_draw_water_regions),
                    GEO_RENDER_OBJ(),
                    GEO_ASM(0, geo_envfx_main),
                GEO_CLOSE_NODE(),
            GEO_CLOSE_NODE(),
        GEO_CLOSE_NODE(),
        GEO_ZBUFFER(0),
        /*GEO_OPEN_NODE(),
            GEO_ASM(0, geo_cannon_circle_base),
        GEO_CLOSE_NODE(),*/
    GEO_CLOSE_NODE(),
    GEO_END(),
]};

// 2021-06-15 11:42:13 -0400 (Convert.rb 2021-06-14 09:43:28 -0400)
