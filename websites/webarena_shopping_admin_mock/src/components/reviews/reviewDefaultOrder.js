/* ===========================================================================
 * REVIEW_DEFAULT_ORDER — the live source's own row order for the Reviews grid's
 * cold-load sort, `Created ↓`.
 *
 * WHY THIS IS DATA AND NOT A COMPARATOR (DIFF-R104).
 *
 * 351 reviews share only **16 distinct `created_at` values** — 47 rows are
 * stamped `2023-04-19 12:15:11` alone. `ORDER BY created_at DESC` therefore
 * decides almost nothing: what an agent actually reads on page 2 of the grid is
 * decided by how MySQL breaks those ties. Measured in the container:
 *
 *   EXPLAIN SELECT review_id FROM review ORDER BY created_at DESC
 *     -> type ALL, key NULL, Extra "Using filesort"     (no index on created_at)
 *
 * so the tie order is the permutation `filesort`'s introsort happens to leave
 * behind. It is not review_id, not entity_pk_value, not detail_id, and not the
 * table's scan order — it is an artifact with no closed form. It IS stable:
 * the same 351 ids come back in the same order on every reload, and
 * `SELECT review_id FROM review ORDER BY created_at DESC` reproduces the grid's
 * order exactly, position for position.
 *
 * So the honest migration of "the source's sort rule" here is: compare
 * `created_at` for real, and break ties with the source's own measured order.
 * The array below is that order, transcribed from the live grid at
 * `/admin/review/product/index/limit/200/page/{1,2}/` (cold session per page)
 * and cross-checked against the SQL above. No record is invented, renamed,
 * reordered or dropped — it is the id sequence the source prints.
 *
 * Cross-page consistency, measured: at limit 20/30/50/100/200 the source's
 * pages are exact slices of this one sequence, which is what makes it the right
 * thing to reproduce. (`dir/asc` is NOT: the source's ascending pages 1 and 2 at
 * limit 200 return 351 rows with only 341 distinct ids — MySQL re-sorts per
 * OFFSET and rows repeat. There is no consistent ascending order to copy, so
 * ascending simply reverses this one.)
 * ======================================================================== */

const REVIEW_DEFAULT_ORDER = [
  353, 352, 351, 349, 347, 338, 337, 336, 335, 334, 333, 340, 339, 341, 342, 343, 344, 345,
  346, 313, 314, 315, 316, 317, 312, 311, 310, 308, 307, 306, 305, 304, 318, 319, 332, 331,
  330, 329, 328, 309, 327, 326, 320, 321, 322, 323, 324, 325, 282, 283, 284, 285, 286, 287,
  281, 280, 279, 278, 277, 276, 275, 274, 288, 289, 303, 302, 301, 300, 299, 298, 297, 296,
  290, 291, 292, 293, 294, 295, 243, 252, 253, 254, 255, 256, 251, 250, 249, 248, 247, 246,
  245, 244, 257, 258, 259, 265, 273, 272, 271, 270, 269, 268, 267, 260, 261, 262, 263, 264,
  266, 220, 221, 222, 223, 224, 225, 219, 218, 217, 216, 215, 214, 213, 212, 211, 226, 227,
  242, 241, 240, 239, 238, 237, 236, 235, 234, 228, 229, 230, 231, 232, 233, 186, 187, 188,
  189, 190, 191, 192, 185, 184, 183, 182, 181, 180, 179, 178, 177, 193, 194, 209, 208, 207,
  206, 205, 204, 203, 202, 201, 200, 199, 198, 197, 196, 195, 210, 176, 175, 174, 142, 143,
  144, 145, 146, 147, 148, 149, 150, 141, 140, 131, 132, 133, 134, 135, 136, 137, 138, 139,
  151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168,
  169, 170, 171, 172, 173, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105,
  106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123,
  124, 125, 126, 127, 128, 129, 130, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62,
  63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84,
  85, 86, 87, 88, 89, 90, 91, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
  19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
  41, 42, 43, 44, 45, 46, 47, 48, 1,
]

/** review_id -> its position in the source's cold-load listing. */
export const REVIEW_DEFAULT_RANK = new Map(
  REVIEW_DEFAULT_ORDER.map((id, i) => [String(id), i]),
)

/**
 * Reviews created inside the session have no measured position. They carry a
 * `created_at` newer than every seeded row, so the real comparison already puts
 * them first under `Created ↓`; ranking them after every known row keeps the
 * ordering total and deterministic.
 */
export function reviewRank(reviewId) {
  const r = REVIEW_DEFAULT_RANK.get(String(reviewId))
  return r === undefined ? REVIEW_DEFAULT_ORDER.length + Number(reviewId) : r
}

export default REVIEW_DEFAULT_ORDER
