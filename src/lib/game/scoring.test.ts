import { describe, expect, it } from "vitest";
import {
  accuracyPct,
  flickPoints,
  maxPossibleScore,
  precisionPct,
  precisionPoints,
  reactionPoints,
  trackingPct,
  trackingPoints,
} from "./scoring";

describe("accuracyPct", () => {
  it("tính phần trăm trúng/bắn và làm tròn 2 chữ số", () => {
    expect(accuracyPct(3, 4)).toBe(75);
    expect(accuracyPct(1, 3)).toBe(33.33);
  });

  it("không có lượt bắn thì trả về 0 (không chia cho 0)", () => {
    expect(accuracyPct(0, 0)).toBe(0);
  });

  it("kẹp giá trị trúng lớn hơn số lần bắn về 100%", () => {
    expect(accuracyPct(10, 5)).toBe(100);
  });
});

describe("flickPoints", () => {
  it("bắn trúng ngay từ đầu, đúng tâm cho tối đa 100 điểm", () => {
    expect(flickPoints(1, 0)).toBe(100);
  });

  it("bắn càng muộn càng ít điểm", () => {
    expect(flickPoints(0.5, 0)).toBeLessThan(flickPoints(0.9, 0));
  });

  it("bắn lệch tâm càng xa càng ít điểm nhưng không dưới 50% ở mép", () => {
    expect(flickPoints(1, 1)).toBe(50);
    expect(flickPoints(1, 0.5)).toBeGreaterThan(flickPoints(1, 1));
  });

  it("không bao giờ vượt quá 100 và không dưới 25 khi giá trị vào ngoài khoảng", () => {
    expect(flickPoints(5, -3)).toBe(100);
    expect(flickPoints(-1, 9)).toBe(25);
  });
});

describe("trackingPoints / trackingPct", () => {
  it("100 điểm cho mỗi giây bám", () => {
    expect(trackingPoints(1000)).toBe(100);
    expect(trackingPoints(2500)).toBe(250);
  });

  it("thời gian âm được coi là 0", () => {
    expect(trackingPoints(-50)).toBe(0);
  });

  it("tỉ lệ bám = thời gian bám / thời gian bia tồn tại", () => {
    expect(trackingPct(3000, 10000)).toBe(30);
    expect(trackingPct(0, 0)).toBe(0);
    expect(trackingPct(20000, 10000)).toBe(100);
  });
});

describe("reactionPoints", () => {
  it("thời gian phản ứng càng nhanh càng nhiều điểm", () => {
    expect(reactionPoints(200)).toBe(800);
    expect(reactionPoints(150)).toBeGreaterThan(reactionPoints(300));
  });

  it("kẹp trong [0, 1000]", () => {
    expect(reactionPoints(0)).toBe(1000);
    expect(reactionPoints(5000)).toBe(0);
  });
});

describe("precisionPoints / precisionPct", () => {
  it("100 điểm ở tâm và 30 điểm ở mép bia", () => {
    expect(precisionPoints(0)).toBe(100);
    expect(precisionPoints(1)).toBe(30);
  });

  it("độ chính xác tâm = 100% − độ lệch trung bình", () => {
    expect(precisionPct(0)).toBe(100);
    expect(precisionPct(0.25)).toBe(75);
    expect(precisionPct(1)).toBe(0);
  });
});

describe("maxPossibleScore", () => {
  it("giới hạn điểm theo số lần trúng cho Flick/Precision/Reaction", () => {
    expect(maxPossibleScore("FLICK", 60, 10)).toBe(1000);
    expect(maxPossibleScore("PRECISION", 60, 10)).toBe(1000);
    expect(maxPossibleScore("REACTION", 60, 10)).toBe(10000);
  });

  it("Tracking giới hạn theo thời lượng (100 điểm mỗi giây)", () => {
    expect(maxPossibleScore("TRACKING", 30, 0)).toBe(3000);
  });
});
