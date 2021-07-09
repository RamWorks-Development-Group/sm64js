// Wf

import {
    COL_INIT, COL_VERTEX_INIT, COL_VERTEX, COL_TRI_INIT, COL_TRI, COL_TRI_STOP, COL_END,
    SURFACE_DEFAULT
} from "../../../../../include/surface_terrains"

// 0x07010260 - 0x070102D8
export const wf_seg7_collision_bullet_bill_cannon = [
    COL_INIT(),
    COL_VERTEX_INIT(0x8),
    COL_VERTEX(-127, 0, -127),
    COL_VERTEX(128, 256, -127),
    COL_VERTEX(128, 0, -127),
    COL_VERTEX(128, 256, 179),
    COL_VERTEX(128, 0, 179),
    COL_VERTEX(-127, 256, -127),
    COL_VERTEX(-127, 256, 179),
    COL_VERTEX(-127, 0, 179),
    COL_TRI_INIT(SURFACE_DEFAULT, 10),
    COL_TRI(0, 1, 2),
    COL_TRI(2, 1, 3),
    COL_TRI(2, 3, 4),
    COL_TRI(0, 5, 1),
    COL_TRI(5, 3, 1),
    COL_TRI(5, 6, 3),
    COL_TRI(4, 3, 6),
    COL_TRI(4, 6, 7),
    COL_TRI(7, 6, 5),
    COL_TRI(7, 5, 0),
    COL_TRI_STOP(),
    COL_END(),
].flat();

// 2021-06-14 16:16:34 -0400 (Convert.rb 2021-06-14 09:43:28 -0400)
