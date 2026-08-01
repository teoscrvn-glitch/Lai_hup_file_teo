const db = require('../config/db');

function slugify(name) {
  return name.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const CategoryModel = {
  async all() {
    const [rows] = await db.query('SELECT * FROM categories ORDER BY name ASC');
    return rows;
  },
  async create(name) {
    const slug = slugify(name);
    const [result] = await db.query('INSERT INTO categories (name, slug) VALUES (?, ?)', [name, slug]);
    return result.insertId;
  },
  async update(id, name) {
    await db.query('UPDATE categories SET name = ?, slug = ? WHERE id = ?', [name, slugify(name), id]);
  },
  async delete(id) {
    await db.query('DELETE FROM categories WHERE id = ?', [id]);
  },
};

const TagModel = {
  async all() {
    const [rows] = await db.query('SELECT * FROM tags ORDER BY name ASC');
    return rows;
  },
  // Tìm tag theo tên, tạo mới nếu chưa có — trả về mảng id
  async findOrCreateMany(names = []) {
    const ids = [];
    for (const rawName of names) {
      const name = rawName.trim();
      if (!name) continue;
      const slug = slugify(name);
      const [existing] = await db.query('SELECT id FROM tags WHERE slug = ?', [slug]);
      if (existing.length > 0) {
        ids.push(existing[0].id);
      } else {
        const [result] = await db.query('INSERT INTO tags (name, slug) VALUES (?, ?)', [name, slug]);
        ids.push(result.insertId);
      }
    }
    return ids;
  },
};

module.exports = { CategoryModel, TagModel, slugify };
