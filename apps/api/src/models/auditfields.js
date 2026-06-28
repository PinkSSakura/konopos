/** Default audit / soft-delete fields for sqlite-model `defaults`. */
module.exports = {
  is_active: true,
  is_deleted: false,
  deleted_at: null,
  created_by: null,
  modified_by: null,
  deleted_by: null,
};
