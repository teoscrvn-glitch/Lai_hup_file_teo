const config = require('../config/config');

// Trả về mốc cao nhất mà declaredViews đạt được (hoặc null nếu chưa đạt mốc nào)
function getHighestMilestone(declaredViews) {
  const milestones = config.points.milestones; // đã sắp xếp tăng dần theo views
  let best = null;
  for (const m of milestones) {
    if (declaredViews >= m.views) best = m;
  }
  return best;
}

// Tính số điểm cần cộng thêm = điểm ở mốc mới đạt - điểm đã nhận trước đó (không cộng lại từ đầu)
function calculateRewardDiff(declaredViews, previousMilestoneViews) {
  const newMilestone = getHighestMilestone(declaredViews);
  if (!newMilestone) return { milestone: null, pointsToAward: 0 };

  if (newMilestone.views <= previousMilestoneViews) {
    // Không có mốc mới cao hơn mốc đã nhận -> không cộng thêm
    return { milestone: newMilestone, pointsToAward: 0 };
  }

  const previousMilestone = config.points.milestones
    .filter((m) => m.views === previousMilestoneViews)[0];
  const previousPoints = previousMilestone ? previousMilestone.points : 0;

  return { milestone: newMilestone, pointsToAward: newMilestone.points - previousPoints };
}

module.exports = { getHighestMilestone, calculateRewardDiff };
