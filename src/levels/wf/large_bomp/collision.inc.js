// Wf

import {
    COL_INIT, COL_VERTEX_INIT, COL_VERTEX, COL_TRI_INIT, COL_TRI, COL_TRI_STOP, COL_END,
    SURFACE_WALL_MISC
} from "../../../include/surface_terrains"

// 0x0700F934 - 0x0700FA00
export const wf_seg7_collision_large_bomp = [
    COL_INIT(),
    COL_VERTEX_INIT(0xE),
    COL_VERTEX(259, 5, -258),
    COL_VERTEX(195, 210, -258),
    COL_VERTEX(259, 210, -194),
    COL_VERTEX(259, 210, 189),
    COL_VERTEX(259, 5, 253),
    COL_VERTEX(-252, 210, -258),
    COL_VERTEX(-252, 5, -258),
    COL_VERTEX(136, 261, -155),
    COL_VERTEX(195, 210, 253),
    COL_VERTEX(136, 261, 151),
    COL_VERTEX(-252, 5, 253),
    COL_VERTEX(-252, 261, 151),
    COL_VERTEX(-252, 261, -155),
    COL_VERTEX(-252, 210, 253),
    COL_TRI_INIT(SURFACE_WALL_MISC, 18),
    COL_TRI(12, 1, 5),
    COL_TRI(0, 1, 2),
    COL_TRI(0, 3, 4),
    COL_TRI(0, 2, 3),
    COL_TRI(5, 1, 0),
    COL_TRI(5, 0, 6),
    COL_TRI(1, 7, 2),
    COL_TRI(7, 3, 2),
    COL_TRI(3, 8, 4),
    COL_TRI(3, 9, 8),
    COL_TRI(7, 9, 3),
    COL_TRI(10, 4, 8),
    COL_TRI(11, 7, 12),
    COL_TRI(11, 9, 7),
    COL_TRI(12, 7, 1),
    COL_TRI(10, 8, 13),
    COL_TRI(13, 8, 9),
    COL_TRI(13, 9, 11),
    COL_TRI_STOP(),
    COL_END(),
].flat();

// 2021-06-14 16:16:34 -0400 (Convert.rb 2021-06-14 09:43:28 -0400)
