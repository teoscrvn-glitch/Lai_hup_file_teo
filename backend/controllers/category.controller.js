const { CategoryModel, TagModel } = require('../models/category.model');
const { logAction } = require('../utils/logger');

exports.listCategories = async (req, res, next) => {
  try {
    res.json({ success: true, categories: await CategoryModel.all() });
  } catch (err) { next(err); }
};

exports.createCategory = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Vui lòng nhập tên danh mục.' });
    const id = await CategoryModel.create(name);
    await logAction(req.user.id, 'create_category', name, req.ip);
    res.status(201).json({ success: true, id });
  } catch (err) { next(err); }
};

exports.updateCategory = async (req, res, next) => {
  try {
    await CategoryModel.update(req.params.id, req.body.name);
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    await CategoryModel.delete(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.listTags = async (req, res, next) => {
  try {
    res.json({ success: true, tags: await TagModel.all() });
  } catch (err) { next(err); }
};
