const db = require('../config/db');

function buildSlug(title) {
  return title
    .toString()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // bỏ dấu tiếng Việt
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
}

const FileModel = {
  buildSlug,

  async create(data) {
    const [result] = await db.query(
      `INSERT INTO files
       (title, slug, description, thumbnail, category_id, version, file_type,
        price_money, price_points, free_mode, free_link, paid_file_path, status, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        data.title, data.slug, data.description, data.thumbnail, data.categoryId || null,
        data.version || '1.0', data.fileType, data.priceMoney || 0, data.pricePoints || 0,
        data.freeMode || 'direct', data.freeLink || null, data.paidFilePath || null,
        data.status || 'visible', data.createdBy,
      ]
    );
    return result.insertId;
  },

  async update(id, data) {
    const fields = [];
    const values = [];
    const map = {
      title: 'title', description: 'description', thumbnail: 'thumbnail',
      categoryId: 'category_id', version: 'version', fileType: 'file_type',
      priceMoney: 'price_money', pricePoints: 'price_points', freeMode: 'free_mode',
      freeLink: 'free_link', paidFilePath: 'paid_file_path', status: 'status',
    };
    for (const key in map) {
      if (data[key] !== undefined) {
        fields.push(`${map[key]} = ?`);
        values.push(data[key]);
      }
    }
    if (fields.length === 0) return;
    values.push(id);
    await db.query(`UPDATE files SET ${fields.join(', ')} WHERE id = ?`, values);
  },

  async delete(id) {
    await db.query('DELETE FROM files WHERE id = ?', [id]);
  },

  async findById(id) {
    const [rows] = await db.query(
      `SELECT f.*, c.name AS category_name
       FROM files f LEFT JOIN categories c ON f.category_id = c.id
       WHERE f.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async findBySlug(slug) {
    const [rows] = await db.query(
      `SELECT f.*, c.name AS category_name
       FROM files f LEFT JOIN categories c ON f.category_id = c.id
       WHERE f.slug = ? LIMIT 1`,
      [slug]
    );
    return rows[0] || null;
  },

  async incrementView(id) {
    await db.query('UPDATE files SET views = views + 1 WHERE id = ?', [id]);
  },

  async incrementDownload(id) {
    await db.query('UPDATE files SET downloads = downloads + 1 WHERE id = ?', [id]);
  },

  async incrementPurchase(id) {
    await db.query('UPDATE files SET purchases = purchases + 1 WHERE id = ?', [id]);
  },

  async search({ q, categoryId, tag, minPrice, maxPrice, freeOnly, paidOnly, sort, page = 1, limit = 20 }) {
    const where = ["f.status = 'visible'"];
    const params = [];

    if (q) {
      where.push('MATCH(f.title, f.description) AGAINST (? IN NATURAL LANGUAGE MODE)');
      params.push(q);
    }
    if (categoryId) {
      where.push('f.category_id = ?');
      params.push(categoryId);
    }
    if (tag) {
      where.push('EXISTS (SELECT 1 FROM file_tags ft JOIN tags t ON ft.tag_id = t.id WHERE ft.file_id = f.id AND t.slug = ?)');
      params.push(tag);
    }
    if (minPrice !== undefined) {
      where.push('f.price_money >= ?');
      params.push(minPrice);
    }
    if (maxPrice !== undefined) {
      where.push('f.price_money <= ?');
      params.push(maxPrice);
    }
    if (freeOnly) where.push("f.file_type = 'free'");
    if (paidOnly) where.push("f.file_type = 'paid'");

    let orderBy = 'f.created_at DESC';
    if (sort === 'popular') orderBy = 'f.downloads DESC';
    if (sort === 'most_purchased') orderBy = 'f.purchases DESC';
    if (sort === 'top_rated') orderBy = 'f.rating_avg DESC';
    if (sort === 'price_asc') orderBy = 'f.price_money ASC';
    if (sort === 'price_desc') orderBy = 'f.price_money DESC';

    const offset = (page - 1) * limit;
    const sql = `
      SELECT f.*, c.name AS category_name
      FROM files f LEFT JOIN categories c ON f.category_id = c.id
      WHERE ${where.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await db.query(sql, params);

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM files f WHERE ${where.join(' AND ')}`,
      params.slice(0, -2)
    );

    return { rows, total, page, limit };
  },

  async attachTags(fileId, tagIds) {
    if (!tagIds || tagIds.length === 0) return;
    const values = tagIds.map((tagId) => [fileId, tagId]);
    await db.query('INSERT IGNORE INTO file_tags (file_id, tag_id) VALUES ?', [values]);
  },

  async replaceTags(fileId, tagIds) {
    await db.query('DELETE FROM file_tags WHERE file_id = ?', [fileId]);
    await this.attachTags(fileId, tagIds);
  },

  // Kiểm tra user đã sở hữu file này chưa (mua tiền đã duyệt HOẶC mua bằng điểm)
  async userOwnsFile(userId, fileId) {
    const [paidOrders] = await db.query(
      `SELECT o.id FROM orders o JOIN payments p ON p.order_id = o.id
       WHERE o.user_id = ? AND o.file_id = ? AND o.status = 'paid' AND p.status = 'approved' LIMIT 1`,
      [userId, fileId]
    );
    if (paidOrders.length > 0) return true;

    const [pointPurchase] = await db.query(
      `SELECT id FROM points_history WHERE user_id = ? AND reason = 'purchase' AND reference_id = ? LIMIT 1`,
      [userId, fileId]
    );
    return pointPurchase.length > 0;
  },
};

module.exports = FileModel;
