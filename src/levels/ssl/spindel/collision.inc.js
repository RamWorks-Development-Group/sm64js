// Ssl

import {
    COL_INIT, COL_VERTEX_INIT, COL_VERTEX, COL_TRI_INIT, COL_TRI, COL_TRI_STOP, COL_END,
    SURFACE_DEFAULT
} from "../../../include/surface_terrains"

// 0x07027F54 - 0x0702808C
export const ssl_seg7_collision_spindel = [
    COL_INIT(),
    COL_VERTEX_INIT(0x12),
    COL_VERTEX(-306, -77, 189),
    COL_VERTEX(307, 78, 189),
    COL_VERTEX(-306, 78, 189),
    COL_VERTEX(307, -77, 189),
    COL_VERTEX(-306, -188, 78),
    COL_VERTEX(307, -188, 78),
    COL_VERTEX(-306, -188, -77),
    COL_VERTEX(307, -188, -77),
    COL_VERTEX(-306, -77, -188),
    COL_VERTEX(307, -77, -188),
    COL_VERTEX(-306, 78, -188),
    COL_VERTEX(-306, 189, -77),
    COL_VERTEX(-306, 189, 78),
    COL_VERTEX(-306, 0, 0),
    COL_VERTEX(307, 189, 78),
    COL_VERTEX(307, 78, -188),
    COL_VERTEX(307, 189, -77),
    COL_VERTEX(307, 0, 0),
    COL_TRI_INIT(SURFACE_DEFAULT, 32),
    COL_TRI(8, 9, 7),
    COL_TRI(0, 1, 2),
    COL_TRI(0, 3, 1),
    COL_TRI(4, 3, 0),
    COL_TRI(4, 5, 3),
    COL_TRI(6, 5, 4),
    COL_TRI(6, 7, 5),
    COL_TRI(12, 14, 16),
    COL_TRI(8, 7, 6),
    COL_TRI(10, 15, 9),
    COL_TRI(10, 9, 8),
    COL_TRI(11, 16, 15),
    COL_TRI(11, 15, 10),
    COL_TRI(12, 16, 11),
    COL_TRI(13, 10, 8),
    COL_TRI(13, 8, 6),
    COL_TRI(13, 2, 12),
    COL_TRI(13, 12, 11),
    COL_TRI(13, 11, 10),
    COL_TRI(1, 3, 17),
    COL_TRI(13, 6, 4),
    COL_TRI(13, 4, 0),
    COL_TRI(13, 0, 2),
    COL_TRI(14, 1, 17),
    COL_TRI(15, 16, 17),
    COL_TRI(3, 5, 17),
    COL_TRI(5, 7, 17),
    COL_TRI(7, 9, 17),
    COL_TRI(9, 15, 17),
    COL_TRI(2, 1, 14),
    COL_TRI(16, 14, 17),
    COL_TRI(2, 14, 12),
    COL_TRI_STOP(),
    COL_END(),
].flat();

// 2021-06-14 09:53:10 -0400 (Convert.rb 2021-06-14 09:43:28 -0400)
