// Sinh mã đơn dạng LHF-XXXXXXXX (8 ký tự chữ hoa + số)
function generateOrderCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `LHF-${code}`;
}

module.exports = generateOrderCode;
